import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Keeps Zod off the startup path (TD-17, §8.19): no file of the first wave (the entry chunk and
 * its modulepreloads, as in .size-limit.ts) may contain Zod. oxlint only sees an app file's own
 * imports; this catches Zod that arrives through a package entry, e.g. a schema re-exported from
 * a package root. Zod's class names survive minification (`$constructor("$ZodType", …)`).
 * Run after `pnpm build`.
 */
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const firstWave = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(
  (match) => match[1]!,
);
if (firstWave.length === 0) throw new Error('No scripts in dist/index.html. Run `pnpm build`.');

const withZod = firstWave.filter((file) =>
  readFileSync(join(dist, file), 'utf8').includes('$ZodType'),
);
console.log(`Startup path: ${firstWave.length} scripts, ${withZod.length} with Zod`);
if (withZod.length > 0) {
  console.error(
    `Zod is on the startup path (TD-17): ${withZod.join(', ')}. Find the importer with the ` +
      'oxlint rules on Zod and @powr/rules subpaths, or a package root that re-exports a schema.',
  );
  process.exit(1);
}
