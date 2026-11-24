import { explained, type Explained, type Fact } from '../explain';
import { nextLoadAbove, roundingExplanation } from '../loading';
import type { RepRange } from '../model';
import type { RuleSlice } from '../rules';
import { toKg } from '../units';
import {
  workingSets,
  type LoadSuggestion,
  type PerformedSet,
  type SuggestionEquipment,
} from './types';

export interface DoubleProgressionInput {
  /** The sets of the last exposure; warm-ups and skipped sets are ignored. */
  readonly lastSets: readonly PerformedSet[];
  readonly repRange: RepRange;
  /** The lowest RIR that still meets the target (e.g. 2 for "@ RIR 2", 1 for "RIR 1–2"). */
  readonly targetRir: number;
}

/**
 * Double progression (PRG-04, EB §Progression › Progression rules): when every working set
 * reached the top of the range at or above the target RIR, add the smallest achievable increment
 * and go back to the bottom of the range; otherwise keep the load and aim one rep higher. A set
 * without effort meets the RIR target only by reaching the top of the range (E-1, [INF]).
 */
export function suggestDoubleProgression(
  input: DoubleProgressionInput,
  equipment: SuggestionEquipment,
  rules: RuleSlice<'progression.model.accessory'>,
): Explained<LoadSuggestion | null> {
  const sets = workingSets(input.lastSets);
  const [min, max] = input.repRange;
  const params = [rules['progression.model.accessory']];
  const facts: Fact[] = sets.map((set, index) => ({
    kind: 'set',
    index,
    load: set.load,
    reps: set.reps,
    rir: set.effort.source === 'entered' ? set.effort.rir : null,
    effortKnown: set.effort.source === 'entered' && set.effort.rir !== null,
  }));
  const heaviest = sets.reduce<PerformedSet | null>(
    (best, set) => (best?.load && set.load && toKg(set.load) <= toKg(best.load) ? best : set),
    null,
  );
  if (!heaviest?.load) {
    return explained(null, 'progression.double.noHistory', { params });
  }
  const current = heaviest.load;

  const topReached = sets.every((set) => {
    const reps = set.reps ?? 0;
    const rir = set.effort.source === 'entered' ? set.effort.rir : null;
    return reps >= max && (rir === null || rir >= input.targetRir);
  });

  if (topReached) {
    const rounding = nextLoadAbove(current, equipment.implement);
    const increased = rounding.above !== null;
    const load = increased
      ? { value: rounding.above?.load ?? current.value, unit: rounding.unit }
      : current;
    return explained<LoadSuggestion>(
      { action: increased ? 'increase' : 'hold', load, reps: increased ? min : max, rounding },
      'progression.double.topReached',
      {
        args: {
          from: { mass: current },
          to: { mass: load },
          reps: increased ? min : max,
          atMaxLoad: !increased,
          targetRir: input.targetRir,
        },
        facts,
        params,
        children: [roundingExplanation(rounding)],
      },
    );
  }

  const lowest = Math.min(...sets.map((set) => set.reps ?? 0));
  const reps = Math.min(max, Math.max(min, lowest + 1));
  return explained<LoadSuggestion>(
    { action: 'hold', load: current, reps, rounding: null },
    'progression.double.repsUp',
    {
      args: { load: { mass: current }, reps, top: max, targetRir: input.targetRir },
      facts,
      params,
    },
  );
}
