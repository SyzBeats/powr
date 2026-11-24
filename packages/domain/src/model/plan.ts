import type { Brand, ExerciseId, LocalDate, MuscleId } from '../ids';
import type { ProgressionModel, Range, TraineeLevel } from '../rules/params';
import type { TechniqueKind } from '../rules/techniques';
import type { InstantTz, IsoWeekday } from '../time';
import type { Mass } from '../units';
import type { VersionStamp } from '../version';
import type { CompetitionLift, LocalizedText, MovementPattern, RepRange } from './exercise';
import type {
  LiftIntensity,
  PeriodizationModel,
  SlotPriority,
  Split,
  TemplateId,
} from './template';
import type { Goal, TrainingStyle } from './training';

/*
 * Plans, mesocycles and planned sessions (PLN-01…15, PRG-11…13; technical concept §5.6, §8.2.2).
 * A plan holds its mesocycles; each mesocycle holds its week template (`days`), because the
 * exercise selection is fixed within a mesocycle and rotates between them (PLN-05, PLN-13).
 * Planned sessions are the dated instances of a mesocycle's days, with their own copy of the
 * slots (deload and return-from-break adjustments apply to the instance, not the template).
 */

export type PlanId = Brand<string, 'PlanId'>;
export type PlannedSessionId = Brand<string, 'PlannedSessionId'>;
export type BreakId = Brand<string, 'BreakId'>;

/** An RIR range [min, max]; RPE = 10 − RIR, half points allowed (PLN-07). */
export type RirRange = readonly [min: number, max: number];

/** One block of sets with a rep range and an effort target. */
export interface SetBlock {
  readonly sets: number;
  readonly repRange: RepRange;
  readonly rir: RirRange;
}

/**
 * Load prescription of a slot (PLN-07; technical concept §5.6). Reps are ranges and efforts are
 * RIR ranges, because the templates state them so; the session (M3) picks the numbers.
 */
export type Prescription =
  /** Rep range + RIR; the load follows the last performance (PRG-04). */
  | ({ readonly mode: 'doubleProgression' } & SetBlock)
  /** Load from e1RM for reps + RIR (PRG-05). */
  | ({ readonly mode: 'rpe' } & SetBlock)
  /** A top set from e1RM, then back-offs relative to it. */
  | {
      readonly mode: 'topBackoff';
      readonly top: { readonly repRange: RepRange; readonly rir: RirRange };
      readonly backoff: SetBlock;
    }
  | {
      readonly mode: 'percent';
      readonly sets: number;
      readonly repRange: RepRange;
      readonly pct: number;
      readonly of: 'e1rm' | 'trainingMax';
    }
  | { readonly mode: 'fixed'; readonly sets: number; readonly reps: number; readonly load: Mass }
  | {
      readonly mode: 'amrap';
      readonly load: { readonly pct: number } | { readonly fixed: Mass };
      readonly stopAtRir?: number;
    }
  | { readonly mode: 'timed'; readonly sets: number; readonly durationS: number }
  | {
      readonly mode: 'technique';
      readonly technique: TechniqueKind;
      readonly base: SetBlock;
    };

/** One exercise of a planned day (PLN-07): what to do, how to progress it, how long to rest. */
export interface PlanSlot {
  /** Stable within the plan: the template slot key, or `custom.<n>` for added slots. */
  readonly key: string;
  readonly exerciseId: ExerciseId;
  /** The slot's movement pattern and target muscles (rotation and substitutions keep them). */
  readonly pattern: MovementPattern;
  readonly targets: readonly MuscleId[];
  readonly priority: SlotPriority;
  readonly goal: Goal;
  readonly lift?: CompetitionLift;
  readonly allowVariants?: boolean;
  readonly intensity?: LiftIntensity;
  readonly prescription: Prescription;
  readonly progression: ProgressionModel;
  readonly restSeconds: number;
  /**
   * Load as a percentage of the normal working load, set on deload and return-from-break
   * instances (PRG-11, PRG-13); the session engine applies it to the suggested load (M3).
   */
  readonly loadPct?: Range;
  /** Locked by the user: kept when the next mesocycle rotates exercises (PLN-13). */
  readonly locked?: boolean;
}

export interface PlanDay {
  readonly key: string;
  readonly name: LocalizedText;
  readonly weekday: IsoWeekday;
  readonly slots: readonly PlanSlot[];
}

/**
 * Where a weekly muscle target came from (PLN-03). `timeBudget`: lowered towards the minimum
 * dose because the session time budget cannot fit the full target (PLN-14).
 */
export const TARGET_SOURCES = [
  'band',
  'priority',
  'maintenance',
  'recent',
  'logged',
  'user',
  'timeBudget',
] as const;
export type TargetSource = (typeof TARGET_SOURCES)[number];

/** Weekly fractional hard sets for one display group (PLN-03, hypertrophy). */
export interface MuscleTarget {
  readonly muscle: MuscleId;
  readonly sets: number;
  readonly source: TargetSource;
  /** The full target before the time budget lowered it; present only for source `timeBudget`. */
  readonly full?: number;
}

/** Weekly direct heavy sets for one competition lift (PLN-03, strength). */
export interface LiftTarget {
  readonly lift: CompetitionLift;
  readonly heavySets: number;
}

export const MESOCYCLE_STATUSES = ['planned', 'active', 'completed'] as const;
export type MesocycleStatus = (typeof MESOCYCLE_STATUSES)[number];

/** PLN-08: N accumulation weeks plus one deload week (PRG-11). */
export interface Mesocycle {
  /** 0-based. */
  readonly index: number;
  /** First day of week 1 (a week start for the user's week-start setting, SET-11). */
  readonly startDate: LocalDate;
  readonly accumulationWeeks: number;
  readonly deloadWeeks: number;
  readonly status: MesocycleStatus;
  readonly level: TraineeLevel;
  readonly days: readonly PlanDay[];
  readonly targets: readonly MuscleTarget[];
  readonly liftTargets: readonly LiftTarget[];
  /** The week the next mesocycle starts from, saved by an edit "from the next mesocycle" (PLN-09). */
  readonly next?: { readonly days: readonly PlanDay[]; readonly targets: readonly MuscleTarget[] };
  /** PRG-11/12: postponed once by a week, skipped with a note, or brought forward. */
  readonly deload: {
    readonly postponed: boolean;
    readonly skipped: boolean;
    readonly broughtForward: boolean;
  };
}

export interface PlanSchedule {
  /** Training weekdays (ONB-05, PLN-11), in week order. */
  readonly weekdays: readonly IsoWeekday[];
  readonly weekStartsOn: IsoWeekday;
  /** Session length budget in minutes; null = "90+" (no budget, PLN-14). */
  readonly sessionMinutes: number | null;
  /** Optional start time per training weekday, 'HH:MM' (ONB-05, CAL-02). */
  readonly startTimes: readonly { readonly weekday: IsoWeekday; readonly time: string }[];
}

export const PLAN_STATUSES = ['active', 'ended'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** At most this many dismissed warning keys are kept per plan; the oldest go first (PLN-09). */
export const MAX_DISMISSED_ISSUES = 500;

export interface Plan {
  readonly id: PlanId;
  readonly status: PlanStatus;
  readonly name: LocalizedText;
  readonly templateId: TemplateId;
  readonly style: TrainingStyle;
  readonly split: Split;
  readonly periodization: PeriodizationModel;
  readonly equipmentProfileId: string;
  readonly schedule: PlanSchedule;
  /** Opt-in "variety mode" (PLN-05) and the seed of its PRNG (§8.7.1). */
  readonly variety: boolean;
  readonly seed: number;
  readonly mesocycles: readonly Mesocycle[];
  readonly createdAt: InstantTz;
  /** Engine, rules (hashed, TD-31) and content versions the plan was generated with (PRG-18). */
  readonly versions: VersionStamp;
  /** Bumped by every saved edit. */
  readonly revision: number;
  /**
   * Keys of the validation warnings the user dismissed (PLN-09: "not shown again for the same
   * plan state"); a key encodes the numbers it is about, so a changed plan shows it again.
   */
  readonly dismissedIssues: readonly string[];
}

export const PLANNED_SESSION_STATUSES = [
  'planned',
  'done',
  'skipped',
  'merged',
  'onBreak',
] as const;
export type PlannedSessionStatus = (typeof PLANNED_SESSION_STATUSES)[number];

export const ADJUSTMENT_KINDS = ['deload', 'returnFromBreak', 'recalibrate', 'mergedWork'] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

/**
 * A change applied to one planned session (data; the explanation is rebuilt from it): the deload
 * week (PRG-11), a return-from-break step (PRG-13) or work merged in from a missed session.
 */
export interface SessionAdjustment {
  readonly kind: AdjustmentKind;
  /** Load as a percentage of the normal working load (the session engine applies it, M3). */
  readonly loadPct?: Range;
  /** Sets as a percentage of the planned sets (already applied to the slots). */
  readonly setsPct?: Range;
  /** RIR added to the targets (already applied to the slots). */
  readonly rirAdd?: number;
  /** Days without training that led to a return-from-break step. */
  readonly daysOff?: number;
  readonly notes: readonly AdjustmentNote[];
}

export const ADJUSTMENT_NOTES = [
  'autoregulateTopSet',
  'expectSoreness',
  'calibrate',
  'accessoriesOptional',
] as const;
export type AdjustmentNote = (typeof ADJUSTMENT_NOTES)[number];

export interface PlannedSession {
  readonly id: PlannedSessionId;
  readonly planId: PlanId;
  readonly mesocycleIndex: number;
  /** 1-based week within the mesocycle. */
  readonly week: number;
  readonly dayKey: string;
  readonly name: LocalizedText;
  readonly kind: 'regular' | 'deload';
  /** The day it is planned for now (moves change it, PLN-11). */
  readonly localDate: LocalDate;
  /** The day the plan first gave it. */
  readonly scheduledDate: LocalDate;
  readonly status: PlannedSessionStatus;
  readonly slots: readonly PlanSlot[];
  readonly adjustments: readonly SessionAdjustment[];
  /** Set when a missed session's key work was merged into another one (PLN-11). */
  readonly mergedInto?: PlannedSessionId;
  /** Revision counter for calendar export (`.ics` SEQUENCE, CAL-04). */
  readonly revision: number;
}

export const BREAK_REASONS = ['vacation', 'illness', 'injury', 'life', 'other'] as const;
export type BreakReason = (typeof BREAK_REASONS)[number];

/** A planned or retroactive break (PLN-12, MOT-04): sessions inside are not "missed". */
export interface TrainingBreak {
  readonly id: BreakId;
  readonly startDate: LocalDate;
  /** Null while the break is open-ended. */
  readonly endDate: LocalDate | null;
  readonly reason: BreakReason;
  readonly note?: string;
  readonly createdAt: InstantTz;
}
