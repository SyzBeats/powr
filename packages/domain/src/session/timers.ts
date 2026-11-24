/**
 * Timer arithmetic (TMR-03/04/07/09/11/13; technical concept §8.8.1). A timer is data in the
 * session record; its state at any moment follows from timestamps, never from ticks. The
 * functions here take the current epoch ms as an argument and clamp every duration at zero, so a
 * device clock set backwards or a reload long after the end never shows a negative time.
 */
import type { Session, TimerKind, TimerState } from '../model';

/** TMR-03: one tap adds or removes 15 s. */
export const TIMER_STEP_MS = 15_000;

/** The end of a countdown (for count-up: the suggested rest). */
export function timerEndEpochMs(timer: TimerState): number {
  return timer.startedAtEpochMs + timer.targetMs + timer.adjustMs;
}

export interface TimerView {
  readonly elapsedMs: number;
  /** Countdown: time left (0 once ended); count-up: time to the suggested rest. */
  readonly remainingMs: number;
  /** Time past the end ("Rest over · +0:42", TMR-04). */
  readonly overMs: number;
  readonly ended: boolean;
  /** Count-up: the soft minimum has passed (TMR-07). */
  readonly softMinReached: boolean;
}

/** The timer at `nowEpochMs`; every value is ≥ 0. */
export function timerView(timer: TimerState, nowEpochMs: number): TimerView {
  const elapsedMs = Math.max(0, nowEpochMs - timer.startedAtEpochMs);
  const durationMs = Math.max(0, timer.targetMs + timer.adjustMs);
  return {
    elapsedMs,
    remainingMs: Math.max(0, durationMs - elapsedMs),
    overMs: Math.max(0, elapsedMs - durationMs),
    ended: elapsedMs >= durationMs,
    softMinReached: timer.softMinMs !== undefined && elapsedMs >= timer.softMinMs,
  };
}

export function newTimer(input: {
  readonly id: string;
  readonly kind: TimerKind;
  readonly mode: TimerState['mode'];
  readonly nowEpochMs: number;
  readonly targetMs: number;
  readonly softMinMs?: number;
  readonly slotKey?: string;
}): TimerState {
  return {
    id: input.id,
    kind: input.kind,
    mode: input.mode,
    startedAtEpochMs: input.nowEpochMs,
    targetMs: Math.max(0, Math.round(input.targetMs)),
    adjustMs: 0,
    fired: {},
    ...(input.softMinMs === undefined ? {} : { softMinMs: Math.max(0, input.softMinMs) }),
    ...(input.slotKey === undefined ? {} : { slotKey: input.slotKey }),
  };
}

/**
 * TMR-03: ± time. The total never goes below zero; when the end moves past `now` again, the
 * fired flags are cleared so the alerts fire for the new end.
 */
export function adjustTimer(timer: TimerState, deltaMs: number, nowEpochMs: number): TimerState {
  const adjustMs = Math.max(-timer.targetMs, timer.adjustMs + Math.round(deltaMs));
  const next = { ...timer, adjustMs };
  return timerEndEpochMs(next) > nowEpochMs ? { ...next, fired: {} } : next;
}

/** TMR-03 restart: the same timer from now. */
export function restartTimer(timer: TimerState, nowEpochMs: number): TimerState {
  return { ...timer, startedAtEpochMs: nowEpochMs, adjustMs: 0, fired: {} };
}

/** TMR-11: the session clock, now − start (≥ 0). */
export function sessionElapsedMs(session: Pick<Session, 'startedAt'>, nowEpochMs: number): number {
  return Math.max(0, nowEpochMs - session.startedAt.epochMs);
}

/** WKT-14: a session open this long prompts "Finish session at last logged set?". */
export const STALE_SESSION_MS = 6 * 60 * 60 * 1000;

/** WKT-12: how long an undo token stays valid (the UI offers it for at least 10 s). */
export const UNDO_TTL_MS = 30_000;

export interface Tempo {
  readonly eccentricS: number;
  readonly bottomS: number;
  /** null: "X", maximal intent (counted as 1 s for durations). */
  readonly concentricS: number | null;
  readonly topS: number;
}

/** TMR-10: "2-0-X-0" → phases in seconds; null for anything else. */
export function parseTempo(tempo: string): Tempo | null {
  const match = /^(\d+)-(\d+)-(\d+|X)-(\d+)$/i.exec(tempo.trim());
  if (!match) return null;
  return {
    eccentricS: Number(match[1]),
    bottomS: Number(match[2]),
    concentricS: match[3]!.toUpperCase() === 'X' ? null : Number(match[3]),
    topS: Number(match[4]),
  };
}

/** Seconds per rep of a tempo ("X" counts as 1 s). */
export function tempoRepSeconds(tempo: Tempo): number {
  return tempo.eccentricS + tempo.bottomS + (tempo.concentricS ?? 1) + tempo.topS;
}
