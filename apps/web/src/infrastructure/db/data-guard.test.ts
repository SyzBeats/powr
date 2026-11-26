import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

import { deleteAllData } from '../platform/wipe';
import {
  DATA_MARKER_KEY,
  dataMarker,
  guardFreshStart,
  observedIndexedDB,
  storedDataPresent,
  type DataLoss,
} from './data-guard';
import { PowrDb } from './schema';

/*
 * M6d: never start fresh over lost data. Chromium deletes a damaged IndexedDB store at open
 * without telling the page (only a non-standard `dataLoss` on the next `upgradeneeded`), and Dexie
 * then creates an empty `powr`, at boot or when it reopens a closed connection. These tests run
 * the guard against fake-indexeddb, with an in-memory `localStorage` and marker file.
 */
let counter = 0;
const nextName = () => `powr-data-guard-${++counter}`;

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

const fail = () => Promise.reject(new DOMException('denied', 'SecurityError'));

/** The marker file in memory; `failing` makes every call reject. */
function memoryFile(failing = false) {
  const state = { exists: false };
  return {
    state,
    exists: async () => (failing ? fail() : state.exists),
    create: async () => (failing ? fail() : void (state.exists = true)),
    remove: async () => (failing ? fail() : void (state.exists = false)),
  };
}

async function listed(name: string): Promise<boolean> {
  return (await indexedDB.databases()).some((database) => database.name === name);
}

/** A database with the legal acknowledgement, as after the first onboarding step. */
async function populated(name: string): Promise<void> {
  const db = new PowrDb({ name });
  await db.meta.put({ key: 'legalAck', value: { disclaimerVersion: '1', privacyVersion: '1' } });
  db.close();
}

describe('the data marker (M6d)', () => {
  it('is written to both copies once, keeps its first date and is cleared from both', async () => {
    const storage = memoryStorage();
    const file = memoryFile();
    const marker = dataMarker(storage, file);
    expect(await marker.load()).toBe(false);
    await marker.set(new Date('2026-11-25T08:00:00Z'));
    await dataMarker(storage, file).set(new Date('2026-12-01T08:00:00Z'));
    expect(marker.present()).toBe(true);
    expect(file.state.exists).toBe(true);
    expect(JSON.parse(storage.values.get(DATA_MARKER_KEY)!)).toEqual({
      since: '2026-11-25T08:00:00.000Z',
    });
    await marker.clear();
    expect(marker.present()).toBe(false);
    expect(file.state.exists).toBe(false);
    expect(await marker.load()).toBe(false);
  });

  it('counts either copy: a killed browser may lose the localStorage write, not the file', async () => {
    const file = memoryFile();
    await dataMarker(memoryStorage(), file).set();
    // A new page whose localStorage never reached the disk.
    const afterKill = dataMarker(memoryStorage(), file);
    expect(afterKill.present()).toBe(false);
    expect(await afterKill.load()).toBe(true);
    // And the other way round (no file system, or the file write failed).
    const storage = memoryStorage();
    await dataMarker(storage, memoryFile(true)).set();
    expect(await dataMarker(storage, null).load()).toBe(true);
  });

  it('is never present without usable storage, and a throwing storage breaks nothing', async () => {
    expect(await dataMarker(null, null).load()).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const marker = dataMarker(broken, memoryFile(true));
    expect(marker.present()).toBe(false);
    expect(await marker.load()).toBe(false);
    await expect(marker.set()).resolves.toBeUndefined();
    await expect(marker.clear()).resolves.toBeUndefined();
  });
});

describe('never starting fresh over lost data (M6d)', () => {
  it('creates the database on a first run (no marker)', async () => {
    const name = nextName();
    const db = new PowrDb({ name });
    const onRefused = vi.fn<() => void>();
    const guard = guardFreshStart(db, () => false, onRefused);
    await db.open();
    expect(guard.refused()).toBe(false);
    expect(await storedDataPresent(db)).toBe(false);
    db.close();
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('refuses to create it while the marker says it held data, and leaves nothing behind', async () => {
    // Regression: before M6d Dexie created an empty `powr` here and the app showed the first run.
    const name = nextName();
    const db = new PowrDb({ name });
    const onRefused = vi.fn<() => void>();
    const guard = guardFreshStart(db, () => true, onRefused);
    await expect(db.open()).rejects.toThrow('will not start fresh');
    expect(guard.refused()).toBe(true);
    await vi.waitFor(() => expect(onRefused).toHaveBeenCalledOnce());
    // The aborted creation removed the half-made database: nothing to mistake for data later.
    expect(await listed(name)).toBe(false);
  });

  it('opens an existing database with data as before and finds the data', async () => {
    const name = nextName();
    await populated(name);
    const db = new PowrDb({ name });
    const guard = guardFreshStart(db, () => true, vi.fn<() => void>());
    await db.open();
    expect(guard.refused()).toBe(false);
    expect(await storedDataPresent(db)).toBe(true);
    db.close();
  });

  it('refuses Dexie’s automatic reopen after the database vanished while the app ran', async () => {
    // The browser closes the connection (versionchange here; a forced close for a damaged store
    // in Chromium) and the store is gone; Dexie's next query would create an empty `powr`.
    const name = nextName();
    await populated(name);
    const db = new PowrDb({ name });
    const onRefused = vi.fn<() => void>();
    const guard = guardFreshStart(db, () => true, onRefused);
    await db.open();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => reject(request.error));
    });
    await expect(db.meta.get('legalAck')).rejects.toThrow('will not start fresh');
    expect(guard.refused()).toBe(true);
    await vi.waitFor(() => expect(onRefused).toHaveBeenCalledOnce());
    expect(await listed(name)).toBe(false);
  });

  it('counts the legal acknowledgement, a profile or a workout as data, derived tables not', async () => {
    const empty = new PowrDb({ name: nextName() });
    await empty.dStreak.put({ id: 'me' } as never);
    expect(await storedDataPresent(empty)).toBe(false);
    for (const write of [
      (db: PowrDb) => db.meta.put({ key: 'persistence', value: { granted: false } }),
      (db: PowrDb) => db.profile.put({ id: 'me' } as never),
      (db: PowrDb) => db.sessions.put({ id: 's1', status: 'finished' } as never),
    ]) {
      const db = new PowrDb({ name: nextName() });
      await write(db);
      expect(await storedDataPresent(db)).toBe(true);
      db.close();
    }
    empty.close();
  });
});

describe('"Delete all data" and the marker (M6d)', () => {
  it('forgets the marker before it deletes anything', async () => {
    const storage = Object.assign(memoryStorage(), { clear: () => storage.values.clear() });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', memoryStorage());
    try {
      await dataMarker().set();
      const markerAtWipe: boolean[] = [];
      await deleteAllData([{ wipe: async () => void markerAtWipe.push(dataMarker().present()) }]);
      // A wipe cut short after this point never leaves "data existed" behind without the data.
      expect(markerAtWipe).toEqual([false]);
      expect(dataMarker().present()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('observing database creation (M6d)', () => {
  it('reports a creation from scratch with the browser’s dataLoss, and nothing for an existing one', async () => {
    const name = nextName();
    const seen: DataLoss[] = [];
    const factory = observedIndexedDB(indexedDB, (loss) => seen.push(loss));
    const first = new PowrDb({ name, indexedDB: factory });
    await first.open();
    first.close();
    // fake-indexeddb has no `dataLoss` field: "unknown" (Chromium says "none" or "total").
    expect(seen).toEqual(['unknown']);
    const again = new PowrDb({ name, indexedDB: factory });
    await again.open();
    again.close();
    expect(seen).toEqual(['unknown']);
  });

  it('passes Chromium’s dataLoss through', async () => {
    const seen: DataLoss[] = [];
    // A factory whose open request fires an `upgradeneeded` with Chromium's extra field.
    const fake = {
      open: () => {
        const request = new EventTarget() as IDBOpenDBRequest;
        queueMicrotask(() => {
          const event = Object.assign(new Event('upgradeneeded'), {
            oldVersion: 0,
            dataLoss: 'total',
          });
          request.dispatchEvent(event);
        });
        return request;
      },
    } as unknown as IDBFactory;
    observedIndexedDB(fake, (loss) => seen.push(loss)).open('powr', 20);
    await vi.waitFor(() => expect(seen).toEqual(['total']));
  });
});
