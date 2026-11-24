import * as fc from 'fast-check';
import { strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';

import { RAW_TABLE_NAMES, emptyRawTables, type RawTables } from '../src';
import { decodeBackup, encodeBackup, validateRawTables } from '../src/backup';
import { findUnsafeJson } from '../src/json';
import { hasReservedKey, hostileRawTables } from './arbitraries';
import { craftBackup, renameEntry, source } from './craft';

// Backup files are untrusted input (technical concept §8.3.3, §8.3.5, NFR-SEC-02). These tests
// build files as an attacker would, with every checksum recomputed, and check that import rejects
// them with a typed error, never throws, never changes data silently and never touches a prototype.

/** `FC_NUM_RUNS=5000 pnpm vitest run --project formats` for a long run (vitest.setup.ts). */
const runs = (fallback: number) => fc.readConfigureGlobal().numRuns ?? fallback;

const prototypeKeys = Object.getOwnPropertyNames(Object.prototype).toSorted();

/** Object.prototype is exactly as before the test: no new keys, nothing inherited by `{}`. */
function expectPrototypeUntouched() {
  expect(Object.getOwnPropertyNames(Object.prototype).toSorted()).toEqual(prototypeKeys);
  expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  expect(Object.getPrototypeOf({})).toBe(Object.prototype);
}

const SETTINGS = '{"id":"me","theme":"dark"}';
const SESSION =
  '{"id":"s1","localDate":"2026-11-23","startedAt":{"epochMs":1795456000000,"offsetMin":60,"zone":"Europe/Zurich"},"status":"finished","versions":{"engine":"0.0.0","rules":"0.0.0+m0","content":"0.0.0+m0"}}';
const POLLUTE = '{"polluted":"yes"}';

describe('regression: FC_SEED=637004341 (backup round-trip produced a `__proto__` key)', () => {
  // Counterexample: { meta: [{ key: 'a', value: { ['__proto__']: 0 } }] }. Export wrote the key;
  // import passed every checksum and Zod's record parser dropped it, so the restore "succeeded"
  // with `value: {}`: a silent change of restored data.
  const value = JSON.parse('{"__proto__":0}') as RawTables['meta'][number]['value'];
  const tables: RawTables = { ...emptyRawTables(), meta: [{ key: 'a', value }] };

  it('export refuses the reserved key instead of writing a file that cannot be restored', async () => {
    await expect(encodeBackup(tables, source)).rejects.toThrow(
      'Cannot back up meta: reserved key "__proto__" at $[0].value',
    );
  });

  it('import rejects the same records written by hand instead of restoring `{}`', async () => {
    const bytes = await craftBackup({ data: { meta: '[{"key":"a","value":{"__proto__":0}}]' } });
    expect(await decodeBackup(bytes)).toEqual({
      ok: false,
      error: {
        kind: 'invalidData',
        detail: 'data/meta.json: reserved key "__proto__" at $[0].value',
      },
    });
  });

  it('the meta schema reports the key instead of dropping it', () => {
    expect(validateRawTables({ ...emptyRawTables(), meta: tables.meta })).toEqual({
      ok: false,
      issues: [
        {
          table: 'meta',
          index: 0,
          // Zod's message is the JSON of its issues, so the quotes around the key are escaped.
          message: expect.stringContaining('reserved key \\"__proto__\\" at $'),
        },
      ],
    });
  });
});

describe('crafted backups that try prototype pollution are rejected', () => {
  it.each([
    ['meta value with __proto__', { meta: `[{"key":"a","value":{"__proto__":${POLLUTE}}}]` }],
    [
      'meta value with a nested __proto__',
      { meta: `[{"key":"a","value":{"list":[{"__proto__":${POLLUTE}}]}}]` },
    ],
    [
      'meta value with constructor.prototype',
      { meta: `[{"key":"a","value":{"constructor":{"prototype":${POLLUTE}}}}]` },
    ],
    ['meta value with a bare prototype key', { meta: `[{"key":"a","value":{"prototype":1}}]` }],
    [
      'settings record with __proto__',
      { settings: `[{"id":"me","theme":"dark","__proto__":${POLLUTE}}]` },
    ],
    [
      'session record with a nested __proto__',
      { sessions: `[${SESSION.replace('"zone"', `"__proto__":${POLLUTE},"zone"`)}]` },
    ],
    // dataVersion 2 tables (M2): the same check covers every new table and free-form field.
    [
      'settings override value with constructor.prototype (TD-22)',
      {
        settings: `[{"id":"me","theme":"dark","overrides":[{"paramId":"session.rest.strength","value":{"constructor":{"prototype":${POLLUTE}}}}]}]`,
      },
    ],
    ['plan record with __proto__', { plans: `[{"id":"p","__proto__":${POLLUTE}}]` }],
    [
      'planned-session slot with a nested __proto__',
      { plannedSessions: `[{"id":"s","slots":[{"key":"a","__proto__":${POLLUTE}}]}]` },
    ],
    ['equipment profile with prototype', { equipmentProfiles: `[{"id":"e","prototype":1}]` }],
    ['profile with __proto__', { profile: `[{"id":"me","__proto__":${POLLUTE}}]` }],
  ])('%s → invalidData', async (_name, data) => {
    const result = await decodeBackup(await craftBackup({ data }));
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'invalidData',
        detail: expect.stringMatching(/reserved key "(__proto__|constructor|prototype)"/),
      },
    });
    expectPrototypeUntouched();
  });

  it('manifest with __proto__ → invalidManifest', async () => {
    for (const edit of [
      (json: string) => json.replace('{', `{"__proto__":${POLLUTE},`),
      (json: string) => json.replace('"counts":{', `"counts":{"__proto__":${POLLUTE},`),
    ]) {
      const result = await decodeBackup(await craftBackup({ manifest: edit }));
      expect(result).toMatchObject({
        ok: false,
        error: {
          kind: 'invalidManifest',
          detail: expect.stringContaining('reserved key "__proto__"'),
        },
      });
    }
    expectPrototypeUntouched();
  });

  it('a ZIP entry named __proto__ or constructor → unsafeArchive (it used to be ignored)', async () => {
    for (const name of ['__proto__', 'constructor']) {
      const placeholder = 'x'.repeat(name.length);
      const zip = await craftBackup({ extra: { [placeholder]: strToU8(POLLUTE) } });
      expect(await decodeBackup(renameEntry(zip, placeholder, name))).toEqual({
        ok: false,
        error: { kind: 'unsafeArchive', reason: `reserved entry name ${name}` },
      });
    }
    expectPrototypeUntouched();
  });

  it('a repeated entry name → unsafeArchive (fflate would keep only the last one)', async () => {
    const zip = await craftBackup({
      data: { settings: `[${SETTINGS}]` },
      extra: { 'data/settingx.json': strToU8('[]') },
    });
    expect(
      await decodeBackup(renameEntry(zip, 'data/settingx.json', 'data/settings.json')),
    ).toEqual({
      ok: false,
      error: { kind: 'unsafeArchive', reason: 'duplicate entry data/settings.json' },
    });
  });

  it('deep nesting → invalidData, not a stack overflow (Zod recurses per level)', async () => {
    const depth = 100_000;
    const meta = `[{"key":"a","value":${'['.repeat(depth)}${']'.repeat(depth)}}]`;
    const result = await decodeBackup(await craftBackup({ data: { meta } }));
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'invalidData',
        detail: expect.stringContaining('nesting deeper than 32 levels'),
      },
    });
  });

  it('still accepts the same files without the hostile parts', async () => {
    const result = await decodeBackup(
      await craftBackup({
        data: {
          meta: '[{"key":"a","value":{"list":[{"x":1}],"constructorName":"ok"}}]',
          settings: `[${SETTINGS}]`,
          sessions: `[${SESSION}]`,
        },
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('findUnsafeJson', () => {
  it('finds reserved keys at any depth and reports the path', () => {
    expect(findUnsafeJson(JSON.parse('[{"a":[1,{"constructor":2}]}]'))).toBe(
      'reserved key "constructor" at $[0].a[1]',
    );
    expect(findUnsafeJson({ toString: 1, hasOwnProperty: 2, proto: 3 })).toBeNull();
  });

  it('limits nesting depth without recursion', () => {
    expect(findUnsafeJson([[[1]]], 3)).toBeNull();
    expect(findUnsafeJson([[[[1]]]], 3)).toBe('nesting deeper than 3 levels at $[0][0][0]');
    expect(findUnsafeJson(JSON.parse('['.repeat(1_000_000) + ']'.repeat(1_000_000)))).toContain(
      'nesting deeper than 32 levels',
    );
  });
});

describe('import never changes data silently (property)', () => {
  it('rejects records with reserved keys and restores everything else exactly', async () => {
    await fc.assert(
      fc.asyncProperty(hostileRawTables, async (tables) => {
        const reserved = Object.values(tables).some(hasReservedKey);
        const refused = expect.stringContaining('reserved key');

        // Export refuses exactly what import would reject.
        const exported = await encodeBackup(tables, source).then(
          () => 'written',
          (error: unknown) => String(error),
        );
        expect(exported).toEqual(reserved ? refused : 'written');

        // The same records written by hand, past the exporter's check.
        const bytes = await craftBackup({
          data: Object.fromEntries(
            RAW_TABLE_NAMES.map((table) => [table, JSON.stringify(tables[table])]),
          ),
        });
        const rejected = { ok: false, error: { kind: 'invalidData', detail: refused } };
        const restored = { ok: true, backup: expect.objectContaining({ tables }) };
        expect(await decodeBackup(bytes)).toEqual(reserved ? rejected : restored);
        expectPrototypeUntouched();
      }),
      { numRuns: runs(100) },
    );
  }, 60_000);
});
