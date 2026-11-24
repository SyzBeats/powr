import {
  COMPETITION_LIFTS,
  GOALS,
  MOVEMENT_PATTERNS,
  REST_CLASSES,
  TRAINING_STYLES,
} from '@powr/domain';

import {
  LIFT_INTENSITIES,
  PERIODIZATION_MODELS,
  PRESCRIPTION_MODES,
  PROGRESSION_MODELS,
  SLOT_PRIORITIES,
  SPLITS,
  TRAINEE_LEVELS,
  type TemplateDef,
} from '../types';
import { z } from '../zod';
import { localizedText, muscleId, paramRef, repRange, templateId } from './common';

const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const key = z.string().regex(KEY, 'Keys look like upper-a or upper-a.press');

/** Half points allowed (PLN-07). Bands: RIR 0–5, RPE 5–10. */
const halfPointRange = (min: number, max: number) =>
  z
    .tuple([z.number().min(min).max(max), z.number().min(min).max(max)])
    .refine(([low, high]) => low <= high, 'A range is [min, max] with min ≤ max')
    .refine(
      (range) => range.every((value) => Number.isInteger(value * 2)),
      'Use whole or half points',
    );

const effort = z.union([
  z.strictObject({ rir: halfPointRange(0, 5) }),
  z.strictObject({ rpe: halfPointRange(5, 10) }),
]);

const slot = z
  .strictObject({
    key,
    pattern: z.enum(MOVEMENT_PATTERNS),
    targets: z.array(muscleId).min(1),
    priority: z.enum(SLOT_PRIORITIES),
    lift: z.enum(COMPETITION_LIFTS).exactOptional(),
    allowVariants: z.boolean().exactOptional(),
    intensity: z.enum(LIFT_INTENSITIES).exactOptional(),
    goal: z.enum(GOALS),
    mode: z.enum(PRESCRIPTION_MODES),
    repRange: repRange.exactOptional(),
    effort: effort.exactOptional(),
    rest: z.enum(REST_CLASSES).exactOptional(),
    backoff: z.strictObject({ repRange, effort }).exactOptional(),
  })
  .refine((s) => s.allowVariants === undefined || s.lift !== undefined, {
    path: ['allowVariants'],
    error: 'allowVariants needs a lift',
  })
  .refine((s) => s.intensity === undefined || s.lift !== undefined, {
    path: ['intensity'],
    error: 'intensity describes a competition-lift slot',
  })
  .refine((s) => s.backoff === undefined || s.mode === 'topBackoff', {
    path: ['backoff'],
    error: 'Only topBackoff slots have back-off sets',
  });

/** One file of data/templates (PRD §7.4, PLN-02). Constraint checks (PLN-01) come with M2. */
export const templateDefSchema = z
  .strictObject({
    id: templateId,
    name: localizedText(60),
    description: localizedText(300),
    style: z.enum(TRAINING_STYLES),
    daysPerWeek: z.int().min(2).max(6),
    split: z.enum(SPLITS),
    levels: z.array(z.enum(TRAINEE_LEVELS)).min(1),
    default: z.boolean(),
    periodization: z.enum(PERIODIZATION_MODELS),
    progression: z.strictObject({
      main: z.enum(PROGRESSION_MODELS),
      accessory: z.enum(PROGRESSION_MODELS),
      novice: z.enum(PROGRESSION_MODELS),
    }),
    mesocycle: z.strictObject({
      accumulationWeeks: z.int().min(3).max(8),
      deloadWeeks: z.literal(1),
      deloadRule: paramRef,
    }),
    days: z.array(
      z.strictObject({ key, name: localizedText(60), slots: z.array(slot).min(1).max(10) }),
    ),
  })
  .refine((template) => template.days.length === template.daysPerWeek, {
    path: ['days'],
    error: 'A template has one day per training day of the week',
  }) satisfies z.ZodType<TemplateDef>;
