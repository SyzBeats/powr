/**
 * Rep-max equations and the RTS chart (EB §Load › Rep-max equations table, §Load › RTS chart;
 * technical concept §8.20). Tolerance ±0.1 percentage points, as the EB rounds to one decimal.
 */
import { describe, expect, it } from 'vitest';

import { equationPct, rtsPct, tablePct } from '../../src/e1rm';
import { EB_DEFAULTS } from '../fixtures/rules';

// EB table: reps → implied %1RM (Epley, Brzycki, Wathan).
const IMPLIED_PCT: readonly [reps: number, epley: number, brzycki: number, wathan: number][] = [
  [1, 96.8, 100.0, 98.7],
  [2, 93.8, 97.2, 95.1],
  [3, 90.9, 94.4, 91.8],
  [5, 85.7, 88.9, 85.8],
  [8, 78.9, 80.5, 78.3],
  [10, 75.0, 75.0, 74.2],
  [12, 71.4, 69.4, 70.7],
  [15, 66.7, 61.1, 66.3],
  [20, 60.0, 47.2, 60.8],
];

const pct = (value: number | null) => (value ?? Number.NaN) * 100;

describe('rep-max equations against the EB table', () => {
  it.each(IMPLIED_PCT.filter(([reps]) => reps > 1))('%i reps', (reps, epley, brzycki, wathan) => {
    expect(Math.abs(pct(equationPct('epley', reps)) - epley)).toBeLessThanOrEqual(0.1);
    // Brzycki at 8 reps is 80.56: the EB prints 80.5, within the ±0.1 tolerance.
    expect(Math.abs(pct(equationPct('brzycki', reps)) - brzycki)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(pct(equationPct('wathan', reps)) - wathan)).toBeLessThanOrEqual(0.1);
  });

  it('forces r_eff = 1 to 100%, where the raw formulas give the EB row 1 values', () => {
    for (const equation of ['epley', 'brzycki', 'wathan'] as const) {
      expect(equationPct(equation, 1)).toBe(1);
    }
    // Raw formulas just above one rep approach the EB's row-1 values.
    expect(pct(equationPct('epley', 1.0001))).toBeCloseTo(96.8, 1);
    expect(pct(equationPct('wathan', 1.0001))).toBeCloseTo(98.7, 1);
  });

  it('Brzycki is undefined from about 37 reps on; below one rep nothing is defined', () => {
    expect(equationPct('brzycki', 36)).toBeGreaterThan(0);
    expect(equationPct('brzycki', 37)).toBeNull();
    expect(equationPct('wathan', 0.5)).toBeNull();
    expect(rtsPct(EB_DEFAULTS['load.curve.rts'], 0)).toBeNull();
    expect(tablePct(EB_DEFAULTS['load.curve.nuzzoPooled'], 0.9)).toBeNull();
  });
});

describe('RTS chart (one-dimensional in effective reps)', () => {
  const rows = EB_DEFAULTS['load.curve.rts'];

  it('reproduces all 26 rows exactly', () => {
    expect(rows).toHaveLength(26);
    for (const row of rows) expect(pct(rtsPct(rows, row.reff))).toBeCloseTo(row.pct, 9);
  });

  it('tracks Wathan within about 0.6 points for 2–10 effective reps', () => {
    const diffs = rows
      .filter((row) => row.reff >= 2 && row.reff <= 10)
      .map((row) => Math.abs(row.pct - pct(equationPct('wathan', row.reff))));
    // The largest gap is 0.61 points at 4.5 reps ("≈0.6" in the EB).
    expect(Math.max(...diffs)).toBeLessThan(0.62);
  });

  it('diverges by 1.7–2.7 points at 11–12 effective reps', () => {
    for (const reff of [11, 11.5, 12]) {
      const gap = pct(equationPct('wathan', reff)) - pct(rtsPct(rows, reff));
      expect(gap).toBeGreaterThan(1.6);
      expect(gap).toBeLessThan(2.7);
    }
  });

  it('continues past the last row along Wathan, scaled to meet the chart', () => {
    const atEnd = rtsPct(rows, 13.5)!;
    expect(rtsPct(rows, 13.51)!).toBeLessThan(atEnd);
    expect(rtsPct(rows, 13.51)!).toBeCloseTo(atEnd, 3);
    expect(rtsPct(rows, 20)!).toBeLessThan(rtsPct(rows, 15)!);
  });
});

describe('Nuzzo 2024 curves, inverted', () => {
  it('reproduces the table points', () => {
    for (const table of ['load.curve.nuzzoPooled', 'load.curve.nuzzoLegPress'] as const) {
      for (const row of EB_DEFAULTS[table]) {
        expect(pct(tablePct(EB_DEFAULTS[table], row.reps))).toBeCloseTo(row.pct, 9);
      }
    }
  });

  it('pooled: about 5 reps at 90% and 15 at 70% (EB)', () => {
    const pooled = EB_DEFAULTS['load.curve.nuzzoPooled'];
    expect(pct(tablePct(pooled, 5))).toBeCloseTo(89.9, 1);
    expect(pct(tablePct(pooled, 15))).toBeCloseTo(69.6, 1);
  });

  it('standard formulas would inflate leg-press e1RM by about 15% at 10 reps (EB)', () => {
    const legPress = tablePct(EB_DEFAULTS['load.curve.nuzzoLegPress'], 10)!;
    const inflation = legPress / equationPct('wathan', 10)! - 1;
    expect(inflation).toBeGreaterThan(0.13);
    expect(inflation).toBeLessThan(0.18);
  });
});
