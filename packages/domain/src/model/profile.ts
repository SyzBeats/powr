import type { ExerciseId, LocalDate, MuscleId } from '../ids';
import type { SexReference, TraineeLevel } from '../rules/params';
import type { InstantTz } from '../time';
import type { Length, LengthUnit, Mass, MassUnit } from '../units';
import type { MovementPattern } from './exercise';
import type { TrainingStyle } from './training';

/*
 * The single local profile (ONB-02…09, ONB-13) and the records onboarding writes besides the plan:
 * the first bodyweight entry (ONB-02 → BOD-01) and the meet details (ONB-09). No account, e-mail
 * or name exists anywhere; the display name is optional and stays local.
 */

/** ONB-02: "prefer not to say" asks for a reference set (or none) for scoring and formulas. */
export const SEX_OPTIONS = ['female', 'male', 'preferNotToSay'] as const;
export type SexOption = (typeof SEX_OPTIONS)[number];

/** ONB-03: optional body-composition phase. */
export const BODY_PHASES = ['bulk', 'cut', 'maintain', 'notTracking'] as const;
export type BodyPhase = (typeof BODY_PHASES)[number];

/** ONB-04: consistent training age (< 6 months, 6–24 months, 2–5 years, > 5 years). */
export const TRAINING_AGE_BANDS = [
  'under6Months',
  'months6To24',
  'years2To5',
  'over5Years',
] as const;
export type TrainingAgeBand = (typeof TRAINING_AGE_BANDS)[number];

/** ONB-04: time since the last regular training (≤ 1 week … > 2 months). */
export const TIME_OFF_BANDS = [
  'upTo1Week',
  'weeks1To2',
  'weeks2To4',
  'months1To2',
  'over2Months',
] as const;
export type TimeOffBand = (typeof TIME_OFF_BANDS)[number];

/** ONB-04: familiarity with RPE/RIR; sets the default RIR input style (SET-05). */
export const RPE_FAMILIARITY = ['none', 'some', 'experienced'] as const;
export type RpeFamiliarity = (typeof RPE_FAMILIARITY)[number];

/** Months of consistent training a band stands for (its lower bound), for PRG-10. */
export const TRAINING_AGE_MONTHS: Readonly<Record<TrainingAgeBand, number>> = {
  under6Months: 0,
  months6To24: 6,
  years2To5: 24,
  over5Years: 60,
};

/** Days without regular training a band stands for (its upper bound), for PRG-13. */
export const TIME_OFF_DAYS: Readonly<Record<TimeOffBand, number>> = {
  upTo1Week: 7,
  weeks1To2: 14,
  weeks2To4: 28,
  months1To2: 56,
  over2Months: 90,
};

/** ONB-04: "about how many hard sets per week" for one muscle group (display group). */
export interface RecentVolume {
  readonly muscle: MuscleId;
  readonly sets: number;
}

/** ONB-08: a known 1RM or a recent set (weight × reps, RIR if known) of a main lift. */
export interface Baseline {
  readonly exerciseId: ExerciseId;
  readonly kind: 'oneRepMax' | 'recentSet';
  readonly load: Mass;
  readonly reps: number;
  readonly rir: number | null;
  readonly date?: LocalDate;
}

/** ONB-07: avoided exercises and movement patterns (EXL-08); never generated or suggested. */
export interface AvoidList {
  readonly exercises: readonly ExerciseId[];
  readonly patterns: readonly MovementPattern[];
}

export interface Profile {
  readonly id: 'me';
  readonly displayName?: string;
  readonly units: {
    readonly load: MassUnit;
    readonly bodyweight: MassUnit;
    readonly length: LengthUnit;
  };
  readonly sex: SexOption;
  /** Coefficients for scoring and formulas; null = skipped (features prompt inline). */
  readonly referenceSet: SexReference | null;
  readonly birthYear: number | null;
  readonly height: Length | null;
  readonly style: TrainingStyle;
  readonly phase: BodyPhase;
  readonly experience: {
    readonly trainingAge: TrainingAgeBand;
    readonly timeOff: TimeOffBand;
    readonly rpeFamiliarity: RpeFamiliarity;
    readonly recentVolume: readonly RecentVolume[];
  };
  /** The user's own level label (PRG-10: the user can override the classification). */
  readonly levelOverride: TraineeLevel | null;
  /** Up to 3 display groups (ONB-07). */
  readonly priorities: readonly MuscleId[];
  readonly avoid: AvoidList;
  /** Favourites the generator prefers (EXL-08), e.g. the sumo deadlift as the competition pull. */
  readonly preferredExercises: readonly ExerciseId[];
  /**
   * EXL-08 (M4a): exercises removed from lists (library, body-map rankings, substitutions); still
   * loggable and kept in plans that use them. Absent = none (profiles written before M4a).
   */
  readonly hiddenExercises?: readonly ExerciseId[];
  readonly baselines: readonly Baseline[];
  readonly createdAt: InstantTz;
  readonly updatedAt: InstantTz;
}

/** A bodyweight log entry (BOD-01); onboarding writes the first one (ONB-02). */
export interface BodyweightEntry {
  readonly id: string;
  readonly localDate: LocalDate;
  readonly measuredAt: InstantTz;
  readonly mass: Mass;
  readonly note?: string;
}

export const WEIGH_IN_TYPES = ['hours2', 'hours24'] as const;
export type WeighInType = (typeof WEIGH_IN_TYPES)[number];

export const MEET_DIVISIONS = ['classic', 'equipped'] as const;
export type MeetDivision = (typeof MEET_DIVISIONS)[number];

/** ONB-09: competition details (captured in MVP, used by peaking and attempts in v1.x). */
export interface MeetInfo {
  readonly id: string;
  readonly date: LocalDate;
  readonly weighIn: WeighInType | null;
  /** Free text such as "-83 kg" or "84+". */
  readonly weightClass: string | null;
  readonly division: MeetDivision | null;
  readonly federation: string | null;
  readonly createdAt: InstantTz;
}
