import { explained, type Explained } from '../explain';
import { roundToAchievable, roundingExplanation } from '../loading';
import type { LoadSuggestion, SuggestionEquipment } from './types';

/** Fixed-percentage prescription (PLN-07 "percent"): pct × e1RM or training max, rounded. */
export function percentLoad(
  input: { readonly baseKg: number; readonly pct: number; readonly reps: number },
  equipment: SuggestionEquipment,
): Explained<LoadSuggestion> {
  const rounding = roundToAchievable(
    { value: (input.baseKg * input.pct) / 100, unit: 'kg' },
    equipment.implement,
    equipment.mode ?? 'nearestTiesDown',
  );
  const load = { value: rounding.chosen?.load ?? rounding.target, unit: rounding.unit };
  return explained<LoadSuggestion>(
    { action: 'prescribe', load, reps: input.reps, rounding },
    'progression.percent.load',
    {
      args: { pct: input.pct, base: { mass: { value: input.baseKg, unit: 'kg' } } },
      children: [roundingExplanation(rounding)],
    },
  );
}
