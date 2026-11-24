import type { Explanation } from '../explain';
import type { ExerciseId, MuscleId } from '../ids';
import type {
  AvoidList,
  CompetitionLift,
  ExerciseDef,
  LiftTarget,
  MuscleTarget,
  PlanDay,
  RecentVolume,
  TemplateDef,
  TemplateId,
  TrainingStyle,
} from '../model';
import type { RestRules } from '../rest';
import type { ProgressionModel, RuleSet, TraineeLevel } from '../rules';
import type { IsoWeekday } from '../time';
import type { VolumeBand } from '../volume';

/**
 * The registry parameters the planner reads, resolved for the user's level and style. Rest
 * times depend on the exercise too (the competition squat and deadlift rest 4:00), so the
 * caller can pass `restRules` resolved per exercise; otherwise these rules apply to every slot.
 */
export type PlanningRules = RuleSet;

export type { RestRules } from '../rest';

/** What the generator chooses from: the exercise library and the templates (content). */
export interface PlanningCatalog {
  readonly exercises: readonly ExerciseDef[];
  readonly templates: readonly TemplateDef[];
  /** Rules resolved for one exercise (rest variants); defaults to the planning rules. */
  readonly restRules?: (exercise: ExerciseDef) => RestRules;
}

/** Everything plan generation depends on (PLN-01); same request and seed → same plan. */
export interface PlanRequest {
  readonly style: TrainingStyle;
  readonly level: TraineeLevel;
  /** Training weekdays (ONB-05); their count is the days per week. */
  readonly weekdays: readonly IsoWeekday[];
  readonly weekStartsOn: IsoWeekday;
  /** Session length budget in minutes; null = "90+" (PLN-14). */
  readonly sessionMinutes: number | null;
  /** Item IDs of the equipment profile (`itemsOf` in `@powr/domain/equipment`). */
  readonly equipment: ReadonlySet<string>;
  /** Up to 3 display groups (ONB-07). */
  readonly priorities: readonly MuscleId[];
  readonly avoid: AvoidList;
  /** Favourites the generator prefers (EXL-08). */
  readonly preferred: readonly ExerciseId[];
  /** ONB-04 recent weekly hard sets per display group (PLN-03 starting volume). */
  readonly recentVolume: readonly RecentVolume[];
  /** The user's template choice (PLN-02 override); otherwise the default of the cell. */
  readonly templateId?: TemplateId;
  /** Accumulation weeks (PLN-08: 3–8); otherwise the template's. */
  readonly accumulationWeeks?: number;
  /** Opt-in variety mode (PLN-05) and its seed. */
  readonly variety: boolean;
  readonly seed: number;
}

/** A ranked alternative for a slot (the swap list of the plan editor, MAP-03). */
export interface SlotCandidate {
  readonly exerciseId: ExerciseId;
  readonly score: number;
}

/** Why a slot holds its exercise, with the alternatives the editor can swap in. */
export interface SlotChoice {
  readonly dayKey: string;
  readonly slotKey: string;
  readonly exerciseId: ExerciseId;
  readonly candidates: readonly SlotCandidate[];
  readonly why: Explanation;
}

export interface MuscleWeek {
  readonly muscle: MuscleId;
  readonly fractional: number;
  readonly direct: number;
  /** The plan's weekly target (hypertrophy muscles only). */
  readonly target: number | null;
  readonly band: VolumeBand;
  /** Days that train the muscle (≥ 1 fractional set). */
  readonly sessions: number;
}

export interface LiftWeek {
  readonly lift: CompetitionLift;
  /** Direct heavy sets (≥ 80% 1RM, 1–6 reps) per week. */
  readonly heavySets: number;
  /** Days with the lift or a close variant. */
  readonly sessions: number;
  readonly target: number | null;
}

export interface DayWeek {
  readonly dayKey: string;
  readonly weekday: IsoWeekday;
  /** Estimated duration in minutes (PLN-14). */
  readonly minutes: number;
  readonly workingSets: number;
  readonly exercises: number;
  readonly muscles: readonly {
    readonly muscle: MuscleId;
    readonly fractional: number;
    readonly direct: number;
  }[];
  readonly heavySets: readonly { readonly lift: CompetitionLift; readonly sets: number }[];
}

/** The week template's numbers: what the preview and the live editor panel show (PLN-09). */
export interface WeekAnalysis {
  readonly muscles: readonly MuscleWeek[];
  readonly lifts: readonly LiftWeek[];
  readonly days: readonly DayWeek[];
}

/** PLN-01 constraints, in the PRD's order, plus the checks the editor adds. */
export const PLAN_CONSTRAINTS = [
  'equipment',
  'volume',
  'frequency',
  'sessionCap',
  'time',
  'spacing',
  'coverage',
  'prescription',
  'deload',
] as const;
export type PlanConstraint = (typeof PLAN_CONSTRAINTS)[number];

export type IssueSeverity = 'violation' | 'warning';

/** What made an issue unavoidable for these inputs (PLN-01: flagged, not fixed). */
export type IssueCause =
  | 'timeBudget'
  | 'sessionCap'
  | 'slotLimit'
  | 'equipment'
  | 'template'
  | 'days';

export type IssueSubject =
  | { readonly kind: 'plan' }
  | { readonly kind: 'muscle'; readonly muscle: MuscleId }
  | { readonly kind: 'lift'; readonly lift: CompetitionLift }
  | { readonly kind: 'day'; readonly dayKey: string }
  | { readonly kind: 'slot'; readonly dayKey: string; readonly slotKey: string };

/** A concrete change that resolves an issue (PLN-14: "flagged with concrete fixes"). */
export type PlanFix =
  | {
      readonly kind: 'removeSets';
      readonly dayKey: string;
      readonly slotKey: string;
      readonly sets: number;
    }
  | { readonly kind: 'removeSlot'; readonly dayKey: string; readonly slotKey: string }
  | {
      readonly kind: 'superset';
      readonly dayKey: string;
      readonly slotKeys: readonly [string, string];
    }
  | { readonly kind: 'techniqueSet'; readonly dayKey: string; readonly slotKey: string }
  | { readonly kind: 'timeSaverRest'; readonly dayKey: string }
  | {
      readonly kind: 'addSets';
      readonly dayKey: string;
      readonly slotKey: string;
      readonly sets: number;
    }
  | {
      readonly kind: 'swapExercise';
      readonly dayKey: string;
      readonly slotKey: string;
      readonly exerciseId: ExerciseId;
    }
  /**
   * Input fixes (PLN-14): a longer session budget (null = "90+") or one more training day. They
   * change the user's answers, not the week, so the plan is generated again with them.
   */
  | { readonly kind: 'sessionMinutes'; readonly minutes: number | null }
  | { readonly kind: 'addDay' };

export interface ValidationIssue {
  /**
   * Stable for the same plan state, so a dismissed warning stays dismissed until the numbers
   * change (PLN-09), e.g. `volume.low:mu.chest:8`.
   */
  readonly key: string;
  readonly constraint: PlanConstraint;
  readonly severity: IssueSeverity;
  readonly subject: IssueSubject;
  /** The inputs make it unavoidable (PLN-01); null when a change of the plan resolves it. */
  readonly cause: IssueCause | null;
  /** The rule (`why.rule`) and the registry parameters it rests on (`why.params`). */
  readonly why: Explanation;
  readonly fixes: readonly PlanFix[];
}

export type ConstraintStatus = 'satisfied' | 'warning' | 'violated';

/** The PLN-01 constraint report for a generated or edited week (§8.7.6 step 9). */
export interface ValidationReport {
  /** No violation that a change of the plan could avoid. */
  readonly ok: boolean;
  readonly constraints: readonly {
    readonly constraint: PlanConstraint;
    readonly status: ConstraintStatus;
  }[];
  readonly issues: readonly ValidationIssue[];
  readonly analysis: WeekAnalysis;
}

/** What a plan is validated against: the user's situation, not the plan itself. */
export interface ValidationContext {
  readonly style: TrainingStyle;
  readonly level: TraineeLevel;
  readonly sessionMinutes: number | null;
  readonly equipment: ReadonlySet<string>;
  readonly avoid: AvoidList;
  readonly targets: readonly MuscleTarget[];
  readonly liftTargets: readonly LiftTarget[];
  /** Accumulation and deload weeks of the mesocycle (PLN-08). */
  readonly accumulationWeeks: number;
  readonly deloadWeeks: number;
  readonly exercise: (id: ExerciseId) => ExerciseDef | undefined;
  /** The library, to tell "add a curl" from "no curl is available" (coverage, PLN-05). */
  readonly exercises: readonly ExerciseDef[];
  readonly restRules?: (exercise: ExerciseDef) => RestRules;
}

/** A generated week template with everything the preview shows (ONB-10). */
export interface PlanProposal {
  readonly template: TemplateDef;
  readonly level: TraineeLevel;
  readonly days: readonly PlanDay[];
  readonly targets: readonly MuscleTarget[];
  readonly liftTargets: readonly LiftTarget[];
  readonly accumulationWeeks: number;
  readonly deloadWeeks: number;
  /** The progression models of primary and other slots (PLN-02, PRG-04…06). */
  readonly progression: { readonly primary: ProgressionModel; readonly other: ProgressionModel };
  readonly choices: readonly SlotChoice[];
  readonly report: ValidationReport;
  /** Key choices for the preview: template, schedule, mesocycle, targets, trims. */
  readonly notes: readonly Explanation[];
}
