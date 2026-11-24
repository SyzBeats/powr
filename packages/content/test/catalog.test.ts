import { describe, expect, it } from 'vitest';

import type { EquipmentId, ExerciseId, MuscleId } from '@powr/domain';

import { createContentCatalog, type ContentBundle, type PresetId } from '../src';
import { BUILT_IN_CONTENT, builtInContent } from '../src/built-in';

describe('built-in content catalog', () => {
  const content = builtInContent();

  it('carries the version and hash of the compiled bundle', () => {
    expect(content.version).toBe(BUILT_IN_CONTENT.version);
    expect(content.version.endsWith(`+sha.${BUILT_IN_CONTENT.hash.slice(0, 8)}`)).toBe(true);
  });

  it('lists the competition lifts first, back squat leading', () => {
    expect(
      content
        .exercises()
        .slice(0, 3)
        .map((exercise) => exercise.competitionLift),
    ).toEqual(['squat', 'bench', 'deadlift']);
    expect(content.exercises()[0]?.id).toBe('ex.barbell-back-squat');
  });

  it('looks up exercises, muscles, equipment, presets and templates by ID', () => {
    const squat = content.exercise('ex.barbell-back-squat' as ExerciseId);
    // EB §Session › Mapping: squats do not count toward the hamstrings (MRI evidence).
    expect(squat?.muscles).toContainEqual({
      muscle: 'mu.hamstrings',
      credit: 0,
      evidence: 'H',
      source: 'src.kubo2019',
    });
    expect(content.muscles().muscle('mu.quads' as MuscleId)?.name.en).toBe('Quadriceps');
    expect(content.muscles().muscle('mu.quads.vasti' as MuscleId)?.name.en).toBe('Vasti');
    expect(content.equipment().item('eq.trap-bar' as EquipmentId)?.synonyms).toContain('hex bar');
    expect(content.equipment().preset('preset.custom' as PresetId)?.items).toEqual([]);
    for (const template of content.templates()) {
      expect(content.template(template.id)).toBe(template);
    }
    expect(content.exercise('ex.unknown' as ExerciseId)).toBeUndefined();
  });

  it('refuses a bundle in another format', () => {
    const future = { ...BUILT_IN_CONTENT, format: 2 } as unknown as ContentBundle;
    expect(() => createContentCatalog(future)).toThrow(/format 2/);
  });
});
