import type {
  EquipmentDef,
  EquipmentPresetDef,
  ExerciseDef,
  LocalizedText,
  MuscleId,
  TemplateDef,
} from '@powr/domain';

/*
 * Content types the domain contract does not define (IMPLEMENTATION_NOTES.md, "M1-B content"):
 * the muscle taxonomy and the compiled bundle. The equipment catalog, presets and templates moved
 * to @powr/domain in M2 and are re-exported below. The constants are tiny `as const` arrays that
 * the schemas validate against; the union types derive from them, as in @powr/domain.
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
// Equipment catalog, presets and templates: defined in @powr/domain since M2, because the plan
// generator and the equipment profile read them (technical concept §5.6); re-exported here so
// content code keeps one import site.

export {
  EQUIPMENT_CATEGORIES,
  LIFT_INTENSITIES,
  PERIODIZATION_MODELS,
  PRESCRIPTION_MODES,
  SLOT_PRIORITIES,
  SPLITS,
  type DumbbellSet,
  type EffortTarget,
  type EquipmentCategory,
  type EquipmentDef,
  type EquipmentLoading,
  type EquipmentPresetDef,
  type LiftIntensity,
  type PeriodizationModel,
  type PlatePairs,
  type PrescriptionMode,
  type PresetId,
  type PresetInventory,
  type SlotPriority,
  type Split,
  type TemplateDay,
  type TemplateDef,
  type TemplateId,
  type TemplateSlot,
} from '@powr/domain';
/** Progression rules (PRG-04…06, APRE): the rules registry's names (`@powr/domain/rules`). */
export {
  PROGRESSION_MODELS,
  TRAINEE_LEVELS,
  type ProgressionModel,
  type TraineeLevel,
} from '@powr/domain/rules';

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
