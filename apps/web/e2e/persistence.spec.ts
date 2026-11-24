import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, devices, type Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';

async function logOneSet(page: Page, reps: number) {
  await page.goto('/session');
  // A fresh profile starts at the first-run guard (M2b).
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/^(Log a set|Welcome to POWR)$/);
  if ((await heading.textContent()) === 'Welcome to POWR') await skipOnboarding(page);
  const repsInput = page.getByLabel('Reps', { exact: true });
  await repsInput.fill(String(reps));
  await page.getByRole('button', { name: 'Confirm set' }).click();
  // The confirmation is rendered only after the strict-durability commit resolved.
  await expect(page.getByTestId('log-status')).toContainText(`× ${reps}`);
}

test.describe('persistence (WP0.5, QS-01 basic)', () => {
  test('a confirmed set survives a reload', async ({ page }) => {
    await logOneSet(page, 7);
    await page.reload();
    await expect(page.getByTestId('session-sets')).toContainText('Barbell back squat');
    await expect(page.getByTestId('session-sets')).toContainText('× 7');
  });

  test('a confirmed set survives closing the browser right after the write', async ({
    baseURL,
  }) => {
    const profile = mkdtempSync(join(tmpdir(), 'powr-e2e-profile-'));
    const launch = () =>
      chromium.launchPersistentContext(profile, {
        ...devices['Pixel 7'],
        baseURL: baseURL!,
        serviceWorkers: 'allow',
      });
    try {
      const first = await launch();
      const page = first.pages()[0] ?? (await first.newPage());
      await logOneSet(page, 9);
      // No graceful shutdown of the app: the browser goes away immediately after the confirmation.
      await first.close();

      const second = await launch();
      const reopened = second.pages()[0] ?? (await second.newPage());
      await reopened.goto('/session');
      await expect(reopened.getByTestId('session-sets')).toContainText('× 9');
      await expect(reopened.getByTestId('session-sets').getByRole('listitem')).toHaveCount(1);
      await second.close();
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  });

  test('requests persistent storage after an explanation and records the outcome (DAT-03)', async ({
    page,
  }) => {
    await page.goto('/data');
    const protectedStatus = page.getByTestId('storage-protected');
    await expect(protectedStatus).toBeVisible();
    const button = page.getByRole('button', { name: 'Protect my data' });
    const wasUnprotected = await button.isVisible();
    if (wasUnprotected) await button.click();
    await expect(protectedStatus).toHaveText(/Storage protected: (Yes|No)/);

    const recorded = await page.evaluate(
      () =>
        new Promise<unknown>((resolve, reject) => {
          const request = indexedDB.open('powr');
          request.addEventListener('error', () => reject(request.error));
          request.addEventListener('success', () => {
            const get = request.result.transaction('meta').objectStore('meta').get('persistence');
            get.addEventListener('success', () => resolve(get.result));
          });
        }),
    );
    // The outcome is recorded with a timestamp whenever the user asked (DAT-03).
    if (wasUnprotected) {
      expect(recorded).toMatchObject({
        key: 'persistence',
        value: { granted: expect.any(Boolean), at: expect.any(String), trigger: 'user' },
      });
    }
  });

  test('the set is written with strict durability on the real browser (Chromium IndexedDB)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // oxlint-disable-next-line typescript/unbound-method -- re-applied with the right `this` below
      const original = IDBDatabase.prototype.transaction;
      const seen: string[] = [];
      (window as { powrDurability?: string[] }).powrDurability = seen;
      IDBDatabase.prototype.transaction = function (
        this: IDBDatabase,
        ...args: Parameters<IDBDatabase['transaction']>
      ) {
        const [stores, mode, options] = args;
        if (mode === 'readwrite' && this.name === 'powr')
          seen.push(`${JSON.stringify(stores)}:${options?.durability ?? 'default'}`);
        return original.apply(this, args);
      } as IDBDatabase['transaction'];
    });
    await logOneSet(page, 3);
    const durability = await page.evaluate(
      () => (window as { powrDurability?: string[] }).powrDurability,
    );
    expect(durability?.length).toBeGreaterThan(0);
    expect(durability?.every((entry) => entry.endsWith(':strict'))).toBe(true);
  });
});
