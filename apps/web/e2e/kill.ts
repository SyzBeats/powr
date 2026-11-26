import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statfsSync,
  statSync,
  type Dirent,
} from 'node:fs';
import { join } from 'node:path';

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

/** The `LOCK` files of the profile's LevelDB stores (IndexedDB, Local Storage, Service Worker…). */
function lockFiles(dir: string, depth = 0): string[] {
  if (depth > 4) return [];
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'Cache' ? [] : lockFiles(path, depth + 1);
    return entry.name === 'LOCK' ? [path] : [];
  });
}

/** `major:minor` of a `stat().dev` as /proc/locks prints it (both in hex). */
function deviceOf(dev: number): string {
  const major = ((dev >> 8) & 0xfff) | (Math.floor(dev / 2 ** 32) & ~0xfff);
  const minor = (dev & 0xff) | ((dev >> 12) & 0xfff00);
  return `${major.toString(16).padStart(2, '0')}:${minor.toString(16).padStart(2, '0')}`;
}

/**
 * File locks (POSIX, flock or open-file-description, from /proc/locks) that some process still
 * holds on the profile's LevelDB `LOCK` files. LevelDB takes one for as long as a store is open, so
 * a holder after a whole-browser kill means the new browser would find the store in use.
 */
function profileLocks(profileDir: string): { file: string; pid: number; kind: string }[] {
  const byKey = new Map<string, string>();
  for (const file of lockFiles(profileDir)) {
    try {
      const stat = statSync(file);
      byKey.set(`${deviceOf(stat.dev)}:${stat.ino}`, file.slice(profileDir.length + 1));
    } catch {
      // Deleted meanwhile.
    }
  }
  if (byKey.size === 0) return [];
  return readFileSync('/proc/locks', 'utf8')
    .split('\n')
    .flatMap((line) => {
      // "1: POSIX  ADVISORY  WRITE 1234 00:2b:5678 0 EOF" (a waiter has "->" after the number).
      const fields = line.split(/\s+/).filter((field) => field !== '->');
      const [, kind = '', , , pid = '', key = ''] = fields;
      const file = byKey.get(key);
      return file ? [{ file, pid: Number(pid), kind }] : [];
    });
}

/**
 * Before a reopen: waits until no process holds a lock on the profile's stores (Android never
 * starts an app's new process while the old one still holds its files). Returns how long it
 * waited and who held a lock; throws, as a test-environment error, if one is still held after
 * 10 s.
 */
export async function locksReleased(
  profileDir: string,
): Promise<{ ms: number; held: { file: string; pid: number; kind: string }[] }> {
  const started = Date.now();
  let held = profileLocks(profileDir);
  const first = held;
  while (held.length > 0) {
    if (Date.now() - started > 10_000) {
      throw new Error(
        `Test environment: profile locks still held after 10 s: ${JSON.stringify(held)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    held = profileLocks(profileDir);
  }
  return { ms: Date.now() - started, held: first };
}

/** The profile's storage folders, copied before a reopen so a failure can be examined offline. */
const STORAGE_FOLDERS = ['IndexedDB', 'Local Storage', 'Service Worker/Database'] as const;

/** Copies the profile's storage folders (a few hundred kB) into `target`, replacing what was there. */
export function copyStorage(profileDir: string, target: string): void {
  rmSync(target, { recursive: true, force: true });
  for (const folder of STORAGE_FOLDERS) {
    const source = join(profileDir, 'Default', folder);
    if (existsSync(source)) cpSync(source, join(target, folder), { recursive: true });
  }
}

/**
 * The profile's storage folders on disk for the failure report: every file with its size and
 * time, the IndexedDB LevelDB's own `LOG` and `LOG.old` (its record of the last opens and
 * recoveries), and the free space of the file system (quota eviction starts when it runs low).
 */
export function describeProfile(profileDir: string): Record<string, unknown> {
  const files: string[] = [];
  const walk = (dir: string, depth: number) => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < 4) walk(path, depth + 1);
        continue;
      }
      try {
        const stat = statSync(path);
        files.push(`${path.slice(profileDir.length + 1)} ${stat.size} ${stat.mtime.toISOString()}`);
      } catch {
        files.push(`${path.slice(profileDir.length + 1)} (gone)`);
      }
    }
  };
  for (const folder of STORAGE_FOLDERS) walk(join(profileDir, 'Default', folder), 0);
  const logs: Record<string, string> = {};
  const idb = join(profileDir, 'Default', 'IndexedDB');
  for (const store of existsSync(idb) ? readdirSync(idb) : []) {
    for (const name of ['LOG', 'LOG.old']) {
      const path = join(idb, store, name);
      if (existsSync(path)) logs[`IndexedDB/${store}/${name}`] = readFileSync(path, 'utf8');
    }
  }
  const fs = statfsSync(profileDir);
  return {
    topLevel: existsSync(profileDir) ? readdirSync(profileDir) : '(profile folder missing)',
    files,
    logs,
    locks: profileLocks(profileDir),
    leftovers: profileLeftovers(profileDir),
    freeBytes: fs.bavail * fs.bsize,
    totalBytes: fs.blocks * fs.bsize,
  };
}

/** CRC-32C (Castagnoli), as LevelDB checksums its log records. */
const CRC32C = Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0x82f63b78 : crc >>> 1;
  return crc >>> 0;
});
function crc32c(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC32C[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * M6d: the IndexedDB write-ahead logs under `storageDir` (a `copyStorage` copy) that hold an
 * orphaned record header: 7 bytes announcing a record whose data was never written (a SIGKILL
 * between LevelDB's two writes of one record), with valid records right behind it (the next
 * start appended there, as Chromium reuses the log). At the next open LevelDB reports corruption
 * and Chromium deletes the origin's whole IndexedDB store. Returns "<log>@<offset>" per orphan.
 */
export function orphanedLogRecords(storageDir: string): string[] {
  const block = 32_768;
  const found: string[] = [];
  const root = join(storageDir, 'IndexedDB');
  for (const store of existsSync(root) ? readdirSync(root) : []) {
    for (const name of readdirSync(join(root, store)).filter((file) => file.endsWith('.log'))) {
      const data = readFileSync(join(root, store, name));
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const valid = (at: number) => {
        if (at + 7 > data.length) return false;
        const length = view.getUint16(at + 4, true);
        const type = data[at + 6]!;
        if (type < 1 || type > 4 || at + 7 + length > data.length) return false;
        if ((at % block) + 7 + length > block) return false;
        const masked = view.getUint32(at, true);
        const rotated = (masked - 0xa282ead8) >>> 0;
        const expected = ((rotated >>> 17) | (rotated << 15)) >>> 0;
        return crc32c(data.subarray(at + 6, at + 7 + length)) === expected;
      };
      let at = 0;
      while (at + 7 <= data.length) {
        const left = block - (at % block);
        if (left < 7) {
          at += left;
          continue;
        }
        if (valid(at)) {
          at += 7 + view.getUint16(at + 4, true);
          continue;
        }
        if (valid(at + 7)) found.push(`${store}/${name}@${at}`);
        break;
      }
    }
  }
  return found;
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
 * What the origin's storage holds, for the failure report: every database with its version; for
 * `powr` the record count of each store and the `meta` keys; the app's own diagnostics log (the
 * last 40 entries of `powr-diag`: opens, errors, recoveries); the `localStorage` keys; the service
 * worker registrations and caches (an evicted origin loses those too, a lost IndexedDB does not);
 * and whether the storage is persistent. Never creates a database (only a listed one opens).
 */
export function describeStorage(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    const listed = new Set(databases.map((database) => database.name));
    const read = (name: string, collect: (db: IDBDatabase, tx: IDBTransaction) => () => unknown) =>
      new Promise<unknown>((resolve) => {
        if (!listed.has(name)) {
          resolve('(not listed)');
          return;
        }
        const open = indexedDB.open(name);
        open.addEventListener('error', () => resolve(`open failed: ${String(open.error)}`));
        open.addEventListener('success', () => {
          const db = open.result;
          const names = [...db.objectStoreNames];
          if (names.length === 0) {
            db.close();
            resolve('(no stores)');
            return;
          }
          const tx = db.transaction(names, 'readonly');
          const result = collect(db, tx);
          tx.addEventListener('complete', () => {
            db.close();
            resolve(result());
          });
          tx.addEventListener('error', () => resolve(`read failed: ${String(tx.error)}`));
        });
      });
    const powr = await read('powr', (db, tx) => {
      const counts: Record<string, number> = {};
      let metaKeys: unknown = null;
      for (const name of db.objectStoreNames) {
        const request = tx.objectStore(name).count();
        request.addEventListener('success', () => {
          counts[name] = request.result;
        });
      }
      if (db.objectStoreNames.contains('meta')) {
        const keys = tx.objectStore('meta').getAllKeys();
        keys.addEventListener('success', () => {
          metaKeys = keys.result;
        });
      }
      return () => ({ counts, metaKeys });
    });
    const diagnostics = await read('powr-diag', (_db, tx) => {
      const request = tx.objectStore('entries').getAll();
      return () =>
        (request.result as { ts: number; code: string; route: string; data: unknown }[])
          .slice(-40)
          .map(({ ts, code, route, data }) => ({
            at: new Date(ts).toISOString(),
            code,
            route,
            data,
          }));
    });
    const registrations = await navigator.serviceWorker
      .getRegistrations()
      .then((list) => list.length)
      .catch((error: unknown) => String(error));
    const cacheNames = await caches.keys().catch((error: unknown) => String(error));
    return {
      databases,
      powr,
      diagnostics,
      localStorage: Object.keys(localStorage),
      serviceWorkers: registrations,
      caches: cacheNames,
      persisted: await navigator.storage.persisted(),
    };
  });
}
