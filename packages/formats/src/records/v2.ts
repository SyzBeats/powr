// dataVersion 2 record schemas (M2): the onboarding and planning tables; settings gains optional
// fields (expand → migrate → contract, §8.2.3). Amended by M3a while version 2 was unreleased:
// sessions and sets gain the session core (slots, planned sets, cursor, timer, readiness, undo),
// the raw table `readiness` and the settings' `session` preferences; v1 sessions get the empty
// session-core fields in the 1 → 2 migration. Strict objects, range-checked numbers and
// length-limited strings (§8.3.5).
import {
  ADJUSTMENT_KINDS,
  ADJUSTMENT_NOTES,
  CREDIT_VALUES,
  CURVE_CLASSES,
  EXERCISE_STATUSES,
  LOAD_TYPES,
  MAPPING_EVIDENCE,
  MEASUREMENT_SITES,
  MECHANICS,
  REST_CLASSES,
  SETUP_FIELDS,
  SESSION_CHANGE_KINDS,
  SESSION_STATUSES,
  SET_LIMITS,
  SET_TYPES,
  SLOT_ORIGINS,
  TIMER_KINDS,
  ROUNDING_MODES,
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
import { GUARDRAIL_KINDS } from '@powr/domain/session';

import { findUnsafeJson } from '../json';
import { z } from '../zod';
import {
  idSchema,
  instantTzSchema,
  localDateSchema,
  massSchema,
  metaRecordSchema,
  setRecordSchema as v1SetRecordSchema,
  versionStampSchema,
} from './v1';

export { metaRecordSchema };

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
  /** EXL-08 (M4a): hidden exercises; absent in profiles written before M4a. */
  hiddenExercises: z.array(exerciseIdSchema).max(500).exactOptional(),
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

/** M3a: the session core's preferences (TMR-01/07, RDY-01, WKT-16, SET-05, PRG-03, WKT-11). */
const sessionSettingsSchema = z.strictObject({
  restAutoStart: z.boolean().exactOptional(),
  restMode: z.enum(['countdown', 'countup']).exactOptional(),
  readinessCheckIn: z.boolean().exactOptional(),
  hintsOff: z.array(z.enum(GUARDRAIL_KINDS)).max(GUARDRAIL_KINDS.length).exactOptional(),
  rounding: z.enum(ROUNDING_MODES).exactOptional(),
  exercises: z
    .array(
      z.strictObject({
        exerciseId: exerciseIdSchema,
        manual: z.boolean().exactOptional(),
        restAutoStart: z.boolean().exactOptional(),
        perSide: z.boolean().exactOptional(),
      }),
    )
    .max(500)
    .exactOptional(),
});

export const settingsRecordSchema = z.strictObject({
  id: z.literal('me'),
  theme: z.enum(['light', 'dark', 'system']),
  /** M3a session preferences; absent = the defaults. */
  session: sessionSettingsSchema.exactOptional(),
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
  /**
   * Alerts and workout display (M3t; SET-03 pre-alert, its timing and 3-2-1, SET-04 sound,
   * volume and vibration, SET-10 keep screen on, §8.8.4 the "Resting – ends at …" notification).
   * Absent = the app's defaults; the app writes the whole object on every change. M3b added
   * `preAlertSeconds` (product-owner decision 2026-11-24: 5, 10 or 15 s; unreleased v2 amended);
   * M4v added the optional timed-set and tempo switches below (unreleased v2 amended again).
   */
  /**
   * M4a insight preferences: the streak grace (MOT-03, A-07), the freestyle weekly session target
   * (MOT-03), the measurement sites shown (BOD-03), the score source and division (ANL-07).
   * Absent = the defaults.
   */
  insights: z
    .strictObject({
      streakGrace: z.boolean().exactOptional(),
      weeklySessionTarget: z.number().int().min(1).max(14).nullable().exactOptional(),
      measurementSites: z
        .array(z.enum(MEASUREMENT_SITES))
        .max(MEASUREMENT_SITES.length)
        .exactOptional(),
      scoreSource: z.enum(['e1rm', 'tested']).exactOptional(),
      division: z.enum(MEET_DIVISIONS).exactOptional(),
    })
    .exactOptional(),
  /**
   * M5d backup reminders (DAT-08, TD-57): the cadence in days, or null for off. Absent = the
   * default: 14 days, or 7 while the browser has not protected the storage (DAT-03). The
   * session trigger (8 new workouts) follows the same switch. Unreleased v2 amended.
   */
  backup: z
    .strictObject({
      reminderDays: z.union([z.literal(7), z.literal(14), z.literal(30)]).nullable(),
    })
    .exactOptional(),
  /**
   * M5s training preferences (SET-05, unreleased v2 amended): effort shown and entered as RIR or
   * RPE (RPE = 10 − RIR), the RIR entry as chips or decimal steps, and warm-up sets generated at
   * the start of a workout. Absent = RIR, chips, warm-ups on.
   */
  training: z
    .strictObject({
      effortScale: z.enum(['rir', 'rpe']).exactOptional(),
      rirInput: z.enum(['chips', 'decimal']).exactOptional(),
      warmups: z.boolean().exactOptional(),
    })
    .exactOptional(),
  /**
   * M5s workout display (SET-10, unreleased v2 amended): larger logging controls and the PR and
   * streak celebrations (which also follow the system's reduced-motion setting). Absent = normal
   * controls, celebrations on.
   */
  display: z
    .strictObject({
      largeControls: z.boolean().exactOptional(),
      celebrations: z.boolean().exactOptional(),
    })
    .exactOptional(),
  alerts: z
    .strictObject({
      sound: z.boolean(),
      /** In-app volume as gain, 0–1 (TMR-05). */
      volume: z.number().min(0).max(1),
      vibration: z.boolean(),
      preAlert: z.boolean(),
      /** How long before the end the pre-alert fires (SET-03). */
      preAlertSeconds: z.union([z.literal(5), z.literal(10), z.literal(15)]),
      countdown: z.boolean(),
      restingNotice: z.boolean(),
      keepScreenOn: z.boolean(),
      /*
       * M4v (TMR-09, TMR-10; TD-48, TD-39), optional so that stored records stay valid; absent
       * means off. A 3-2-1 lead-in before a timed set, the set timer stopping itself at the
       * target, and the tempo metronome's control on the session screen.
       */
      setTimerLeadIn: z.boolean().exactOptional(),
      setTimerAutoStop: z.boolean().exactOptional(),
      tempoCues: z.boolean().exactOptional(),
    })
    .exactOptional(),
});

// --- M3a: the workout session (WKT, TMR, RDY; technical concept §5.6, §8.8.1) ---------------

const keyOf = z.string().min(1).max(40);
const effortSchema = z.strictObject({
  rir: rirSchema.nullable(),
  source: z.enum(['entered', 'none']),
  openEnded: z.boolean().exactOptional(),
});
const techniqueSchema = z.strictObject({
  kind: z.enum(TECHNIQUE_KINDS),
  units: z.number().int().min(0).max(20).exactOptional(),
});
const repsSchema = z.number().int().min(0).max(SET_LIMITS.repsMax);

/** v1's set record, extended (M3a): the "5+" flag on effort and the session-core fields. */
export const setRecordSchema = v1SetRecordSchema.extend({
  type: z.enum(SET_TYPES),
  effort: effortSchema,
  slotKey: keyOf.exactOptional(),
  setKey: keyOf.exactOptional(),
  technique: techniqueSchema.exactOptional(),
  repsLeft: repsSchema.exactOptional(),
  repsRight: repsSchema.exactOptional(),
  durationMs: z.number().int().min(0).max(86_400_000).exactOptional(),
  flags: z
    .strictObject({
      failure: z.boolean().exactOptional(),
      failedRep: z.boolean().exactOptional(),
      pain: z.boolean().exactOptional(),
    })
    .exactOptional(),
  restBeforeMs: z.number().int().min(0).max(8.64e15).exactOptional(),
  prescription: z
    .strictObject({
      load: massSchema.nullable(),
      reps: repsSchema.nullable(),
      rir: rirSchema.nullable(),
      durationS: z.number().int().min(0).max(3600).exactOptional(),
    })
    .exactOptional(),
  note: z.string().max(NOTE_MAX).exactOptional(),
});

const plannedSetSchema = z.strictObject({
  key: keyOf,
  type: z.enum(SET_TYPES),
  reps: repRangeSchema.nullable(),
  rir: rirRangeSchema.nullable(),
  load: massSchema.nullable(),
  durationS: z.number().int().min(1).max(3600).exactOptional(),
  technique: techniqueSchema.exactOptional(),
  restSeconds: z.number().int().min(0).max(1800).exactOptional(),
});

const sessionExerciseSchema = z.strictObject({
  key: keyOf,
  exerciseId: exerciseIdSchema,
  origin: z.enum(SLOT_ORIGINS),
  planSlotKey: keySchema.exactOptional(),
  substitutedFrom: z
    .strictObject({ exerciseId: exerciseIdSchema, scope: z.enum(['session', 'mesocycle']) })
    .exactOptional(),
  goal: z.enum(GOALS),
  priority: z.enum(SLOT_PRIORITIES),
  progression: z.enum([...PROGRESSION_MODELS, 'manual']),
  prescription: prescriptionSchema.nullable(),
  sets: z.array(plannedSetSchema).max(60),
  restSeconds: z.number().int().min(0).max(1800).nullable(),
  loadPct: rangeSchema(0, 150).exactOptional(),
  lift: z.enum(COMPETITION_LIFTS).exactOptional(),
  intensity: z.enum(LIFT_INTENSITIES).exactOptional(),
  note: z.string().max(NOTE_MAX).exactOptional(),
  skipped: z.boolean(),
  perSide: z.boolean().exactOptional(),
});

/** The shared timer contract (§8.8.1); `softMinMs` and `slotKey` are M3a's optional fields. */
const timerSchema = z.strictObject({
  id: idSchema,
  kind: z.enum(TIMER_KINDS),
  mode: z.enum(['countdown', 'countup']),
  startedAtEpochMs: z.number().int().min(0).max(8.64e15),
  targetMs: z.number().int().min(0).max(86_400_000),
  adjustMs: z.number().int().min(-86_400_000).max(86_400_000),
  fired: z.strictObject({
    preAlert: z.boolean().exactOptional(),
    end: z.boolean().exactOptional(),
  }),
  softMinMs: z.number().int().min(0).max(86_400_000).exactOptional(),
  slotKey: keyOf.exactOptional(),
});

const sessionCoreShape = {
  id: idSchema,
  localDate: localDateSchema,
  startedAt: instantTzSchema,
  endedAt: instantTzSchema.exactOptional(),
  status: z.enum(SESSION_STATUSES),
  versions: versionStampSchema,
  origin: z.enum(['planned', 'freestyle', 'repeat']),
  plannedSessionId: idSchema.exactOptional(),
  plannedAdjustments: z
    .array(z.enum(ADJUSTMENT_KINDS))
    .max(ADJUSTMENT_KINDS.length)
    .exactOptional(),
  repeatOf: idSchema.exactOptional(),
  backdated: z.boolean().exactOptional(),
  equipmentProfileId: idSchema.nullable(),
  exercises: z.array(sessionExerciseSchema).max(40),
  groups: z
    .array(
      z.strictObject({
        key: keyOf,
        kind: z.enum(['superset', 'circuit']),
        slotKeys: z.array(keyOf).min(2).max(10),
      }),
    )
    .max(20),
  cursor: z.strictObject({ slotKey: keyOf, setKey: keyOf }).nullable(),
  timer: timerSchema.nullable(),
  note: z.string().max(NOTE_MAX).exactOptional(),
  readiness: z
    .strictObject({
      status: z.enum(['done', 'skipped']),
      entryId: idSchema.exactOptional(),
      flag: z.enum(['insufficientData', 'none', 'low', 'modify']).exactOptional(),
      composite: z.number().min(-100).max(100).nullable().exactOptional(),
    })
    .nullable(),
  changes: z
    .array(
      z.strictObject({
        kind: z.enum(SESSION_CHANGE_KINDS),
        slotKeys: z.array(keyOf).max(40),
        rirAdd: z.number().min(0).max(10).exactOptional(),
        dropSets: z.number().int().min(0).max(20).exactOptional(),
        loadPct: rangeSchema(0, 150).exactOptional(),
        setsPct: rangeSchema(0, 150).exactOptional(),
        daysOff: z.number().int().min(0).max(100_000).exactOptional(),
        calibrate: z.boolean().exactOptional(),
      }),
    )
    .max(40),
  revision: z.number().int().min(0),
};

const sessionCoreSchema = z.strictObject(sessionCoreShape);

export const sessionRecordSchema = z.strictObject({
  ...sessionCoreShape,
  /** WKT-12: the last undoable event's snapshot (single level). */
  undo: z
    .strictObject({
      token: z.string().min(1).max(40),
      expiresAtEpochMs: z.number().int().min(0).max(8.64e15),
      session: sessionCoreSchema,
      restoreSets: z.array(setRecordSchema).max(100),
      removeSetIds: z.array(idSchema).max(100),
    })
    .nullable(),
});

const scale5 = z.number().int().min(1).max(5).nullable().exactOptional();

/** RDY-01 check-ins (raw table `readiness`). */
export const readinessRecordSchema = z.strictObject({
  id: idSchema,
  localDate: localDateSchema,
  recordedAt: instantTzSchema,
  sessionId: idSchema.exactOptional(),
  items: z.strictObject({
    sleepHours: z
      .number()
      .min(0)
      .max(24)
      .refine((hours) => Number.isInteger(hours * 4), 'Sleep hours steps are 0.25')
      .nullable()
      .exactOptional(),
    sleepQuality: scale5,
    energy: scale5,
    soreness: scale5,
    stress: scale5,
    motivation: scale5,
    prs: z.number().int().min(0).max(10).nullable().exactOptional(),
  }),
  soreMuscles: z
    .array(z.strictObject({ muscle: muscleIdSchema, rating: z.number().int().min(1).max(5) }))
    .max(40)
    .exactOptional(),
});

// --- M4a: custom exercises (EXL-04), exercise user data (EXL-09), measurements (BOD-03) -----

const customExerciseIdSchema = z.string().regex(/^cx\.[a-z0-9-]{1,80}$/);
const itemIdSchema = z.union([equipmentIdSchema, customEquipmentIdSchema]);
const sourceIdSchema = z
  .string()
  .regex(/^src\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)
  .max(80);
const textSchema = (max: number) => z.string().min(1).max(max);
const goalRangeSchema = z
  .tuple([z.number().int().min(1).max(100), z.number().int().min(1).max(100)])
  .refine(([low, high]) => low <= high, 'A range is [min, max]');

/** A user-defined exercise: an `ExerciseDef` with `custom: true` (EXL-04, §8.2.2). */
export const customExerciseRecordSchema = z.strictObject({
  id: customExerciseIdSchema,
  name: localizedTextSchema,
  synonyms: z.array(textSchema(NAME_MAX)).max(10),
  pattern: z.enum(MOVEMENT_PATTERNS),
  mechanics: z.enum(MECHANICS),
  variantOf: exerciseIdSchema.exactOptional(),
  substitutionGroups: z.array(z.string().regex(/^sg\.[a-z0-9-]{1,60}$/)).max(10),
  equipment: z.strictObject({
    allOf: z.array(itemIdSchema).max(30),
    anyOf: z.array(z.array(itemIdSchema).min(1).max(30)).max(10),
  }),
  muscles: z
    .array(
      z.strictObject({
        muscle: muscleIdSchema,
        credit: z.union(CREDIT_VALUES.map((value) => z.literal(value))),
        evidence: z.enum(MAPPING_EVIDENCE),
        source: sourceIdSchema,
      }),
    )
    .min(1)
    .max(20),
  load: z.strictObject({
    type: z.enum(LOAD_TYPES),
    curveClass: z.enum(CURVE_CLASSES),
    unilateral: z.boolean(),
    bodyweightLoaded: z.boolean(),
    increment: massSchema.exactOptional(),
  }),
  defaults: z.strictObject({
    repRange: z.strictObject({ hypertrophy: goalRangeSchema, strength: goalRangeSchema }),
    restClass: z.enum(REST_CLASSES),
    tempo: z.string().regex(/^\d{1,2}-\d{1,2}-(?:X|\d{1,2})-\d{1,2}$/),
    fixedRom: z.boolean(),
    stretchEmphasis: z.boolean(),
  }),
  ranking: z.strictObject({
    overloadSuitability: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    subRegions: z.array(muscleIdSchema).max(10).exactOptional(),
  }),
  cues: z.array(z.strictObject({ en: textSchema(140) })).max(6),
  custom: z.literal(true),
  userRated: z.boolean().exactOptional(),
  status: z.enum(EXERCISE_STATUSES),
  replacedBy: exerciseIdSchema.exactOptional(),
  createdAt: instantTzSchema,
  updatedAt: instantTzSchema,
  copiedFrom: exerciseIdSchema.exactOptional(),
});

/** Per-exercise user data (EXL-09 setup memory, ANL-04 training max), keyed by exercise. */
export const exerciseUserDataRecordSchema = z.strictObject({
  exerciseId: exerciseIdSchema,
  setup: z
    .array(
      z.strictObject({
        field: z.enum(SETUP_FIELDS),
        label: textSchema(40).exactOptional(),
        value: textSchema(60),
      }),
    )
    .max(12),
  note: z.string().max(NOTE_MAX).exactOptional(),
  trainingMax: massSchema
    .refine((mass) => mass.value > 0, 'A training max is positive')
    .exactOptional(),
  updatedAt: instantTzSchema,
});

/** A body measurement (BOD-03): circumferences in cm or in, skinfolds in mm. */
export const measurementRecordSchema = z
  .strictObject({
    id: idSchema,
    site: z.enum(MEASUREMENT_SITES),
    localDate: localDateSchema,
    measuredAt: instantTzSchema,
    value: z.number().positive().max(500),
    unit: z.enum(['cm', 'in', 'mm']),
    note: z.string().max(NOTE_MAX).exactOptional(),
  })
  .refine(
    (entry) => entry.site.startsWith('skinfold') === (entry.unit === 'mm'),
    'Skinfolds are in mm, circumferences in cm or in',
  );

/**
 * Parts that several records share, named in the published JSON Schemas (`$defs`, written by
 * `pnpm formats:schemas` into docs/formats/schemas/). Import does not use this list.
 */
export const RECORD_PARTS = {
  prescription: prescriptionSchema,
  planSlot: planSlotSchema,
  planDay: planDaySchema,
  sessionExercise: sessionExerciseSchema,
  sessionCore: sessionCoreSchema,
};
