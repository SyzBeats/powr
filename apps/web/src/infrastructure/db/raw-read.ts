import type { RawSnapshot } from '@powr/formats/backup';

import { DEXIE_VERSION_FACTOR } from './stored-version';

/**
 * Reads every object store of `powr` at the version it is stored in, without Dexie and without
 * upgrading it (DAT-14): the safety snapshot before a data update and the recovery screen's
 * "Save a copy of your data". Read-only; the connection is closed again. Null when there is no
 * database (opening one would create it, so that attempt is aborted).
 */
export function readRawDatabase(name = 'powr'): Promise<RawSnapshot | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    let created = false;
    request.addEventListener('upgradeneeded', () => {
      // No database existed: do not leave an empty one behind.
      created = true;
      request.transaction?.abort();
    });
    request.addEventListener('error', (event) => {
      if (created) {
        event.preventDefault();
        resolve(null);
      } else {
        reject(request.error ?? new Error(`Cannot open ${name}`));
      }
    });
    request.addEventListener('success', () => {
      const db = request.result;
      void readAll(db).then(
        (tables) => {
          db.close();
          resolve({ dataVersion: Math.floor(db.version / DEXIE_VERSION_FACTOR), tables });
        },
        (error: unknown) => {
          db.close();
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  });
}

/** Whether any record exists outside the derived tables (`dWeekly`, …): worth a safety copy. */
export function hasUserData(snapshot: RawSnapshot): boolean {
  return Object.entries(snapshot.tables).some(
    ([table, records]) => !/^d[A-Z]/.test(table) && records.length > 0,
  );
}

function readAll(db: IDBDatabase): Promise<Record<string, unknown[]>> {
  const names = [...db.objectStoreNames];
  if (names.length === 0) return Promise.resolve({});
  return new Promise((resolve, reject) => {
    const tables: Record<string, unknown[]> = {};
    const tx = db.transaction(names, 'readonly');
    for (const name of names) {
      const request = tx.objectStore(name).getAll();
      request.addEventListener('success', () => {
        tables[name] = request.result as unknown[];
      });
    }
    tx.addEventListener('complete', () => resolve(tables));
    tx.addEventListener('error', () => reject(tx.error ?? new Error('Cannot read the data')));
    tx.addEventListener('abort', () => reject(tx.error ?? new Error('Reading the data stopped')));
  });
}
