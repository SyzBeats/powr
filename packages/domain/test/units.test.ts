import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { KG_PER_LB, convertMass, toKg, type Mass } from '../src';

describe('mass', () => {
  it('converts pounds to kilograms with the exact factor', () => {
    expect(toKg({ value: 225, unit: 'lb' })).toBeCloseTo(102.0582833, 7);
    expect(toKg({ value: 100, unit: 'kg' })).toBe(100);
  });

  it('never changes the stored value when the display unit is switched (QS-15)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1000, noNaN: true }), (value) => {
        const stored: Mass = { value, unit: 'lb' };
        for (let i = 0; i < 10; i++) {
          convertMass(stored, 'kg');
          convertMass(stored, 'lb');
        }
        expect(stored).toEqual({ value, unit: 'lb' });
        expect(convertMass(stored, 'lb')).toBe(value);
      }),
    );
  });

  it('round-trips kg -> lb -> kg within float precision', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2000, noNaN: true }), (kg) => {
        const lb = convertMass({ value: kg, unit: 'kg' }, 'lb');
        expect(lb * KG_PER_LB).toBeCloseTo(kg, 9);
      }),
    );
  });
});
