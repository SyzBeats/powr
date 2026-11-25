// TD-22: kept hostile backup files, one per attack the import must reject (technical concept
// §8.3.3, §8.3.5; NFR-SEC-02). The cases are crafted like an attacker would (every hash and the
// content digest recomputed unless the case is about them) and written to
// packages/formats/fixtures/backups/hostile/ by:
//
//   node --import ./packages/rules/scripts/ts-resolve.ts packages/formats/scripts/hostile-fixtures.ts
//
// `test/hostile-fixtures.test.ts` imports every kept file and checks the error. Crafting is
// deterministic (a fixed entry time), so writing again changes no file unless a case changed.
// This package has no Node types on purpose; the file system comes from `getBuiltinModule`.

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import type { BackupError } from '../src/backup';
import { craftBackup, renameEntry, source } from '../test/craft';

export interface HostileFixture {
  /** File name in fixtures/backups/hostile/. */
  readonly file: string;
  /** What the file tries. */
  readonly attack: string;
  /** The error import must return; `detail` is a part of its reason, detail or path. */
  readonly expected: { readonly kind: BackupError['kind']; readonly detail?: string };
  readonly craft: () => Promise<Uint8Array>;
}

const INSTANT = '{"epochMs":1795456000000,"offsetMin":60,"zone":"Europe/Zurich"}';
const VERSIONS = '{"engine":"0.0.0","rules":"0.0.0+m0","content":"0.0.0+m0"}';
const SESSION = `{"id":"s1","localDate":"2026-11-23","startedAt":${INSTANT},"status":"finished","versions":${VERSIONS},"origin":"freestyle","equipmentProfileId":null,"exercises":[],"groups":[],"cursor":null,"timer":null,"readiness":null,"changes":[],"revision":0,"undo":null}`;
const ORPHAN_SET = `{"id":"x1","sessionId":"missing","exerciseId":"ex.barbell-back-squat","index":0,"type":"working","load":{"value":100,"unit":"kg"},"reps":5,"effort":{"rir":2,"source":"entered"},"state":"done","performedAt":${INSTANT},"localDate":"2026-11-23"}`;

/** Unzips, edits and zips again with the same fixed entry time; no hash is recomputed. */
function rezip(bytes: Uint8Array, edit: (files: Record<string, Uint8Array>) => void): Uint8Array {
  const files = unzipSync(bytes);
  edit(files);
  return zipSync(files, { mtime: source.createdAt.epochMs });
}

function nested(depth: number): string {
  return `${'['.repeat(depth)}${']'.repeat(depth)}`;
}

export const HOSTILE_FIXTURES: readonly HostileFixture[] = [
  {
    file: 'not-a-zip.zip',
    attack: 'Plain text with a .zip name',
    expected: { kind: 'notZip' },
    craft: async () => strToU8('This is not a ZIP archive.\n'),
  },
  {
    file: 'not-a-powr-backup.zip',
    attack: 'A valid ZIP without manifest.json',
    expected: { kind: 'notAPowrBackup' },
    craft: async () =>
      zipSync({ 'hello.txt': strToU8('hello') }, { mtime: source.createdAt.epochMs }),
  },
  {
    file: 'newer-data-version.zip',
    attack: 'dataVersion 99, from an app newer than this one',
    expected: { kind: 'newerVersion' },
    craft: () =>
      craftBackup({ manifest: (json) => json.replace(/"dataVersion":\d+/, '"dataVersion":99') }),
  },
  {
    file: 'newer-format-version.zip',
    attack: 'formatVersion 2, a container layout this app does not know',
    expected: { kind: 'newerVersion' },
    craft: () =>
      craftBackup({ manifest: (json) => json.replace('"formatVersion":1', '"formatVersion":2') }),
  },
  {
    file: 'reserved-key-manifest.zip',
    attack: 'A `__proto__` key in manifest.json (prototype pollution)',
    expected: { kind: 'invalidManifest', detail: 'reserved key "__proto__" at $' },
    craft: () =>
      craftBackup({ manifest: (json) => json.replace('{', '{"__proto__":{"polluted":"yes"},') }),
  },
  {
    file: 'reserved-key-data.zip',
    attack: 'A `__proto__` key inside a record, every checksum recomputed',
    expected: { kind: 'invalidData', detail: 'reserved key "__proto__" at $[0].value' },
    craft: () =>
      craftBackup({ data: { meta: '[{"key":"a","value":{"__proto__":{"polluted":"yes"}}}]' } }),
  },
  {
    file: 'constructor-key-data.zip',
    attack: 'The `constructor` → `prototype` path in a record',
    expected: { kind: 'invalidData', detail: 'reserved key "constructor" at $[0]' },
    craft: () =>
      craftBackup({
        data: {
          settings: '[{"id":"me","theme":"dark","constructor":{"prototype":{"polluted":"yes"}}}]',
        },
      }),
  },
  {
    file: 'deep-nesting.zip',
    attack: 'A value nested 40 levels deep (stack overflow in recursive parsers)',
    expected: { kind: 'invalidData', detail: 'nesting deeper than 32 levels' },
    craft: () => craftBackup({ data: { meta: `[{"key":"deep","value":${nested(40)}}]` } }),
  },
  {
    file: 'entry-named-proto.zip',
    attack: 'A ZIP entry named `__proto__` (would replace the unpacked object’s prototype)',
    expected: { kind: 'unsafeArchive', detail: 'reserved entry name __proto__' },
    craft: async () =>
      renameEntry(
        await craftBackup({ extra: { xxxxxxxxx: strToU8('{}') } }),
        'xxxxxxxxx',
        '__proto__',
      ),
  },
  {
    file: 'duplicate-entry.zip',
    attack: 'data/sets.json twice (an unpacker keeps only one of them)',
    expected: { kind: 'unsafeArchive', detail: 'duplicate entry data/sets.json' },
    craft: async () =>
      renameEntry(
        await craftBackup({ extra: { 'data/sets.xxxx': strToU8(`[${ORPHAN_SET}]`) } }),
        'data/sets.xxxx',
        'data/sets.json',
      ),
  },
  {
    file: 'unlisted-entry.zip',
    attack: 'An entry the manifest does not list',
    expected: { kind: 'unsafeArchive', detail: 'unlisted entry data/evil.json' },
    craft: () => craftBackup({ extra: { 'data/evil.json': strToU8('[]') } }),
  },
  {
    file: 'too-many-entries.zip',
    attack: '65 entries (more than the 64 allowed)',
    expected: { kind: 'unsafeArchive', detail: '65 entries' },
    craft: async () => {
      const base = unzipSync(await craftBackup());
      const padding = Object.fromEntries(
        Array.from({ length: 65 - Object.keys(base).length }, (_, index) => [
          `pad-${index}.txt`,
          new Uint8Array(0),
        ]),
      );
      return zipSync({ ...base, ...padding }, { mtime: source.createdAt.epochMs });
    },
  },
  {
    file: 'zip-bomb.zip',
    attack: 'An entry of 2 MiB that compresses about 1,000 to 1 (zip bomb)',
    expected: { kind: 'unsafeArchive', detail: 'compression ratio of bomb.bin' },
    craft: () => craftBackup({ extra: { 'bomb.bin': new Uint8Array(2 * 1024 * 1024) } }),
  },
  {
    file: 'content-digest.zip',
    attack: 'A manifest whose content digest does not match its entries',
    expected: { kind: 'checksumMismatch', detail: 'manifest.json' },
    craft: () =>
      craftBackup({
        manifest: (json) =>
          json.replace(/"contentDigest":"[0-9a-f]{64}"/, `"contentDigest":"${'0'.repeat(64)}"`),
      }),
  },
  {
    file: 'edited-entry.zip',
    attack: 'data/settings.json edited after export, the manifest unchanged',
    expected: { kind: 'checksumMismatch', detail: 'data/settings.json' },
    craft: async () =>
      rezip(await craftBackup({ data: { settings: '[{"id":"me","theme":"dark"}]' } }), (files) => {
        const settings = strFromU8(files['data/settings.json']!);
        files['data/settings.json'] = strToU8(settings.replace('dark', 'dusk'));
      }),
  },
  {
    file: 'unknown-field.zip',
    attack: 'A field the app does not know (strict schemas)',
    expected: { kind: 'invalidData', detail: 'settings[0]' },
    craft: () => craftBackup({ data: { settings: '[{"id":"me","theme":"dark","admin":true}]' } }),
  },
  {
    file: 'broken-reference.zip',
    attack: 'A set of a workout that is not in the file',
    expected: { kind: 'brokenReference', detail: 'set x1 references a missing session' },
    craft: () => craftBackup({ data: { sessions: `[${SESSION}]`, sets: `[${ORPHAN_SET}]` } }),
  },
];

interface NodeProcess {
  getBuiltinModule(id: 'node:fs'): FileSystem;
  readonly stdout: { write(text: string): void };
}

interface FileSystem {
  mkdirSync(path: URL, options: { recursive: true }): void;
  writeFileSync(path: URL, bytes: Uint8Array): void;
}

async function writeHostileFixtures(): Promise<void> {
  const { process } = globalThis as unknown as { process: NodeProcess };
  const fs = process.getBuiltinModule('node:fs');
  const dir = new URL('../fixtures/backups/hostile/', import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  for (const fixture of HOSTILE_FIXTURES)
    fs.writeFileSync(new URL(fixture.file, dir), await fixture.craft());
  process.stdout.write(`Wrote ${HOSTILE_FIXTURES.length} hostile fixtures.\n`);
}

if ((import.meta as ImportMeta & { main?: boolean }).main) await writeHostileFixtures();
