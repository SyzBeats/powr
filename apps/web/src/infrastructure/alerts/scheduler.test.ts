import { describe, expect, it } from 'vitest';

import { createTimerEngine } from './engine';
import { createRestAlerts, type AlertEvent, type AlertOptions } from './scheduler';
import { fakeClock, fakeLifecycle, timer, type FakeClock } from './test-support';
import { alertKey, type TimerState } from './timer';

const OPTIONS: AlertOptions = {
  sound: true,
  volume: 0.7,
  vibration: true,
  preAlert: false,
  countdown: false,
  restingNotice: true,
  keepAlive: false,
};

const TEXTS = {
  restOver: { title: 'Rest over', body: 'Time for your next set.' },
  resting: { title: 'Resting', body: 'Ends at 12:02' },
};

function setup(initial: 'visible' | 'hidden' = 'visible', permission = 'granted' as const) {
  const clock = fakeClock();
  const lifecycle = fakeLifecycle(initial);
  const engine = createTimerEngine({ wall: clock.wall, mono: clock.mono });
  const flags = new Map<string, { by: 'page' | 'sw'; at: number }>();
  const sw = new Map<string, { endsAtEpochMs: number; title: string }>();
  const log: string[] = [];
  const cues: string[] = [];
  const vibrations: (readonly number[])[] = [];
  const shown: { title: string; silent: boolean; renotify: boolean; tag: string }[] = [];
  const events: AlertEvent[] = [];
  const pruned: number[] = [];
  const hooks: { onArm?: () => void } = {};
  let open = 0;
  const alerts = createRestAlerts({
    engine,
    lifecycle,
    timers: clock.frames,
    wall: clock.wall,
    audio: {
      play: (cue) => void cues.push(cue),
      startKeepAlive: async () => {
        log.push('keep-alive on');
        return true;
      },
      stopKeepAlive: () => void log.push('keep-alive off'),
      suspend: async () => void log.push('suspend'),
    },
    haptics: { supported: true, vibrate: (pattern) => vibrations.push(pattern) > 0 },
    notifications: {
      permission: () => permission,
      request: async () => permission,
      show: async ({ title, tag, silent = false, renotify = false }) => {
        shown.push({ title, tag, silent, renotify });
        open = 1;
        return true;
      },
      closeByTag: async (tag) => {
        log.push(`close ${tag}`);
        open = 0;
      },
    },
    transport: {
      armRestEnd: async (alert) => {
        sw.set(alert.timerId, alert);
        log.push(`arm ${alert.timerId}`);
        hooks.onArm?.();
      },
      disarm: async (key) => {
        sw.delete(key);
        log.push(`disarm ${key}`);
      },
      claimFired: async (key, by) => {
        if (flags.has(key)) return false;
        flags.set(key, { by, at: clock.wall() });
        return true;
      },
      firedBy: async (key) => flags.get(key),
    },
    pruneFired: async (olderThanMs) => void pruned.push(olderThanMs),
    onError: (error) => {
      throw error;
    },
  });
  alerts.subscribe((event) => events.push(event));
  /** The service worker's own timer firing at its end (it claims first). */
  const swFires = (key: string) => {
    const armed = sw.get(key);
    if (armed && !flags.has(key)) flags.set(key, { by: 'sw', at: armed.endsAtEpochMs });
  };
  const run = async (step: (clock: FakeClock) => void) => {
    step(clock);
    await alerts.settled();
  };
  return {
    clock,
    lifecycle,
    alerts,
    flags,
    sw,
    log,
    cues,
    vibrations,
    shown,
    events,
    pruned,
    swFires,
    hooks,
    run,
    openNotifications: () => open,
    types: () => events.map((event) => event.type),
  };
}

const startedNow = (t: ReturnType<typeof setup>, overrides: Partial<TimerState> = {}) =>
  timer({ startedAtEpochMs: t.clock.wall(), ...overrides });

describe('rest alerts while visible (§8.8.2, TMR-05)', () => {
  it('fires the pre-alert, the 3-2-1 and the end within 1 s, in every enabled channel', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 30_000 });
    t.alerts.arm(rest, TEXTS, { ...OPTIONS, preAlert: true, countdown: true });
    await t.alerts.settled();
    await t.run((clock) => clock.advance(19_999));
    expect(t.cues).toEqual([]);
    await t.run((clock) => clock.advance(1));
    expect(t.cues).toEqual(['preAlert']);
    expect(t.vibrations).toEqual([[80]]);
    await t.run((clock) => clock.advance(10_000));
    expect(t.cues).toEqual(['preAlert', 'countdown', 'countdown', 'countdown', 'restEnd']);
    expect(t.vibrations.at(-1)).toEqual([200, 100, 200]);
    const end = t.events.find((event) => event.type === 'end');
    expect(end).toMatchObject({ path: 'visible', hidden: false });
    expect(end?.type === 'end' && end.delayMs).toBeLessThan(1000);
    expect(t.flags.get(alertKey(rest))).toMatchObject({ by: 'page' });
    expect(t.types()).toEqual(['armed', 'pre-alert', 'countdown', 'countdown', 'countdown', 'end']);
  });

  it('respects sound and vibration off and skips a pre-alert that already fired', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 30_000, fired: { preAlert: true } });
    t.alerts.arm(rest, TEXTS, { ...OPTIONS, sound: false, vibration: false, preAlert: true });
    await t.run((clock) => clock.advance(30_000));
    expect(t.cues).toEqual([]);
    expect(t.vibrations).toEqual([]);
    expect(t.types()).toEqual(['armed', 'end']);
  });

  it('plays the gentle cue at the soft minimum of a count-up (TMR-07)', async () => {
    const t = setup();
    t.alerts.arm(startedNow(t, { mode: 'countup', targetMs: 90_000 }), TEXTS, {
      ...OPTIONS,
      preAlert: true,
      countdown: true,
    });
    await t.run((clock) => clock.advance(90_000));
    expect(t.cues).toEqual(['gentle']);
  });

  it('disarms: nothing fires, nothing is left running (NFR-PERF-10)', async () => {
    const t = setup();
    const rest = startedNow(t);
    t.alerts.arm(rest, TEXTS, OPTIONS);
    await t.alerts.settled();
    t.alerts.disarm(rest.id);
    await t.run((clock) => clock.advance(200_000));
    expect(t.cues).toEqual([]);
    expect(t.flags.size).toBe(0);
    expect(t.clock.pending()).toBe(0);
    expect(t.lifecycle.listeners()).toBe(0);
    expect(t.types()).toEqual(['armed', 'disarmed']);
  });
});

describe('rest alerts while hidden (§8.8.4, TMR-06)', () => {
  it('arms the page timeout, the service worker and the silent resting notice on hide', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 60_000 });
    const key = alertKey(rest);
    t.alerts.arm(rest, TEXTS, OPTIONS);
    await t.run((clock) => clock.advance(10_000));
    await t.run(() => t.lifecycle.set('hidden'));
    expect(t.sw.get(key)).toMatchObject({ endsAtEpochMs: rest.startedAtEpochMs + 60_000 });
    expect(t.shown).toEqual([{ title: 'Resting', tag: 'rest', silent: true, renotify: false }]);
    expect(t.events.at(-1)).toMatchObject({
      type: 'hidden',
      paths: ['page-timeout', 'sw-timer', 'resting-notice'],
    });

    // The page still runs at the end: its timeout alerts and shows "Rest over".
    await t.run((clock) => clock.advance(50_000));
    expect(t.flags.get(key)).toMatchObject({ by: 'page' });
    expect(t.shown.at(-1)).toEqual({
      title: 'Rest over',
      tag: 'rest',
      silent: false,
      renotify: true,
    });
    expect(t.cues).toEqual(['restEnd']);
    expect(t.events.at(-1)).toMatchObject({ type: 'end', path: 'page-timeout', hidden: true });

    // Back 42 s after the end: disarm, close the notifications, report, a gentle cue.
    await t.run((clock) => clock.advance(42_000));
    await t.run(() => t.lifecycle.set('visible'));
    expect(t.log).toContain(`disarm ${key}`);
    expect(t.log).toContain('close rest');
    expect(t.openNotifications()).toBe(0);
    expect(t.events.at(-1)).toMatchObject({
      type: 'visible',
      endedWhileHidden: true,
      overMs: 42_000,
    });
    expect(t.cues).toEqual(['restEnd', 'gentle']);
  });

  it('dedupes: when the service worker fired first, the page stays silent (one alert)', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 60_000 });
    const key = alertKey(rest);
    t.alerts.arm(rest, TEXTS, { ...OPTIONS, restingNotice: false });
    await t.run(() => t.lifecycle.set('hidden'));
    t.swFires(key);
    await t.run((clock) => clock.advance(61_000));
    expect(t.cues).toEqual([]);
    expect(t.shown).toEqual([]);
    const ends = t.events.filter((event) => event.type === 'end');
    expect(ends).toEqual([expect.objectContaining({ path: 'sw-timer', delayMs: 0, hidden: true })]);
    await t.run(() => t.lifecycle.set('visible'));
    expect(t.events.filter((event) => event.type === 'end')).toHaveLength(1);
    expect(t.events.at(-1)).toMatchObject({ type: 'visible', endedWhileHidden: true });
  });

  it('variant B: only the service worker is armed; its alert is reported on return', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 2000 });
    const key = alertKey(rest);
    t.alerts.arm(rest, TEXTS, {
      ...OPTIONS,
      restingNotice: false,
      paths: { page: false, serviceWorker: true },
    });
    await t.run(() => t.lifecycle.set('hidden'));
    expect(t.events.at(-1)).toMatchObject({ type: 'hidden', paths: ['sw-timer'] });
    // A frozen page: only the service worker runs.
    t.clock.sleep(3500);
    t.swFires(key);
    await t.run(() => t.lifecycle.set('visible'));
    expect(t.events.filter((event) => event.type === 'end')).toEqual([
      expect.objectContaining({ path: 'sw-timer', hidden: true }),
    ]);
  });

  it('a missed rest (page frozen, no service worker) is noticed on return with a gentle cue', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 60_000 });
    t.alerts.arm(rest, TEXTS, { ...OPTIONS, restingNotice: false });
    await t.run(() => t.lifecycle.set('hidden'));
    t.clock.sleep(70_000);
    await t.run(() => t.lifecycle.set('visible'));
    expect(t.events.filter((event) => event.type === 'end')).toEqual([
      expect.objectContaining({ path: 'on-return', delayMs: 10_000 }),
    ]);
    expect(t.cues).toEqual(['gentle']);
    // The page timeout that never ran is gone: nothing fires later.
    await t.run((clock) => clock.advance(120_000));
    expect(t.cues).toEqual(['gentle']);
    expect(t.clock.pending()).toBe(0);
  });

  it('arms the service worker 5 minutes before the end of a longer rest, if the page runs', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 8 * 60_000 });
    const key = alertKey(rest);
    t.alerts.arm(rest, TEXTS, { ...OPTIONS, restingNotice: false });
    await t.run(() => t.lifecycle.set('hidden'));
    expect(t.sw.has(key)).toBe(false);
    await t.run((clock) => clock.advance(3 * 60_000 + 1000));
    expect(t.sw.has(key)).toBe(true);
  });

  it('without notification permission the page path still beeps (nothing else to show)', async () => {
    const t = setup('visible', 'denied' as 'granted');
    const rest = startedNow(t, { targetMs: 10_000 });
    t.alerts.arm(rest, TEXTS, OPTIONS);
    await t.run(() => t.lifecycle.set('hidden'));
    await t.run((clock) => clock.advance(10_000));
    expect(t.cues).toEqual(['restEnd']);
  });
});

describe('re-arm and arm after a reload', () => {
  it('re-arms on an adjust (TMR-03): the old end is disarmed, the new one alerts', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 60_000 });
    t.alerts.arm(rest, TEXTS, OPTIONS);
    await t.run(() => t.lifecycle.set('hidden'));
    await t.run(() => t.lifecycle.set('visible'));
    await t.run((clock) => clock.advance(20_000));
    const longer = { ...rest, adjustMs: 15_000 };
    t.alerts.arm(longer, TEXTS, OPTIONS);
    await t.alerts.settled();
    expect(t.events.at(-1)).toMatchObject({ type: 'armed', rearmed: true, remainingMs: 55_000 });
    await t.run((clock) => clock.advance(40_000));
    expect(t.cues).toEqual([]);
    await t.run((clock) => clock.advance(15_000));
    expect(t.cues).toEqual(['restEnd']);
    expect(t.flags.has(alertKey(rest))).toBe(false);
    expect(t.flags.has(alertKey(longer))).toBe(true);
  });

  it('an extended rest alerts again after it had already ended', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 10_000 });
    t.alerts.arm(rest, TEXTS, OPTIONS);
    await t.run((clock) => clock.advance(10_000));
    t.alerts.arm({ ...rest, adjustMs: 15_000 }, TEXTS, OPTIONS);
    await t.run((clock) => clock.advance(15_000));
    expect(t.cues).toEqual(['restEnd', 'restEnd']);
  });

  it('is idempotent for the same end: no second "armed", options update in place', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 30_000 });
    t.alerts.arm(rest, TEXTS, OPTIONS);
    t.alerts.arm({ ...rest }, TEXTS, { ...OPTIONS, preAlert: true });
    await t.alerts.settled();
    await t.run((clock) => clock.advance(30_000));
    expect(t.types()).toEqual(['armed', 'pre-alert', 'end']);
  });

  it('after a reload: an ended rest gets a gentle cue once, an acknowledged one nothing', async () => {
    const t = setup();
    const ended = timer({ startedAtEpochMs: t.clock.wall() - 200_000 });
    t.alerts.arm(ended, TEXTS, OPTIONS);
    await t.alerts.settled();
    expect(t.cues).toEqual(['gentle']);
    expect(t.events.at(-1)).toMatchObject({ type: 'end', path: 'on-return', delayMs: 50_000 });
    const acknowledged = timer({
      id: 'timer-2',
      startedAtEpochMs: t.clock.wall() - 200_000,
      fired: { end: true },
    });
    t.alerts.arm(acknowledged, TEXTS, OPTIONS);
    await t.alerts.settled();
    expect(t.cues).toEqual(['gentle']);
  });
});

describe('races', () => {
  it('a timer disarmed while the hide step runs leaves no service-worker timer or notice', async () => {
    const t = setup();
    const rest = startedNow(t, { targetMs: 60_000 });
    t.alerts.arm(rest, TEXTS, OPTIONS);
    await t.alerts.settled();
    // The skip lands while the ARM_REST message is on its way.
    t.hooks.onArm = () => t.alerts.disarm(rest.id);
    t.lifecycle.set('hidden');
    await t.alerts.settled();
    expect(t.log).toContain(`arm ${alertKey(rest)}`);
    expect(t.sw.size).toBe(0);
    expect(t.openNotifications()).toBe(0);
    await t.run((clock) => clock.advance(120_000));
    expect(t.cues).toEqual([]);
    expect(t.flags.size).toBe(0);
  });
});

describe('session end, Labs keep-alive', () => {
  it('stopAll disarms everything, suspends audio and prunes old fired flags', async () => {
    const t = setup();
    t.alerts.arm(startedNow(t), TEXTS, OPTIONS);
    t.alerts.arm(startedNow(t, { id: 'timer-2', kind: 'transition' }), TEXTS, OPTIONS);
    t.alerts.stopAll();
    await t.run((clock) => clock.advance(200_000));
    expect(t.cues).toEqual([]);
    expect(t.log).toContain('suspend');
    expect(t.pruned).toEqual([24 * 60 * 60 * 1000]);
    expect(t.lifecycle.listeners()).toBe(0);
  });

  it('runs the audio keep-alive only while an armed timer has not fired (OQ-T3 = B)', async () => {
    const t = setup();
    t.alerts.arm(startedNow(t, { targetMs: 10_000 }), TEXTS, {
      ...OPTIONS,
      keepAlive: { gain: 0.001 },
    });
    await t.alerts.settled();
    expect(t.log).toEqual(['keep-alive on']);
    expect(t.events.at(-1)).toMatchObject({ type: 'keep-alive', playing: true });
    await t.run((clock) => clock.advance(10_000));
    expect(t.log).toEqual(['keep-alive on', 'keep-alive off']);
  });
});
