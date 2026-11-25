/**
 * Calibration of the e1RM trend's change labels (PRD PRG-02; rules 1.6.0 and 1.7.0, technical
 * concept §8.7.5): a seeded simulation through the real observation, filter and label functions
 * (fixtures/trend-sim.ts). Per level and set kind it reports how soon a sustained, realistic gain
 * reads "likely real" and how often pure noise is labelled a change within 12 and 26 weeks, and
 * asserts bounds for both. The summary snapshot is the reviewed table: a registry change that
 * moves these numbers shows up here (like the plan matrix, §8.6.5 check 5).
 *
 * Realistic weekly gains (EB §Progression › Realistic strength progress; Swinton 2022,
 * Androulakis-Korakakis 2020, Ahtiainen 2003, Solberg 2019): novices 1–2% (up to 3% early),
 * trained lifters 0.2–1% in 8–12-week blocks, advanced lifters 0.02–0.1% long-run and about
 * 0.25–0.5% in a good block. Noise: the session e1RM jitters around the truth by the level's
 * typical error (3.3% trained, 5.5% novice; the product owner's definition of "noise alone"), and
 * in a stress case by the full noise the filter assumes (9% typical sets, 4% heavy sets).
 */
import { describe, expect, it } from 'vitest';

import type { TraineeLevel } from '../../src/rules';
import { rules } from '../fixtures/rules';
import {
  detection,
  falsePositives,
  type Detection,
  type FalsePositives,
  type SetKind,
} from '../fixtures/trend-sim';

const RULES = rules();
const RUNS = 300;
const PER_WEEK = 2;
const LEVELS: readonly TraineeLevel[] = ['novice', 'intermediate', 'advanced'];
const KINDS: readonly SetKind[] = ['typical', 'heavy'];
const GAINS: Readonly<Record<TraineeLevel, readonly number[]>> = {
  novice: [0.01, 0.02, 0.03],
  intermediate: [0.005, 0.01, 0.03],
  advanced: [0.0025, 0.005],
};

interface Row {
  readonly level: TraineeLevel;
  readonly kind: SetKind;
  readonly noise: FalsePositives;
  readonly stress: FalsePositives;
  readonly gains: readonly { readonly gain: number; readonly result: Detection }[];
}

const rows: Row[] = LEVELS.flatMap((level) =>
  KINDS.map((kind) => {
    const base = { level, kind, sessionsPerWeek: PER_WEEK };
    return {
      level,
      kind,
      noise: falsePositives({ ...base, jitter: 'te' }, RULES, RUNS),
      stress: falsePositives({ ...base, jitter: 'filter' }, RULES, RUNS),
      gains: GAINS[level].map((gain) => ({
        gain,
        result: detection({ ...base, gainPerWeek: gain, jitter: 'te' }, RULES, RUNS),
      })),
    };
  }),
);

const row = (level: TraineeLevel, kind: SetKind) =>
  rows.find((entry) => entry.level === level && entry.kind === kind)!;
const at = (level: TraineeLevel, kind: SetKind, gain: number) =>
  row(level, kind).gains.find((entry) => entry.gain === gain)!.result;

const weeks = (value: number) => (Number.isFinite(value) ? value.toFixed(1) : '–');
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

describe('e1RM trend calibration (PRG-02, rules 1.7.0; 2 sessions a week, 300 seeded runs)', () => {
  it('matches the reviewed summary', () => {
    const lines = rows.map((entry) =>
      [
        `${entry.level} ${entry.kind}`,
        `noise ${pct(entry.noise.within12)}/${pct(entry.noise.within26)}`,
        `stress ${pct(entry.stress.within12)}/${pct(entry.stress.within26)}`,
        ...entry.gains.map(
          ({ gain, result }) =>
            `+${(gain * 100).toFixed(2)}%/wk: median ${weeks(result.medianWeeks)} wk, noise-free ${weeks(result.noiseFreeWeeks)}, ≤12 ${pct(result.by12)}, ≤26 ${pct(result.by26)}`,
        ),
      ].join(' | '),
    );
    expect(lines.join('\n')).toMatchSnapshot();
  });

  it('rarely labels noise alone a change (jitter at the typical error)', () => {
    for (const level of LEVELS) {
      // Typical sets (r_eff 6–8 at RPE 8): the filter assumes 9%, so TE-sized jitter is well smoothed.
      expect(row(level, 'typical').noise.within12).toBeLessThanOrEqual(0.02);
      expect(row(level, 'typical').noise.within26).toBeLessThanOrEqual(0.02);
    }
    // Heavy sets follow the data closely (4% noise): one TE is a tighter test.
    for (const level of ['intermediate', 'advanced'] as const) {
      expect(row(level, 'heavy').noise.within12).toBeLessThanOrEqual(0.05);
      expect(row(level, 'heavy').noise.within26).toBeLessThanOrEqual(0.08);
    }
    // Novice heavy sets: rules 1.6.0 modelled them at 4% after the 8-week widening, less than a
    // novice's own typical error (5.5%), and claimed a change in 11.3% / 63.7% of flat series.
    // TD-59 (M5) floors the observation noise at the level's TE: 5.7% / 14.7%.
    expect(row('novice', 'heavy').noise.within12).toBeLessThanOrEqual(0.08);
    expect(row('novice', 'heavy').noise.within26).toBeLessThanOrEqual(0.18);
  });

  it('keeps false claims bounded when the jitter is as large as the filter assumes (stress)', () => {
    // Rules 1.5.0 claimed a change in 82–87% of flat 12-week series of typical sets here, likelyZ
    // 1 in 30–33%; likelyZ 1.5 (the product owner's choice of 2026-11-25) in 6–9%.
    for (const level of LEVELS) {
      expect(row(level, 'typical').stress.within12).toBeLessThanOrEqual(0.12);
      expect(row(level, 'typical').stress.within26).toBeLessThanOrEqual(0.2);
    }
    // Heavy sets: 7.3–11% within 12 weeks and 15–21% within 26 (rules 1.7.0: the TE floor
    // lowered novice heavy sets, the 12-week window raised advanced lifters' 26-week rates).
    for (const level of LEVELS) {
      expect(row(level, 'heavy').stress.within12).toBeLessThanOrEqual(0.15);
      expect(row(level, 'heavy').stress.within26).toBeLessThanOrEqual(0.25);
    }
  });

  it('labels a sustained, realistic gain for the level within a reasonable number of weeks', () => {
    // likelyZ 1.5 (strict, honesty first) labels later than likelyZ 1: the bounds below are just
    // above the medians it gives.
    // Novices at +2% a week: typical sets (9% noise, 13.5% in the first 8 weeks) within 13 weeks,
    // heavy sets within 7; at +3% a week within 10 and 6.
    expect(at('novice', 'typical', 0.02).medianWeeks).toBeLessThanOrEqual(13);
    expect(at('novice', 'heavy', 0.02).medianWeeks).toBeLessThanOrEqual(7);
    expect(at('novice', 'typical', 0.03).medianWeeks).toBeLessThanOrEqual(10);
    expect(at('novice', 'heavy', 0.03).medianWeeks).toBeLessThanOrEqual(6);
    // Intermediates at +1% a week within 16 (typical) and 9 (heavy) weeks. At +0.5% a week,
    // which the 4-week window of rules 1.5.0 could never show, heavy sets within 12 weeks and
    // always within 26. Typical sets (9% noise) no longer get there, even without noise: at two
    // sessions a week 1.5 SD of the change is about 5.3%, more than the 8-week gain of 4%. That
    // is the accepted cost of likelyZ 1.5; the snapshot records it.
    expect(at('intermediate', 'typical', 0.01).medianWeeks).toBeLessThanOrEqual(16);
    expect(at('intermediate', 'heavy', 0.01).medianWeeks).toBeLessThanOrEqual(9);
    expect(at('intermediate', 'heavy', 0.005).medianWeeks).toBeLessThanOrEqual(12);
    expect(at('intermediate', 'heavy', 0.005).by26).toBe(1);
    // Advanced lifters in a good block (+0.5% a week) on heavy sets within 14 weeks. Their
    // long-run rates (≤ 0.1% a week) stay within one TE for months: no claim is the honest label.
    expect(at('advanced', 'heavy', 0.005).medianWeeks).toBeLessThanOrEqual(14);
    expect(at('advanced', 'heavy', 0.005).by26).toBe(1);
    // Rules 1.7.0 (TD-60): the 12-week window lets +0.25% a week on heavy sets show within about
    // 20 weeks (8 weeks: 44% of runs by week 26, no median) and +0.5% a week on typical sets
    // within 26 weeks in most runs (8 weeks: 5%).
    expect(at('advanced', 'heavy', 0.0025).medianWeeks).toBeLessThanOrEqual(21);
    expect(at('advanced', 'heavy', 0.0025).by26).toBeGreaterThanOrEqual(0.7);
    expect(at('advanced', 'typical', 0.005).by26).toBeGreaterThanOrEqual(0.6);
  });

  it('labels faster gains no later than slower ones', () => {
    for (const entry of rows) {
      const medians = entry.gains.map(({ result }) => result.medianWeeks);
      for (let i = 1; i < medians.length; i++) {
        expect(medians[i]!).toBeLessThanOrEqual(medians[i - 1]!);
      }
    }
  });
});
