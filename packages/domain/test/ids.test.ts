import { describe, expect, it } from 'vitest';

import { isContentExerciseId, isEquipmentId, isMuscleId, isSourceId } from '../src';

describe('content ID formats', () => {
  it('accepts exercise, equipment and muscle IDs with one sub-region level', () => {
    expect(isContentExerciseId('ex.barbell-back-squat')).toBe(true);
    expect(isEquipmentId('eq.barbell-olympic')).toBe(true);
    expect(isMuscleId('mu.quads')).toBe(true);
    expect(isMuscleId('mu.quads.rectus-femoris')).toBe(true);
    expect(isMuscleId('mu.quads.vasti.lateralis')).toBe(false);
    expect(isMuscleId('mu.Quads')).toBe(false);
    expect(isEquipmentId('ex.barbell')).toBe(false);
  });

  it('accepts source IDs in the registry convention only', () => {
    for (const id of [
      'src.kubo2019',
      'src.barbalho2020a',
      'src.pmid24265879',
      'src.powr-eb-mapping',
    ]) {
      expect(isSourceId(id)).toBe(true);
    }
    for (const id of [
      'kubo-2019',
      'src.Kubo2019',
      'src.2019kubo',
      'src.kubo_2019',
      'src.kubo--2019',
    ]) {
      expect(isSourceId(id)).toBe(false);
    }
  });
});
