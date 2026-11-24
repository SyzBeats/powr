import { isContentExerciseId, isEquipmentId, isMuscleId, isSourceId } from '@powr/domain';

import type { PresetId, TemplateId } from '../types';
import { z } from '../zod';

/** Lowercase ASCII words joined by single hyphens, as in every content ID. */
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';

export const localizedText = (max: number) =>
  z.strictObject({ en: z.string().trim().min(1).max(max) });

export const exerciseId = z
  .string()
  .refine(isContentExerciseId, 'Content exercise IDs look like ex.some-name');
export const muscleId = z
  .string()
  .refine(isMuscleId, 'Muscle IDs look like mu.quads or mu.quads.vasti');
export const equipmentId = z.string().refine(isEquipmentId, 'Equipment IDs look like eq.some-name');
export const sourceId = z.string().refine(isSourceId, 'Source IDs look like src.kubo2019');

const PRESET_ID = new RegExp(`^preset\\.${SLUG}$`);
export const presetId = z
  .string()
  .refine((value): value is PresetId => PRESET_ID.test(value), 'Preset IDs look like preset.name');

const TEMPLATE_ID = new RegExp(`^tpl\\.${SLUG}$`);
export const templateId = z
  .string()
  .refine(
    (value): value is TemplateId => TEMPLATE_ID.test(value),
    'Template IDs look like tpl.bb-full-body-3day',
  );

/** Substitution group keys (EXL-07), e.g. sg.squat. */
export const substitutionGroupId = z
  .string()
  .regex(new RegExp(`^sg\\.${SLUG}$`), 'Substitution groups look like sg.some-name');

/** A rules-registry parameter ID, in the format of `paramDefSchema` (@powr/rules). */
export const paramRef = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/, 'Rule references look like deload.planned');

/** Search terms and synonyms (EXL-02, EQP-01); the lint compares them case-insensitively. */
export const synonym = z.string().trim().min(1).max(60);

export const mass = z.strictObject({
  value: z.number().positive(),
  unit: z.enum(['kg', 'lb']),
});

/** Inclusive [min, max] of whole numbers, 1 ≤ min ≤ max ≤ 100. */
export const repRange = z
  .tuple([z.int().min(1).max(100), z.int().min(1).max(100)])
  .refine(([min, max]) => min <= max, 'A rep range is [min, max] with min ≤ max');
