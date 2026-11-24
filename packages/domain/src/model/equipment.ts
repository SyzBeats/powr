import type { Brand, EquipmentId } from '../ids';
import type { Mass, MassUnit } from '../units';
import type { LocalizedText } from './exercise';

/*
 * The equipment catalog, the gym presets (EQP-01…03) and the user's equipment profile. The
 * catalog and preset types moved here from `@powr/content` in M2, because the plan generator and
 * the equipment profile read them (technical concept §5.6); `@powr/content` re-exports them.
 */

export const EQUIPMENT_CATEGORIES = [
  'bar',
  'rack',
  'bench',
  'freeWeight',
  'cable',
  'machine',
  'bodyweight',
  'accessory',
  'cardio',
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

/**
 * Which load details an item needs (EQP-03). The inventory itself (plates, dumbbells, …) is part
 * of an equipment profile; presets give defaults for it.
 */
export type EquipmentLoading =
  /** A bar with a default weight per unit system (one `Mass` per unit). */
  | {
      readonly kind: 'bar';
      readonly defaultWeight: readonly Mass[];
      /** The weight differs between models; the equipment editor asks the user to check. */
      readonly variesByModel: boolean;
    }
  /** A weight stack with a default increment per unit system. */
  | { readonly kind: 'stack'; readonly defaultIncrement: readonly Mass[] }
  /** Loaded with plates; the empty weight (sled, carriage, Smith bar) differs between models. */
  | { readonly kind: 'plateLoaded' }
  | { readonly kind: 'plates' }
  | { readonly kind: 'microplates' }
  | { readonly kind: 'dumbbells' }
  | { readonly kind: 'kettlebells' }
  /** Bands: labels with an optional nominal resistance; never used for e1RM (EQP-03). */
  | { readonly kind: 'bands' };

export interface EquipmentDef {
  readonly id: EquipmentId;
  readonly name: LocalizedText;
  /** Search terms (EQP-01: "hex bar" finds the trap bar). */
  readonly synonyms: readonly string[];
  readonly category: EquipmentCategory;
  readonly loading?: EquipmentLoading;
}

/** Pairs of one plate denomination; the unit is the inventory's. */
export interface PlatePairs {
  readonly weight: number;
  readonly pairs: number;
}

/** Fixed dumbbells (a list) or a range with a step (a rack, or adjustable dumbbells). */
export type DumbbellSet =
  | { readonly weights: readonly number[] }
  | { readonly from: number; readonly to: number; readonly step: number };

/** Default load inventory of a preset in one unit system (EQP-03); plain numbers in `unit`. */
export interface PresetInventory {
  readonly plates?: readonly PlatePairs[];
  readonly microplates?: readonly PlatePairs[];
  readonly dumbbells?: DumbbellSet;
  readonly kettlebells?: readonly number[];
}

/** 'preset.commercial-gym'. */
export type PresetId = Brand<string, 'PresetId'>;

/** A gym preset (EQP-02): pre-selected items plus default inventories in kg and lb. */
export interface EquipmentPresetDef {
  readonly id: PresetId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly items: readonly EquipmentId[];
  /** Defaults per unit system, so a lb gym gets lb plates (EQP-03: independent of display). */
  readonly inventory: Readonly<Partial<Record<MassUnit, PresetInventory>>>;
}

// ---------------------------------------------------------------------------------------------
// The user's equipment profile (EQP-02, EQP-03, EQP-07; technical concept §5.6)

/** A user-defined item (EQP-07): `ce.<uuidv7>`; custom exercises (EXL-04) can require it. */
export type CustomEquipmentId = Brand<string, 'CustomEquipmentId'>;

export interface CustomEquipmentItem {
  readonly id: CustomEquipmentId;
  readonly name: string;
  /** Optional load details: a weight stack increment or a fixed implement weight. */
  readonly increment?: Mass;
}

/** A bar of the profile with its actual weight (EQP-03: editable, e.g. a 15 kg technique bar). */
export interface BarWeight {
  readonly item: EquipmentId;
  readonly weight: Mass;
}

/** A cable or machine stack (EQP-03): the increment and optional add-on weights. */
export interface StackSetting {
  readonly item: EquipmentId;
  readonly increment: Mass;
  /** Small add-on weights (magnets, pins) in the increment's unit. */
  readonly addOns?: readonly number[];
}

/** A resistance band (EQP-03): a label and an optional nominal resistance; never used for e1RM. */
export interface BandSetting {
  readonly label: string;
  readonly resistance?: Mass;
}

/**
 * One equipment profile (EQP-02/03/07). Items are catalog IDs; the inventory is stored in one
 * unit system (`unit`), independent of the display unit (SET-02). MVP holds one profile (the
 * default); several named profiles are EQP-06 (v1.x), which the shape already allows.
 */
export interface EquipmentProfile {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  /** The preset it started from, if any (EQP-02). */
  readonly presetId?: PresetId;
  readonly items: readonly EquipmentId[];
  readonly customItems: readonly CustomEquipmentItem[];
  /** Unit of `plates`, `microplates`, `dumbbells`, `kettlebells` and `collarWeight`. */
  readonly unit: MassUnit;
  readonly bars: readonly BarWeight[];
  readonly plates: readonly PlatePairs[];
  readonly microplates: readonly PlatePairs[];
  /** Weight of one collar (EQP-03 default 0; competition collars 2.5 kg each). */
  readonly collarWeight: number;
  readonly dumbbells: DumbbellSet | null;
  readonly kettlebells: readonly number[];
  readonly stacks: readonly StackSetting[];
  readonly bands: readonly BandSetting[];
}
