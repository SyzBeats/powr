import { SESSION_DEFAULTS } from '@powr/domain';

import { DATA_VERSION } from '../version';

/** Migrates one record of `table` by one version. Returning null drops the record. */
export type RecordMigration = (table: string, record: unknown) => unknown;

/**
 * The single record-migration chain (§8.2.3): `MIGRATIONS[n]` takes records from dataVersion n
 * to n + 1. Used by the Dexie upgrade and by backup import, so each change is implemented once.
 * Style: expand -> migrate -> contract; never repurpose a field.
 */
export type MigrationChain = Readonly<Record<number, RecordMigration>>;

/**
 * The M3a session-core fields with their empty values, for a session record that has none (a v1
 * record, or a version-2 record written by an M2 build before M3a amended version 2). Idempotent:
 * fields that exist are kept.
 */
export function withSessionDefaults<T extends object>(record: T): T {
  const missing = Object.fromEntries(
    Object.entries(SESSION_DEFAULTS).filter(([key]) => !(key in record)),
  );
  return Object.keys(missing).length === 0 ? record : { ...missing, ...record };
}

/**
 * 1 → 2 (M2, TD-19; amended in M3a while version 2 was unreleased): eight new tables (profile,
 * equipment profiles, plans, planned sessions, breaks, meets, bodyweights, readiness), optional
 * settings fields (`weekStart`, `overrides`, `session`) and optional set fields; sessions gain the
 * session core (slots, cursor, timer, readiness, undo), empty for a v1 session. Every other v1
 * record passes through unchanged.
 */
const v1ToV2: RecordMigration = (table, record) =>
  table === 'sessions' && record !== null && typeof record === 'object'
    ? withSessionDefaults(record)
    : record;

export const MIGRATIONS: MigrationChain = { 1: v1ToV2 };

export function migrateRecord(
  table: string,
  record: unknown,
  fromVersion: number,
  chain: MigrationChain = MIGRATIONS,
  toVersion: number = DATA_VERSION,
): unknown {
  let current = record;
  for (let version = fromVersion; version < toVersion && current !== null; version++) {
    const step = chain[version];
    if (!step) throw new Error(`No record migration from dataVersion ${version}`);
    current = step(table, current);
  }
  return current;
}

/** Migrates every record of every table; dropped records are removed. */
export function migrateTables<T extends Record<string, unknown[]>>(
  tables: T,
  fromVersion: number,
  chain: MigrationChain = MIGRATIONS,
  toVersion: number = DATA_VERSION,
): T {
  const migrated: Record<string, unknown[]> = {};
  for (const [table, records] of Object.entries(tables)) {
    migrated[table] = records
      .map((record) => migrateRecord(table, record, fromVersion, chain, toVersion))
      .filter((record) => record !== null);
  }
  return migrated as T;
}
