import { sharedDataMarker } from '../db/data-guard';

/**
 * "Delete all data" (DAT-13, §8.2.1): deletes the four databases (`powr`, `powr-safety`,
 * `powr-diag`, `powr-runtime`), clears `localStorage` and `sessionStorage`, removes the data
 * marker first (both copies, M6d) and closes the app's notifications. The Cache Storage keeps the app files only (no user data), so POWR still opens
 * offline afterwards. The Dexie-backed stores are deleted through their own instances, which
 * then stay closed (no auto-reopen that would create an empty database again).
 */
const APP_DATABASES = ['powr', 'powr-safety', 'powr-diag', 'powr-runtime'] as const;

/** Something that deletes its own database and stays closed afterwards. */
export interface Wipeable {
  wipe(): Promise<void>;
}

export interface WipeResult {
  /** Databases of the app still listed for the origin (empty on success). */
  readonly remaining: readonly string[];
}

/** How long a deletion may wait for another window to let go of a database. */
const BLOCKED_TIMEOUT_MS = 10_000;

export async function deleteAllData(targets: readonly Wipeable[]): Promise<WipeResult> {
  // First, so a wipe cut short never leaves "data existed" behind with the data gone (M6d).
  await sharedDataMarker().clear();
  await closeNotifications();
  await Promise.all([
    ...targets.map((target) => withTimeout(target.wipe())),
    withTimeout(deleteDatabase('powr-runtime')),
  ]);
  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      storage.clear();
    } catch {
      // Private mode or a disabled storage: nothing stored there.
    }
  }
  return { remaining: await remainingDatabases() };
}

/** App databases the origin still lists (`indexedDB.databases()`, Chromium 71+). */
export async function remainingDatabases(): Promise<string[]> {
  if (typeof indexedDB.databases !== 'function') return [];
  const listed = await indexedDB.databases();
  return listed
    .map((entry) => entry.name ?? '')
    .filter((name) => (APP_DATABASES as readonly string[]).includes(name));
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () =>
      reject(request.error ?? new Error(`Cannot delete ${name}`)),
    );
  });
}

function withTimeout(task: Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('A database is held open by another window')),
      BLOCKED_TIMEOUT_MS,
    );
    task.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function closeNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    for (const notification of (await registration?.getNotifications()) ?? []) {
      notification.close();
    }
  } catch {
    // No service worker or no notifications: nothing to close.
  }
}
