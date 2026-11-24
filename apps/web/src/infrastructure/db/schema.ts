import { Dexie, type DexieOptions, type Table } from 'dexie';

import type {
  BodyweightEntry,
  EquipmentProfile,
  LoggedSet,
  MeetInfo,
  Plan,
  PlannedSession,
  Profile,
  ReadinessEntry,
  Session,
  TrainingBreak,
} from '@powr/domain';
import type { ExerciseState, PrRecord, SessionE1rmPoint } from '@powr/domain/session';
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
 * v1: the four tables of the walking skeleton (M0). v2 (M2, TD-19: a new version, not an
 * extended v1, because IndexedDB creates stores only in a version change and M0/M1 builds may
 * hold v1 data): onboarding and planning. Indexes follow the hot queries: the active plan
 * (`status`), the calendar and week view (`localDate`, `[planId+localDate]`), breaks by start.
 * Booleans are not valid IndexedDB keys, so `equipmentProfiles.isDefault` is not indexed.
 * M3a amended version 2 while it was unreleased: `sessions.plannedSessionId`, the raw table
 * `readiness` (check-ins by day and session) and the derived tables `dExerciseState`,
 * `dSessionE1rm` (one point per exercise and session, charts read it by exercise and day) and
 * `dPrs` (by exercise, set, session, day and type), §8.2.2.
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
  {
    version: 2,
    stores: {
      meta: 'key',
      settings: 'id',
      sessions: 'id, localDate, status, startedAt.epochMs, plannedSessionId',
      sets: 'id, sessionId, [exerciseId+performedAt.epochMs], localDate',
      profile: 'id',
      equipmentProfiles: 'id',
      plans: 'id, status',
      plannedSessions: 'id, localDate, [planId+localDate], status',
      breaks: 'id, startDate',
      meets: 'id, date',
      bodyweights: 'id, localDate, measuredAt.epochMs',
      readiness: 'id, localDate, sessionId',
      dExerciseState: 'exerciseId',
      dSessionE1rm: '[exerciseId+sessionId], [exerciseId+localDate], sessionId',
      dPrs: 'id, exerciseId, setId, sessionId, localDate, type',
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
  declare profile: Table<Profile, string>;
  declare equipmentProfiles: Table<EquipmentProfile, string>;
  declare plans: Table<Plan, string>;
  declare plannedSessions: Table<PlannedSession, string>;
  declare breaks: Table<TrainingBreak, string>;
  declare meets: Table<MeetInfo, string>;
  declare bodyweights: Table<BodyweightEntry, string>;
  declare readiness: Table<ReadinessEntry, string>;
  declare dExerciseState: Table<ExerciseState, string>;
  declare dSessionE1rm: Table<SessionE1rmPoint, [string, string]>;
  declare dPrs: Table<PrRecord, string>;

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
