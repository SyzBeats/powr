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

/** Every catalog of every locale (M5s: the boot catalog plus the lazy `legal` and `params`). */
const readCatalogs = () =>
  Object.fromEntries(
    readdirSync(localesDir).flatMap((locale) =>
      readdirSync(join(localesDir, locale))
        .filter((file) => file.endsWith('.po'))
        .map((file) => [`${locale}/${file}`, readFileSync(join(localesDir, locale, file), 'utf8')]),
    ),
  );

const before = readCatalogs();
execFileSync('pnpm', ['exec', 'lingui', 'extract', '--clean', '--overwrite'], {
  cwd: webRoot,
  stdio: 'ignore',
});
const after = readCatalogs();

const changed = Object.keys(after).filter((catalog) => before[catalog] !== after[catalog]);
if (changed.length > 0) {
  console.error(
    `Lingui catalogs were out of date: ${changed.join(', ')}. Commit the updated .po files.`,
  );
  process.exit(1);
}
console.log('Lingui catalogs are up to date.');
