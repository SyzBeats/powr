import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * CI check (§8.15): `lingui extract` must not change the committed catalogs. On failure the
 * catalogs are left updated so the fix is a commit away.
 */
const webRoot = fileURLToPath(new URL('..', import.meta.url));
const localesDir = join(webRoot, 'src/i18n/locales');

const readCatalogs = () =>
  Object.fromEntries(
    readdirSync(localesDir).map((locale) => [
      locale,
      readFileSync(join(localesDir, locale, 'messages.po'), 'utf8'),
    ]),
  );

const before = readCatalogs();
execFileSync('pnpm', ['exec', 'lingui', 'extract', '--clean'], { cwd: webRoot, stdio: 'ignore' });
const after = readCatalogs();

const changed = Object.keys(after).filter((locale) => before[locale] !== after[locale]);
if (changed.length > 0) {
  console.error(
    `Lingui catalogs were out of date: ${changed.join(', ')}. Commit the updated messages.po files.`,
  );
  process.exit(1);
}
console.log('Lingui catalogs are up to date.');
