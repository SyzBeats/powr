/**
 * `powr-runtime`: a tiny key-value database shared by the page and the service worker (§8.2.1).
 * Plain IndexedDB, no Dexie, so the service worker stays small. The schema is frozen forever:
 * version 1, one object store `kv`.
 */
const DB_NAME = 'powr-runtime';
const STORE = 'kv';

interface ActiveSessionFlag {
  readonly id: string;
  /** App build that started the session. */
  readonly build: string;
}

export interface FiredFlag {
  readonly by: 'page' | 'sw';
  readonly at: number;
}

export interface RuntimeValues {
  activeSession: ActiveSessionFlag | null;
  [firedKey: `fired:${string}`]: FiredFlag;
}

function openRuntimeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.addEventListener('upgradeneeded', () => request.result.createObjectStore(STORE));
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('Cannot open powr-runtime')),
    );
  });
}

export async function getRuntimeValue<K extends keyof RuntimeValues>(
  key: K,
): Promise<RuntimeValues[K] | undefined> {
  const db = await openRuntimeDb();
  try {
    return await promisify<RuntimeValues[K] | undefined>(
      db.transaction(STORE).objectStore(STORE).get(key),
    );
  } finally {
    db.close();
  }
}

export async function setRuntimeValue<K extends keyof RuntimeValues>(
  key: K,
  value: RuntimeValues[K],
): Promise<void> {
  const db = await openRuntimeDb();
  try {
    const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' });
    tx.objectStore(STORE).put(value, key);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

/**
 * Sets `key` only if it is not set yet and reports whether this call set it.
 * Used to deduplicate alerts between the page and the service worker (§8.8.4).
 */
export async function claimRuntimeFlag(key: `fired:${string}`, value: FiredFlag): Promise<boolean> {
  const db = await openRuntimeDb();
  try {
    const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' });
    const store = tx.objectStore(STORE);
    const existing = await promisify<unknown>(store.get(key));
    if (existing === undefined) store.put(value, key);
    await transactionDone(tx);
    return existing === undefined;
  } finally {
    db.close();
  }
}

function promisify<T>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result as T));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB request failed')),
    );
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener('complete', () => resolve());
    tx.addEventListener('error', () =>
      reject(tx.error ?? new Error('IndexedDB transaction failed')),
    );
    tx.addEventListener('abort', () =>
      reject(tx.error ?? new Error('IndexedDB transaction aborted')),
    );
  });
}
