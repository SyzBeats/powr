import { EQUIPMENT_CATEGORIES, type EquipmentDef, type EquipmentPresetDef } from '../types';
import { z } from '../zod';
import { equipmentId, localizedText, mass, presetId, synonym } from './common';

/** One default per unit system: exactly one kg and one lb value. */
const perUnit = z
  .array(mass)
  .length(2)
  .refine(
    (values) => values.some((v) => v.unit === 'kg') && values.some((v) => v.unit === 'lb'),
    'Give one kg and one lb value',
  );

const loading = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('bar'), defaultWeight: perUnit, variesByModel: z.boolean() }),
  z.strictObject({ kind: z.literal('stack'), defaultIncrement: perUnit }),
  z.strictObject({ kind: z.literal('plateLoaded') }),
  z.strictObject({ kind: z.literal('plates') }),
  z.strictObject({ kind: z.literal('microplates') }),
  z.strictObject({ kind: z.literal('dumbbells') }),
  z.strictObject({ kind: z.literal('kettlebells') }),
  z.strictObject({ kind: z.literal('bands') }),
]);

/** One item of data/equipment.yaml (EQP-01, EQP-03). */
export const equipmentDefSchema = z.strictObject({
  id: equipmentId,
  name: localizedText(60),
  synonyms: z.array(synonym),
  category: z.enum(EQUIPMENT_CATEGORIES),
  loading: loading.exactOptional(),
}) satisfies z.ZodType<EquipmentDef>;

const weight = z.number().positive().max(500);

const platePairs = z
  .array(z.strictObject({ weight, pairs: z.int().min(1).max(20) }))
  .min(1)
  .refine(
    (plates) => new Set(plates.map((plate) => plate.weight)).size === plates.length,
    'Each denomination appears once',
  );

const dumbbells = z.union([
  z.strictObject({ weights: z.array(weight).min(1) }),
  z
    .strictObject({ from: weight, to: weight, step: weight })
    .refine(({ from, to }) => from < to, 'A dumbbell range runs from a lower to a higher weight')
    .refine(
      ({ from, to, step }) => Number.isInteger(Math.round(((to - from) / step) * 1e6) / 1e6),
      'The range is a whole number of steps',
    ),
]);

const inventory = z.strictObject({
  plates: platePairs.exactOptional(),
  microplates: platePairs.exactOptional(),
  dumbbells: dumbbells.exactOptional(),
  kettlebells: z.array(weight).min(1).exactOptional(),
});

/** One preset of data/presets.yaml (EQP-02) with default inventories (EQP-03). */
export const equipmentPresetDefSchema = z.strictObject({
  id: presetId,
  name: localizedText(60),
  description: localizedText(200),
  items: z.array(equipmentId),
  inventory: z.strictObject({ kg: inventory.exactOptional(), lb: inventory.exactOptional() }),
}) satisfies z.ZodType<EquipmentPresetDef>;
