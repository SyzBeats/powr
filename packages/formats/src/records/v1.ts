import { SET_LIMITS, isLocalDate, toKg } from '@powr/domain';

import { z } from '../zod';

const MAX_EPOCH_MS = 8.64e15;
const MAX_OFFSET_MIN = 18 * 60;

const idSchema = z.string().min(1).max(64);
const localDateSchema = z.string().refine(isLocalDate, 'Expected YYYY-MM-DD');

const instantTzSchema = z.strictObject({
  epochMs: z.number().int().min(0).max(MAX_EPOCH_MS),
  offsetMin: z.number().int().min(-MAX_OFFSET_MIN).max(MAX_OFFSET_MIN),
  zone: z.string().min(1).max(64),
});

const massSchema = z
  .strictObject({ value: z.number().finite(), unit: z.enum(['kg', 'lb']) })
  .refine((mass) => {
    const kg = toKg(mass);
    return kg >= SET_LIMITS.loadMinKg && kg <= SET_LIMITS.loadMaxKg;
  }, 'Load out of range');

const versionStampSchema = z.strictObject({
  engine: z.string().min(1).max(64),
  rules: z.string().min(1).max(64),
  content: z.string().min(1).max(64),
});

export const metaRecordSchema = z.strictObject({
  key: z.string().min(1).max(64),
  value: z.json(),
});

export const settingsRecordSchema = z.strictObject({
  id: z.literal('me'),
  theme: z.enum(['light', 'dark', 'system']),
});

export const sessionRecordSchema = z.strictObject({
  id: idSchema,
  localDate: localDateSchema,
  startedAt: instantTzSchema,
  endedAt: instantTzSchema.exactOptional(),
  status: z.enum(['active', 'finished', 'partial', 'discarded']),
  versions: versionStampSchema,
});

export const setRecordSchema = z.strictObject({
  id: idSchema,
  sessionId: idSchema,
  exerciseId: z.string().regex(/^(ex|cx)\.[a-z0-9-]{1,80}$/),
  index: z.number().int().min(0).max(999),
  type: z.enum(['warmup', 'working', 'top', 'backoff', 'amrap', 'timed']),
  load: massSchema.nullable(),
  reps: z.number().int().min(0).max(SET_LIMITS.repsMax).nullable(),
  effort: z.strictObject({
    rir: z
      .number()
      .min(0)
      .max(SET_LIMITS.rirMax)
      .refine((rir) => Number.isInteger(rir * 2), 'RIR steps are 0.5')
      .nullable(),
    source: z.enum(['entered', 'none']),
  }),
  state: z.enum(['done', 'skipped']),
  performedAt: instantTzSchema,
  localDate: localDateSchema,
});
