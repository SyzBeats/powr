import { readFileSync } from 'node:fs';

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { expect, test } from './fixtures';

test.describe('backup (WP0.6, DAT-05/06)', () => {
  test('exports a ZIP download and restores it into an empty app', async ({
    page,
    browser,
    baseURL,
  }) => {
    await page.goto('/session');
    await page.getByLabel('Reps', { exact: true }).fill('5');
    await page.getByRole('button', { name: 'Confirm set' }).click();
    await expect(page.getByTestId('log-status')).toContainText('× 5');
    await page.getByLabel('Reps', { exact: true }).fill('4');
    await page.getByRole('button', { name: 'Confirm set' }).click();
    await expect(page.getByTestId('session-sets').getByRole('listitem')).toHaveCount(2);

    await page.goto('/data');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export backup' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^powr-backup-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/);
    await expect(page.getByTestId('export-status')).toContainText(download.suggestedFilename());
    const file = await download.path();
    const entries = Object.keys(unzipSync(readFileSync(file)));
    expect(entries[0]).toBe('manifest.json');

    // A fresh browser context is an empty app on the same origin (new phone).
    const fresh = await browser.newContext({ baseURL: baseURL! });
    const restorePage = await fresh.newPage();
    await restorePage.goto('/data');
    await restorePage.getByTestId('restore-file').setInputFiles(file);
    const preview = restorePage.getByTestId('restore-preview');
    await expect(preview).toContainText('Sets');
    await expect(preview.getByText('2', { exact: true })).toBeVisible();

    const replace = restorePage.getByRole('button', { name: 'Replace all data' });
    await expect(replace).toBeDisabled();
    await restorePage.getByTestId('restore-confirm').fill('REPLACE');
    await replace.click();
    await expect(restorePage.getByTestId('restore-status')).toHaveText(
      'Restored. 2 sets imported.',
    );

    await restorePage.goto('/session');
    await expect(restorePage.getByTestId('session-sets').getByRole('listitem')).toHaveCount(2);
    await fresh.close();
  });

  test('rejects an edited backup and changes nothing (QS-17)', async ({ page }) => {
    await page.goto('/session');
    await page.getByRole('button', { name: 'Confirm set' }).click();
    await expect(page.getByTestId('session-sets').getByRole('listitem')).toHaveCount(1);
    await page.goto('/data');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export backup' }).click(),
    ]);

    // One altered value in sets.json, everything else (including the manifest) untouched.
    const files = unzipSync(readFileSync(await download.path()));
    const sets = strFromU8(files['data/sets.json']!);
    files['data/sets.json'] = strToU8(sets.replace('"reps":5', '"reps":6'));
    expect(strFromU8(files['data/sets.json'])).not.toBe(sets);
    const tampered = Buffer.from(zipSync(files));

    await page
      .getByTestId('restore-file')
      .setInputFiles({ name: 'tampered.zip', mimeType: 'application/zip', buffer: tampered });
    await expect(page.getByTestId('restore-error')).toHaveText(
      'This backup is damaged or was edited, so it cannot be restored. Nothing was changed.',
    );
    await expect(page.getByTestId('restore-preview')).toHaveCount(0);

    await page.getByTestId('restore-file').setInputFiles({
      name: 'notes.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from('not a zip'),
    });
    await expect(page.getByTestId('restore-error')).toHaveText(
      'This is not a POWR backup file. Nothing was changed.',
    );

    await page.goto('/session');
    await expect(page.getByTestId('session-sets').getByRole('listitem')).toHaveCount(1);
  });
});
