import type { EquipmentId, ExerciseDef, ExerciseId, MuscleId } from '@powr/domain';

import {
  CONTENT_FORMAT,
  type ContentBundle,
  type EquipmentDef,
  type EquipmentPresetDef,
  type MuscleDef,
  type MuscleGroupDef,
  type PresetId,
  type TemplateDef,
  type TemplateId,
} from './types';

export interface MuscleTaxonomy {
  /** Display groups in PRD §7.2 order, each with its sub-regions. */
  readonly groups: readonly MuscleGroupDef[];
  /** A display group or a sub-region. */
  muscle(id: MuscleId): MuscleDef | undefined;
}

export interface EquipmentCatalog {
  readonly items: readonly EquipmentDef[];
  readonly presets: readonly EquipmentPresetDef[];
  item(id: EquipmentId): EquipmentDef | undefined;
  preset(id: PresetId): EquipmentPresetDef | undefined;
}

/** The content a build ships (technical concept §5.5). Custom exercises merge in later (EXL-04). */
export interface ContentCatalog {
  /** SemVer + content hash, e.g. "0.1.0+sha.3f2a9c1b" (§7.8). */
  readonly version: string;
  exercise(id: ExerciseId): ExerciseDef | undefined;
  exercises(): readonly ExerciseDef[];
  muscles(): MuscleTaxonomy;
  equipment(): EquipmentCatalog;
  templates(): readonly TemplateDef[];
  template(id: TemplateId): TemplateDef | undefined;
}

/**
 * Indexes a compiled bundle. No validation happens here: tools/content-build validated, linted
 * and hashed the bundle at build time (§8.12), so the app's startup path stays free of Zod
 * (TD-17). Only the format number is checked, to fail loudly on a mismatched file.
 */
export function createContentCatalog(bundle: ContentBundle): ContentCatalog {
  if (bundle.format !== CONTENT_FORMAT) {
    throw new Error(`Content format ${String(bundle.format)} is not ${String(CONTENT_FORMAT)}`);
  }
  const exercises = indexBy(bundle.exercises);
  const muscles = indexBy(bundle.muscles.flatMap((group) => [group, ...group.subRegions]));
  const items = indexBy(bundle.equipment);
  const presets = indexBy(bundle.presets);
  const templates = indexBy(bundle.templates);

  const taxonomy: MuscleTaxonomy = {
    groups: bundle.muscles,
    muscle: (id) => muscles.get(id),
  };
  const equipment: EquipmentCatalog = {
    items: bundle.equipment,
    presets: bundle.presets,
    item: (id) => items.get(id),
    preset: (id) => presets.get(id),
  };
  return {
    version: bundle.version,
    exercise: (id) => exercises.get(id),
    exercises: () => bundle.exercises,
    muscles: () => taxonomy,
    equipment: () => equipment,
    templates: () => bundle.templates,
    template: (id) => templates.get(id),
  };
}

function indexBy<T extends { readonly id: string }>(entries: readonly T[]): Map<T['id'], T> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}
