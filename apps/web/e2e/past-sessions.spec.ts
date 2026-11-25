import type { Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';
import { checkReflow, checkScreen } from './planning';

/**
 * WKT-15: a session logged for a past date, then edited; the edit's PR effect ("This will remove
 * a PR") is shown before anything is saved, and the derived data follows the edit. The unit is
 * whatever "Just let me log" chose for the device locale (kg or lb), so values match either.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** A local calendar day `offset` days from today, as the date input wants it. */
function localDay(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Fills the backdated form with one bench-press set (RIR 2); `check` runs before saving. */
async function logPastWorkout(
  page: Page,
  day: string,
  weight: number,
  check?: () => Promise<void>,
): Promise<void> {
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
  if (check) await check();
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Edit workout' })).toBeVisible();
  await expect(page.getByTestId('past-set')).toContainText(new RegExp(`${weight} (kg|lb) × 5`));
}

test.describe('past sessions (WKT-15)', () => {
  test('logs a backdated session, then an edit shows the PR it removes before saving', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await page.goto('/session/past');
    await expect(page.getByRole('heading', { level: 1, name: 'Past workouts' })).toBeVisible();
    await expect(page.getByText('No finished workouts in the last year yet.')).toBeVisible();
    await checkScreen(page, 'past-sessions-empty');

    // Two days ago the first exposure (a milestone, no PRs); yesterday a heavier set: PRs.
    await logPastWorkout(page, localDay(-2), 80);
    await logPastWorkout(page, localDay(-1), 100, async () => {
      await checkScreen(page, 'log-past-workout');
      await checkReflow(page, 'log-past-workout');
    });
    await checkScreen(page, 'past-session-editor');
    await checkReflow(page, 'past-session-editor');

    await page.getByRole('button', { name: 'Edit set 1, Barbell bench press' }).click();
    const sheet = page.getByRole('dialog', { name: 'Edit set 1' });
    await sheet.getByRole('textbox', { name: /^Weight/ }).fill('70');
    await sheet.getByRole('button', { name: 'Save set' }).click();

    const confirm = page.getByRole('dialog', { name: 'This change affects your records' });
    await expect(confirm.getByTestId('prs-removed')).toContainText('This will remove a PR:');
    await expect(confirm.getByTestId('prs-removed')).toContainText(
      /New rep PR on Barbell bench press: 100 (kg|lb) for 5/,
    );
    // Not saved yet.
    await expect(page.getByTestId('past-set')).toContainText(/100 (kg|lb) × 5/);
    await checkScreen(page, 'past-session-pr-preview');

    await confirm.getByRole('button', { name: 'Save anyway' }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByTestId('past-set')).toContainText(/70 (kg|lb) × 5 · RIR 2/);
    await expect(page.getByTestId('live-announcer')).toHaveText('Workout updated.');

    // The list: newest first, both sessions marked as logged later.
    await page.goto('/session/past');
    const rows = page.getByTestId('past-sessions').getByRole('link');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Barbell bench press');
    await expect(rows.first()).toContainText('Logged later');
    await checkScreen(page, 'past-sessions');
    await checkReflow(page, 'past-sessions');
  });
});
