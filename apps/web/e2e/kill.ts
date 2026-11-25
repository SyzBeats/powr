import { readdirSync, readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';

/*
 * Helpers of the randomised process-kill test (`kill.spec.ts`; NFR-REL-01, QS-01, TD-13): a
 * seeded random source, the Chromium process tree of a persistent profile (Linux `/proc`), the
 * SIGKILL itself and a direct read of the stored workout from IndexedDB.
 */

/** mulberry32: a small seeded PRNG, so a failing run is repeated with its printed seed. */
export function random(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  /** An integer in [min, max]. */
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  /** One of the entries, by weight. */
  const pick = <T extends string>(weights: Readonly<Record<T, number>>): T => {
    const entries = Object.entries(weights) as [T, number][];
    let roll = next() * entries.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return entries.at(-1)![0];
  };
  return { next, int, pick };
}

interface ProcessInfo {
  readonly pid: number;
  readonly ppid: number;
  /** `Z` for a zombie (dead, not yet reaped). */
  readonly state: string;
  readonly args: readonly string[];
}

function readProcess(pid: number): ProcessInfo | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    // "pid (comm) state ppid …": comm may contain spaces and parentheses, so split after the last ")".
    const [state = '', ppid = '0'] = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    // Chromium rewrites its process title: the arguments are then one string joined by spaces.
    const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split(/[\0 ]/).filter(Boolean);
    return { pid, ppid: Number(ppid), state, args };
  } catch {
    return null;
  }
}

function processes(): ProcessInfo[] {
  return readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .map((name) => readProcess(Number(name)))
    .filter((info): info is ProcessInfo => info !== null);
}

/**
 * The Chromium processes of the profile: the browser process (started with this
 * `--user-data-dir` and no `--type`) and every process below it (zygotes, renderers, GPU, the
 * network and storage services). Throws if the browser process is not running.
 */
export function chromiumTree(profileDir: string): {
  readonly browser: number;
  readonly renderers: readonly number[];
  readonly all: readonly number[];
} {
  const all = processes();
  const browser = all.find(
    (info) =>
      info.state !== 'Z' &&
      info.args.includes(`--user-data-dir=${profileDir}`) &&
      !info.args.some((arg) => arg.startsWith('--type=')),
  );
  if (!browser) throw new Error(`No Chromium browser process for ${profileDir}`);
  const children = new Map<number, ProcessInfo[]>();
  for (const info of all) children.set(info.ppid, [...(children.get(info.ppid) ?? []), info]);
  const tree: ProcessInfo[] = [];
  const queue = [browser];
  while (queue.length > 0) {
    const next = queue.shift()!;
    tree.push(next);
    queue.push(...(children.get(next.pid) ?? []));
  }
  return {
    browser: browser.pid,
    renderers: tree
      .filter((info) => info.state !== 'Z' && info.args.includes('--type=renderer'))
      .map((info) => info.pid),
    all: tree.map((info) => info.pid),
  };
}

/**
 * SIGKILL: the process ends at once, with no unload event, no IndexedDB shutdown and no flush;
 * what Android does to an app it reclaims. Returns when every process is gone (a zombie is gone).
 */
export async function sigkill(pids: readonly number[]): Promise<void> {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone (a child that died with its parent).
    }
  }
  const deadline = Date.now() + 10_000;
  for (;;) {
    const alive = pids.filter((pid) => {
      const info = readProcess(pid);
      return info !== null && info.state !== 'Z';
    });
    if (alive.length === 0) return;
    if (Date.now() > deadline) throw new Error(`Still alive after SIGKILL: ${alive.join(', ')}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Live processes that still name the profile (for example one started between the snapshot of the
 * tree and the kill): none may survive a whole-browser kill, or the new browser could find the
 * profile's storage still locked.
 */
export function profileLeftovers(profileDir: string): number[] {
  return processes()
    .filter((info) => info.state !== 'Z' && info.args.some((arg) => arg.includes(profileDir)))
    .map((info) => info.pid);
}

/** Waits until the process entry is reaped, so a new Chromium can take the profile's lock. */
export async function reaped(pid: number): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (readProcess(pid) !== null) {
    if (Date.now() > deadline) throw new Error(`Process ${pid} was not reaped`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** A stored set as the test compares it. */
export interface StoredSet {
  readonly id: string;
  readonly exerciseId: string;
  readonly index: number;
  readonly state: string;
  readonly load: { readonly value: number; readonly unit: string } | null;
  readonly reps: number | null;
  readonly performedAt: unknown;
  readonly localDate: unknown;
}

/** The active workout and its sets, read straight from the `powr` database. */
export interface StoredWorkout {
  readonly sessionId: string | null;
  readonly revision: number | null;
  /** The undo entry's set IDs: written in the same transaction as the event's sets. */
  readonly undoRemoves: readonly string[];
  readonly undoRestores: readonly string[];
  readonly sets: readonly StoredSet[];
}

export function readStoredWorkout(page: Page): Promise<StoredWorkout> {
  return page.evaluate(
    () =>
      new Promise<StoredWorkout>((resolve, reject) => {
        const open = indexedDB.open('powr');
        open.addEventListener('error', () => reject(open.error));
        open.addEventListener('success', () => {
          const db = open.result;
          const tx = db.transaction(['sessions', 'sets'], 'readonly');
          const sessions = tx.objectStore('sessions').index('status').getAll('active');
          sessions.addEventListener('success', () => {
            const active = sessions.result as {
              id: string;
              revision: number;
              undo: { removeSetIds: string[]; restoreSets: { id: string }[] } | null;
            }[];
            if (active.length !== 1) {
              db.close();
              resolve({
                sessionId: null,
                revision: null,
                undoRemoves: [],
                undoRestores: [],
                sets: [],
              });
              return;
            }
            const session = active[0]!;
            const sets = tx.objectStore('sets').index('sessionId').getAll(session.id);
            sets.addEventListener('success', () => {
              db.close();
              resolve({
                sessionId: session.id,
                revision: session.revision,
                undoRemoves: session.undo?.removeSetIds ?? [],
                undoRestores: session.undo?.restoreSets.map((set) => set.id) ?? [],
                sets: sets.result as StoredSet[],
              });
            });
          });
          tx.addEventListener('error', () => reject(tx.error));
        });
      }),
  );
}

/**
 * What the origin's storage holds, for the failure report: every database with its version and,
 * for `powr`, the record count of each store. Never creates a database (only a listed one opens).
 */
export function describeStorage(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    if (!databases.some((database) => database.name === 'powr')) return { databases };
    const counts = await new Promise<Record<string, number> | string>((resolve) => {
      const open = indexedDB.open('powr');
      open.addEventListener('error', () => resolve(`open failed: ${String(open.error)}`));
      open.addEventListener('success', () => {
        const db = open.result;
        const names = [...db.objectStoreNames];
        const tx = db.transaction(names, 'readonly');
        const result: Record<string, number> = {};
        for (const name of names) {
          const request = tx.objectStore(name).count();
          request.addEventListener('success', () => {
            result[name] = request.result;
          });
        }
        tx.addEventListener('complete', () => {
          db.close();
          resolve(result);
        });
        tx.addEventListener('error', () => resolve(`read failed: ${String(tx.error)}`));
      });
    });
    return { databases, counts };
  });
}
