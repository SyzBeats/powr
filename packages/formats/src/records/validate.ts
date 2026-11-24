import type { z } from '../zod';
import { RAW_TABLE_NAMES, type RawTableName, type RawTables } from './tables';
import {
  bodyweightRecordSchema,
  breakRecordSchema,
  equipmentProfileRecordSchema,
  meetRecordSchema,
  metaRecordSchema,
  plannedSessionRecordSchema,
  planRecordSchema,
  profileRecordSchema,
  readinessRecordSchema,
  sessionRecordSchema,
  setRecordSchema,
  settingsRecordSchema,
} from './v2';

/** The strict Zod schema of every raw table at the current DATA_VERSION. */
const RAW_TABLE_SCHEMAS = {
  meta: metaRecordSchema,
  settings: settingsRecordSchema,
  sessions: sessionRecordSchema,
  sets: setRecordSchema,
  profile: profileRecordSchema,
  equipmentProfiles: equipmentProfileRecordSchema,
  plans: planRecordSchema,
  plannedSessions: plannedSessionRecordSchema,
  breaks: breakRecordSchema,
  meets: meetRecordSchema,
  bodyweights: bodyweightRecordSchema,
  readiness: readinessRecordSchema,
} as const satisfies Record<RawTableName, z.ZodType>;

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
    const schema = RAW_TABLE_SCHEMAS[table];
    tables[table] = input[table].map((record, index) => {
      const result = schema.safeParse(record);
      if (!result.success) issues.push({ table, index, message: result.error.message });
      return result.data;
    });
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, tables: tables as RawTables };
}
