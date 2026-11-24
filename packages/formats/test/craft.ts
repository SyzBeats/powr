import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { emptyRawTables, type RawTableName } from '../src';
import { encodeBackup, type BackupSource } from '../src/backup';
import { contentDigest, sha256Hex } from '../src/backup/hash';

export const source: BackupSource = {
  app: { version: '0.0.0', build: 'test' },
  rulesVersion: '0.0.0+m0',
  contentVersion: '0.0.0+m0',
  createdAt: { epochMs: 1_795_456_000_000, offsetMin: 60, zone: 'Europe/Zurich' },
  backupId: '019ab3c4-0000-7000-8000-000000000000',
};

export interface CraftOptions {
  /** Raw text of data files, written as is. Other tables stay empty arrays. */
  readonly data?: Partial<Record<RawTableName, string>>;
  /** Edits the manifest text after every hash was recomputed. */
  readonly manifest?: (json: string) => string;
  /** Extra ZIP entries; see {@link renameEntry} for names an object key cannot carry. */
  readonly extra?: Record<string, Uint8Array>;
}

/**
 * A backup as an attacker would build it: arbitrary data files with every size, hash and the
 * content digest recomputed, so only validation (not the checksums) stands between the file and
 * the database (§8.3.3).
 */
export async function craftBackup(options: CraftOptions = {}): Promise<Uint8Array> {
  const { bytes } = await encodeBackup(emptyRawTables(), source);
  const files = unzipSync(bytes);
  for (const [table, text] of Object.entries(options.data ?? {})) {
    files[`data/${table}.json`] = strToU8(text);
  }
  const manifest = JSON.parse(strFromU8(files['manifest.json']!)) as {
    entries: { path: string; bytes: number; records: number; sha256: string }[];
    contentDigest: string;
  };
  for (const entry of manifest.entries) {
    const data = files[entry.path]!;
    entry.bytes = data.length;
    entry.sha256 = await sha256Hex(data);
  }
  manifest.contentDigest = await contentDigest(manifest.entries);
  const text = JSON.stringify(manifest);
  files['manifest.json'] = strToU8(options.manifest ? options.manifest(text) : text);
  return zipSync({ ...files, ...options.extra });
}

/**
 * Renames a ZIP entry in place by patching its name in the local header and the central
 * directory (names are stored uncompressed and are not covered by the CRC). Needed for names
 * such as `__proto__`, which no object literal passed to `zipSync` can carry, and for duplicates.
 */
export function renameEntry(zip: Uint8Array, from: string, to: string): Uint8Array {
  const needle = strToU8(from);
  const replacement = strToU8(to);
  if (needle.length !== replacement.length) throw new Error('Names must have the same length');
  const patched = zip.slice();
  let hits = 0;
  for (let index = 0; index + needle.length <= patched.length; index++) {
    if (needle.every((byte, offset) => patched[index + offset] === byte)) {
      patched.set(replacement, index);
      hits++;
    }
  }
  if (hits !== 2)
    throw new Error(`Expected the name twice (local and central header), saw ${hits}`);
  return patched;
}
