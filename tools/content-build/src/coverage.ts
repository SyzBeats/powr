import type { ContentBundle, PresetId } from '@powr/content';
import type { EquipmentId, EquipmentRequirement, ExerciseId, MuscleId } from '@powr/domain';

import { ContentIndex } from './lint.ts';

/**
 * EQP-04: every `allOf` item and one item of each `anyOf` group. The engine's own check lives in
 * @powr/domain (`equipment` module); this copy serves the content coverage tests.
 */
export function isAvailable(
  requirement: EquipmentRequirement,
  items: ReadonlySet<EquipmentId>,
): boolean {
  return (
    requirement.allOf.every((id) => items.has(id)) &&
    requirement.anyOf.every((group) => group.some((id) => items.has(id)))
  );
}

export interface PresetCoverage {
  /** Active exercises the preset's equipment allows. */
  readonly available: readonly ExerciseId[];
  /** Display group → available exercises that credit it ≥ 0.5 (EXL-01). */
  readonly groups: ReadonlyMap<MuscleId, readonly ExerciseId[]>;
}

export interface CoverageReport {
  /** Display group → active exercises that credit it ≥ 0.5, itself or through a sub-region. */
  readonly groups: ReadonlyMap<MuscleId, readonly ExerciseId[]>;
  /** Sub-region → active exercises that credit it ≥ 0.5 directly or rank it (MAP-03 (e)). */
  readonly subRegions: ReadonlyMap<MuscleId, readonly ExerciseId[]>;
  /** Only presets with at least one item; "Custom (empty)" has nothing to cover. */
  readonly presets: ReadonlyMap<PresetId, PresetCoverage>;
}

/** The facts behind the coverage rules (§8.12 step 3); the thresholds live in the tests. */
export function contentCoverage(bundle: ContentBundle): CoverageReport {
  const index = new ContentIndex(bundle);
  const active = bundle.exercises.filter((exercise) => exercise.status === 'active');
  const crediting = (exercises: typeof active, muscle: MuscleId) =>
    exercises
      .filter((exercise) => index.creditFor(exercise, muscle) >= 0.5)
      .map((exercise) => exercise.id);
  const byGroup = (exercises: typeof active) =>
    new Map(bundle.muscles.map((group) => [group.id, crediting(exercises, group.id)]));

  const subRegions = new Map(
    bundle.muscles
      .flatMap((group) => group.subRegions)
      .map((sub) => [
        sub.id,
        active
          .filter(
            (exercise) =>
              exercise.muscles.some((c) => c.muscle === sub.id && c.credit >= 0.5) ||
              (exercise.ranking.subRegions ?? []).includes(sub.id),
          )
          .map((exercise) => exercise.id),
      ]),
  );

  const presets = new Map(
    bundle.presets
      .filter((preset) => preset.items.length > 0)
      .map((preset) => {
        const items = new Set(preset.items);
        const available = active.filter((exercise) => isAvailable(exercise.equipment, items));
        return [
          preset.id,
          { available: available.map((exercise) => exercise.id), groups: byGroup(available) },
        ];
      }),
  );
  return { groups: byGroup(active), subRegions, presets };
}
