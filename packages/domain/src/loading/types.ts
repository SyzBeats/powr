import type { MassUnit } from '../units';

/** A bar (EQP-03): Olympic 20 kg / 45 lb, women's 15 kg / 35 lb, EZ bar, trap bar… */
export interface BarSpec {
  readonly weight: number;
  readonly unit: MassUnit;
}

/** One plate denomination and how many pairs of it exist (microplates included). */
export interface PlatePair {
  readonly weight: number;
  readonly pairs: number;
}

/** The plates of one plate set, in that set's own unit (SET-02: unit per plate set). */
export interface PlateInventory {
  readonly unit: MassUnit;
  readonly plates: readonly PlatePair[];
}

/**
 * Something a load is put on, as the achievable-load service sees it (WKT-07, PRG-07). Equipment
 * presets and the equipment profile map onto these four shapes:
 * - `barbell`: bar + collars + the same plates on both sides (also plate-loaded machines, with the
 *   sled as the "bar");
 * - `list`: fixed weights such as a dumbbell rack or kettlebells (load per implement);
 * - `steps`: start + k·step up to `max` (adjustable dumbbells, cable and machine stacks), plus
 *   optional add-on weights; without `max` it is an open increment (an exercise's default step);
 * - `loosePlates`: any combination of single plates, e.g. on a dip belt (bodyweight-added work).
 */
export type Implement =
  | {
      readonly kind: 'barbell';
      readonly bar: BarSpec;
      readonly plates: PlateInventory;
      /** Weight of one collar in the plates' unit; two are used (default 0). */
      readonly collarWeight?: number;
    }
  | { readonly kind: 'list'; readonly unit: MassUnit; readonly weights: readonly number[] }
  | {
      readonly kind: 'steps';
      readonly unit: MassUnit;
      readonly start: number;
      readonly step: number;
      readonly max?: number;
      readonly addOns?: readonly number[];
    }
  | { readonly kind: 'loosePlates'; readonly plates: PlateInventory };

/** An achievable load in the implement's unit. */
export interface LoadOption {
  readonly load: number;
  /** Barbell: the plates on each side, heaviest first. */
  readonly perSide?: readonly number[];
  /** Loose plates: the plates used, heaviest first. */
  readonly plates?: readonly number[];
}

export type RoundingReason = 'exact' | 'notLoadable' | 'belowMin' | 'aboveMax' | 'nothingLoadable';

/**
 * The result of rounding a target to what the equipment allows (§8.1). `below` and `above` are
 * the nearest achievable loads on either side ("61 kg not loadable: 60 kg or 62.5 kg"); `chosen`
 * follows the rounding mode, falling back to the only side that exists.
 */
export interface Rounding {
  readonly unit: MassUnit;
  readonly target: number;
  readonly exact: boolean;
  readonly chosen: LoadOption | null;
  readonly below: LoadOption | null;
  readonly above: LoadOption | null;
  readonly reason: RoundingReason;
  /** The bar's unit differs from the plates' unit; the bar was converted with the exact factor. */
  readonly mixedUnits: boolean;
}
