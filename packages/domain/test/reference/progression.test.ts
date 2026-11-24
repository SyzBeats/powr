/**
 * Progression reference suite (PRD PRG-04…07, PRG-10; EB §Progression › Progression rules,
 * § Classification; §Defaults › Progression).
 */
import { describe, expect, it } from 'vitest';

import type { Effort } from '../../src';
import type { Implement } from '../../src/loading';
import {
  apreSession,
  bodyRegionOf,
  classifyTrainee,
  percentLoad,
  suggestApre,
  suggestBackoff,
  suggestDoubleProgression,
  suggestLinear,
  suggestRpeLoad,
  type PerformedSet,
} from '../../src/progression';
import { rules } from '../fixtures/rules';

const RULES = rules();
const kg = (value: number) => ({ value, unit: 'kg' as const });
const entered = (rir: number): Effort => ({ rir, source: 'entered' });
const none: Effort = { rir: null, source: 'none' };
const performed = (load: number, reps: number, effort: Effort): PerformedSet => ({
  type: 'working',
  load: kg(load),
  reps,
  effort,
});

const steps25: Implement = { kind: 'steps', unit: 'kg', start: 0, step: 2.5 };
const homeBar = (micro: boolean): Implement => ({
  kind: 'barbell',
  bar: { weight: 20, unit: 'kg' },
  plates: {
    unit: 'kg',
    plates: [
      { weight: 20, pairs: 4 },
      { weight: 10, pairs: 1 },
      { weight: 5, pairs: 1 },
      { weight: 2.5, pairs: 1 },
      { weight: 1.25, pairs: 1 },
      ...(micro ? [{ weight: 0.5, pairs: 2 }] : []),
    ],
  },
});

const input = (sets: PerformedSet[]) => ({
  lastSets: sets,
  repRange: [8, 12] as const,
  targetRir: 2,
});

const linear = (
  overrides: Partial<Parameters<typeof suggestLinear>[0]>,
  implement = homeBar(false),
) =>
  suggestLinear(
    {
      lastLoad: kg(100),
      reps: 5,
      recentSessions: [true],
      level: 'novice',
      region: 'lower',
      ...overrides,
    },
    { implement },
    RULES,
  );

describe('double progression (PRG-04)', () => {
  it('PRD example: 3 × 8–12 @ RIR 2 at 30 kg, 12/12/12 at RIR 2–3 → 32.5 kg × 8', () => {
    const result = suggestDoubleProgression(
      input([
        performed(30, 12, entered(2)),
        performed(30, 12, entered(3)),
        performed(30, 12, entered(2)),
      ]),
      { implement: steps25 },
      RULES,
    );
    expect(result.value).toMatchObject({ action: 'increase', load: kg(32.5), reps: 8 });
    expect(result.why.rule).toBe('progression.double.topReached');
    expect(result.why.facts).toHaveLength(3);
    expect(result.why.children[0]?.rule).toBe('loading.round');
  });

  it('keeps the load and aims one rep higher below the top or below the target RIR', () => {
    const short = suggestDoubleProgression(
      input([
        performed(30, 12, entered(2)),
        performed(30, 11, entered(2)),
        performed(30, 10, entered(2)),
      ]),
      { implement: steps25 },
      RULES,
    );
    expect(short.value).toMatchObject({ action: 'hold', load: kg(30), reps: 11 });
    expect(short.why.rule).toBe('progression.double.repsUp');
    const tooHard = suggestDoubleProgression(
      input([performed(30, 12, entered(1)), performed(30, 12, entered(2))]),
      { implement: steps25 },
      RULES,
    );
    expect(tooHard.value?.action).toBe('hold');
  });

  it('E-1: a set without effort meets the RIR target only by reaching the top', () => {
    const unknown = suggestDoubleProgression(
      input([performed(30, 12, none), performed(30, 12, none)]),
      { implement: steps25 },
      RULES,
    );
    expect(unknown.value?.action).toBe('increase');
  });

  it('ignores warm-ups and reports when there is no history', () => {
    const warmupOnly = suggestDoubleProgression(
      input([{ ...performed(20, 12, entered(5)), type: 'warmup' }]),
      { implement: steps25 },
      RULES,
    );
    expect(warmupOnly.value).toBeNull();
    expect(warmupOnly.why.rule).toBe('progression.double.noHistory');
  });

  it('holds at the heaviest load the equipment allows', () => {
    const rack: Implement = { kind: 'list', unit: 'kg', weights: [26, 28, 30] };
    const result = suggestDoubleProgression(
      input([performed(30, 12, entered(2))]),
      { implement: rack },
      RULES,
    );
    expect(result.value).toMatchObject({ action: 'hold', load: kg(30) });
    expect(result.why.args['atMaxLoad']).toBe(true);
  });
});

describe('RPE-based loading and in-session back-offs (PRG-05)', () => {
  const bench = {
    type: 'barbell' as const,
    curveClass: 'equation' as const,
    bodyweightLoaded: false,
  };

  it('suggests e1RM × pct(reps + RIR), rounded', () => {
    const result = suggestRpeLoad(
      { e1rmKg: 150, reps: 5, rir: 2, exercise: bench },
      { implement: homeBar(false) },
      RULES,
    );
    expect(result.value).toMatchObject({ action: 'prescribe', load: kg(120), reps: 5 });
    expect(result.why.children[0]?.rule).toBe('e1rm.loadForTarget');
  });

  it('a top set at RPE 9 instead of 8 lowers the back-offs by about 2.5–3%', () => {
    const topSet = { type: 'top' as const, load: kg(120), reps: 5, effort: entered(1) };
    const result = suggestBackoff(
      { topSet, exercise: bench, backoff: { reps: 5, rir: 2 } },
      {},
      RULES,
    );
    const drop = 1 - result.value!.load.value / 120;
    expect(drop).toBeGreaterThan(0.025);
    expect(drop).toBeLessThan(0.033);
    const rounded = suggestBackoff(
      { topSet, exercise: bench, backoff: { reps: 5, rir: 2 } },
      { implement: homeBar(false) },
      RULES,
    );
    expect(rounded.value?.load).toEqual(kg(117.5));
  });

  it('keeps the plan when the top set has no effort', () => {
    const topSet = { type: 'top' as const, load: kg(120), reps: 5, effort: none };
    const result = suggestBackoff(
      { topSet, exercise: bench, backoff: { reps: 5, rir: 2 } },
      {},
      RULES,
    );
    expect(result.value).toBeNull();
    expect(result.why.args['reason']).toBe('noEffort');
  });
});

describe('APRE-6 preset', () => {
  it('ramps 10 × 50% and 6 × 75%, then an AMRAP at the 6RM', () => {
    const session = apreSession(kg(100), { implement: steps25 }, RULES).value;
    expect(session).toEqual([
      { load: kg(50), reps: 10 },
      { load: kg(75), reps: 6 },
      { load: kg(100), reps: null },
    ]);
  });

  it.each([
    [1, 95],
    [3, 97.5],
    [6, 100],
    [10, 102.5],
    [14, 107.5],
  ])('set-3 AMRAP of %i reps → next 6RM %f kg', (amrapReps, next) => {
    expect(
      suggestApre({ sixRm: kg(100), amrapReps }, { implement: steps25 }, RULES).value.load,
    ).toEqual(kg(next));
  });
});

describe('linear progression, increments by level and the stall rule (PRG-06, PRG-07)', () => {
  it('novice: +2.5 kg lower body, +1 kg upper body rounded up to an achievable load', () => {
    expect(linear({}).value).toMatchObject({ action: 'increase', load: kg(102.5) });
    expect(linear({ lastLoad: kg(60), region: 'upper' }).value.load).toEqual(kg(62.5));
    expect(linear({ lastLoad: kg(60), region: 'upper' }, homeBar(true)).value.load).toEqual(kg(61));
  });

  it('intermediate: +1% per week, rounded up', () => {
    expect(linear({ level: 'intermediate' }).value.load).toEqual(kg(102.5));
    expect(linear({ level: 'intermediate' }, homeBar(true)).value.load).toEqual(kg(101));
  });

  it('advanced: no load jump, progress through reps, sets and RPE', () => {
    const result = linear({ level: 'advanced' });
    expect(result.value).toMatchObject({ action: 'hold', load: kg(100) });
    expect(result.why.rule).toBe('progression.linear.advancedHold');
  });

  it('repeats a missed session and resets 10% after two misses in a row', () => {
    expect(linear({ recentSessions: [true, false] }).value).toMatchObject({
      action: 'hold',
      load: kg(100),
    });
    const reset = linear({ recentSessions: [true, false, false] });
    expect(reset.value).toMatchObject({ action: 'reset', load: kg(90) });
    expect(reset.why.rule).toBe('progression.linear.stallReset');
    expect(reset.why.facts).toContainEqual({ kind: 'quantity', name: 'missedInARow', value: 2 });
    expect(reset.why.params.map((p) => p.id)).toEqual([
      'progression.stall.failedSessions',
      'progression.stall.resetPct',
    ]);
  });

  it('maps movement patterns to the body region of the increment', () => {
    expect(bodyRegionOf('squat')).toBe('lower');
    expect(bodyRegionOf('hinge')).toBe('lower');
    expect(bodyRegionOf('horizontalPush')).toBe('upper');
    expect(bodyRegionOf('elbowFlexion')).toBe('upper');
  });
});

describe('fixed percentages', () => {
  it('pct × base, rounded', () => {
    expect(
      percentLoad({ baseKg: 180, pct: 72.5, reps: 5 }, { implement: steps25 }).value.load,
    ).toEqual(kg(130));
  });
});

describe('trainee classification (PRG-10)', () => {
  it.each([
    [1.2, 10, 'novice'],
    [0.5, 10, 'intermediate'],
    [0.1, 12, 'advanced'],
  ] as const)('slope %f %%/week over %i weeks → %s', (slope, weeks, level) => {
    const result = classifyTrainee(
      { trainingAgeMonths: 36, slopePctPerWeek: slope, weeksOfData: weeks },
      RULES,
    );
    expect(result.value).toBe(level);
    expect(result.why.rule).toBe('progression.level.slope');
  });

  it.each([
    [3, 'novice'],
    [12, 'intermediate'],
    [36, 'advanced'],
  ] as const)('training age %i months (too little data) → %s', (months, level) => {
    const result = classifyTrainee(
      { trainingAgeMonths: months, slopePctPerWeek: 2, weeksOfData: 4 },
      RULES,
    );
    expect(result.value).toBe(level);
    expect(result.why.rule).toBe('progression.level.trainingAge');
  });
});
