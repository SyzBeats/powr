/**
 * e1RM and load-for-target reference suite (EB §Load › e1RM algorithm worked example, PRD PRG-01
 * and PRG-05 example; technical concept §8.7.4 and §8.7.7 E-1).
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Effort, LocalDate } from '../../src';
import {
  curvePct,
  effectiveReps,
  estimateSetE1rm,
  loadForTarget,
  personalPriorRir,
  sessionE1rm,
  setWeight,
  type E1rmExercise,
  type E1rmSetInput,
} from '../../src/e1rm';
import type { Implement } from '../../src/loading';
import { rules } from '../fixtures/rules';

const RULES = rules();
const RTS_RULES = rules({ 'load.e1rm.equation': 'rts' });
const bench: E1rmExercise = { type: 'barbell', curveClass: 'equation', bodyweightLoaded: false };
const entered = (rir: number): Effort => ({ rir, source: 'entered' });
const none: Effort = { rir: null, source: 'none' };
const set = (
  load: number,
  reps: number,
  effort: Effort,
  type: E1rmSetInput['type'] = 'working',
) => ({
  type,
  load: { value: load, unit: 'kg' as const },
  reps,
  effort,
});

const day = (d: string) => d as LocalDate;

const bar = (micro: boolean): Implement => ({
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
      ...(micro
        ? [
            { weight: 0.5, pairs: 1 },
            { weight: 0.25, pairs: 1 },
          ]
        : []),
    ],
  },
});

describe('EB worked example: 4 reps @ RPE 8', () => {
  it('r_eff 6 → 83.7% (RTS) or 83.1% (Wathan)', () => {
    expect(effectiveReps(4, 2, RULES)).toBe(6);
    expect(curvePct('equation', 6, RTS_RULES)! * 100).toBeCloseTo(83.7, 1);
    expect(curvePct('equation', 6, RULES)! * 100).toBeCloseTo(83.1, 1);
  });
});

describe('PRD PRG-05 golden example: e1RM 150 kg, 5 @ RPE 8', () => {
  const input = { e1rmKg: 150, reps: 5, rir: 2, exercise: bench };

  it('Wathan 80.6% → 120.9 kg → 120 kg with 2.5 kg steps, 121 kg with microplates', () => {
    const plain = loadForTarget(input, { implement: bar(false) }, RULES).value!;
    expect(plain.reff).toBe(7);
    expect(plain.pct * 100).toBeCloseTo(80.6, 1);
    expect(plain.totalKg).toBeCloseTo(120.9, 1);
    expect(plain.load).toEqual({ value: 120, unit: 'kg' });
    const micro = loadForTarget(input, { implement: bar(true) }, RULES).value!;
    expect(micro.load).toEqual({ value: 121, unit: 'kg' });
  });

  it('RTS 81.1% → 121.7 kg', () => {
    const rts = loadForTarget(input, {}, RTS_RULES).value!;
    expect(rts.totalKg).toBeCloseTo(121.65, 2);
    expect(rts.load).toEqual({ value: rts.totalKg, unit: 'kg' });
  });

  it('explains the target with curve parameters and the rounding step', () => {
    const why = loadForTarget(input, { implement: bar(false) }, RULES).why;
    expect(why.rule).toBe('e1rm.loadForTarget');
    expect(why.params.map((p) => p.id)).toEqual([
      'load.curve.classMap',
      'load.e1rm.equation',
      'load.rirBias',
    ]);
    expect(why.children.map((c) => c.rule)).toEqual(['loading.round']);
  });
});

describe('set e1RM (PRG-01)', () => {
  it('a single at RIR 0 is the 1RM', () => {
    expect(estimateSetE1rm(set(140, 1, entered(0)), bench, {}, RULES).value).toMatchObject({
      e1rmKg: 140,
      reff: 1,
      weight: 1,
    });
  });

  it('weights by RPE and effective reps, then by set order', () => {
    expect(setWeight(8, 8, RULES)).toBe(1);
    expect(setWeight(7.5, 6, RULES)).toBe(0.5);
    expect(setWeight(9, 10, RULES)).toBe(0.5);
    expect(setWeight(6, 5, RULES)).toBe(0.1);
    expect(setWeight(9, 14, RULES)).toBe(0.1);
    expect(setWeight(9, 16, RULES)).toBe(0);
    const third = estimateSetE1rm(set(100, 5, entered(2)), bench, { setOrder: 2 }, RULES).value!;
    expect(third.weight).toBeCloseTo(0.85 ** 2, 12);
  });

  it('adds the RIR bias from RIR 3 on', () => {
    expect(effectiveReps(5, 2, RULES)).toBe(7);
    expect(effectiveReps(5, 3, RULES)).toBe(8.5);
  });

  it('excludes warm-ups, skipped, timed, band and pure bodyweight sets, and r_eff > 15', () => {
    const reason = (input: E1rmSetInput, exercise = bench, bodyweightKg: number | null = null) =>
      estimateSetE1rm(input, exercise, { bodyweightKg }, RULES).why.args['reason'];
    expect(reason(set(60, 5, entered(2), 'warmup'))).toBe('warmup');
    expect(reason({ ...set(60, 5, entered(2)), state: 'skipped' })).toBe('skipped');
    expect(reason(set(60, 5, entered(2), 'timed'))).toBe('timedSet');
    expect(reason(set(60, 5, entered(2)), { ...bench, type: 'band' })).toBe('loadType');
    expect(reason(set(0, 20, entered(2)), { ...bench, type: 'bodyweightAdded' })).toBe(
      'pureBodyweight',
    );
    const pullUp: E1rmExercise = {
      type: 'bodyweightAdded',
      curveClass: 'pooled',
      bodyweightLoaded: true,
    };
    expect(reason(set(10, 5, entered(2)), pullUp)).toBe('noBodyweight');
    expect(reason(set(60, 14, entered(2)))).toBe('tooManyReps');
    expect(reason({ ...set(60, 5, entered(2)), reps: null })).toBe('missingValues');
  });

  it('uses bodyweight + added load for bodyweight-loaded exercises (WKT-11)', () => {
    const pullUp: E1rmExercise = {
      type: 'bodyweightAdded',
      curveClass: 'pooled',
      bodyweightLoaded: true,
    };
    const estimate = estimateSetE1rm(set(20, 1, entered(0)), pullUp, { bodyweightKg: 80 }, RULES);
    expect(estimate.value?.e1rmKg).toBe(100);
    expect(estimate.why.facts).toContainEqual({
      kind: 'quantity',
      name: 'bodyweightKg',
      value: 80,
    });
  });
});

describe('E-1: sets logged without RIR/RPE', () => {
  it('use the default prior RIR 2 at half weight and never create e1RM PRs', () => {
    const known = estimateSetE1rm(set(100, 5, entered(2)), bench, {}, RULES);
    const unknown = estimateSetE1rm(set(100, 5, none), bench, {}, RULES);
    expect(unknown.value).toMatchObject({
      rir: 2,
      reff: 7,
      effortKnown: false,
      prEligible: false,
      weight: known.value!.weight * 0.5,
    });
    expect(unknown.value!.e1rmKg).toBe(known.value!.e1rmKg);
    expect(known.value!.prEligible).toBe(true);
    expect(unknown.why.rule).toBe('e1rm.set.unknownEffort');
    expect(unknown.why.params.map((p) => p.id)).toContain('load.unknownEffort.priorRirDefault');
  });

  it('carry about 4.5% extra log-scale noise (prior SD 1.5 reps)', () => {
    const unknown = estimateSetE1rm(set(100, 5, none), bench, {}, RULES).value!;
    expect(unknown.effortLogSd).toBeGreaterThan(0.04);
    expect(unknown.effortLogSd).toBeLessThan(0.05);
  });

  it('use the personal median entered RIR over 8 weeks at a similar rep count', () => {
    const history = [
      { localDate: day('2026-11-20'), reps: 5, rir: 1 },
      { localDate: day('2026-11-13'), reps: 6, rir: 3 },
      { localDate: day('2026-11-06'), reps: 8, rir: 2 },
      { localDate: day('2026-11-01'), reps: 12, rir: 4 }, // more than 3 reps away
      { localDate: day('2026-09-01'), reps: 5, rir: 0 }, // older than 8 weeks
    ];
    expect(personalPriorRir(history, { reps: 5, asOf: day('2026-11-24') }, RULES)).toBe(2);
    expect(personalPriorRir(history.slice(0, 2), { reps: 5, asOf: day('2026-11-24') }, RULES)).toBe(
      2,
    );
    expect(personalPriorRir([], { reps: 5, asOf: day('2026-11-24') }, RULES)).toBeNull();
    const withPrior = estimateSetE1rm(set(100, 5, none), bench, { priorRir: 1 }, RULES).value!;
    expect(withPrior.reff).toBe(6);
  });
});

describe('session e1RM', () => {
  it('is the candidate with the largest weight × e1RM', () => {
    const estimates = [
      // RPE 7 and r_eff 8.5: weight 0.5, although its e1RM is the highest.
      estimateSetE1rm(set(100, 5, entered(3)), bench, { setOrder: 0 }, RULES).value!,
      estimateSetE1rm(set(105, 5, entered(1)), bench, { setOrder: 1 }, RULES).value!,
      estimateSetE1rm(set(80, 10, entered(2)), bench, { setOrder: 2 }, RULES).value!,
    ];
    const best = sessionE1rm(estimates).value!;
    expect(best).toBe(estimates[1]);
    expect(sessionE1rm([]).value).toBeNull();
  });
});

describe('properties', () => {
  const curves = ['equation', 'legPressLike', 'pooled'] as const;

  it('e1RM is monotonic in load and in reps', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...curves),
        fc.double({ min: 10, max: 300, noNaN: true }),
        fc.double({ min: 0.5, max: 50, noNaN: true }),
        fc.integer({ min: 1, max: 9 }),
        fc.integer({ min: 0, max: 4 }),
        (curveClass, load, extraLoad, reps, rir) => {
          const exercise = { ...bench, curveClass };
          const e1rm = (l: number, r: number) =>
            estimateSetE1rm(set(l, r, entered(rir)), exercise, {}, RULES).value?.e1rmKg ?? 0;
          expect(e1rm(load + extraLoad, reps)).toBeGreaterThan(e1rm(load, reps));
          expect(e1rm(load, reps + 1)).toBeGreaterThanOrEqual(e1rm(load, reps));
        },
      ),
    );
  });

  it('load-for-target inverts the e1RM within the rounding step', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...curves),
        fc.double({ min: 60, max: 250, noNaN: true }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 4 }),
        (curveClass, e1rmKg, reps, rir) => {
          const exercise = { ...bench, curveClass };
          const halfKg: Implement = { kind: 'steps', unit: 'kg', start: 0, step: 0.5 };
          const target = loadForTarget(
            { e1rmKg, reps, rir, exercise },
            { implement: halfKg },
            RULES,
          ).value!;
          // Without rounding the round trip is exact.
          const raw = estimateSetE1rm(
            set(target.totalKg, reps, entered(rir)),
            exercise,
            {},
            RULES,
          ).value!;
          expect(raw.e1rmKg).toBeCloseTo(e1rmKg, 9);
          // With rounding (0.5 kg total steps) the load moves at most 0.25 kg (+ the 0.01 grid).
          expect(Math.abs(target.load.value - target.totalKg)).toBeLessThanOrEqual(0.26);
          const rounded = estimateSetE1rm(
            set(target.load.value, reps, entered(rir)),
            exercise,
            {},
            RULES,
          ).value!;
          expect(Math.abs(rounded.e1rmKg - e1rmKg)).toBeLessThanOrEqual(0.26 / target.pct);
        },
      ),
    );
  });
});
