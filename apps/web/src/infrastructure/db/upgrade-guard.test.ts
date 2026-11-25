import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

// oxlint-disable-next-line no-restricted-imports -- tests load the backup code eagerly
import { snapshotBeforeUpgrade, saveRescueCopy } from '@powr/application/backup';
import { SESSION_DEFAULTS, makeInstantTz } from '@powr/domain';
import { DATA_VERSION, type MigrationChain } from '@powr/formats';
// oxlint-disable-next-line no-restricted-imports -- tests load the backup code eagerly
import { decodeBackup } from '@powr/formats/backup';

import { DEFAULT_PUBLIC_ORIGIN, publicOrigin } from '../../app/public-origin';
import { createDiagnostics } from '../diagnostics/log';
import { deleteAllData, remainingDatabases } from '../platform/wipe';
import { getRuntimeValue, setRuntimeValue } from '../runtime-db';
import { hasUserData, readRawDatabase } from './raw-read';
import { createSafetySnapshots } from './safety-db';
import { PowrDb, SCHEMA_HISTORY } from './schema';
import { pendingUpgrade } from './stored-version';

let counter = 0;
const v1History = SCHEMA_HISTORY.filter((entry) => entry.version === 1);

const session = {
  id: 's1',
  localDate: '2026-11-20',
  startedAt: makeInstantTz(Date.parse('2026-11-20T17:00:00Z'), 'Europe/Zurich'),
  status: 'finished',
  versions: { engine: '0.0.0', rules: '0.0.0+m0', content: '0.0.0+m0' },
};

/** A `powr`-like database at dataVersion 1 holding a setting and a v1 session. */
async function v1Database(): Promise<string> {
  const name = `powr-guard-${++counter}`;
  const v1 = new PowrDb({ name, history: v1History });
  await v1.table('settings').put({ id: 'me', theme: 'dark' });
  await v1.table('sessions').put(session);
  v1.close();
  return name;
}

function env(safety = createSafetySnapshots()) {
  const files: { name: string; bytes: Uint8Array }[] = [];
  let id = 0;
  return {
    files,
    env: {
      app: { version: '0.0.0', build: 'test' },
      clock: { now: () => makeInstantTz(Date.parse('2026-11-25T09:00:00Z'), 'Europe/Zurich') },
      ids: { next: () => `id-${++id}` },
      safety,
      files: {
        save: async (file: { name: string; bytes: Uint8Array }) => {
          files.push(file);
          return 'downloaded' as const;
        },
      },
      rulesVersion: 'r',
      contentVersion: 'c',
    },
  };
}

describe('data update guard (DAT-14, §6.7 step 3, §6.8)', () => {
  it('sees a pending update from the stored version without opening the database', async () => {
    const name = await v1Database();
    expect(await pendingUpgrade(name)).toEqual({ from: 1, to: DATA_VERSION });
    expect(await pendingUpgrade(`powr-missing-${++counter}`)).toBeNull();

    const current = new PowrDb({ name: `powr-guard-${++counter}` });
    await current.open();
    expect(await pendingUpgrade(current.name)).toBeNull();
    current.close();
  });

  it('reads the raw records at the stored version, without upgrading or creating anything', async () => {
    const name = await v1Database();
    const raw = await readRawDatabase(name);
    expect(raw?.dataVersion).toBe(1);
    expect(raw?.tables['settings']).toEqual([{ id: 'me', theme: 'dark' }]);
    expect(raw?.tables['sessions']).toEqual([session]);
    expect(hasUserData(raw!)).toBe(true);
    // Still version 1: reading did not upgrade.
    expect(await pendingUpgrade(name)).toEqual({ from: 1, to: DATA_VERSION });

    const missing = `powr-missing-${++counter}`;
    expect(await readRawDatabase(missing)).toBeNull();
    expect(await remainingNames()).not.toContain(missing);
  });

  it('a simulated failing migration loses nothing: snapshot first, rollback, rescue copy, then a fixed update succeeds', async () => {
    const name = await v1Database();
    const safety = createSafetySnapshots();
    const { env: upgradeEnv, files } = env(safety);

    // 1. The guard's safety snapshot of the stored data.
    const raw = await readRawDatabase(name);
    const snapshot = await snapshotBeforeUpgrade(upgradeEnv, raw!);
    const copies = await safety.list();
    expect(copies[0]).toMatchObject({ fileName: snapshot.fileName, reason: 'migration' });

    // 2. The update throws: IndexedDB rolls it back, the data stays at version 1.
    const failing: MigrationChain = {
      1: (table, record) => {
        if (table === 'sessions') throw new Error('simulated migration bug');
        return record;
      },
    };
    const broken = new PowrDb({ name, migrations: failing });
    await expect(broken.open()).rejects.toThrow(/simulated migration bug/);
    broken.close();
    expect(await pendingUpgrade(name)).toEqual({ from: 1, to: DATA_VERSION });

    // 3. The recovery screen's copy: every record, as a v1 backup the import path migrates.
    const rescue = await saveRescueCopy(upgradeEnv, (await readRawDatabase(name))!);
    expect(rescue.delivery).toBe('downloaded');
    const decoded = await decodeBackup(files[0]!.bytes);
    if (!decoded.ok) throw new Error(decoded.error.kind);
    expect(decoded.backup.preview.dataVersion).toBe(1);
    expect(decoded.backup.tables.sessions).toEqual([{ ...SESSION_DEFAULTS, ...session }]);
    // The snapshot taken before the update is the same data.
    const fromSnapshot = await decodeBackup((await safety.read(copies[0]!.id))!);
    expect(fromSnapshot.ok && fromSnapshot.backup.tables.sessions).toEqual(
      decoded.backup.tables.sessions,
    );

    // 4. A fixed version updates the same data.
    const fixed = new PowrDb({ name });
    await fixed.open();
    expect(fixed.verno).toBe(DATA_VERSION);
    expect(await fixed.table('sessions').toArray()).toEqual([{ ...SESSION_DEFAULTS, ...session }]);
    fixed.close();
  });
});

async function remainingNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((entry) => entry.name ?? '');
}

describe('delete all data (DAT-13)', () => {
  it('deletes powr, powr-safety, powr-diag and powr-runtime, and nothing reopens them', async () => {
    // Diagnostics record the route; Node has no location.
    vi.stubGlobal('location', { pathname: '/data' });
    const db = new PowrDb();
    await db.open();
    await db.table('settings').put({ id: 'me', theme: 'dark' });
    const safety = createSafetySnapshots();
    await safety.save({
      fileName: 'x.zip',
      bytes: new Uint8Array([1]),
      reason: 'import',
      at: makeInstantTz(0, 'UTC'),
    });
    const diagnostics = createDiagnostics({
      app: { version: 't', build: 't' },
      context: async () => ({}),
    });
    diagnostics.log('info', 'app.start');
    await setRuntimeValue('activeSession', { id: 's1', build: 't' });
    // Let the diagnostics write land.
    await diagnostics.recent(1);
    expect(await remainingDatabases()).toEqual(
      expect.arrayContaining(['powr', 'powr-safety', 'powr-diag', 'powr-runtime']),
    );

    const result = await deleteAllData([{ wipe: () => db.delete() }, safety, diagnostics]);
    expect(result.remaining).toEqual([]);
    // Logging afterwards writes nothing (no empty powr-diag again).
    diagnostics.log('info', 'app.start');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await remainingDatabases()).toEqual([]);
    expect(await getRuntimeValue('activeSession')).toBeUndefined();
  });
});

describe('public origin (product-owner decision 2026-11-25)', () => {
  it('defaults to the reserved powr.invalid and accepts only http(s) origins', () => {
    expect(DEFAULT_PUBLIC_ORIGIN).toBe('https://powr.invalid');
    expect(publicOrigin(undefined)).toBe(DEFAULT_PUBLIC_ORIGIN);
    expect(publicOrigin('')).toBe(DEFAULT_PUBLIC_ORIGIN);
    expect(publicOrigin('not a url')).toBe(DEFAULT_PUBLIC_ORIGIN);
    expect(publicOrigin('javascript:alert(1)')).toBe(DEFAULT_PUBLIC_ORIGIN);
    expect(publicOrigin('https://train.example.com/some/path?x=1')).toBe(
      'https://train.example.com',
    );
  });
});
