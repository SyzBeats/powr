import type {
  Brand,
  CompetitionLift,
  EquipmentId,
  ExerciseDef,
  Goal,
  LocalizedText,
  Mass,
  MassUnit,
  MovementPattern,
  MuscleId,
  RepRange,
  RestClass,
  TrainingStyle,
} from '@powr/domain';

/*
 * Content types that the M1 domain contract does not define yet (IMPLEMENTATION_NOTES.md,
 * "M1-B content"): muscle taxonomy, equipment catalog and presets, templates and the compiled
 * bundle. The constants are tiny `as const` arrays that the schemas validate against; the union
 * types derive from them, as in @powr/domain.
 */

// ---------------------------------------------------------------------------------------------
// Muscle taxonomy (PRD §7.2, technical concept §8.11)

/** Body areas: the grouping of display groups in the list view, filters and heat-map legend. */
export const BODY_AREAS = ['chest', 'shoulders', 'arms', 'back', 'core', 'legs'] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

/** The two views of the body map (MAP-01). */
export const BODY_VIEWS = ['front', 'back'] as const;
export type BodyView = (typeof BODY_VIEWS)[number];

/**
 * Body-map regions per view: `front.chest`, `back.side-delts`. The original SVG artwork
 * (§8.11) carries these IDs; a muscle has one region in each view where it is visible.
 */
export type BodyMapRegions = Readonly<Partial<Record<BodyView, string>>>;

interface MuscleBase {
  readonly name: LocalizedText;
  readonly synonyms: readonly string[];
  readonly bodyMap: BodyMapRegions;
  /** The evidence base has longitudinal hypertrophy data (MRI or ultrasound) for this muscle. */
  readonly ebHypertrophyData: boolean;
}

/**
 * A sub-region (EXL-05, MAP-07): `mu.<group>.<sub-region>`. It rolls up to its display group by
 * ID convention: the group's ID is the sub-region's ID without its last segment.
 */
export interface MuscleSubRegionDef extends MuscleBase {
  readonly id: MuscleId;
}

/** A display group of the PRD §7.2 taxonomy (`mu.<group>`): one tappable body-map region. */
export interface MuscleGroupDef extends MuscleBase {
  readonly id: MuscleId;
  readonly area: BodyArea;
  /** PRD §7.2 marks the group optional (tibialis, "Could"); coverage rules are relaxed. */
  readonly optional: boolean;
  readonly subRegions: readonly MuscleSubRegionDef[];
}

export type MuscleDef = MuscleGroupDef | MuscleSubRegionDef;

// ---------------------------------------------------------------------------------------------
// Equipment catalog and presets (EQP-01…03)

export const EQUIPMENT_CATEGORIES = [
  'bar',
  'rack',
  'bench',
  'freeWeight',
  'cable',
  'machine',
  'bodyweight',
  'accessory',
  'cardio',
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

/**
 * Which load details an item needs (EQP-03). The inventory itself (plates, dumbbells, …) is
 * part of an equipment profile; presets give defaults for it.
 */
export type EquipmentLoading =
  /** A bar with a default weight per unit system (one `Mass` per unit). */
  | {
      readonly kind: 'bar';
      readonly defaultWeight: readonly Mass[];
      /** The weight differs between models; the equipment editor asks the user to check. */
      readonly variesByModel: boolean;
    }
  /** A weight stack with a default increment per unit system. */
  | { readonly kind: 'stack'; readonly defaultIncrement: readonly Mass[] }
  /** Loaded with plates; the empty weight (sled, carriage, Smith bar) differs between models. */
  | { readonly kind: 'plateLoaded' }
  | { readonly kind: 'plates' }
  | { readonly kind: 'microplates' }
  | { readonly kind: 'dumbbells' }
  | { readonly kind: 'kettlebells' }
  /** Bands: labels with an optional nominal resistance; never used for e1RM (EQP-03). */
  | { readonly kind: 'bands' };

export interface EquipmentDef {
  readonly id: EquipmentId;
  readonly name: LocalizedText;
  /** Search terms (EQP-01: "hex bar" finds the trap bar). */
  readonly synonyms: readonly string[];
  readonly category: EquipmentCategory;
  readonly loading?: EquipmentLoading;
}

/** Pairs of one plate denomination; the unit is the inventory's. */
export interface PlatePairs {
  readonly weight: number;
  readonly pairs: number;
}

/** Fixed dumbbells (a list) or a range with a step (a rack, or adjustable dumbbells). */
export type DumbbellSet =
  | { readonly weights: readonly number[] }
  | { readonly from: number; readonly to: number; readonly step: number };

/** Default load inventory of a preset in one unit system (EQP-03); plain numbers in `unit`. */
export interface PresetInventory {
  readonly plates?: readonly PlatePairs[];
  readonly microplates?: readonly PlatePairs[];
  readonly dumbbells?: DumbbellSet;
  readonly kettlebells?: readonly number[];
}

/** 'preset.commercial-gym'. */
export type PresetId = Brand<string, 'PresetId'>;

/** A gym preset (EQP-02): pre-selected items plus default inventories in kg and lb. */
export interface EquipmentPresetDef {
  readonly id: PresetId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly items: readonly EquipmentId[];
  /** Defaults per unit system, so a lb gym gets lb plates (EQP-03: independent of display). */
  readonly inventory: Readonly<Partial<Record<MassUnit, PresetInventory>>>;
}

// ---------------------------------------------------------------------------------------------
// Program templates (PRD §7.4, PLN-02, PLN-07, PLN-08)

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

/** Progression rules: double progression (PRG-04), RPE-based load (PRG-05), linear (PRG-06). */
export const PROGRESSION_MODELS = ['doubleProgression', 'rpeLoad', 'linearLoad'] as const;
export type ProgressionModel = (typeof PROGRESSION_MODELS)[number];

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

/** Trainee levels (PRG-10). */
export const TRAINEE_LEVELS = ['novice', 'intermediate', 'advanced'] as const;
export type TraineeLevel = (typeof TRAINEE_LEVELS)[number];

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
  /** `main` applies to primary slots, `accessory` to the rest; novices use `novice` (PLN-02). */
  readonly progression: {
    readonly main: ProgressionModel;
    readonly accessory: ProgressionModel;
    readonly novice: ProgressionModel;
  };
  readonly mesocycle: {
    /** Accumulation weeks before the deload (PLN-08: default 4–6, user 3–8). */
    readonly accumulationWeeks: number;
    readonly deloadWeeks: number;
    /** Rules-registry parameter that defines the deload week (PRG-11), e.g. "deload.planned". */
    readonly deloadRule: string;
  };
  readonly days: readonly TemplateDay[];
}

// ---------------------------------------------------------------------------------------------
// The compiled bundle (technical concept §8.12 step 5)

/** Bumped when the shape of `content.json` changes incompatibly. */
export const CONTENT_FORMAT = 1;

/** `content.json`: validated, linted and hashed at build time by tools/content-build. */
export interface ContentBundle {
  readonly format: typeof CONTENT_FORMAT;
  /** SemVer of @powr/content plus the content hash, e.g. "0.1.0+sha.3f2a9c1b" (§7.8). */
  readonly version: string;
  /** SHA-256 (hex) of the canonical JSON of everything below. */
  readonly hash: string;
  readonly muscles: readonly MuscleGroupDef[];
  readonly equipment: readonly EquipmentDef[];
  readonly presets: readonly EquipmentPresetDef[];
  readonly exercises: readonly ExerciseDef[];
  readonly templates: readonly TemplateDef[];
}
