import { explained, quantity, type Explained } from '../explain';
import { roundToAchievable, roundingExplanation, implementUnit } from '../loading';
import type { RuleSlice } from '../rules';
import { convertMass, fromKg, type Mass } from '../units';
import type { LoadSuggestion, SuggestionEquipment } from './types';

type ApreRules = RuleSlice<'progression.apre.sixRm'>;

export interface ApreSet {
  readonly load: Mass;
  /** null: as many reps as possible. */
  readonly reps: number | null;
}

/**
 * The APRE-6 session (EB §Progression › APRE, preset): 10 reps at 50% and 6 at 75% of the 6RM,
 * then an AMRAP at the 6RM; set 4 is an AMRAP at the load `suggestApre` returns.
 */
export function apreSession(
  sixRm: Mass,
  equipment: SuggestionEquipment,
  rules: ApreRules,
): Explained<readonly ApreSet[]> {
  const mode = equipment.mode ?? 'nearestTiesDown';
  const ramp = rules['progression.apre.sixRm'].value.ramp.map((step) => {
    const rounding = roundToAchievable(
      { value: (sixRm.value * step.pct) / 100, unit: sixRm.unit },
      equipment.implement,
      mode,
    );
    const load = { value: rounding.chosen?.load ?? rounding.target, unit: rounding.unit };
    return { load, reps: step.reps };
  });
  const sets = [...ramp, { load: sixRm, reps: null }];
  return explained<readonly ApreSet[]>(sets, 'progression.apre.session', {
    args: { sixRm: { mass: sixRm } },
    params: [rules['progression.apre.sixRm']],
  });
}

/** Next 6RM (and set-4 load) from the reps of the set-3 AMRAP. */
export function suggestApre(
  input: { readonly sixRm: Mass; readonly amrapReps: number },
  equipment: SuggestionEquipment,
  rules: ApreRules,
): Explained<LoadSuggestion> {
  const preset = rules['progression.apre.sixRm'].value;
  const row = preset.adjustments.find(
    (candidate) =>
      input.amrapReps >= candidate.minReps &&
      (candidate.maxReps === null || input.amrapReps <= candidate.maxReps),
  );
  const adjustKg = row?.adjustKg ?? 0;
  const unit = implementUnit(equipment.implement);
  const target = convertMass(input.sixRm, unit) + fromKg(adjustKg, unit);
  const rounding = roundToAchievable(
    { value: target, unit },
    equipment.implement,
    equipment.mode ?? 'nearestTiesDown',
  );
  const load = { value: rounding.chosen?.load ?? target, unit };
  const current = convertMass(input.sixRm, unit);
  const action = load.value > current ? 'increase' : load.value < current ? 'decrease' : 'hold';
  return explained<LoadSuggestion>({ action, load, reps: 6, rounding }, 'progression.apre.adjust', {
    args: { amrapReps: input.amrapReps, adjustKg, from: { mass: input.sixRm }, to: { mass: load } },
    facts: [quantity('amrapReps', input.amrapReps)],
    params: [rules['progression.apre.sixRm']],
    children: [roundingExplanation(rounding)],
  });
}
