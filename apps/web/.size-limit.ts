import { readFileSync } from 'node:fs';

/**
 * Size budgets (§8.19, NFR-PERF-07). The entry budget covers exactly what index.html loads
 * before the first screen: the entry chunk and its modulepreloads. Run after `pnpm build`.
 * Entry JS: 186 kB = 176.4 kB measured once Zod left the startup path (TD-17, 2026-11-24) plus
 * about 10 kB of headroom, so a regression shows up early; the concept's ceiling stays 230 kB.
 */
const html = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8');
const firstWave = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(
  (match) => `dist/${match[1]}`,
);
const css = [...html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)].map((match) => `dist/${match[1]}`);

export default [
  { name: 'Entry JS (first wave, gzip)', path: firstWave, limit: '186 kB', gzip: true },
  { name: 'Entry CSS (gzip)', path: css, limit: '30 kB', gzip: true },
  { name: 'Service worker (gzip)', path: 'dist/sw.js', limit: '20 kB', gzip: true },
];
