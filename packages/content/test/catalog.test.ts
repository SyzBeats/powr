import { describe, expect, it } from 'vitest';

import type { ExerciseId } from '@powr/domain';

import { builtInContent, createContentCatalog } from '../src';
import { STUB_EXERCISES } from '../src/stub';

describe('content catalog', () => {
  it('ships three valid stub exercises', () => {
    const ids = builtInContent()
      .exercises()
      .map((exercise) => exercise.id);
    expect(ids).toEqual(['ex.barbell-back-squat', 'ex.barbell-bench-press', 'ex.barbell-deadlift']);
    const squat = builtInContent().exercise('ex.barbell-back-squat' as ExerciseId);
    expect(squat?.name.en).toBe('Barbell back squat');
    // EB §Session › Mapping: squats do not count toward the hamstrings (MRI evidence).
    expect(squat?.muscles).toContainEqual({
      muscle: 'mu.hamstrings',
      credit: 0,
      evidence: 'H',
      source: 'src.kubo2019',
    });
  });

  it('rejects invalid IDs, unknown keys, out-of-set values and duplicates', () => {
    const squat: Record<string, unknown> = { ...(STUB_EXERCISES[0] as object), id: 'ex.squat' };
    const muscles = squat['muscles'] as Record<string, unknown>[];
    expect(() => createContentCatalog('t', [{ ...squat, id: 'Squat' }])).toThrow(/ex\.some-name/);
    expect(() => createContentCatalog('t', [{ ...squat, colour: 'red' }])).toThrow(/colour/);
    expect(() => createContentCatalog('t', [{ ...squat, pattern: 'twist' }])).toThrow(/pattern/);
    expect(() =>
      createContentCatalog('t', [{ ...squat, muscles: [{ ...muscles[0], credit: 0.75 }] }]),
    ).toThrow(/credit/);
    expect(() =>
      createContentCatalog('t', [{ ...squat, muscles: [{ ...muscles[0], source: 'kubo-2019' }] }]),
    ).toThrow(/src\.kubo2019/);
    expect(() => createContentCatalog('t', [squat, squat])).toThrow(/Duplicate/);
  });
});
