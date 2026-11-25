import type { ExerciseId } from '@powr/domain';
import { RAW_TABLE_NAMES, type RawTableName } from '@powr/formats';
import {
  decodeBackup,
  encodeBackup,
  encodeRawSnapshot,
  type BackupError,
  type DecodedBackup,
  type EncodedBackup,
  type RawSnapshot,
} from '@powr/formats/backup';

import type { Deps } from '../deps';
import {
  DERIVED_TABLE_NAMES,
  type AppInfo,
  type Clock,
  type FileGateway,
  type IdGenerator,
  type SafetySnapshots,
} from '../ports';
import { err, ok, type Result } from '../result';
import { syncCustomExercises } from './custom-content';

export type { BackupError, DecodedBackup, ImportPreview, RawSnapshot } from '@powr/formats/backup';

export interface ExportResult {
  readonly fileName: string;
  readonly delivery: 'saved' | 'downloaded';
  readonly bytes: number;
  readonly counts: Readonly<Record<RawTableName, number>>;
}

/**
 * Exports every raw table from one read-only transaction (a consistent snapshot), hands the
 * ZIP to the file gateway and records `meta.lastBackup` (§6.4). Never uses Web Share.
 */
export async function exportBackup(
  deps: Deps,
): Promise<Result<ExportResult, { kind: 'cancelled' }>> {
  const encoded = await encodeCurrentData(deps);
  const delivery = await deps.files.save({
    name: encoded.fileName,
    bytes: encoded.bytes,
    mime: 'application/zip',
  });
  if (delivery === 'cancelled') return err({ kind: 'cancelled' });

  const { createdAt } = encoded.manifest;
  const counts = Object.fromEntries(
    RAW_TABLE_NAMES.map((table) => [table, encoded.manifest.counts[table] ?? 0]),
  ) as Record<RawTableName, number>;
  await deps.uow.write(['meta'], (repos) =>
    repos.meta.put({
      key: 'lastBackup',
      value: { at: createdAt, counts, bytes: encoded.bytes.length },
    }),
  );
  return ok({ fileName: encoded.fileName, delivery, bytes: encoded.bytes.length, counts });
}

/** Validates a backup file completely and returns what a restore would contain. Writes nothing. */
export async function previewImport(
  deps: Deps,
  bytes: Uint8Array,
): Promise<Result<DecodedBackup, BackupError>> {
  const result = await decodeBackup(bytes, {
    isKnownExercise: (id) => deps.content.exercise(id as ExerciseId) !== undefined,
  });
  return result.ok ? ok(result.backup) : err(result.error);
}

export interface ImportResult {
  readonly counts: Readonly<Record<RawTableName, number>>;
  readonly safetySnapshot: string;
}

/**
 * Replace-all restore (DAT-06): a safety snapshot of the current data first, then one strict
 * transaction that clears and refills every raw table. It either fully applies or changes nothing.
 */
export async function applyImport(deps: Deps, backup: DecodedBackup): Promise<ImportResult> {
  const snapshot = await encodeCurrentData(deps);
  await deps.safety.save({
    fileName: snapshot.fileName,
    bytes: snapshot.bytes,
    reason: 'import',
    at: deps.clock.now(),
  });

  // Derived tables are cleared with the raw data (rebuilt from it on use, §8.2.8 "Import").
  await deps.uow.write([...RAW_TABLE_NAMES, ...DERIVED_TABLE_NAMES], (repos) =>
    repos.raw.replaceAll(backup.tables),
  );

  // EXL-04 (M4a): the restored custom exercises replace the catalog's.
  syncCustomExercises(deps, backup.tables.customExercises);
  const active = backup.tables.sessions.find((session) => session.status === 'active');
  await deps.runtime.setActiveSession(active ? { id: active.id, build: deps.app.build } : null);
  return { counts: backup.preview.counts, safetySnapshot: snapshot.fileName };
}

/**
 * What the data-update guard (DAT-14) has before the database is open: no unit of work and no
 * content catalog yet, only the platform ports and the versions to stamp on the file.
 */
export interface UpgradeEnv {
  readonly app: AppInfo;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly safety: SafetySnapshots;
  readonly files: FileGateway;
  readonly rulesVersion: string;
  readonly contentVersion: string;
}

/**
 * DAT-14, §6.7 step 3: before a data update runs, the raw records at their stored `dataVersion`
 * go into `powr-safety` as a regular (older-version) backup, which the import path migrates like
 * any old file. Throws if the copy cannot be written: the update must not run without it.
 */
export async function snapshotBeforeUpgrade(
  env: UpgradeEnv,
  raw: RawSnapshot,
): Promise<{ readonly fileName: string; readonly bytes: number }> {
  const encoded = await encodeRaw(env, raw);
  await env.safety.save({
    fileName: encoded.fileName,
    bytes: encoded.bytes,
    reason: 'migration',
    at: env.clock.now(),
  });
  return { fileName: encoded.fileName, bytes: encoded.bytes.length };
}

/**
 * The recovery screen's "Save a copy of your data" (DAT-14, §6.8): the raw records exactly as
 * stored, as a backup file of their `dataVersion`, handed to the file gateway (download).
 */
export async function saveRescueCopy(
  env: UpgradeEnv,
  raw: RawSnapshot,
): Promise<{ readonly fileName: string; readonly delivery: 'saved' | 'downloaded' | 'cancelled' }> {
  const encoded = await encodeRaw(env, raw);
  const delivery = await env.files.save({
    name: encoded.fileName,
    bytes: encoded.bytes,
    mime: 'application/zip',
  });
  return { fileName: encoded.fileName, delivery };
}

function encodeRaw(env: UpgradeEnv, raw: RawSnapshot): Promise<EncodedBackup> {
  return encodeRawSnapshot(raw, {
    app: env.app,
    rulesVersion: env.rulesVersion,
    contentVersion: env.contentVersion,
    createdAt: env.clock.now(),
    backupId: env.ids.next(),
  });
}

async function encodeCurrentData(deps: Deps): Promise<EncodedBackup> {
  const tables = await deps.uow.read(RAW_TABLE_NAMES, (repos) => repos.raw.readAll());
  const createdAt = deps.clock.now();
  return encodeBackup(tables, {
    app: deps.app,
    rulesVersion: deps.rules.version,
    contentVersion: deps.content.version,
    createdAt,
    backupId: deps.ids.next(),
  });
}
