import type { Plugin } from 'vite';

import { readReleaseNotes, toChangelog } from '@powr/tools-release-notes';

/**
 * NFR-MNT-07, SET-09, TD-20 (M6c): compiles the reviewed release notes (`docs/release-notes/`)
 * into `/changelog.json` on every build, and serves it in `vite dev`. The build fails when a file
 * is malformed, dated in the future, or when the app version has no notes, so a version bump
 * cannot ship without them. The service worker precaches the file and fetches it network-first,
 * so "What's new" shows a waiting update's notes when online (src/sw/sw.ts).
 */
export function releaseNotesPlugin(options: { dir: string; appVersion: string }): Plugin {
  const compile = () =>
    JSON.stringify(
      toChangelog(
        readReleaseNotes(options.dir, {
          appVersion: options.appVersion,
          today: new Date().toISOString().slice(0, 10),
        }),
      ),
    );
  return {
    name: 'powr-release-notes',
    configureServer(server) {
      server.middlewares.use('/changelog.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(compile());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'changelog.json', source: compile() });
    },
  };
}
