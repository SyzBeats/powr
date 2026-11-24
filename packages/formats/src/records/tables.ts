import type { LoggedSet, Session } from '@powr/domain';

import type { z } from '../zod';
import type { metaRecordSchema, settingsRecordSchema } from './v1';

// Schema-free on purpose: the app's startup path (Dexie repositories, boot) imports this module
// through the package root, while the Zod record schemas load only with the backup code path
// (`@powr/formats/backup`, technical concept §6.4/§8.19). Type-only imports above are erased.

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
export const RAW_TABLE_KEYS = {
  meta: 'key',
  settings: 'id',
  sessions: 'id',
  sets: 'id',
} as const satisfies Record<RawTableName, string>;

export const RAW_TABLE_NAMES = Object.keys(RAW_TABLE_KEYS) as RawTableName[];

export function emptyRawTables(): RawTables {
  return { meta: [], settings: [], sessions: [], sets: [] };
}
