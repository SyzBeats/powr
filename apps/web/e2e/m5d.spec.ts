import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

import { expect, skipOnboarding, test, waitForOfflineReady } from './fixtures';
import { checkReflow, checkScreen, onboardToPreview, skipOptionalSteps } from './planning';
import { addExercise, finishWorkout, logSet, startEmptyWorkout } from './session';

/**
 * M5d data, calendar and PWA polish: delete all data back to the first run (DAT-13), the
 * recovery screen after a failing data update (DAT-14), the `.ics` download (CAL-01…05), the
 * back gesture closing a sheet before the screen (PWA-12), the install promotion never during a
 * workout (PWA-02) and the device-support screen (PWA-13). axe in both themes and reflow at
 * 320 px and 200% text on every new screen.
 */

/** A Monday morning: with Monday as a training day, today's planned session exists. */
const MONDAY = new Date('2026-11-23T08:00:00');

/**
 * The UID host of the build under test, as `src/app/public-origin.ts` derives it: CI builds with
 * `VITE_PUBLIC_ORIGIN` from the repository variable `PUBLIC_ORIGIN` (M5z) and passes the same
 * value to this job; unset or not an http(s) origin, the reserved `powr.invalid`.
 */
const UID_HOST = ((configured: string | undefined): string => {
  try {
    const url = new URL(configured ?? '');
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.host : 'powr.invalid';
  } catch {
    return 'powr.invalid';
  }
})(process.env['VITE_PUBLIC_ORIGIN']);

/** Names of the app's IndexedDB databases on this origin. */
async function databases(page: Page): Promise<string[]> {
  return page.evaluate(async () =>
    (await indexedDB.databases()).map((entry) => entry.name ?? '').toSorted(),
  );
}

/** Chrome's install prompt, as the browser would fire it (it cannot be triggered in a test). */
async function offerInstall(page: Page): Promise<void> {
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    dispatchEvent(event);
  });
}

test.describe('Data and backups (M5d: DAT-03…08, DAT-13)', () => {
  test('delete all data: export first, typed confirmation, every database gone, then the first run', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    await page.goto('/');
    await waitForOfflineReady(page);

    await page.goto('/data');
    await expect(page.getByRole('heading', { level: 1, name: 'Data and backups' })).toBeVisible();
    await expect(page.getByTestId('storage-protected')).toHaveText(/Storage protected: (Yes|No)/);
    await expect(page.getByTestId('storage-usage')).toContainText(
      /Using .* of the .*|not reported/,
    );
    await expect(page.getByTestId('safety-copies-empty')).toBeVisible();
    await checkScreen(page, 'data');
    await checkReflow(page, 'data');

    await page.getByRole('button', { name: 'Delete all data…' }).click();
    const sheet = page.getByRole('dialog', { name: 'Delete all data?' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Your workout in progress is deleted too.');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      sheet.getByRole('button', { name: 'Export a backup first' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^powr-backup-.*\.zip$/);
    await expect(sheet.getByTestId('delete-export-status')).toContainText('Saved to Downloads');
    await checkScreen(page, 'data-delete-all');

    const confirm = sheet.getByRole('button', { name: 'Delete everything' });
    await expect(confirm).toBeDisabled();
    await sheet.getByTestId('delete-confirm').fill('DELETE');
    await confirm.click();

    await expect(page.getByRole('heading', { level: 1, name: 'All data deleted' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'All data deleted' })).toBeFocused();
    // §8.2.1: nothing of the app is left in IndexedDB or the local storage.
    expect(await databases(page)).toEqual([]);
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    await checkScreen(page, 'data-deleted');

    await page.getByRole('button', { name: 'Start again' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to POWR' })).toBeVisible();
  });

  test('backup reminder after a finished workout: cadence in Data, "Remind me later" on Home', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    await finishWorkout(page);
    // DAT-08: never backed up, with training data: due on the summary and on Home.
    await expect(page.getByRole('heading', { name: 'Back up your training' })).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Back up your training' })).toBeVisible();
    await checkScreen(page, 'home-backup-reminder');
    await page.getByRole('button', { name: 'Remind me later' }).click();
    await expect(page.getByTestId('backup-reminder-snoozed')).toBeFocused();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Back up your training' })).toHaveCount(0);

    await page.goto('/data');
    const reminders = page.getByRole('radiogroup', { name: 'Backup reminders' });
    await expect(reminders.getByRole('radio', { name: /^Automatic/ })).toBeChecked();
    await reminders.getByRole('radio', { name: 'Every 30 days' }).click();
    await expect(reminders.getByRole('radio', { name: 'Every 30 days' })).toBeChecked();
    await page.reload();
    await expect(
      page.getByRole('radiogroup', { name: 'Backup reminders' }).getByRole('radio', {
        name: 'Every 30 days',
      }),
    ).toBeChecked();
  });
});

const FIXTURE = fileURLToPath(
  new URL('../../../packages/formats/fixtures/backups/v1/active-session.zip', import.meta.url),
);

/** The raw v1 records of the committed fixture (an M1-era database). */
function v1Records(): Record<string, unknown[]> {
  const files = unzipSync(readFileSync(FIXTURE));
  const tables: Record<string, unknown[]> = {};
  for (const [path, bytes] of Object.entries(files)) {
    if (path.startsWith('data/'))
      tables[path.slice(5, -5)] = JSON.parse(strFromU8(bytes)) as unknown[];
  }
  return tables;
}

/** Creates `powr` at dataVersion 1 (IndexedDB version 10) with the v1 stores, as M0/M1 did. */
async function seedV1Database(page: Page, tables: Record<string, unknown[]>): Promise<void> {
  await page.evaluate(
    (records) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('powr', 10);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore('meta', { keyPath: 'key' });
          db.createObjectStore('settings', { keyPath: 'id' });
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('localDate', 'localDate');
          sessions.createIndex('status', 'status');
          sessions.createIndex('startedAt.epochMs', 'startedAt.epochMs');
          const sets = db.createObjectStore('sets', { keyPath: 'id' });
          sets.createIndex('sessionId', 'sessionId');
          sets.createIndex('[exerciseId+performedAt.epochMs]', [
            'exerciseId',
            'performedAt.epochMs',
          ]);
          sets.createIndex('localDate', 'localDate');
          for (const [table, rows] of Object.entries(records)) {
            const store = request.transaction!.objectStore(table);
            for (const row of rows) store.put(row);
          }
        };
        request.addEventListener('success', () => {
          request.result.close();
          resolve();
        });
        request.addEventListener('error', () => reject(request.error));
      }),
    tables,
  );
}

test.describe('data update guard (M5d: DAT-14)', () => {
  test('a failing data update shows the recovery screen, loses nothing and succeeds once fixed', async ({
    page,
    context,
  }) => {
    const records = v1Records();
    await page.goto('/version.json');
    await seedV1Database(page, records);

    // Simulated migration bug: the 1 → 2 step fails on the session records.
    await page.addInitScript(() => {
      // oxlint-disable-next-line typescript/unbound-method -- called below with the store as this
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
        if (this.transaction.mode === 'versionchange' && this.name === 'sessions') {
          throw new DOMException('Simulated migration bug', 'DataError');
        }
        return put.apply(this, args);
      };
      // oxlint-disable-next-line typescript/unbound-method -- called below with the cursor as this
      const update = IDBCursor.prototype.update;
      IDBCursor.prototype.update = function (value: unknown) {
        const source = this.source as IDBObjectStore;
        if (source.transaction?.mode === 'versionchange' && source.name === 'sessions') {
          throw new DOMException('Simulated migration bug', 'DataError');
        }
        return update.call(this, value);
      };
    });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'POWR could not update your data' }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('The update was undone')).toBeVisible();
    await checkScreen(page, 'recovery-upgrade');
    await checkReflow(page, 'recovery-upgrade');

    // Still dataVersion 1 (IndexedDB 10): the failed update was rolled back.
    expect(
      await page.evaluate(
        async () => (await indexedDB.databases()).find((entry) => entry.name === 'powr')?.version,
      ),
    ).toBe(10);

    const [copy] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Save a copy of your data' }).click(),
    ]);
    expect(copy.suggestedFilename()).toMatch(/^powr-backup-.*\.zip$/);
    const files = unzipSync(readFileSync(await copy.path()));
    const manifest = JSON.parse(strFromU8(files['manifest.json']!)) as {
      dataVersion: number;
      counts: Record<string, number>;
    };
    expect(manifest.dataVersion).toBe(1);
    expect(manifest.counts['sessions']).toBe(records['sessions']!.length);
    expect(manifest.counts['sets']).toBe(records['sets']!.length);
    await expect(page.getByTestId('recovery-copy-status')).toContainText('Saved to Downloads');

    const [diagnostics] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export diagnostics' }).click(),
    ]);
    expect(diagnostics.suggestedFilename()).toMatch(/^powr-diagnostics-.*\.txt$/);
    const report = readFileSync(await diagnostics.path(), 'utf8');
    expect(report).toContain('db.upgrade');
    expect(report).toContain('db.recovery');

    // A fixed version (no simulated bug in a new page) updates the same data.
    const fixed = await context.newPage();
    await fixed.goto('/');
    // The v1 data has no profile yet, so the updated app continues with the first run.
    await expect(fixed.getByRole('heading', { level: 1, name: 'Welcome to POWR' })).toBeVisible({
      timeout: 20_000,
    });
    const after = await fixed.evaluate(
      () =>
        new Promise<{ version: number; sessions: number; sets: number }>((resolve, reject) => {
          const request = indexedDB.open('powr');
          request.addEventListener('success', () => {
            const db = request.result;
            const tx = db.transaction(['sessions', 'sets']);
            const sessions = tx.objectStore('sessions').count();
            const sets = tx.objectStore('sets').count();
            tx.addEventListener('complete', () => {
              resolve({ version: db.version, sessions: sessions.result, sets: sets.result });
              db.close();
            });
          });
          request.addEventListener('error', () => reject(request.error));
        }),
    );
    expect(after).toEqual({
      version: 20,
      sessions: records['sessions']!.length,
      sets: records['sets']!.length,
    });
    // The safety copy taken before the first attempt is listed in Data and backups.
    await fixed.goto('/data');
    await expect(fixed.getByTestId('safety-copy').first()).toContainText('Before a data update');
    await checkScreen(fixed, 'data-safety-copies');
  });
});

test.describe('calendar export (M5d: CAL-01…05)', () => {
  test('downloads an RFC 5545 file of the planned sessions with stable UIDs and reminders', async ({
    page,
  }) => {
    await page.clock.install({ time: MONDAY });
    await onboardToPreview(page, { days: ['Monday', 'Wednesday', 'Friday'] });
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    await page.goto('/plan');
    await page.getByRole('link', { name: 'Add to calendar' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Add your plan to your calendar' }),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Next 2 weeks' }).click();
    await page.getByRole('radio', { name: 'The same time for every workout' }).click();
    await page.getByTestId('calendar-time').fill('18:30');
    await page.getByRole('radio', { name: '30 minutes before' }).click();
    const preview = page.getByTestId('calendar-preview');
    await expect(preview).toContainText(/\d+ workouts/);
    const sessions = Number((await preview.textContent())!.match(/(\d+) workouts/)![1]);
    await checkScreen(page, 'calendar-export');
    await checkReflow(page, 'calendar-export');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download the calendar file' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('powr-plan-2026-11-23.ics');
    await expect(page.getByTestId('calendar-status')).toContainText(
      'Saved to Downloads as powr-plan-2026-11-23.ics',
    );
    await expect(
      page.getByRole('heading', { name: 'How to add the file to your calendar' }),
    ).toBeFocused();

    const text = readFileSync(await download.path(), 'utf8');
    // RFC 5545: CRLF line endings, lines of at most 75 octets, one VEVENT per session.
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
    for (const line of text.split('\r\n'))
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    const unfolded = text.replaceAll('\r\n ', '');
    expect(unfolded.match(/^BEGIN:VEVENT$/gm)).toHaveLength(sessions);
    const uids = unfolded.match(/^UID:.*$/gm)!;
    expect(uids).toHaveLength(sessions);
    for (const uid of uids) {
      expect(uid).toMatch(/^UID:[^@\s]+@[^@\s]+$/);
      expect(uid.slice(uid.indexOf('@') + 1)).toBe(UID_HOST);
    }
    expect(unfolded.match(/^TRIGGER:-PT30M$/gm)).toHaveLength(sessions);
    // 18:30 in Zurich in winter is 17:30 UTC.
    for (const start of unfolded.match(/^DTSTART:.*$/gm)!) expect(start).toMatch(/T173000Z$/);
    expect(unfolded).toMatch(/^SUMMARY:POWR · .+ \(Week 1\)$/m);

    // A second export of the same choices gives the same UIDs (no duplicates on re-import).
    const [again] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download the calendar file' }).click(),
    ]);
    const second = readFileSync(await again.path(), 'utf8').replaceAll('\r\n ', '');
    expect(second.match(/^UID:.*$/gm)).toEqual(uids);
  });
});

test.describe('PWA polish (M5d: PWA-02, PWA-05, PWA-12, PWA-13)', () => {
  test('Back closes a sheet before it leaves the screen, and never loses the workout', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await page.goto('/data');
    await page.getByRole('button', { name: 'Delete all data…' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete all data?' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Data and backups' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/data');

    // Closed with its own button, the sheet leaves no extra history entry behind.
    await page.getByRole('button', { name: 'Delete all data…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // During a workout: Back closes the sheet, then leaves the screen; the workout stays.
    await page.goto('/');
    await page.getByRole('link', { name: 'Train' }).click();
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await expect(page.getByRole('dialog', { name: 'Add exercise' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workout in progress' })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
    await expect(page.getByTestId('logged-set')).toHaveCount(1);
  });

  test('an app shortcut opens its screen with Home beneath it (PWA-05, PWA-12)', async ({
    page,
    context,
  }) => {
    await skipOnboarding(page);
    const manifest = (await (await page.request.get('/manifest.webmanifest')).json()) as {
      shortcuts: { name: string; url: string }[];
    };
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual([
      '/session?start=today&source=shortcut',
      '/body/log?source=shortcut',
    ]);

    // A launch from the home-screen icon: a new window whose first and only page is the shortcut.
    const [launched] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate(() => void open('/body/log?source=shortcut')),
    ]);
    await expect(launched.getByRole('heading', { level: 1, name: 'Log bodyweight' })).toBeVisible();
    await launched.goBack();
    await expect(launched.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    // Back from Home leaves the app's history (the launcher), it does not loop.
    expect(await launched.evaluate(() => history.length)).toBe(2);
  });

  test('the install promotion waits for a later visit and never shows during a workout (PWA-02)', async ({
    page,
  }) => {
    // First visit on this browser (the page load of the onboarding): no promotion yet.
    await skipOnboarding(page);
    await offerInstall(page);
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Home' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    await expect(page.getByTestId('install-promotion')).toHaveCount(0);

    // A later visit with a workout running: still none, on Home or in the workout.
    await page.getByRole('link', { name: 'Train' }).click();
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    await page.reload();
    await offerInstall(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
    await expect(page.getByTestId('install-promotion')).toHaveCount(0);
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Home' })
      .click();
    await expect(page.getByRole('heading', { name: 'Workout in progress' })).toBeVisible();
    await expect(page.getByTestId('install-promotion')).toHaveCount(0);

    // After the workout, the summary offers it once; "Not now" keeps it away.
    await page.getByRole('link', { name: 'Train' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
    await finishWorkout(page);
    await expect(page.getByTestId('install-promotion')).toBeVisible();
    await checkScreen(page, 'install-promotion');
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByTestId('install-closed')).toBeFocused();
    await page.goto('/');
    await offerInstall(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    await expect(page.getByTestId('install-promotion')).toHaveCount(0);
  });

  test('the device-support screen says what works here, honestly (PWA-13)', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await waitForOfflineReady(page);
    await page.goto('/data');
    await page.getByRole('link', { name: 'What works on this phone' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Device support' })).toBeVisible();
    const rows = page.getByTestId('device-capability');
    await expect(rows).toHaveCount(11);
    const offline = rows.filter({ has: page.getByRole('heading', { name: 'Works offline' }) });
    await expect(offline).toContainText('Works here');
    const shortcuts = rows.filter({ has: page.getByRole('heading', { name: 'App shortcuts' }) });
    await expect(shortcuts).toContainText('Cannot be checked from the app');
    const locked = rows.filter({
      has: page.getByRole('heading', { name: 'Alerts while the screen is locked' }),
    });
    await expect(locked).toContainText(/Limited|Supported|Not supported/);
    await expect(page.getByTestId('device-browser')).toContainText(/in the browser|installed app/);
    await expect(
      page.getByText('docs/device-tests/S-2-protocol.md', { exact: false }),
    ).toBeVisible();

    await offerInstall(page);
    const install = rows.filter({
      has: page.getByRole('heading', { name: 'Install on the home screen' }),
    });
    await expect(install).toContainText('Can be installed');
    await expect(install.getByRole('button', { name: 'Install' })).toBeVisible();
    await checkScreen(page, 'device-support');
    await checkReflow(page, 'device-support');
  });
});
