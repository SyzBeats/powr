import type { AlertEvent, AlertOptions, AlertPath, TimerState } from '../../hooks/use-timers';

/**
 * Spike S-1 (technical concept §8.8.5, V-01): scripted rests on the **production** alert
 * scheduler, so a device run measures the real code paths (page timeout, service-worker timer,
 * notifications, the Labs audio keep-alive). A variant only chooses which hidden-state paths the
 * scheduler arms: C is the production design, D adds the "resting until" notification (the
 * production default when notifications are allowed), E adds the audio keep-alive (OQ-T3 = B).
 */
export type Variant = 'A' | 'B' | 'C' | 'D' | 'E';

export const VARIANTS: Record<
  Variant,
  {
    readonly label: string;
    readonly page: boolean;
    readonly sw: boolean;
    readonly restingNotice: boolean;
    readonly keepAlive: boolean;
  }
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
    label: 'E: C + audio keep-alive (Labs experiment)',
    page: true,
    sw: true,
    restingNotice: false,
    keepAlive: true,
  },
};

/** What the tester does after starting a run (S-1 conditions). */
export type Condition = 'locked' | 'switched' | 'visible';

export const CONDITIONS: Record<Condition, string> = {
  locked: 'Screen locked (power button)',
  switched: 'App switched (home button)',
  visible: 'Stayed on screen',
};

interface HarnessEvent {
  readonly at: number;
  readonly event:
    | 'start'
    | 'hidden'
    | 'visible'
    | 'fired'
    | 'wake-lock'
    | 'end'
    | 'stopped'
    | 'keep-alive';
  readonly visibility: DocumentVisibilityState;
  readonly path?: AlertPath;
  readonly delayMs?: number;
  readonly detail?: string;
}

export interface HarnessRun {
  readonly runId: string;
  /** The scheduler's alert key (`fired:<key>` in powr-runtime). */
  readonly key: string;
  readonly variant: Variant;
  readonly device: string;
  readonly condition: Condition;
  readonly batterySaver: boolean;
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
  /**
   * on-time: alerted within 2 s while hidden; late; missed: nothing alerted, noticed on return;
   * visible: the page was on screen at the end (no hidden-state measurement).
   */
  outcome: 'on-time' | 'late' | 'missed' | 'visible' | null;
}

export interface BatteryReading {
  readonly level: number;
  readonly charging: boolean;
}

export interface RunConfig {
  readonly variant: Variant;
  readonly restMs: number;
  readonly device: string;
  readonly condition: Condition;
  readonly batterySaver: boolean;
  readonly holdWakeLock: boolean;
  readonly keepAliveGain: number;
}

const ON_TIME_MS = 2000;
const HARNESS_URL = '/debug/alerts';

export function newRun(
  config: RunConfig,
  now: number,
  notificationPermission: string,
): { run: HarnessRun; timer: TimerState } {
  const runId = `r${now.toString(36)}`;
  const timer: TimerState = {
    id: runId,
    kind: 'rest',
    mode: 'countdown',
    startedAtEpochMs: now,
    targetMs: config.restMs,
    adjustMs: 0,
    fired: {},
  };
  const run: HarnessRun = {
    runId,
    key: `${runId}@${now + config.restMs}`,
    variant: config.variant,
    device: config.device,
    condition: config.condition,
    batterySaver: config.batterySaver,
    restMs: config.restMs,
    startedAt: now,
    endsAt: now + config.restMs,
    settings: {
      wakeLock: config.holdWakeLock,
      notificationPermission,
      keepAliveGain: config.keepAliveGain,
    },
    battery: { start: null, end: null },
    events: [],
    firstAlert: null,
    hiddenAtEnd: null,
    status: 'running',
    outcome: null,
  };
  return { run, timer };
}

/** The scheduler options of a variant: only the alert itself, no pre-alert or 3-2-1. */
export function optionsFor(config: RunConfig): AlertOptions {
  const variant = VARIANTS[config.variant];
  return {
    sound: true,
    volume: 1,
    vibration: true,
    preAlert: false,
    countdown: false,
    restingNotice: variant.restingNotice,
    keepAlive: variant.keepAlive ? { gain: config.keepAliveGain } : false,
    paths: { page: variant.page, serviceWorker: variant.sw },
    url: HARNESS_URL,
  };
}

/** Records one scheduler event in the run; returns whether the run is complete. */
export function applyEvent(
  run: HarnessRun,
  event: AlertEvent,
  at: number,
  visibility: DocumentVisibilityState,
): boolean {
  const push = (entry: Omit<HarnessEvent, 'at' | 'visibility'>) =>
    run.events.push({ at, visibility, ...entry });
  switch (event.type) {
    case 'armed':
      push({ event: 'start', detail: `remainingMs=${Math.round(event.remainingMs)}` });
      return false;
    case 'hidden':
      push({ event: 'hidden', detail: `paths=${event.paths.join('+') || 'none'}` });
      return false;
    case 'end':
      if (!run.firstAlert) {
        run.firstAlert = { path: event.path, delayMs: Math.round(event.delayMs) };
        run.hiddenAtEnd = event.hidden;
        run.outcome = classify(run);
      }
      push({ event: 'fired', path: event.path, delayMs: Math.round(event.delayMs) });
      return event.path === 'visible';
    case 'visible':
      push({
        event: 'visible',
        detail: `endedWhileHidden=${event.endedWhileHidden} overMs=${Math.round(event.overMs)}`,
      });
      return run.firstAlert !== null;
    case 'keep-alive':
      push({ event: 'keep-alive', detail: `playing=${event.playing}` });
      return false;
    default:
      return false;
  }
}

function classify(run: HarnessRun): HarnessRun['outcome'] {
  if (!run.firstAlert) return null;
  if (!run.hiddenAtEnd) return 'visible';
  if (run.firstAlert.path === 'on-return') return 'missed';
  return run.firstAlert.delayMs <= ON_TIME_MS ? 'on-time' : 'late';
}

/** For an interrupted run, the service worker (or the page before the kill) may have fired. */
export function completeInterrupted(
  run: HarnessRun,
  fired: { readonly by: 'page' | 'sw'; readonly at: number } | undefined,
): HarnessRun {
  if (run.status !== 'interrupted' || run.firstAlert || !fired) return run;
  const next: HarnessRun = {
    ...run,
    firstAlert: {
      path: fired.by === 'sw' ? 'sw-timer' : 'page-timeout',
      delayMs: Math.max(0, fired.at - run.endsAt),
    },
    hiddenAtEnd: true,
  };
  return { ...next, outcome: classify(next) };
}

export async function readBattery(): Promise<BatteryReading | null> {
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
