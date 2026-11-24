import { computeDisplay, type TimerDisplay, type TimerState } from './timer';

/**
 * The timer clock (technical concept §8.8.1, TMR-04, NFR-REL-05). Nothing counts ticks: every
 * display is computed from the timer's timestamps and this clock.
 *
 * - **Anchoring.** On first use and on every resume the engine stores
 *   `anchor = { epochMs: Date.now(), mono: performance.now() }`; afterwards
 *   `now = anchor.epochMs + (performance.now() − anchor.mono)`. A device clock change while the
 *   page stays visible therefore does not move a running timer.
 * - **Clock jump.** When the wall clock and the monotonic clock disagree by more than 2 s since
 *   the anchor, the engine reports a `clock-jump` (diagnostics) and re-anchors its comparison
 *   baseline, so the jump is reported once and the display keeps its monotonic time.
 * - **Resume.** After the page was hidden, frozen or restored from the back/forward cache the
 *   device may have slept, and Android's monotonic clock does not advance in deep sleep. `resume()`
 *   therefore rebuilds the anchor from the wall clock, the same frame a reload uses (there is no
 *   anchor after a reload: `elapsed = Date.now() − startedAtEpochMs`, clamped to ≥ 0).
 */
export interface TimerEngine {
  /** Current time in the timer records' wall-clock frame, continuous while the page is alive. */
  now(): number;
  /** Rebuilds the anchor from the wall clock (visible again, `pageshow`, `resume`). */
  resume(): void;
  /** The display of `timer` now (or at a fixed `at`). */
  display(timer: TimerState | null, at?: number): TimerDisplay;
}

export interface TimerEngineOptions {
  readonly wall?: () => number;
  readonly mono?: () => number;
  readonly onClockJump?: (jump: { readonly deltaMs: number }) => void;
  readonly jumpThresholdMs?: number;
}

const CLOCK_JUMP_MS = 2000;

export function createTimerEngine(options: TimerEngineOptions = {}): TimerEngine {
  const wall = options.wall ?? (() => Date.now());
  const mono = options.mono ?? (() => performance.now());
  const threshold = options.jumpThresholdMs ?? CLOCK_JUMP_MS;
  /** `skewMs`: wall − engine time accepted at the last re-anchor (0 after a resume). */
  let anchor: { epochMs: number; mono: number; skewMs: number } | null = null;

  const engine: TimerEngine = {
    now() {
      const wallNow = wall();
      const monoNow = mono();
      if (!anchor) {
        anchor = { epochMs: wallNow, mono: monoNow, skewMs: 0 };
        return wallNow;
      }
      const engineNow = anchor.epochMs + (monoNow - anchor.mono);
      const drift = wallNow - engineNow - anchor.skewMs;
      if (Math.abs(drift) > threshold) {
        options.onClockJump?.({ deltaMs: Math.round(drift) });
        anchor = { epochMs: engineNow, mono: monoNow, skewMs: anchor.skewMs + drift };
      }
      return engineNow;
    },
    resume() {
      anchor = { epochMs: wall(), mono: mono(), skewMs: 0 };
    },
    display(timer, at) {
      return computeDisplay(timer, at ?? engine.now());
    },
  };
  return engine;
}
