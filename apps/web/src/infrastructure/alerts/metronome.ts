import type { Tempo } from '@powr/domain/session';

import type { AlertCue } from '../platform/audio';
import type { PageLifecycle, TimerFunctions } from './lifecycle';

/*
 * The tempo metronome (TMR-10, TD-39; M4v). A tempo such as 3-1-1-0 (eccentric, bottom pause,
 * concentric, top pause; "X" = maximal intent) becomes one repetition of beats: a cue when each
 * phase starts (low when lowering, high when lifting, a short one at a pause) and a soft tick on
 * every further whole second of a phase. Beats are scheduled a little ahead on the audio clock,
 * so they keep time even when a timeout runs late; vibration (at phase starts only) follows a
 * timeout. Nothing runs while it is stopped (NFR-PERF-10), and it stops when the page is hidden.
 */

export type TempoPhase = 'lower' | 'bottom' | 'lift' | 'top';
export type TempoCue = Extract<AlertCue, 'tempoLower' | 'tempoPause' | 'tempoLift' | 'tempoTick'>;

export interface TempoBeat {
  /** From the start of the repetition. */
  readonly atMs: number;
  readonly phase: TempoPhase;
  readonly cue: TempoCue;
  /** The first beat of its phase (vibration and the visible phase change only here). */
  readonly phaseStart: boolean;
}

export interface TempoRep {
  readonly beats: readonly TempoBeat[];
  readonly repMs: number;
}

const SECOND = 1000;

/** The beats of one repetition, or null for a tempo without any duration (0-0-0-0). */
export function tempoRep(tempo: Tempo): TempoRep | null {
  const phases: readonly { phase: TempoPhase; seconds: number; cue: TempoCue }[] = [
    { phase: 'lower', seconds: tempo.eccentricS, cue: 'tempoLower' },
    { phase: 'bottom', seconds: tempo.bottomS, cue: 'tempoPause' },
    // "X": as fast as possible; one second of the rep (as in the rep-duration guardrail).
    { phase: 'lift', seconds: tempo.concentricS ?? 1, cue: 'tempoLift' },
    { phase: 'top', seconds: tempo.topS, cue: 'tempoPause' },
  ];
  const beats: TempoBeat[] = [];
  let atMs = 0;
  for (const { phase, seconds, cue } of phases) {
    if (!(seconds > 0)) continue;
    beats.push({ atMs, phase, cue, phaseStart: true });
    for (let second = 1; second < seconds; second++)
      beats.push({ atMs: atMs + second * SECOND, phase, cue: 'tempoTick', phaseStart: false });
    atMs += seconds * SECOND;
  }
  return atMs > 0 ? { beats, repMs: atMs } : null;
}

/** Vibration at each phase start: short at a pause, longer when lifting (felt apart). */
export const TEMPO_VIBRATION: Readonly<Record<TempoPhase, readonly number[]>> = {
  lower: [40],
  bottom: [15],
  lift: [80],
  top: [15],
};

/** The first beat comes a moment after the tap, so the audio context is running and no cue is clipped. */
export const METRONOME_START_DELAY_MS = 600;
/** How far ahead beats are handed to the audio clock, and how often that window moves on. */
const LOOKAHEAD_MS = 450;
const SCHEDULE_EVERY_MS = 200;
/** A forgotten metronome stops by itself (no set is this long). */
export const METRONOME_LIMIT_MS = 5 * 60 * SECOND;

export interface MetronomeOptions {
  readonly sound: boolean;
  /** 0–1, the alert volume. */
  readonly volume: number;
  readonly vibration: boolean;
}

export type MetronomeStopReason = 'user' | 'hidden' | 'limit';

export interface MetronomeState {
  readonly running: boolean;
  /** The phase of the latest beat, null before the first one. */
  readonly phase: TempoPhase | null;
  /** Repetitions begun, counting from 1 (0 before the first beat). */
  readonly rep: number;
}

export interface Metronome {
  /** Starts (or restarts) with a tempo; false for a tempo without duration. */
  readonly start: (tempo: Tempo, options: MetronomeOptions) => boolean;
  readonly stop: (reason?: MetronomeStopReason) => void;
  readonly state: () => MetronomeState;
  /** `useSyncExternalStore`: called on start, stop and each phase change (never per tick). */
  readonly subscribe: (listener: () => void) => () => void;
  /** Called once per stop that the user did not ask for (hidden page, the time limit). */
  readonly onAutoStop: (
    listener: (reason: Exclude<MetronomeStopReason, 'user'>) => void,
  ) => () => void;
}

export interface MetronomeOutput {
  /** Plays a cue `delayMs` from now on the audio clock; returns a canceller. */
  readonly sound: (cue: TempoCue, volume: number, delayMs: number) => () => void;
  readonly vibrate: (pattern: readonly number[]) => void;
}

const IDLE: MetronomeState = { running: false, phase: null, rep: 0 };

export function createMetronome(deps: {
  readonly timers: TimerFunctions;
  /** Monotonic milliseconds (performance.now). */
  readonly now: () => number;
  readonly lifecycle: PageLifecycle;
  readonly output: MetronomeOutput;
}): Metronome {
  const listeners = new Set<() => void>();
  const autoStopListeners = new Set<(reason: Exclude<MetronomeStopReason, 'user'>) => void>();
  let current: MetronomeState = IDLE;
  let run: {
    readonly rep: TempoRep;
    readonly options: MetronomeOptions;
    readonly origin: number;
    next: number;
    loop: number | null;
    /** Scheduled sounds and timeouts that have not happened yet, to cancel on stop. */
    pending: { at: number; cancel: () => void }[];
    unlisten: () => void;
  } | null = null;

  const emit = (state: MetronomeState) => {
    current = state;
    for (const listener of listeners) listener();
  };

  const later = (delayMs: number, task: () => void): (() => void) => {
    const handle = deps.timers.setTimeout(task, Math.max(0, delayMs));
    return () => deps.timers.clearTimeout(handle);
  };

  const schedule = () => {
    if (!run) return;
    const active = run;
    const now = deps.now();
    if (now - active.origin >= METRONOME_LIMIT_MS) {
      stop('limit');
      return;
    }
    active.pending = active.pending.filter((entry) => entry.at > now);
    const horizon = now + LOOKAHEAD_MS;
    const { beats, repMs } = active.rep;
    for (;;) {
      const index = active.next;
      const beat = beats[index % beats.length]!;
      const repIndex = Math.floor(index / beats.length);
      const at = active.origin + repIndex * repMs + beat.atMs;
      if (at >= horizon) break;
      active.next = index + 1;
      const delay = at - now;
      if (active.options.sound)
        active.pending.push({
          at,
          cancel: deps.output.sound(beat.cue, active.options.volume, Math.max(0, delay)),
        });
      if (beat.phaseStart) {
        const pattern = TEMPO_VIBRATION[beat.phase];
        const phase = beat.phase;
        active.pending.push({
          at,
          cancel: later(delay, () => {
            if (run !== active) return;
            if (active.options.vibration) deps.output.vibrate(pattern);
            emit({ running: true, phase, rep: repIndex + 1 });
          }),
        });
      }
    }
    active.loop = deps.timers.setTimeout(schedule, SCHEDULE_EVERY_MS);
  };

  function stop(reason: MetronomeStopReason = 'user') {
    if (!run) return;
    const ended = run;
    run = null;
    if (ended.loop !== null) deps.timers.clearTimeout(ended.loop);
    for (const entry of ended.pending) entry.cancel();
    ended.unlisten();
    emit(IDLE);
    if (reason !== 'user') for (const listener of autoStopListeners) listener(reason);
  }

  return {
    start(tempo, options) {
      stop();
      const rep = tempoRep(tempo);
      if (!rep) return false;
      run = {
        rep,
        options,
        origin: deps.now() + METRONOME_START_DELAY_MS,
        next: 0,
        loop: null,
        pending: [],
        unlisten: deps.lifecycle.listen((state) => {
          if (state === 'hidden') stop('hidden');
        }),
      };
      emit({ running: true, phase: null, rep: 0 });
      schedule();
      return true;
    },
    stop,
    state: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onAutoStop(listener) {
      autoStopListeners.add(listener);
      return () => autoStopListeners.delete(listener);
    },
  };
}
