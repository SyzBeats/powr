import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { buildBodyMap, emitModule, readTaxonomy } from './build.ts';

/**
 * `pnpm body-map`: builds apps/web/src/ui/body-map/artwork.gen.ts from the artwork
 * (tools/body-map/art/body-map.svg) and the taxonomy. `--check` writes nothing and fails when the
 * artwork is invalid or the committed module is stale (the tool's test runs the same check).
 */
export const PATHS = {
  svg: fileURLToPath(new URL('../art/body-map.svg', import.meta.url)),
  taxonomy: fileURLToPath(new URL('../../../packages/content/data/muscles.yaml', import.meta.url)),
  module: fileURLToPath(
    new URL('../../../apps/web/src/ui/body-map/artwork.gen.ts', import.meta.url),
  ),
  oxfmt: fileURLToPath(new URL('../../../node_modules/.bin/oxfmt', import.meta.url)),
};

function build() {
  return buildBodyMap(
    readFileSync(PATHS.svg, 'utf8'),
    readTaxonomy(readFileSync(PATHS.taxonomy, 'utf8')),
  );
}

async function main(argv: readonly string[]): Promise<number> {
  const result = build();
  for (const line of result.summary) console.log(line);
  if (!result.data) {
    console.error(`Body map failed with ${result.issues.length} issue(s):`);
    for (const issue of result.issues) console.error(`  ✗ ${issue}`);
    return 1;
  }
  if (argv.includes('--check')) {
    const committed = (await import(PATHS.module)) as { BODY_MAP_ARTWORK: unknown };
    if (!isDeepStrictEqual(committed.BODY_MAP_ARTWORK, result.data)) {
      console.error('apps/web/src/ui/body-map/artwork.gen.ts is out of date: run pnpm body-map');
      return 1;
    }
    console.log('Body-map artwork module is up to date.');
    return 0;
  }
  writeFileSync(PATHS.module, emitModule(result.data));
  // The repository's formatter has the last word on layout (pnpm format:check).
  spawnSync(PATHS.oxfmt, [PATHS.module], { stdio: 'ignore' });
  console.log('Wrote apps/web/src/ui/body-map/artwork.gen.ts');
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
