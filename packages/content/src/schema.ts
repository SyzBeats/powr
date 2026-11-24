import {
  COMPETITION_LIFTS,
  CREDIT_VALUES,
  CURVE_CLASSES,
  EXERCISE_STATUSES,
  GOALS,
  LOAD_TYPES,
  MAPPING_EVIDENCE,
  MECHANICS,
  MOVEMENT_PATTERNS,
  OVERLOAD_SUITABILITY,
  REST_CLASSES,
  isContentExerciseId,
  isEquipmentId,
  isMuscleId,
  isSourceId,
  type ExerciseDef,
} from '@powr/domain';

import { z } from './zod';

const localizedText = (max: number) => z.strictObject({ en: z.string().min(1).max(max) });

const exerciseId = z
  .string()
  .refine(isContentExerciseId, 'Content exercise IDs look like ex.some-name');
const muscleId = z.string().refine(isMuscleId, 'Muscle IDs look like mu.quads or mu.quads.vasti');
const equipmentId = z.string().refine(isEquipmentId, 'Equipment IDs look like eq.some-name');
const sourceId = z.string().refine(isSourceId, 'Source IDs look like src.kubo2019');

// Plain arrays and refinements instead of z.tuple and z.literal: the schema still sits on the
// startup path (TD-17), and these reuse Zod code the entry chunk already contains.
const repRange = z.array(z.number()).refine((range): range is [number, number] => {
  const [min = 0, max = 0] = range;
  return range.length === 2 && range.every(Number.isInteger) && 1 <= min && min <= max;
}, 'A rep range is [min, max]: whole numbers, 1 ≤ min ≤ max');
const oneOf = <T extends number>(values: readonly T[], message: string) =>
  z.number().refine((value): value is T => (values as readonly number[]).includes(value), message);

/** The full `ExerciseDef` (technical concept §5.6). Content lint rules (§8.12) come on top. */
export const exerciseDefSchema = z.strictObject({
  id: exerciseId,
  name: localizedText(120),
  synonyms: z.array(z.string().min(1)),
  pattern: z.enum(MOVEMENT_PATTERNS),
  mechanics: z.enum(MECHANICS),
  competitionLift: z.enum(COMPETITION_LIFTS).exactOptional(),
  variantOf: exerciseId.exactOptional(),
  substitutionGroups: z.array(z.string().min(1)),
  equipment: z.strictObject({
    allOf: z.array(equipmentId),
    anyOf: z.array(z.array(equipmentId).min(1)),
  }),
  muscles: z
    .array(
      z.strictObject({
        muscle: muscleId,
        credit: oneOf(CREDIT_VALUES, 'A credit is 1, 0.5, 0.25 or 0'),
        evidence: z.enum(MAPPING_EVIDENCE),
        source: sourceId,
      }),
    )
    .min(1),
  load: z.strictObject({
    type: z.enum(LOAD_TYPES),
    curveClass: z.enum(CURVE_CLASSES),
    unilateral: z.boolean(),
    bodyweightLoaded: z.boolean(),
    increment: z
      .strictObject({ value: z.number().positive(), unit: z.enum(['kg', 'lb']) })
      .exactOptional(),
  }),
  defaults: z.strictObject({
    repRange: z.record(z.enum(GOALS), repRange),
    restClass: z.enum(REST_CLASSES),
    tempo: z.string().min(1),
    fixedRom: z.boolean(),
    stretchEmphasis: z.boolean(),
  }),
  ranking: z.strictObject({
    overloadSuitability: oneOf(OVERLOAD_SUITABILITY, 'Overload suitability is 0, 1, 2 or 3'),
    subRegions: z.array(muscleId).exactOptional(),
  }),
  cues: z.array(localizedText(140)),
  custom: z.boolean(),
  status: z.enum(EXERCISE_STATUSES),
  replacedBy: exerciseId.exactOptional(),
});

/** Validates one content exercise and returns it with its branded domain types. */
export function parseExerciseDef(input: unknown): ExerciseDef {
  return exerciseDefSchema.parse(input);
}
