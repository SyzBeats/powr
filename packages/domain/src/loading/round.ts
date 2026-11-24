import { explain, type Explanation } from '../explain';
import { convertMass, type Mass, type MassUnit, type RoundingMode } from '../units';
import { fromHundredths, plateSolver, toHundredths } from './plates';
import type { BarSpec, Implement, LoadOption, PlateInventory, Rounding } from './types';

/** The unit loads on this implement are expressed in (the plates' unit for barbells). */
export function implementUnit(implement: Implement): MassUnit {
  return implement.kind === 'barbell' || implement.kind === 'loosePlates'
    ? implement.plates.unit
    : implement.unit;
}

/**
 * The achievable-load service (§8.1, WKT-07): every load the engine suggests goes through it.
 * Rounds `target` to what `implement` allows, in the implement's unit (kg plates give kg loads).
 */
export function roundToAchievable(
  target: Mass,
  implement: Implement,
  mode: RoundingMode = 'nearestTiesDown',
): Rounding {
  const unit = implementUnit(implement);
  const value = convertMass(target, unit);
  return pick(candidates(implement, toHundredths(value)), toHundredths(value), mode, {
    unit,
    target: value,
    mixedUnits: implement.kind === 'barbell' && implement.bar.unit !== implement.plates.unit,
  });
}

/** The smallest achievable load strictly above `current` (the "smallest increment", PRG-04/07). */
export function nextLoadAbove(current: Mass, implement: Implement): Rounding {
  const unit = implementUnit(implement);
  const value = convertMass(current, unit);
  const above = toHundredths(value) + 1;
  return pick(candidates(implement, above), above, 'up', {
    unit,
    target: value,
    mixedUnits: implement.kind === 'barbell' && implement.bar.unit !== implement.plates.unit,
  });
}

/** The heaviest load the implement allows; null for an open increment. */
export function maxLoad(implement: Implement): number | null {
  if (implement.kind === 'steps' && implement.max === undefined) return null;
  const loads = candidates(implement, 0).loads;
  const last = loads.at(-1);
  return last === undefined ? null : fromHundredths(last);
}

/** Reverse mode of the plate calculator (WKT-07): the total of a loaded bar, in the plates' unit. */
export function barbellTotal(
  bar: BarSpec,
  plates: PlateInventory,
  perSide: readonly number[],
  collarWeight = 0,
): number {
  const base = barBase(bar, plates.unit, collarWeight);
  return fromHundredths(base + 2 * perSide.reduce((sum, w) => sum + toHundredths(w), 0));
}

/** The rounding step as part of an explanation ("61 kg not loadable: 60 kg or 62.5 kg"). */
export function roundingExplanation(rounding: Rounding): Explanation {
  const mass = (option: LoadOption | null) =>
    option ? { mass: { value: option.load, unit: rounding.unit } } : null;
  return explain('loading.round', {
    args: {
      target: { mass: { value: rounding.target, unit: rounding.unit } },
      chosen: mass(rounding.chosen),
      below: mass(rounding.below),
      above: mass(rounding.above),
      exact: rounding.exact,
      reason: rounding.reason,
      mixedUnits: rounding.mixedUnits,
    },
  });
}

interface Candidates {
  /** Achievable loads around (or including) the target, ascending, in hundredths. */
  readonly loads: readonly number[];
  readonly detail: (load: number) => Omit<LoadOption, 'load'>;
}

const noDetail = () => ({});

function candidates(implement: Implement, target: number): Candidates {
  if (implement.kind === 'barbell') {
    const solver = plateSolver(implement.plates, 'pair');
    const base = barBase(implement.bar, implement.plates.unit, implement.collarWeight ?? 0);
    return {
      loads: solver.sums.map((side) => base + 2 * side),
      detail: (load) => ({ perSide: solver.breakdown((load - base) / 2).map(fromHundredths) }),
    };
  }
  if (implement.kind === 'loosePlates') {
    const solver = plateSolver(implement.plates, 'single');
    return {
      loads: solver.sums,
      detail: (load) => ({ plates: solver.breakdown(load).map(fromHundredths) }),
    };
  }
  if (implement.kind === 'list') {
    return { loads: sortedUnique(implement.weights.map(toHundredths)), detail: noDetail };
  }
  return { loads: stepLoads(implement, target), detail: noDetail };
}

function barBase(bar: BarSpec, unit: MassUnit, collarWeight: number): number {
  return (
    toHundredths(convertMass({ value: bar.weight, unit: bar.unit }, unit)) +
    2 * toHundredths(collarWeight)
  );
}

function stepLoads(implement: Extract<Implement, { kind: 'steps' }>, target: number): number[] {
  const start = toHundredths(implement.start);
  const step = toHundredths(implement.step);
  if (step <= 0) return [start];
  const offsets = subsetSums((implement.addOns ?? []).map(toHundredths));
  let first = 0;
  let last: number;
  if (implement.max === undefined) {
    // Open increment: only the steps around the target matter.
    const maxOffset = offsets.at(-1) ?? 0;
    first = Math.max(0, Math.floor((target - start - maxOffset) / step) - 1);
    last = Math.max(0, Math.floor((target - start) / step) + 1);
  } else {
    last = Math.floor((toHundredths(implement.max) - start) / step);
  }
  const loads: number[] = [];
  for (let k = first; k <= last; k++)
    for (const offset of offsets) loads.push(start + k * step + offset);
  return sortedUnique(loads);
}

function subsetSums(values: readonly number[]): number[] {
  let sums = [0];
  for (const value of values) sums = [...sums, ...sums.map((sum) => sum + value)];
  return sortedUnique(sums);
}

function sortedUnique(values: readonly number[]): number[] {
  return [...new Set(values)].toSorted((a, b) => a - b);
}

function pick(
  { loads, detail }: Candidates,
  target: number,
  mode: RoundingMode,
  base: Pick<Rounding, 'unit' | 'target' | 'mixedUnits'>,
): Rounding {
  let belowLoad: number | undefined;
  let aboveLoad: number | undefined;
  for (const load of loads) {
    if (load <= target) belowLoad = load;
    if (load >= target) {
      aboveLoad = load;
      break;
    }
  }
  const option = (load: number | undefined): LoadOption | null =>
    load === undefined ? null : { load: fromHundredths(load), ...detail(load) };
  const below = option(belowLoad);
  const above = option(aboveLoad);

  if (belowLoad === target) {
    return { ...base, exact: true, chosen: below, below, above, reason: 'exact' };
  }
  if (belowLoad === undefined || aboveLoad === undefined) {
    const reason = below ? 'aboveMax' : above ? 'belowMin' : 'nothingLoadable';
    return { ...base, exact: false, chosen: below ?? above, below, above, reason };
  }
  const takeBelow =
    mode === 'down' || (mode === 'nearestTiesDown' && target - belowLoad <= aboveLoad - target);
  return {
    ...base,
    exact: false,
    chosen: takeBelow ? below : above,
    below,
    above,
    reason: 'notLoadable',
  };
}
