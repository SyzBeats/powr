import { afterEach, describe, expect, it, vi } from 'vitest';

import { finishSession, logSet, type Deps } from '@powr/application';
import { builtInContent } from '@powr/content';
import { makeInstantTz, type ExerciseId } from '@powr/domain';
import { emptyRawTables, type MigrationChain } from '@powr/formats';

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
    queries: { activeSession: unused, sessionSets: unused, settings: unused, meta: unused },
    clock: { now: () => makeInstantTz(Date.parse('2026-11-24T18:00:00Z'), 'Europe/Zurich') },
    ids: { next: () => `id-${++id}` },
    content: builtInContent(),
    rulesVersion: 'test',
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
      uow.write(['meta', 'settings', 'sessions', 'sets'], (repos) => repos.raw.replaceAll(broken)),
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
  const v2: SchemaVersion = { version: 2, stores: SCHEMA_HISTORY[0]!.stores };
  const addUnits: MigrationChain = {
    1: (table, record) => (table === 'settings' ? { ...(record as object), units: 'kg' } : record),
  };

  it('migrates existing records when the database opens at a newer version', async () => {
    const name = `powr-upgrade-${++dbCounter}`;
    const v1 = openDb({ name });
    await v1.settings.put({ id: 'me', theme: 'dark' });
    v1.close();

    const upgraded = openDb({ name, history: [...SCHEMA_HISTORY, v2], migrations: addUnits });
    expect(await upgraded.table('settings').toArray()).toEqual([
      { id: 'me', theme: 'dark', units: 'kg' },
    ]);
    expect(upgraded.verno).toBe(2);
  });

  it('leaves the old version and data intact when a migration throws (QS-12)', async () => {
    const name = `powr-upgrade-${++dbCounter}`;
    const v1 = openDb({ name });
    await v1.settings.put({ id: 'me', theme: 'dark' });
    v1.close();

    const failing: MigrationChain = {
      1: () => {
        throw new Error('migration bug');
      },
    };
    const broken = openDb({ name, history: [...SCHEMA_HISTORY, v2], migrations: failing });
    await expect(broken.open()).rejects.toThrow(/migration bug/);
    broken.close();

    const reopened = openDb({ name });
    await reopened.open();
    expect(reopened.verno).toBe(1);
    expect(await reopened.settings.toArray()).toEqual([{ id: 'me', theme: 'dark' }]);
  });
});
