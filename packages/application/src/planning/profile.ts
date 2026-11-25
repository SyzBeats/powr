import {
  addDays,
  weekStartOf,
  type AvoidList,
  type Baseline,
  type BodyPhase,
  type EquipmentProfile,
  type ExerciseId,
  type IsoWeekday,
  type Length,
  type LocalDate,
  type Mesocycle,
  type MuscleId,
  type Plan,
  type PlanSchedule,
  type Profile,
  type SexOption,
  type TemplateId,
  type TrainingStyle,
} from '@powr/domain';
import { sessionDate } from '@powr/domain/planning';
import type { SexReference, TraineeLevel } from '@powr/domain/rules';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import { invalidBaselines } from './baselines';
import { answersFromProfile, today, type PlanOptions } from './context';
import {
  currentMesocycle,
  endActivePlan,
  generatePlanPreview,
  planEquipment,
  planRecords,
  type PlanPreview,
} from './plan';

/**
 * SET-08 (M5s): one onboarding answer changed in Settings. Every field is optional; only the
 * answers the editor changed are given. `schedule` lives on the plan (ONB-05), the rest on the
 * profile. Equipment has its own flow (EQP-05), units their own setting (SET-02).
 */
export interface ProfileChange {
  readonly style?: TrainingStyle;
  readonly phase?: BodyPhase;
  readonly experience?: Profile['experience'];
  readonly levelOverride?: TraineeLevel | null;
  readonly sex?: SexOption;
  readonly referenceSet?: SexReference | null;
  readonly birthYear?: number | null;
  readonly height?: Length | null;
  readonly priorities?: readonly MuscleId[];
  readonly avoid?: AvoidList;
  readonly baselines?: readonly Baseline[];
  readonly schedule?: {
    readonly weekdays: readonly IsoWeekday[];
    /** Minutes; null = "90+". */
    readonly sessionMinutes: number | null;
    readonly startTimes: PlanSchedule['startTimes'];
  };
}

export type ProfileChangeError =
  | { readonly kind: 'noProfile' }
  | { readonly kind: 'invalidAnswers'; readonly fields: readonly string[] }
  /** The plan changed between the preview and the save; preview again. */
  | { readonly kind: 'stale' };

/** The stored answers Settings shows (SET-08): the profile, the plan's schedule and equipment. */
export interface ProfileAnswers {
  readonly profile: Profile;
  readonly plan: {
    readonly name: Plan['name'];
    readonly templateId: TemplateId;
    readonly schedule: PlanSchedule;
  } | null;
  readonly equipment: EquipmentProfile | null;
}

/** SET-08: the answers as stored, for the Settings summary and the single-answer editors. */
export async function profileAnswers(deps: Deps): Promise<ProfileAnswers | null> {
  const loaded = await deps.uow.read(['profile', 'plans', 'equipmentProfiles'], async (repos) => ({
    profile: await repos.profile.get(),
    plan: await repos.plans.getActive(),
    equipment: await repos.equipment.list(),
  }));
  if (!loaded.profile) return null;
  const equipment = loaded.plan
    ? planEquipment(loaded.plan, loaded.equipment)
    : loaded.equipment.find((entry) => entry.isDefault);
  return {
    profile: loaded.profile,
    plan: loaded.plan
      ? {
          name: loaded.plan.name,
          templateId: loaded.plan.templateId,
          schedule: loaded.plan.schedule,
        }
      : null,
    equipment: equipment ?? null,
  };
}

/** What a re-plan would change, in a form the screen lists in words. */
export interface PlanDifferences {
  readonly template: { readonly from: TemplateId; readonly to: TemplateId } | null;
  readonly days: { readonly from: number; readonly to: number } | null;
  readonly added: readonly ExerciseId[];
  readonly removed: readonly ExerciseId[];
  /** Weekly sets per display group that change, current block → new plan. */
  readonly targets: readonly {
    readonly muscle: MuscleId;
    readonly from: number;
    readonly to: number;
  }[];
}

/** A re-plan the user can accept: the new plan from the start of next week. */
export interface Replan {
  readonly planId: Plan['id'];
  readonly preview: PlanPreview;
  /** The first day of the new plan: the start of next week (this week stays as planned). */
  readonly from: LocalDate;
  /**
   * The next block's proposal (PLN-13) picks this change up by itself: experience, priorities,
   * exercises to avoid and the reference set are read from the profile; style and training days
   * belong to the plan.
   */
  readonly nextBlock: boolean;
  readonly differences: PlanDifferences;
}

/** Answers the next block's proposal reads from the profile (`proposeNextMesocycle`). */
const NEXT_BLOCK_FIELDS: readonly (keyof ProfileChange)[] = [
  'experience',
  'levelOverride',
  'sex',
  'referenceSet',
  'priorities',
  'avoid',
];

/**
 * SET-08 "re-plan only when needed": stores nothing. Generates the plan for the current answers
 * and for the changed ones with the same options (template if the style stays, block length,
 * variety, seed, week start); when they are the same, or there is no active plan, `replan` is
 * null and saving changes only the answer. Otherwise `replan` holds the new plan from the start
 * of next week, what changes, and whether the next block would pick the change up anyway.
 */
export async function previewProfileChange(
  deps: Deps,
  change: ProfileChange,
): Promise<Result<{ readonly replan: Replan | null }, ProfileChangeError>> {
  const fields = invalidFields(change);
  if (fields.length > 0) return err({ kind: 'invalidAnswers', fields });
  const loaded = await loadContext(deps);
  if (!loaded) return err({ kind: 'noProfile' });
  const { profile, plan, equipment } = loaded;
  if (!plan || !equipment) return ok({ replan: null });
  const mesocycle = currentMesocycle(plan);
  if (!mesocycle) return ok({ replan: null });

  const changed = applyChange(profile, change, profile.updatedAt);
  const schedule = change.schedule ?? {
    weekdays: plan.schedule.weekdays,
    sessionMinutes: plan.schedule.sessionMinutes,
    startTimes: plan.schedule.startTimes,
  };
  const options: PlanOptions = {
    weekStartsOn: plan.schedule.weekStartsOn,
    variety: plan.variety,
    seed: plan.seed,
    accumulationWeeks: mesocycle.accumulationWeeks,
  };
  const sameStyle = changed.style === plan.style;
  const generate = (who: Profile, days: typeof schedule, templateId: TemplateId | undefined) =>
    generatePlanPreview(deps, {
      answers: answersFromProfile(who, equipment, {
        weekdays: days.weekdays,
        sessionMinutes: days.sessionMinutes,
      }),
      options: templateId ? { ...options, templateId } : options,
      startTimes: days.startTimes,
    });
  const before = await generate(profile, plan.schedule, plan.templateId);
  let after = await generate(changed, schedule, sameStyle ? plan.templateId : undefined);
  // The plan's template may not fit new days: fall back to the recommended one (PLN-02).
  if (!after.ok && sameStyle) after = await generate(changed, schedule, undefined);
  if (!after.ok) return ok({ replan: null });
  if (before.ok && samePlan(before.value, after.value)) return ok({ replan: null });

  const from = addDays(weekStartOf(today(deps), plan.schedule.weekStartsOn), 7);
  const preview = startingOn(after.value, from);
  const keys = (Object.keys(change) as (keyof ProfileChange)[]).filter(
    (key) => change[key] !== undefined,
  );
  return ok({
    replan: {
      planId: plan.id,
      preview,
      from,
      nextBlock: keys.every((key) => NEXT_BLOCK_FIELDS.includes(key)),
      differences: differences(plan, mesocycle, preview),
    },
  });
}

/**
 * SET-08: stores the changed answer. With `replan` (from `previewProfileChange`), in the same
 * transaction the current plan ends at the start of next week (this week's sessions stay as
 * planned) and the new plan starts then; the plan must still be the one previewed. A schedule
 * change without a re-plan (the plan stays the same) updates the plan's session length and start
 * times. Without a re-plan, a style or schedule change applies to the next plan the user sets up;
 * the other answers also reach the next block's proposal (PLN-13).
 */
export async function saveProfileChange(
  deps: Deps,
  input: { readonly change: ProfileChange; readonly replan: Replan | null },
): Promise<Result<{ readonly replanned: boolean }, ProfileChangeError>> {
  const { change, replan } = input;
  const fields = invalidFields(change);
  if (fields.length > 0) return err({ kind: 'invalidAnswers', fields });
  const now = deps.clock.now();
  const rules = replan
    ? (
        await deps.rules.resolve({
          style: replan.preview.proposal.template.style,
          level: replan.preview.level,
        })
      ).rules
    : null;
  return deps.uow.write(['profile', 'plans', 'plannedSessions'], async (repos) => {
    const profile = await repos.profile.get();
    if (!profile) return err({ kind: 'noProfile' as const });
    const plan = await repos.plans.getActive();
    if (replan && plan?.id !== replan.planId) return err({ kind: 'stale' as const });
    await repos.profile.put(applyChange(profile, change, now));
    if (replan && plan && rules) {
      const records = planRecords(deps, replan.preview, {
        equipmentProfileId: plan.equipmentProfileId,
        startDate: replan.from,
        rules,
      });
      await endActivePlan(repos, replan.from);
      await repos.plans.put(records.plan);
      await repos.plannedSessions.putMany(records.sessions);
      return ok({ replanned: true });
    }
    if (plan && change.schedule && sameDays(plan.schedule.weekdays, change.schedule.weekdays)) {
      await repos.plans.put({
        ...plan,
        schedule: {
          ...plan.schedule,
          sessionMinutes: change.schedule.sessionMinutes,
          startTimes: [...change.schedule.startTimes],
        },
        revision: plan.revision + 1,
      });
    }
    return ok({ replanned: false });
  });
}

async function loadContext(deps: Deps) {
  const loaded = await deps.uow.read(['profile', 'plans', 'equipmentProfiles'], async (repos) => ({
    profile: await repos.profile.get(),
    plan: await repos.plans.getActive(),
    equipment: await repos.equipment.list(),
  }));
  if (!loaded.profile) return null;
  return {
    profile: loaded.profile,
    plan: loaded.plan,
    equipment: loaded.plan ? planEquipment(loaded.plan, loaded.equipment) : undefined,
  };
}

/** The profile with the changed answers (the reference set follows the sex, ONB-02). */
function applyChange(profile: Profile, change: ProfileChange, now: Profile['updatedAt']): Profile {
  const sex = change.sex ?? profile.sex;
  const referenceSet =
    sex === 'preferNotToSay'
      ? change.referenceSet !== undefined
        ? change.referenceSet
        : change.sex !== undefined
          ? null
          : profile.referenceSet
      : sex;
  return {
    ...profile,
    ...(change.style === undefined ? {} : { style: change.style }),
    ...(change.phase === undefined ? {} : { phase: change.phase }),
    ...(change.experience === undefined ? {} : { experience: change.experience }),
    ...(change.levelOverride === undefined ? {} : { levelOverride: change.levelOverride }),
    ...(change.birthYear === undefined ? {} : { birthYear: change.birthYear }),
    ...(change.height === undefined ? {} : { height: change.height }),
    ...(change.priorities === undefined ? {} : { priorities: [...change.priorities] }),
    ...(change.avoid === undefined ? {} : { avoid: change.avoid }),
    ...(change.baselines === undefined ? {} : { baselines: [...change.baselines] }),
    sex,
    referenceSet,
    updatedAt: now,
  };
}

/** The ranges the onboarding use case checks (the editors validate too; this is the last guard). */
function invalidFields(change: ProfileChange): string[] {
  const fields: string[] = [];
  const schedule = change.schedule;
  if (schedule) {
    const days = schedule.weekdays;
    if (days.length < 2 || days.length > 6 || new Set(days).size !== days.length)
      fields.push('schedule.weekdays');
    const minutes = schedule.sessionMinutes;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 10 || minutes > 300))
      fields.push('schedule.sessionMinutes');
  }
  if (change.priorities && change.priorities.length > 3) fields.push('priorities');
  const year = change.birthYear;
  if (year !== undefined && year !== null && (year < 1900 || year > 2100)) fields.push('birthYear');
  if (change.height && !(change.height.value > 0)) fields.push('height');
  if (change.baselines && invalidBaselines(change.baselines)) fields.push('baselines');
  return fields;
}

/** What makes two generated plans the same: template, block, days, targets and level. */
function planShape(preview: PlanPreview): string {
  return JSON.stringify({
    template: preview.proposal.template.id,
    weeks: preview.proposal.accumulationWeeks,
    days: preview.proposal.days,
    targets: preview.proposal.targets,
    level: preview.level,
  });
}

function samePlan(a: PlanPreview, b: PlanPreview): boolean {
  return planShape(a) === planShape(b);
}

function sameDays(a: readonly IsoWeekday[], b: readonly IsoWeekday[]): boolean {
  return a.length === b.length && a.every((day) => b.includes(day));
}

/** The preview moved to start on `from` (its first-week calendar with the new dates). */
function startingOn(preview: PlanPreview, from: LocalDate): PlanPreview {
  const weekStartsOn = preview.schedule.weekStartsOn;
  return {
    ...preview,
    startDate: from,
    calendar: preview.calendar.map((day) => ({
      ...day,
      date: sessionDate({ startDate: from }, 1, day.weekday, weekStartsOn),
    })),
  };
}

function exercisesOf(days: Mesocycle['days']): Set<ExerciseId> {
  return new Set(days.flatMap((day) => day.slots.map((slot) => slot.exerciseId)));
}

function setsOf(targets: Mesocycle['targets']): Map<MuscleId, number> {
  return new Map(targets.map((target) => [target.muscle, target.sets]));
}

function differences(plan: Plan, mesocycle: Mesocycle, preview: PlanPreview): PlanDifferences {
  const proposal = preview.proposal;
  const before = exercisesOf(mesocycle.days);
  const after = exercisesOf(proposal.days);
  const oldTargets = setsOf(mesocycle.targets);
  const newTargets = setsOf(proposal.targets);
  const muscles = [...new Set([...oldTargets.keys(), ...newTargets.keys()])].toSorted();
  return {
    template:
      plan.templateId === proposal.template.id
        ? null
        : { from: plan.templateId, to: proposal.template.id },
    days:
      mesocycle.days.length === proposal.days.length
        ? null
        : { from: mesocycle.days.length, to: proposal.days.length },
    added: [...after].filter((id) => !before.has(id)).toSorted(),
    removed: [...before].filter((id) => !after.has(id)).toSorted(),
    targets: muscles.flatMap((muscle) => {
      const from = oldTargets.get(muscle) ?? 0;
      const to = newTargets.get(muscle) ?? 0;
      return Math.round(from * 10) === Math.round(to * 10) ? [] : [{ muscle, from, to }];
    }),
  };
}
