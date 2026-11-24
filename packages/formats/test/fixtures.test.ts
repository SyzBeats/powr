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

  it('v1/active-session.zip (made by M1) restores its records, the active session gaining an empty session core', async () => {
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
    // dataVersion 1 → 2 (M3a): the session core fields arrive empty; nothing else changes.
    for (const session of tables.sessions) {
      expect(session).toMatchObject({
        origin: 'freestyle',
        exercises: [],
        cursor: null,
        timer: null,
        revision: 0,
        undo: null,
      });
    }
    expect(tables.readiness).toEqual([]);
    expect(tables.sets.map((set) => set.effort)).toEqual([
      { rir: 2, source: 'entered' },
      { rir: null, source: 'none' },
      { rir: 1.5, source: 'entered' },
    ]);
    // Exported again at the current dataVersion, the data round-trips.
    const again = await decodeBackup((await encodeBackup(tables, source)).bytes);
    expect(again.ok && again.backup.tables).toEqual(tables);
  });

  it('v2/m3-active-session.zip (made by M3a) restores the active session with its timer, undo and check-in', async () => {
    const fixture = fixtures().find(
      (entry) => entry.version === 2 && entry.name === 'm3-active-session.zip',
    )!;
    const decoded = await decodeBackup(fixture.bytes);
    if (!decoded.ok) throw new Error(decoded.error.kind);
    const { tables } = decoded.backup;
    const [session] = tables.sessions;
    expect(session).toMatchObject({
      status: 'active',
      cursor: { slotKey: 'a', setKey: 's2' },
      timer: { kind: 'rest', targetMs: 240_000, adjustMs: 15_000 },
      undo: { token: 'u7', removeSetIds: ['set-2'] },
    });
    expect(session!.exercises.map((exercise) => exercise.sets.length)).toEqual([4, 2]);
    expect(tables.sets.map((set) => [set.slotKey, set.setKey, set.type])).toEqual([
      ['a', 'w1', 'warmup'],
      ['a', 's1', 'top'],
    ]);
    expect(tables.readiness[0]!.items).toMatchObject({ sleepHours: 6.5, prs: 5 });
    expect(tables.settings[0]!.session).toMatchObject({
      restMode: 'countup',
      hintsOff: ['failure'],
    });
    const again = await decodeBackup((await encodeBackup(tables, source)).bytes);
    expect(again.ok && again.backup.tables).toEqual(tables);
  });
});
