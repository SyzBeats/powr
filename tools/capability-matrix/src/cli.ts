import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { compileMatrix, parseRecord, type DeviceTestRecord } from './compile.ts';

/**
 * `pnpm capability-matrix [--check] [--records <dir>]`: compiles the S-1 device-test records
 * (harness exports, `*.txt` or `*.json`) into `capability-matrix.json`, which the app ships for
 * the honest alert status (technical concept §8.8.5). `--check` fails when the committed matrix
 * is out of date (the tool's unit test runs the same check in `pnpm test`).
 */
const repo = fileURLToPath(new URL('../../../', import.meta.url));
export const RECORDS_DIR = join(repo, 'tools/capability-matrix/records');
export const MATRIX_FILE = join(repo, 'apps/web/src/infrastructure/alerts/capability-matrix.json');

/** Every record in `dir` (none yet: S-1 has not run on the device, so the matrix is empty). */
export function loadRecords(dir: string): DeviceTestRecord[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /\.(txt|json)$/.test(name))
    .toSorted()
    .map((name) => parseRecord(name, readFileSync(join(dir, name), 'utf8')));
}

function main(argv: readonly string[]): number {
  const check = argv.includes('--check');
  const recordsFlag = argv.indexOf('--records');
  const dir = recordsFlag >= 0 && argv[recordsFlag + 1] ? argv[recordsFlag + 1]! : RECORDS_DIR;
  const records = loadRecords(dir);
  const matrix = compileMatrix(records);
  const target = relative(repo, MATRIX_FILE);
  if (check) {
    const committed: unknown = JSON.parse(readFileSync(MATRIX_FILE, 'utf8'));
    if (!isDeepStrictEqual(committed, matrix)) {
      console.error(`${target} is out of date: run pnpm capability-matrix`);
      return 1;
    }
    console.log(`${target} is up to date (${matrix.entries.length} entries).`);
    return 0;
  }
  writeFileSync(MATRIX_FILE, `${JSON.stringify(matrix, null, 2)}\n`);
  // The repository's formatter has the last word on layout (pnpm format:check).
  spawnSync(join(repo, 'node_modules/.bin/oxfmt'), [MATRIX_FILE], { stdio: 'ignore' });
  const counts = { supported: 0, limited: 0, 'not-supported': 0 };
  for (const entry of matrix.entries) if (!entry.placeholder) counts[entry.status]++;
  console.log(
    `Wrote ${target}: ${records.length} record(s), ${matrix.entries.length} entries ` +
      `(supported ${counts.supported}, limited ${counts.limited}, not supported ${counts['not-supported']}).`,
  );
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
