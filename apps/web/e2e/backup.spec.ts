import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { expect, skipOnboarding, test, waitForOfflineReady } from './fixtures';
import { addExercise, logSet, startEmptyWorkout } from './session';

/** Requests of this page for the lazy backup chunk (`@powr/application/backup`, §8.19). */
async function backupChunkLoads(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /\/assets\/backup-[\w-]+\.js$/.test(name)),
  );
}

test.describe('backup (WP0.6, DAT-05/06)', () => {
  test('exports a ZIP download and restores it into an empty app', async ({
    page,
    browser,
    baseURL,
  }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    await logSet(page, { weight: 100, reps: 4 });

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

    // The restored workout is still running, with both sets (WKT-14 recovery after a restore).
    await restorePage.goto('/session');
    await expect(restorePage.getByTestId('logged-set')).toHaveCount(2);
    await fresh.close();
  });

  test('rejects an edited backup and changes nothing (QS-17)', async ({ page }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
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
    await expect(page.getByTestId('logged-set')).toHaveCount(1);
  });

  test('the first export and restore work offline: the lazy backup chunk is precached', async ({
    page,
    context,
    server,
  }) => {
    // Install first: an active session defers the service-worker install (§6.3).
    await skipOnboarding(page);
    await page.goto('/');
    await waitForOfflineReady(page);

    // Airplane mode and a dead server: the backup chunk can only come from the precache.
    await context.setOffline(true);
    await server?.close();
    await page.goto('/session');
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    await page.goto('/data');
    await expect(page.getByRole('heading', { level: 1, name: 'Data and backups' })).toBeVisible();
    expect(await backupChunkLoads(page), 'not part of the startup bundle').toEqual([]);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export backup' }).click(),
    ]);
    await expect(page.getByTestId('export-status')).toContainText(download.suggestedFilename());
    expect(await backupChunkLoads(page), 'loaded on first use').toHaveLength(1);

    await page.getByTestId('restore-file').setInputFiles(await download.path());
    await page.getByTestId('restore-confirm').fill('REPLACE');
    await page.getByRole('button', { name: 'Replace all data' }).click();
    await expect(page.getByTestId('restore-status')).toHaveText('Restored. 1 sets imported.');
  });
});
