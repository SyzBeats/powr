import { expect, skipOnboarding, test } from './fixtures';
import { checkReflow, checkScreen } from './planning';

/**
 * Spike S-4 (§8.10): the charts of `src/ui/charts` on the debug demo route, in the production
 * build under the production CSP with Trusted Types enforced (the fixture fails on any CSP or
 * Trusted Types violation): the lazy ECharts chunk, the canvas, the tap readout, the point
 * slider, the range chips, the table view, axe in both themes and reflow.
 */
test.describe('charts (S-4)', () => {
  test('render lazily under Trusted Types; tap, keys, ranges and the table work; axe passes', async ({
    page,
  }) => {
    await skipOnboarding(page);
    const loaded = () =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.includes('/assets/echarts-runtime-')),
      );
    // ECharts is a lazy chunk: the start screen never fetched it.
    expect(await loaded()).toBe(false);

    const response = await page.goto('/debug/charts');
    expect(response?.headers()['content-security-policy']).toContain(
      "require-trusted-types-for 'script'",
    );
    await expect(page.getByRole('heading', { level: 1, name: 'Charts (S-4)' })).toBeVisible();
    await expect(page.locator('[data-chart-ready]')).toHaveCount(4);
    await expect(page.locator('[data-chart-ready] canvas').first()).toBeVisible();
    expect(await loaded()).toBe(true);

    // A tap on the plot shows the nearest session in the readout (the chart's tooltip).
    const squat = page.getByRole('region', { name: 'Squat e1RM' });
    const readout = squat.getByTestId('chart-readout');
    await expect(readout).toContainText('Tap the chart');
    const box = (await squat.locator('canvas').first().boundingBox())!;
    await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height * 0.5);
    await expect(readout).toContainText(/kg · trend .* kg/);

    // The point slider: keyboard and screen readers get the same words.
    const slider = squat.getByRole('slider', { name: 'Points of Squat e1RM' });
    await slider.focus();
    const before = await slider.getAttribute('aria-valuetext');
    await page.keyboard.press('ArrowLeft');
    const after = await slider.getAttribute('aria-valuetext');
    expect(after).not.toBe(before);
    await expect(readout).toContainText(after!.split(' · ')[1]!);
    await page.keyboard.press('End');
    await expect(readout).toContainText(/Fri, Nov 20|Fri, 20 Nov/);

    // Range chips and Earlier/Later.
    await squat.getByRole('button', { name: 'All' }).click();
    await expect(squat.getByRole('button', { name: 'Earlier' })).toBeDisabled();
    await squat.getByRole('button', { name: /^4 wks?$/ }).click();
    await squat.getByRole('button', { name: 'Earlier' }).click();
    await expect(squat.getByRole('button', { name: 'Later' })).toBeEnabled();

    // The table view of the volume chart.
    const volume = page.getByRole('region', { name: 'Chest: weekly hard sets' });
    await volume.getByRole('button', { name: 'View as table' }).click();
    const table = volume.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(13);
    await expect(table.locator('caption')).toHaveText(
      /Chest: weekly hard sets, 12 wks?, newest first/,
    );

    // The calendar: days are named buttons.
    await expect(
      page.getByRole('button', { name: /^Monday, (November 2|2 November): Completed, Upper A$/ }),
    ).toBeVisible();

    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await checkScreen(page, 'charts');
    await checkReflow(page, 'charts');
  });
});

/**
 * The S-4 measurements (render and interaction latency with five years of data, §8.10 and
 * §8.19 budgets: render ≤ 500 ms, interaction ≤ 100 ms), on Playwright's mobile profile, with
 * and without CPU throttling. Not part of `pnpm verify`: `CHART_BENCH=1 pnpm e2e charts`.
 */
test.describe('S-4 measurements', () => {
  test.skip(!process.env['CHART_BENCH'], 'set CHART_BENCH=1 to measure');

  for (const rate of [1, 4, 6]) {
    test(`render and zoom latency, CPU slowdown ${rate}×`, async ({ page }) => {
      test.setTimeout(120_000);
      await skipOnboarding(page);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      const started = Date.now();
      await page.goto('/debug/charts');
      await expect(page.locator('[data-chart-ready]')).toHaveCount(4, { timeout: 60_000 });
      await expect(page.locator('[data-chart-ready] canvas')).toHaveCount(4);
      const ready = Date.now() - started;

      const compare = page.getByRole('region', { name: 'Squat, bench and deadlift' });
      const squat = page.getByRole('region', { name: 'Squat e1RM' });
      // Range chips: the whole history, then back to 12 weeks (the update path of a zoom).
      for (const chip of ['All', /^12 wks?$/, 'All', /^6 mths?$/, 'All']) {
        await squat.getByRole('button', { name: chip }).click();
        await page.waitForTimeout(300);
      }
      // Real two-finger pinches: on the comparison (three trend lines, the whole history in
      // view) and on the squat chart (about 1,300 sessions with the band, after "All").
      await squat.getByRole('button', { name: 'All' }).click();
      for (const chart of [compare, squat]) {
        await chart.locator('canvas').first().scrollIntoViewIfNeeded();
        const box = (await chart.locator('canvas').first().boundingBox())!;
        for (const scaleFactor of [2, 0.5, 2.5]) {
          await cdp.send('Input.synthesizePinchGesture', {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
            scaleFactor,
            relativeSpeed: 800,
            gestureSourceType: 'touch',
          });
          await page.waitForTimeout(300);
        }
      }
      const measures = await page.evaluate(() =>
        performance
          .getEntriesByType('measure')
          .filter((entry) => entry.name.startsWith('powr-chart'))
          .map((entry) => ({ name: entry.name, ms: Math.round(entry.duration * 10) / 10 })),
      );
      const pick = (prefix: string) =>
        measures.filter((entry) => entry.name.startsWith(prefix)).map((entry) => entry.ms);
      const summary = {
        cpuSlowdown: rate,
        pageToChartsReadyMs: ready,
        firstRenderMs: Object.fromEntries(
          measures
            .filter((entry) => entry.name.startsWith('powr-chart-render:'))
            .map((entry) => [entry.name.slice('powr-chart-render:'.length), entry.ms]),
        ),
        rangeChipUpdateMs: pick('powr-chart-update:squat'),
        pinchZoomCompareMs: pick('powr-chart-zoom:compare'),
        pinchZoomSquatMs: pick('powr-chart-zoom:squat'),
      };
      process.stdout.write(`S-4 ${JSON.stringify(summary)}\n`);
      await test.info().attach(`s4-cpu-${rate}x.json`, {
        body: JSON.stringify({ summary, measures }, null, 2),
        contentType: 'application/json',
      });
      expect(summary.pinchZoomSquatMs.length).toBeGreaterThan(0);
    });
  }
});
