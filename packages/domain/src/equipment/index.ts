/**
 * `@powr/domain/equipment`: what the user's equipment allows (EQP-02…04, EQP-07; TD-29).
 *
 * - `isAvailable` is the one availability check (EQP-04: every `allOf` item and one item of each
 *   `anyOf` group). Plans, substitutions, rankings and warm-ups all use it, so an unavailable
 *   exercise is never suggested.
 * - `missingEquipment` names what is missing ("needs a power rack or a squat stand").
 * - `profileFromPreset` turns a content preset (EQP-02) into an equipment profile with its load
 *   inventory in one unit system (EQP-03).
 * - `implementFor` maps an exercise and a profile onto the achievable-load service's `Implement`
 *   (`@powr/domain/loading`), so every suggested load is rounded to what the gym can load.
 */
import { explained, type Explained } from '../explain';
import type { EquipmentId } from '../ids';
import type { Implement, PlateInventory } from '../loading';
import type {
  EquipmentDef,
  EquipmentPresetDef,
  EquipmentProfile,
  EquipmentRequirement,
  ExerciseDef,
  PlatePairs,
} from '../model';
import type { Mass, MassUnit } from '../units';

/** Anything that names the items at hand: a profile or a plain set of item IDs. */
export type EquipmentAccess = Pick<EquipmentProfile, 'items' | 'customItems'> | ReadonlySet<string>;

/** The item IDs a profile offers: catalog items and custom items (EQP-07). */
export function itemsOf(access: EquipmentAccess): ReadonlySet<string> {
  if (access instanceof Set) return access;
  const profile = access as Pick<EquipmentProfile, 'items' | 'customItems'>;
  return new Set<string>([...profile.items, ...profile.customItems.map((item) => item.id)]);
}

/** EQP-04: every `allOf` item and at least one item of each `anyOf` group is at hand. */
export function isAvailable(
  exercise: { readonly equipment: EquipmentRequirement },
  access: EquipmentAccess,
): boolean {
  const items = itemsOf(access);
  const { allOf, anyOf } = exercise.equipment;
  return (
    allOf.every((id) => items.has(id)) && anyOf.every((group) => group.some((id) => items.has(id)))
  );
}

export interface MissingEquipment {
  /** `allOf` items that are not at hand. */
  readonly allOf: readonly EquipmentId[];
  /** `anyOf` groups with no item at hand ("a power rack or a squat stand"). */
  readonly anyOf: readonly (readonly EquipmentId[])[];
}

/** What an exercise needs that the equipment lacks; empty lists when it is available. */
export function missingEquipment(
  exercise: Pick<ExerciseDef, 'id' | 'equipment'>,
  access: EquipmentAccess,
): Explained<MissingEquipment> {
  const items = itemsOf(access);
  const missing: MissingEquipment = {
    allOf: exercise.equipment.allOf.filter((id) => !items.has(id)),
    anyOf: exercise.equipment.anyOf.filter((group) => !group.some((id) => items.has(id))),
  };
  return explained(missing, 'equipment.availability', {
    args: {
      exercise: exercise.id,
      available: missing.allOf.length === 0 && missing.anyOf.length === 0,
      missing: [...missing.allOf, ...missing.anyOf.map((group) => group.join('|'))].join(', '),
    },
  });
}

export interface ProfileFromPresetOptions {
  readonly id: string;
  readonly name: string;
  /** The unit of the gym's plates and dumbbells (EQP-03: independent of the display unit). */
  readonly unit: MassUnit;
  readonly isDefault?: boolean;
}

/**
 * EQP-02/03 (TD-29): a new equipment profile from a preset. Items are copied; bars take their
 * catalog default weight and stacks their default increment in `unit`; plates, microplates,
 * dumbbells and kettlebells come from the preset's inventory in `unit` (or, if the preset has
 * none for it, the other unit, which then becomes the profile's unit). Collars weigh 0 (EQP-03).
 */
export function profileFromPreset(
  preset: EquipmentPresetDef,
  catalog: readonly EquipmentDef[],
  options: ProfileFromPresetOptions,
): EquipmentProfile {
  const other: MassUnit = options.unit === 'kg' ? 'lb' : 'kg';
  const unit = preset.inventory[options.unit] || !preset.inventory[other] ? options.unit : other;
  const inventory = preset.inventory[unit] ?? {};
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const perUnit = (values: readonly Mass[]): Mass | undefined =>
    values.find((value) => value.unit === unit) ?? values[0];

  const bars = preset.items.flatMap((id) => {
    const loading = byId.get(id)?.loading;
    const weight = loading?.kind === 'bar' ? perUnit(loading.defaultWeight) : undefined;
    return weight ? [{ item: id, weight }] : [];
  });
  const stacks = preset.items.flatMap((id) => {
    const loading = byId.get(id)?.loading;
    const increment = loading?.kind === 'stack' ? perUnit(loading.defaultIncrement) : undefined;
    return increment ? [{ item: id, increment }] : [];
  });
  return {
    id: options.id,
    name: options.name,
    isDefault: options.isDefault ?? true,
    presetId: preset.id,
    items: [...preset.items],
    customItems: [],
    unit,
    bars,
    plates: [...(inventory.plates ?? [])],
    microplates: [...(inventory.microplates ?? [])],
    collarWeight: 0,
    dumbbells: inventory.dumbbells ?? null,
    kettlebells: [...(inventory.kettlebells ?? [])],
    stacks,
    bands: [],
  };
}

/**
 * TD-29: the implement an exercise is loaded with in this profile, for `roundToAchievable`.
 * - Barbell (and plate-loaded machines, whose empty weight is the profile's "bar" entry or 0):
 *   the first required bar at hand, the profile's plates and microplates, its collars.
 * - Dumbbells: the dumbbell list or range; kettlebell work: the kettlebells.
 * - Stack machines and cables: start + k·increment, plus add-ons; assisted machines alike.
 * - Bodyweight plus load: loose plates (dip belt).
 * - Otherwise the exercise's own default increment, else null (bands and timed work have no load).
 */
export function implementFor(
  exercise: Pick<ExerciseDef, 'equipment' | 'load'>,
  profile: EquipmentProfile,
  catalog: readonly EquipmentDef[],
): Implement | null {
  const items = itemsOf(profile);
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const usable = [...exercise.equipment.allOf, ...exercise.equipment.anyOf.flat()].filter((id) =>
    items.has(id),
  );
  const kindOf = (id: EquipmentId) => byId.get(id)?.loading?.kind;
  const plates = plateInventory(profile);
  const fallback = (): Implement | null =>
    exercise.load.increment
      ? {
          kind: 'steps',
          unit: exercise.load.increment.unit,
          start: 0,
          step: exercise.load.increment.value,
        }
      : null;

  switch (exercise.load.type) {
    case 'barbell': {
      const bar = usable.find((id) => kindOf(id) === 'bar' || kindOf(id) === 'plateLoaded');
      if (!bar || plates.plates.length === 0) return fallback();
      const weight = profile.bars.find((entry) => entry.item === bar)?.weight;
      return {
        kind: 'barbell',
        bar: weight
          ? { weight: weight.value, unit: weight.unit }
          : { weight: 0, unit: profile.unit },
        plates,
        ...(profile.collarWeight > 0 ? { collarWeight: profile.collarWeight } : {}),
      };
    }
    case 'dumbbell': {
      const usesKettlebells = usable.some((id) => kindOf(id) === 'kettlebells');
      const usesDumbbells = usable.some((id) => kindOf(id) === 'dumbbells');
      if (usesDumbbells && profile.dumbbells) {
        const set = profile.dumbbells;
        return 'weights' in set
          ? { kind: 'list', unit: profile.unit, weights: [...set.weights] }
          : { kind: 'steps', unit: profile.unit, start: set.from, step: set.step, max: set.to };
      }
      if (usesKettlebells && profile.kettlebells.length > 0) {
        return { kind: 'list', unit: profile.unit, weights: [...profile.kettlebells] };
      }
      return fallback();
    }
    case 'machine':
    case 'bodyweightAssisted': {
      const stack = profile.stacks.find((entry) => usable.includes(entry.item));
      if (stack) {
        return {
          kind: 'steps',
          unit: stack.increment.unit,
          start: stack.increment.value,
          step: stack.increment.value,
          ...(stack.addOns && stack.addOns.length > 0 ? { addOns: [...stack.addOns] } : {}),
        };
      }
      const loaded = usable.find((id) => kindOf(id) === 'plateLoaded');
      if (loaded && plates.plates.length > 0) {
        const weight = profile.bars.find((entry) => entry.item === loaded)?.weight;
        return {
          kind: 'barbell',
          bar: weight
            ? { weight: weight.value, unit: weight.unit }
            : { weight: 0, unit: profile.unit },
          plates,
        };
      }
      return fallback();
    }
    case 'bodyweightAdded':
      return plates.plates.length > 0 ? { kind: 'loosePlates', plates } : fallback();
    default:
      // Bands and timed work carry no load (EQP-03).
      return null;
  }
}

/** The profile's plates and microplates as one inventory in the profile's unit. */
export function plateInventory(
  profile: Pick<EquipmentProfile, 'unit' | 'plates' | 'microplates'>,
): PlateInventory {
  const merged = new Map<number, number>();
  const add = (pairs: readonly PlatePairs[]) => {
    for (const { weight, pairs: count } of pairs)
      merged.set(weight, (merged.get(weight) ?? 0) + count);
  };
  add(profile.plates);
  add(profile.microplates);
  return {
    unit: profile.unit,
    plates: [...merged].toSorted(([a], [b]) => b - a).map(([weight, pairs]) => ({ weight, pairs })),
  };
}
