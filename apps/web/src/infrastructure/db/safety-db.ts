import { Dexie, type Table } from 'dexie';

import type { SafetySnapshots } from '@powr/application';
import { toIsoWithOffset } from '@powr/domain';

interface SafetySnapshot {
  id?: number;
  fileName: string;
  bytes: Uint8Array;
  reason: 'import' | 'migration';
  at: string;
}

/**
 * `powr-safety`: the safety snapshots taken before imports and migrations (§8.2.1). Which copies
 * stay is the application's rule (`pruneSafetyCopies`, TD-67), not the store's.
 */
class SafetyDb extends Dexie {
  declare snapshots: Table<SafetySnapshot, number>;

  constructor() {
    super('powr-safety', { chromeTransactionDurability: 'strict' });
    this.version(1).stores({ snapshots: '++id, at' });
  }
}

/**
 * The safety-copy store. The Dexie connection opens on first use and closes on `versionchange`
 * (Dexie's default), so "Delete all data" can delete the database while the app runs.
 */
export function createSafetySnapshots(): SafetySnapshots & { wipe(): Promise<void> } {
  const db = new SafetyDb();
  return {
    /** "Delete all data" (DAT-13): deletes `powr-safety`; the instance stays closed. */
    wipe: () => db.delete(),
    async save(snapshot) {
      await db.snapshots.add({
        fileName: snapshot.fileName,
        bytes: snapshot.bytes,
        reason: snapshot.reason,
        at: toIsoWithOffset(snapshot.at),
      });
    },
    async list() {
      // oxlint-disable-next-line unicorn/no-array-reverse -- a Dexie collection, not an array
      const all = await db.snapshots.orderBy('id').reverse().toArray();
      return all.map(({ id, fileName, reason, at, bytes }) => ({
        id: id!,
        fileName,
        reason,
        at,
        size: bytes.byteLength,
      }));
    },
    async read(id) {
      return (await db.snapshots.get(id))?.bytes;
    },
    async delete(id) {
      await db.snapshots.delete(id);
    },
  };
}
