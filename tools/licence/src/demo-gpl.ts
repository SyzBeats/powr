import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Demonstrates the licence gate end to end (WP0.2 "Done when"):
 * 1. a build that bundles a GPL fixture fails and names the package;
 * 2. a build with an `MIT OR GPL` fixture passes and records MIT;
 * 3. a clean build passes (and leaves dist/ in its normal state).
 */
const root = fileURLToPath(new URL('../../..', import.meta.url));

function build(fixture?: string) {
  const env = { ...process.env, POWR_LICENCE_FIXTURE: fixture ?? '' };
  const result = spawnSync('pnpm', ['--filter', '@powr/web', 'build'], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  return { ok: result.status === 0, output: `${result.stdout}\n${result.stderr}` };
}

let failed = false;
function expect(condition: boolean, message: string) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${message}`);
  if (!condition) failed = true;
}

console.log('1/3 Build with the GPL fixture bundled …');
const gpl = build('gpl');
expect(!gpl.ok, 'build fails');
expect(
  gpl.output.includes('gpl-widget@1.0.0') && gpl.output.includes('GPL-3.0-only is denied'),
  'failure names gpl-widget@1.0.0 and its licence',
);

console.log('2/3 Build with the dual-licensed fixture bundled …');
const dual = build('mit-or-gpl');
const attributions = dual.ok
  ? (JSON.parse(readFileSync(join(root, 'apps/web/dist/attributions.json'), 'utf8')) as {
      name: string;
      licence: string;
    }[])
  : [];
expect(dual.ok, 'build passes');
expect(
  attributions.some((entry) => entry.name === 'dual-licensed' && entry.licence === 'MIT'),
  'MIT chosen for "MIT OR GPL-3.0-or-later"',
);

console.log('3/3 Clean build …');
const clean = build();
expect(clean.ok, 'build passes');

process.exit(failed ? 1 : 0);
