import {
  COMPETITION_LIFTS,
  CURVE_CLASSES,
  EVIDENCE_TAGS,
  GOALS,
  MECHANICS,
  MOVEMENT_PATTERNS,
  REST_CLASSES,
  TRAINING_STYLES,
  isSourceId,
} from '@powr/domain';
import { PARAM_UNITS, SEX_REFERENCES, TRAINEE_LEVELS } from '@powr/domain/rules';

import { z } from './zod';

export const evidenceTagSchema = z.enum(EVIDENCE_TAGS);

/** A source registry ID such as `src.kubo2019` (convention: data/sources/README.md). */
export const sourceIdSchema = z
  .string()
  .refine(isSourceId, 'Source IDs look like src.kubo2019 (see data/sources/README.md)');

const list = <T extends z.ZodType>(item: T) => z.array(item).min(1).exactOptional();

/**
 * When a context variant applies (§8.6.2): every key present must match the resolve context; a
 * list matches any of its members. Exercise keys match the exercise in the context.
 */
export const conditionSchema = z
  .strictObject({
    level: list(z.enum(TRAINEE_LEVELS)),
    style: list(z.enum(TRAINING_STYLES)),
    goal: list(z.enum(GOALS)),
    sex: list(z.enum(SEX_REFERENCES)),
    timeSaver: z.boolean().exactOptional(),
    competitionLift: list(z.enum(COMPETITION_LIFTS)),
    restClass: list(z.enum(REST_CLASSES)),
    pattern: list(z.enum(MOVEMENT_PATTERNS)),
    mechanics: list(z.enum(MECHANICS)),
    curveClass: list(z.enum(CURVE_CLASSES)),
  })
  .refine((condition) => Object.keys(condition).length > 0, 'a condition needs at least one key');
export type Condition = z.infer<typeof conditionSchema>;

/**
 * One registry row (§8.6.1, ADR-0012). `value`, variant values and `range` are checked against
 * the parameter's own schema (`PARAM_SCHEMAS`) when the registry is compiled.
 */
export const paramDefSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/),
  value: z.json(),
  /** Unit of the value; compound values name the unit of each part. */
  unit: z.enum(PARAM_UNITS),
  /** Context variants, first match wins (e.g. 4:00 rest for competition squat and deadlift). */
  variants: z
    .array(z.strictObject({ when: conditionSchema, value: z.json() }))
    .min(1)
    .exactOptional(),
  /** Allowed range for user values; values outside are accepted with a note (§8.6.3). */
  range: z
    .strictObject({ min: z.json().exactOptional(), max: z.json().exactOptional() })
    .exactOptional(),
  /** Warning thresholds and notes the UI shows (e.g. never below 2:00 on competition lifts). */
  guard: z.record(z.string(), z.json()).exactOptional(),
  evidence: z.array(evidenceTagSchema).min(1),
  sources: z.array(sourceIdSchema).min(1),
  ebRef: z.string().min(1),
  /** false for preprint-derived values and POWR design choices: "preliminary value" (E-2). */
  verified: z.boolean(),
  /** E-5: an unverified row that must not be resolvable at all. */
  blockedUntilVerified: z.boolean().exactOptional(),
  userOverridable: z.boolean(),
  /** Message ID of the parameter name; defaults to `params.<id>`. */
  label: z.string().min(1).exactOptional(),
  /** Release that introduced the row. */
  since: z.string().min(1).default('mvp'),
  /** Caveats for maintainers and the "How POWR decides" page. */
  note: z.string().min(1).exactOptional(),
});
export type ParamDef = z.output<typeof paramDefSchema>;
