import {
  isEquipmentId,
  type CustomEquipmentId,
  type CustomEquipmentItem,
  type EquipmentProfile,
  type ExerciseId,
  type MassUnit,
  type PlanId,
  type PresetId,
} from '@powr/domain';
import {
  isAvailable,
  itemsOf,
  missingEquipment,
  profileFromPreset,
  type MissingEquipment,
} from '@powr/domain/equipment';
import { rankCandidates, type PlanEdit, type SlotCandidate } from '@powr/domain/planning';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import { exerciseLookup, planningRules } from './context';
import { currentMesocycle, savePlanEdit } from './plan';

/** A preset for the picker (EQP-02): confirmable in ≤ 3 taps. */
export interface PresetSummary {
  readonly id: PresetId;
  readonly name: string;
  readonly description: string;
  readonly items: number;
}

/** EQP-02: the gym presets in content order. */
export function listEquipmentPresets(deps: Deps): readonly PresetSummary[] {
  return deps.content.equipment().presets.map((preset) => ({
    id: preset.id,
    name: preset.name.en,
    description: preset.description.en,
    items: preset.items.length,
  }));
}

/**
 * EQP-02/03 (TD-29): a new, unsaved equipment profile from a preset, with the load inventory in
 * the unit of the user's loads (bars at their catalog weight, stacks at their default step).
 */
export function equipmentProfileFromPreset(
  deps: Deps,
  input: { readonly presetId: PresetId; readonly unit: MassUnit; readonly name: string },
): Result<EquipmentProfile, { readonly kind: 'unknownPreset' }> {
  const preset = deps.content.equipment().preset(input.presetId);
  if (!preset) return err({ kind: 'unknownPreset' });
  return ok(
    profileFromPreset(preset, deps.content.equipment().items, {
      id: deps.ids.next(),
      name: input.name,
      unit: input.unit,
    }),
  );
}

/** EQP-07: a custom item with a fresh `ce.` ID, to add to a profile. */
export function newCustomEquipmentItem(deps: Deps, name: string): CustomEquipmentItem {
  return { id: `ce.${deps.ids.next().toLowerCase()}` as CustomEquipmentId, name: name.trim() };
}

export type EquipmentProfileError =
  | { readonly kind: 'invalid'; readonly fields: readonly string[] }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'inUse' }
  | { readonly kind: 'lastProfile' };

/**
 * Saves an equipment profile (create or update). Catalog items must exist; a default profile
 * makes every other profile non-default. Returns the saved profile.
 */
export async function saveEquipmentProfile(
  deps: Deps,
  profile: EquipmentProfile,
): Promise<Result<EquipmentProfile, EquipmentProfileError>> {
  const fields: string[] = [];
  if (profile.name.trim() === '' || profile.name.length > 120) fields.push('name');
  const catalog = deps.content.equipment();
  if (profile.items.some((id) => !isEquipmentId(id) || !catalog.item(id))) fields.push('items');
  if (profile.customItems.some((item) => item.name.trim() === '')) fields.push('customItems');
  if (fields.length > 0) return err({ kind: 'invalid', fields });
  await deps.uow.write(['equipmentProfiles'], async (repos) => {
    const all = await repos.equipment.list();
    const isDefault =
      profile.isDefault || !all.some((other) => other.id !== profile.id && other.isDefault);
    if (isDefault) {
      for (const other of all) {
        if (other.id !== profile.id && other.isDefault)
          await repos.equipment.put({ ...other, isDefault: false });
      }
    }
    await repos.equipment.put({ ...profile, isDefault });
  });
  return ok(profile);
}

/** Deletes a profile that no active plan uses and that is not the only one. */
export async function deleteEquipmentProfile(
  deps: Deps,
  id: string,
): Promise<Result<void, EquipmentProfileError>> {
  return deps.uow.write(['equipmentProfiles', 'plans'], async (repos) => {
    const all = await repos.equipment.list();
    const target = all.find((profile) => profile.id === id);
    if (!target) return err({ kind: 'notFound' });
    if (all.length === 1) return err({ kind: 'lastProfile' });
    if ((await repos.plans.getActive())?.equipmentProfileId === id) return err({ kind: 'inUse' });
    await repos.equipment.delete(id);
    if (target.isDefault) {
      const next = all.find((profile) => profile.id !== id);
      if (next) await repos.equipment.put({ ...next, isDefault: true });
    }
    return ok(undefined);
  });
}

/** Makes a profile the default (EQP-06 picks the active profile per session later). */
export async function setDefaultEquipmentProfile(
  deps: Deps,
  id: string,
): Promise<Result<void, EquipmentProfileError>> {
  return deps.uow.write(['equipmentProfiles'], async (repos) => {
    const all = await repos.equipment.list();
    if (!all.some((profile) => profile.id === id)) return err({ kind: 'notFound' });
    for (const profile of all) {
      if (profile.isDefault !== (profile.id === id))
        await repos.equipment.put({ ...profile, isDefault: profile.id === id });
    }
    return ok(undefined);
  });
}

/** An exercise of the active plan that a changed profile no longer allows (EQP-05). */
export interface AffectedSlot {
  readonly dayKey: string;
  readonly slotKey: string;
  readonly exerciseId: ExerciseId;
  readonly missing: MissingEquipment;
  /** Equipment-valid alternatives, best first (same slot rules, MAP-03 ranking). */
  readonly substitutes: readonly SlotCandidate[];
}

/**
 * EQP-05: what changing an equipment profile does to the active plan: the affected exercises of
 * the current mesocycle, each with ranked substitutes the user confirms one by one or all at
 * once (`applyEquipmentChange`).
 */
export async function previewEquipmentChange(
  deps: Deps,
  profile: EquipmentProfile,
): Promise<{ readonly planId: PlanId | null; readonly affected: readonly AffectedSlot[] }> {
  const loaded = await deps.uow.read(['plans', 'profile'], async (repos) => ({
    plan: await repos.plans.getActive(),
    user: await repos.profile.get(),
  }));
  const { plan, user } = loaded;
  const mesocycle = plan ? currentMesocycle(plan) : undefined;
  if (!plan || !mesocycle || plan.equipmentProfileId !== profile.id)
    return { planId: plan?.id ?? null, affected: [] };
  const { rules } = await planningRules(deps, { style: plan.style, level: mesocycle.level });
  const items = itemsOf(profile);
  const lookup = exerciseLookup(deps);
  const affected: AffectedSlot[] = [];
  for (const day of mesocycle.days) {
    for (const slot of day.slots) {
      const exercise = lookup(slot.exerciseId);
      if (!exercise || isAvailable(exercise, items)) continue;
      const inDay = new Set(day.slots.map((other) => other.exerciseId));
      affected.push({
        dayKey: day.key,
        slotKey: slot.key,
        exerciseId: slot.exerciseId,
        missing: missingEquipment(exercise, items).value,
        substitutes: rankCandidates(
          slot,
          deps.content.exercises(),
          {
            equipment: items,
            avoid: user?.avoid ?? { exercises: [], patterns: [] },
            preferred: user?.preferredExercises ?? [],
          },
          lookup,
          rules,
        ).filter((candidate) => !inDay.has(candidate.exerciseId)),
      });
    }
  }
  return { planId: plan.id, affected };
}

/** EQP-05: saves the profile and swaps the confirmed substitutes into the plan from today on. */
export async function applyEquipmentChange(
  deps: Deps,
  input: {
    readonly profile: EquipmentProfile;
    readonly substitutions: readonly {
      readonly dayKey: string;
      readonly slotKey: string;
      readonly exerciseId: ExerciseId;
    }[];
  },
): Promise<Result<void, EquipmentProfileError>> {
  const saved = await saveEquipmentProfile(deps, input.profile);
  if (!saved.ok) return saved;
  const plan = await deps.uow.read(['plans'], (repos) => repos.plans.getActive());
  if (!plan || input.substitutions.length === 0) return ok(undefined);
  const edits: PlanEdit[] = input.substitutions.map((swap) => ({ kind: 'swapExercise', ...swap }));
  const result = await savePlanEdit(deps, { planId: plan.id, edits, scope: 'nextSession' });
  return result.ok ? ok(undefined) : err({ kind: 'notFound' });
}
