import {
  COMPETITION_LIFTS,
  CREDIT_VALUES,
  CURVE_CLASSES,
  EXERCISE_STATUSES,
  LOAD_TYPES,
  MAPPING_EVIDENCE,
  MECHANICS,
  MOVEMENT_PATTERNS,
  OVERLOAD_SUITABILITY,
  REST_CLASSES,
  type ExerciseDef,
} from '@powr/domain';

import { z } from '../zod';
import {
  equipmentId,
  exerciseId,
  localizedText,
  mass,
  muscleId,
  repRange,
  sourceId,
  substitutionGroupId,
  synonym,
} from './common';

/** Eccentric–bottom pause–concentric–top pause in seconds; X = maximal intent (TMR-10). */
const TEMPO = /^\d{1,2}-\d{1,2}-(?:X|\d{1,2})-\d{1,2}$/;

/** One cue: a short original sentence (EXL-03, §8.12: ≤ 140 characters). */
const cue = localizedText(140).refine(
  ({ en }) => /^[A-Z0-9]/.test(en) && /[.!]$/.test(en),
  'A cue is a sentence: capital first letter, full stop at the end',
);

/**
 * The full `ExerciseDef` (technical concept §5.6) as authored in data/exercises/*.yaml.
 * Cross-references (equipment, muscles, sources, variants) are checked by the content lint in
 * tools/content-build, which has the whole library and the source registry.
 */
export const exerciseDefSchema = z.strictObject({
  id: exerciseId,
  name: localizedText(80),
  synonyms: z.array(synonym),
  pattern: z.enum(MOVEMENT_PATTERNS),
  mechanics: z.enum(MECHANICS),
  competitionLift: z.enum(COMPETITION_LIFTS).exactOptional(),
  variantOf: exerciseId.exactOptional(),
  substitutionGroups: z.array(substitutionGroupId).min(1),
  equipment: z.strictObject({
    allOf: z.array(equipmentId),
    anyOf: z.array(z.array(equipmentId).min(2, 'An anyOf group offers at least two items')),
  }),
  muscles: z
    .array(
      z.strictObject({
        muscle: muscleId,
        credit: z.literal(CREDIT_VALUES),
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
    increment: mass.exactOptional(),
  }),
  defaults: z.strictObject({
    repRange: z.strictObject({ hypertrophy: repRange, strength: repRange }),
    restClass: z.enum(REST_CLASSES),
    tempo: z.string().regex(TEMPO, 'Tempo looks like 2-0-X-0'),
    fixedRom: z.boolean(),
    stretchEmphasis: z.boolean(),
  }),
  ranking: z.strictObject({
    overloadSuitability: z.literal(OVERLOAD_SUITABILITY),
    subRegions: z.array(muscleId).min(1).exactOptional(),
  }),
  cues: z
    .array(cue)
    .min(3, 'An exercise has 3–6 cues (EXL-03)')
    .max(6, 'An exercise has 3–6 cues (EXL-03)'),
  // Built-in content is never custom (EXL-04) and is active unless retired, so YAML omits both.
  custom: z.literal(false).default(false),
  status: z.enum(EXERCISE_STATUSES).default('active'),
  replacedBy: exerciseId.exactOptional(),
}) satisfies z.ZodType<ExerciseDef>;
