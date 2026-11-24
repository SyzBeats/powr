import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { chromium } from '@playwright/test';

import { startStaticServer } from '../e2e/static-server.ts';

/**
 * Lighthouse CI 0.16 (technical concept §8.19, §8.20, TD-12): the mobile preset (Lighthouse's
 * default: emulated phone, simulated slow 4G and 4× CPU) against the production build, served by
 * the E2E test server with exactly the production headers (no Trusted Types: production does
 * not send them yet, TD-03). Run after `pnpm build`.
 *
 * Budgets are relative, as §8.19 asks for CI: a timing metric fails when its median over the runs
 * is more than 20% above the stored baseline, with a minimum margin in milliseconds so that
 * near-zero values (blocking time) do not fail on noise. The device budgets (first content
 * ≤ 1.0 s, interactive ≤ 2.0 s) are measured on the S22, not here.
 *
 * Simulated throttling scales the CPU time measured on the machine, so a baseline is only valid
 * on comparable hardware: `lighthouse-baseline.json` keeps one per environment (`ci` on CI, else
 * `local`; `LIGHTHOUSE_BASELINE=<name>` picks another). Without a baseline for the environment the
 * run only reports and writes `.lighthouseci/baseline-candidate.json`.
 *
 *   pnpm lighthouse                      collect, write HTML reports, assert against the baseline
 *   pnpm lighthouse --update-baseline    collect and store the medians as this environment's baseline
 *   pnpm lighthouse --runs 5             more runs (default 3)
 *
 * Chrome: `CHROME_PATH` if set, else Playwright's Chromium (`playwright install chromium`).
 */
const webRoot = fileURLToPath(new URL('..', import.meta.url));
const baselineFile = join(webRoot, 'lighthouse-baseline.json');
const resultsDir = join(webRoot, '.lighthouseci');
const reportsDir = join(resultsDir, 'reports');

const RELATIVE_TOLERANCE = 0.2;
/** Gated timing metrics (Lighthouse audit IDs) with the minimum margin of each, in ms. */
const GATED_METRICS = {
  'first-contentful-paint': 100,
  'largest-contentful-paint': 100,
  'speed-index': 100,
  interactive: 150,
  'total-blocking-time': 100,
} as const;
type GatedMetric = keyof typeof GATED_METRICS;
const METRICS = Object.keys(GATED_METRICS) as GatedMetric[];
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;

interface Baseline {
  measuredAt: string;
  lighthouse: string;
  runs: number;
  /** Lighthouse's CPU benchmark of the measuring machine (higher is faster). */
  benchmarkIndex: number;
  metrics: Record<GatedMetric, number>;
}

interface LighthouseResult {
  lighthouseVersion: string;
  environment: { benchmarkIndex: number };
  audits: Record<string, { numericValue?: number }>;
  categories: Record<string, { score: number | null }>;
}

const { values: args } = parseArgs({
  options: {
    'update-baseline': { type: 'boolean', default: false },
    runs: { type: 'string', default: '3' },
  },
});
const environment = process.env['LIGHTHOUSE_BASELINE'] || (process.env['CI'] ? 'ci' : 'local');
const baselines: Record<string, Baseline> = existsSync(baselineFile)
  ? (JSON.parse(readFileSync(baselineFile, 'utf8')) as Record<string, Baseline>)
  : {};
const baseline = baselines[environment];

const limit = (metric: GatedMetric, base: number) =>
  Math.round(Math.max(base * (1 + RELATIVE_TOLERANCE), base + GATED_METRICS[metric]));

// The server runs in this process, so lhci must run asynchronously (spawnSync would deadlock).
const server = await startStaticServer({ trustedTypes: false });
const configDir = mkdtempSync(join(tmpdir(), 'powr-lhci-'));
let status = 0;
try {
  const config = join(configDir, 'lighthouserc.json');
  writeFileSync(config, JSON.stringify(lhciConfig(server.url)));
  await lhci('collect', config);

  const results = readdirSync(resultsDir)
    .filter((file) => /^lhr-[\d-]+\.json$/.test(file))
    .map((file) => JSON.parse(readFileSync(join(resultsDir, file), 'utf8')) as LighthouseResult);
  if (results.length === 0) throw new Error('Lighthouse produced no results.');
  const measured: Baseline = {
    measuredAt: new Date().toISOString().slice(0, 10),
    lighthouse: results[0]!.lighthouseVersion,
    runs: results.length,
    benchmarkIndex: Math.round(median(results.map((r) => r.environment.benchmarkIndex))),
    metrics: Object.fromEntries(
      METRICS.map((metric) => [
        metric,
        Math.round(median(results.map((r) => r.audits[metric]?.numericValue ?? NaN))),
      ]),
    ) as Record<GatedMetric, number>,
  };
  printSummary(results, measured);
  await lhci('upload', config);
  console.log(`HTML reports: ${reportsDir}`);

  if (args['update-baseline']) {
    const next = { ...baselines, [environment]: measured };
    writeFileSync(baselineFile, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Baseline "${environment}" written to ${baselineFile}.`);
  } else if (baseline) {
    status = await lhci('assert', config, false);
  } else {
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(
      join(resultsDir, 'baseline-candidate.json'),
      `${JSON.stringify({ [environment]: measured }, null, 2)}\n`,
    );
    const message = `No Lighthouse baseline "${environment}" in ${baselineFile}: reported only. Candidate: .lighthouseci/baseline-candidate.json`;
    console.log(process.env['GITHUB_ACTIONS'] ? `::warning::${message}` : message);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  status = 1;
} finally {
  await server.close();
  rmSync(configDir, { recursive: true, force: true });
}
process.exit(status);

function lhciConfig(url: string) {
  return {
    ci: {
      collect: {
        url: [`${url}/`],
        numberOfRuns: Number(args.runs),
        chromePath: process.env['CHROME_PATH'] || chromium.executablePath(),
        // Playwright's Chromium cannot use the sandbox on CI runners (as in the E2E tests).
        settings: { chromeFlags: '--no-sandbox' },
      },
      assert: {
        assertions: {
          ...Object.fromEntries(
            METRICS.map((metric) => [
              metric,
              [
                'error',
                {
                  maxNumericValue: limit(metric, baseline?.metrics[metric] ?? 0),
                  aggregationMethod: 'median',
                },
              ],
            ]),
          ),
          // Not budgets of §8.19: reported as warnings, never blocking.
          'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
          'categories:accessibility': ['warn', { minScore: 1 }],
          'categories:best-practices': ['warn', { minScore: 1 }],
        },
      },
      upload: { target: 'filesystem', outputDir: reportsDir },
    },
  };
}

/** Runs an lhci command; collect and upload must succeed, assert reports through its status. */
function lhci(command: string, config: string, mustPass = true): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'lhci', command, `--config=${config}`], {
      cwd: webRoot,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (mustPass && code !== 0) reject(new Error(`lhci ${command} failed (exit code ${code}).`));
      else resolve(code ?? 1);
    });
  });
}

function median(values: number[]): number {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function printSummary(results: LighthouseResult[], measured: Baseline): void {
  console.log(
    `\nLighthouse ${measured.lighthouse}, ${measured.runs} runs, mobile preset, CPU benchmark ` +
      `index ${measured.benchmarkIndex}; baseline "${environment}"` +
      (baseline ? ` (index ${baseline.benchmarkIndex}, ${baseline.measuredAt})` : ': none'),
  );
  for (const category of CATEGORIES) {
    const scores = results.map((r) => Math.round((r.categories[category]?.score ?? NaN) * 100));
    console.log(`  ${category.padEnd(26)} ${scores.join(' / ')}`);
  }
  for (const metric of METRICS) {
    const base = baseline?.metrics[metric];
    const budget = base === undefined ? '' : `   baseline ${base}, limit ${limit(metric, base)}`;
    console.log(
      `  ${metric.padEnd(26)} ${String(measured.metrics[metric]).padStart(6)} ms${budget}`,
    );
  }
  console.log('');
}
