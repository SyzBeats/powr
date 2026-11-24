import { readFileSync } from 'node:fs';

import type { Download } from '@playwright/test';

import { expect, test } from './fixtures';

async function downloadedJson(download: Download): Promise<Record<string, unknown>> {
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  return JSON.parse(readFileSync(await download.path(), 'utf8')) as Record<string, unknown>;
}

test.describe('diagnostics and device harnesses (WP0.8)', () => {
  test('?debug=1 unlocks developer tools that export the diagnostics log', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Developer tools' })).toHaveCount(0);

    await page.goto('/settings?debug=1');
    await expect(page.getByRole('heading', { name: 'Developer tools' })).toBeVisible();
    await expect(page.getByTestId('diagnostics-recent')).toContainText('app.start');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export diagnostics' }).click(),
    ]);
    const report = await downloadedJson(download);
    expect(report).toMatchObject({ diagnosticsVersion: 1, app: { version: '0.0.0' } });
    expect((report['entries'] as { code: string }[]).map((entry) => entry.code)).toContain(
      'db.open',
    );
    expect(JSON.stringify(report['capabilities'])).toContain('serviceWorker');
  });

  test('the alert harness records a visible run and exports the results as a file', async ({
    page,
  }) => {
    await page.goto('/debug/alerts');
    await page.getByLabel('Device and browser label').fill('Playwright Chromium');
    await page.getByLabel('A: page timeout only').check();
    await page.getByLabel('Stayed on screen').check();
    await page.getByTestId('custom-rest').fill('2');
    await page.getByRole('button', { name: 'Start run' }).click();
    await expect(page.getByTestId('run-countdown')).toBeVisible();

    // The run ends on screen ("Start run" is back), with the outcome "visible".
    await expect(page.getByRole('button', { name: 'Start run' })).toBeVisible({ timeout: 10_000 });
    const firstRow = page.getByTestId('run-results').getByRole('row').first();
    await expect(firstRow.getByRole('cell').last()).toHaveText('visible');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export results' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^powr-alerts-playwright-chromium-\d{12}\.txt$/);
    const results = await downloadedJson(download);
    expect(results).toMatchObject({
      harnessVersion: 2,
      placeholder: false,
      device: 'Playwright Chromium',
      browser: { family: 'chrome', platform: 'android', displayMode: 'browser' },
    });
    const [run] = results['runs'] as {
      variant: string;
      restMs: number;
      condition: string;
      batterySaver: boolean;
      firstAlert: { path: string };
      outcome: string;
    }[];
    expect(run).toMatchObject({
      variant: 'A',
      restMs: 2000,
      condition: 'visible',
      batterySaver: false,
      firstAlert: { path: 'visible' },
      outcome: 'visible',
    });
  });

  test('a run cut short by a reload stays in the results as interrupted', async ({ page }) => {
    await page.goto('/debug/alerts');
    await page.getByTestId('custom-rest').fill('60');
    await page.getByRole('button', { name: 'Start run' }).click();
    await expect(page.getByTestId('run-countdown')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('run-results').getByRole('row').first()).toContainText(
      'interrupted',
    );
    await expect(page.getByRole('button', { name: 'Start run' })).toBeVisible();
  });

  test('the capability probe lists detection results and exports a report', async ({ page }) => {
    await page.goto('/debug/capabilities');
    await expect(page.getByRole('heading', { name: 'Offline and storage' })).toBeVisible();
    await page.getByRole('button', { name: 'Vibrate' }).click();
    await expect(page.getByTestId('manual-checks')).toContainText('vibrate');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export report' }).click(),
    ]);
    const report = await downloadedJson(download);
    expect(report).toMatchObject({
      probeVersion: 1,
      manualChecks: { vibrate: expect.any(String) },
    });
  });
});
