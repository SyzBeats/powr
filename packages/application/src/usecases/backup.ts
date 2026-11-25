import type { ExerciseId } from '@powr/domain';
import { RAW_TABLE_NAMES, type RawTableName } from '@powr/formats';
import {
  decodeBackup,
  encodeBackup,
  type BackupError,
  type DecodedBackup,
  type EncodedBackup,
} from '@powr/formats/backup';

import type { Deps } from '../deps';
import { DERIVED_TABLE_NAMES } from '../ports';
import { err, ok, type Result } from '../result';
import { syncCustomExercises } from './custom-content';

export type { BackupError, DecodedBackup, ImportPreview } from '@powr/formats/backup';

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
