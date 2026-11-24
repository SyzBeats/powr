// dataVersion 2 record schemas (M2): the onboarding and planning tables. meta, sessions and sets
// are unchanged from v1; settings gains optional fields (expand → migrate → contract, §8.2.3).
// Strict objects, range-checked numbers and length-limited strings (§8.3.5).
import {
  ADJUSTMENT_KINDS,
  ADJUSTMENT_NOTES,
  BODY_PHASES,
  BREAK_REASONS,
  COMPETITION_LIFTS,
  GOALS,
  LIFT_INTENSITIES,
  MAX_DISMISSED_ISSUES,
  MEET_DIVISIONS,
  MESOCYCLE_STATUSES,
  MOVEMENT_PATTERNS,
  PERIODIZATION_MODELS,
  PLANNED_SESSION_STATUSES,
  PLAN_STATUSES,
  RPE_FAMILIARITY,
  SEX_OPTIONS,
  SLOT_PRIORITIES,
  SPLITS,
  TARGET_SOURCES,
  TIME_OFF_BANDS,
  TRAINING_AGE_BANDS,
  TRAINING_STYLES,
  WEIGH_IN_TYPES,
  isEquipmentId,
  isMuscleId,
} from '@powr/domain';
import {
  PROGRESSION_MODELS,
  SEX_REFERENCES,
  TECHNIQUE_KINDS,
  TRAINEE_LEVELS,
} from '@powr/domain/rules';

import { findUnsafeJson } from '../json';
import { z } from '../zod';
import {
  idSchema,
  instantTzSchema,
  localDateSchema,
  massSchema,
  metaRecordSchema,
  sessionRecordSchema,
  setRecordSchema,
  versionStampSchema,
} from './v1';

export { metaRecordSchema, sessionRecordSchema, setRecordSchema };

const NAME_MAX = 120;
const NOTE_MAX = 2000;

const keySchema = z.string().min(1).max(64);
const exerciseIdSchema = z.string().regex(/^(ex|cx)\.[a-z0-9-]{1,80}$/);
const muscleIdSchema = z.string().max(64).refine(isMuscleId, 'Expected a muscle ID');
const equipmentIdSchema = z.string().max(80).refine(isEquipmentId, 'Expected an equipment ID');
const customEquipmentIdSchema = z.string().regex(/^ce\.[0-9a-z-]{1,64}$/);
const weekdaySchema = z.number().int().min(1).max(7);
const localizedTextSchema = z.strictObject({ en: z.string().min(1).max(NAME_MAX) });
const lengthSchema = z.strictObject({
  value: z.number().positive().max(300),
  unit: z.enum(['cm', 'in']),
});

const rangeSchema = (min: number, max: number) =>
  z
    .strictObject({ min: z.number().min(min).max(max), max: z.number().min(min).max(max) })
    .refine((range) => range.min <= range.max, 'min must not exceed max');
const pairSchema = (inner: z.ZodNumber) =>
  z.tuple([inner, inner]).refine(([low, high]) => low <= high, 'A range is [min, max]');
const repRangeSchema = pairSchema(z.number().int().min(0).max(1000));
const rirSchema = z
  .number()
  .min(0)
  .max(10)
  .refine((rir) => Number.isInteger(rir * 2), 'RIR steps are 0.5');
const rirRangeSchema = pairSchema(rirSchema);
const setsSchema = z.number().int().min(1).max(20);
const setBlock = { sets: setsSchema, repRange: repRangeSchema, rir: rirRangeSchema };

const prescriptionSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('doubleProgression'), ...setBlock }),
  z.strictObject({ mode: z.literal('rpe'), ...setBlock }),
  z.strictObject({
    mode: z.literal('topBackoff'),
    top: z.strictObject({ repRange: repRangeSchema, rir: rirRangeSchema }),
    backoff: z.strictObject({ ...setBlock, sets: z.number().int().min(0).max(20) }),
  }),
  z.strictObject({
    mode: z.literal('percent'),
    sets: setsSchema,
    repRange: repRangeSchema,
    pct: z.number().positive().max(120),
    of: z.enum(['e1rm', 'trainingMax']),
  }),
  z.strictObject({
    mode: z.literal('fixed'),
    sets: setsSchema,
    reps: z.number().int().min(1).max(1000),
    load: massSchema,
  }),
  z.strictObject({
    mode: z.literal('amrap'),
    load: z.union([
      z.strictObject({ pct: z.number().positive().max(120) }),
      z.strictObject({ fixed: massSchema }),
    ]),
    stopAtRir: rirSchema.exactOptional(),
  }),
  z.strictObject({
    mode: z.literal('timed'),
    sets: setsSchema,
    durationS: z.number().int().min(1).max(3600),
  }),
  z.strictObject({
    mode: z.literal('technique'),
    technique: z.enum(TECHNIQUE_KINDS),
    base: z.strictObject(setBlock),
  }),
]);

const planSlotSchema = z.strictObject({
  key: keySchema,
  exerciseId: exerciseIdSchema,
  pattern: z.enum(MOVEMENT_PATTERNS),
  targets: z.array(muscleIdSchema).max(10),
  priority: z.enum(SLOT_PRIORITIES),
  goal: z.enum(GOALS),
  lift: z.enum(COMPETITION_LIFTS).exactOptional(),
  allowVariants: z.boolean().exactOptional(),
  intensity: z.enum(LIFT_INTENSITIES).exactOptional(),
  prescription: prescriptionSchema,
  progression: z.enum(PROGRESSION_MODELS),
  restSeconds: z.number().int().min(0).max(1800),
  loadPct: rangeSchema(0, 150).exactOptional(),
  locked: z.boolean().exactOptional(),
});

const planDaySchema = z.strictObject({
  key: keySchema,
  name: localizedTextSchema,
  weekday: weekdaySchema,
  slots: z.array(planSlotSchema).max(20),
});

const targetSetsSchema = z.number().min(0).max(60);
const muscleTargetsSchema = z
  .array(
    z
      .strictObject({
        muscle: muscleIdSchema,
        sets: targetSetsSchema,
        source: z.enum(TARGET_SOURCES),
        // The full target a time budget lowered (PLN-14); only with source timeBudget.
        full: targetSetsSchema.exactOptional(),
      })
      .refine(
        (target) => (target.source === 'timeBudget') === (target.full !== undefined),
        'full is present exactly when the source is timeBudget',
      ),
  )
  .max(40);

/** PLN-09: dismissed warning keys (rule, subject and the numbers of the plan state). */
const ISSUE_KEY_MAX = 300;

const mesocycleSchema = z.strictObject({
  index: z.number().int().min(0).max(1000),
  startDate: localDateSchema,
  accumulationWeeks: z.number().int().min(1).max(20),
  deloadWeeks: z.number().int().min(0).max(4),
  status: z.enum(MESOCYCLE_STATUSES),
  level: z.enum(TRAINEE_LEVELS),
  days: z.array(planDaySchema).max(7),
  targets: muscleTargetsSchema,
  liftTargets: z
    .array(
      z.strictObject({
        lift: z.enum(COMPETITION_LIFTS),
        heavySets: z.number().int().min(0).max(60),
      }),
    )
    .max(3),
  next: z
    .strictObject({ days: z.array(planDaySchema).max(7), targets: muscleTargetsSchema })
    .exactOptional(),
  deload: z.strictObject({
    postponed: z.boolean(),
    skipped: z.boolean(),
    broughtForward: z.boolean(),
  }),
});

export const planRecordSchema = z.strictObject({
  id: idSchema,
  status: z.enum(PLAN_STATUSES),
  name: localizedTextSchema,
  templateId: z.string().regex(/^tpl\.[a-z0-9-]{1,60}$/),
  style: z.enum(TRAINING_STYLES),
  split: z.enum(SPLITS),
  periodization: z.enum(PERIODIZATION_MODELS),
  equipmentProfileId: idSchema,
  schedule: z.strictObject({
    weekdays: z.array(weekdaySchema).max(7),
    weekStartsOn: weekdaySchema,
    sessionMinutes: z.number().int().min(10).max(300).nullable(),
    startTimes: z
      .array(
        z.strictObject({
          weekday: weekdaySchema,
          time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }),
      )
      .max(7),
  }),
  variety: z.boolean(),
  seed: z.number().int().min(0).max(4_294_967_295),
  mesocycles: z.array(mesocycleSchema).max(200),
  createdAt: instantTzSchema,
  versions: versionStampSchema,
  revision: z.number().int().min(0),
  dismissedIssues: z.array(z.string().min(1).max(ISSUE_KEY_MAX)).max(MAX_DISMISSED_ISSUES),
});

export const plannedSessionRecordSchema = z.strictObject({
  id: idSchema,
  planId: idSchema,
  mesocycleIndex: z.number().int().min(0).max(1000),
  week: z.number().int().min(1).max(30),
  dayKey: keySchema,
  name: localizedTextSchema,
  kind: z.enum(['regular', 'deload']),
  localDate: localDateSchema,
  scheduledDate: localDateSchema,
  status: z.enum(PLANNED_SESSION_STATUSES),
  slots: z.array(planSlotSchema).max(30),
  adjustments: z
    .array(
      z.strictObject({
        kind: z.enum(ADJUSTMENT_KINDS),
        loadPct: rangeSchema(0, 150).exactOptional(),
        setsPct: rangeSchema(0, 150).exactOptional(),
        rirAdd: z.number().min(0).max(10).exactOptional(),
        daysOff: z.number().int().min(0).max(100_000).exactOptional(),
        notes: z.array(z.enum(ADJUSTMENT_NOTES)).max(10),
      }),
    )
    .max(10),
  mergedInto: idSchema.exactOptional(),
  revision: z.number().int().min(0),
});

export const breakRecordSchema = z.strictObject({
  id: idSchema,
  startDate: localDateSchema,
  endDate: localDateSchema.nullable(),
  reason: z.enum(BREAK_REASONS),
  note: z.string().max(NOTE_MAX).exactOptional(),
  createdAt: instantTzSchema,
});

export const profileRecordSchema = z.strictObject({
  id: z.literal('me'),
  displayName: z.string().max(NAME_MAX).exactOptional(),
  units: z.strictObject({
    load: z.enum(['kg', 'lb']),
    bodyweight: z.enum(['kg', 'lb']),
    length: z.enum(['cm', 'in']),
  }),
  sex: z.enum(SEX_OPTIONS),
  referenceSet: z.enum(SEX_REFERENCES).nullable(),
  birthYear: z.number().int().min(1900).max(2100).nullable(),
  height: lengthSchema.nullable(),
  style: z.enum(TRAINING_STYLES),
  phase: z.enum(BODY_PHASES),
  experience: z.strictObject({
    trainingAge: z.enum(TRAINING_AGE_BANDS),
    timeOff: z.enum(TIME_OFF_BANDS),
    rpeFamiliarity: z.enum(RPE_FAMILIARITY),
    recentVolume: z
      .array(z.strictObject({ muscle: muscleIdSchema, sets: z.number().min(0).max(100) }))
      .max(40),
  }),
  levelOverride: z.enum(TRAINEE_LEVELS).nullable(),
  priorities: z.array(muscleIdSchema).max(3),
  avoid: z.strictObject({
    exercises: z.array(exerciseIdSchema).max(500),
    patterns: z.array(z.enum(MOVEMENT_PATTERNS)).max(MOVEMENT_PATTERNS.length),
  }),
  preferredExercises: z.array(exerciseIdSchema).max(500),
  baselines: z
    .array(
      z.strictObject({
        exerciseId: exerciseIdSchema,
        kind: z.enum(['oneRepMax', 'recentSet']),
        load: massSchema,
        reps: z.number().int().min(1).max(100),
        rir: rirSchema.nullable(),
        date: localDateSchema.exactOptional(),
      }),
    )
    .max(20),
  createdAt: instantTzSchema,
  updatedAt: instantTzSchema,
});

export const meetRecordSchema = z.strictObject({
  id: idSchema,
  date: localDateSchema,
  weighIn: z.enum(WEIGH_IN_TYPES).nullable(),
  weightClass: z.string().max(40).nullable(),
  division: z.enum(MEET_DIVISIONS).nullable(),
  federation: z.string().max(NAME_MAX).nullable(),
  createdAt: instantTzSchema,
});

export const bodyweightRecordSchema = z.strictObject({
  id: idSchema,
  localDate: localDateSchema,
  measuredAt: instantTzSchema,
  mass: massSchema.refine((mass) => mass.value > 0, 'A bodyweight is positive'),
  note: z.string().max(NOTE_MAX).exactOptional(),
});

const plateListSchema = z
  .array(
    z.strictObject({
      weight: z.number().positive().max(500),
      pairs: z.number().int().min(1).max(50),
    }),
  )
  .max(30);

export const equipmentProfileRecordSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1).max(NAME_MAX),
  isDefault: z.boolean(),
  presetId: z
    .string()
    .regex(/^preset\.[a-z0-9-]{1,60}$/)
    .exactOptional(),
  items: z.array(equipmentIdSchema).max(200),
  customItems: z
    .array(
      z.strictObject({
        id: customEquipmentIdSchema,
        name: z.string().min(1).max(NAME_MAX),
        increment: massSchema.exactOptional(),
      }),
    )
    .max(100),
  unit: z.enum(['kg', 'lb']),
  bars: z.array(z.strictObject({ item: equipmentIdSchema, weight: massSchema })).max(30),
  plates: plateListSchema,
  microplates: plateListSchema,
  collarWeight: z.number().min(0).max(50),
  dumbbells: z
    .union([
      z.strictObject({ weights: z.array(z.number().positive().max(500)).max(200) }),
      z.strictObject({
        from: z.number().positive().max(500),
        to: z.number().positive().max(500),
        step: z.number().positive().max(100),
      }),
    ])
    .nullable(),
  kettlebells: z.array(z.number().positive().max(200)).max(50),
  stacks: z
    .array(
      z.strictObject({
        item: equipmentIdSchema,
        increment: massSchema,
        addOns: z.array(z.number().positive().max(100)).max(10).exactOptional(),
      }),
    )
    .max(60),
  bands: z
    .array(
      z.strictObject({ label: z.string().min(1).max(60), resistance: massSchema.exactOptional() }),
    )
    .max(30),
});

/**
 * A user's own parameter value (§8.6.3, SET-03). The value is free-form JSON, so it gets the same
 * reserved-key and depth check as meta values before Zod copies it (§8.3.5, TD-22).
 */
const overrideValueSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    const unsafe = findUnsafeJson(value);
    if (unsafe !== null) ctx.addIssue({ code: 'custom', message: unsafe, abort: true });
  })
  .pipe(z.json());

export const settingsRecordSchema = z.strictObject({
  id: z.literal('me'),
  theme: z.enum(['light', 'dark', 'system']),
  /** SET-11; absent = the locale's week start (fallback Monday). */
  weekStart: weekdaySchema.exactOptional(),
  /** SET-03/SET-07 parameter overrides, applied by the rules resolver. */
  overrides: z
    .array(
      z.strictObject({
        paramId: z
          .string()
          .regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/)
          .max(80),
        value: overrideValueSchema,
        exerciseId: exerciseIdSchema.exactOptional(),
      }),
    )
    .max(200)
    .exactOptional(),
});
