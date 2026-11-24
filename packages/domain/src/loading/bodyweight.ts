import type { LoadModel } from '../model';
import { fromKg, toKg, type Mass, type RoundingMode } from '../units';
import { implementUnit, roundToAchievable } from './round';
import type { Implement, Rounding } from './types';

/**
 * Bodyweight-loaded exercises (WKT-11, §8.1): the effective load is the bodyweight trend value
 * at the set's date plus the external load. Added load is positive; assistance is stored as a
 * negative load, so an assisted pull-up with 25 kg assistance at 80 kg is 55 kg.
 */
export type BodyweightLoadModel = Pick<LoadModel, 'type' | 'bodyweightLoaded'>;

/**
 * The load an e1RM is computed from, in kg; null when it cannot be known (no load entered, or
 * a bodyweight-loaded exercise without a bodyweight).
 */
export function effectiveLoadKg(
  external: Mass | null,
  model: BodyweightLoadModel,
  bodyweightKg: number | null,
): number | null {
  if (model.bodyweightLoaded) {
    if (bodyweightKg === null) return null;
    return bodyweightKg + (external ? toKg(external) : 0);
  }
  return external ? toKg(external) : null;
}

/** Implements for the external part of a bodyweight-loaded target. */
export interface BodyweightImplements {
  /** Belt plates, dumbbells…: rounds added load. */
  readonly added?: Implement;
  /** Assisted machine or band stack: rounds assistance (a positive amount). */
  readonly assistance?: Implement;
}

export interface ExternalLoad {
  /** Signed: positive added load, negative assistance (WKT-11). */
  readonly load: Mass;
  /** Rounding of the added load or of the assistance amount; null without an implement. */
  readonly rounding: Rounding | null;
}

/**
 * Splits a total target into bodyweight and external load, then rounds the external part. More
 * assistance means a lighter lift, so "down" for the lift rounds assistance up.
 */
export function externalLoadForTotal(
  totalKg: number,
  bodyweightKg: number,
  equipment: BodyweightImplements,
  mode: RoundingMode = 'nearestTiesDown',
): ExternalLoad {
  const externalKg = totalKg - bodyweightKg;
  const added = externalKg >= 0;
  const implement = added ? equipment.added : equipment.assistance;
  if (!implement) return { load: { value: externalKg, unit: 'kg' }, rounding: null };

  const unit = implementUnit(implement);
  const amount = { value: fromKg(Math.abs(externalKg), unit), unit };
  const rounding = roundToAchievable(amount, implement, added ? mode : invert(mode));
  const value = rounding.chosen?.load ?? amount.value;
  return { load: { value: added ? value : -value, unit }, rounding };
}

function invert(mode: RoundingMode): RoundingMode {
  if (mode === 'down') return 'up';
  if (mode === 'up') return 'down';
  return mode;
}
