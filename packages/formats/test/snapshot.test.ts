import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { decodeBackup, encodeRawSnapshot } from '../src/backup';
import { source } from './craft';

// This package has no Node types on purpose (src stays environment-free); the test reads the
// committed fixture through Node's built-in module loader instead.
const fs = (
  globalThis as unknown as {
    process: { getBuiltinModule(id: 'node:fs'): { readFileSync(path: URL): Uint8Array } };
  }
).process.getBuiltinModule('node:fs');

/** The raw tables of the committed v1 fixture, as a v1 database would hold them. */
function v1Tables(): Record<string, unknown[]> {
  const files = unzipSync(
    fs.readFileSync(new URL('../fixtures/backups/v1/active-session.zip', import.meta.url)),
  );
  const tables: Record<string, unknown[]> = {};
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith('data/')) continue;
    tables[path.slice('data/'.length, -'.json'.length)] = JSON.parse(strFromU8(bytes)) as unknown[];
  }
  return tables;
}

describe('raw snapshots of an older database (DAT-14 safety copy and rescue copy)', () => {
  it('encodes v1 records as a v1 backup that the current import migrates', async () => {
    const tables = v1Tables();
    const snapshot = await encodeRawSnapshot(
      {
        dataVersion: 1,
        // A derived cache and an unknown store are not backed up.
        tables: { ...tables, dExerciseState: [{ exerciseId: 'ex.squat' }], legacy: [{ id: 1 }] },
      },
      source,
    );
    expect(snapshot.manifest.dataVersion).toBe(1);
    expect(snapshot.manifest.entries.map((entry) => entry.path).toSorted()).toEqual(
      Object.keys(tables)
        .map((table) => `data/${table}.json`)
        .toSorted(),
    );
    expect(snapshot.fileName).toMatch(/^powr-backup-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/);

    const decoded = await decodeBackup(snapshot.bytes);
    if (!decoded.ok) throw new Error(decoded.error.kind);
    expect(decoded.backup.preview.dataVersion).toBe(1);
    expect(decoded.backup.tables.sessions).toHaveLength(tables['sessions']!.length);
    expect(decoded.backup.tables.sets).toHaveLength(tables['sets']!.length);
    // The 1 → 2 step ran: the v1 session gained the session core.
    expect(decoded.backup.tables.sessions[0]).toMatchObject({ exercises: [], revision: 0 });
  });

  it('keeps a record that import would reject, instead of losing it', async () => {
    const hostile = JSON.parse('{"key":"note","value":{"__proto__":{"x":1}}}') as unknown;
    const snapshot = await encodeRawSnapshot(
      { dataVersion: 2, tables: { meta: [hostile], settings: [{ id: 'me', theme: 'dark' }] } },
      source,
    );
    const meta = strFromU8(unzipSync(snapshot.bytes)['data/meta.json']!);
    expect(meta).toContain('"__proto__":{"x":1}');
    const decoded = await decodeBackup(snapshot.bytes);
    expect(decoded).toMatchObject({ ok: false, error: { kind: 'invalidData' } });
  });

  it('skips values that are not records and refuses an invalid dataVersion', async () => {
    const snapshot = await encodeRawSnapshot(
      { dataVersion: 2, tables: { settings: [{ id: 'me', theme: 'dark' }, 42, null, ['x']] } },
      source,
    );
    expect(snapshot.manifest.counts).toEqual({ settings: 1 });
    await expect(encodeRawSnapshot({ dataVersion: 0, tables: {} }, source)).rejects.toThrow(
      /dataVersion/,
    );
    await expect(encodeRawSnapshot({ dataVersion: 1.5, tables: {} }, source)).rejects.toThrow(
      /dataVersion/,
    );
  });
});
