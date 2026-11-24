import type { OnboardingAnswers } from '@powr/application/planning';
import type { Baseline, EquipmentProfile, IsoWeekday, Profile } from '@powr/domain';

/** The steps in order (ONB-01…10). `welcome` is the legal gate and only part of first-run. */
export const STEPS = [
  'welcome',
  'goal',
  'experience',
  'schedule',
  'body',
  'equipment',
  'priorities',
  'baselines',
  'preview',
] as const;
export type Step = (typeof STEPS)[number];

/** Steps the user may skip in one tap (ONB-12); the core path is the rest (NFR-USE-02). */
export const OPTIONAL_STEPS: readonly Step[] = ['priorities', 'baselines'];

export function isStep(value: string): value is Step {
  return (STEPS as readonly string[]).includes(value);
}

/** What the user knows about a lift (ONB-08): nothing, a recent set or a 1-rep max. */
export type BaselineKind = 'none' | Baseline['kind'];

/** One lift of the baselines step as typed (text, so "102." keeps its point while typing). */
export interface BaselineInput {
  readonly kind: BaselineKind;
  readonly load: string;
  readonly reps: string;
  /** Reps in reserve; null: "not sure" (the unknown-effort prior applies, E-1). */
  readonly rir: number | null;
  /** The day of a 1RM, 'YYYY-MM-DD', or '' when not given. */
  readonly date: string;
}

/**
 * Answers collected so far (the draft, ONB-12), plus the baselines step's inputs as typed, so an
 * unfinished entry is pointed out rather than dropped, and a resumed onboarding shows it again.
 */
export type Draft = Partial<OnboardingAnswers> & {
  readonly baselineInputs?: Readonly<Record<string, BaselineInput>>;
};

/** The units of the answers: the user's choice, else the locale's default (ONB-02). */
export function draftUnits(draft: Draft, locale: string = deviceLocale()): Profile['units'] {
  return draft.units ?? defaultUnits(locale);
}

/** The device locale (numbers, dates and unit defaults follow it, NFR-L10N-01). */
export function deviceLocale(): string {
  return navigator.languages[0] ?? navigator.language ?? 'en';
}

/** The regions that weigh in pounds (ISO 3166 codes: United States, Liberia, Myanmar). */
const IMPERIAL_REGIONS = /^(?:US|LR|MM)$/;

/** Lb for the few countries that weigh in pounds, kg elsewhere (ONB-02 default, editable). */
function defaultUnits(locale: string): Profile['units'] {
  const region = (() => {
    try {
      return new Intl.Locale(locale).maximize().region ?? '';
    } catch {
      return '';
    }
  })();
  const imperial = IMPERIAL_REGIONS.test(region);
  return imperial
    ? { load: 'lb', bodyweight: 'lb', length: 'in' }
    : { load: 'kg', bodyweight: 'kg', length: 'cm' };
}

/**
 * Complete answers from a draft: what the user skipped takes a neutral default (no priorities,
 * nothing avoided, no body data, three days of 60 minutes). "Just let me log" (PLN-15) stores
 * the profile from these; the schedule only matters once a plan is generated.
 */
export function completeAnswers(
  draft: Draft,
  equipment: EquipmentProfile,
  locale: string,
): OnboardingAnswers {
  return {
    style: draft.style ?? 'bodybuilding',
    experience: draft.experience ?? {
      trainingAge: 'under6Months',
      timeOff: 'upTo1Week',
      rpeFamiliarity: 'none',
      recentVolume: [],
    },
    levelOverride: draft.levelOverride ?? null,
    referenceSet: draft.referenceSet ?? null,
    schedule: draft.schedule ?? { weekdays: [1, 3, 5] as IsoWeekday[], sessionMinutes: 60 },
    equipment: draft.equipment ?? equipment,
    priorities: draft.priorities ?? [],
    avoid: draft.avoid ?? { exercises: [], patterns: [] },
    preferredExercises: draft.preferredExercises ?? [],
    units: draftUnits(draft, locale),
    sex: draft.sex ?? 'preferNotToSay',
    birthYear: draft.birthYear ?? null,
    height: draft.height ?? null,
    bodyweight: draft.bodyweight ?? null,
    phase: draft.phase ?? 'notTracking',
    startTimes: draft.startTimes ?? [],
    baselines: draft.baselines ?? [],
    meet: draft.meet ?? null,
    ...(draft.planOptions ? { planOptions: draft.planOptions } : {}),
  };
}

/** The draft of a stored profile (re-planning from Settings or "Plan not set up"). */
export function draftFromProfile(profile: Profile, equipment: EquipmentProfile | undefined): Draft {
  return {
    style: profile.style,
    experience: profile.experience,
    levelOverride: profile.levelOverride,
    referenceSet: profile.referenceSet,
    priorities: profile.priorities,
    avoid: profile.avoid,
    preferredExercises: profile.preferredExercises,
    units: profile.units,
    sex: profile.sex,
    birthYear: profile.birthYear,
    height: profile.height,
    bodyweight: null,
    phase: profile.phase,
    baselines: profile.baselines,
    meet: null,
    ...(profile.displayName ? { displayName: profile.displayName } : {}),
    ...(equipment ? { equipment } : {}),
  };
}

/** The step where a field the use case rejected is asked (WCAG 3.3.1: point to the fix). */
export function stepOfField(field: string): Step {
  if (field.startsWith('schedule')) return 'schedule';
  if (field.startsWith('equipment')) return 'equipment';
  if (field === 'priorities') return 'priorities';
  if (field === 'baselines') return 'baselines';
  if (field === 'birthYear' || field === 'bodyweight' || field === 'height') return 'body';
  return 'goal';
}
