import { convertMass, type Mass, type MassUnit } from './mass';

/** Rounding direction for loads (SET-05, WKT-07); the default is nearest with ties down. */
export const ROUNDING_MODES = ['nearestTiesDown', 'down', 'up'] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

// Tolerance for float noise when a value sits on a step boundary (e.g. 0.1 + 0.2).
const EPSILON = 1e-9;

/** Rounds `value` onto the grid origin + k·step (k an integer). */
export function roundToStep(
  value: number,
  step: number,
  mode: RoundingMode = 'nearestTiesDown',
  origin = 0,
): number {
  if (!(step > 0)) throw new RangeError(`step must be positive, got ${step}`);
  const q = (value - origin) / step;
  const lower = Math.floor(q + EPSILON);
  let k: number;
  if (mode === 'down') k = lower;
  else if (mode === 'up') k = Math.ceil(q - EPSILON);
  else k = q - lower > 0.5 + EPSILON ? lower + 1 : lower;
  return cleanFloat(origin + k * step);
}

/** A mass for display only: converted to `unit` and rounded to `step` (default 0.1, §8.1). */
export function displayMass(mass: Mass, unit: MassUnit, step = 0.1): number {
  return cleanFloat(Math.round(convertMass(mass, unit) / step) * step);
}

/** Removes binary noise such as 0.30000000000000004 (keeps 9 decimals). */
export function cleanFloat(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}
