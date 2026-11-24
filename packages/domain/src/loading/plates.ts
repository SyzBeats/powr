import type { PlateInventory } from './types';

/**
 * Plate math in integer hundredths of the plate set's unit (1.25 kg → 125), so sums are exact
 * (§8.1). A bounded knapsack over the denominations tells which sums are reachable; the breakdown
 * of a sum takes as many of the heaviest plates as still leave a reachable remainder, so it is
 * heaviest-first and never uses more plates than exist.
 */

export const toHundredths = (value: number): number => Math.round(value * 100);
export const fromHundredths = (value: number): number => value / 100;

interface Denomination {
  readonly weight: number;
  readonly count: number;
}

export interface PlateSolver {
  /** Every reachable sum, ascending, in hundredths. */
  readonly sums: readonly number[];
  /** The plates that make up a reachable sum, heaviest first, in hundredths. */
  breakdown(sum: number): readonly number[];
}

/**
 * Builds the solver for one side of a bar (`perPlate: 'pair'`, one plate of each pair) or for
 * loose plates (`perPlate: 'single'`, every plate).
 */
export function plateSolver(inventory: PlateInventory, perPlate: 'pair' | 'single'): PlateSolver {
  const cache = perPlate === 'pair' ? pairSolvers : singleSolvers;
  const cached = cache.get(inventory);
  if (cached) return cached;
  const solver = buildSolver(denominations(inventory, perPlate === 'pair' ? 1 : 2));
  cache.set(inventory, solver);
  return solver;
}

// Pure memoisation: an inventory object always yields the same solver.
const pairSolvers = new WeakMap<PlateInventory, PlateSolver>();
const singleSolvers = new WeakMap<PlateInventory, PlateSolver>();

function denominations(inventory: PlateInventory, countPerPair: number): Denomination[] {
  const byWeight = new Map<number, number>();
  for (const { weight, pairs } of inventory.plates) {
    const w = toHundredths(weight);
    const count = Math.floor(pairs) * countPerPair;
    if (w > 0 && count > 0) byWeight.set(w, (byWeight.get(w) ?? 0) + count);
  }
  return [...byWeight]
    .map(([weight, count]) => ({ weight, count }))
    .toSorted((a, b) => b.weight - a.weight);
}

function buildSolver(denoms: readonly Denomination[]): PlateSolver {
  const total = denoms.reduce((sum, d) => sum + d.weight * d.count, 0);
  // reach[i][s] = 1 if sum s can be made from denominations i … end.
  const reach: Uint8Array[] = Array.from({ length: denoms.length + 1 });
  const last = new Uint8Array(total + 1);
  last[0] = 1;
  reach[denoms.length] = last;
  for (let i = denoms.length - 1; i >= 0; i--) {
    const { weight, count } = denoms[i]!;
    const next = reach[i + 1]!;
    const current = next.slice();
    for (let s = 0; s <= total; s++) {
      if (next[s] !== 1) continue;
      for (let k = 1; k <= count && s + k * weight <= total; k++) current[s + k * weight] = 1;
    }
    reach[i] = current;
  }

  const all = reach[0]!;
  const sums: number[] = [];
  for (let s = 0; s <= total; s++) if (all[s] === 1) sums.push(s);

  return {
    sums,
    breakdown(sum) {
      if (all[sum] !== 1) throw new RangeError(`${sum} is not a reachable plate sum`);
      const plates: number[] = [];
      let rest = sum;
      denoms.forEach(({ weight, count }, i) => {
        const after = reach[i + 1]!;
        let take = Math.min(count, Math.floor(rest / weight));
        while (take > 0 && after[rest - take * weight] !== 1) take--;
        for (let k = 0; k < take; k++) plates.push(weight);
        rest -= take * weight;
      });
      return plates;
    },
  };
}
