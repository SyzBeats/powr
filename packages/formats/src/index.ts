// The package root is on the app's startup path, so it exports nothing that loads Zod or fflate.
// The backup codec and the record schemas are a separate entry, `@powr/formats/backup`, which the
// app loads lazily on the first export or import (technical concept §6.4, §8.19).
export {
  MIGRATIONS,
  migrateRecord,
  migrateTables,
  withSessionDefaults,
  type MigrationChain,
  type RecordMigration,
} from './migrations';
export {
  RAW_TABLE_KEYS,
  RAW_TABLE_NAMES,
  emptyRawTables,
  type MetaRecord,
  type RawRecordMap,
  type RawTableName,
  type RawTables,
  type SettingsRecord,
  type ThemePreference,
} from './records/tables';
export { DATA_VERSION } from './version';
