import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runnerImport } from 'vite';

import type * as Build from './build.ts';

/**
 * `pnpm content:build`: compiles packages/content/data into packages/content/generated/
 * content.json and updates ids.lock.json and the content entries of assets-inventory.yaml.
 * `--check` writes nothing and fails if any output is stale (CI runs the same check as a test).
 *
 * The pipeline imports workspace packages, whose sources use extensionless imports that plain
 * Node cannot resolve, so it is loaded through Vite's module runner.
 */
const root = fileURLToPath(new URL('../../..', import.meta.url));
const check = process.argv.includes('--check');

const { module } = await runnerImport<typeof Build>(
  fileURLToPath(new URL('./build.ts', import.meta.url)),
  { configFile: false, root, logLevel: 'error' },
);
const result = module.buildContent();

if (result.issues.length > 0) {
  console.error(`Content build failed with ${result.issues.length} issue(s):`);
  for (const issue of result.issues) console.error(`  ✗ ${issue}`);
  process.exit(1);
}

const stale = result.files.filter(
  (file) => !existsSync(file.path) || readFileSync(file.path, 'utf8') !== file.contents,
);
for (const line of result.summary) console.log(line);
if (check) {
  if (stale.length > 0) {
    console.error(`Stale: ${stale.map((file) => relative(root, file.path)).join(', ')}`);
    console.error('Run `pnpm content:build` and commit the result.');
    process.exit(1);
  }
  console.log('Content outputs are up to date.');
} else {
  for (const file of stale) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.contents);
    console.log(`wrote ${relative(root, file.path)}`);
  }
  if (stale.length === 0) console.log('Content outputs were already up to date.');
}
