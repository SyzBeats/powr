import type { Locator, Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';
import { checkReflow, checkScreen, onboardToPreview, skipOptionalSteps } from './planning';
import {
  addExercise,
  dock,
  finishWorkout,
  keepThePlan,
  logSet,
  skipCheckIn,
  startEmptyWorkout,
} from './session';

/**
 * The workout session screens (M3b): WKT-01…16 and TMR-01…13 as a user meets them, with axe in
 * both themes, reflow, the thumb zone (NFR-A11Y-03) and the target sizes (NFR-A11Y-02).
 */

/** A Monday morning: with Monday as a training day, today's planned session exists. */
const MONDAY = new Date('2026-11-23T08:00:00');

/** Onboards with a plan that trains on Monday, accepts it and opens the start screen. */
async function withPlan(page: Page): Promise<void> {
  await onboardToPreview(page, { days: ['Monday', 'Wednesday', 'Friday'] });
  await skipOptionalSteps(page);
  await page.getByRole('button', { name: 'Accept plan' }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await page.goto('/session');
  await expect(page.getByRole('heading', { level: 1, name: 'Start a workout' })).toBeVisible();
}

/** "2:27" → 147. */
function seconds(text: string | null): number {
  const [minutes, rest] = (text ?? '0:00').split(':').map(Number);
  return (minutes ?? 0) * 60 + (rest ?? 0);
}

/** The name of the exercise in focus. */
const currentExercise = (page: Page) =>
  page.getByTestId('current-set').getByRole('heading', { level: 2 });

/** Logs a finished past session of one exercise (WKT-15), so the engine has a history. */
async function logPastWorkout(
  page: Page,
  exercise: string,
  weight: number,
  reps: number,
  daysAgo = 2,
) {
  await page.goto('/session/past/new');
  await expect(page.getByRole('heading', { level: 1, name: 'Log a past workout' })).toBeVisible();
  const date = await page.evaluate((days) => {
    const day = new Date(Date.now() - days * 86_400_000);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  }, daysAgo);
  await page.getByLabel('Date', { exact: true }).fill(date);
  await page.getByRole('searchbox', { name: 'Find an exercise' }).fill(exercise);
  await page.getByRole('button', { name: `Add ${exercise}` }).click();
  const set = page.getByRole('region', { name: exercise }).getByRole('group', { name: 'Set 1' });
  await set.getByRole('textbox', { name: /^Weight/ }).fill(String(weight));
  await set.getByRole('textbox', { name: 'Reps', exact: true }).fill(String(reps));
  await set.getByRole('textbox', { name: 'Reps in reserve (optional)' }).fill('2');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Edit workout' })).toBeVisible();
}

/** Every primary control of the dock (NFR-A11Y-03 and NFR-A11Y-02 checks). */
function primaryControls(page: Page): Locator[] {
  const controls = dock(page);
  return [
    controls.getByRole('button', { name: 'Confirm set' }),
    controls.getByRole('button', { name: 'Less weight' }),
    controls.getByRole('button', { name: 'More weight' }),
    controls.getByLabel(/^Weight/),
    controls.getByRole('button', { name: 'One rep fewer' }),
    controls.getByRole('button', { name: 'One rep more' }),
    controls.getByLabel('Reps', { exact: true }),
    ...['0', '1', '2', '3', '4'].map((chip) =>
      controls.getByRole('button', { name: chip, exact: true }),
    ),
    controls.getByRole('button', { name: '5 or more' }),
    controls.getByRole('button', { name: '−15 seconds' }),
    controls.getByRole('button', { name: '+15 seconds' }),
    controls.getByRole('button', { name: 'Restart rest' }),
    controls.getByRole('button', { name: 'Skip rest' }),
    controls.getByRole('button', { name: 'Undo' }),
  ];
}

test.describe('workout session (M3b)', () => {
  test('planned session: one tap per set, rest starts by itself, "Rest over", finish with a PR', async ({
    page,
  }) => {
    // Eleven axe scans in two themes and reflow checks: 25–38 s under the parallel run (M6a saw
    // it pass 30 s), so a heavy test's limit like the library's.
    test.setTimeout(90_000);
    await page.clock.install({ time: MONDAY });
    await withPlan(page);
    await checkScreen(page, 'session-start');
    await checkReflow(page, 'session-start');

    // WKT-01: today's planned session in one tap from Home; the check-in comes first (RDY-01).
    await expect(
      page.getByRole('button', { name: 'Start session', exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Home' })
      .click();
    await page.getByRole('link', { name: "Start today's session" }).click();
    await expect(page).toHaveURL(/\/session$/);
    await expect(page.getByRole('heading', { level: 1, name: 'How are you today?' })).toBeVisible();
    await checkScreen(page, 'session-check-in');
    await checkReflow(page, 'session-check-in');
    await page.getByRole('group', { name: 'Energy' }).getByRole('button', { name: '4' }).click();
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await keepThePlan(page);
    const exercise = (await currentExercise(page).textContent()) ?? '';
    expect(exercise).not.toBe('');

    // A history for the first lift, logged for two days ago (WKT-15): now it has a load.
    await logPastWorkout(page, exercise, 40, 8);
    // TMR-12: the mini timer leads back to the running workout.
    await expect(page.getByTestId('mini-timer')).toContainText('Back to workout');
    await checkScreen(page, 'session-mini-timer');
    await page.getByTestId('mini-timer').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
    await expect(currentExercise(page)).toHaveText(exercise);
    await expect(dock(page).getByLabel(/^Weight/)).not.toHaveValue('');
    await checkScreen(page, 'session-logging');
    await checkReflow(page, 'session-logging');

    // NFR-USE-01: one tap logs the set as prescribed; the rest timer starts (TMR-01).
    await dock(page).getByRole('button', { name: 'Confirm set' }).click();
    await expect(page.getByTestId('logged-set')).toHaveCount(1);
    await expect(dock(page).getByTestId('rest-panel')).toBeVisible();
    await expect(dock(page).getByTestId('timer-time')).toHaveText(/^\d:\d\d$/);
    // MOT-01/02: more reps than ever at that weight is a PR, celebrated at the top.
    await expect(page.getByTestId('pr-celebration')).toContainText('New personal record');
    await checkScreen(page, 'session-resting-pr');

    // TMR-04/05: the rest ends; the dock says so with the time since the end.
    await page.clock.fastForward('05:00');
    await expect(dock(page).getByTestId('timer-time')).toHaveText(/^Rest over · \+\d:\d\d$/);
    await checkScreen(page, 'session-rest-over');

    // The next set, also in one tap, then finish (WKT-13).
    await dock(page).getByRole('button', { name: 'Confirm set' }).click();
    await expect(page.getByTestId('logged-set')).toHaveCount(2);
    await finishWorkout(page);
    await expect(page.getByTestId('summary-prs')).toContainText(exercise);
    await checkScreen(page, 'session-summary');
    await checkReflow(page, 'session-summary');
  });

  test('freestyle: an empty workout, exercises added on the way, set details and a finish', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Add your first exercise' }),
    ).toBeVisible();
    await checkScreen(page, 'session-empty');
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await expect(page.getByRole('dialog', { name: 'Add exercise' })).toBeVisible();
    await checkScreen(page, 'session-add-exercise');
    await page.keyboard.press('Escape');
    await addExercise(page, 'Barbell bench press');
    // PRG-08: no history, so the user picks the weight ("about 12 times").
    await expect(page.getByText('Pick a starting weight')).toBeVisible();
    await expect(dock(page).getByRole('button', { name: 'Confirm set' })).toBeDisabled();
    // NFR-USE-01: weight in one step of the stepper, reps typed.
    await logSet(page, { weight: 50, reps: 10 });

    // WKT-04: a drop set from the set details.
    await page.getByRole('button', { name: 'Set details' }).click();
    const details = page.getByRole('dialog', { name: 'Set details' });
    await details.getByRole('button', { name: 'Drop set' }).click();
    await details.getByRole('button', { name: 'One more' }).click();
    await checkScreen(page, 'session-set-details');
    await details.getByRole('button', { name: 'Done' }).click();
    await logSet(page, { weight: 50, reps: 8 });

    // WKT-07: the plate calculator for the current weight.
    await page.getByRole('button', { name: 'Plates' }).click();
    const plates = page.getByRole('dialog', { name: /^Plates for/ });
    await expect(plates).toBeVisible();
    await page.keyboard.press('Escape');

    await finishWorkout(page);
    await expect(page.getByRole('main')).toContainText('Barbell bench press');
  });

  test('repeat a past workout; a lift not trained for 10 days is eased back in (WKT-01, PRG-13, RDY-03)', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await logPastWorkout(page, 'Barbell bench press', 80, 5, 10);
    await page.goto('/session');
    await expect(page.getByRole('heading', { level: 1, name: 'Start a workout' })).toBeVisible();
    await page.getByRole('button', { name: /^Repeat the workout of / }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'How are you today?' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip check-in' }).click();

    // PRG-13: the proposal with its reason; nothing changes until it is applied.
    await expect(
      page.getByRole('heading', { level: 1, name: 'Suggested changes for today' }),
    ).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /^Ease back in/ })).toBeChecked();
    await checkScreen(page, 'session-proposals');
    await checkReflow(page, 'session-proposals');
    await page.getByRole('button', { name: 'Apply the selected changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
    await expect(currentExercise(page)).toHaveText('Barbell bench press');
    await expect(page.getByTestId('last-time')).toContainText('80');
  });

  test('Settings → Workout: no check-in and a count-up rest reach the session (SET-03, SET-05)', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await page.goto('/settings');
    const workout = page.getByRole('region', { name: 'Workout', exact: true });
    const checkIn = workout.getByRole('checkbox', { name: /^Check-in before a workout/ });
    await expect(checkIn).toBeChecked();
    await checkIn.click();
    await expect(checkIn).not.toBeChecked();
    await workout
      .getByRole('group', { name: 'Rest timer' })
      .getByRole('button', { name: 'Count up, ready when you are' })
      .click();
    await expect(
      workout.getByRole('button', { name: 'Count up, ready when you are' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.scrollTo(0, 0));
    await checkScreen(page, 'settings-workout');
    await checkReflow(page, 'settings-workout');

    await page.goto('/session');
    await page.getByRole('button', { name: 'Start an empty workout' }).click();
    // RDY-01 off: straight to the logging view.
    await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
    await addExercise(page, 'Seated leg curl');
    await logSet(page, { weight: 30, reps: 12 });
    // TMR-07: the rest counts up with its soft minimum.
    await expect(dock(page).getByTestId('rest-panel')).toContainText(/Resting, at least \d:\d\d/);
  });

  test('substitution: ranked alternatives with their reason replace the exercise (WKT-08)', async ({
    page,
  }) => {
    await withPlan(page);
    await page.getByRole('button', { name: 'Start an empty workout' }).click();
    await skipCheckIn(page);
    await addExercise(page, 'Barbell bench press');
    await page.getByRole('button', { name: 'Options for Barbell bench press' }).click();
    await checkScreen(page, 'session-exercise-options');
    await page.getByRole('button', { name: 'Swap exercise' }).click();
    const sheet = page.getByRole('dialog', { name: 'Swap Barbell bench press' });
    const best = sheet.getByTestId('swap-options').getByRole('button').first();
    await expect(best).toContainText('Best match:');
    await expect(best).toContainText(/Same movement|Trains the/);
    await checkScreen(page, 'session-swap');
    const name = ((await best.locator('span').first().textContent()) ?? '').replace(
      'Best match: ',
      '',
    );
    await best.click();
    await expect(currentExercise(page)).toHaveText(name);
    await expect(page.getByTestId('session-sets')).toContainText('Swapped');
  });

  test('undo restores the set and the timer (WKT-12)', async ({ page }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    await expect(dock(page).getByTestId('rest-panel')).toBeVisible();
    await dock(page).getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('logged-set')).toHaveCount(0);
    await expect(dock(page).getByTestId('rest-panel')).toHaveCount(0);
    await expect(page.getByTestId('live-announcer')).toHaveText('Undone.');
  });

  test('a superset alternates its exercises with a short transition (WKT-05, TMR-13)', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell bench press');
    await addExercise(page, 'Seated cable row');
    await page.getByRole('button', { name: 'Options for Barbell bench press' }).click();
    await page.getByRole('button', { name: 'Superset with Seated cable row' }).click();
    await expect(page.getByTestId('session-sets').getByText('Superset')).toHaveCount(2);
    await page
      .getByRole('region', { name: /Barbell bench press$/ })
      .getByRole('button', { name: /^Set 1/ })
      .click();
    await expect(currentExercise(page)).toHaveText('Barbell bench press');

    await logSet(page, { weight: 60, reps: 10 });
    // The transition to the partner, not a full rest.
    await expect(dock(page).getByTestId('rest-panel')).toContainText('Next: Seated cable row');
    await expect(currentExercise(page)).toHaveText('Seated cable row');
    await checkScreen(page, 'session-superset-transition');
    await logSet(page, { weight: 50, reps: 10 });
    // After the round: the normal rest, back to the first exercise.
    await expect(dock(page).getByTestId('rest-panel')).toContainText('Rest');
    await expect(currentExercise(page)).toHaveText('Barbell bench press');
  });

  test('a killed app resumes mid-rest with the right remaining time (WKT-14, TMR-04)', async ({
    page,
  }) => {
    await page.clock.install({ time: MONDAY });
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    const time = dock(page).getByTestId('timer-time');
    await expect(time).toHaveText(/^\d:\d\d$/);
    const before = seconds(await time.textContent());
    await page.clock.fastForward(40_000);
    // Kill and reopen: nothing in memory survives a reload.
    await page.reload();
    await expect(page.getByText('Workout resumed')).toBeVisible();
    await expect(time).toHaveText(/^\d:\d\d$/);
    const after = seconds(await time.textContent());
    expect(Math.abs(before - 40 - after)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('logged-set')).toHaveCount(1);
    await checkScreen(page, 'session-resumed');
  });

  test('primary controls sit in the lower 60% at 360 × 780 and are at least 48 px, 8 px apart (NFR-A11Y-02/03)', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    await expect(dock(page).getByTestId('rest-panel')).toBeVisible();
    await expect(dock(page).getByRole('button', { name: 'Undo' })).toBeVisible();
    const height = page.viewportSize()?.height ?? 780;
    const boxes = [];
    for (const control of primaryControls(page)) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box, String(control)).not.toBeNull();
      if (!box) continue;
      boxes.push(box);
      // NFR-A11Y-03: in the lower 60% of the screen, fully on screen.
      expect(box.y, `${String(control)} top`).toBeGreaterThanOrEqual(height * 0.4);
      expect(box.y + box.height, `${String(control)} bottom`).toBeLessThanOrEqual(height);
      // NFR-A11Y-02: at least 48 × 48 CSS px.
      expect(box.height, `${String(control)} height`).toBeGreaterThanOrEqual(48);
      expect(box.width, `${String(control)} width`).toBeGreaterThanOrEqual(48);
    }
    // ≥ 8 px between neighbouring targets (no two boxes closer than 8 px on both axes).
    for (const [index, a] of boxes.entries()) {
      for (const b of boxes.slice(index + 1)) {
        const gapX = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
        const gapY = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
        expect(Math.max(gapX, gapY), 'targets closer than 8 px').toBeGreaterThanOrEqual(7.9);
      }
    }
    // The same holds after scrolling to the end of the page: the dock stays put.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const confirm = await dock(page).getByRole('button', { name: 'Confirm set' }).boundingBox();
    expect(confirm?.y ?? 0).toBeGreaterThanOrEqual(height * 0.4);
  });
});
