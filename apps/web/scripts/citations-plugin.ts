import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runnerImport, type Plugin } from 'vite';

import type * as Citations from '@powr/rules/citations/node';

const ID = 'virtual:powr-citations';
const RESOLVED = `\0${ID}`;

/** The generator in the rules build scripts (`@powr/rules/citations/node`). */
const GENERATOR = fileURLToPath(import.meta.resolve('@powr/rules/citations/node'));
const SOURCES_DIR = fileURLToPath(
  new URL('../data/sources/', import.meta.resolve('@powr/rules/citations/node')),
);

/**
 * TD-33 (M5s): serves the source registry's citations as `virtual:powr-citations`, generated
 * from `packages/rules/data/sources/*.yaml` on every build and dev start, so they always match
 * the shipped registry. The app imports it with `import()`, so it is a lazy, precached chunk
 * (about 12 kB gzip) that only the "Why?" sheet and "How POWR decides" load. The generator uses
 * the workspace's extensionless imports, which plain Node cannot resolve, so it is loaded through
 * Vite's module runner (as `tools/content-build` does).
 */
export function citationsPlugin(): Plugin {
  return {
    name: 'powr-citations',
    resolveId: {
      filter: { id: /^virtual:powr-citations$/ },
      handler: (id) => (id === ID ? RESOLVED : null),
    },
    load: {
      filter: { id: /^\0virtual:powr-citations$/ },
      async handler(id) {
        if (id !== RESOLVED) return null;
        for (const name of readdirSync(SOURCES_DIR))
          if (name.endsWith('.yaml')) this.addWatchFile(`${SOURCES_DIR}${name}`);
        const { module } = await runnerImport<typeof Citations>(GENERATOR, {
          configFile: false,
          logLevel: 'error',
        });
        return `export default ${JSON.stringify(module.loadCitations())};`;
      },
    },
  };
}
