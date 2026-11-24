import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/**
 * Full offline install budget (§8.19): everything the service worker precaches, gzip-compressed,
 * must stay within 2.0 MB (stricter than the PRD's 3 MB, NFR-PERF-07). Run after `pnpm build`.
 */
const BUDGET_BYTES = 2_000_000;
const dist = fileURLToPath(new URL('../dist/', import.meta.url));

// The precache manifest is injected into sw.js as JSON entries: {"revision":…,"url":"…"}.
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
const urls = [...sw.matchAll(/"url":"([^"]+)"/g)].map((match) => match[1]!);
if (urls.length === 0)
  throw new Error('No precache entries in dist/sw.js. Run `pnpm build` first.');

const gzipped = (url: string) => gzipSync(readFileSync(join(dist, url)), { level: 9 }).length;
const total = urls.reduce((sum, url) => sum + gzipped(url), 0) + gzipped('sw.js');
const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;

console.log(
  `Precache: ${urls.length} files + sw.js = ${kb(total)} gzip (budget ${kb(BUDGET_BYTES)})`,
);
if (total > BUDGET_BYTES) {
  console.error('Precache budget exceeded (NFR-PERF-07).');
  process.exit(1);
}
