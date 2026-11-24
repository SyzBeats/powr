import { readFileSync } from 'node:fs';

import type { Download, Page } from '@playwright/test';

import { expect, test, waitForOfflineReady } from './fixtures';

async function downloadedJson(download: Download): Promise<Record<string, unknown>> {
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  return JSON.parse(readFileSync(await download.path(), 'utf8')) as Record<string, unknown>;
}

/** Pretends the page went to the background (screen locked, app switched) or came back. */
async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((visibility) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => visibility === 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
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
    await page.getByTestId('custom-rest').fill('2');
    await page.getByRole('button', { name: 'Start run' }).click();
    await expect(page.getByTestId('run-countdown')).toBeVisible();

    const firstRow = page.getByTestId('run-results').getByRole('row').first();
    await expect(firstRow).toContainText('visible', { timeout: 10_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export results' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^powr-alerts-playwright-chromium-\d{12}\.txt$/);
    const results = await downloadedJson(download);
    expect(results).toMatchObject({ harnessVersion: 1, device: 'Playwright Chromium' });
    const [run] = results['runs'] as {
      variant: string;
      restMs: number;
      firstAlert: { path: string };
      outcome: string;
    }[];
    expect(run).toMatchObject({
      variant: 'A',
      restMs: 2000,
      firstAlert: { path: 'visible' },
      outcome: 'visible',
    });
  });

  test('variant B: the service-worker timer fires while the page is hidden', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.grantPermissions(['notifications'], { origin: baseURL! });
    await page.goto('/');
    await waitForOfflineReady(page);
    await page.goto('/debug/alerts');
    await page.getByLabel('B: service-worker timer only').check();
    await page.getByTestId('custom-rest').fill('2');
    await page.getByRole('button', { name: 'Start run' }).click();
    await expect(page.getByTestId('run-countdown')).toBeVisible();

    await setVisibility(page, 'hidden');
    // The rest ends while "hidden"; only the service worker can alert now.
    await page.waitForTimeout(3500);
    await setVisibility(page, 'visible');

    const firstRow = page.getByTestId('run-results').getByRole('row').first();
    await expect(firstRow).toContainText('sw-timer');
    await expect(firstRow).toContainText('on-time');
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
