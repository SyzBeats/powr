import { afterEach, describe, expect, it, vi } from 'vitest';

import { finishSession, logSet, type Deps } from '@powr/application';
// oxlint-disable-next-line no-restricted-imports -- tests load the content eagerly
import { builtInContent } from '@powr/content/built-in';
import { SESSION_DEFAULTS, makeInstantTz, type ExerciseId } from '@powr/domain';
import { MIGRATIONS, RAW_TABLE_NAMES, emptyRawTables, type MigrationChain } from '@powr/formats';

import { createRepositories } from './repositories';
import { PowrDb, SCHEMA_HISTORY, type SchemaVersion } from './schema';
import { createUnitOfWork } from './unit-of-work';

const squat = 'ex.barbell-back-squat' as ExerciseId;
let dbCounter = 0;
const opened: PowrDb[] = [];

function openDb(options: ConstructorParameters<typeof PowrDb>[0] = {}) {
  const db = new PowrDb({ name: options.name ?? `powr-test-${++dbCounter}`, ...options });
  opened.push(db);
  return db;
}

function unused(): never {
  throw new Error('not used');
}

function depsFor(db: PowrDb): Deps {
  let id = 0;
  return {
    uow: createUnitOfWork(db),
    queries: {
      activeSession: unused,
      sessionSets: unused,
      settings: unused,
      meta: unused,
      profile: unused,
      equipmentProfiles: unused,
      activePlan: unused,
      plannedSessions: unused,
      breaks: unused,
      activeSessionData: unused,
      sessionPrs: unused,
    },
    clock: { now: () => makeInstantTz(Date.parse('2026-11-24T18:00:00Z'), 'Europe/Zurich') },
    ids: { next: () => `id-${++id}` },
    content: builtInContent(),
    rules: { version: 'test', resolve: unused },
    app: { version: '0.0.0', build: 'test' },
    runtime: { setActiveSession: async () => {} },
    storage: {
      persisted: async () => false,
      requestPersist: async () => false,
      estimate: async () => null,
    },
    files: { save: async () => 'downloaded' },
    safety: { save: async () => {} },
  };
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
  vi.restoreAllMocks();
});

describe('powr database (Dexie)', () => {
  it('writes user data with strict durability (§8.2.4)', async () => {
    // Dexie binds `transaction` when it opens the database, so spy first.
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
    const db = openDb();
    await logSet(depsFor(db), {
      exerciseId: squat,
      values: { load: { value: 100, unit: 'kg' }, reps: 5, rir: 2 },
    });
    const writes = transaction.mock.calls.filter(([, mode]) => mode === 'readwrite');
    expect(writes.length).toBeGreaterThan(0);
    for (const [, , options] of writes) expect(options).toEqual({ durability: 'strict' });
  });

  it('logs sets into one active session found through the status index', async () => {
    const db = openDb();
    const deps = depsFor(db);
    await logSet(deps, {
      exerciseId: squat,
      values: { load: { value: 100, unit: 'kg' }, reps: 5, rir: 2 },
    });
    await logSet(deps, {
      exerciseId: squat,
      values: { load: { value: 105, unit: 'kg' }, reps: 3, rir: 1 },
    });

    expect(await db.sessions.where('status').equals('active').count()).toBe(1);
    const sets = await db.sets
      .where('[exerciseId+performedAt.epochMs]')
      .between([squat, 0], [squat, Infinity])
      .toArray();
    expect(sets.map((set) => set.index)).toEqual([0, 1]);

    await finishSession(deps);
    expect(await db.sessions.where('status').equals('active').count()).toBe(0);
  });

  it('commits all writes of a unit of work or none (DAT-02)', async () => {
    const db = openDb();
    const uow = createUnitOfWork(db);
    await expect(
      uow.write(['settings', 'meta'], async (repos) => {
        await repos.settings.put({ id: 'me', theme: 'dark' });
        await repos.meta.put({ key: 'x', value: 1 });
        throw new Error('crash after the writes');
      }),
    ).rejects.toThrow('crash after the writes');
    expect(await db.settings.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
  });

  it('replaces all raw tables atomically: a failing restore changes nothing', async () => {
    const db = openDb();
    const uow = createUnitOfWork(db);
    await uow.write(['settings'], (repos) => repos.settings.put({ id: 'me', theme: 'light' }));

    const duplicate = { key: 'same', value: 1 };
    const broken = { ...emptyRawTables(), meta: [duplicate, duplicate] };
    await expect(
      uow.write(RAW_TABLE_NAMES, (repos) => repos.raw.replaceAll(broken)),
    ).rejects.toThrow(/Key already exists|ConstraintError/);
    expect(await db.settings.toArray()).toEqual([{ id: 'me', theme: 'light' }]);
  });

  it('reads a consistent snapshot of every raw table', async () => {
    const db = openDb();
    await db.settings.put({ id: 'me', theme: 'dark' });
    const tables = await db.transaction('r', db.tables, () => createRepositories(db).raw.readAll());
    expect(tables).toEqual({ ...emptyRawTables(), settings: [{ id: 'me', theme: 'dark' }] });
  });
});

describe('schema upgrades use the shared record-migration chain (§8.2.3)', () => {
  const v1History = SCHEMA_HISTORY.slice(0, 1);
  const latest = SCHEMA_HISTORY.at(-1)!;
  const next: SchemaVersion = { version: latest.version + 1, stores: latest.stores };
  const addUnits: MigrationChain = {
    ...MIGRATIONS,
    [latest.version]: (table, record) =>
      table === 'settings' ? { ...(record as object), units: 'kg' } : record,
  };

  it('upgrades a v1 database to v2: every record and the active session kept, new tables empty (TD-19)', async () => {
    const name = `powr-upgrade-${++dbCounter}`;
    const v1 = openDb({ name, history: v1History });
    const at = makeInstantTz(Date.parse('2026-11-23T10:00:00Z'), 'Europe/Zurich');
    const session = {
      id: 'active-session',
      localDate: '2026-11-23',
      startedAt: at,
      status: 'active',
      versions: { engine: '0.0.0', rules: '1.0.0', content: '0.1.0' },
    };
    const set = {
      id: 'set-1',
      sessionId: 'active-session',
      exerciseId: squat,
      index: 0,
      type: 'working',
      load: { value: 100, unit: 'kg' },
      reps: 5,
      effort: { rir: 2, source: 'entered' },
      state: 'done',
      performedAt: at,
      localDate: '2026-11-23',
    };
    await v1.table('settings').put({ id: 'me', theme: 'dark' });
    await v1.table('meta').put({ key: 'lastBackup', value: { at: 'x' } });
    await v1.table('sessions').put(session);
    await v1.table('sets').put(set);
    v1.close();

    const upgraded = openDb({ name });
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    expect(await upgraded.settings.toArray()).toEqual([{ id: 'me', theme: 'dark' }]);
    // The 1 → 2 step gives v1 sessions the empty M3 session core (amended version 2, M3a).
    expect(await upgraded.sessions.where('status').equals('active').toArray()).toEqual([
      { ...SESSION_DEFAULTS, ...session },
    ]);
    expect(await upgraded.sets.toArray()).toEqual([set]);
    expect(await upgraded.meta.toArray()).toEqual([{ key: 'lastBackup', value: { at: 'x' } }]);
    for (const table of [
      'profile',
      'equipmentProfiles',
      'plans',
      'plannedSessions',
      'breaks',
      'meets',
      'bodyweights',
      'readiness',
      'dExerciseState',
      'dSessionE1rm',
      'dPrs',
    ]) {
      expect(await upgraded.table(table).count()).toBe(0);
    }
  });

  it('migrates existing records when the database opens at a newer version', async () => {
    const name = `powr-upgrade-${++dbCounter}`;
    const current = openDb({ name });
    await current.settings.put({ id: 'me', theme: 'dark' });
    current.close();

    const upgraded = openDb({ name, history: [...SCHEMA_HISTORY, next], migrations: addUnits });
    expect(await upgraded.table('settings').toArray()).toEqual([
      { id: 'me', theme: 'dark', units: 'kg' },
    ]);
    expect(upgraded.verno).toBe(next.version);
  });

  it('leaves the old version and data intact when a migration throws (QS-12)', async () => {
    const name = `powr-upgrade-${++dbCounter}`;
    const v1 = openDb({ name, history: v1History });
    await v1.table('settings').put({ id: 'me', theme: 'dark' });
    v1.close();

    const failing: MigrationChain = {
      1: () => {
        throw new Error('migration bug');
      },
    };
    const broken = openDb({ name, migrations: failing });
    await expect(broken.open()).rejects.toThrow(/migration bug/);
    broken.close();

    const reopened = openDb({ name, history: v1History });
    await reopened.open();
    expect(reopened.verno).toBe(1);
    expect(await reopened.table('settings').toArray()).toEqual([{ id: 'me', theme: 'dark' }]);
  });
});

const plannedSession = (id: string, planId: string, localDate: string) =>
  ({
    id,
    planId,
    mesocycleIndex: 0,
    week: 1,
    dayKey: 'a',
    name: { en: 'A' },
    kind: 'regular',
    localDate,
    scheduledDate: localDate,
    status: 'planned',
    slots: [],
    adjustments: [],
    revision: 0,
  }) as never;

describe('planning repositories (dataVersion 2)', () => {
  it('finds planned sessions by plan and by day range, and the active plan by status', async () => {
    const db = openDb();
    const uow = createUnitOfWork(db);
    await uow.write(['plannedSessions', 'meta'], async (repos) => {
      await repos.plannedSessions.putMany([
        plannedSession('s2', 'p1', '2026-12-03'),
        plannedSession('s1', 'p1', '2026-12-01'),
        plannedSession('s3', 'p2', '2026-12-02'),
      ]);
      await repos.meta.put({ key: 'onboardingDraft', value: { step: 'units' } });
      await repos.meta.delete('onboardingDraft');
    });
    const found = await uow.read(['plannedSessions', 'meta'], async (repos) => ({
      byPlan: await repos.plannedSessions.byPlan('p1' as never),
      range: await repos.plannedSessions.inRange('2026-12-02' as never, '2026-12-03' as never),
      draft: await repos.meta.get('onboardingDraft'),
    }));
    expect(found.byPlan.map((entry) => entry.id)).toEqual(['s1', 's2']);
    expect(found.range.map((entry) => entry.id).toSorted()).toEqual(['s2', 's3']);
    expect(found.draft).toBeUndefined();
  });
});

describe('session core tables (M3a, amended dataVersion 2)', () => {
  const at = makeInstantTz(Date.parse('2026-11-24T17:00:00Z'), 'Europe/Zurich');
  const session = {
    id: 'm3-session',
    localDate: '2026-11-24',
    startedAt: at,
    status: 'active',
    versions: { engine: '0.0.0', rules: '1.4.0', content: '0.2.0' },
    ...SESSION_DEFAULTS,
    exercises: [
      {
        key: 'a',
        exerciseId: squat,
        origin: 'plan',
        goal: 'strength',
        priority: 'primary',
        progression: 'rpe',
        prescription: null,
        sets: [{ key: 's1', type: 'working', reps: [5, 5], rir: [2, 2], load: null }],
        restSeconds: 180,
        skipped: false,
      },
    ],
    cursor: { slotKey: 'a', setKey: 's1' },
    timer: {
      id: 't1',
      kind: 'rest',
      mode: 'countdown',
      startedAtEpochMs: at.epochMs,
      targetMs: 180_000,
      adjustMs: 15_000,
      fired: { preAlert: true },
    },
    revision: 3,
  } as never;
  const state = {
    exerciseId: squat,
    key: 'k1',
    exposures: 2,
    firstDate: '2026-11-17',
    lastDate: '2026-11-20',
    calibration: { entered: 2, reliable: true },
    baseline: null,
    strength: null,
    all: null,
    points: [],
    last: null,
    linear: [],
    bests: { loadKg: 100, e1rmKg: 120, volumeKg: 1500, reps: [{ reps: 5, loadKg: 100 }] },
    effort: [],
  } as never;

  it('keeps the active session with its timer across a close and reopen (WKT-14)', async () => {
    const name = `powr-m3-${++dbCounter}`;
    const first = openDb({ name });
    await createUnitOfWork(first).write(['sessions', 'readiness'], async (repos) => {
      await repos.sessions.put(session);
      await repos.readiness.put({
        id: 'r1',
        localDate: '2026-11-24' as never,
        recordedAt: at,
        sessionId: 'm3-session' as never,
        items: { energy: 3, prs: 6 },
      });
    });
    first.close();

    const reopened = openDb({ name });
    const found = await createUnitOfWork(reopened).read(
      ['sessions', 'readiness'],
      async (repos) => ({
        active: await repos.sessions.getActive(),
        checkIns: await repos.readiness.bySession('m3-session' as never),
      }),
    );
    expect(found.active).toEqual(session);
    expect(found.checkIns.map((entry) => entry.id)).toEqual(['r1']);
  });

  it('reads an M2-era version-2 session (no session core) with the empty defaults', async () => {
    const db = openDb();
    const old = {
      id: 'm2',
      localDate: '2026-11-23',
      startedAt: at,
      status: 'active',
      versions: { engine: '0.0.0', rules: '1.3.0', content: '0.2.0' },
    };
    await db.table('sessions').put(old);
    const active = await createUnitOfWork(db).read(['sessions'], (repos) =>
      repos.sessions.getActive(),
    );
    expect(active).toEqual({ ...SESSION_DEFAULTS, ...old });
  });

  it('replaces, invalidates and clears the derived tables; a restore clears them too', async () => {
    const db = openDb();
    const uow = createUnitOfWork(db);
    const derived = ['dExerciseState', 'dSessionE1rm', 'dPrs'] as const;
    const pr = {
      id: 'set-1.load',
      type: 'load',
      exerciseId: squat,
      sessionId: 's1',
      setId: 'set-1',
      localDate: '2026-11-20',
      reps: 5,
      valueKg: 100,
      previousKg: null,
    } as never;
    const point = {
      exerciseId: squat,
      sessionId: 's1',
      localDate: '2026-11-20',
      e1rmKg: 120,
      weight: 1,
      strength: null,
      all: null,
    } as never;
    const read = () =>
      uow.read(derived, async (repos) => ({
        states: await repos.derived.exerciseStates([squat]),
        points: await repos.derived.pointsByExercise(squat),
        prs: await repos.derived.prsBySession('s1' as never),
      }));
    await uow.write(derived, (repos) =>
      repos.derived.replaceExercise(squat, { state, points: [point], prs: [pr] }),
    );
    expect(await read()).toEqual({ states: [state], points: [point], prs: [pr] });
    await uow.write(['dExerciseState'], (repos) => repos.derived.invalidate([squat]));
    expect((await read()).states).toEqual([]);

    await uow.write(derived, (repos) =>
      repos.derived.replaceExercise(squat, { state, points: [], prs: [pr] }),
    );
    expect((await read()).points).toEqual([]);
    await uow.write([...RAW_TABLE_NAMES, ...derived], (repos) =>
      repos.raw.replaceAll(emptyRawTables()),
    );
    expect(await read()).toEqual({ states: [], points: [], prs: [] });
  });
});
