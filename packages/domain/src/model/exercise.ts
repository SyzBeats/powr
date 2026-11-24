import type { EquipmentId, ExerciseId, MuscleId, SourceId } from '../ids';
import type { Mass } from '../units';
import type { MappingEvidence } from './evidence';
import type { Goal } from './training';

/** Translation-ready content text (NFR-MNT-04). */
export interface LocalizedText {
  readonly en: string;
}

/**
 * Movement patterns (EXL-02 filter, ONB-07 avoid list, template slots). The first eighteen are
 * the PRD §7.1 "Classification" list. The last five are joint actions that §7.1 does not name
 * but the §7.2 taxonomy (forearms, upper traps, rear delts) and the EB mapping table rows (fly,
 * rear-delt fly, shrug) need; see IMPLEMENTATION_NOTES.md.
 */
export const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'horizontalPush',
  'verticalPush',
  'horizontalPull',
  'verticalPull',
  'lunge',
  'kneeExtension',
  'kneeFlexion',
  'elbowFlexion',
  'elbowExtension',
  'shoulderAbduction',
  'hipExtension',
  'hipAbduction',
  'hipAdduction',
  'calf',
  'core',
  'carry',
  // Not in PRD §7.1 (see above).
  'shoulderHorizontalAdduction', // fly, pec deck
  'shoulderHorizontalAbduction', // rear-delt fly
  'shrug',
  'wristFlexion',
  'wristExtension',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** Compound or isolation (EXL-01, PRD §7.1). */
export const MECHANICS = ['compound', 'isolation'] as const;
export type Mechanics = (typeof MECHANICS)[number];

/** Competition lifts; close variants link to them through `variantOf` (EXL-07). */
export const COMPETITION_LIFTS = ['squat', 'bench', 'deadlift'] as const;
export type CompetitionLift = (typeof COMPETITION_LIFTS)[number];

/** How load is entered and interpreted (EXL-04, PRD §7.1 "Load model"). */
export const LOAD_TYPES = [
  'barbell', // bar plus plates
  'dumbbell', // load per hand
  'machine', // machine or cable: weight stack or plate-loaded
  'bodyweightAdded', // bodyweight plus optional added load
  'bodyweightAssisted', // bodyweight minus assistance; stored as a negative load (WKT-11)
  'band', // not used for e1RM (EQP-03)
  'timed', // duration instead of load (TMR-09)
] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

/**
 * e1RM load–rep curve class (EXL-04; technical concept §8.7.4, E-3; TD-30): `equation` = the
 * user's e1RM equation (Wathan by default, or the RTS chart), `legPressLike` and `pooled` = the
 * inverted Nuzzo tables (`load.curve.classMap` maps each class to its curve).
 */
export const CURVE_CLASSES = ['equation', 'legPressLike', 'pooled'] as const;
export type CurveClass = (typeof CURVE_CLASSES)[number];

/**
 * Exercise rest classes (TMR-02 rows): strength sets, competition lifts and close variants;
 * hypertrophy multi-joint compounds; hypertrophy single-joint or small-muscle work. The other
 * TMR-02 rows (squat/deadlift, novice, time-saver, superset, warm-up) are context variants of the
 * rules registry, not exercise classes.
 */
export const REST_CLASSES = ['strength', 'hypertrophyCompound', 'hypertrophyIsolation'] as const;
export type RestClass = (typeof REST_CLASSES)[number];

/** Set credit per muscle (EXL-05): 1.0 direct, 0.5 indirect, 0.25 unvalidated convention, 0. */
export const CREDIT_VALUES = [1, 0.5, 0.25, 0] as const;
export type CreditValue = (typeof CREDIT_VALUES)[number];

/** Suitability for progressive overload, 0 (poor) to 3 (stable and loadable) (MAP-03 (d)). */
export const OVERLOAD_SUITABILITY = [0, 1, 2, 3] as const;
export type OverloadSuitability = (typeof OVERLOAD_SUITABILITY)[number];

/** Published IDs never disappear; a retired exercise is deprecated (technical concept §8.12). */
export const EXERCISE_STATUSES = ['active', 'deprecated'] as const;
export type ExerciseStatus = (typeof EXERCISE_STATUSES)[number];

/** One muscle a set of the exercise counts toward (EXL-05, EB §Session › Mapping). */
export interface MuscleCredit {
  readonly muscle: MuscleId;
  readonly credit: CreditValue;
  readonly evidence: MappingEvidence;
  /** Registry source backing the credit; it must exist and must not be excluded. */
  readonly source: SourceId;
}

/** "All of" plus "any of" groups (EQP-04): every `allOf` item and one item of each `anyOf` group. */
export interface EquipmentRequirement {
  readonly allOf: readonly EquipmentId[];
  readonly anyOf: readonly (readonly EquipmentId[])[];
}

export interface LoadModel {
  readonly type: LoadType;
  readonly curveClass: CurveClass;
  readonly unilateral: boolean;
  /** Bodyweight counts toward the load (e1RM uses bodyweight trend + added load, §8.7.4). */
  readonly bodyweightLoaded: boolean;
  /** Default increment; without it the equipment profile decides (PRG-07). */
  readonly increment?: Mass;
}

/** Inclusive rep range, min ≤ max. */
export type RepRange = readonly [min: number, max: number];

export interface ExerciseDefaults {
  readonly repRange: Readonly<Record<Goal, RepRange>>;
  readonly restClass: RestClass;
  /** Eccentric–bottom pause–concentric–top pause, e.g. '2-0-X-0' (TMR-10; X = maximal intent). */
  readonly tempo: string;
  /** Competition lifts keep a fixed range of motion (EXL-07). */
  readonly fixedRom: boolean;
  /** Loads the target muscles at long lengths (MAP-03 (c)). */
  readonly stretchEmphasis: boolean;
}

/** Exercise-level inputs of the MAP-03 effectiveness score. */
export interface ExerciseRanking {
  readonly overloadSuitability: OverloadSuitability;
  /** Sub-regions the exercise covers especially well (MAP-03 (e)). */
  readonly subRegions?: readonly MuscleId[];
}

/** An exercise of the library or a custom one (EXL-01…05, PRD §7.1, technical concept §5.6). */
export interface ExerciseDef {
  readonly id: ExerciseId;
  readonly name: LocalizedText;
  readonly synonyms: readonly string[];
  readonly pattern: MovementPattern;
  readonly mechanics: Mechanics;
  readonly competitionLift?: CompetitionLift;
  readonly variantOf?: ExerciseId;
  /** Substitution group keys, e.g. 'sg.squat-pattern' (EXL-07). */
  readonly substitutionGroups: readonly string[];
  readonly equipment: EquipmentRequirement;
  readonly muscles: readonly MuscleCredit[];
  readonly load: LoadModel;
  readonly defaults: ExerciseDefaults;
  readonly ranking: ExerciseRanking;
  /** 3–6 original execution cues (EXL-03). */
  readonly cues: readonly LocalizedText[];
  /** User-created (EXL-04); the MAP-03 ranking treats custom exercises as unrated. */
  readonly custom: boolean;
  readonly status: ExerciseStatus;
  readonly replacedBy?: ExerciseId;
}
