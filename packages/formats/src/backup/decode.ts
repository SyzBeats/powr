import { strFromU8, unzipSync } from 'fflate';

import { RESERVED_KEYS, parseUntrustedJson, type JsonParseResult } from '../json';
import { MIGRATIONS, migrateTables, type MigrationChain } from '../migrations';
import { RAW_TABLE_NAMES, type RawTableName, type RawTables } from '../records/tables';
import { validateRawTables } from '../records/validate';
import { DATA_VERSION } from '../version';
import { contentDigest, sha256Hex } from './hash';
import { DEFAULT_ARCHIVE_LIMITS, type ArchiveLimits } from './limits';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  manifestHeaderSchema,
  manifestSchema,
  type BackupManifest,
} from './manifest';

export type BackupError =
  | { readonly kind: 'tooLarge' }
  | { readonly kind: 'notZip' }
  | { readonly kind: 'unsafeArchive'; readonly reason: string }
  | { readonly kind: 'notAPowrBackup' }
  | { readonly kind: 'newerVersion' }
  | { readonly kind: 'invalidManifest'; readonly detail: string }
  | { readonly kind: 'checksumMismatch'; readonly path: string }
  | { readonly kind: 'invalidData'; readonly detail: string }
  | { readonly kind: 'brokenReference'; readonly detail: string };

export interface ImportPreview {
  readonly createdAt: string;
  readonly appVersion: string;
  readonly dataVersion: number;
  readonly counts: Readonly<Record<RawTableName, number>>;
  readonly dateRange: { readonly from: string | null; readonly to: string | null };
}

export interface DecodedBackup {
  readonly manifest: BackupManifest;
  /** Migrated to the current DATA_VERSION and validated strictly. */
  readonly tables: RawTables;
  readonly preview: ImportPreview;
}

export interface DecodeOptions {
  readonly limits?: ArchiveLimits;
  readonly migrations?: MigrationChain;
  /** Every set's exercise must resolve to built-in content or a custom exercise. */
  readonly isKnownExercise?: (exerciseId: string) => boolean;
}

export type DecodeResult =
  | { readonly ok: true; readonly backup: DecodedBackup }
  | { readonly ok: false; readonly error: BackupError };

const MANIFEST_PATH = 'manifest.json';
const README_PATH = 'README.txt';

/**
 * Reads an untrusted backup. Order (§8.3.3): ZIP structure -> manifest -> content digest ->
 * entry hashes -> migration -> record schemas -> referential integrity. Nothing is written.
 * Every JSON file is checked for reserved keys and nesting depth before any schema sees it
 * (§8.3.5, `../json.ts`), and entry names never become keys of a plain object.
 */
export async function decodeBackup(
  bytes: Uint8Array,
  options: DecodeOptions = {},
): Promise<DecodeResult> {
  const limits = options.limits ?? DEFAULT_ARCHIVE_LIMITS;
  if (bytes.length > limits.maxArchiveBytes) return fail({ kind: 'tooLarge' });

  const files = unzipWithLimits(bytes, limits);
  if ('error' in files) return fail(files.error);

  const manifestBytes = files.entries.get(MANIFEST_PATH);
  if (!manifestBytes) return fail({ kind: 'notAPowrBackup' });
  const parsedJson = parseJson(manifestBytes);
  if (!parsedJson.ok && parsedJson.problem === 'unsafe') {
    return fail({ kind: 'invalidManifest', detail: parsedJson.reason });
  }
  const manifestJson = parsedJson.ok ? parsedJson.value : undefined;
  const header = manifestHeaderSchema.safeParse(manifestJson);
  if (!header.success || header.data.format !== BACKUP_FORMAT)
    return fail({ kind: 'notAPowrBackup' });
  if (header.data.formatVersion > BACKUP_FORMAT_VERSION || header.data.dataVersion > DATA_VERSION) {
    return fail({ kind: 'newerVersion' });
  }
  const parsedManifest = manifestSchema.safeParse(manifestJson);
  if (!parsedManifest.success) {
    return fail({ kind: 'invalidManifest', detail: parsedManifest.error.message });
  }
  const manifest = parsedManifest.data;

  const listed = new Set([
    MANIFEST_PATH,
    README_PATH,
    ...manifest.entries.map((entry) => entry.path),
  ]);
  const unlisted = [...files.entries.keys()].find((path) => !listed.has(path));
  if (unlisted) return fail({ kind: 'unsafeArchive', reason: `unlisted entry ${unlisted}` });

  if ((await contentDigest(manifest.entries)) !== manifest.contentDigest) {
    return fail({ kind: 'checksumMismatch', path: MANIFEST_PATH });
  }

  const rawTables = {} as Record<RawTableName, unknown[]>;
  for (const table of RAW_TABLE_NAMES) rawTables[table] = [];
  for (const entry of manifest.entries) {
    const data = files.entries.get(entry.path);
    if (!data || data.length !== entry.bytes || (await sha256Hex(data)) !== entry.sha256) {
      return fail({ kind: 'checksumMismatch', path: entry.path });
    }
    const table = entry.path.slice('data/'.length, -'.json'.length);
    if (!isRawTableName(table))
      return fail({ kind: 'invalidData', detail: `unknown table ${table}` });
    const parsed = parseJson(data);
    if (!parsed.ok) return fail({ kind: 'invalidData', detail: `${entry.path}: ${parsed.reason}` });
    const records = parsed.value;
    if (!Array.isArray(records))
      return fail({ kind: 'invalidData', detail: `${entry.path} is not an array` });
    rawTables[table] = records;
  }

  let migrated: Record<RawTableName, unknown[]>;
  try {
    migrated = migrateTables(rawTables, manifest.dataVersion, options.migrations ?? MIGRATIONS);
  } catch (error) {
    return fail({ kind: 'invalidData', detail: `migration failed: ${String(error)}` });
  }

  const validated = validateRawTables(migrated);
  if (!validated.ok) {
    const first = validated.issues[0];
    return fail({
      kind: 'invalidData',
      detail: first ? `${first.table}[${first.index}]: ${first.message}` : 'invalid records',
    });
  }

  const referenceProblem = findBrokenReference(validated.tables, options.isKnownExercise);
  if (referenceProblem) return fail({ kind: 'brokenReference', detail: referenceProblem });

  const counts = {} as Record<RawTableName, number>;
  for (const table of RAW_TABLE_NAMES) counts[table] = validated.tables[table].length;

  return {
    ok: true,
    backup: {
      manifest,
      tables: validated.tables,
      preview: {
        createdAt: manifest.createdAt,
        appVersion: manifest.app.version,
        dataVersion: manifest.dataVersion,
        counts,
        dateRange: manifest.dateRange,
      },
    },
  };
}

type UnzipResult = { entries: ReadonlyMap<string, Uint8Array> } | { error: BackupError };

/**
 * Checks entry names, count, sizes and compression ratios from the central directory before
 * inflating. fflate returns the entries as a plain object keyed by entry name, so a name such as
 * `__proto__` would replace that object's prototype instead of adding an entry (and slip past the
 * unlisted-entry check), and a repeated name would silently replace the earlier entry. Reserved
 * and repeated names are rejected first; the entries are then copied into a Map, and every name
 * from the central directory must arrive there.
 */
function unzipWithLimits(bytes: Uint8Array, limits: ArchiveLimits): UnzipResult {
  const names = new Set<string>();
  let entryCount = 0;
  let totalSize = 0;
  let violation: string | null = null;
  try {
    unzipSync(bytes, {
      filter(file) {
        entryCount++;
        if (RESERVED_KEYS.has(file.name)) violation ??= `reserved entry name ${file.name}`;
        else if (names.has(file.name)) violation ??= `duplicate entry ${file.name}`;
        names.add(file.name);
        totalSize += file.originalSize;
        if (
          file.originalSize > Math.max(file.size, 1) * limits.maxCompressionRatio &&
          file.originalSize > 1024 * 1024
        ) {
          violation ??= `compression ratio of ${file.name}`;
        }
        return false;
      },
    });
  } catch {
    return { error: { kind: 'notZip' } };
  }
  if (entryCount > limits.maxEntries) violation ??= `${entryCount} entries`;
  if (totalSize > limits.maxTotalUncompressedBytes) violation ??= 'total size';
  if (violation) return { error: { kind: 'unsafeArchive', reason: violation } };

  let entries: Map<string, Uint8Array>;
  try {
    entries = new Map(Object.entries(unzipSync(bytes)));
  } catch {
    return { error: { kind: 'notZip' } };
  }
  if (entries.size !== names.size || [...names].some((name) => !entries.has(name))) {
    return { error: { kind: 'unsafeArchive', reason: 'entries lost while unpacking' } };
  }
  return { entries };
}

function findBrokenReference(
  tables: RawTables,
  isKnownExercise: ((exerciseId: string) => boolean) | undefined,
): string | null {
  const sessionIds = new Set(tables.sessions.map((session) => session.id));
  const sessions = new Map(tables.sessions.map((session) => [session.id, session]));
  for (const set of tables.sets) {
    if (!sessionIds.has(set.sessionId)) return `set ${set.id} references a missing session`;
    if (isKnownExercise && !isKnownExercise(set.exerciseId)) {
      return `set ${set.id} references unknown exercise ${set.exerciseId}`;
    }
    // M3a: a set of a slot belongs to a slot and a planned set of its session.
    if (set.slotKey !== undefined) {
      const slot = sessions
        .get(set.sessionId)
        ?.exercises.find((entry) => entry.key === set.slotKey);
      if (!slot) return `set ${set.id} references a missing session exercise`;
      if (set.setKey !== undefined && !slot.sets.some((planned) => planned.key === set.setKey)) {
        return `set ${set.id} references a missing planned set`;
      }
    }
  }
  for (const session of tables.sessions) {
    for (const exercise of session.exercises) {
      if (isKnownExercise && !isKnownExercise(exercise.exerciseId)) {
        return `session ${session.id} references unknown exercise ${exercise.exerciseId}`;
      }
    }
    const keys = new Set(session.exercises.map((exercise) => exercise.key));
    if (keys.size !== session.exercises.length) return `session ${session.id} repeats a slot key`;
    if (session.groups.some((group) => group.slotKeys.some((key) => !keys.has(key)))) {
      return `session ${session.id} groups a missing exercise`;
    }
  }
  for (const entry of tables.readiness) {
    if (entry.sessionId !== undefined && !sessionIds.has(entry.sessionId)) {
      return `readiness check-in ${entry.id} references a missing session`;
    }
  }
  if (tables.sessions.filter((session) => session.status === 'active').length > 1) {
    return 'more than one active session';
  }
  const planIds = new Set<string>(tables.plans.map((plan) => plan.id));
  const profileIds = new Set<string>(tables.equipmentProfiles.map((profile) => profile.id));
  for (const plan of tables.plans) {
    if (!profileIds.has(plan.equipmentProfileId)) {
      return `plan ${plan.id} references a missing equipment profile`;
    }
    for (const slot of plan.mesocycles.flatMap((mesocycle) =>
      mesocycle.days.flatMap((day) => day.slots),
    )) {
      if (isKnownExercise && !isKnownExercise(slot.exerciseId)) {
        return `plan ${plan.id} references unknown exercise ${slot.exerciseId}`;
      }
    }
  }
  if (tables.plans.filter((plan) => plan.status === 'active').length > 1)
    return 'more than one active plan';
  for (const session of tables.plannedSessions) {
    if (!planIds.has(session.planId))
      return `planned session ${session.id} references a missing plan`;
    for (const slot of session.slots) {
      if (isKnownExercise && !isKnownExercise(slot.exerciseId)) {
        return `planned session ${session.id} references unknown exercise ${slot.exerciseId}`;
      }
    }
  }
  if (tables.equipmentProfiles.filter((profile) => profile.isDefault).length > 1) {
    return 'more than one default equipment profile';
  }
  return null;
}

function isRawTableName(name: string): name is RawTableName {
  return (RAW_TABLE_NAMES as string[]).includes(name);
}

function parseJson(bytes: Uint8Array): JsonParseResult {
  return parseUntrustedJson(strFromU8(bytes));
}

function fail(error: BackupError): DecodeResult {
  return { ok: false, error };
}
