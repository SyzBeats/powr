import { DATA_VERSION } from '@powr/formats';

/** Dexie stores `db.version(n)` as IndexedDB version n × 10. */
export const DEXIE_VERSION_FACTOR = 10;

export interface PendingUpgrade {
  /** The `dataVersion` of the stored database. */
  readonly from: number;
  readonly to: number;
}

/**
 * Whether opening `powr` will run a data update (DAT-14, §6.7 step 3), read from
 * `indexedDB.databases()` without opening anything (Chromium 71+). Null when there is no
 * database yet, it is current, or the browser cannot tell (then no snapshot is possible
 * without opening, and the upgrade itself still runs atomically).
 */
export async function pendingUpgrade(name = 'powr'): Promise<PendingUpgrade | null> {
  if (typeof indexedDB.databases !== 'function') return null;
  try {
    const entry = (await indexedDB.databases()).find((database) => database.name === name);
    if (!entry?.version) return null;
    const from = Math.floor(entry.version / DEXIE_VERSION_FACTOR);
    return from >= 1 && from < DATA_VERSION ? { from, to: DATA_VERSION } : null;
  } catch {
    return null;
  }
}
