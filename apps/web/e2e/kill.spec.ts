import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, devices, type BrowserContext, type Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';
import {
  chromiumTree,
  copyStorage,
  describeProfile,
  describeStorage,
  locksReleased,
  orphanedLogRecords,
  profileLeftovers,
  random,
  readStoredWorkout,
  reaped,
  sigkill,
  type StoredWorkout,
} from './kill';
import { addExercise, dock, logSet, startEmptyWorkout } from './session';

/**
 * Randomised process kills during set logging (NFR-REL-01, QS-01, TD-13): "no confirmed set is
 * lost". A real Chromium on a persistent profile logs sets the way a user does (the dock's fields,
 * "Confirm set", the edit sheet); at a random point the whole browser (every process of the
 * profile) or only the renderer is killed with SIGKILL, with no unload event, no shutdown and no
 * flush. Then the profile is opened again and the test checks, against the stored records and the
 * screen:
 * - every set the app acknowledged before the kill is stored with its values (acknowledged: the
 *   `powr-set-commit` measure, taken after the strict-durability transaction committed, reached
 *   the test before the kill; for an edit, the row showed the new value);
 * - a set in flight at the kill is either stored complete or not at all, never in part, and a set
 *   that was only typed (not confirmed) is not stored; nothing is stored twice; the indexes of the
 *   sets have no gap; the session's undo entry names only stored sets (same transaction);
 * - the workout resumes: the workout screen with "Workout resumed" and every logged set.
 *
 * Linux only (the process tree is read from /proc). In `pnpm e2e`: one test of 10 kills with a
 * fixed seed. The full run, 200 kills in tests of 10 that run in parallel, is opt-in:
 * `pnpm e2e:kill` (after `pnpm build`), or `POWR_KILLS=500 pnpm e2e:kill`; its base seed is the
 * time unless `POWR_KILL_SEED` is set. Every test prints its seed, the command that repeats it and
 * a `KILL {...}` summary line; `POWR_KILL_VERBOSE=1` adds a line per kill.
 */

const PER_TEST = 10;
const SHORT_SEED = 20_261_125;
const FULL_KILLS = Number(process.env['POWR_KILLS'] ?? 0);
const SEED_ENV = process.env['POWR_KILL_SEED'];
/** One line per kill with its point, mode and outcome (`POWR_KILL_VERBOSE=1`). */
const VERBOSE = Boolean(process.env['POWR_KILL_VERBOSE']);
const SQUAT = 'Barbell back squat';
/** The recovery screen for data that is gone, and the first run it replaces (M6d). */
const MISSING = 'Your data could not be read';
const WELCOME = 'Welcome to POWR';
const SQUAT_ID = 'ex.barbell-back-squat';

const POINTS = {
  /** The values are typed into the dock, "Confirm set" is not tapped. */
  beforeTap: 2,
  /** 0–15 ms into the tap on "Confirm set", while Playwright may still be dispatching it. */
  atTap: 2,
  /** 0–30 ms after the tap: inside the commit window (a few ms to about 30 ms here) or after it. */
  inCommit: 4,
  /** 0–100 ms after the acknowledgement. */
  afterCommit: 2,
  /** 0.3–3 s after the acknowledgement, while the rest timer runs. */
  duringRest: 2,
  /** 0–30 ms or 50–300 ms after "Save set" in the edit sheet of a logged set. */
  afterEdit: 3,
} as const;
type KillPoint = keyof typeof POINTS;

const MODES = {
  /** SIGKILL to every process of the profile: the browser, its zygotes, renderers and services. */
  browser: 4,
  /** SIGKILL to the renderers only; the browser process lives on (a reclaimed tab). */
  renderer: 1,
} as const;
type KillMode = keyof typeof MODES;

/**
 * Only some points or modes (`POWR_KILL_POINTS=atTap`, `POWR_KILL_MODES=browser`, comma-separated),
 * to soak one case. The others get weight 0; the random sequence stays the same, so a seed still
 * repeats its run.
 */
function only<T extends string>(weights: Readonly<Record<T, number>>, env: string | undefined) {
  const chosen = (env ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (chosen.length === 0) return weights;
  const unknown = chosen.filter((value) => !(value in weights));
  if (unknown.length > 0) throw new Error(`Unknown kill points or modes: ${unknown.join(', ')}`);
  return Object.fromEntries(
    Object.entries(weights).map(([key, weight]) => [key, chosen.includes(key) ? weight : 0]),
  ) as Readonly<Record<T, number>>;
}
const POINT_WEIGHTS = only(POINTS, process.env['POWR_KILL_POINTS']);
const MODE_WEIGHTS = only(MODES, process.env['POWR_KILL_MODES']);

interface Stats {
  seed: number;
  kills: number;
  points: Partial<Record<KillPoint, number>>;
  modes: Partial<Record<KillMode, number>>;
  /** Sets confirmed and acknowledged before a kill (and later checked after each kill). */
  confirmed: number;
  /** Sets typed but not confirmed at the kill: must not be stored. */
  typedOnly: number;
  /** Confirms in flight at the kill: stored complete, or not stored. */
  inFlight: { present: number; absent: number };
  /** Edits: acknowledged before the kill, or in flight (new value or old value found). */
  edits: { acknowledged: number; inFlightNew: number; inFlightOld: number };
  /** Sets stored at the end; every check compares all of them. */
  finalSets: number;
  /** Reopens that had to wait for a lock on the profile's stores to go (and the longest wait). */
  lockWaits: { count: number; maxMs: number };
  ms: number;
}

/** One kill, kept for the failure report (the last few). */
interface KillRecord {
  readonly kill: number;
  readonly point: KillPoint;
  readonly mode: KillMode;
  readonly at: string;
  readonly processes: number;
  readonly leftovers: number;
  readonly lockWaitMs: number;
  readonly locksHeld: readonly unknown[];
  readonly reopenMs: number;
}

/** A line in the test output (the list reporter shows it). */
const print = (line: string) => process.stdout.write(`${line}\n`);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A row's text: "Set 2, done41 kg × 7" (or lb; the unit may follow a no-break space). Weights
 * are unique, so the weight finds the row.
 */
const rowOf = (page: Page, weight: number) =>
  page
    .getByTestId('logged-set')
    .filter({ hasText: new RegExp(`(?<![\\d.])${weight}\\s(kg|lb)\\s×`) });

/** Seeds and counts per test: the short run, or the opt-in full run in tests of PER_TEST. */
function plan(): {
  readonly name: string;
  readonly seed: number;
  readonly kills: number;
  readonly repeat: string;
}[] {
  if (FULL_KILLS <= 0) return [];
  // One base for every worker: `pnpm e2e:kill` sets a new one per run (the time), else the day.
  const base = Number(SEED_ENV ?? new Date().toISOString().slice(0, 10).replaceAll('-', ''));
  const tests = Math.ceil(FULL_KILLS / PER_TEST);
  return Array.from({ length: tests }, (_, index) => {
    const name = `kills ${index * PER_TEST + 1}–${Math.min(FULL_KILLS, (index + 1) * PER_TEST)}`;
    return {
      name,
      seed: base + index,
      kills: Math.min(PER_TEST, FULL_KILLS - index * PER_TEST),
      repeat: `POWR_KILLS=${FULL_KILLS} POWR_KILL_SEED=${base} pnpm e2e:kill -g "${name}"`,
    };
  });
}

test.describe('randomised process kills while logging (NFR-REL-01, QS-01, TD-13)', () => {
  test.skip(process.platform !== 'linux', 'reads the Chromium process tree from /proc');

  test('10 kills: no confirmed set lost, the workout resumes', async ({ baseURL }) => {
    test.skip(FULL_KILLS > 0, 'the full run replaces the short one');
    test.setTimeout(240_000);
    const seed = SEED_ENV ? Number(SEED_ENV) : SHORT_SEED;
    await killRun(
      baseURL!,
      seed,
      PER_TEST,
      `POWR_KILL_SEED=${seed} pnpm e2e e2e/kill.spec.ts -g "10 kills"`,
    );
  });

  const full = plan();
  if (full.length === 0) {
    test('200 kills (opt-in: pnpm e2e:kill)', () => {
      test.skip(true, 'set POWR_KILLS=200 (pnpm e2e:kill) for the full run');
    });
  }
  for (const entry of full) {
    test(entry.name, async ({ baseURL }) => {
      test.setTimeout(240_000);
      await killRun(baseURL!, entry.seed, entry.kills, entry.repeat);
    });
  }
});

async function killRun(
  baseURL: string,
  seed: number,
  kills: number,
  repeat: string,
): Promise<void> {
  const started = Date.now();
  const rng = random(seed);
  print(`kill test: seed ${seed}, ${kills} kills (repeat: ${repeat})`);
  const stats: Stats = {
    seed,
    kills: 0,
    points: {},
    modes: {},
    confirmed: 0,
    typedOnly: 0,
    inFlight: { present: 0, absent: 0 },
    edits: { acknowledged: 0, inFlightNew: 0, inFlightOld: 0 },
    finalSets: 0,
    lockWaits: { count: 0, maxMs: 0 },
    ms: 0,
  };
  const profile = mkdtempSync(join(tmpdir(), 'powr-e2e-kill-'));
  /** The profile's storage folders as the last reopen found them (for the failure report). */
  const beforeReopen = mkdtempSync(join(tmpdir(), 'powr-e2e-kill-storage-'));
  const history: KillRecord[] = [];
  const problems: string[] = [];
  /**
   * Acknowledgements that reached the test: confirms (the `powr-set-commit` measure, taken right
   * after the strict transaction committed) and edits (the row shows the new value, which the
   * live query renders only after the commit). Reported by the page through a binding, so no
   * round trip delays the kill.
   */
  const acks = { confirm: 0, edit: 0 };

  const launch = async (): Promise<{ context: BrowserContext; page: Page }> => {
    const context = await chromium.launchPersistentContext(profile, {
      ...devices['Pixel 7'],
      viewport: { width: 360, height: 780 },
      deviceScaleFactor: 3,
      baseURL,
      serviceWorkers: 'allow',
    });
    // Fail fast instead of waiting for the test's limit.
    context.setDefaultTimeout(15_000);
    await context.exposeBinding('powrKillAck', (_source, kind: 'confirm' | 'edit') => {
      acks[kind] += 1;
    });
    await context.addInitScript(() => {
      const host = window as unknown as {
        powrKillAck?: (kind: 'confirm' | 'edit') => Promise<void>;
        powrKillEdit?: { weight: number; to: number } | undefined;
      };
      // session/commands.ts takes the measure right after the strict transaction committed.
      const measure = performance.measure.bind(performance);
      performance.measure = (name, ...rest) => {
        const entry = measure(name, ...rest);
        if (name === 'powr-set-commit') void host.powrKillAck?.('confirm');
        return entry;
      };
      // The edited row shows its new value once the edit committed and the live query re-ran.
      new MutationObserver(() => {
        const target = host.powrKillEdit;
        if (!target) return;
        const value = new RegExp(`(?<![\\d.])${target.weight}\\s(kg|lb)\\s× ${target.to}(?!\\d)`);
        const rows = document.querySelectorAll('[data-testid="logged-set"]');
        if ([...rows].some((row) => value.test(row.textContent ?? ''))) {
          host.powrKillEdit = undefined;
          void host.powrKillAck?.('edit');
        }
      }).observe(document, { subtree: true, childList: true, characterData: true });
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
      });
    });
    context.on('console', (message) => {
      if (message.text().includes('CSP violation')) problems.push(message.text());
    });
    const page = context.pages()[0] ?? (await context.newPage());
    return { context, page };
  };

  let { context, page } = await launch();
  try {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, SQUAT);

    /** The stored sets the test expects: weight → reps (weights are unique). */
    const model = new Map<number, number>();
    let nextWeight = 40;
    /** All planned sets done: the dock goes away, so add one through the exercise's options. */
    const openSet = async () => {
      if ((await dock(page).count()) > 0) return;
      await page.getByRole('button', { name: `Options for ${SQUAT}` }).click();
      await page
        .getByRole('dialog', { name: SQUAT })
        .getByRole('button', { name: 'Add a set' })
        .click();
      await expect(dock(page)).toBeVisible();
    };
    const typeSet = async (weight: number, reps: number) => {
      await openSet();
      await dock(page)
        .getByLabel(/^Weight/)
        .fill(String(weight));
      await dock(page).getByLabel('Reps', { exact: true }).fill(String(reps));
    };
    const waitForAck = async (before: number) => {
      await expect.poll(() => acks.confirm, { timeout: 10_000 }).toBeGreaterThan(before);
    };

    for (let kill = 0; kill < kills; kill += 1) {
      // 0–2 sets logged and acknowledged as usual first.
      for (let extra = rng.int(0, 2); extra > 0; extra -= 1) {
        const weight = nextWeight++;
        const reps = rng.int(1, 15);
        await openSet();
        await logSet(page, { weight, reps });
        model.set(weight, reps);
        stats.confirmed += 1;
      }

      let point = rng.pick(POINT_WEIGHTS);
      if (point === 'afterEdit' && model.size === 0) point = 'inCommit';
      const mode = rng.pick(MODE_WEIGHTS);
      stats.points[point] = (stats.points[point] ?? 0) + 1;
      stats.modes[mode] = (stats.modes[mode] ?? 0) + 1;

      let typed: { weight: number; reps: number } | null = null;
      let confirm: { weight: number; reps: number; acknowledged: boolean } | null = null;
      let edit: { weight: number; from: number; to: number; acknowledged: boolean } | null = null;

      if (point === 'afterEdit') {
        const weights = [...model.keys()];
        const weight = weights[rng.int(0, weights.length - 1)]!;
        const from = model.get(weight)!;
        const to = from === 15 ? 1 : from + rng.int(1, 15 - from);
        await rowOf(page, weight).click();
        const sheet = page.getByRole('dialog', { name: 'Edit set' });
        await sheet.getByRole('textbox', { name: 'Reps', exact: true }).fill(String(to));
        await page.evaluate(
          (target) => {
            (window as unknown as { powrKillEdit?: typeof target }).powrKillEdit = target;
          },
          { weight, to },
        );
        const before = acks.edit;
        await sheet.getByRole('button', { name: 'Save set' }).click();
        // Half inside the commit window, half after it (so both outcomes are checked).
        await sleep(rng.next() < 0.5 ? rng.int(0, 30) : rng.int(50, 300));
        edit = { weight, from, to, acknowledged: acks.edit > before };
      } else {
        const weight = nextWeight++;
        const reps = rng.int(1, 15);
        await typeSet(weight, reps);
        if (point === 'beforeTap') {
          await sleep(rng.int(0, 50));
          typed = { weight, reps };
        } else {
          const before = acks.confirm;
          const tap = dock(page).getByRole('button', { name: 'Confirm set' }).click();
          if (point === 'atTap') {
            // The kill may land before, during or after the tap's dispatch.
            void tap.catch(() => undefined);
            await sleep(rng.int(0, 15));
          } else await tap;
          if (point === 'inCommit') await sleep(rng.int(0, 30));
          if (point === 'afterCommit' || point === 'duringRest') {
            await waitForAck(before);
            await sleep(point === 'afterCommit' ? rng.int(0, 100) : rng.int(300, 3000));
          }
          confirm = { weight, reps, acknowledged: acks.confirm > before };
        }
      }

      // The kill: no graceful step in between.
      const tree = chromiumTree(profile);
      const killedAt = new Date().toISOString();
      if (mode === 'browser') {
        const closed = context.waitForEvent('close').catch(() => undefined);
        await sigkill(tree.all);
        await reaped(tree.browser);
        await Promise.race([closed, sleep(5_000)]);
        await context.close().catch(() => undefined);
        // Nothing of the old browser may hold the profile when the new one opens it.
        const leftovers = profileLeftovers(profile);
        if (leftovers.length > 0) {
          print(`seed ${seed}, kill ${kill + 1}: ${leftovers.length} leftover process(es) killed`);
          await sigkill(leftovers);
        }
        // Nor a lock on its stores (a phone never reopens an app over its old process's files).
        const locks = await locksReleased(profile);
        if (locks.held.length > 0) {
          stats.lockWaits.count += 1;
          stats.lockWaits.maxMs = Math.max(stats.lockWaits.maxMs, locks.ms);
          print(
            `seed ${seed}, kill ${kill + 1}: waited ${locks.ms} ms for locks ${JSON.stringify(locks.held)}`,
          );
        }
        copyStorage(profile, beforeReopen);
        acks.confirm = 0;
        acks.edit = 0;
        const reopening = Date.now();
        ({ context, page } = await launch());
        history.push({
          kill: kill + 1,
          point,
          mode,
          at: killedAt,
          processes: tree.all.length,
          leftovers: leftovers.length,
          lockWaitMs: locks.ms,
          locksHeld: locks.held,
          reopenMs: Date.now() - reopening,
        });
      } else {
        expect(tree.renderers.length, 'renderer processes').toBeGreaterThan(0);
        await sigkill(tree.renderers);
        await page.close().catch(() => undefined);
        acks.confirm = 0;
        acks.edit = 0;
        page = await context.newPage();
        history.push({
          kill: kill + 1,
          point,
          mode,
          at: killedAt,
          processes: tree.renderers.length,
          leftovers: 0,
          lockWaitMs: 0,
          locksHeld: [],
          reopenMs: 0,
        });
      }
      if (history.length > 5) history.shift();
      stats.kills += 1;

      // After the kill: the workout resumes… If the stored data is gone instead, POWR must say so
      // ("Your data could not be read", M6d), never start over with the first run.
      await page.goto('/session');
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveText(new RegExp(`^(Workout|${MISSING}|${WELCOME})$`), {
        timeout: 15_000,
      });
      const shown = await heading.textContent();
      if (shown === WELCOME) {
        throw new Error(`kill ${kill + 1}: POWR started over with the first run (an app bug)`);
      }
      if (shown === MISSING) {
        throw new Error(`kill ${kill + 1}: the stored data is gone; POWR showed "${MISSING}"`);
      }
      await expect(page.getByText('Workout resumed')).toBeVisible();
      // …and the stored sets are exactly what was acknowledged, plus whole in-flight sets.
      const stored = await readStoredWorkout(page);
      const where = `seed ${seed}, kill ${kill + 1} (${point}, ${mode})`;
      const byWeight = check(stored, where);

      if (typed) {
        expect(byWeight.has(typed.weight), `${where}: a typed set was stored`).toBe(false);
        stats.typedOnly += 1;
      }
      if (confirm) {
        const reps = byWeight.get(confirm.weight);
        if (confirm.acknowledged)
          expect(reps, `${where}: an acknowledged set was lost`).toBeDefined();
        if (reps !== undefined) {
          expect(reps, `${where}: the set was stored with other values`).toBe(confirm.reps);
          model.set(confirm.weight, confirm.reps);
          if (confirm.acknowledged) stats.confirmed += 1;
          else stats.inFlight.present += 1;
        } else stats.inFlight.absent += 1;
      }
      if (edit) {
        const reps = byWeight.get(edit.weight);
        expect(reps, `${where}: the edited set was lost`).toBeDefined();
        if (edit.acknowledged) {
          expect(reps, `${where}: an acknowledged edit was lost`).toBe(edit.to);
          stats.edits.acknowledged += 1;
        } else {
          expect([edit.from, edit.to], `${where}: the edit left another value`).toContain(reps);
          if (reps === edit.to) stats.edits.inFlightNew += 1;
          else stats.edits.inFlightOld += 1;
        }
        model.set(edit.weight, reps!);
      }
      expect(
        Object.fromEntries([...byWeight].toSorted(([a], [b]) => a - b)),
        `${where}: stored sets against the acknowledged ones`,
      ).toEqual(Object.fromEntries([...model].toSorted(([a], [b]) => a - b)));
      // The screen shows every stored set again.
      await expect(page.getByTestId('logged-set')).toHaveCount(model.size);
      if (VERBOSE)
        print(
          `${where}: ${model.size} sets stored${confirm ? `, confirm ${confirm.acknowledged ? 'acknowledged' : 'in flight'}` : ''}${edit ? `, edit ${edit.acknowledged ? 'acknowledged' : 'in flight'}` : ''}`,
        );
    }
    stats.finalSets = model.size;
    expect(problems, 'CSP violations').toEqual([]);
  } catch (error) {
    // The persistent context is not the fixture's: attach what its page showed.
    const snapshot = await page
      .locator('body')
      .ariaSnapshot({ timeout: 2_000 })
      .catch(() => '(no page)');
    await test.info().attach('page at the failure', { body: snapshot, contentType: 'text/plain' });
    // What the profile's storage holds: a lost database and a lost record look alike on screen.
    const storage = await describeStorage(page).catch((reason: unknown) => String(reason));
    await test.info().attach('storage at the failure', {
      body: JSON.stringify(storage, null, 2),
      contentType: 'application/json',
    });
    print(`storage at the failure: ${JSON.stringify(storage)}`);
    // The files on disk, the stores' locks and the last kills; and copies of the storage folders
    // as the last reopen found them and as they are now, to open again by hand.
    const disk = describeProfile(profile);
    await test.info().attach('profile at the failure', {
      body: JSON.stringify({ disk, lastKills: history }, null, 2),
      contentType: 'application/json',
    });
    print(`profile at the failure: ${JSON.stringify({ ...disk, lastKills: history })}`);
    const kept = test.info().outputPath('storage');
    cpSync(beforeReopen, join(kept, 'before-reopen'), { recursive: true });
    copyStorage(profile, join(kept, 'after-reopen'));
    print(`storage folders kept in ${kept}`);
    // The one known cause of a lost store (M6d): a log record orphaned by an earlier kill.
    const orphans = orphanedLogRecords(beforeReopen);
    print(
      orphans.length > 0
        ? `cause: Chromium dropped the IndexedDB store; its log held an orphaned record header (${orphans.join(', ')}) from an earlier kill (IMPLEMENTATION_NOTES.md, M6d)`
        : 'cause: no orphaned log record before the reopen; not the known Chromium loss (M6d)',
    );
    if (VERBOSE) print(snapshot);
    throw error;
  } finally {
    await context.close().catch(() => undefined);
    rmSync(profile, { recursive: true, force: true });
    rmSync(beforeReopen, { recursive: true, force: true });
  }
  stats.ms = Date.now() - started;
  print(`KILL ${JSON.stringify(stats)}`);
}

/**
 * The structural checks after a kill: one active workout, every set complete and of the squat,
 * no ID or weight twice, indexes 0…n−1 without a gap, the undo entry's sets stored (it is written
 * in the same transaction). Returns the stored sets as weight → reps.
 */
function check(stored: StoredWorkout, where: string): Map<number, number> {
  expect(stored.sessionId, `${where}: no active workout`).not.toBeNull();
  const ids = stored.sets.map((set) => set.id);
  expect(new Set(ids).size, `${where}: a set ID twice`).toBe(ids.length);
  for (const set of stored.sets) {
    expect(set, `${where}: an incomplete set`).toMatchObject({
      exerciseId: SQUAT_ID,
      state: 'done',
      load: { value: expect.any(Number), unit: expect.stringMatching(/^(kg|lb)$/) },
      reps: expect.any(Number),
      performedAt: expect.objectContaining({ epochMs: expect.any(Number) }),
      localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  }
  expect(
    stored.sets.map((set) => set.index).toSorted((a, b) => a - b),
    `${where}: set indexes with a gap or twice`,
  ).toEqual(stored.sets.map((_, index) => index));
  for (const id of [...stored.undoRemoves, ...stored.undoRestores])
    expect(ids, `${where}: the undo entry names a set that is not stored`).toContain(id);
  const byWeight = new Map<number, number>();
  for (const set of stored.sets) {
    const weight = set.load!.value;
    expect(byWeight.has(weight), `${where}: a set stored twice (${weight})`).toBe(false);
    byWeight.set(weight, set.reps!);
  }
  return byWeight;
}
