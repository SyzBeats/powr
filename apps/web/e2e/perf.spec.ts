import type { CDPSession, Page } from '@playwright/test';

import { expect, test, waitForOfflineReady } from './fixtures';
import { onboardToPreview, skipOptionalSteps } from './planning';
import { addExercise, dock, finishWorkout, startEmptyWorkout } from './session';

/**
 * M6a performance audit (NFR-PERF-01…08, technical concept §8.19, QS-02, QS-09, QS-16) with the
 * reference dataset (A-11: about five years, 1,300 workouts, 40,000 sets, 1,800 weigh-ins), loaded
 * into the real IndexedDB by `/debug/perf`. Chromium on Playwright's mobile profile (360 × 780,
 * DPR 3, the production build with its service worker) with CPU throttling (default 4×). Prints
 * one `PERF {...}` line per measurement and a summary with the median and p75.
 *
 * Opt-in, not part of `pnpm verify`: `POWR_PERF=1 pnpm e2e perf` (after `pnpm build`);
 * `POWR_PERF_CPU=1` for no throttling, `POWR_PERF_RUNS=10` for the number of runs.
 */

const CPU = Number(process.env['POWR_PERF_CPU'] ?? 4);
const RUNS = Number(process.env['POWR_PERF_RUNS'] ?? 7);
const SQUAT = 'ex.barbell-back-squat';

interface Step {
  /** A CSS selector to click, or a button or link by its trimmed text. */
  readonly click?: string;
  readonly clickText?: string;
  /** Types into an input the way a user does (React sees an `input` event). */
  readonly input?: { readonly selector: string; readonly value: string };
  /** Done when this selector matches… */
  readonly ready: string;
  /** …and its text matches this pattern (a RegExp source)… */
  readonly text?: string;
  /** …and differs from this text. */
  readonly changedFrom?: string;
}

/**
 * Runs the step inside the page and resolves with the milliseconds from the action to the first
 * DOM change after which `ready` holds (the frame then paints it). Inside the page, so no
 * Playwright round trip is counted.
 */
function measure(page: Page, step: Step): Promise<number> {
  return page.evaluate(
    (s) =>
      new Promise<number>((resolve, reject) => {
        const pattern = s.text ? new RegExp(s.text) : null;
        const done = () => {
          const element = document.querySelector(s.ready);
          if (!element) return false;
          const text = (element.textContent ?? '').trim();
          if (pattern && !pattern.test(text)) return false;
          return s.changedFrom === undefined || text !== s.changedFrom;
        };
        const started = performance.now();
        const finish = () => {
          observer.disconnect();
          clearTimeout(timer);
          resolve(performance.now() - started);
        };
        const observer = new MutationObserver(() => {
          if (done()) finish();
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
        });
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error(`timed out waiting for ${s.ready} ${s.text ?? ''}`));
        }, 120_000);
        if (s.click) document.querySelector<HTMLElement>(s.click)?.click();
        if (s.clickText) {
          const target = [...document.querySelectorAll<HTMLElement>('button, a')].find(
            (element) => element.textContent?.trim() === s.clickText,
          );
          target?.click();
        }
        if (s.input) {
          const input = document.querySelector<HTMLInputElement>(s.input.selector)!;
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
            input,
            s.input.value,
          );
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (done()) finish();
      }),
    step,
  );
}

const samples = new Map<string, number[]>();
function record(name: string, ms: number, cpu = CPU): void {
  const rounded = Math.round(ms);
  samples.set(name, [...(samples.get(name) ?? []), rounded]);
  process.stdout.write(`PERF ${JSON.stringify({ cpu, name, ms: rounded })}\n`);
}
function quantile(values: readonly number[], q: number): number {
  const sorted = values.toSorted((a, b) => a - b);
  // Nearest rank, as the budgets' p75 (§8.19).
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)]!;
}

async function throttle(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  return cdp;
}

/** A cold load of Home in a new page of the same browser context (installed app files). */
async function coldHome(page: Page): Promise<void> {
  await throttle(page);
  await page.goto('/');
  await page.waitForFunction(
    () => performance.getEntriesByName('powr-home-interactive').length > 0,
    undefined,
    { timeout: 60_000 },
  );
  const timings = await page.evaluate(() => ({
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1,
    interactive: performance.getEntriesByName('powr-home-interactive')[0]!.startTime,
  }));
  record('cold start: first contentful paint', timings.fcp);
  record('cold start: Home interactive (powr-home-interactive)', timings.interactive);
}

test.describe('performance with the reference dataset (M6a)', () => {
  test.skip(!process.env['POWR_PERF'], 'set POWR_PERF=1 to measure');

  test(`reference dataset, CPU slowdown ${CPU}×`, async ({ page }) => {
    test.setTimeout(30 * 60_000);

    // An onboarded user with a plan.
    await onboardToPreview(page, { days: ['Monday', 'Wednesday', 'Friday'] });
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.goto('/');
    await waitForOfflineReady(page);

    // The reference history into the real IndexedDB, then the one-off derived-data rebuild.
    await page.goto('/debug/perf');
    await page.getByRole('button', { name: 'Add the reference history' }).click();
    await expect(page.getByTestId('reference-status')).toHaveText(/^Added \d+ workouts/, {
      timeout: 300_000,
    });
    const loaded = (await page.getByTestId('reference-status').textContent()) ?? '';
    process.stdout.write(`PERF ${JSON.stringify({ cpu: 1, name: 'dataset', text: loaded })}\n`);
    // From the page load until "Updating your weekly numbers…" is gone (polled, so ±0.1 s).
    await page.goto('/');
    await expect(page.getByTestId('home-status')).toHaveText('', { timeout: 300_000 });
    record(
      'first Home after the load: weekly numbers rebuilt (since the page load)',
      await page.evaluate(() => performance.now()),
      1,
    );
    record(
      'first Progress after the load: every exercise derived',
      await measure(page, {
        click: 'nav a[href="/progress"]',
        ready: '[data-testid="trained-e1rm"]',
      }),
      1,
    );
    const context = page.context();
    await page.close();

    // Cold starts and the screens, each run in a new page with the CPU throttled.
    let at: Page | null = null;
    for (let run = 0; run < RUNS; run++) {
      if (at) await at.close();
      at = await context.newPage();
      await coldHome(at);
      await expect(at.getByTestId('home-status')).toHaveText('', { timeout: 60_000 });
      record(
        'Progress hub',
        await measure(at, {
          click: 'nav a[href="/progress"]',
          ready: '[data-testid="trained-e1rm"]',
        }),
      );
      record(
        'exercise progress with its chart (squat, 5 years)',
        await measure(at, {
          click: `a[href^="/progress/exercise/${SQUAT}"]`,
          ready: '[data-chart-ready]',
        }),
      );
      record(
        'Explore',
        await measure(at, {
          click: 'nav a[href="/explore"]',
          ready: 'a[href^="/explore/body-map"]',
        }),
      );
      record(
        'body map with this week',
        await measure(at, {
          click: 'main a[href^="/explore/body-map"]',
          ready: '[data-testid="body-map-status"]',
          text: 'workouts? so far',
        }),
      );
      await measure(at, {
        click: 'nav a[href="/explore"]',
        ready: 'a[href^="/explore/exercises"]',
      });
      record(
        'library list',
        await measure(at, {
          click: 'main a[href^="/explore/exercises"]',
          ready: '[data-testid="library-count"]',
          text: '\\d+ exercises',
        }),
      );
      const all = (await at.getByTestId('library-count').textContent())?.trim() ?? '';
      record(
        'library search ("row")',
        await measure(at, {
          input: { selector: 'input[type="search"]', value: 'row' },
          ready: '[data-testid="library-count"]',
          text: '\\d+ exercises?',
          changedFrom: all,
        }),
      );
    }
    const last = at!;
    // The idle check of the whole history after start (useInsightsWarmup, 5 s after the start).
    await last.waitForFunction(
      () => performance.getEntriesByName('powr-insights-warmup').length > 0,
      undefined,
      { timeout: 60_000 },
    );
    record(
      'idle check of the derived weeks after start (powr-insights-warmup)',
      await last.evaluate(() => performance.getEntriesByName('powr-insights-warmup')[0]!.duration),
    );

    // NFR-PERF-03: the squat's sets (five years of squat history behind each), each timed from
    // the tap. A freestyle workout: a new plan starts with its first training week.
    await last.goto('/session');
    await startEmptyWorkout(last);
    await addExercise(last, 'Barbell back squat');
    await last.evaluate(() => {
      new PerformanceObserver(() => undefined).observe({
        type: 'event',
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit);
    });
    // The squat's planned sets: its warm-ups and working sets (eight with the defaults).
    for (let set = 0; set < 10; set++) {
      const confirm = dock(last).getByRole('button', { name: 'Confirm set' });
      await confirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
      if (!(await confirm.isVisible())) {
        await expect(last.getByRole('heading', { name: 'All planned sets done' })).toBeVisible();
        break;
      }
      // Prefilled from the history; a field without a value (a new exercise) gets one.
      const weight = dock(last).getByLabel(/^Weight/);
      if ((await weight.count()) > 0 && (await weight.inputValue()) === '') await weight.fill('60');
      const reps = dock(last).getByLabel('Reps', { exact: true });
      if ((await reps.count()) > 0 && (await reps.inputValue()) === '') await reps.fill('8');
      const result = await last.evaluate(
        () =>
          new Promise<{ frame: number; row: number }>((resolve, reject) => {
            setTimeout(() => reject(new Error('no logged row within 30 s')), 30_000);
            const before = document.querySelectorAll('[data-testid="logged-set"]').length;
            const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
              (element) => element.textContent?.trim() === 'Confirm set',
            )!;
            const started = performance.now();
            let frame = -1;
            const observer = new MutationObserver(() => {
              if (document.querySelectorAll('[data-testid="logged-set"]').length > before) {
                observer.disconnect();
                const row = performance.now() - started;
                requestAnimationFrame(() => resolve({ frame, row }));
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            button.click();
            requestAnimationFrame(() => {
              frame = performance.now() - started;
            });
          }),
      );
      record('set confirm: tap to the next frame (visual feedback)', result.frame);
      record('set confirm: tap to the logged row (after the durable commit)', result.row);
    }
    const commits = await last.evaluate(() =>
      performance.getEntriesByName('powr-set-commit').map((entry) => entry.duration),
    );
    for (const ms of commits) record('set confirm: tap to durable commit (powr-set-commit)', ms);
    const events = await last.evaluate(() =>
      (performance.getEntriesByType('event') as PerformanceEventTiming[])
        .filter((entry) => entry.name === 'click')
        .map((entry) => entry.duration),
    );
    process.stdout.write(
      `PERF ${JSON.stringify({ cpu: CPU, name: 'Event Timing clicks ≥ 16 ms', ms: events })}\n`,
    );
    await finishWorkout(last);

    // "Verify data" (NFR-REL-03), three times, each on a freshly opened Data screen.
    for (let run = 0; run < 3; run++) {
      await last.goto('/data');
      await expect(last.getByRole('heading', { level: 1, name: 'Data and backups' })).toBeVisible();
      record(
        'Verify data',
        await measure(last, {
          clickText: 'Verify data',
          ready: '[data-testid="verify-status"]',
          text: '^Done',
        }),
      );
    }
    // The backup export (NFR-PERF-08).
    const exported = last.waitForEvent('download', { timeout: 120_000 });
    record(
      'backup export (reference dataset)',
      await measure(last, {
        clickText: 'Export backup',
        ready: '[data-testid="export-status"]',
        text: 'powr-backup-',
      }),
    );
    await exported;

    const summary = Object.fromEntries(
      [...samples].map(([name, values]) => [
        name,
        { runs: values.length, median: quantile(values, 0.5), p75: quantile(values, 0.75), values },
      ]),
    );
    process.stdout.write(`PERF-SUMMARY ${JSON.stringify({ cpu: CPU, summary }, null, 2)}\n`);
    await test.info().attach(`perf-cpu-${CPU}x.json`, {
      body: JSON.stringify({ cpu: CPU, summary }, null, 2),
      contentType: 'application/json',
    });
    expect(samples.get('cold start: Home interactive (powr-home-interactive)')?.length).toBe(RUNS);
  });
});
