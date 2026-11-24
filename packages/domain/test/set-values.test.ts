import { describe, expect, it } from 'vitest';

import {
  nextSetIndex,
  validateSetValues,
  type ExerciseId,
  type LoggedSet,
  type SetValues,
} from '../src';

const valid: SetValues = { load: { value: 120, unit: 'kg' }, reps: 5, rir: 2 };

describe('validateSetValues', () => {
  it('accepts a normal set and empty values', () => {
    expect(validateSetValues(valid)).toEqual([]);
    expect(validateSetValues({ load: null, reps: null, rir: null })).toEqual([]);
  });

  it('accepts assistance as negative load (WKT-11)', () => {
    expect(validateSetValues({ ...valid, load: { value: -20, unit: 'kg' } })).toEqual([]);
  });

  it.each([
    [{ reps: 2.5 }, { field: 'reps', kind: 'notInteger' }],
    [{ reps: 1001 }, { field: 'reps', kind: 'outOfRange' }],
    [{ load: { value: 2001, unit: 'kg' } }, { field: 'load', kind: 'outOfRange' }],
    [{ load: { value: 4500, unit: 'lb' } }, { field: 'load', kind: 'outOfRange' }],
    [{ load: { value: 60.1234, unit: 'kg' } }, { field: 'load', kind: 'tooPrecise' }],
    [{ load: { value: Number.NaN, unit: 'kg' } }, { field: 'load', kind: 'notFinite' }],
    [{ rir: 10.5 }, { field: 'rir', kind: 'outOfRange' }],
    [{ rir: 1.3 }, { field: 'rir', kind: 'notHalfStep' }],
  ] as const)('rejects %o', (patch, issue) => {
    expect(validateSetValues({ ...valid, ...patch })).toEqual([issue]);
  });
});

const set = (exerciseId: ExerciseId, index: number) => ({ exerciseId, index }) as LoggedSet;

describe('nextSetIndex', () => {
  const squat = 'ex.barbell-back-squat' as ExerciseId;
  const bench = 'ex.barbell-bench-press' as ExerciseId;

  it('counts per exercise', () => {
    expect(nextSetIndex([], squat)).toBe(0);
    expect(nextSetIndex([set(squat, 0), set(bench, 0), set(squat, 1)], squat)).toBe(2);
    expect(nextSetIndex([set(squat, 0), set(bench, 0)], bench)).toBe(1);
  });
});
