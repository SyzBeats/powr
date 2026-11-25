import type { ExerciseId, LocalDate } from '../ids';
import type { InstantTz } from '../time';
import type { Mass } from '../units';

/*
 * Body measurements (BOD-03) and per-exercise user data (EXL-09). Raw user data, backed up like
 * the training log (technical concept §8.2.2: `measurements`, `exerciseUserData`).
 */

/**
 * BOD-03 measurement sites: circumferences (neck, chest, waist, hips, upper arm, thigh and calf,
 * left and right) and the skinfold sites the Jackson-Pollock equations use (BOD-04, v1.2).
 */
export const CIRCUMFERENCE_SITES = [
  'neck',
  'chest',
  'waist',
  'hips',
  'upperArmLeft',
  'upperArmRight',
  'thighLeft',
  'thighRight',
  'calfLeft',
  'calfRight',
] as const;
export const SKINFOLD_SITES = [
  'skinfoldChest',
  'skinfoldAbdomen',
  'skinfoldThigh',
  'skinfoldTriceps',
  'skinfoldSuprailiac',
  'skinfoldSubscapular',
  'skinfoldMidaxillary',
] as const;
// Written out (no spread): a computed top-level array would stay in every bundle that imports
// the model, used or not.
export const MEASUREMENT_SITES = [
  'neck',
  'chest',
  'waist',
  'hips',
  'upperArmLeft',
  'upperArmRight',
  'thighLeft',
  'thighRight',
  'calfLeft',
  'calfRight',
  'skinfoldChest',
  'skinfoldAbdomen',
  'skinfoldThigh',
  'skinfoldTriceps',
  'skinfoldSuprailiac',
  'skinfoldSubscapular',
  'skinfoldMidaxillary',
] as const satisfies readonly (
  | (typeof CIRCUMFERENCE_SITES)[number]
  | (typeof SKINFOLD_SITES)[number]
)[];
export type MeasurementSite = (typeof MEASUREMENT_SITES)[number];

/** Circumferences in cm or in; skinfolds in mm. */
export type MeasurementUnit = 'cm' | 'in' | 'mm';

/** One measurement (BOD-03). Several per day are allowed; the trend uses each day's first. */
export interface MeasurementEntry {
  readonly id: string;
  readonly site: MeasurementSite;
  readonly localDate: LocalDate;
  readonly measuredAt: InstantTz;
  readonly value: number;
  readonly unit: MeasurementUnit;
  readonly note?: string;
}

/** The default BOD-03 list (circumferences; skinfolds are opt-in). */
export const DEFAULT_MEASUREMENT_SITES: readonly MeasurementSite[] = [
  'neck',
  'chest',
  'waist',
  'hips',
  'upperArmLeft',
  'upperArmRight',
  'thighLeft',
  'thighRight',
  'calfLeft',
  'calfRight',
];

/** Whether a site is a skinfold (mm) rather than a circumference (cm or in). */
export function isSkinfold(site: MeasurementSite): boolean {
  return site.startsWith('skinfold');
}

/** EXL-09: what an exercise's setup memory can name; `other` carries its own label. */
export const SETUP_FIELDS = [
  'seat',
  'backrest',
  'pin',
  'handle',
  'grip',
  'stance',
  'rack',
  'safeties',
  'other',
] as const;
export type SetupField = (typeof SETUP_FIELDS)[number];

export interface SetupEntry {
  readonly field: SetupField;
  /** Only for `other` ("Cable height"). */
  readonly label?: string;
  readonly value: string;
}

/**
 * Per-exercise user data (raw table `exerciseUserData`, keyed by exercise): the setup memory of
 * EXL-09 ("seat 4, pin 3, wide grip"), shown whenever the exercise appears in a session.
 * Favourites, hidden and avoided exercises stay in the profile (EXL-08, as in M2).
 */
export interface ExerciseUserData {
  readonly exerciseId: ExerciseId;
  readonly setup: readonly SetupEntry[];
  readonly note?: string;
  /** ANL-04, PLN-07: a user-set reference max for percentage work (often below the true 1RM). */
  readonly trainingMax?: Mass;
  readonly updatedAt: InstantTz;
}
