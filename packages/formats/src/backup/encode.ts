import { strToU8, zipSync, type Zippable } from 'fflate';

import { toIsoWithOffset, type InstantTz } from '@powr/domain';

import { compareStrings } from '../compare';
import { RAW_TABLE_KEYS, RAW_TABLE_NAMES, type RawTables } from '../records/tables';
import { DATA_VERSION } from '../version';
import { contentDigest, sha256Hex } from './hash';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, type BackupManifest } from './manifest';
import { BACKUP_README } from './readme';

export interface BackupSource {
  readonly app: { readonly version: string; readonly build: string };
  readonly rulesVersion: string;
  readonly contentVersion: string;
  readonly createdAt: InstantTz;
  readonly backupId: string;
}

export interface EncodedBackup {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly manifest: BackupManifest;
}

/**
 * Builds the backup ZIP (§8.3.1): manifest first, one JSON array per raw table sorted by
 * primary key (deterministic output), README last.
 */
export async function encodeBackup(
  tables: RawTables,
  source: BackupSource,
): Promise<EncodedBackup> {
  const dataFiles: Record<string, Uint8Array> = {};
  const entries: BackupManifest['entries'] = [];
  const counts = {} as BackupManifest['counts'];

  for (const table of RAW_TABLE_NAMES) {
    const records = sortByKey(tables[table], RAW_TABLE_KEYS[table]);
    const bytes = strToU8(canonicalJson(records));
    const path = `data/${table}.json`;
    dataFiles[path] = bytes;
    counts[table] = records.length;
    entries.push({
      path,
      bytes: bytes.length,
      records: records.length,
      sha256: await sha256Hex(bytes),
    });
  }

  const createdAt = toIsoWithOffset(source.createdAt);
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    dataVersion: DATA_VERSION,
    app: { version: source.app.version, build: source.app.build },
    rulesVersion: source.rulesVersion,
    contentVersion: source.contentVersion,
    createdAt,
    backupId: source.backupId,
    part: { kind: 'data', index: 1, count: 1 },
    encrypted: false,
    counts,
    dateRange: trainingDateRange(tables),
    entries,
    contentDigest: await contentDigest(entries),
  };

  const archive: Zippable = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    ...dataFiles,
    'README.txt': strToU8(BACKUP_README),
  };
  const bytes = zipSync(archive, { level: 6, mtime: source.createdAt.epochMs });
  return { fileName: backupFileName(createdAt), bytes, manifest };
}

/** `powr-backup-2026-11-23-1804.zip` from the local creation time. */
export function backupFileName(createdAtIso: string): string {
  const date = createdAtIso.slice(0, 10);
  const time = createdAtIso.slice(11, 13) + createdAtIso.slice(14, 16);
  return `powr-backup-${date}-${time}.zip`;
}

function trainingDateRange(tables: RawTables): BackupManifest['dateRange'] {
  const days = tables.sessions.map((session) => session.localDate).toSorted(compareStrings);
  return { from: days[0] ?? null, to: days.at(-1) ?? null };
}

/** JSON with object keys in sorted order, so equal data always gives equal bytes and hashes. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) =>
    nested !== null && typeof nested === 'object' && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).toSorted(([a], [b]) => compareStrings(a, b)))
      : nested,
  );
}

function sortByKey(records: readonly object[], key: string): object[] {
  const keyOf = (record: object) => String((record as Record<string, unknown>)[key]);
  return records.toSorted((a, b) => compareStrings(keyOf(a), keyOf(b)));
}
