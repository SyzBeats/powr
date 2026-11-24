import { readFileSync } from 'node:fs';

/**
 * Size budgets (§8.19, NFR-PERF-07). The entry budget covers exactly what index.html loads
 * before the first screen: the entry chunk and its modulepreloads. Run after `pnpm build`.
 */
const html = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8');
const firstWave = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(
  (match) => `dist/${match[1]}`,
);
const css = [...html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)].map((match) => `dist/${match[1]}`);

export default [
  { name: 'Entry JS (first wave, gzip)', path: firstWave, limit: '230 kB', gzip: true },
  { name: 'Entry CSS (gzip)', path: css, limit: '30 kB', gzip: true },
  { name: 'Service worker (gzip)', path: 'dist/sw.js', limit: '20 kB', gzip: true },
];
