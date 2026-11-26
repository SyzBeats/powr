import type { Dexie } from 'dexie';

/*
 * Never start fresh over lost data (M6d, §8.2.1). Chromium deletes an origin's whole IndexedDB
 * store when it finds it corrupted at open, and the first `open` afterwards meets no database
 * (its `upgradeneeded` event carries the non-standard `dataLoss: "total"`). Dexie then creates an
 * empty `powr` (at boot, or when it reopens a connection the browser closed), and the app would
 * greet a user with years of training data as a first run. A marker outside IndexedDB remembers
 * that the database held data; while it is set, POWR refuses to create the database from scratch
 * and shows "Your data could not be read".
 *
 * The marker has two copies, and either counts: a `localStorage` key (synchronous, but Chromium
 * writes it to disk only some seconds later, so a process killed right after the write loses it)
 * and an empty file in the origin private file system (created on disk at once). Both are kept
 * apart from IndexedDB and survive Chromium dropping it; clearing the site's data or evicting
 * the origin removes them with the data, which then looks like a new install, as before (§6.8).
 */

/** `localStorage`: set once `powr` holds the user's data; removed only by "Delete all data". */
export const DATA_MARKER_KEY = 'powr.data';
/** The same marker as a file in the origin private file system (`navigator.storage`). */
const DATA_MARKER_FILE = 'powr-data-marker';

type MarkerStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The marker file: whether it exists, create it, remove it. Each call may reject. */
export interface MarkerFile {
  exists(): Promise<boolean>;
  create(): Promise<void>;
  remove(): Promise<void>;
}

function webStorage(): MarkerStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // A disabled storage throws on access.
    return null;
  }
}

const isMissing = (error: unknown) =>
  error instanceof DOMException && error.name === 'NotFoundError';

/** The file in the origin private file system, where the browser offers one. */
function privateFile(): MarkerFile | null {
  const storage = globalThis.navigator?.storage;
  if (typeof storage?.getDirectory !== 'function') return null;
  return {
    exists: async () => {
      try {
        await (await storage.getDirectory()).getFileHandle(DATA_MARKER_FILE);
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
    },
    create: async () => {
      await (await storage.getDirectory()).getFileHandle(DATA_MARKER_FILE, { create: true });
    },
    remove: async () => {
      try {
        await (await storage.getDirectory()).removeEntry(DATA_MARKER_FILE);
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    },
  };
}

export interface DataMarker {
  /** The `localStorage` copy only (synchronous). */
  present(): boolean;
  /** Either copy: whether the database held the user's data when POWR last looked. */
  load(): Promise<boolean>;
  /** Records that the database holds data, in both copies (never rejects). */
  set(at?: Date): Promise<void>;
  /** "Delete all data" and "Start again without data": removes both copies (never rejects). */
  clear(): Promise<void>;
}

/** A storage call that may throw (a full or disabled storage): the fallback then. */
function attempt<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    return fallback;
  }
}

/**
 * The marker. Without a usable `localStorage` and file system it is never present (POWR behaves
 * as before M6d). `set` writes each copy at most once per page load.
 */
export function dataMarker(
  storage: MarkerStorage | null = webStorage(),
  file: MarkerFile | null = privateFile(),
): DataMarker {
  let written = false;
  const present = () => attempt(() => storage?.getItem(DATA_MARKER_KEY) != null, false);
  return {
    present,
    load: async () => present() || ((await file?.exists().catch(() => false)) ?? false),
    set: async (at = new Date()) => {
      if (written) return;
      written = true;
      attempt(() => {
        if (storage && storage.getItem(DATA_MARKER_KEY) == null) {
          storage.setItem(DATA_MARKER_KEY, JSON.stringify({ since: at.toISOString() }));
        }
      }, undefined);
      await file?.create().catch(() => undefined);
    },
    clear: async () => {
      written = false;
      attempt(() => storage?.removeItem(DATA_MARKER_KEY), undefined);
      await file?.remove().catch(() => undefined);
    },
  };
}

/** The page's marker (one instance, so `set` writes once per load). */
let shared: DataMarker | null = null;
export function sharedDataMarker(): DataMarker {
  shared ??= dataMarker();
  return shared;
}

/** What the browser reported when it created a database: Chromium's `dataLoss`, if it says. */
export type DataLoss = 'total' | 'none' | 'unknown';

/**
 * An `IDBFactory` for Dexie that reports each `upgradeneeded` from version 0 (a database created
 * from scratch) with Chromium's `dataLoss` field, which nothing else exposes. Everything else is
 * the browser's own factory.
 */
export function observedIndexedDB(
  factory: IDBFactory,
  onCreated: (dataLoss: DataLoss) => void,
): IDBFactory {
  return {
    open(name, version) {
      const request = version === undefined ? factory.open(name) : factory.open(name, version);
      request.addEventListener('upgradeneeded', (event) => {
        if (event.oldVersion !== 0) return;
        const reported = (event as IDBVersionChangeEvent & { dataLoss?: unknown }).dataLoss;
        onCreated(reported === 'total' || reported === 'none' ? reported : 'unknown');
      });
      return request;
    },
    deleteDatabase: (name) => factory.deleteDatabase(name),
    cmp: (first, second) => factory.cmp(first, second),
    databases: () => factory.databases(),
  };
}

/**
 * Whether `powr` holds the user's data: the legal acknowledgement or any other `meta` record, a
 * profile or a workout. Only the onboarding's first step and later actions write these.
 */
export async function storedDataPresent(db: Dexie): Promise<boolean> {
  return db.transaction('r', ['meta', 'profile', 'sessions'], async () => {
    for (const table of ['meta', 'profile', 'sessions']) {
      if ((await db.table(table).count()) > 0) return true;
    }
    return false;
  });
}

/** Thrown inside Dexie's `populate` to stop it from creating `powr` over lost data. */
class DataMissingError extends Error {
  override readonly name = 'DataMissingError';
}

/**
 * Registers the guard on `db`: Dexie's `populate` runs inside the upgrade transaction of a
 * database created from scratch; while `dataExisted()` (the marker read before the open, or data
 * seen since) is true, throwing there aborts it (IndexedDB then removes the half-created
 * database) and Dexie's open, or its automatic reopen, fails. It must answer synchronously: an
 * upgrade transaction cannot wait for anything else. `onRefused` runs after the refusal, outside
 * the transaction. Returns whether it has refused.
 */
export function guardFreshStart(
  db: Dexie,
  dataExisted: () => boolean,
  onRefused: () => void,
): { readonly refused: () => boolean } {
  let refused = false;
  db.on('populate', () => {
    if (!dataExisted()) return;
    refused = true;
    setTimeout(onRefused, 0);
    throw new DataMissingError('POWR held data here before; it will not start fresh over it.');
  });
  return { refused: () => refused };
}
