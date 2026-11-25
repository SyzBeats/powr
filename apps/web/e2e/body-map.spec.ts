import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { checkReflow, checkScreen } from './planning';

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

/**
 * Spike S-5 on the production build (Trusted Types enforced; the fixture fails on any CSP
 * violation): the body-map demo behind the debug tools, both views, keyboard and tap selection,
 * the small-region chips, the list alternative, axe in both themes and reflow at 320 px and
 * 200% text.
 */
test.describe('body map (S-5, MAP-01/04/06)', () => {
  test('both views, keyboard and tap selection, chips, list, axe and reflow', async ({ page }) => {
    await page.goto('/debug/body-map');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Body map demo (S-5)' }),
    ).toBeVisible();

    const front = page.getByRole('group', { name: 'Front view, body map' });
    await expect(front.getByRole('button')).toHaveCount(10);
    await expect(
      front.getByRole('button', { name: 'Chest, 14 sets this week, 10–20 sets, in target' }),
    ).toBeVisible();
    // 320 px wide at 360 px: the reference size of the tap-target measurement.
    const box = await page.locator('svg[data-view="front"]').boundingBox();
    expect(Math.round(box!.width)).toBe(320);

    // Keyboard: the view switch, then the figure's one tab stop; arrows move, Enter selects.
    await page.getByRole('button', { name: 'Front', exact: true }).focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-region'))).toBe(
      'front.front-delts',
    );
    await page.keyboard.press('ArrowDown');
    const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('selected-muscle')).toHaveText(
      `Selected: ${name!.split(',')[0]}`,
    );

    // Taps: a region, and the chip of a small region.
    await tapRegion(page, 'front.quads');
    await expect(page.getByTestId('selected-muscle')).toHaveText('Selected: Quadriceps');
    const chips = page.getByRole('list', { name: 'Small on the figure, so also here:' });
    await chips.getByRole('button', { name: /^Tibialis/ }).click();
    await expect(page.getByTestId('selected-muscle')).toHaveText('Selected: Tibialis');
    await page.evaluate(() => window.scrollTo(0, 0));
    await checkScreen(page, 'body-map-front');

    await page.getByRole('button', { name: 'Back', exact: true }).click();
    const back = page.getByRole('group', { name: 'Back view, body map' });
    await expect(back.getByRole('button')).toHaveCount(11);
    await tapRegion(page, 'back.glutes');
    await expect(page.getByTestId('selected-muscle')).toHaveText('Selected: Glutes');
    // The list alternative shows the same selection.
    await expect(
      page
        .getByRole('region', { name: 'Back', exact: true })
        .getByRole('button', { name: /^Glutes/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.scrollTo(0, 0));
    await checkScreen(page, 'body-map-back');
    await checkReflow(page, 'body-map');
  });
});
