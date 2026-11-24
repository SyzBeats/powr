/**
 * The timer contract shared with the session core (technical concept §8.8.1, TMR-04):
 * `TimerState` of `@powr/domain` (M3a). M3a stores one per running timer in the session record;
 * its reducer emits effects that carry a whole `TimerState` (arm, re-arm after an adjust, disarm
 * by `id`).
 */
import type { TimerState } from '@powr/domain';

export type { TimerState };

/**
 * What a timer shows at one instant. `idle` without a timer; a countdown is `ending` in its last
 * 10 seconds and `done` at its end; a count-up is `done` once it reaches its soft minimum and keeps
 * counting.
 */
export type TimerPhase = 'idle' | 'running' | 'ending' | 'done';

export interface TimerDisplay {
  readonly timerId: string | null;
  readonly mode: TimerState['mode'];
  readonly phase: TimerPhase;
  readonly done: boolean;
  /** Time since the start, clamped to ≥ 0 (a start "in the future" after a clock change). */
  readonly elapsedMs: number;
  /** Time left until the end (countdown) or the soft minimum (count-up), ≥ 0. */
  readonly remainingMs: number;
  /** Time since the end or the soft minimum, ≥ 0 ("Rest over · +0:42", TMR-04). */
  readonly overMs: number;
  /** `targetMs + adjustMs`, ≥ 0. */
  readonly durationMs: number;
  /** 0 at the start, 1 at the end. */
  readonly progress: number;
}

/** The last stretch of a countdown, also the pre-alert time (TMR-05, SET-03). */
export const ENDING_MS = 10_000;

export const IDLE_DISPLAY: TimerDisplay = {
  timerId: null,
  mode: 'countdown',
  phase: 'idle',
  done: false,
  elapsedMs: 0,
  remainingMs: 0,
  overMs: 0,
  durationMs: 0,
  progress: 0,
};

/**
 * Countdown: target plus adjustments. Count-up: the soft minimum after which the gentle cue fires
 * (TMR-07: 60 s isolation / 90 s compound, M3a's `softMinMs`); without one, the suggested rest.
 */
function timerDurationMs(timer: TimerState): number {
  const base =
    timer.mode === 'countup' && timer.softMinMs !== undefined ? timer.softMinMs : timer.targetMs;
  return Math.max(0, base + timer.adjustMs);
}

/** End of a countdown (or the count-up's soft minimum) in the record's wall-clock frame. */
export function timerEndsAt(timer: TimerState): number {
  return timer.startedAtEpochMs + timerDurationMs(timer);
}

/**
 * The identity of one alert: the timer plus its current end. An adjust (TMR-03) gives a new key,
 * so a rest extended after it fired alerts again at the new end, and the page and the service
 * worker dedupe on exactly the end they were armed for (§8.8.4).
 */
export function alertKey(timer: TimerState): string {
  return `${timer.id}@${timerEndsAt(timer)}`;
}

/** Pure display computation: `nowEpochMs` comes from the timer engine (monotonic-anchored). */
export function computeDisplay(timer: TimerState | null, nowEpochMs: number): TimerDisplay {
  if (!timer) return IDLE_DISPLAY;
  const durationMs = timerDurationMs(timer);
  const elapsedMs = Math.max(0, nowEpochMs - timer.startedAtEpochMs);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const overMs = Math.max(0, elapsedMs - durationMs);
  const done = elapsedMs >= durationMs;
  const phase: TimerPhase = done
    ? 'done'
    : timer.mode === 'countdown' && remainingMs <= ENDING_MS
      ? 'ending'
      : 'running';
  return {
    timerId: timer.id,
    mode: timer.mode,
    phase,
    done,
    elapsedMs,
    remainingMs,
    overMs,
    durationMs,
    progress: durationMs === 0 ? 1 : Math.min(1, elapsedMs / durationMs),
  };
}
