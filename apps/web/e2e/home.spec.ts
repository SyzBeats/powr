import type { Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';
import { checkReflow, checkScreen, onboardToPreview, skipOptionalSteps } from './planning';
import { addExercise, finishWorkout, logSet, startEmptyWorkout } from './session';

/**
 * M4b Home and motivation (ANL-01, MOT-02…04, WKT-13, BOD-01…03): Home after a few workouts,
 * the bodyweight log and its trend, the summary's week heat map and streak change, the streak
 * screen, Settings → Insights and "Verify data"; axe in both themes and reflow on each screen.
 */

/** A Monday morning: with Monday as a training day, today's planned session exists. */
const MONDAY = new Date('2026-11-23T08:00:00');

/** 'YYYY-MM-DD' of `days` ago on the page's clock. */
async function daysAgo(page: Page, days: number): Promise<string> {
  return page.evaluate((back) => {
    const day = new Date(Date.now() - back * 86_400_000);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  }, days);
}

/** Logs a finished past bench-press workout (WKT-15) with one set. */
async function pastBench(page: Page, weight: number, reps: number, back: number) {
  const exercise = 'Barbell bench press';
  await page.goto('/session/past/new');
  await expect(page.getByRole('heading', { level: 1, name: 'Log a past workout' })).toBeVisible();
  await page.getByLabel('Date', { exact: true }).fill(await daysAgo(page, back));
  await page.getByRole('searchbox', { name: 'Find an exercise' }).fill(exercise);
  await page.getByRole('button', { name: `Add ${exercise}` }).click();
  const set = page.getByRole('region', { name: exercise }).getByRole('group', { name: 'Set 1' });
  await set.getByRole('textbox', { name: /^Weight/ }).fill(String(weight));
  await set.getByRole('textbox', { name: 'Reps', exact: true }).fill(String(reps));
  await set.getByRole('textbox', { name: 'Reps in reserve (optional)' }).fill('2');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Edit workout' })).toBeVisible();
}

/** BOD-01: one weigh-in through the log screen, optionally for a past day. */
async function logWeight(page: Page, value: string, back = 0) {
  await page.goto('/body/log');
  await expect(page.getByRole('heading', { level: 1, name: 'Log bodyweight' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Bodyweight' }).fill(value);
  if (back > 0) {
    await page.getByText('When: today, now').click();
    await page.getByLabel('Date', { exact: true }).fill(await daysAgo(page, back));
  }
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Bodyweight and measurements' }),
  ).toBeVisible();
}

test.describe('Home and motivation (M4b)', () => {
  test('Home after a few workouts shows the next session, the streak, the PRs and the heat map', async ({
    page,
  }) => {
    await page.clock.install({ time: MONDAY });
    await onboardToPreview(page, { days: ['Monday', 'Wednesday', 'Friday'] });
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    // Two bench-press workouts: a week ago and yesterday, the second heavier (MOT-01 PRs).
    await pastBench(page, 60, 8, 7);
    await pastBench(page, 70, 8, 1);

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    await expect(page.getByTestId('next-session')).toContainText('today');
    await expect(page.getByRole('link', { name: "Start today's workout" })).toBeVisible();
    await expect(page.getByTestId('home-status')).toHaveText('', { timeout: 15_000 });
    await expect(page.getByTestId('week-progress')).toHaveText(/\d+ of \d+ workouts?/);
    await expect(page.getByTestId('home-streak')).toHaveText(/\d+ weeks?, best \d+ weeks?/);
    await expect(page.getByTestId('home-prs')).toContainText(
      'New heaviest weight on Barbell bench press: 70 kg',
    );
    await expect(page.getByTestId('mini-heat-map')).toBeVisible();
    await expect(page.getByTestId('home-heat-summary')).toContainText('muscle');
    await checkScreen(page, 'home');
    await checkReflow(page, 'home');

    // The streak card leads to the streak screen with its rules (MOT-03/04).
    await page.getByRole('link', { name: 'Your streak' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Weekly streak' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How your streak works' })).toBeVisible();
    await expect(page.getByTestId('streak-weeks')).toBeVisible();
    await checkScreen(page, 'streak');
    await checkReflow(page, 'streak');
  });

  test('bodyweight: log in three taps from Home, then the trend, the rate and the table', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await page.goto('/');
    // BOD-01: Home → "Log bodyweight" → the value → Save.
    await page.getByRole('link', { name: 'Log bodyweight' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Log bodyweight' })).toBeVisible();
    await checkScreen(page, 'body-log');
    await checkReflow(page, 'body-log');
    await page.getByRole('textbox', { name: 'Bodyweight' }).fill('82,4');
    await page.getByRole('button', { name: 'Save' }).click();
    // en-US devices default to pounds (M2b), so the unit follows the profile.
    await expect(page.getByTestId('weigh-ins')).toContainText(/82\.4 (kg|lb)/);

    // A week of earlier weigh-ins gives the trend (BOD-02).
    for (const [back, value] of [
      [7, '83.1'],
      [6, '83.0'],
      [5, '82.8'],
      [4, '82.9'],
      [3, '82.7'],
      [2, '82.6'],
      [1, '82.5'],
    ] as const)
      await logWeight(page, value, back);

    await expect(page.getByTestId('body-trend')).toHaveText(/\d+(\.\d)? (kg|lb)/);
    await expect(page.getByTestId('weigh-ins').getByRole('listitem')).toHaveCount(8);
    await page.getByRole('button', { name: /View as table/ }).click();
    await expect(
      page.getByRole('table', { name: /Bodyweight trend/ }).getByRole('row'),
    ).not.toHaveCount(0);
    await checkScreen(page, 'body');
    await checkReflow(page, 'body');

    // BOD-03: measurements of the default sites.
    await page.getByRole('link', { name: 'Log measurements' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Log measurements' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Waist' }).fill('84.5');
    await checkScreen(page, 'body-measurements-log');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('measurements')).toContainText(/84\.5 (cm|in)/);
  });

  test('the summary shows the week heat map and the streak change; Settings and "Verify data"', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell bench press');
    await logSet(page, { weight: 60, reps: 8 });
    await finishWorkout(page);

    // WKT-13 / TD-43: the week with this workout and what it did to the streak (MOT-02/03).
    await expect(page.getByRole('heading', { name: 'Your week so far' })).toBeVisible();
    await expect(page.getByTestId('mini-heat-map')).toBeVisible();
    await expect(page.getByTestId('summary-heat-summary')).toContainText('muscle');
    await expect(page.getByTestId('summary-streak')).toContainText('1 week');
    await checkScreen(page, 'session-summary-week');
    await checkReflow(page, 'session-summary-week');

    // Settings → Insights (MOT-03 grace, BOD-03 sites, ANL-07 points).
    await page.goto('/settings');
    const grace = page.getByRole('checkbox', {
      name: /Grace: a week with one workout short still counts/,
    });
    await grace.click();
    await expect(grace).toHaveAttribute('aria-checked', 'true');
    await page.evaluate(() => window.scrollTo(0, 0));
    await checkScreen(page, 'settings-insights');

    // "Verify data" rebuilds the derived weeks and the streak.
    await page.goto('/data');
    await page.getByRole('button', { name: 'Verify data' }).click();
    await expect(page.getByTestId('verify-status')).toHaveText(/^Done: \d+ weeks? recalculated/);
    await checkScreen(page, 'data-verify');
    await checkReflow(page, 'data-verify');
  });
});
