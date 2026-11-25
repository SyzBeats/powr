import { describe, expect, it } from 'vitest';

import { DATA_VERSION_SCHEMAS, SCHEMA_DIR, jsonSchemaFiles } from '../scripts/json-schemas';
import { BACKUP_FORMAT_VERSION } from '../src/backup';
import { RAW_TABLE_NAMES } from '../src/records/tables';
import { RAW_TABLE_SCHEMAS } from '../src/records/validate';
import { DATA_VERSION } from '../src/version';

// This package has no Node types on purpose (src stays environment-free); the test reads the
// committed schema files through Node's built-in module loader instead.
const fs = (
  globalThis as unknown as {
    process: {
      getBuiltinModule(id: 'node:fs'): {
        existsSync(path: URL): boolean;
        readFileSync(path: URL, encoding: 'utf8'): string;
        readdirSync(path: URL, options: { recursive: true }): string[];
        statSync(path: URL): { isFile(): boolean };
      };
    };
  }
).process.getBuiltinModule('node:fs');

const DIR = new URL(`../../../${SCHEMA_DIR}/`, import.meta.url);
const STALE = 'The JSON Schemas in docs/formats/schemas/ are stale: run `pnpm formats:schemas`.';

const read = (path: string) => fs.readFileSync(new URL(path, DIR), 'utf8');

/** The committed schema files, relative to the schema directory, with forward slashes. */
function committed(): string[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR, { recursive: true })
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => fs.statSync(new URL(path, DIR)).isFile())
    .toSorted();
}

describe('published JSON Schemas of the backup format (DAT-05, DAT-07, §8.3.4)', () => {
  const generated = jsonSchemaFiles();

  it('cover the manifest and every table of every dataVersion, the current one from import', () => {
    expect(
      Object.keys(DATA_VERSION_SCHEMAS)
        .map(Number)
        .toSorted((a, b) => a - b),
    ).toEqual(Array.from({ length: DATA_VERSION }, (_, index) => index + 1));
    // The current version's schemas are exactly the ones import validates against.
    expect(DATA_VERSION_SCHEMAS[DATA_VERSION]).toBe(RAW_TABLE_SCHEMAS);
    expect(generated.has(`manifest.format-${BACKUP_FORMAT_VERSION}.schema.json`)).toBe(true);
    for (const table of RAW_TABLE_NAMES)
      expect(generated.has(`data-${DATA_VERSION}/${table}.schema.json`)).toBe(true);
  });

  it('are committed and up to date (no file missing, extra or changed)', () => {
    const present = committed();
    const problems = [
      ...[...generated.keys()].filter((path) => !present.includes(path)).map((p) => `missing ${p}`),
      ...present.filter((path) => !generated.has(path)).map((path) => `extra ${path}`),
      ...[...generated]
        .filter(([path, text]) => present.includes(path) && read(path) !== text)
        .map(([path]) => `changed ${path}`),
    ];
    expect(problems.length === 0 ? 'up to date' : [STALE, ...problems].join('\n')).toBe(
      'up to date',
    );
  });

  it('are JSON Schema 2020-12 documents with a title and closed records', () => {
    for (const [path, text] of generated) {
      const schema = JSON.parse(text) as Record<string, unknown>;
      expect({
        path,
        $schema: schema['$schema'],
        titled: String(schema['title']).startsWith('POWR backup: '),
        // Strict objects: a field the app does not know is an error, as on import (§8.3.5).
        open: text.includes('"additionalProperties": true'),
      }).toEqual({
        path,
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        titled: true,
        open: false,
      });
    }
  });
});
