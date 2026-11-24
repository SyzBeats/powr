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

const KEEP = 2;

/** `powr-safety`: the latest safety snapshots taken before imports and migrations (§8.2.1). */
class SafetyDb extends Dexie {
  declare snapshots: Table<SafetySnapshot, number>;

  constructor() {
    super('powr-safety', { chromeTransactionDurability: 'strict' });
    this.version(1).stores({ snapshots: '++id, at' });
  }
}

export function createSafetySnapshots(): SafetySnapshots {
  const db = new SafetyDb();
  return {
    async save(snapshot) {
      await db.transaction('rw', db.snapshots, async () => {
        await db.snapshots.add({
          fileName: snapshot.fileName,
          bytes: snapshot.bytes,
          reason: snapshot.reason,
          at: toIsoWithOffset(snapshot.at),
        });
        const ids = await db.snapshots.orderBy('id').primaryKeys();
        await db.snapshots.bulkDelete(ids.slice(0, Math.max(0, ids.length - KEEP)));
      });
    },
  };
}
