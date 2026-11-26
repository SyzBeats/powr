import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkImagePin, formatFailures, readBundledPackages, runGate } from './inventory.ts';
import { loadPolicy } from './policy.ts';

/**
 * Licence gate for CI (`pnpm licence`): evaluates what the last `pnpm build` bundled plus all
 * build-only packages, writes licence-inventory.json and exits non-zero on any violation.
 */
const root = fileURLToPath(new URL('../../..', import.meta.url));
const reportDir = join(root, 'apps/web/.licence');

const command = process.argv[2];
if (command !== 'check') {
  console.error('Usage: node tools/licence/src/cli.ts check');
  process.exit(2);
}

const bundled = readBundledPackages(reportDir);
if (bundled.length === 0) {
  console.error('No bundle reports found in apps/web/.licence. Run `pnpm build` first.');
  process.exit(2);
}

const result = runGate({
  policy: loadPolicy(join(root, 'licence-policy.yaml')),
  bundled,
  assetsInventoryFile: join(root, 'assets-inventory.yaml'),
  serverInventoryFile: join(root, 'deploy/server-inventory.yaml'),
  buildOnly: listInstalledPackages(),
});

writeFileSync(join(root, 'licence-inventory.json'), JSON.stringify(result.entries, null, 2) + '\n');

const distributed = result.entries.filter((entry) => entry.distributed).length;
const server = result.entries.filter((entry) => entry.kind === 'server').length;
console.log(
  `Licence inventory: ${distributed} distributed, ${result.entries.length - distributed - server} build-only, ${server} server-side -> licence-inventory.json`,
);
if (result.failures.length > 0) {
  console.error(`Licence gate FAILED (licence-policy.yaml):\n${formatFailures(result.failures)}`);
  process.exit(1);
}
// The server-side list must describe the image the Dockerfile builds on (M6d, runbook §6.1).
const pin = checkImagePin(
  readFileSync(join(root, 'deploy/Dockerfile'), 'utf8'),
  join(root, 'deploy/server-inventory.yaml'),
);
if (pin) {
  console.error(`Licence gate FAILED: ${pin}`);
  process.exit(1);
}
console.log('Licence gate passed.');

/** Every installed third-party package, from `pnpm licenses list` (build-time tools included). */
function listInstalledPackages(): { name: string; version: string; licence: string | null }[] {
  const output = execFileSync('pnpm', ['-r', 'licenses', 'list', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const byLicence = JSON.parse(output) as Record<
    string,
    { name: string; versions: string[]; license: string }[]
  >;
  return Object.values(byLicence).flatMap((packages) =>
    packages
      .filter((pkg) => !pkg.name.startsWith('@powr/'))
      .flatMap((pkg) =>
        pkg.versions.map((version) => ({
          name: pkg.name,
          version,
          licence: pkg.license === 'Unknown' ? null : pkg.license,
        })),
      ),
  );
}
