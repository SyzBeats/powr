import type {
  EquipmentDef,
  EquipmentId,
  EquipmentProfile,
  MassUnit,
  PlatePairs,
} from '@powr/domain';

/**
 * Pure edits of an equipment profile for the editor (EQP-01…03, EQP-07). Toggling a bar or a
 * stack adds its load details at the catalog default in the profile's unit, so the plate
 * calculator and rounding have something to work with; the user can then change them.
 */
export function toggleItem(
  profile: EquipmentProfile,
  item: EquipmentDef,
  on: boolean,
): EquipmentProfile {
  const items = on
    ? [...new Set([...profile.items, item.id])]
    : profile.items.filter((id) => id !== item.id);
  const loading = item.loading;
  let { bars, stacks } = profile;
  if (loading?.kind === 'bar') {
    bars = bars.filter((bar) => bar.item !== item.id);
    const weight = pick(loading.defaultWeight, profile.unit);
    if (on && weight) bars = [...bars, { item: item.id, weight }];
  }
  if (loading?.kind === 'stack') {
    stacks = stacks.filter((stack) => stack.item !== item.id);
    const increment = pick(loading.defaultIncrement, profile.unit);
    if (on && increment) stacks = [...stacks, { item: item.id, increment }];
  }
  return { ...profile, items, bars, stacks };
}

function pick<T extends { readonly unit: MassUnit }>(values: readonly T[], unit: MassUnit) {
  return values.find((value) => value.unit === unit) ?? values[0];
}

export function hasItem(profile: EquipmentProfile, id: EquipmentId | string): boolean {
  return profile.items.includes(id as EquipmentId);
}

/** Items of a loading kind the profile holds (plates, dumbbells, …). */
export function selectedOfKind(
  profile: EquipmentProfile,
  catalog: readonly EquipmentDef[],
  kind: NonNullable<EquipmentDef['loading']>['kind'],
): EquipmentDef[] {
  return catalog.filter((item) => item.loading?.kind === kind && hasItem(profile, item.id));
}

/** Plate pairs sorted heaviest first; zero pairs drop out. */
export function normalizePlates(plates: readonly PlatePairs[]): PlatePairs[] {
  const merged = new Map<number, number>();
  for (const plate of plates) {
    if (!(plate.weight > 0)) continue;
    merged.set(plate.weight, (merged.get(plate.weight) ?? 0) + plate.pairs);
  }
  return [...merged]
    .filter(([, pairs]) => pairs > 0)
    .map(([weight, pairs]) => ({ weight, pairs }))
    .toSorted((a, b) => b.weight - a.weight);
}

/** "8, 12, 16" → [8, 12, 16] (positive numbers, sorted, unique). */
export function parseWeights(text: string): number[] {
  return [
    ...new Set(
      text
        .split(/[,;\s]+/)
        .map((part) => Number(part.replace(',', '.')))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  ].toSorted((a, b) => a - b);
}

/** A number from an input, or null while it is empty or not a number. */
export function parseNumber(text: string): number | null {
  const value = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) ? null : value;
}

/** Items and custom items in the profile: the count the profile list shows. */
export function itemCount(profile: EquipmentProfile): number {
  return profile.items.length + profile.customItems.length;
}
