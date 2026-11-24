import type { LocalDate } from '../ids';
import type { RuleSlice } from '../rules';
import { daysBetween } from '../time';

/**
 * Effort (EB §Load › RTS chart, › RIR accuracy): RPE = 10 − RIR, effective reps
 * r_eff = reps + RIR + bias, set weights by RPE and r_eff, and the personal prior RIR for sets
 * logged without effort (E-1).
 */

export const rirFromRpe = (rpe: number): number => 10 - rpe;
export const rpeFromRir = (rir: number): number => 10 - rir;

export type BiasRules = RuleSlice<'load.rirBias'>;

/** Registry RIR bias: lifters under-call RIR, more so far from failure (MVP: fixed tiers). */
export function rirBias(rir: number, rules: BiasRules): number {
  let add = 0;
  for (const tier of rules['load.rirBias'].value.toSorted((a, b) => a.minRir - b.minRir)) {
    if (rir >= tier.minRir) add = tier.add;
  }
  return add;
}

/** r_eff = reps + RIR + bias(RIR). */
export function effectiveReps(reps: number, rir: number, rules: BiasRules): number {
  return reps + rir + rirBias(rir, rules);
}

export type WeightRules = RuleSlice<'load.e1rm.weightByRpe' | 'load.e1rm.weightByReff'>;

/**
 * How much a set informs the e1RM (PRG-01): the lower of its RPE weight and its r_eff weight;
 * 0 beyond the last r_eff tier (excluded).
 */
export function setWeight(rpe: number, reff: number, rules: WeightRules): number {
  const byRpe = rules['load.e1rm.weightByRpe'].value
    .toSorted((a, b) => b.minRpe - a.minRpe)
    .find((tier) => rpe >= tier.minRpe);
  const byReff = rules['load.e1rm.weightByReff'].value
    .toSorted((a, b) => a.maxReff - b.maxReff)
    .find((tier) => reff <= tier.maxReff);
  return Math.min(byRpe?.weight ?? 0, byReff?.weight ?? 0);
}

export interface EffortHistoryEntry {
  readonly localDate: LocalDate;
  readonly reps: number;
  /** Entered RIR only; sets without effort never feed the prior. */
  readonly rir: number;
}

/**
 * E-1: the user's median entered RIR for the exercise over the last weeks at a similar rep count,
 * or null when no such sets exist (the registry default applies then).
 */
export function personalPriorRir(
  history: readonly EffortHistoryEntry[],
  at: { readonly reps: number; readonly asOf: LocalDate },
  rules: RuleSlice<'load.unknownEffort.personalPrior'>,
): number | null {
  const { windowWeeks, repTolerance } = rules['load.unknownEffort.personalPrior'].value;
  const rirs = history
    .filter((entry) => {
      const age = daysBetween(entry.localDate, at.asOf);
      return age >= 0 && age <= windowWeeks * 7 && Math.abs(entry.reps - at.reps) <= repTolerance;
    })
    .map((entry) => entry.rir)
    .toSorted((a, b) => a - b);
  if (rirs.length === 0) return null;
  const mid = Math.floor(rirs.length / 2);
  const upper = rirs[mid] ?? 0;
  return rirs.length % 2 === 1 ? upper : ((rirs[mid - 1] ?? upper) + upper) / 2;
}
