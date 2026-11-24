import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { convertLength, displayMass, fromKg, roundToStep, toCm, toKg, type Mass } from '../src';

describe('rounding and display (§8.1)', () => {
  it('rounds onto a step grid with nearest-ties-down, down and up', () => {
    expect(roundToStep(61.25, 2.5)).toBe(60);
    expect(roundToStep(61.26, 2.5)).toBe(62.5);
    expect(roundToStep(62.4, 2.5, 'down')).toBe(60);
    expect(roundToStep(60.1, 2.5, 'up')).toBe(62.5);
    expect(roundToStep(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundToStep(21, 5, 'nearestTiesDown', 2.5)).toBe(22.5);
    expect(() => roundToStep(1, 0)).toThrow(RangeError);
  });

  it('is idempotent and lands on the correct side for each mode', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -500, max: 2000, noNaN: true }),
        fc.constantFrom(0.25, 0.5, 1, 1.25, 2.5, 5),
        (value, step) => {
          const down = roundToStep(value, step, 'down');
          const up = roundToStep(value, step, 'up');
          const nearest = roundToStep(value, step);
          expect(down).toBeLessThanOrEqual(value + 1e-6);
          expect(up).toBeGreaterThanOrEqual(value - 1e-6);
          expect([down, up]).toContain(nearest);
          expect(roundToStep(nearest, step)).toBe(nearest);
        },
      ),
    );
  });

  it('displays a mass in another unit at 0.1 without touching the stored value', () => {
    const stored: Mass = { value: 60, unit: 'kg' };
    expect(displayMass(stored, 'lb')).toBe(132.3);
    expect(displayMass({ value: 225, unit: 'lb' }, 'kg')).toBe(102.1);
    expect(displayMass(stored, 'kg', 0.5)).toBe(60);
    expect(stored).toEqual({ value: 60, unit: 'kg' });
    expect(fromKg(100, 'lb')).toBeCloseTo(220.462, 3);
  });

  it('converts lengths with 1 in = 2.54 cm and round-trips', () => {
    expect(toCm({ value: 10, unit: 'in' })).toBe(25.4);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 300, noNaN: true }), (cm) => {
        const inches = convertLength({ value: cm, unit: 'cm' }, 'in');
        expect(convertLength({ value: inches, unit: 'in' }, 'cm')).toBeCloseTo(cm, 9);
      }),
    );
  });

  it('round-trips kg → lb → kg through fromKg and toKg', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2000, noNaN: true }), (kg) => {
        expect(toKg({ value: fromKg(kg, 'lb'), unit: 'lb' })).toBeCloseTo(kg, 9);
      }),
    );
  });
});
