import type { Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';
import { checkReflow, checkScreen, onboardToPreview, skipOptionalSteps } from './planning';
import { addExercise, finishWorkout, logSet, skipCheckIn, startEmptyWorkout } from './session';

/** Taps a point where the region itself receives the tap (its middle may be a gap). */
async function tapRegion(page: Page, id: string): Promise<void> {
  await page.locator(`[data-region="${id}"]`).scrollIntoViewIfNeeded();
  const point = await page.evaluate((region) => {
    const box = document.querySelector(`[data-region="${region}"]`)!.getBoundingClientRect();
    for (let y = box.top + box.height / 3; y < box.bottom; y += 4)
      for (let x = box.left + 2; x < box.right; x += 4)
        if (document.elementFromPoint(x, y)?.closest(`[data-region="${region}"]`)) return { x, y };
    return null;
  }, id);
  expect(point, `a point of ${id}`).not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
}

/** The first exercise of the muscle panel's ranked list, and its name. */
async function firstRanked(page: Page) {
  const item = page.getByTestId('ranked-exercises').getByRole('article').first();
  await expect(item).toBeVisible();
  return { item, name: (await item.getAttribute('aria-label'))! };
}

/**
 * M4b body map (MAP-01…07) on the production build (Trusted Types enforced; the fixture fails
 * on any CSP violation): this week's heat after a workout, both views, the list alternative, a
 * tap opening the muscle panel, the ranked list in both sorts, "Add to today" without and with a
 * running workout, and the placement of an exercise in the plan; axe in both themes and reflow
 * at 320 px and 200% text on every screen.
 */
test.describe('body map screens (M4b: MAP-01…07)', () => {
  test('tap a muscle → ranked list → add to today → the workout has it', async ({ page }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell bench press');
    await logSet(page, { weight: 60, reps: 10 });
    await logSet(page, { weight: 60, reps: 9 });
    await finishWorkout(page);

    // MAP-01/04: this week's heat, the legend, both views.
    await page.goto('/explore/body-map');
    await expect(page.getByRole('heading', { level: 1, name: 'Body map' })).toBeVisible();
    await expect(page.getByTestId('body-map-status')).toHaveText(/1 workout so far/);
    const front = page.getByRole('group', { name: 'Front view, body map' });
    await expect(
      front.getByRole('button', { name: /^Chest, 2 sets this week, Under 4 sets/ }),
    ).toBeVisible();
    await expect(page.getByText('Hard sets this week')).toBeVisible();
    // The figure keeps the whole content column (the S-5 reference size).
    const box = await page.locator('svg[data-view="front"]').boundingBox();
    expect(Math.round(box!.width)).toBe(320);
    await checkScreen(page, 'explore-body-map');
    await checkReflow(page, 'explore-body-map');

    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/view=back/);
    await expect(page.getByRole('group', { name: 'Back view, body map' })).toBeVisible();
    await checkScreen(page, 'explore-body-map-back');
    await page.getByRole('button', { name: 'Front', exact: true }).click();

    // MAP-06: the list alternative, one tap away.
    await page.getByRole('button', { name: 'Show as a list' }).click();
    await expect(page).toHaveURL(/show=list/);
    await expect(page.getByRole('heading', { level: 2, name: 'Front' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Chest, 2 sets this week, Under 4 sets/ }),
    ).toBeVisible();
    await checkScreen(page, 'explore-body-map-list');
    await checkReflow(page, 'explore-body-map-list');
    await page.getByRole('button', { name: 'Show the figure' }).click();

    // MAP-02: a tap on the region opens the muscle panel.
    await tapRegion(page, 'front.chest');
    await expect(page).toHaveURL(/\/explore\/body-map\/mu\.chest/);
    await expect(page.getByRole('heading', { level: 1, name: 'Chest' })).toBeVisible();
    await expect(page.getByTestId('muscle-sets')).toContainText('2 sets');
    await expect(page.getByTestId('contributors')).toContainText('Barbell bench press');
    await expect(page.getByTestId('ranked-exercises').getByRole('article').first()).toContainText(
      /Effectiveness: \d+ of 100/,
    );
    await checkScreen(page, 'muscle-panel');
    await checkReflow(page, 'muscle-panel');
    await page.getByRole('button', { name: 'Focus', exact: true }).click();
    await expect(page).toHaveURL(/sort=focus/);
    await expect(page.getByTestId('ranked-exercises').getByRole('article').first()).toContainText(
      /Focus on Chest: \d+ of 100/,
    );
    await checkScreen(page, 'muscle-panel-focus');

    // MAP-05 without a workout today: start one with the exercise.
    const first = await firstRanked(page);
    await first.item.getByRole('button', { name: `Add to today: ${first.name}` }).click();
    await expect(first.item).toContainText(`No workout today yet. Start one with ${first.name}?`);
    await first.item
      .getByRole('button', { name: `Start a workout with it: ${first.name}` })
      .click();
    await expect(page).toHaveURL(/\/session$/);
    await skipCheckIn(page);
    await expect(
      page
        .getByTestId('session-sets')
        .getByRole('heading', { level: 3, name: new RegExp(`${first.name}$`) }),
    ).toBeVisible();

    // MAP-05 with a running workout: a small region's chip, then "Add to today".
    await page.goto('/explore/body-map');
    await page
      .getByRole('list', { name: 'Small on the figure, so also here:' })
      .getByRole('button', { name: /^Side delts/ })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Side delts' })).toBeVisible();
    const second = await firstRanked(page);
    await second.item.getByRole('button', { name: `Add to today: ${second.name}` }).click();
    await expect(second.item).toContainText(`${second.name} was added to your workout.`);
    await second.item.getByRole('link', { name: 'Back to the workout' }).click();
    await expect(page).toHaveURL(/\/session$/);
    await expect(
      page
        .getByTestId('session-sets')
        .getByRole('heading', { level: 3, name: new RegExp(`${second.name}$`) }),
    ).toBeVisible();
  });

  test('places an exercise in the plan from the muscle panel (MAP-05 → PLN-09)', async ({
    page,
  }) => {
    await onboardToPreview(page);
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    await page.goto('/explore/body-map/mu.elbow-flexors');
    await expect(page.getByRole('heading', { level: 1, name: 'Biceps' })).toBeVisible();
    // MAP-07: the sub-regions open their own panel.
    await expect(page.getByRole('link', { name: /^Brachialis/ })).toBeVisible();

    const first = await firstRanked(page);
    // How often the plan editor names it before (a day may already have it).
    await page.goto('/plan/edit');
    await expect(page.getByRole('heading', { level: 1, name: 'Edit plan' })).toBeVisible();
    const before = await page.getByText(first.name, { exact: true }).count();
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Biceps' })).toBeVisible();

    await first.item.getByRole('button', { name: `Place in the plan: ${first.name}` }).click();
    const sheet = page.getByRole('dialog', { name: `Place ${first.name} in your plan` });
    await expect(sheet).toBeVisible();
    await sheet
      .getByRole('button', { name: new RegExp(`^Add ${first.name} to `) })
      .first()
      .click();
    await expect(
      sheet
        .getByText('No new warnings')
        .or(sheet.getByText('New or changed plan checks with this change:')),
    ).toBeVisible();
    await checkScreen(page, 'muscle-place-in-plan');
    await sheet.getByRole('button', { name: 'Save from the next session' }).click();
    await expect(sheet).toHaveCount(0);

    // The plan editor shows the exercise in the saved week.
    await page.goto('/plan/edit');
    await expect(page.getByRole('heading', { level: 1, name: 'Edit plan' })).toBeVisible();
    await expect(page.getByText(first.name, { exact: true }).first()).toBeVisible();
    expect(await page.getByText(first.name, { exact: true }).count()).toBeGreaterThan(before);
  });
});
