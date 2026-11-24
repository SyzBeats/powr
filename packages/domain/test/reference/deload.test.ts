import { describe, expect, it } from 'vitest';

import type { ExerciseId } from '../../src';
import {
  applyReturnStep,
  declineStreak,
  deloadSlots,
  explainAdjustment,
  reactiveDeload,
  returnFromBreak,
} from '../../src/deload';
import { planSlot } from '../fixtures/planning';
import { rules } from '../fixtures/rules';

/**
 * Reference values: EB §Defaults › Deloads (deload content), §Progression › Breaks (return-from-break
 * algorithm) and §Progression › Deloads (reactive trigger), as in PRD PRG-11…13.
 */
const RULES = rules();

describe('PRG-11 planned deload week', () => {
  it('keeps exercises, cuts sets by the midpoint of 40–60%, adds 2 RIR and sets the load band', () => {
    const slots = [
      planSlot('a.press', 'ex.dumbbell-press', 4),
      planSlot('a.squat', 'ex.back-squat', 3, {
        goal: 'strength',
        lift: 'squat',
        prescription: {
          mode: 'topBackoff',
          top: { repRange: [1, 3], rir: [1, 2] },
          backoff: { sets: 3, repRange: [3, 5], rir: [2, 3] },
        },
      }),
    ];
    const deload = deloadSlots(slots, RULES);
    expect(deload.value.slots.map((slot) => slot.exerciseId)).toEqual([
      'ex.dumbbell-press',
      'ex.back-squat',
    ]);
    expect(deload.value.slots[0]).toMatchObject({
      prescription: { sets: 2, rir: [3, 4] },
      loadPct: { min: 80, max: 90 },
    });
    expect(deload.value.slots[1]).toMatchObject({
      prescription: { top: { rir: [3, 4] }, backoff: { sets: 1, rir: [4, 5] } },
      loadPct: { min: 85, max: 100 },
    });
    expect(deload.value.adjustment).toEqual({
      kind: 'deload',
      setsPct: { min: 40, max: 60 },
      rirAdd: 2,
      loadPct: { min: 85, max: 100 },
      notes: ['accessoriesOptional'],
    });
    expect(deload.why.params.map((param) => param.id)).toEqual(['deload.content']);
    expect(explainAdjustment(deload.value.adjustment).rule).toBe('deload.week');
  });
});

describe('PRG-13 return from a break', () => {
  it.each([
    [
      5,
      'resume',
      [{ week: 1, loadPct: null, setsPct: null, rirAdd: 0, notes: ['autoregulateTopSet'] }],
    ],
    [
      10,
      'reduce',
      [
        { week: 1, loadPct: { min: 90, max: 95 }, setsPct: null, rirAdd: 1 },
        { week: 2, loadPct: { min: 95, max: 97.5 }, setsPct: null, rirAdd: 0 },
      ],
    ],
    [
      21,
      'reduce',
      [
        { week: 1, loadPct: { min: 85, max: 90 }, setsPct: { min: 60, max: 70 }, rirAdd: 0 },
        { week: 2, loadPct: { min: 92.5, max: 95 }, setsPct: { min: 80, max: 85 }, rirAdd: 0 },
      ],
    ],
    [
      42,
      'reentry',
      [
        { week: 1, loadPct: { min: 75, max: 85 }, setsPct: { min: 50, max: 50 } },
        { week: 2, loadPct: { min: 81.25, max: 88.75 }, setsPct: { min: 62.5, max: 62.5 } },
        { week: 3, loadPct: { min: 87.5, max: 92.5 }, setsPct: { min: 75, max: 75 } },
        { week: 4, loadPct: { min: 93.75, max: 96.25 }, setsPct: { min: 87.5, max: 87.5 } },
      ],
    ],
    [
      120,
      'recalibrate',
      [{ week: 1, calibrationRir: [3, 4], notes: ['calibrate', 'expectSoreness'] }],
    ],
  ] as const)('%i days off: %s', (daysOff, action, steps) => {
    const result = returnFromBreak(daysOff, RULES);
    expect(result.value.action).toBe(action);
    expect(result.value.steps).toHaveLength(steps.length);
    steps.forEach((step, index) => expect(result.value.steps[index]).toMatchObject(step));
    expect(result.why.rule).toBe(`break.return.${action}`);
  });

  it('notes extra soreness after more than 10 days off and applies a step to the slots', () => {
    expect(returnFromBreak(10, RULES).value.steps[0]!.notes).toEqual([]);
    expect(returnFromBreak(11, RULES).value.steps[0]!.notes).toEqual(['expectSoreness']);
    const step = returnFromBreak(21, RULES).value.steps[0]!;
    const applied = applyReturnStep([planSlot('a.press', 'ex.dumbbell-press', 4)], step, 21);
    expect(applied.slots[0]).toMatchObject({
      prescription: { sets: 3 },
      loadPct: { min: 85, max: 90 },
    });
    expect(applied.adjustment).toMatchObject({
      kind: 'returnFromBreak',
      daysOff: 21,
      setsPct: { min: 60, max: 70 },
    });
  });
});

const lift = (values: number[]) => ({ exerciseId: 'ex.back-squat' as ExerciseId, values });

describe('PRG-12 reactive deload', () => {
  it('counts consecutive declines from the latest session', () => {
    expect(declineStreak([150, 148, 145])).toBe(2);
    expect(declineStreak([150, 145, 147])).toBe(0);
    expect(declineStreak([])).toBe(0);
  });

  it('needs two different signals; a declining lift alone is not enough', () => {
    expect(
      reactiveDeload(
        { mainLifts: [lift([150, 148, 145])], lowReadinessDays: 0, painFlags: 0 },
        RULES,
      ).value,
    ).toEqual({
      propose: false,
      signals: ['performanceDecline'],
    });
    const both = reactiveDeload(
      { mainLifts: [lift([150, 148, 145])], lowReadinessDays: 3, painFlags: 0 },
      RULES,
    );
    expect(both.value).toEqual({ propose: true, signals: ['performanceDecline', 'lowReadiness'] });
    expect(both.why).toMatchObject({
      rule: 'deload.reactive.propose',
      params: [{ id: 'deload.reactive' }],
    });
    expect(
      reactiveDeload({ mainLifts: [lift([150, 151])], lowReadinessDays: 2, painFlags: 1 }, RULES)
        .value.signals,
    ).toEqual(['pain']);
  });
});
