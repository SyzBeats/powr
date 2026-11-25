import type { Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';
import { checkReflow, checkScreen } from './planning';

/**
 * M4b Progress tab (ANL-02…07, ANL-11) under the production CSP with Trusted Types: a few
 * backdated bench-press workouts, then the exercise's e1RM chart (range chips, the lazy ECharts
 * canvas, "View as table") and every Progress screen with axe in both themes and reflow at 320 px
 * and 200% text. The unit is whatever "Just let me log" chose for the device locale (kg or lb).
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** A local calendar day `offset` days from today, as the date input wants it. */
function localDay(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A backdated workout with one bench-press set of 5 at RIR 2 (a heavy set: it feeds the trend). */
async function logPastWorkout(page: Page, day: string, weight: number): Promise<void> {
  await page.goto('/session/past/new');
  await expect(page.getByRole('heading', { level: 1, name: 'Log a past workout' })).toBeVisible();
  await page.getByLabel('Date', { exact: true }).fill(day);
  await page.getByRole('searchbox', { name: 'Find an exercise' }).fill('bench');
  await page.getByRole('button', { name: 'Add Barbell bench press' }).click();
  const set = page
    .getByRole('region', { name: 'Barbell bench press' })
    .getByRole('group', { name: 'Set 1' });
  await set.getByRole('textbox', { name: /^Weight/ }).fill(String(weight));
  await set.getByRole('textbox', { name: 'Reps', exact: true }).fill('5');
  await set.getByRole('textbox', { name: 'Reps in reserve (optional)' }).fill('2');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Edit workout' })).toBeVisible();
}

test.describe('Progress tab (M4b: ANL-02…07, ANL-11)', () => {
  test('an exercise trend: range chips change the window, the table lists the sessions', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await skipOnboarding(page);
    // About 14, 5 and 2 weeks ago and yesterday.
    for (const [offset, weight] of [
      [-100, 80],
      [-35, 85],
      [-14, 90],
      [-1, 95],
    ] as const) {
      await logPastWorkout(page, localDay(offset), weight);
    }

    await page.goto('/progress');
    await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
    await expect(page.getByTestId('trained-exercises')).toContainText('4 workouts');
    // TD-55: the current estimate in the user's unit and the change label in words. Four sessions
    // are too few for a reference point, so the label says so rather than claiming a change.
    const benchRow = page
      .getByTestId('trained-exercises')
      .getByRole('link', { name: /Barbell bench press/ });
    await expect(benchRow.getByTestId('trained-e1rm')).toHaveText(
      /^Estimated 1-rep max [\d.,]+ (kg|lb)/,
    );
    await expect(benchRow.getByTestId('trained-change')).toHaveText(
      'Not enough sessions yet to tell a real change',
    );
    await checkScreen(page, 'progress');
    await checkReflow(page, 'progress');

    await page
      .getByTestId('trained-exercises')
      .getByRole('link', { name: /Barbell bench press/ })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Barbell bench press progress' }),
    ).toBeVisible();
    const chart = page.getByRole('region', { name: 'Estimated 1-rep max' });
    await expect(chart.locator('canvas')).toBeVisible();
    await expect(chart).toContainText(/Barbell bench press: .* estimated 1-rep max/);
    await checkScreen(page, 'exercise-progress');

    // The default window is 12 weeks: three of the four sessions.
    await chart.getByRole('button', { name: 'View as table' }).click();
    const table = chart.getByRole('table');
    await expect(table).toContainText(/12 wks?, newest first/);
    await expect(table.getByRole('row')).toHaveCount(4);

    // 4 weeks: two sessions; the chip is pressed.
    const fourWeeks = chart.getByRole('button', { name: /^4 wks?$/ });
    await fourWeeks.click();
    await expect(fourWeeks).toHaveAttribute('aria-pressed', 'true');
    await expect(table).toContainText(/4 wks?, newest first/);
    await expect(table.getByRole('row')).toHaveCount(3);

    // All: every session (the full history is loaded for it).
    await chart.getByRole('button', { name: 'All', exact: true }).click();
    await expect(table).toContainText(/All, newest first/);
    await expect(table.getByRole('row')).toHaveCount(5);
    await expect(table.getByRole('row').nth(1)).toContainText(/(kg|lb)/);
    await checkScreen(page, 'exercise-progress-table');
    await checkReflow(page, 'exercise-progress');

    // "Compare with other lifts" starts the comparison with this exercise.
    await page.getByRole('link', { name: 'Compare with other lifts' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Compare lifts' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Barbell bench press', pressed: true }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Strength trends compared' })).toBeVisible();
    await checkScreen(page, 'compare');
    await checkReflow(page, 'compare');
  });

  test('volume, PRs, calendar and scores pass axe and reflow', async ({ page }) => {
    test.setTimeout(120_000);
    await skipOnboarding(page);
    await logPastWorkout(page, localDay(-8), 80);
    await logPastWorkout(page, localDay(0), 90);

    await page.goto('/progress/volume');
    await expect(page.getByRole('heading', { level: 1, name: 'Volume per muscle' })).toBeVisible();
    await expect(page.getByTestId('volume-table')).toBeVisible();
    await checkScreen(page, 'volume');
    await checkReflow(page, 'volume');
    await page.getByTestId('volume-table').getByRole('button', { name: 'Chest' }).click();
    const detail = page.getByTestId('volume-muscle');
    await expect(detail.getByRole('heading', { name: 'Chest', exact: true })).toBeFocused();
    await expect(detail.getByTestId('volume-contributors')).toContainText('Barbell bench press');
    await expect(detail.getByRole('region', { name: 'Chest: hard sets per week' })).toBeVisible();
    await checkScreen(page, 'volume-muscle');
    await checkReflow(page, 'volume-muscle');

    await page.goto('/progress/prs');
    await expect(page.getByRole('heading', { level: 1, name: 'Personal records' })).toBeVisible();
    await expect(page.getByTestId('pr-list')).toContainText('New heaviest weight');
    await checkScreen(page, 'prs');
    await checkReflow(page, 'prs');

    await page.goto('/progress/calendar');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Calendar and history' }),
    ).toBeVisible();
    await expect(page.getByTestId('session-count')).toHaveText('2 workouts in the last 12 months');
    await checkScreen(page, 'calendar');
    await checkReflow(page, 'calendar');

    await page.goto('/progress/scores');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Powerlifting scores' }),
    ).toBeVisible();
    await expect(page.getByText('What the scores still need')).toBeVisible();
    await checkScreen(page, 'scores');
    await checkReflow(page, 'scores');
  });
});
