import type { LoggedSet, Session } from '@powr/domain';

import type { z } from '../zod';
import { metaRecordSchema, sessionRecordSchema, setRecordSchema, settingsRecordSchema } from './v1';

export type MetaRecord = z.infer<typeof metaRecordSchema>;
export type SettingsRecord = z.infer<typeof settingsRecordSchema>;
export type ThemePreference = SettingsRecord['theme'];

/** Records of every raw (backed-up) table at the current DATA_VERSION. */
export interface RawRecordMap {
  meta: MetaRecord;
  settings: SettingsRecord;
  sessions: Session;
  sets: LoggedSet;
}

export type RawTableName = keyof RawRecordMap;
export type RawTables = { [T in RawTableName]: RawRecordMap[T][] };

/** Raw tables and their primary keys, in backup order. Derived tables are never listed here. */
export const RAW_TABLES = {
  meta: { primaryKey: 'key', schema: metaRecordSchema },
  settings: { primaryKey: 'id', schema: settingsRecordSchema },
  sessions: { primaryKey: 'id', schema: sessionRecordSchema },
  sets: { primaryKey: 'id', schema: setRecordSchema },
} as const satisfies Record<RawTableName, { primaryKey: string; schema: z.ZodType }>;

export const RAW_TABLE_NAMES = Object.keys(RAW_TABLES) as RawTableName[];

export type RecordIssue = { table: RawTableName; index: number; message: string };

/**
 * Validates untrusted records strictly (unknown keys are errors, numbers are range-checked).
 * Valid records are returned with their domain types; the ID brands are applied here.
 */
export function validateRawTables(input: { [T in RawTableName]: unknown[] }):
  | { ok: true; tables: RawTables }
  | { ok: false; issues: RecordIssue[] } {
  const issues: RecordIssue[] = [];
  const tables = {} as Record<RawTableName, unknown[]>;
  for (const table of RAW_TABLE_NAMES) {
    const { schema } = RAW_TABLES[table];
    tables[table] = input[table].map((record, index) => {
      const result = schema.safeParse(record);
      if (!result.success) issues.push({ table, index, message: result.error.message });
      return result.data;
    });
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, tables: tables as RawTables };
}

export function emptyRawTables(): RawTables {
  return { meta: [], settings: [], sessions: [], sets: [] };
}
