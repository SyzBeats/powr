/**
 * Plate calculator and achievable-load reference suite (PRD EQP-03, WKT-07; technical concept §8.1
 * and §8.20 "Plate calculator").
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  barbellTotal,
  effectiveLoadKg,
  externalLoadForTotal,
  maxLoad,
  nextLoadAbove,
  roundToAchievable,
  type Implement,
  type PlateInventory,
} from '../../src/loading';
import { roundingExplanation } from '../../src/loading';

const kg = (value: number) => ({ value, unit: 'kg' as const });
const lb = (value: number) => ({ value, unit: 'lb' as const });

// The EQP-03 example: one pair each of 20 / 10 / 5 / 2.5 / 1.25 kg on a 20 kg bar.
const homePlates: PlateInventory = {
  unit: 'kg',
  plates: [20, 10, 5, 2.5, 1.25].map((weight) => ({ weight, pairs: 1 })),
};
const homeBar: Implement = { kind: 'barbell', bar: { weight: 20, unit: 'kg' }, plates: homePlates };

describe('EQP-03 / WKT-07 examples', () => {
  it('loads at most 97.5 kg and never more plates than exist', () => {
    expect(maxLoad(homeBar)).toBe(97.5);
  });

  it('61 kg is not loadable: 60 kg (20 per side) or 62.5 kg (20 + 1.25 per side)', () => {
    const rounding = roundToAchievable(kg(61), homeBar);
    expect(rounding).toMatchObject({
      exact: false,
      reason: 'notLoadable',
      below: { load: 60, perSide: [20] },
      above: { load: 62.5, perSide: [20, 1.25] },
      chosen: { load: 60 },
    });
  });

  it('101 kg shows the maximum loadable weight with the reason', () => {
    const rounding = roundToAchievable(kg(101), homeBar);
    expect(rounding).toMatchObject({
      reason: 'aboveMax',
      chosen: { load: 97.5, perSide: [20, 10, 5, 2.5, 1.25] },
      above: null,
    });
    expect(roundingExplanation(rounding)).toMatchObject({
      rule: 'loading.round',
      message: 'why.loading.round',
      args: { reason: 'aboveMax', chosen: { mass: { value: 97.5, unit: 'kg' } } },
    });
  });

  it('loads heaviest plates first and reports exact loads', () => {
    expect(roundToAchievable(kg(77.5), homeBar)).toMatchObject({
      exact: true,
      chosen: { load: 77.5, perSide: [20, 5, 2.5, 1.25] },
    });
  });

  it('rounds below the bar up to the empty bar', () => {
    expect(roundToAchievable(kg(15), homeBar)).toMatchObject({
      reason: 'belowMin',
      chosen: { load: 20, perSide: [] },
    });
  });
});

describe('rounding modes (SET-05)', () => {
  it('nearest with ties down, down and up', () => {
    // 61.25 is exactly between 60 and 62.5.
    expect(roundToAchievable(kg(61.25), homeBar).chosen?.load).toBe(60);
    expect(roundToAchievable(kg(61.3), homeBar).chosen?.load).toBe(62.5);
    expect(roundToAchievable(kg(62.4), homeBar, 'down').chosen?.load).toBe(60);
    expect(roundToAchievable(kg(60.1), homeBar, 'up').chosen?.load).toBe(62.5);
  });
});

describe('microplates, lb inventories, mixed units and collars', () => {
  const withMicro: Implement = {
    kind: 'barbell',
    bar: { weight: 20, unit: 'kg' },
    plates: {
      unit: 'kg',
      plates: [
        { weight: 20, pairs: 4 },
        { weight: 10, pairs: 1 },
        { weight: 5, pairs: 1 },
        { weight: 2.5, pairs: 1 },
        { weight: 1.25, pairs: 1 },
        { weight: 0.5, pairs: 1 },
        { weight: 0.25, pairs: 1 },
      ],
    },
  };

  it('uses microplates for 0.5 kg total steps', () => {
    expect(roundToAchievable(kg(121), withMicro)).toMatchObject({
      exact: true,
      chosen: { load: 121, perSide: [20, 20, 10, 0.5] },
    });
    expect(roundToAchievable(kg(120.9), withMicro).chosen?.load).toBe(121);
    expect(nextLoadAbove(kg(121), withMicro).chosen?.load).toBe(121.5);
  });

  it('works in the plates’ own unit for lb inventories', () => {
    const lbBar: Implement = {
      kind: 'barbell',
      bar: { weight: 45, unit: 'lb' },
      plates: {
        unit: 'lb',
        plates: [
          { weight: 45, pairs: 4 },
          { weight: 25, pairs: 1 },
          { weight: 10, pairs: 2 },
          { weight: 5, pairs: 1 },
          { weight: 2.5, pairs: 1 },
        ],
      },
    };
    expect(roundToAchievable(lb(225), lbBar)).toMatchObject({
      exact: true,
      unit: 'lb',
      chosen: { load: 225, perSide: [45, 45] },
    });
    // A kg target is converted with the exact factor: 100 kg = 220.46 lb → 220 lb.
    expect(roundToAchievable(kg(100), lbBar).chosen?.load).toBe(220);
  });

  it('converts a bar in another unit and flags it', () => {
    const mixed: Implement = {
      kind: 'barbell',
      bar: { weight: 45, unit: 'lb' },
      plates: homePlates,
    };
    const rounding = roundToAchievable(kg(60), mixed);
    expect(rounding.mixedUnits).toBe(true);
    expect(rounding.unit).toBe('kg');
    // 45 lb = 20.41 kg; + 2 × 20 kg = 60.41 kg.
    expect(rounding.chosen?.load).toBe(60.41);
  });

  it('adds both collars to every load', () => {
    const comp: Implement = { ...homeBar, collarWeight: 2.5 };
    expect(maxLoad(comp)).toBe(102.5);
    expect(roundToAchievable(kg(65), comp).chosen).toEqual({ load: 65, perSide: [20] });
  });

  it('reverse mode sums a loaded bar', () => {
    expect(barbellTotal({ weight: 20, unit: 'kg' }, homePlates, [20, 1.25])).toBe(62.5);
    expect(barbellTotal({ weight: 20, unit: 'kg' }, homePlates, [20], 2.5)).toBe(65);
  });
});

describe('dumbbells, kettlebells, stacks and loose plates', () => {
  it('rounds to a dumbbell rack', () => {
    const rack: Implement = { kind: 'list', unit: 'kg', weights: [10, 12.5, 15, 17.5, 20, 22.5] };
    expect(roundToAchievable(kg(16), rack).chosen?.load).toBe(15);
    expect(roundToAchievable(kg(30), rack)).toMatchObject({
      reason: 'aboveMax',
      chosen: { load: 22.5 },
    });
  });

  it('rounds to adjustable dumbbells and open increments', () => {
    const adjustable: Implement = { kind: 'steps', unit: 'kg', start: 2.5, step: 2, max: 24.5 };
    expect(roundToAchievable(kg(13), adjustable).chosen?.load).toBe(12.5);
    expect(maxLoad(adjustable)).toBe(24.5);
    const open: Implement = { kind: 'steps', unit: 'kg', start: 0, step: 2.5 };
    expect(roundToAchievable(kg(1001), open).chosen?.load).toBe(1000);
    expect(maxLoad(open)).toBeNull();
  });

  it('uses stack add-on weights', () => {
    const stack: Implement = {
      kind: 'steps',
      unit: 'kg',
      start: 5,
      step: 5,
      max: 100,
      addOns: [2.5],
    };
    expect(roundToAchievable(kg(43), stack).chosen?.load).toBe(42.5);
    expect(maxLoad(stack)).toBe(102.5);
    expect(nextLoadAbove(kg(40), stack).chosen?.load).toBe(42.5);
  });

  it('combines single plates for a dip belt', () => {
    const belt: Implement = { kind: 'loosePlates', plates: homePlates };
    expect(roundToAchievable(kg(7.5), belt).chosen).toEqual({ load: 7.5, plates: [5, 2.5] });
    expect(roundToAchievable(kg(0), belt).chosen).toEqual({ load: 0, plates: [] });
  });
});

describe('bodyweight-loaded exercises (WKT-11)', () => {
  const model = { type: 'bodyweightAdded' as const, bodyweightLoaded: true };

  it('adds the bodyweight trend to the external load; assistance is negative', () => {
    expect(effectiveLoadKg(kg(10), model, 80)).toBe(90);
    expect(effectiveLoadKg(kg(-25), { ...model, type: 'bodyweightAssisted' }, 80)).toBe(55);
    expect(effectiveLoadKg(null, model, 80)).toBe(80);
    expect(effectiveLoadKg(kg(10), model, null)).toBeNull();
    expect(effectiveLoadKg(kg(100), { type: 'barbell', bodyweightLoaded: false }, 80)).toBe(100);
  });

  it('splits a total target into added load or rounded assistance', () => {
    const belt: Implement = { kind: 'loosePlates', plates: homePlates };
    const assist: Implement = { kind: 'steps', unit: 'kg', start: 0, step: 5, max: 60 };
    expect(externalLoadForTotal(92, 80, { added: belt }).load).toEqual(kg(12.5));
    // 80 kg lifter, 63 kg target: 17 kg assistance → nearest stack step 15 kg.
    expect(externalLoadForTotal(63, 80, { assistance: assist }).load).toEqual(kg(-15));
    // "Down" for the lift means more assistance.
    expect(externalLoadForTotal(63, 80, { assistance: assist }, 'down').load).toEqual(kg(-20));
    expect(externalLoadForTotal(63, 80, {}).load).toEqual(kg(-17));
  });
});

describe('plate solver properties', () => {
  const inventory = fc.record({
    bar: fc.constantFrom(15, 20),
    plates: fc.uniqueArray(
      fc.record({
        weight: fc.constantFrom(25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25),
        pairs: fc.integer({ min: 0, max: 4 }),
      }),
      { selector: (p) => p.weight, maxLength: 9 },
    ),
  });

  it('every solution is achievable, symmetric and within the inventory', () => {
    fc.assert(
      fc.property(inventory, fc.double({ min: 0, max: 400, noNaN: true }), (inv, target) => {
        const implement: Implement = {
          kind: 'barbell',
          bar: { weight: inv.bar, unit: 'kg' },
          plates: { unit: 'kg', plates: inv.plates },
        };
        const { chosen } = roundToAchievable(kg(target), implement);
        expect(chosen).not.toBeNull();
        const perSide = chosen!.perSide!;
        // Symmetric by construction: the total is the bar plus twice one side.
        expect(barbellTotal(implement.bar, implement.plates, perSide)).toBeCloseTo(chosen!.load, 9);
        // Never more plates of a denomination than pairs exist.
        for (const plate of new Set(perSide)) {
          const available = inv.plates
            .filter((p) => p.weight === plate)
            .reduce((s, p) => s + p.pairs, 0);
          expect(perSide.filter((w) => w === plate).length).toBeLessThanOrEqual(available);
        }
        // Heaviest first.
        expect(perSide).toEqual(perSide.toSorted((a, b) => b - a));
      }),
    );
  });

  it('lands on the correct side of the target for each mode and is idempotent', () => {
    fc.assert(
      fc.property(fc.double({ min: 20, max: 97.5, noNaN: true }), (target) => {
        const down = roundToAchievable(kg(target), homeBar, 'down').chosen!.load;
        const up = roundToAchievable(kg(target), homeBar, 'up').chosen!.load;
        const nearest = roundToAchievable(kg(target), homeBar).chosen!.load;
        expect(down).toBeLessThanOrEqual(target + 0.005);
        expect(up).toBeGreaterThanOrEqual(target - 0.005);
        expect([down, up]).toContain(nearest);
        expect(Math.abs(nearest - target)).toBeLessThanOrEqual(
          Math.abs(target - (nearest === down ? up : down)) + 0.005,
        );
        for (const load of [down, up, nearest]) {
          expect(roundToAchievable(kg(load), homeBar)).toMatchObject({
            exact: true,
            chosen: { load },
          });
        }
      }),
    );
  });
});
