export type LengthUnit = 'cm' | 'in';

/** A length exactly as the user entered it (§8.1). */
export interface Length {
  readonly value: number;
  readonly unit: LengthUnit;
}

/** Exact international definition. */
export const CM_PER_IN = 2.54;

export function toCm(length: Length): number {
  return length.unit === 'cm' ? length.value : length.value * CM_PER_IN;
}

export function convertLength(length: Length, unit: LengthUnit): number {
  if (length.unit === unit) return length.value;
  return unit === 'cm' ? length.value * CM_PER_IN : length.value / CM_PER_IN;
}
