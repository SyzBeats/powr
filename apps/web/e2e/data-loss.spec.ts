import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, devices, type BrowserContext, type Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';
import { chromiumTree, reaped, sigkill } from './kill';
import { checkReflow, checkScreen } from './planning';
import { addExercise, logSet, startEmptyWorkout } from './session';

/**
 * M6d: POWR never starts fresh over lost data. Chromium deletes an origin's IndexedDB store when
 * it finds it damaged at open, and before M6d the app then created an empty database and greeted
 * the user with "Welcome to POWR" (the kill test's one unexplained failure looked exactly like
 * this). Now a marker in `localStorage`, which Chromium keeps apart from IndexedDB, remembers that
 * the database held data: at boot, and when Dexie reopens a connection the browser closed, POWR
 * refuses to create the database from scratch and shows "Your data could not be read".
 */

const MISSING = 'Your data could not be read';
const WELCOME = 'Welcome to POWR';

/** Workout data the way a user creates it: onboarding, a workout, one logged set. */
async function logOneSet(page: Page): Promise<void> {
  await skipOnboarding(page);
  await startEmptyWorkout(page);
  await addExercise(page, 'Barbell back squat');
  await logSet(page, { weight: 60, reps: 5 });
}

/** The screen after the loss: the recovery screen, never the first run (which baseline showed). */
async function expectRecovery(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name: new RegExp(`^(${MISSING}|${WELCOME})$`) }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(MISSING);
}

/** Runs `script` on a page of the origin where the app is not loaded (no open connection). */
async function outsideTheApp<T>(page: Page, script: () => Promise<T>): Promise<T> {
  await page.goto('/version.json');
  return page.evaluate(script);
}

const deletePowr = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('powr');
    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => reject(request.error));
  });

const listedDatabases = async () =>
  (await indexedDB.databases()).map((database) => database.name ?? '').toSorted();

/** The app's diagnostics log (`powr-diag`), codes and data only. */
async function diagnostics(page: Page): Promise<{ code: string; data: unknown }[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('powr-diag');
        open.addEventListener('error', () => reject(open.error));
        open.addEventListener('success', () => {
          const request = open.result.transaction('entries').objectStore('entries').getAll();
          request.addEventListener('success', () => {
            open.result.close();
            resolve(
              (request.result as { code: string; data: unknown }[]).map(({ code, data }) => ({
                code,
                data,
              })),
            );
          });
        });
      }),
  );
}

test.describe('never a first run over lost data (M6d)', () => {
  test('a database lost while POWR was closed: "Your data could not be read", not the first run', async ({
    page,
  }) => {
    await logOneSet(page);
    // The store disappears behind POWR's back, as when Chromium drops a damaged one.
    await outsideTheApp(page, deletePowr);

    await page.goto('/');
    await expectRecovery(page);
    // Nothing was created in its place; the marker stays until the user decides.
    expect(await page.evaluate(listedDatabases)).not.toContain('powr');
    expect(await page.evaluate(() => localStorage.getItem('powr.data'))).not.toBeNull();
    await checkScreen(page, 'recovery-missing');
    await checkReflow(page, 'recovery-missing');
    expect(await diagnostics(page)).toContainEqual({
      code: 'db.missing',
      data: { phase: 'boot', existing: false, dataLoss: 'none' },
    });

    // "Try again" checks again (a passing problem would clear); still missing here.
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 1, name: MISSING })).toBeVisible();

    // Starting again is the user's decision, confirmed; then the first run, with an empty database.
    await page.getByRole('button', { name: 'Start again without data…' }).click();
    await expect(page.getByRole('heading', { name: 'Start again without data?' })).toBeFocused();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Start again without data…' }).click();
    await page.getByRole('button', { name: 'Start again without data', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: WELCOME })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('powr.data'))).toBeNull();
  });

  test('an existing database emptied behind POWR’s back is not a first run either', async ({
    page,
  }) => {
    await logOneSet(page);
    await outsideTheApp(page, async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('powr');
        open.addEventListener('success', () => resolve(open.result));
        open.addEventListener('error', () => reject(open.error));
      });
      const tx = db.transaction([...db.objectStoreNames], 'readwrite');
      for (const name of db.objectStoreNames) tx.objectStore(name).clear();
      await new Promise((resolve) => tx.addEventListener('complete', resolve));
      db.close();
    });
    await page.goto('/session');
    await expectRecovery(page);
    expect(await diagnostics(page)).toContainEqual({
      code: 'db.missing',
      data: { phase: 'boot', existing: true, dataLoss: 'none' },
    });
  });

  test('a database lost while POWR runs: Dexie’s reopen is refused, the app shows the recovery screen', async ({
    page,
    context,
  }) => {
    await logOneSet(page);
    // Another page of the origin deletes the store; POWR's connection closes (versionchange), and
    // before M6d its next read reopened, and so created, an empty database.
    const other = await context.newPage();
    await outsideTheApp(other, deletePowr);
    await other.close();
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Home' })
      .click();
    await expectRecovery(page);
    expect(await page.evaluate(listedDatabases)).not.toContain('powr');
    expect(await diagnostics(page)).toContainEqual({
      code: 'db.missing',
      data: { phase: 'running', existing: false, dataLoss: 'none' },
    });
  });

  test('Chromium drops a damaged store: POWR says so instead of greeting a new user', async ({
    baseURL,
  }) => {
    test.skip(process.platform !== 'linux', 'edits the profile’s LevelDB files');
    // A real Chromium profile whose IndexedDB LevelDB is damaged on disk between two runs:
    // Chromium deletes the whole store at the next open (the first `upgradeneeded` says
    // `dataLoss: "total"`), while `localStorage` survives.
    const profile = mkdtempSync(join(tmpdir(), 'powr-e2e-dataloss-'));
    /** The open browser, closed before the profile is deleted (also when a check fails). */
    let open: BrowserContext | undefined;
    const launch = async () => {
      open = await chromium.launchPersistentContext(profile, {
        ...devices['Pixel 7'],
        viewport: { width: 360, height: 780 },
        baseURL: baseURL!,
        serviceWorkers: 'allow',
      });
      return open;
    };
    try {
      let context = await launch();
      let page = context.pages()[0] ?? (await context.newPage());
      await logOneSet(page);
      // Closing the browser normally writes the marker (localStorage) to disk.
      await context.close();

      const store = join(profile, 'Default', 'IndexedDB');
      const leveldb = join(
        store,
        readdirSync(store).find((name) => name.endsWith('.leveldb'))!,
      );
      for (const name of readdirSync(leveldb).filter((file) =>
        /^(MANIFEST-|\d+\.(log|ldb))/.test(file),
      )) {
        const bytes = readFileSync(join(leveldb, name));
        // Damage the middle of each file (a checksum error, not a cut-off tail LevelDB skips).
        for (let index = 16; index < Math.min(bytes.length - 8, 4_096); index++)
          bytes[index] = 0x5a;
        writeFileSync(join(leveldb, name), bytes);
      }

      context = await launch();
      page = context.pages()[0] ?? (await context.newPage());
      await page.goto('/session');
      await expectRecovery(page);
      expect(await diagnostics(page)).toContainEqual({
        code: 'db.missing',
        data: { phase: 'boot', existing: false, dataLoss: 'total' },
      });
    } finally {
      await open?.close().catch(() => undefined);
      rmSync(profile, { recursive: true, force: true });
    }
  });

  test('the kill test’s failure, made deterministic: an orphaned log record from an earlier kill', async ({
    baseURL,
  }) => {
    test.skip(process.platform !== 'linux', 'kills the Chromium process tree, edits LevelDB files');
    // M6d root cause. LevelDB appends a log record as two writes, a 7-byte header and then the
    // data; a SIGKILL between them leaves the header alone at the end of the log. The next start
    // recovers (a cut-off tail is normal after a crash) and, because Chromium reuses the log file,
    // appends behind that header. The start after that meets the header in the middle of the log,
    // reports corruption, and Chromium deletes the origin's whole IndexedDB store. Here the header
    // is put there by hand, and every browser is killed right after its writes, so the marker's
    // `localStorage` copy may never reach the disk (its file copy does).
    const profile = mkdtempSync(join(tmpdir(), 'powr-e2e-dataloss-'));
    /** The open browser, closed before the profile is deleted (also when a check fails). */
    let open: BrowserContext | undefined;
    const launch = async () => {
      const context = await chromium.launchPersistentContext(profile, {
        ...devices['Pixel 7'],
        viewport: { width: 360, height: 780 },
        baseURL: baseURL!,
        serviceWorkers: 'allow',
      });
      open = context;
      return { context, page: context.pages()[0] ?? (await context.newPage()) };
    };
    const killBrowser = async (context: BrowserContext) => {
      const tree = chromiumTree(profile);
      await sigkill(tree.all);
      await reaped(tree.browser);
      await context.close().catch(() => undefined);
    };
    try {
      let { context, page } = await launch();
      await logOneSet(page);
      await killBrowser(context);

      const store = join(profile, 'Default', 'IndexedDB');
      const leveldb = join(
        store,
        readdirSync(store).find((name) => name.endsWith('.leveldb'))!,
      );
      const log = join(
        leveldb,
        readdirSync(leveldb).find((name) => name.endsWith('.log'))!,
      );
      // Checksum (any), length 227, type FULL: a header whose 227 bytes were never written.
      writeFileSync(log, Buffer.from([0xfd, 0x7c, 0xf2, 0xbb, 227, 0, 1]), { flag: 'a' });

      // The next start recovers and appends behind the header.
      ({ context, page } = await launch());
      await page.goto('/session');
      await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
      await logSet(page, { weight: 61, reps: 5 });
      await killBrowser(context);

      // The start after that: Chromium has dropped the store. Never the first run.
      ({ context, page } = await launch());
      await page.goto('/session');
      await expectRecovery(page);
      expect(await diagnostics(page)).toContainEqual({
        code: 'db.missing',
        data: { phase: 'boot', existing: false, dataLoss: 'total' },
      });
    } finally {
      await open?.close().catch(() => undefined);
      rmSync(profile, { recursive: true, force: true });
    }
  });
});
