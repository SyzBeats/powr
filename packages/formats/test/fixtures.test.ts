import { describe, expect, it } from 'vitest';

import { DATA_VERSION, RAW_TABLE_NAMES } from '../src';
import { decodeBackup, encodeBackup } from '../src/backup';
import { source } from './craft';

// This package has no Node types on purpose (src stays environment-free); the test reads the
// committed fixture files through Node's built-in module loader instead.
const fs = (
  globalThis as unknown as {
    process: {
      getBuiltinModule(id: 'node:fs'): {
        readFileSync(path: URL): Uint8Array;
        readdirSync(path: URL): string[];
      };
    };
  }
).process.getBuiltinModule('node:fs');

const FIXTURES = new URL('../fixtures/backups/', import.meta.url);

/** Every committed backup fixture, by dataVersion (§8.3.4: kept forever, imported in CI). */
function fixtures(): { version: number; name: string; bytes: Uint8Array }[] {
  return fs.readdirSync(FIXTURES).flatMap((dir) =>
    fs.readdirSync(new URL(`${dir}/`, FIXTURES)).map((name) => ({
      version: Number(dir.slice(1)),
      name,
      bytes: fs.readFileSync(new URL(`${dir}/${name}`, FIXTURES)),
    })),
  );
}

describe('backup fixtures of every dataVersion (NFR-MNT-03, DAT-07)', () => {
  it('has fixtures for every released dataVersion before this one', () => {
    const versions = new Set(fixtures().map((fixture) => fixture.version));
    for (let version = 1; version < DATA_VERSION; version++)
      expect(versions.has(version)).toBe(true);
  });

  it.each(fixtures())(
    'imports v$version/$name with the migration chain',
    async ({ version, bytes }) => {
      const decoded = await decodeBackup(bytes);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) return;
      expect(decoded.backup.preview.dataVersion).toBe(version);
      for (const table of RAW_TABLE_NAMES)
        expect(Array.isArray(decoded.backup.tables[table])).toBe(true);
    },
  );

  it('v1/active-session.zip (made by M1) restores its records unchanged, the active session included', async () => {
    const fixture = fixtures().find(
      (entry) => entry.version === 1 && entry.name === 'active-session.zip',
    )!;
    const decoded = await decodeBackup(fixture.bytes);
    if (!decoded.ok) throw new Error(decoded.error.kind);
    const { tables, preview } = decoded.backup;
    expect(preview.counts).toMatchObject({
      meta: 2,
      settings: 1,
      sessions: 2,
      sets: 3,
      plans: 0,
      profile: 0,
    });
    expect(tables.settings).toEqual([{ id: 'me', theme: 'dark' }]);
    expect(
      tables.sessions.filter((session) => session.status === 'active').map((session) => session.id),
    ).toEqual(['019ab000-0000-7000-8000-000000000002']);
    expect(tables.sets.map((set) => set.effort)).toEqual([
      { rir: 2, source: 'entered' },
      { rir: null, source: 'none' },
      { rir: 1.5, source: 'entered' },
    ]);
    // Exported again at the current dataVersion, the data round-trips.
    const again = await decodeBackup((await encodeBackup(tables, source)).bytes);
    expect(again.ok && again.backup.tables).toEqual(tables);
  });
});
