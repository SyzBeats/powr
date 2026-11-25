import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ReleaseNotesError, readReleaseNotes, toChangelog } from './index.ts';

/**
 * `pnpm release-notes [--json]`: checks every file in docs/release-notes/ the way the app build
 * does (the app version must have notes) and lists the releases, or prints the `changelog.json`
 * the build would ship.
 */
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const dir = join(repo, 'docs/release-notes');
const { version: appVersion } = (
  await import(join(repo, 'apps/web/package.json'), { with: { type: 'json' } })
).default as { version: string };

try {
  const notes = readReleaseNotes(dir, {
    appVersion,
    today: new Date().toISOString().slice(0, 10),
  });
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(toChangelog(notes), null, 2));
  } else {
    for (const entry of notes)
      console.log(
        `${entry.version} (${entry.date})${entry.reviewed ? '' : ', not reviewed yet'}: ${entry.sections
          .map((section) => `${section.items.length} ${section.title.toLowerCase()}`)
          .join(', ')}`,
      );
    console.log(`Release notes OK: ${notes.length} release(s); the app version is ${appVersion}.`);
  }
} catch (error) {
  if (!(error instanceof ReleaseNotesError)) throw error;
  console.error(`Release notes FAILED: ${error.message}`);
  process.exitCode = 1;
}
