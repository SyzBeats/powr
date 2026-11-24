import * as fc from 'fast-check';

import type {
  BodyweightEntry,
  BreakId,
  CustomEquipmentId,
  EquipmentId,
  EquipmentProfile,
  ExerciseId,
  IsoWeekday,
  LocalDate,
  LoggedSet,
  MeetInfo,
  MuscleId,
  Plan,
  PlanDay,
  PlanId,
  PlannedSession,
  PlannedSessionId,
  PlanSlot,
  Prescription,
  PresetId,
  Profile,
  Session,
  SessionId,
  SetId,
  TemplateId,
  TrainingBreak,
} from '@powr/domain';

import type { MetaRecord, RawTables, SettingsRecord } from '../src';

const ZONES = ['Europe/Zurich', 'America/New_York', 'Asia/Kolkata', 'UTC'];
const EXERCISES = ['ex.barbell-back-squat', 'ex.barbell-bench-press', 'cx.0190a6f2-custom'];

const instantTz = fc.record({
  epochMs: fc.integer({ min: 0, max: 4_102_444_800_000 }),
  offsetMin: fc.integer({ min: -720, max: 840 }),
  zone: fc.constantFrom(...ZONES),
});

const localDate = fc
  .record({
    year: fc.integer({ min: 2000, max: 2099 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) =>
    [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-'),
  ) as fc.Arbitrary<LocalDate>;

const versions = fc.record({
  engine: fc.constant('0.0.0'),
  rules: fc.constant('0.0.0+m0'),
  content: fc.constant('0.0.0+m0'),
});

const session = (id: string, status: Session['status']): fc.Arbitrary<Session> =>
  fc
    .record({
      localDate,
      startedAt: instantTz,
      endedAt: fc.option(instantTz, { nil: undefined }),
      versions,
    })
    .map(({ endedAt, ...rest }) => ({
      id: id as SessionId,
      status,
      ...rest,
      ...(endedAt && status !== 'active' ? { endedAt } : {}),
    }));

const loggedSet = (id: string, sessionId: string): fc.Arbitrary<LoggedSet> =>
  fc.record({
    id: fc.constant(id as SetId),
    sessionId: fc.constant(sessionId as SessionId),
    exerciseId: fc.constantFrom(...EXERCISES) as fc.Arbitrary<ExerciseId>,
    index: fc.integer({ min: 0, max: 30 }),
    type: fc.constantFrom('warmup', 'working', 'top', 'backoff', 'amrap', 'timed'),
    load: fc.option(
      fc.record({
        value: fc.integer({ min: -400, max: 3600 }).map((quarters) => quarters / 4),
        unit: fc.constantFrom('kg', 'lb'),
      }),
      { nil: null },
    ),
    reps: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: null }),
    effort: fc.oneof(
      fc.record({
        rir: fc.integer({ min: 0, max: 20 }).map((half) => half / 2),
        source: fc.constant('entered' as const),
      }),
      fc.constant({ rir: null, source: 'none' as const }),
    ),
    state: fc.constantFrom('done', 'skipped'),
    performedAt: instantTz,
    localDate,
  });

/** The keys a backup never contains (§8.3.5); fast-check also generates them on its own. */
const RESERVED = ['__proto__', 'constructor', 'prototype'] as const;

/** Independent oracle for the tests: does a JSON value hold a reserved key at any depth? */
export function hasReservedKey(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasReservedKey);
  return Object.entries(value).some(
    ([key, nested]) => (RESERVED as readonly string[]).includes(key) || hasReservedKey(nested),
  );
}

/**
 * Any JSON value; half of all object keys are reserved ones, at any depth. Round-tripped
 * through JSON once: JSON has no -0 or undefined, and `JSON.parse` makes `__proto__` an own key.
 */
const hostileJsonValue: fc.Arbitrary<MetaRecord['value']> = fc
  .letrec((tie) => ({
    value: fc.oneof(
      { maxDepth: 3, depthIdentifier: 'json' },
      fc.constant(null),
      fc.boolean(),
      fc.integer(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.string(),
      fc.array(tie('value'), { maxLength: 3, depthIdentifier: 'json' }),
      fc.dictionary(fc.oneof(fc.string(), fc.constantFrom(...RESERVED)), tie('value'), {
        maxKeys: 3,
        depthIdentifier: 'json',
      }),
    ),
  }))
  .value.map((value): MetaRecord['value'] => JSON.parse(JSON.stringify(value)));

const metaRecordsOf = (values: fc.Arbitrary<MetaRecord['value']>): fc.Arbitrary<MetaRecord[]> =>
  fc.uniqueArray(
    fc.record({ key: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9.]{0,30}$/), value: values }),
    { selector: (record) => record.key, maxLength: 5 },
  );

/** What the app can store and back up: any JSON value without a reserved key. */
const metaRecords = metaRecordsOf(
  fc
    .jsonValue({ maxDepth: 2 })
    .map((value): MetaRecord['value'] => JSON.parse(JSON.stringify(value)))
    .filter((value) => !hasReservedKey(value)),
);

const settingsRecords: fc.Arbitrary<SettingsRecord[]> = fc
  .option(
    fc.record({
      id: fc.constant('me' as const),
      theme: fc.constantFrom('light', 'dark', 'system'),
    }),
    { nil: null },
  )
  .map((settings) => (settings ? [settings] : []));

/** Valid raw tables: unique IDs, sets reference existing sessions, at most one active session. */
export const rawTables: fc.Arbitrary<RawTables> = tablesWith(metaRecords);

/** Like {@link rawTables}, but meta values may hold reserved keys (a crafted file's content). */
export const hostileRawTables: fc.Arbitrary<RawTables> = tablesWith(
  metaRecordsOf(hostileJsonValue),
);

function tablesWith(meta: fc.Arbitrary<MetaRecord[]>): fc.Arbitrary<RawTables> {
  return fc
    .record({
      sessionIds: fc.uniqueArray(fc.uuid(), { maxLength: 6 }),
      activeIndex: fc.option(fc.nat(), { nil: null }),
      setCount: fc.nat({ max: 25 }),
    })
    .chain(({ sessionIds, activeIndex, setCount }) => {
      const statuses = sessionIds.map((_, index): Session['status'] =>
        activeIndex !== null && index === activeIndex % sessionIds.length ? 'active' : 'finished',
      );
      const sessions = fc.tuple(
        ...sessionIds.map((id, index) => session(id, statuses[index] ?? 'finished')),
      );
      const sets =
        sessionIds.length === 0
          ? fc.constant([] as LoggedSet[])
          : fc
              .tuple(
                fc.uniqueArray(fc.uuid(), { minLength: setCount, maxLength: setCount }),
                fc.array(fc.constantFrom(...sessionIds), {
                  minLength: setCount,
                  maxLength: setCount,
                }),
              )
              .chain(([setIds, owners]) =>
                fc.tuple(...setIds.map((setId, index) => loggedSet(setId, owners[index] ?? ''))),
              );
      return fc
        .record({ meta, settings: settingsRecords, sessions, sets, planning: planningTables })
        .map(({ planning, ...core }) => ({ ...core, ...planning }));
    });
}

// --- dataVersion 2 tables (M2): valid records with consistent references ------------------

const mass = (min: number, max: number) =>
  fc.record({
    value: fc.integer({ min: min * 4, max: max * 4 }).map((quarters) => quarters / 4),
    unit: fc.constantFrom('kg' as const, 'lb' as const),
  });

const rirRange = fc
  .tuple(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 4 }))
  .map(([low, span]) => [low / 2, (low + span) / 2] as const);
const repRange = fc
  .tuple(fc.integer({ min: 1, max: 15 }), fc.integer({ min: 0, max: 10 }))
  .map(([low, span]) => [low, low + span] as const);

const prescription: fc.Arbitrary<Prescription> = fc.oneof(
  fc.record({
    mode: fc.constantFrom('doubleProgression' as const, 'rpe' as const),
    sets: fc.integer({ min: 1, max: 6 }),
    repRange,
    rir: rirRange,
  }),
  fc.record({
    mode: fc.constant('topBackoff' as const),
    top: fc.record({ repRange, rir: rirRange }),
    backoff: fc.record({ sets: fc.integer({ min: 0, max: 5 }), repRange, rir: rirRange }),
  }),
  fc.record({
    mode: fc.constant('timed' as const),
    sets: fc.integer({ min: 1, max: 5 }),
    durationS: fc.integer({ min: 10, max: 120 }),
  }),
);

const planSlot = (key: string): fc.Arbitrary<PlanSlot> =>
  fc
    .record({
      exerciseId: fc.constantFrom(...EXERCISES) as fc.Arbitrary<ExerciseId>,
      pattern: fc.constantFrom('squat' as const, 'hinge' as const, 'elbowFlexion' as const),
      targets: fc.subarray(['mu.quads', 'mu.glutes', 'mu.chest.clavicular'] as MuscleId[]),
      priority: fc.constantFrom('primary' as const, 'secondary' as const, 'optional' as const),
      goal: fc.constantFrom('hypertrophy' as const, 'strength' as const),
      lift: fc.option(fc.constantFrom('squat' as const, 'bench' as const), { nil: undefined }),
      prescription,
      progression: fc.constantFrom('doubleProgression' as const, 'rpe' as const, 'linear' as const),
      restSeconds: fc.integer({ min: 30, max: 300 }),
      loadPct: fc.option(fc.constant({ min: 85, max: 100 }), { nil: undefined }),
    })
    .map(({ lift, loadPct, ...slot }) => ({
      key,
      ...slot,
      ...(lift ? { lift } : {}),
      ...(loadPct ? { loadPct } : {}),
    }));

const planDays: fc.Arbitrary<PlanDay[]> = fc
  .uniqueArray(fc.integer({ min: 1, max: 7 }), { minLength: 1, maxLength: 3 })
  .chain((weekdays) =>
    fc.tuple(
      ...weekdays.map((weekday, index) =>
        fc.array(planSlot(`d${index}.s`), { minLength: 1, maxLength: 3 }).map((slots): PlanDay => ({
          key: `d${index}`,
          name: { en: `Day ${index + 1} – Ü` },
          weekday: weekday as IsoWeekday,
          slots: slots.map((slot, slotIndex) => ({ ...slot, key: `d${index}.s${slotIndex}` })),
        })),
      ),
    ),
  );

const plan = (id: string, equipmentProfileId: string, status: Plan['status']): fc.Arbitrary<Plan> =>
  fc
    .record({ days: planDays, startDate: localDate, createdAt: instantTz, seed: fc.nat() })
    .map(({ days, startDate, createdAt, seed }): Plan => ({
      id: id as PlanId,
      status,
      name: { en: 'Upper/lower ×2' },
      templateId: 'tpl.bb-upper-lower-4day' as TemplateId,
      style: 'bodybuilding',
      split: 'upperLower',
      periodization: 'linear',
      equipmentProfileId,
      schedule: {
        weekdays: days.map((day) => day.weekday),
        weekStartsOn: 1,
        sessionMinutes: 60,
        startTimes: [{ weekday: days[0]!.weekday, time: '18:30' }],
      },
      variety: false,
      seed,
      mesocycles: [
        {
          index: 0,
          startDate,
          accumulationWeeks: 5,
          deloadWeeks: 1,
          status: 'active',
          level: 'intermediate',
          days,
          targets: [{ muscle: 'mu.quads' as MuscleId, sets: 15, source: 'band' }],
          liftTargets: [],
          deload: { postponed: false, skipped: false, broughtForward: false },
        },
      ],
      createdAt,
      versions: { engine: '0.0.0', rules: '1.0.0+abcdef012345', content: '0.1.0+sha.0' },
      revision: 0,
    }));

const plannedSession = (id: string, planId: string): fc.Arbitrary<PlannedSession> =>
  fc
    .record({
      localDate,
      week: fc.integer({ min: 1, max: 6 }),
      kind: fc.constantFrom('regular' as const, 'deload' as const),
      status: fc.constantFrom(
        'planned' as const,
        'done' as const,
        'skipped' as const,
        'onBreak' as const,
      ),
      slots: fc.array(planSlot('s'), { maxLength: 3 }),
      revision: fc.nat({ max: 5 }),
    })
    .map(({ slots, ...rest }): PlannedSession => ({
      id: id as PlannedSessionId,
      planId: planId as PlanId,
      mesocycleIndex: 0,
      dayKey: 'd0',
      name: { en: 'Day 1' },
      scheduledDate: rest.localDate,
      slots: slots.map((slot, index) => ({ ...slot, key: `s${index}` })),
      adjustments:
        rest.kind === 'deload'
          ? [
              {
                kind: 'deload',
                setsPct: { min: 40, max: 60 },
                rirAdd: 2,
                notes: ['accessoriesOptional'],
              },
            ]
          : [],
      ...rest,
    }));

const profile: fc.Arbitrary<Profile> = fc
  .record({
    sex: fc.constantFrom('female' as const, 'male' as const, 'preferNotToSay' as const),
    birthYear: fc.option(fc.integer({ min: 1940, max: 2010 }), { nil: null }),
    style: fc.constantFrom(
      'bodybuilding' as const,
      'powerlifting' as const,
      'powerbuilding' as const,
    ),
    priorities: fc.subarray(['mu.chest', 'mu.glutes', 'mu.side-delts'] as MuscleId[], {
      maxLength: 3,
    }),
    displayName: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
    at: instantTz,
  })
  .map(({ displayName, at, ...rest }): Profile => ({
    id: 'me',
    ...(displayName !== undefined ? { displayName } : {}),
    units: { load: 'kg', bodyweight: 'kg', length: 'cm' },
    referenceSet: rest.sex === 'preferNotToSay' ? null : rest.sex,
    height: { value: 180, unit: 'cm' },
    phase: 'maintain',
    experience: {
      trainingAge: 'years2To5',
      timeOff: 'upTo1Week',
      rpeFamiliarity: 'some',
      recentVolume: [{ muscle: 'mu.chest' as MuscleId, sets: 12 }],
    },
    levelOverride: null,
    avoid: { exercises: [], patterns: ['lunge'] },
    preferredExercises: ['ex.barbell-back-squat' as ExerciseId],
    baselines: [
      {
        exerciseId: 'ex.barbell-bench-press' as ExerciseId,
        kind: 'recentSet',
        load: { value: 100, unit: 'kg' },
        reps: 5,
        rir: 2,
      },
    ],
    createdAt: at,
    updatedAt: at,
    ...rest,
  }));

const equipmentProfile = (id: string, isDefault: boolean): fc.Arbitrary<EquipmentProfile> =>
  fc
    .record({
      unit: fc.constantFrom('kg' as const, 'lb' as const),
      dumbbells: fc.option(
        fc.oneof(
          fc.constant({ from: 2.5, to: 25, step: 2.5 }),
          fc.constant({ weights: [5, 7.5, 10] }),
        ),
        { nil: null },
      ),
      collarWeight: fc.constantFrom(0, 2.5),
    })
    .map((rest): EquipmentProfile => ({
      id,
      name: 'Garage',
      isDefault,
      presetId: 'preset.home-barbell-gym' as PresetId,
      items: ['eq.barbell-olympic', 'eq.plates', 'eq.power-rack'] as EquipmentId[],
      customItems: [{ id: 'ce.0190a6f2-sandbag' as CustomEquipmentId, name: 'Sandbag' }],
      bars: [{ item: 'eq.barbell-olympic' as EquipmentId, weight: { value: 20, unit: 'kg' } }],
      plates: [{ weight: 20, pairs: 2 }],
      microplates: [],
      kettlebells: [],
      stacks: [],
      bands: [{ label: 'Red' }],
      ...rest,
    }));

const planningTables = fc
  .record({
    withProfile: fc.boolean(),
    profileIds: fc.uniqueArray(fc.uuid(), { maxLength: 2 }),
    planId: fc.option(fc.uuid(), { nil: null }),
    sessionIds: fc.uniqueArray(fc.uuid(), { maxLength: 3 }),
    breakIds: fc.uniqueArray(fc.uuid(), { maxLength: 2 }),
    meetIds: fc.uniqueArray(fc.uuid(), { maxLength: 1 }),
    weightIds: fc.uniqueArray(fc.uuid(), { maxLength: 3 }),
  })
  .chain(({ withProfile, profileIds, planId, sessionIds, breakIds, meetIds, weightIds }) => {
    const plans = planId && profileIds[0] ? [plan(planId, profileIds[0], 'active')] : [];
    return fc.record({
      profile: withProfile ? profile.map((record) => [record]) : fc.constant([] as Profile[]),
      equipmentProfiles: fc.tuple(
        ...profileIds.map((id, index) => equipmentProfile(id, index === 0)),
      ),
      plans: fc.tuple(...plans),
      plannedSessions: fc.tuple(
        ...(plans.length > 0 && planId ? sessionIds.map((id) => plannedSession(id, planId)) : []),
      ),
      breaks: fc.tuple(
        ...breakIds.map((id) =>
          fc
            .record({ startDate: localDate, open: fc.boolean(), createdAt: instantTz })
            .map(({ startDate, open, createdAt }): TrainingBreak => ({
              id: id as BreakId,
              startDate,
              endDate: open ? null : startDate,
              reason: 'vacation',
              note: 'Ferien – 🏖',
              createdAt,
            })),
        ),
      ),
      meets: fc.tuple(
        ...meetIds.map((id) =>
          fc
            .record({ date: localDate, createdAt: instantTz })
            .map(({ date, createdAt }): MeetInfo => ({
              id,
              date,
              weighIn: 'hours24',
              weightClass: '-83 kg',
              division: 'classic',
              federation: null,
              createdAt,
            })),
        ),
      ),
      bodyweights: fc.tuple(
        ...weightIds.map((id) =>
          fc
            .record({ localDate, measuredAt: instantTz, mass: mass(40, 150) })
            .map((entry): BodyweightEntry => ({ id, ...entry })),
        ),
      ),
    });
  });
