import type { Page } from '@playwright/test';

import { expect } from './fixtures';

/*
 * Steps of the workout session (M3b) shared by the E2E specs: start, the check-in, exercises and
 * logging a set through the dock, as a user does it.
 */

/** The dock with the primary workout controls (§8.9.4). */
export const dock = (page: Page) => page.getByRole('region', { name: 'Log this set' });

/** Skips the readiness check-in when it shows (RDY-01, on by default). */
export async function skipCheckIn(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/^(How are you today\?|Workout|Suggested changes for today)$/);
  if ((await heading.textContent()) === 'How are you today?')
    await page.getByRole('button', { name: 'Skip check-in' }).click();
  await keepThePlan(page);
}

/** Past the proposals for today, if any (RDY-03, PRG-13), to the logging view. */
export async function keepThePlan(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/^(Workout|Suggested changes for today)$/);
  if ((await heading.textContent()) === 'Suggested changes for today')
    await page.getByRole('button', { name: 'Keep the plan as it is' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
}

/** From the start screen: an empty freestyle workout, past the check-in (WKT-01). */
export async function startEmptyWorkout(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Start a workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Start an empty workout' }).click();
  await skipCheckIn(page);
}

/** WKT-09: adds an exercise by name through the search sheet. */
export async function addExercise(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add exercise' });
  await sheet.getByRole('searchbox', { name: 'Search exercises' }).fill(name);
  await sheet.getByRole('button', { name, exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(
    page
      .getByTestId('session-sets')
      .getByRole('heading', { level: 3, name: new RegExp(`${name}$`) }),
  ).toBeVisible();
}

/** Types the values into the dock and confirms the set; waits for the strict commit. */
export async function logSet(
  page: Page,
  values: { readonly weight?: number; readonly reps?: number } = {},
): Promise<void> {
  const before = await page.getByTestId('logged-set').count();
  if (values.weight !== undefined)
    await dock(page)
      .getByLabel(/^Weight/)
      .fill(String(values.weight));
  if (values.reps !== undefined)
    await dock(page).getByLabel('Reps', { exact: true }).fill(String(values.reps));
  await dock(page).getByRole('button', { name: 'Confirm set' }).click();
  // The row appears only after the strict-durability write committed (the live view re-emits).
  await expect(page.getByTestId('logged-set')).toHaveCount(before + 1);
}

/** Finishes the workout from the actions below the list and lands on the summary (WKT-13). */
export async function finishWorkout(page: Page): Promise<void> {
  await page
    .getByRole('region', { name: 'Workout actions' })
    .getByRole('button', { name: 'Finish workout' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Finish workout?' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Workout summary' })).toBeVisible();
}
