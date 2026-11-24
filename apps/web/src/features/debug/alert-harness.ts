import type {
  AlertScheduler,
  AudioPort,
  HapticsPort,
  NotificationPort,
  WakeLockPort,
} from '@powr/application';

/**
 * Scripted rest timers for spike S-1 (§8.8.5): which hidden-state alert paths fire on a real
 * device, and how late. Variant C is the production design; E is the audio keep-alive experiment.
 */
export type Variant = 'A' | 'B' | 'C' | 'D' | 'E';

export const VARIANTS: Record<
  Variant,
  { label: string; page: boolean; sw: boolean; restingNotice: boolean; keepAlive: boolean }
> = {
  A: {
    label: 'A: page timeout only',
    page: true,
    sw: false,
    restingNotice: false,
    keepAlive: false,
  },
  B: {
    label: 'B: service-worker timer only',
    page: false,
    sw: true,
    restingNotice: false,
    keepAlive: false,
  },
  C: {
    label: 'C: page + service worker (production)',
    page: true,
    sw: true,
    restingNotice: false,
    keepAlive: false,
  },
  D: {
    label: 'D: C + "resting until" notification',
    page: true,
    sw: true,
    restingNotice: true,
    keepAlive: false,
  },
  E: {
    label: 'E: C + audio keep-alive (experiment)',
    page: true,
    sw: true,
    restingNotice: false,
    keepAlive: true,
  },
};

type AlertPath = 'visible' | 'page-timeout' | 'sw-timer';

interface HarnessEvent {
  readonly at: number;
  readonly event: 'start' | 'hidden' | 'visible' | 'fired' | 'end' | 'stopped';
  readonly visibility: DocumentVisibilityState;
  readonly path?: AlertPath;
  readonly delayMs?: number;
  readonly detail?: string;
}

export interface HarnessRun {
  readonly runId: string;
  readonly variant: Variant;
  readonly device: string;
  readonly restMs: number;
  readonly startedAt: number;
  readonly endsAt: number;
  readonly settings: { wakeLock: boolean; notificationPermission: string; keepAliveGain: number };
  battery: { start: BatteryReading | null; end: BatteryReading | null };
  events: HarnessEvent[];
  firstAlert: { path: AlertPath; delayMs: number } | null;
  hiddenAtEnd: boolean | null;
  /** `interrupted`: the page was reloaded or killed during the run, itself an S-1 observation. */
  status: 'running' | 'done' | 'stopped' | 'interrupted';
  /** on-time: alerted within 2 s while hidden; late; missed: only noticed on return; visible: page was visible. */
  outcome: 'on-time' | 'late' | 'missed' | 'visible' | null;
}

interface BatteryReading {
  level: number;
  charging: boolean;
}

export interface HarnessPorts {
  readonly audio: AudioPort;
  readonly haptics: HapticsPort;
  readonly notifications: NotificationPort;
  readonly alerts: AlertScheduler;
  readonly wakeLock: WakeLockPort;
  readonly log: (data: Record<string, string | number | boolean | null>) => void;
}

export interface RunConfig {
  readonly variant: Variant;
  readonly restMs: number;
  readonly device: string;
  readonly holdWakeLock: boolean;
  readonly keepAliveGain: number;
}

const ON_TIME_MS = 2000;
const TICK_MS = 250;
const NOTIFICATION_URL = '/debug/alerts';

/** Starts one scripted rest. Must be called from a user gesture (audio unlock, vibration). */
export async function startRun(
  config: RunConfig,
  ports: HarnessPorts,
  onChange: (run: HarnessRun) => void,
): Promise<{ readonly stop: () => void }> {
  const variant = VARIANTS[config.variant];
  const startedAt = Date.now();
  const run: HarnessRun = {
    runId: `r${startedAt.toString(36)}`,
    variant: config.variant,
    device: config.device,
    restMs: config.restMs,
    startedAt,
    endsAt: startedAt + config.restMs,
    settings: {
      wakeLock: config.holdWakeLock,
      notificationPermission: ports.notifications.permission(),
      keepAliveGain: config.keepAliveGain,
    },
    battery: { start: null, end: null },
    events: [],
    firstAlert: null,
    hiddenAtEnd: null,
    status: 'running',
    outcome: null,
  };

  const publish = () => onChange(structuredClone(run));
  const record = (event: HarnessEvent['event'], extra: Partial<HarnessEvent> = {}) => {
    const entry: HarnessEvent = {
      at: Date.now(),
      event,
      visibility: document.visibilityState,
      ...extra,
    };
    run.events.push(entry);
    ports.log({
      runId: run.runId,
      variant: run.variant,
      event,
      path: extra.path ?? null,
      delayMs: extra.delayMs ?? null,
      visibility: entry.visibility,
      restMs: run.restMs,
      result: run.outcome,
    });
    publish();
  };

  let pageTimeout: ReturnType<typeof setTimeout> | null = null;
  let finished = false;

  const fire = async (path: AlertPath) => {
    if (run.firstAlert) return;
    if (!(await ports.alerts.claimFired(run.runId, 'page'))) return;
    const delayMs = Date.now() - run.endsAt;
    run.firstAlert = { path, delayMs };
    run.hiddenAtEnd ??= document.visibilityState === 'hidden';
    ports.audio.play('restEnd', 1);
    const vibrated = ports.haptics.vibrate([200, 100, 200]);
    let shown = false;
    if (path === 'page-timeout') {
      shown = await ports.notifications.show({
        title: 'Rest over',
        body: `Test rest (${run.variant}) finished`,
        tag: 'rest',
        url: NOTIFICATION_URL,
        renotify: true,
      });
    }
    run.outcome = classify(run);
    record('fired', { path, delayMs, detail: `vibrate=${vibrated} notification=${shown}` });
    if (document.visibilityState === 'visible') await finish('end');
  };

  const onVisibilityChange = () => void handleVisibility();
  const handleVisibility = async () => {
    if (document.visibilityState === 'hidden') {
      record('hidden');
      const remaining = run.endsAt - Date.now();
      if (variant.page)
        pageTimeout = setTimeout(() => void fire('page-timeout'), Math.max(0, remaining));
      if (variant.sw) {
        await ports.alerts.armRestEnd({
          timerId: run.runId,
          endsAtEpochMs: run.endsAt,
          title: 'Rest over',
          body: `Test rest (${run.variant}) finished (service worker)`,
          url: NOTIFICATION_URL,
        });
      }
      if (variant.restingNotice) {
        const until = new Date(run.endsAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        await ports.notifications.show({
          title: 'Resting',
          body: `Ends at ${until}`,
          tag: 'rest',
          url: NOTIFICATION_URL,
          silent: true,
        });
      }
      return;
    }
    // Visible again: disarm, then find out whether the service worker fired while we were away.
    if (pageTimeout) clearTimeout(pageTimeout);
    await ports.alerts.disarm(run.runId);
    const fired = await ports.alerts.firedBy(run.runId);
    if (fired?.by === 'sw' && !run.firstAlert) {
      run.firstAlert = { path: 'sw-timer', delayMs: fired.at - run.endsAt };
      run.hiddenAtEnd = true;
      run.outcome = classify(run);
      record('fired', { path: 'sw-timer', delayMs: fired.at - run.endsAt });
    }
    record('visible');
    await ports.notifications.closeByTag('rest');
    if (config.holdWakeLock) await ports.wakeLock.acquire();
    if (run.firstAlert) await finish('end');
  };

  const tick = setInterval(() => {
    if (Date.now() < run.endsAt) return;
    if (run.hiddenAtEnd === null) run.hiddenAtEnd = document.visibilityState === 'hidden';
    if (document.visibilityState === 'visible') void fire('visible');
  }, TICK_MS);

  const finish = async (event: 'end' | 'stopped') => {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    if (pageTimeout) clearTimeout(pageTimeout);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    await ports.alerts.disarm(run.runId);
    ports.audio.stopKeepAlive();
    await ports.wakeLock.release();
    run.battery.end = await readBattery();
    run.status = event === 'end' ? 'done' : 'stopped';
    record(event);
  };

  // Listen before the first await, so a screen lock right after the tap is not missed.
  document.addEventListener('visibilitychange', onVisibilityChange);
  record('start');
  await ports.audio.unlock();
  if (config.holdWakeLock)
    record('start', { detail: `wakeLock=${await ports.wakeLock.acquire()}` });
  if (variant.keepAlive) {
    const playing = await ports.audio.startKeepAlive({
      title: 'POWR rest timer (test)',
      gain: config.keepAliveGain,
    });
    record('start', { detail: `keepAlive=${playing}` });
  }
  run.battery.start = await readBattery();
  return { stop: () => void finish('stopped') };
}

function classify(run: HarnessRun): HarnessRun['outcome'] {
  if (!run.firstAlert) return null;
  if (!run.hiddenAtEnd) return 'visible';
  if (run.firstAlert.path === 'visible') return 'missed';
  return run.firstAlert.delayMs <= ON_TIME_MS ? 'on-time' : 'late';
}

async function readBattery(): Promise<BatteryReading | null> {
  const getBattery = (
    navigator as { getBattery?: () => Promise<{ level: number; charging: boolean }> }
  ).getBattery;
  if (!getBattery) return null;
  try {
    const battery = await getBattery.call(navigator);
    return { level: battery.level, charging: battery.charging };
  } catch {
    return null;
  }
}
