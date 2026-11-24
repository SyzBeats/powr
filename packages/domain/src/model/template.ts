import type { Brand, MuscleId } from '../ids';
import type { ProgressionModel, TraineeLevel } from '../rules/params';
import type {
  CompetitionLift,
  LocalizedText,
  MovementPattern,
  RepRange,
  RestClass,
} from './exercise';
import type { Goal, TrainingStyle } from './training';

/*
 * Program templates (PRD §7.4, PLN-02, PLN-07, PLN-08). Moved here from `@powr/content` in M2:
 * the plan generator reads them (technical concept §5.6); `@powr/content` re-exports them.
 */

/** 'tpl.bb-full-body-3day'. */
export type TemplateId = Brand<string, 'TemplateId'>;

export const SPLITS = ['fullBody', 'upperLower', 'upperLowerPpl', 'pushPullLegs', 'sbd'] as const;
export type Split = (typeof SPLITS)[number];

/** PLN-08: selectable per plan, with a style-specific default. */
export const PERIODIZATION_MODELS = [
  'linear',
  'dailyUndulating',
  'weeklyUndulating',
  'block',
] as const;
export type PeriodizationModel = (typeof PERIODIZATION_MODELS)[number];

/** Load prescription modes (PLN-07). */
export const PRESCRIPTION_MODES = [
  'fixed',
  'percent',
  'rpe',
  'doubleProgression',
  'topBackoff',
  'amrap',
  'timed',
  'technique',
] as const;
export type PrescriptionMode = (typeof PRESCRIPTION_MODES)[number];

/** How much a slot matters when time or recovery is short (§8.7.6 step 7 drops `optional`). */
export const SLOT_PRIORITIES = ['primary', 'secondary', 'optional'] as const;
export type SlotPriority = (typeof SLOT_PRIORITIES)[number];

/** Within-week undulation of the competition lifts (PLN-02: heavy/moderate/light). */
export const LIFT_INTENSITIES = ['heavy', 'moderate', 'light'] as const;
export type LiftIntensity = (typeof LIFT_INTENSITIES)[number];

/** An effort target as RIR or RPE range (RPE = 10 − RIR, half points allowed; PLN-07). */
export type EffortTarget =
  | { readonly rir: readonly [min: number, max: number] }
  | { readonly rpe: readonly [min: number, max: number] };

/**
 * One exercise slot of a template day. Without `repRange`, `effort` or `rest`, the plan takes the
 * chosen exercise's default rep range for `goal`, the rules registry's effort target for `goal`
 * and the exercise's rest class; templates state numbers only where the structure needs them
 * (the powerlifting heavy/moderate/light days).
 */
export interface TemplateSlot {
  /** Stable within the template, e.g. "upper-a.press". */
  readonly key: string;
  readonly pattern: MovementPattern;
  /** Muscles the slot is for; the generator ranks candidates by these (MAP-03). */
  readonly targets: readonly MuscleId[];
  readonly priority: SlotPriority;
  /** The slot takes this competition lift (or, with `allowVariants`, a close variant of it). */
  readonly lift?: CompetitionLift;
  readonly allowVariants?: boolean;
  readonly intensity?: LiftIntensity;
  readonly goal: Goal;
  readonly mode: PrescriptionMode;
  readonly repRange?: RepRange;
  readonly effort?: EffortTarget;
  readonly rest?: RestClass;
  /** Back-off sets of a `topBackoff` slot (`repRange`/`effort` above describe the top set). */
  readonly backoff?: { readonly repRange: RepRange; readonly effort: EffortTarget };
}

export interface TemplateDay {
  readonly key: string;
  readonly name: LocalizedText;
  readonly slots: readonly TemplateSlot[];
}

export interface TemplateDef {
  readonly id: TemplateId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly style: TrainingStyle;
  readonly daysPerWeek: number;
  readonly split: Split;
  readonly levels: readonly TraineeLevel[];
  /** The generator's default for this style × days cell (PLN-02); at most one per cell. */
  readonly default: boolean;
  readonly periodization: PeriodizationModel;
  /**
   * Progression rules (`@powr/domain/rules` names): `main` applies to primary slots, `accessory`
   * to the rest; novices use `novice` for primary slots (PLN-02).
   */
  readonly progression: {
    readonly main: ProgressionModel;
    readonly accessory: ProgressionModel;
    readonly novice: ProgressionModel;
  };
  readonly mesocycle: {
    /** Accumulation weeks before the deload (PLN-08: default 4–6, user 3–8). */
    readonly accumulationWeeks: number;
    readonly deloadWeeks: number;
    /** Rules-registry parameter that defines the deload week (PRG-11): `deload.content`. */
    readonly deloadRule: string;
  };
  readonly days: readonly TemplateDay[];
}
