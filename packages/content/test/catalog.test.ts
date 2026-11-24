import { describe, expect, it } from 'vitest';

import type { ExerciseId } from '@powr/domain';

import { builtInContent, createContentCatalog } from '../src';

describe('content catalog', () => {
  it('ships three valid stub exercises', () => {
    const ids = builtInContent()
      .exercises()
      .map((exercise) => exercise.id);
    expect(ids).toEqual(['ex.barbell-back-squat', 'ex.barbell-bench-press', 'ex.barbell-deadlift']);
    expect(builtInContent().exercise('ex.barbell-deadlift' as ExerciseId)?.name.en).toBe(
      'Barbell deadlift',
    );
  });

  it('rejects invalid IDs, unknown keys and duplicates', () => {
    const squat = {
      id: 'ex.squat',
      name: { en: 'Squat' },
      mechanics: 'compound',
      status: 'active',
    };
    expect(() => createContentCatalog('t', [{ ...squat, id: 'Squat' }])).toThrow(/ex\.some-name/);
    expect(() => createContentCatalog('t', [{ ...squat, colour: 'red' }])).toThrow(/colour/);
    expect(() => createContentCatalog('t', [squat, squat])).toThrow(/Duplicate/);
  });
});
