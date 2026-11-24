import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkTokens, checkUsage, scanUsage } from './check.ts';
import { parseBridge, parseTokens } from './tokens.ts';

/**
 * The token contrast gate (technical concept §8.9.3, TD-12; `pnpm tokens:check`, part of
 * `pnpm verify` and the CI quality job). Fails on any token pair below WCAG 2.2 AA, a heat-map
 * step that is not colour-vision safe, an unclassified token, or a colour utility in the app that
 * bypasses the tokens.
 */
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const ui = join(repo, 'apps/web/src/ui');
const src = join(repo, 'apps/web/src');

const { tokens, unreadable } = parseTokens(readFileSync(join(ui, 'tokens.css'), 'utf8'));
const aliases = parseBridge(readFileSync(join(ui, 'app.css'), 'utf8'));

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
const files = sources(src).map((path) => ({
  path: relative(repo, path),
  text: readFileSync(path, 'utf8'),
}));

const tokenReport = checkTokens(tokens);
const scanned = scanUsage(files, tokens, aliases);
const usageReport = checkUsage(scanned.usages, tokens);
const problems = [
  ...unreadable.map((name) => `--${name} is not a light-dark(#rrggbb, #rrggbb) pair`),
  ...[...aliases]
    .filter(([, token]) => !tokens.has(token))
    .map(([alias, token]) => `bridge --${alias} → --${token}: no such token`),
  ...tokenReport.problems,
  ...scanned.problems,
  ...usageReport.problems,
];

const lowest = (kind: string) =>
  Math.min(
    ...[...tokenReport.pairs, ...usageReport.pairs]
      .filter((pair) => pair.kind === kind)
      .map((pair) => pair.ratio),
  );
const smallestStep = Math.min(...tokenReport.scale.map((step) => step.deltaE));
console.log(
  `Tokens: ${tokens.size} colours × 2 themes; ${tokenReport.pairs.length + usageReport.pairs.length} pairs ` +
    `(lowest: text ${lowest('text').toFixed(2)}, on fills ${lowest('fill-text').toFixed(2)}, ` +
    `UI ${lowest('ui').toFixed(2)}, heat map ${lowest('scale').toFixed(2)}); ` +
    `heat-map steps ΔE00 ≥ ${smallestStep.toFixed(1)} (normal, protanopia, deuteranopia, tritanopia); ` +
    `${scanned.usages.length} colour utilities in ${files.length} files`,
);
if (problems.length > 0) {
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(`Token gate failed: ${problems.length} problem(s).`);
  process.exit(1);
}
console.log('Token gate passed.');
