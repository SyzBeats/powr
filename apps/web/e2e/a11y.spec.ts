import type { Page } from '@playwright/test';

import { pageTitle, primaryTargetIssues, undersizedTargets, unnamedControls } from './a11y';
import { expect, test } from './fixtures';
import { checkReflow, checkScreen, onboardToPreview, skipOptionalSteps } from './planning';
import { dock, finishWorkout, logSet, skipCheckIn } from './session';

/**
 * M6a accessibility sweep (NFR-A11Y-01…07, WCAG 2.2 AA, §8.14): every route of the app with
 * realistic data (onboarded, a plan with a session today, six weeks of history from `/debug/perf`
 * with PRs, a break and daily weigh-ins, a workout finished today, a custom exercise), in light
 * and dark: axe (no serious or critical issue), reflow at 320 px with 200% text, target sizes
 * (24 px, WCAG 2.5.8; 48 px and 8 px apart for the primary workout controls, NFR-A11Y-02), a name
 * on every control and a unique page title per route. The production build with Trusted Types and
 * the production CSP (the fixture fails on any violation or foreign request).
 *
 * Grouped by area so the groups run in parallel; each builds its own data. The debug routes are
 * developer harnesses (not in release builds) and are not swept. What only a person can check is
 * listed in IMPLEMENTATION_NOTES.md ("M6a quality audits"): the TalkBack pass.
 */

const BENCH = 'ex.barbell-bench-press';

/** Every route with a fixed path (or a known ID) for an onboarded user. */
const ALL_ROUTES = [
  '/',
  '/plan',
  '/plan/edit',
  '/plan/next',
  '/plan/calendar',
  '/plan/setup/goal',
  '/session',
  '/session/past',
  '/session/past/new',
  '/progress',
  `/progress/exercise/${BENCH}`,
  '/progress/calendar',
  '/progress/compare',
  '/progress/prs',
  '/progress/scores',
  '/progress/streak',
  '/progress/volume',
  '/explore',
  '/explore/exercises',
  `/explore/exercises/${BENCH}`,
  '/explore/exercises/new',
  '/explore/body-map',
  '/explore/body-map/mu.chest',
  '/body',
  '/body/log',
  '/data',
  '/settings',
  '/settings/device-support',
  '/settings/equipment',
  '/settings/exercises',
  '/settings/rest',
  ...['goal', 'experience', 'schedule', 'body', 'priorities', 'baselines'].map(
    (answer) => `/settings/profile/${answer}`,
  ),
  ...['disclaimer', 'privacy', 'imprint', 'how-powr-decides', 'attributions'].map(
    (legal) => `/legal/${legal}`,
  ),
  '/no-such-page',
];

/**
 * A Sunday morning (the first day of the week for the en-US profile) with Sunday as a training
 * day: a new plan starts this week, so Home has today's session (`firstWeekStart`).
 */
const SUNDAY = new Date('2026-11-29T08:00:00');
const DAYS = ['Sunday', 'Tuesday', 'Thursday'];

interface SeedOptions {
  /** Log and finish today's planned session (two sets); returns its summary path. */
  readonly workoutToday?: boolean;
}

/** An onboarded user with a plan, six weeks of history and, optionally, a workout today. */
async function seed(page: Page, options: SeedOptions = {}): Promise<{ summary: string | null }> {
  await page.clock.install({ time: SUNDAY });
  await onboardToPreview(page, { days: DAYS });
  await skipOptionalSteps(page);
  await page.getByRole('button', { name: 'Accept plan' }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await page.goto('/debug/perf');
  await page.getByRole('button', { name: 'Add a short history' }).click();
  await expect(page.getByTestId('reference-status')).toHaveText(/^Added \d+ workouts/, {
    timeout: 60_000,
  });
  let summary: string | null = null;
  if (options.workoutToday) {
    await page.goto('/');
    await page.getByRole('link', { name: "Start today's workout" }).click();
    await skipCheckIn(page);
    await logSet(page, { weight: 60, reps: 8 });
    await logSet(page, { weight: 60, reps: 8 });
    await finishWorkout(page);
    summary = new URL(page.url()).pathname;
  }
  return { summary };
}

/** Every check of the sweep on the screen as it is now. */
async function sweep(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  // Screens load their data after the first paint; check the loaded state.
  await expect(page.locator('main').getByText(/^Loading.*…$/)).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await checkScreen(page, `sweep-${name}`);
  expect(await unnamedControls(page), `${name}: controls without a name`).toEqual([]);
  expect(await undersizedTargets(page), `${name}: targets under 24 × 24 px`).toEqual([]);
  await pageTitle(page);
  await checkReflow(page, `sweep-${name}`);
}

/** Goes to a path and sweeps it. */
async function visit(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await sweep(page, path);
}

test.describe('accessibility sweep of every route (M6a)', () => {
  test('the target and name checks find what they look for (a check of the checks)', async ({
    page,
  }) => {
    await page.setContent(`
      <main>
        <button style="width:16px;height:16px;padding:0;margin:0">a</button><button
          style="width:16px;height:16px;padding:0;margin:0">b</button>
        <p style="margin-top:40px">Read the <a href="#x">notice</a> first.</p>
        <button style="display:block;width:16px;height:16px;margin-top:40px">c</button>
        <button style="display:block;width:48px;height:48px;margin-top:40px"></button>
      </main>`);
    const issues = await undersizedTargets(page);
    // The two touching 16 px buttons fail; the link in a sentence and the lone small one pass.
    expect(issues.map((issue) => issue.target)).toEqual(['button "a"', 'button "b"']);
    expect(await unnamedControls(page)).toEqual(['button']);
    // Under 48 px, and closer than 8 px.
    expect(await primaryTargetIssues(page.locator('main'))).toEqual([
      'a: 16 × 16 px',
      'b: 16 × 16 px',
      expect.stringMatching(/^notice: \d+ × \d+ px$/),
      'c: 16 × 16 px',
      'a and b: 0 px apart',
    ]);
  });

  test('first run: welcome, legal texts, onboarding steps, not found', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to POWR' })).toBeVisible();
    await sweep(page, '/onboarding/welcome');
    for (const legal of ['disclaimer', 'privacy', 'imprint', 'how-powr-decides', 'attributions'])
      await visit(page, `/legal/${legal}`);
    await visit(page, '/no-such-page');
    // The steps of the core path, then the optional ones and the preview.
    await onboardToPreview(page, {
      days: DAYS,
      onStep: async (step) => {
        if (step !== 'onboarding-welcome') await sweep(page, step);
      },
    });
    await skipOptionalSteps(page, async (step) => sweep(page, step));
    await sweep(page, 'onboarding-preview');
  });

  test('Home, the plan and the workout, with the primary controls at 48 px', async ({ page }) => {
    test.setTimeout(300_000);
    await seed(page);
    await visit(page, '/');
    for (const path of ['/plan', '/plan/edit', '/plan/next', '/plan/calendar', '/plan/setup/goal'])
      await visit(page, path);

    // The workout: start screen, check-in, logging view with the dock, then the summary.
    await visit(page, '/session');
    await page.goto('/');
    await page.getByRole('link', { name: "Start today's workout" }).click();
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(/^(How are you today\?|Workout|Suggested changes for today)$/);
    if ((await heading.textContent()) !== 'Workout') await sweep(page, 'session-check-in');
    await skipCheckIn(page);
    await sweep(page, 'session-workout');
    expect(await primaryTargetIssues(dock(page)), 'the dock (NFR-A11Y-02)').toEqual([]);
    await logSet(page, { weight: 60, reps: 8 });
    // Resting: the timer controls join the dock.
    await sweep(page, 'session-resting');
    expect(await primaryTargetIssues(dock(page)), 'the dock while resting').toEqual([]);
    await logSet(page, { weight: 60, reps: 8 });
    await finishWorkout(page);
    await sweep(page, 'session-summary');

    for (const path of ['/session/past', '/session/past/new']) await visit(page, path);
    await page.goto('/session/past');
    await page.locator('main a[href^="/session/past/"]:not([href$="/new"])').first().click();
    await expect(page).toHaveURL(/\/session\/past\/[^/]+$/);
    await sweep(page, '/session/past/$sessionId');
  });

  test('Progress: the hub and every insight screen', async ({ page }) => {
    test.setTimeout(300_000);
    await seed(page, { workoutToday: true });
    for (const path of [
      '/progress',
      `/progress/exercise/${BENCH}`,
      '/progress/calendar',
      '/progress/compare',
      '/progress/prs',
      '/progress/scores',
      '/progress/streak',
      '/progress/volume',
    ])
      await visit(page, path);
  });

  test('Explore: the library, an exercise, a custom exercise and the body map', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await seed(page, { workoutToday: true });
    for (const path of [
      '/explore',
      '/explore/exercises',
      `/explore/exercises/${BENCH}`,
      '/explore/exercises/new',
      '/explore/body-map',
      '/explore/body-map/mu.chest',
    ])
      await visit(page, path);

    // A custom exercise and its edit form.
    await page.goto('/explore/exercises/new');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Sweep test press');
    await page.getByRole('combobox', { name: 'Movement pattern' }).selectOption('verticalPush');
    await page.getByRole('radio', { name: /^Compound/ }).click();
    await page
      .getByRole('group', { name: 'Muscle 1' })
      .getByRole('combobox', { name: 'Muscle' })
      .selectOption('mu.front-delts');
    await page.getByRole('combobox', { name: 'How the weight is loaded' }).selectOption('barbell');
    await page
      .getByRole('combobox', { name: 'Rest between sets' })
      .selectOption('hypertrophyCompound');
    await page.getByRole('button', { name: 'Save exercise' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sweep test press' })).toBeVisible();
    const custom = new URL(page.url()).pathname.split('/').at(-1)!;
    await sweep(page, '/explore/exercises/$custom');
    await visit(page, `/explore/exercises/edit/${custom}`);
  });

  test('every route has a page title of its own (WCAG 2.4.2)', async ({ page }) => {
    test.setTimeout(240_000);
    const titles = new Map<string, string>();
    const note = async (route: string) => {
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.locator('main').getByText(/^Loading.*…$/)).toHaveCount(0, {
        timeout: 15_000,
      });
      titles.set(route, await pageTitle(page));
    };
    // First run: the welcome screen and the onboarding steps.
    await onboardToPreview(page, {
      days: DAYS,
      onStep: (step) => note(step === 'onboarding-welcome' ? '/onboarding/welcome' : step),
    });
    await skipOptionalSteps(page, note);
    await note('onboarding-preview');
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.goto('/debug/perf');
    await page.getByRole('button', { name: 'Add a short history' }).click();
    await expect(page.getByTestId('reference-status')).toHaveText(/^Added \d+ workouts/, {
      timeout: 60_000,
    });
    for (const path of ALL_ROUTES) {
      await page.goto(path);
      await note(path);
    }
    // The routes with an ID of a record.
    await page.goto('/session/past');
    await page.locator('main a[href^="/session/past/"]:not([href$="/new"])').first().click();
    await expect(page).toHaveURL(/\/session\/past\/[^/]+$/);
    await note('/session/past/$sessionId');
    await page.goto('/settings/equipment');
    await page.locator('main a[href^="/settings/equipment/"]').first().click();
    await expect(page).toHaveURL(/\/settings\/equipment\/[^/]+$/);
    await note('/settings/equipment/$profileId');
    const byTitle = new Map<string, string[]>();
    for (const [route, title] of titles) byTitle.set(title, [...(byTitle.get(title) ?? []), route]);
    const shared = [...byTitle].filter(([, routes]) => routes.length > 1);
    expect(shared, 'titles shared by more than one route').toEqual([]);
  });

  test('Body, data, settings and the legal texts', async ({ page }) => {
    test.setTimeout(300_000);
    await seed(page);
    for (const path of [
      '/body',
      '/body/log',
      '/data',
      '/settings',
      '/settings/device-support',
      '/settings/equipment',
      '/settings/exercises',
      '/settings/rest',
      ...['goal', 'experience', 'schedule', 'body', 'priorities', 'baselines'].map(
        (answer) => `/settings/profile/${answer}`,
      ),
      ...['disclaimer', 'privacy', 'imprint', 'how-powr-decides', 'attributions'].map(
        (legal) => `/legal/${legal}`,
      ),
    ])
      await visit(page, path);
    await page.goto('/settings/equipment');
    await page.locator('main a[href^="/settings/equipment/"]').first().click();
    await expect(page).toHaveURL(/\/settings\/equipment\/[^/]+$/);
    await sweep(page, '/settings/equipment/$profileId');
  });
});
