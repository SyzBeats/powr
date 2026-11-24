export type MassUnit = 'kg' | 'lb';

/** A mass exactly as the user entered it. Switching the display unit never rewrites it (§8.1). */
export interface Mass {
  readonly value: number;
  readonly unit: MassUnit;
}

/** Exact international definition. */
export const KG_PER_LB = 0.45359237;

export function toKg(mass: Mass): number {
  return mass.unit === 'kg' ? mass.value : mass.value * KG_PER_LB;
}

export function convertMass(mass: Mass, unit: MassUnit): number {
  if (mass.unit === unit) return mass.value;
  return unit === 'kg' ? mass.value * KG_PER_LB : mass.value / KG_PER_LB;
}

/** A value in kg expressed in `unit` (calculations run in kg, §8.1). */
export function fromKg(kg: number, unit: MassUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}
