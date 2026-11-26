import type { CurveClass } from '../model';
import type { CurveSource, E1rmEquation, PctAtReffRow, RepsAtPctRow, RuleSlice } from '../rules';

/**
 * Reps-to-%1RM curves (EB §Load › Rep-max equations, › Reps at %1RM, › RTS chart). All return
 * the fraction of 1RM that a set of `reff` effective reps represents, with r_eff = 1 forced to
 * 1.0 (a single at RIR 0 is the 1RM), or null where a curve is undefined.
 */

export type CurveRules = RuleSlice<
  | 'load.e1rm.equation'
  | 'load.curve.classMap'
  | 'load.curve.nuzzoPooled'
  | 'load.curve.nuzzoBench'
  | 'load.curve.nuzzoLegPress'
  | 'load.curve.rts'
>;

/** Wathan 1994, Epley 1985 and Brzycki 1993 on effective reps. */
export function equationPct(equation: Exclude<E1rmEquation, 'rts'>, reff: number): number | null {
  if (!(reff >= 1)) return null;
  if (reff === 1) return 1;
  if (equation === 'wathan') return (48.8 + 53.8 * Math.exp(-0.075 * reff)) / 100;
  if (equation === 'epley') return 1 / (1 + reff / 30);
  // Brzycki: 1RM = w / (1.0278 − 0.0278·r), undefined from r ≈ 37 on.
  const pct = 1.0278 - 0.0278 * reff;
  return pct > 0 ? pct : null;
}

/**
 * The RPE chart (common RTS version: the commonly circulated decimal chart, not Tuchscherer's
 * own, which is 5–8 points lower at 5–11 effective reps; T-01), interpolated between its
 * half-rep rows. Beyond the last row it follows Wathan, scaled to meet the chart there, so the
 * curve stays continuous and decreasing.
 */
export function rtsPct(rows: readonly PctAtReffRow[], reff: number): number | null {
  if (!(reff >= 1)) return null;
  const points = rows
    .map((row) => ({ x: row.reff, y: row.pct / 100 }))
    .toSorted((a, b) => a.x - b.x);
  const last = points.at(-1);
  if (last === undefined) return equationPct('wathan', reff);
  if (reff > last.x) {
    const scale = last.y / (equationPct('wathan', last.x) ?? 1);
    return (equationPct('wathan', reff) ?? 0) * scale;
  }
  return interpolate(points, reff);
}

/**
 * Nuzzo 2024 means, inverted: the %1RM at which the mean lifter reaches failure after `reff` reps.
 * Anchored at (1 rep, 100%); flat beyond the table's last row.
 */
export function tablePct(rows: readonly RepsAtPctRow[], reff: number): number | null {
  if (!(reff >= 1)) return null;
  const points = [
    { x: 1, y: 1 },
    ...rows.map((row) => ({ x: row.reps, y: row.pct / 100 })).filter((p) => p.x > 1),
  ].toSorted((a, b) => a.x - b.x);
  return interpolate(points, reff);
}

/** The curve of an exercise class (E-3): the registry maps each class to a curve source. */
export function curvePct(curveClass: CurveClass, reff: number, rules: CurveRules): number | null {
  return sourcePct(rules['load.curve.classMap'].value[curveClass], reff, rules);
}

function sourcePct(source: CurveSource, reff: number, rules: CurveRules): number | null {
  if (source !== 'equation') {
    const table = {
      nuzzoPooled: 'load.curve.nuzzoPooled',
      nuzzoBench: 'load.curve.nuzzoBench',
      nuzzoLegPress: 'load.curve.nuzzoLegPress',
    } as const;
    return tablePct(rules[table[source]].value, reff);
  }
  const equation = rules['load.e1rm.equation'].value;
  return equation === 'rts'
    ? rtsPct(rules['load.curve.rts'].value, reff)
    : equationPct(equation, reff);
}

/** The registry parameters `curvePct` reads for a class, for explanations. */
export function curveParams(curveClass: CurveClass, rules: CurveRules) {
  const source = rules['load.curve.classMap'].value[curveClass];
  const table = {
    equation:
      rules['load.e1rm.equation'].value === 'rts'
        ? rules['load.curve.rts']
        : rules['load.e1rm.equation'],
    nuzzoPooled: rules['load.curve.nuzzoPooled'],
    nuzzoBench: rules['load.curve.nuzzoBench'],
    nuzzoLegPress: rules['load.curve.nuzzoLegPress'],
  }[source];
  return [rules['load.curve.classMap'], table];
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Piecewise-linear interpolation over points sorted by x; flat outside the range. */
function interpolate(points: readonly Point[], x: number): number | null {
  const first = points[0];
  if (first === undefined) return null;
  if (x <= first.x) return first.y;
  for (let i = 1; i < points.length; i++) {
    const right = points[i];
    const left = points[i - 1];
    if (right === undefined || left === undefined) break;
    if (x <= right.x) return left.y + ((x - left.x) / (right.x - left.x)) * (right.y - left.y);
  }
  return points.at(-1)?.y ?? null;
}
