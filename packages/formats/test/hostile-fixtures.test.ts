import { describe, expect, it } from 'vitest';

import { HOSTILE_FIXTURES } from '../scripts/hostile-fixtures';
import { decodeBackup, type BackupError } from '../src/backup';

// TD-22: the kept hostile files (fixtures/backups/hostile/, written by scripts/hostile-fixtures.ts)
// are rejected with a typed error, never throw and never touch a prototype. `decodeBackup` writes
// nothing by construction; the app's restore writes only after it succeeded (§6.5).
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

const DIR = new URL('../fixtures/backups/hostile/', import.meta.url);
const prototypeKeys = Object.getOwnPropertyNames(Object.prototype).toSorted();

function detailOf(error: BackupError): string {
  if ('reason' in error) return error.reason;
  if ('detail' in error) return error.detail;
  if ('path' in error) return error.path;
  return '';
}

describe('kept hostile backup files (TD-22, NFR-SEC-02, §8.3.5)', () => {
  it('has exactly one kept file per case', () => {
    const files = fs.readdirSync(DIR).toSorted();
    expect(files).toEqual(HOSTILE_FIXTURES.map((fixture) => fixture.file).toSorted());
  });

  it.each(HOSTILE_FIXTURES)('rejects $file ($attack)', async ({ file, expected }) => {
    const result = await decodeBackup(fs.readFileSync(new URL(file, DIR)), {
      isKnownExercise: (id) => id.startsWith('ex.'),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: expected.kind } });
    expect(result.ok ? null : detailOf(result.error)).toContain(expected.detail ?? '');
    // Nothing reached Object.prototype.
    expect(Object.getOwnPropertyNames(Object.prototype).toSorted()).toEqual(prototypeKeys);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});
