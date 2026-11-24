import {
  TIME_OFF_DAYS,
  toIsoWithOffset,
  toLocalDate,
  type Baseline,
  type BodyPhase,
  type Length,
  type Mass,
  type MeetInfo,
  type Plan,
  type PlanSchedule,
  type Profile,
  type SexOption,
} from '@powr/domain';
import type { MetaRecord } from '@powr/formats';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import type { PlanningAnswers } from './context';
import { endActivePlan, planRecords, type PlanPreview } from './plan';

/** `meta` keys of onboarding (§6.1). */
export const ONBOARDING_DRAFT_KEY = 'onboardingDraft';
export const LEGAL_ACK_KEY = 'legalAck';

/** Every onboarding answer (ONB-02…09); the draft holds any part of them (ONB-12). */
export interface OnboardingAnswers extends PlanningAnswers {
  readonly displayName?: string;
  readonly units: Profile['units'];
  readonly sex: SexOption;
  readonly birthYear: number | null;
  readonly height: Length | null;
  /** ONB-02: becomes the first bodyweight entry (BOD-01). */
  readonly bodyweight: Mass | null;
  readonly phase: BodyPhase;
  readonly startTimes: PlanSchedule['startTimes'];
  readonly baselines: readonly Baseline[];
  /** ONB-09 (powerlifting and powerbuilding): captured in MVP, used from v1.x. */
  readonly meet: Omit<MeetInfo, 'id' | 'createdAt'> | null;
}

/** ONB-12: the step to resume and the answers so far. */
export interface OnboardingDraft {
  readonly step: string;
  readonly answers: Partial<OnboardingAnswers>;
}

/** ONB-12: saves the draft after each step, so a killed app resumes at the same step. */
export async function saveOnboardingDraft(deps: Deps, draft: OnboardingDraft): Promise<void> {
  // A JSON copy: the stored value is plain JSON, as backups and the meta schema expect.
  const value: MetaRecord['value'] = JSON.parse(
    JSON.stringify({
      step: draft.step,
      answers: draft.answers,
      savedAt: toIsoWithOffset(deps.clock.now()),
    }),
  );
  await deps.uow.write(['meta'], (repos) => repos.meta.put({ key: ONBOARDING_DRAFT_KEY, value }));
}

/**
 * ONB-12: the saved draft, or null when there is none or it is unreadable (a draft from an
 * older app version or a restored backup starts over rather than crashing the onboarding).
 */
export async function loadOnboardingDraft(deps: Deps): Promise<OnboardingDraft | null> {
  const record = await deps.uow.read(['meta'], (repos) => repos.meta.get(ONBOARDING_DRAFT_KEY));
  const value = record?.value;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const { step, answers } = value as { step?: unknown; answers?: unknown };
  if (
    typeof step !== 'string' ||
    answers === null ||
    typeof answers !== 'object' ||
    Array.isArray(answers)
  ) {
    return null;
  }
  return { step, answers };
}

export interface LegalVersions {
  readonly disclaimerVersion: string;
  readonly privacyVersion: string;
}

/** ONB-01/LEG-01/LEG-03: records the acknowledgement with the versions and a timestamp. */
export async function acknowledgeLegal(deps: Deps, versions: LegalVersions): Promise<void> {
  const ageConfirmedAt = toIsoWithOffset(deps.clock.now());
  await deps.uow.write(['meta'], (repos) =>
    repos.meta.put({ key: LEGAL_ACK_KEY, value: { ...versions, ageConfirmedAt } }),
  );
}

/** ONB-01: whether the stored acknowledgement matches the current texts (else ask again). */
export async function isLegalAcknowledged(deps: Deps, current: LegalVersions): Promise<boolean> {
  const record = await deps.uow.read(['meta'], (repos) => repos.meta.get(LEGAL_ACK_KEY));
  const value = record?.value as Partial<LegalVersions> | null | undefined;
  return (
    value?.disclaimerVersion === current.disclaimerVersion &&
    value.privacyVersion === current.privacyVersion
  );
}

export type CompleteOnboardingError = {
  readonly kind: 'invalidAnswers';
  readonly fields: readonly string[];
};

/**
 * §6.1 step 7 (ONB-10, ONB-12): writes, in one strict transaction, the profile, the settings,
 * the equipment profile (the default), the first bodyweight entry, the meet details and, unless
 * the user chose "Just let me log" (`preview: null`, PLN-15), the accepted plan with its planned
 * sessions; then clears the draft. Either all of it is stored or nothing is.
 */
export async function completeOnboarding(
  deps: Deps,
  input: { readonly answers: OnboardingAnswers; readonly preview: PlanPreview | null },
): Promise<
  Result<{ readonly profile: Profile; readonly plan: Plan | null }, CompleteOnboardingError>
> {
  const { answers } = input;
  const fields = invalidFields(answers);
  if (fields.length > 0) return err({ kind: 'invalidAnswers', fields });

  const now = deps.clock.now();
  const profile: Profile = {
    id: 'me',
    ...(answers.displayName ? { displayName: answers.displayName } : {}),
    units: answers.units,
    sex: answers.sex,
    referenceSet: answers.sex === 'preferNotToSay' ? answers.referenceSet : answers.sex,
    birthYear: answers.birthYear,
    height: answers.height,
    style: answers.style,
    phase: answers.phase,
    experience: answers.experience,
    levelOverride: answers.levelOverride,
    priorities: answers.priorities,
    avoid: answers.avoid,
    preferredExercises: answers.preferredExercises,
    baselines: answers.baselines,
    createdAt: now,
    updatedAt: now,
  };
  const equipment = { ...answers.equipment, isDefault: true };
  const records = input.preview
    ? planRecords(deps, input.preview, {
        equipmentProfileId: equipment.id,
        rules: (await deps.rules.resolve({ style: answers.style, level: input.preview.level }))
          .rules,
        daysOff: TIME_OFF_DAYS[answers.experience.timeOff],
      })
    : null;
  const bodyweightId = deps.ids.next();
  const meetId = deps.ids.next();

  await deps.uow.write(
    [
      'meta',
      'settings',
      'profile',
      'equipmentProfiles',
      'plans',
      'plannedSessions',
      'bodyweights',
      'meets',
    ],
    async (repos) => {
      await repos.profile.put(profile);
      const settings = await repos.settings.get();
      await repos.settings.put({
        ...settings,
        id: 'me',
        theme: settings?.theme ?? 'system',
        ...(input.preview ? { weekStart: input.preview.schedule.weekStartsOn } : {}),
      });
      for (const other of await repos.equipment.list()) {
        if (other.isDefault && other.id !== equipment.id)
          await repos.equipment.put({ ...other, isDefault: false });
      }
      await repos.equipment.put(equipment);
      if (answers.bodyweight) {
        await repos.bodyweights.put({
          id: bodyweightId,
          localDate: toLocalDate(now),
          measuredAt: now,
          mass: answers.bodyweight,
        });
      }
      if (answers.meet) await repos.meets.put({ ...answers.meet, id: meetId, createdAt: now });
      if (records) {
        await endActivePlan(repos, toLocalDate(now));
        await repos.plans.put(records.plan);
        await repos.plannedSessions.putMany(records.sessions);
      }
      await repos.meta.delete(ONBOARDING_DRAFT_KEY);
    },
  );
  return ok({ profile, plan: records?.plan ?? null });
}

/** The answers' fields that are out of range (the UI validates too; this is the last guard). */
function invalidFields(answers: OnboardingAnswers): string[] {
  const fields: string[] = [];
  const days = answers.schedule.weekdays;
  if (days.length < 2 || days.length > 6 || new Set(days).size !== days.length)
    fields.push('schedule.weekdays');
  const minutes = answers.schedule.sessionMinutes;
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 10 || minutes > 300)) {
    fields.push('schedule.sessionMinutes');
  }
  if (answers.priorities.length > 3) fields.push('priorities');
  if (answers.birthYear !== null && (answers.birthYear < 1900 || answers.birthYear > 2100))
    fields.push('birthYear');
  if (answers.bodyweight !== null && !(answers.bodyweight.value > 0)) fields.push('bodyweight');
  if (answers.equipment.name.trim() === '') fields.push('equipment.name');
  return fields;
}
