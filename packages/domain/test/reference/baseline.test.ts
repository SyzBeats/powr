/**
 * ONB-08 baselines reference suite: the starting e1RM of a known 1RM or a recent set comes from
 * the logged-set pipeline (EB §Load › e1RM algorithm; technical concept §8.7.4, §8.7.7 E-1), and
 * a known 1RM older than about 3 months gets the "refined automatically" hint (PRD ONB-08).
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Baseline, ExerciseId, LocalDate } from '../../src';
import {
  baselineE1rm,
  calibrationFallback,
  estimateSetE1rm,
  loadForTarget,
  type E1rmExercise,
} from '../../src/e1rm';
import { rules } from '../fixtures/rules';

const RULES = rules();
const RTS_RULES = rules({ 'load.e1rm.equation': 'rts' });
const squat: E1rmExercise = { type: 'barbell', curveClass: 'equation', bodyweightLoaded: false };
const TODAY = '2026-11-24' as LocalDate;

const oneRepMax = (kg: number, date?: string): Baseline => ({
  exerciseId: 'ex.barbell-back-squat' as ExerciseId,
  kind: 'oneRepMax',
  load: { value: kg, unit: 'kg' },
  reps: 1,
  rir: 0,
  ...(date ? { date: date as LocalDate } : {}),
});
const recentSet = (kg: number, reps: number, rir: number | null): Baseline => ({
  exerciseId: 'ex.barbell-back-squat' as ExerciseId,
  kind: 'recentSet',
  load: { value: kg, unit: 'kg' },
  reps,
  rir,
});

describe('baseline e1RM (ONB-08)', () => {
  it('takes a known 1RM as it is: a single at RIR 0 has effective reps 1', () => {
    const result = baselineE1rm(oneRepMax(140), squat, TODAY, RULES);
    expect(result.value).toMatchObject({ e1rmKg: 140, reff: 1, pct: 1, weight: 1, old: false });
    expect(result.why).toMatchObject({
      rule: 'e1rm.baseline',
      args: { kind: 'oneRepMax', old: false, ageDays: null },
    });
    // In pounds the engine works in kg: 315 lb = 142.88 kg.
    const pounds = baselineE1rm(
      { ...oneRepMax(0), load: { value: 315, unit: 'lb' } },
      squat,
      TODAY,
      RULES,
    );
    expect(pounds.value?.e1rmKg).toBeCloseTo(142.88, 2);
  });

  it('estimates a recent set like a logged set: 100 kg × 4 at RIR 2 → r_eff 6 → Wathan 83.1%', () => {
    // EB worked example: 4 @ RPE 8 → r_eff 6 → 83.1% (Wathan) / 83.7% (RTS).
    const wathan = baselineE1rm(recentSet(100, 4, 2), squat, TODAY, RULES).value!;
    expect(wathan.reff).toBe(6);
    expect(wathan.pct).toBeCloseTo(0.831, 3);
    expect(wathan.e1rmKg).toBeCloseTo(120.33, 2);
    expect(baselineE1rm(recentSet(100, 4, 2), squat, TODAY, RTS_RULES).value!.pct).toBeCloseTo(
      0.837,
      3,
    );
    // The same numbers as the logged-set estimate: no formula of its own.
    const logged = estimateSetE1rm(
      {
        type: 'working',
        load: { value: 100, unit: 'kg' },
        reps: 4,
        effort: { rir: 2, source: 'entered' },
      },
      squat,
      {},
      RULES,
    ).value!;
    expect(wathan).toEqual({ ...logged, old: false });
  });

  it('round-trips PRG-05: the e1RM of 120.9 kg × 5 at RPE 8 prescribes 120.9 kg for 5 at RPE 8', () => {
    // PRD PRG-05 example: e1RM 150 kg, 5 @ RPE 8 → r_eff 7 → Wathan 80.6% → 120.9 kg.
    const start = baselineE1rm(recentSet(120.9, 5, 2), squat, TODAY, RULES).value!;
    expect(start.e1rmKg).toBeCloseTo(150, 0);
    const target = loadForTarget(
      { e1rmKg: start.e1rmKg, reps: 5, rir: 2, exercise: squat },
      {},
      RULES,
    );
    expect(target.value?.totalKg).toBeCloseTo(120.9, 1);
  });

  it('uses the unknown-effort prior when the RIR is not known, at a lower weight (E-1)', () => {
    const known = baselineE1rm(recentSet(100, 5, 2), squat, TODAY, RULES).value!;
    const unknown = baselineE1rm(recentSet(100, 5, null), squat, TODAY, RULES).value!;
    // The registry's prior RIR is 2: the same estimate, half the weight, wider noise.
    expect(unknown).toMatchObject({ e1rmKg: known.e1rmKg, rir: 2, effortKnown: false });
    expect(unknown.weight).toBe(known.weight * 0.5);
    expect(unknown.effortLogSd).toBeGreaterThan(0);
    expect(baselineE1rm(recentSet(100, 5, null), squat, TODAY, RULES).why.children[0]?.rule).toBe(
      'e1rm.set.unknownEffort',
    );
  });

  it('refuses a set the estimate does not cover and says why', () => {
    // 20 reps at RIR 0: effective reps above 15, too far from a max to estimate (EB).
    const result = baselineE1rm(recentSet(60, 20, 0), squat, TODAY, RULES);
    expect(result.value).toBeNull();
    expect(result.why).toMatchObject({
      rule: 'e1rm.set.excluded',
      args: { reason: 'tooManyReps' },
    });
    const band = baselineE1rm(
      recentSet(20, 5, 2),
      { type: 'band', curveClass: 'equation', bodyweightLoaded: false },
      TODAY,
      RULES,
    );
    expect(band.why.args['reason']).toBe('loadType');
  });

  it('flags a known 1RM older than 90 days (PRD ONB-08: older than 3 months)', () => {
    const old = baselineE1rm(oneRepMax(140, '2026-08-25'), squat, TODAY, RULES);
    expect(old.value).toMatchObject({ e1rmKg: 140, old: true });
    expect(old.why.args).toMatchObject({ old: true, ageDays: 91 });
    expect(old.why.params.map((param) => param.id)).toEqual(['load.baseline.refineAfterDays']);
    expect(baselineE1rm(oneRepMax(140, '2026-08-26'), squat, TODAY, RULES).value?.old).toBe(false);
    // A recent set is recent by definition: no date, no hint.
    expect(baselineE1rm(recentSet(100, 5, 2), squat, TODAY, RULES).value?.old).toBe(false);
  });

  it('a heavier set or fewer reps in reserve never gives a lower e1RM', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 300, noNaN: true }),
        // Up to 12 effective reps with the extra rep, inside the estimate's range.
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 3 }),
        (kg, reps, rir) => {
          const base = baselineE1rm(recentSet(kg, reps, rir), squat, TODAY, RULES).value!;
          const heavier = baselineE1rm(recentSet(kg + 5, reps, rir), squat, TODAY, RULES).value!;
          const moreReps = baselineE1rm(recentSet(kg, reps + 1, rir), squat, TODAY, RULES).value!;
          expect(heavier.e1rmKg).toBeGreaterThan(base.e1rmKg);
          expect(moreReps.e1rmKg).toBeGreaterThan(base.e1rmKg);
          // A max is never below the load lifted.
          expect(base.e1rmKg).toBeGreaterThanOrEqual(kg);
        },
      ),
    );
  });
});

describe('calibration fallback (ONB-08 skipped, PRG-08)', () => {
  it('names the conservative effort target of the first exposures', () => {
    expect(calibrationFallback(RULES)).toMatchObject({
      rule: 'e1rm.baseline.none',
      args: { exposuresMin: 1, exposuresMax: 2, rirMin: 3, rirMax: 4 },
    });
    expect(calibrationFallback(RULES).params.map((param) => param.id)).toEqual([
      'progression.calibration',
    ]);
  });
});
