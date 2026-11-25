import { readFileSync } from 'node:fs';

import type { Download, Page } from '@playwright/test';

import { expect, setVisibility, skipOnboarding, test, waitForOfflineReady } from './fixtures';
import { checkReflow, checkScreen } from './planning';

/**
 * M3t timers and alerts (technical concept §8.8; TMR-04…06, PWA-06…08, SET-03/04/10, QS-03).
 * Driven through the S-1 harness, which runs the production scheduler and timer engine; the
 * session screen that wires them comes with M3b.
 */

// Full Chromium in new headless mode (`playwright install chromium` ships it with the headless
// shell): the default headless shell reports notification permission "denied" even after it was
// granted, so no notification path could be tested there.
test.use({ channel: 'chromium' });

/** The `rest` notifications currently shown for the origin (tag `rest`, §8.8.4). */
function restNotifications(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const shown = await registration.getNotifications({ tag: 'rest' });
    return shown.map((notification) => ({ title: notification.title, body: notification.body }));
  });
}

/** Diagnostic codes in `powr-diag` (§8.17). */
function diagnosticCodes(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const request = indexedDB.open('powr-diag');
        request.addEventListener('success', () => {
          const db = request.result;
          const all = db.transaction('entries').objectStore('entries').getAll();
          all.addEventListener('success', () => {
            resolve((all.result as { code: string }[]).map((entry) => entry.code));
            db.close();
          });
        });
      }),
  );
}

async function exportedRuns(page: Page) {
  const [download]: [Download, void] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export results' }).click(),
  ]);
  const payload = JSON.parse(readFileSync(await download.path(), 'utf8')) as {
    runs: { events: { event: string; path?: string }[]; outcome: string }[];
  };
  return payload.runs;
}

async function startRun(page: Page, seconds: number) {
  await page.getByTestId('custom-rest').fill(String(seconds));
  await page.getByRole('button', { name: 'Start run' }).click();
  await expect(page.getByTestId('run-countdown')).toBeVisible();
}

test.describe('timer display (§8.8.1, TMR-04)', () => {
  test('QS-03: a 2:30 rest hidden for 60 s shows 1:30 ± 1 s within 500 ms of returning', async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto('/debug/alerts');
    await startRun(page, 150);
    await expect(page.getByTestId('run-countdown')).toHaveText(/^2:(29|30)$/);

    await setVisibility(page, 'hidden');
    await page.clock.fastForward(60_000);
    await setVisibility(page, 'visible');
    await expect(page.getByTestId('run-countdown')).toHaveText(/^1:(29|30|31)$/, { timeout: 500 });
  });

  test('a device clock change while visible does not move the timer; it is logged', async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto('/debug/alerts');
    await startRun(page, 150);
    await expect(page.getByTestId('run-countdown')).toHaveText(/^2:(29|30)$/);

    // Only Date jumps an hour ahead; performance.now() keeps going (NFR-REL-05).
    const now = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(now + 3_600_000);
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('run-countdown')).toHaveText(/^2:2[6-8]$/);
    await expect.poll(() => diagnosticCodes(page)).toContain('timer.clockJump');
  });
});

test.describe('alerts while hidden (§8.8.4, TMR-06, PWA-08)', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await context.grantPermissions(['notifications'], { origin: baseURL! });
    await skipOnboarding(page);
    await page.goto('/');
    await waitForOfflineReady(page);
    await page.goto('/debug/alerts');
  });

  test('variant B: the service-worker timer fires while the page is hidden', async ({ page }) => {
    await page.getByLabel('B: service-worker timer only').check();
    await startRun(page, 2);
    await setVisibility(page, 'hidden');
    // The rest ends while "hidden"; only the service worker can alert now.
    await expect
      .poll(() => restNotifications(page), { timeout: 6000 })
      .toEqual([{ title: 'Rest over', body: 'Test rest (B) finished' }]);
    await setVisibility(page, 'visible');

    const firstRow = page.getByTestId('run-results').getByRole('row').first();
    await expect(firstRow).toContainText('sw-timer');
    await expect(firstRow).toContainText('on-time');
    await expect.poll(() => restNotifications(page)).toEqual([]);
  });

  test('variant D: "Resting" on hide, exactly one "Rest over" at the end, closed on return', async ({
    page,
  }) => {
    await page.getByLabel('D: C + "resting until" notification').check();
    await startRun(page, 6);
    await setVisibility(page, 'hidden');
    await expect
      .poll(() => restNotifications(page))
      .toEqual([
        { title: 'Resting', body: expect.stringMatching(/^Ends at /) as unknown as string },
      ]);
    // Page timeout and service-worker timer are both armed; the shared tag and the fired flag
    // leave exactly one "Rest over".
    await expect
      .poll(() => restNotifications(page), { timeout: 10_000 })
      .toEqual([expect.objectContaining({ title: 'Rest over' })]);
    await page.waitForTimeout(1000);
    expect(await restNotifications(page)).toHaveLength(1);

    await setVisibility(page, 'visible');
    await expect.poll(() => restNotifications(page)).toEqual([]);
    const firstRow = page.getByTestId('run-results').getByRole('row').first();
    await expect(firstRow).toContainText('on-time');
    const [run] = await exportedRuns(page);
    expect(run?.events.filter((event) => event.event === 'fired')).toHaveLength(1);
    expect(run?.events.map((event) => event.event)).toEqual(
      expect.arrayContaining(['start', 'hidden', 'fired', 'visible', 'end']),
    );
  });
});

test.describe('Settings → Alerts (SET-03, SET-04, SET-10, TMR-06)', () => {
  test('asks for notification permission only after the explanation, never on load', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const counter = globalThis as { permissionRequests?: number };
      counter.permissionRequests = 0;
      // Counts requests; answers "granted" like a user who taps Allow in the prompt.
      Notification.requestPermission = async () => {
        counter.permissionRequests = (counter.permissionRequests ?? 0) + 1;
        return 'granted';
      };
      Object.defineProperty(Notification, 'permission', {
        configurable: true,
        get: () => 'default',
      });
    });
    await skipOnboarding(page);
    for (const path of ['/', '/session', '/plan', '/settings']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    const requests = () =>
      page.evaluate(() => (globalThis as { permissionRequests?: number }).permissionRequests);
    expect(await requests()).toBe(0);

    await expect(page.getByTestId('notification-permission')).toHaveText(
      'Notifications: Not allowed yet',
    );
    await expect(page.getByText('POWR uses notifications only for rest timers')).toBeVisible();
    await expect(page.getByTestId('locked-status')).toContainText('Limited');
    await page.getByRole('button', { name: 'Allow notifications' }).click();
    await expect(page.getByTestId('notification-permission')).toHaveText('Notifications: Allowed');
    await expect(page.getByTestId('locked-status')).toContainText('Limited (best effort)');
    expect(await requests()).toBe(1);
  });

  test('passes axe in both themes and reflows at 320 px and 200% text; the test alert works', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible();
    await page.getByRole('button', { name: 'Test alert' }).click();
    await expect(page.getByTestId('test-alert-result')).toContainText('Rest over');
    await expect(page.getByTestId('live-announcer')).toHaveText('Test alert: rest over');
    // From the top: axe counts a control the sticky bottom navigation half covers at the current
    // scroll position as too small (target-size), which says nothing about the control itself.
    await page.evaluate(() => window.scrollTo(0, 0));
    await checkScreen(page, 'settings-alerts');
    await checkReflow(page, 'settings-alerts');
  });

  test('the rebuilt S-1 harness passes axe in both themes, idle and during a run', async ({
    page,
  }) => {
    await page.goto('/debug/alerts');
    await checkScreen(page, 'alert-harness');
    await startRun(page, 60);
    await checkScreen(page, 'alert-harness-running');
    await page.getByRole('button', { name: 'Stop run' }).click();
    await expect(page.getByTestId('run-results').getByRole('row').first()).toContainText('stopped');
  });
});
