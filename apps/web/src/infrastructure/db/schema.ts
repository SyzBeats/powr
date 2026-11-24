import { Dexie, type DexieOptions, type Table } from 'dexie';

import type { LoggedSet, Session } from '@powr/domain';
import {
  MIGRATIONS,
  migrateRecord,
  type MetaRecord,
  type MigrationChain,
  type SettingsRecord,
} from '@powr/formats';

export interface SchemaVersion {
  readonly version: number;
  /** Dexie store syntax: primary key first, then indexes; null deletes a table. */
  readonly stores: Readonly<Record<string, string | null>>;
}

/**
 * Store definitions per dataVersion (§8.2.2). Never edit a released entry; add a new version
 * and, if record shapes change, a step in the @powr/formats migration chain.
 * M0 holds the four tables of the walking skeleton; the remaining MVP tables join before release.
 */
export const SCHEMA_HISTORY: readonly SchemaVersion[] = [
  {
    version: 1,
    stores: {
      meta: 'key',
      settings: 'id',
      sessions: 'id, localDate, status, startedAt.epochMs',
      sets: 'id, sessionId, [exerciseId+performedAt.epochMs], localDate',
    },
  },
];

export interface PowrDbOptions {
  readonly name?: string;
  readonly history?: readonly SchemaVersion[];
  readonly migrations?: MigrationChain;
  /** For tests: an alternative IndexedDB implementation. */
  readonly indexedDB?: DexieOptions['indexedDB'];
  readonly IDBKeyRange?: DexieOptions['IDBKeyRange'];
}

export class PowrDb extends Dexie {
  declare meta: Table<MetaRecord, string>;
  declare settings: Table<SettingsRecord, string>;
  declare sessions: Table<Session, string>;
  declare sets: Table<LoggedSet, string>;

  constructor(options: PowrDbOptions = {}) {
    super(options.name ?? 'powr', {
      // Raw user data must be on disk before the commit is reported (§8.2.4, Chrome 121+ default is relaxed).
      chromeTransactionDurability: 'strict',
      ...(options.indexedDB ? { indexedDB: options.indexedDB } : {}),
      ...(options.IDBKeyRange ? { IDBKeyRange: options.IDBKeyRange } : {}),
    });
    defineVersions(this, options.history ?? SCHEMA_HISTORY, options.migrations ?? MIGRATIONS);
  }
}

/**
 * Registers every schema version. Upgrades run the shared record-migration chain inside the
 * versionchange transaction, so a throwing migration leaves the old version intact (§8.2.3).
 */
function defineVersions(db: Dexie, history: readonly SchemaVersion[], chain: MigrationChain): void {
  for (const { version, stores } of history) {
    const declared = db.version(version).stores(stores);
    if (version === 1) continue;
    declared.upgrade(async (tx) => {
      for (const table of tx.storeNames) {
        await tx
          .table(table)
          .toCollection()
          .modify((record, ref) => {
            const migrated = migrateRecord(table, record, version - 1, chain, version);
            if (migrated === null) delete (ref as { value?: unknown }).value;
            else ref.value = migrated;
          });
      }
    });
  }
}
