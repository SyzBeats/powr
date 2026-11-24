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
 * 1 → 2 (M2, TD-19): seven new tables (profile, equipment profiles, plans, planned sessions,
 * breaks, meets, bodyweights) and two optional settings fields (`weekStart`, `overrides`). Every
 * v1 record is already valid at v2, so the step passes records through unchanged; it exists so
 * that the Dexie upgrade and backup import walk the chain like for any later version.
 */
const v1ToV2: RecordMigration = (_table, record) => record;

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
