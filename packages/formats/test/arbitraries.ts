import * as fc from 'fast-check';

import type { ExerciseId, LocalDate, LoggedSet, Session, SessionId, SetId } from '@powr/domain';

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
      return fc.record({ meta, settings: settingsRecords, sessions, sets });
    });
}
