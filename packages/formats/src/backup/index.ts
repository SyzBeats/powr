// `@powr/formats/backup`: the backup codec with its Zod schemas and fflate. Loaded lazily by the
// app (only through `@powr/application/backup`), never on the startup path (§6.4, §8.19).
export {
  decodeBackup,
  type BackupError,
  type DecodeOptions,
  type DecodeResult,
  type DecodedBackup,
  type ImportPreview,
} from './decode';
export { backupFileName, encodeBackup, type BackupSource, type EncodedBackup } from './encode';
export { DEFAULT_ARCHIVE_LIMITS, type ArchiveLimits } from './limits';
export { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, type BackupManifest } from './manifest';
export { validateRawTables, type RecordIssue } from '../records/validate';
