import * as fc from 'fast-check';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import type { Plan } from '@powr/domain';

import { RAW_TABLE_NAMES, emptyRawTables, type RawTables } from '../src';
import {
  DEFAULT_ARCHIVE_LIMITS,
  decodeBackup,
  encodeBackup,
  validateRawTables,
  type BackupSource,
} from '../src/backup';
import { plan, rawTables } from './arbitraries';

/** `FC_NUM_RUNS=5000 pnpm vitest run --project formats` for a long run (vitest.setup.ts). */
const runs = (fallback: number) => fc.readConfigureGlobal().numRuns ?? fallback;

const source: BackupSource = {
  app: { version: '0.0.0', build: 'test' },
  rulesVersion: '0.0.0+m0',
  contentVersion: '0.0.0+m0',
  createdAt: { epochMs: 1_795_456_000_000, offsetMin: 60, zone: 'Europe/Zurich' },
  backupId: '019ab3c4-0000-7000-8000-000000000000',
};

const byId = <T extends { id: string }>(records: T[]) =>
  records.toSorted((a, b) => (a.id < b.id ? -1 : 1));

function sorted(tables: RawTables): RawTables {
  return {
    meta: tables.meta.toSorted((a, b) => (a.key < b.key ? -1 : 1)),
    settings: tables.settings,
    sessions: byId(tables.sessions),
    sets: byId(tables.sets),
    profile: tables.profile,
    equipmentProfiles: byId(tables.equipmentProfiles),
    plans: byId(tables.plans),
    plannedSessions: byId(tables.plannedSessions),
    breaks: byId(tables.breaks),
    meets: byId(tables.meets),
    bodyweights: byId(tables.bodyweights),
  };
}

/** Whether a plan record passes the strict v2 schema. */
const validPlan = (record: Plan) => validateRawTables({ ...emptyRawTables(), plans: [record] }).ok;

/** Rewrites entries of an existing backup without touching anything else. */
function rezip(bytes: Uint8Array, change: (files: Record<string, Uint8Array>) => void): Uint8Array {
  const files = unzipSync(bytes);
  change(files);
  return zipSync(files);
}

function sampleTables(): RawTables {
  return {
    ...emptyRawTables(),
    settings: [{ id: 'me', theme: 'dark' }],
    sessions: [
      {
        id: 's1' as never,
        localDate: '2026-11-23' as never,
        startedAt: source.createdAt,
        status: 'finished',
        versions: { engine: '0.0.0', rules: '0.0.0+m0', content: '0.0.0+m0' },
      },
    ],
    sets: [
      {
        id: 'set1' as never,
        sessionId: 's1' as never,
        exerciseId: 'ex.barbell-back-squat' as never,
        index: 0,
        type: 'working',
        load: { value: 120, unit: 'kg' },
        reps: 5,
        effort: { rir: 2, source: 'entered' },
        state: 'done',
        performedAt: source.createdAt,
        localDate: '2026-11-23' as never,
      },
    ],
  };
}

describe('backup round-trip', () => {
  it('restores exactly the exported raw records (QS-05, property)', async () => {
    await fc.assert(
      fc.asyncProperty(rawTables, async (tables) => {
        const encoded = await encodeBackup(tables, source);
        const decoded = await decodeBackup(encoded.bytes);
        expect(decoded.ok).toBe(true);
        if (!decoded.ok) return;
        expect(decoded.backup.tables).toEqual(sorted(tables));
        expect(decoded.backup.preview.counts).toEqual(
          Object.fromEntries(RAW_TABLE_NAMES.map((table) => [table, tables[table].length])),
        );
      }),
      { numRuns: runs(60) },
    );
  }, 30_000);

  it('is deterministic: exporting the restored data gives the same data files', async () => {
    await fc.assert(
      fc.asyncProperty(rawTables, async (tables) => {
        const first = await encodeBackup(tables, source);
        const decoded = await decodeBackup(first.bytes);
        if (!decoded.ok) throw new Error(decoded.error.kind);
        const second = await encodeBackup(decoded.backup.tables, source);
        expect(second.manifest.entries).toEqual(first.manifest.entries);
        expect(second.manifest.contentDigest).toBe(first.manifest.contentDigest);
      }),
      { numRuns: runs(30) },
    );
  }, 30_000);

  it('writes the manifest first and names the file after the local creation time', async () => {
    const encoded = await encodeBackup(sampleTables(), source);
    expect(encoded.fileName).toBe('powr-backup-2026-11-23-1846.zip');
    expect(Object.keys(unzipSync(encoded.bytes))).toEqual([
      'manifest.json',
      'data/meta.json',
      'data/settings.json',
      'data/sessions.json',
      'data/sets.json',
      'data/profile.json',
      'data/equipmentProfiles.json',
      'data/plans.json',
      'data/plannedSessions.json',
      'data/breaks.json',
      'data/meets.json',
      'data/bodyweights.json',
      'README.txt',
    ]);
    expect(encoded.manifest).toMatchObject({
      format: 'powr-backup',
      formatVersion: 1,
      dataVersion: 2,
      createdAt: '2026-11-23T18:46:40.000+01:00',
      counts: { meta: 0, settings: 1, sessions: 1, sets: 1, plans: 0, plannedSessions: 0 },
      dateRange: { from: '2026-11-23', to: '2026-11-23' },
    });
  });
});

describe('backup import rejects bad files before anything is written', () => {
  it('rejects one altered byte in sets.json (QS-17)', async () => {
    const { bytes } = await encodeBackup(sampleTables(), source);
    const tampered = rezip(bytes, (files) => {
      const sets = files['data/sets.json']!;
      const altered = strFromU8(sets).replace('"reps":5', '"reps":6');
      expect(altered).not.toBe(strFromU8(sets));
      files['data/sets.json'] = strToU8(altered);
    });
    expect(await decodeBackup(tampered)).toEqual({
      ok: false,
      error: { kind: 'checksumMismatch', path: 'data/sets.json' },
    });
  });

  it('rejects an entry hash edited without the content digest', async () => {
    const { bytes } = await encodeBackup(sampleTables(), source);
    const tampered = rezip(bytes, (files) => {
      const manifest = JSON.parse(strFromU8(files['manifest.json']!));
      manifest.entries[3].sha256 = '0'.repeat(64);
      files['manifest.json'] = strToU8(JSON.stringify(manifest));
    });
    expect(await decodeBackup(tampered)).toEqual({
      ok: false,
      error: { kind: 'checksumMismatch', path: 'manifest.json' },
    });
  });

  it('rejects invalid records even when every checksum was recomputed', async () => {
    const tables = sampleTables();
    const invalid = { ...tables, sets: [{ ...tables.sets[0]!, reps: 5000 }] };
    const { bytes } = await encodeBackup(invalid, source);
    expect(await decodeBackup(bytes)).toMatchObject({ ok: false, error: { kind: 'invalidData' } });
  });

  it('rejects unknown fields (strict schemas)', async () => {
    const tables = sampleTables();
    const extra = { ...tables, settings: [{ id: 'me', theme: 'dark', script: '<b>' }] };
    const { bytes } = await encodeBackup(extra as unknown as RawTables, source);
    expect(await decodeBackup(bytes)).toMatchObject({ ok: false, error: { kind: 'invalidData' } });
  });

  it('checks dismissed warning keys and time-budget targets on plan records (PLN-09, PLN-14)', () => {
    const [base] = fc.sample(plan('p1', 'e1', 'active'), { numRuns: 1, seed: 7 });
    const mesocycle = base!.mesocycles[0]!;
    const withTargets = (targets: readonly unknown[]) =>
      ({ ...base!, mesocycles: [{ ...mesocycle, targets }] }) as unknown as Plan;
    expect(
      validPlan({
        ...withTargets([{ muscle: 'mu.glutes', sets: 6, source: 'timeBudget', full: 15 }]),
        dismissedIssues: ['volume.timeBudget:mu.glutes:6/6/15', 'time.overBudget:d0:68'],
      }),
    ).toBe(true);
    const { dismissedIssues: _omitted, ...withoutKeys } = base!;
    expect(validPlan(withoutKeys as Plan)).toBe(false);
    expect(validPlan({ ...base!, dismissedIssues: [''] })).toBe(false);
    expect(validPlan({ ...base!, dismissedIssues: ['k'.repeat(301)] })).toBe(false);
    expect(
      validPlan({ ...base!, dismissedIssues: Array.from({ length: 501 }, (_, i) => `key:${i}`) }),
    ).toBe(false);
    expect(
      validPlan(withTargets([{ muscle: 'mu.glutes', sets: 6, source: 'band', full: 15 }])),
    ).toBe(false);
    expect(validPlan(withTargets([{ muscle: 'mu.glutes', sets: 6, source: 'timeBudget' }]))).toBe(
      false,
    );
  });

  it('rejects files from a newer app version', async () => {
    const { bytes } = await encodeBackup(sampleTables(), source);
    const newer = rezip(bytes, (files) => {
      const manifest = JSON.parse(strFromU8(files['manifest.json']!));
      manifest.dataVersion = 99;
      files['manifest.json'] = strToU8(JSON.stringify(manifest));
    });
    expect(await decodeBackup(newer)).toEqual({ ok: false, error: { kind: 'newerVersion' } });
  });

  it('rejects files that are not POWR backups', async () => {
    expect(await decodeBackup(strToU8('definitely not a zip'))).toEqual({
      ok: false,
      error: { kind: 'notZip' },
    });
    const otherZip = zipSync({ 'hello.txt': strToU8('hi') });
    expect(await decodeBackup(otherZip)).toEqual({ ok: false, error: { kind: 'notAPowrBackup' } });
  });

  it('rejects unlisted entries, oversized archives and zip bombs', async () => {
    const { bytes } = await encodeBackup(sampleTables(), source);
    const smuggled = rezip(bytes, (files) => {
      files['data/extra.json'] = strToU8('[]');
    });
    expect(await decodeBackup(smuggled)).toMatchObject({
      ok: false,
      error: { kind: 'unsafeArchive' },
    });

    expect(
      await decodeBackup(bytes, { limits: { ...DEFAULT_ARCHIVE_LIMITS, maxArchiveBytes: 100 } }),
    ).toEqual({ ok: false, error: { kind: 'tooLarge' } });

    const bomb = zipSync({ 'manifest.json': new Uint8Array(4 * 1024 * 1024) }, { level: 9 });
    expect(await decodeBackup(bomb)).toMatchObject({ ok: false, error: { kind: 'unsafeArchive' } });
  });

  it('rejects broken references', async () => {
    const tables = sampleTables();
    const orphan = { ...tables, sets: [{ ...tables.sets[0]!, sessionId: 'missing' as never }] };
    const { bytes } = await encodeBackup(orphan, source);
    expect(await decodeBackup(bytes)).toMatchObject({
      ok: false,
      error: { kind: 'brokenReference' },
    });

    const valid = await encodeBackup(tables, source);
    const unknownExercise = await decodeBackup(valid.bytes, { isKnownExercise: () => false });
    expect(unknownExercise).toMatchObject({ ok: false, error: { kind: 'brokenReference' } });
  });
});
