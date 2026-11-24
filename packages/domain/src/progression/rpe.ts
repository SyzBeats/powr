import {
  estimateSetE1rm,
  loadForTarget,
  type E1rmExercise,
  type E1rmRules,
  type E1rmSetInput,
  type LoadTargetInput,
  type TargetEquipment,
  type TargetRules,
} from '../e1rm';
import { explained, quantity, type Explained } from '../explain';
import type { LoadSuggestion } from './types';

/**
 * RPE-based loading (PRG-05): load = current e1RM × pct(target reps + target RIR), rounded.
 * Default for main lifts from intermediate on (EB §Progression › Progression rules).
 */
export function suggestRpeLoad(
  input: LoadTargetInput,
  equipment: TargetEquipment,
  rules: TargetRules,
): Explained<LoadSuggestion | null> {
  const target = loadForTarget(input, equipment, rules);
  const value = target.value;
  return explained<LoadSuggestion | null>(
    value
      ? { action: 'prescribe', load: value.load, reps: input.reps, rounding: value.rounding }
      : null,
    'progression.rpe.load',
    {
      args: { reps: input.reps, rir: input.rir, load: value ? { mass: value.load } : null },
      children: [target.why],
    },
  );
}

export interface BackoffInput {
  /** The top set as performed, with entered effort. */
  readonly topSet: E1rmSetInput;
  readonly exercise: E1rmExercise;
  readonly backoff: { readonly reps: number; readonly rir: number };
  readonly bodyweightKg?: number | null;
}

/**
 * In-session autoregulation (PRG-05): today's e1RM from the top set sets the back-off load, so a
 * top set harder than planned lowers the back-offs by the %1RM the RPE gap implies (about
 * 2.3–3.3% per RPE point). Without an entered RIR on the top set the plan stays (null).
 */
export function suggestBackoff(
  input: BackoffInput,
  equipment: TargetEquipment,
  rules: E1rmRules & TargetRules,
): Explained<LoadSuggestion | null> {
  const today = estimateSetE1rm(
    input.topSet,
    input.exercise,
    { setOrder: 0, bodyweightKg: input.bodyweightKg ?? null },
    rules,
  );
  if (today.value === null || !today.value.effortKnown) {
    return explained(null, 'progression.rpe.backoff', {
      args: { reason: today.value === null ? 'noEstimate' : 'noEffort' },
      children: [today.why],
    });
  }
  const target = loadForTarget(
    {
      e1rmKg: today.value.e1rmKg,
      reps: input.backoff.reps,
      rir: input.backoff.rir,
      exercise: input.exercise,
      bodyweightKg: input.bodyweightKg ?? null,
    },
    equipment,
    rules,
  );
  const value = target.value;
  return explained<LoadSuggestion | null>(
    value
      ? {
          action: 'prescribe',
          load: value.load,
          reps: input.backoff.reps,
          rounding: value.rounding,
        }
      : null,
    'progression.rpe.backoff',
    {
      args: {
        todayE1rm: { mass: { value: today.value.e1rmKg, unit: 'kg' } },
        reps: input.backoff.reps,
        rir: input.backoff.rir,
      },
      facts: [quantity('topSetRir', today.value.rir)],
      children: [today.why, target.why],
    },
  );
}
