import { describe, expect, it, vi } from 'vitest';

import { createTimerEngine } from './engine';
import { fakeClock, T0, timer } from './test-support';
import { alertKey, computeDisplay, timerEndsAt } from './timer';

const engineWith = (clock = fakeClock()) => {
  const onClockJump = vi.fn<(jump: { readonly deltaMs: number }) => void>();
  const engine = createTimerEngine({ wall: clock.wall, mono: clock.mono, onClockJump });
  return { clock, engine, onClockJump };
};

describe('timer display (§8.8.1, TMR-04)', () => {
  it('derives remaining, elapsed, phase and done from the timestamps', () => {
    const rest = timer({ targetMs: 150_000 });
    expect(computeDisplay(rest, T0 + 60_000)).toMatchObject({
      phase: 'running',
      done: false,
      elapsedMs: 60_000,
      remainingMs: 90_000,
      overMs: 0,
      progress: 0.4,
    });
    expect(computeDisplay(rest, T0 + 141_000)).toMatchObject({ phase: 'ending', done: false });
    expect(computeDisplay(rest, T0 + 192_000)).toMatchObject({
      phase: 'done',
      done: true,
      remainingMs: 0,
      overMs: 42_000,
      progress: 1,
    });
  });

  it('applies adjustments and clamps to ≥ 0 (a start in the future, a negative duration)', () => {
    expect(computeDisplay(timer({ adjustMs: 15_000 }), T0 + 150_000).remainingMs).toBe(15_000);
    expect(computeDisplay(timer(), T0 - 5000)).toMatchObject({
      elapsedMs: 0,
      remainingMs: 150_000,
    });
    expect(computeDisplay(timer({ targetMs: 10_000, adjustMs: -30_000 }), T0)).toMatchObject({
      durationMs: 0,
      done: true,
      progress: 1,
    });
  });

  it('counts up past the soft minimum (TMR-07)', () => {
    const countUp = timer({ mode: 'countup', targetMs: 90_000 });
    expect(computeDisplay(countUp, T0 + 85_000)).toMatchObject({ phase: 'running' });
    expect(computeDisplay(countUp, T0 + 120_000)).toMatchObject({
      phase: 'done',
      elapsedMs: 120_000,
      overMs: 30_000,
    });
  });

  it("uses the session core's soft minimum for a count-up, not the suggested rest (TMR-07)", () => {
    // M3a: targetMs is the suggested rest (2:00), softMinMs the gentle-cue point (90 s compound).
    const countUp = timer({ mode: 'countup', targetMs: 120_000, softMinMs: 90_000 });
    expect(timerEndsAt(countUp)).toBe(T0 + 90_000);
    expect(computeDisplay(countUp, T0 + 85_000)).toMatchObject({ phase: 'running' });
    expect(computeDisplay(countUp, T0 + 95_000)).toMatchObject({ phase: 'done', overMs: 5_000 });
    // A countdown ignores softMinMs.
    expect(timerEndsAt(timer({ softMinMs: 30_000 }))).toBe(T0 + 150_000);
  });

  it('keys an alert by the timer and its current end', () => {
    expect(alertKey(timer())).toBe(`timer-1@${T0 + 150_000}`);
    expect(alertKey(timer({ adjustMs: 15_000 }))).toBe(`timer-1@${T0 + 165_000}`);
    expect(timerEndsAt(timer({ adjustMs: -15_000 }))).toBe(T0 + 135_000);
  });
});

describe('timer engine: monotonic anchoring (§8.8.1)', () => {
  it('anchors at first use and then follows the monotonic clock', () => {
    const { clock, engine } = engineWith();
    clock.advance(5000);
    const anchoredAt = engine.now();
    expect(anchoredAt).toBe(clock.wall());
    clock.advance(60_000);
    expect(engine.now()).toBe(anchoredAt + 60_000);
    expect(engine.display(timer({ startedAtEpochMs: anchoredAt })).remainingMs).toBe(90_000);
  });

  it('keeps a visible timer still when the device clock changes, and reports the jump once', () => {
    const { clock, engine, onClockJump } = engineWith();
    const rest = timer({ startedAtEpochMs: clock.wall() });
    engine.now();
    clock.advance(30_000);
    clock.jumpWall(3_600_000);
    expect(engine.display(rest).remainingMs).toBe(120_000);
    expect(onClockJump).toHaveBeenCalledTimes(1);
    expect(onClockJump).toHaveBeenCalledWith({ deltaMs: 3_600_000 });
    clock.advance(1000);
    expect(engine.display(rest).remainingMs).toBe(119_000);
    clock.jumpWall(-7_200_000);
    expect(engine.display(rest).remainingMs).toBe(119_000);
    expect(onClockJump).toHaveBeenCalledTimes(2);
    expect(onClockJump).toHaveBeenLastCalledWith({ deltaMs: -7_200_000 });
  });

  it('ignores drift up to 2 s', () => {
    const { clock, engine, onClockJump } = engineWith();
    engine.now();
    clock.jumpWall(1500);
    engine.now();
    expect(onClockJump).not.toHaveBeenCalled();
  });

  it('re-anchors to the wall clock on resume: QS-03, 2:30 rest hidden 60 s in deep sleep → 1:30', () => {
    const { clock, engine, onClockJump } = engineWith();
    const rest = timer({ startedAtEpochMs: clock.wall(), targetMs: 150_000 });
    expect(engine.display(rest).remainingMs).toBe(150_000);
    clock.sleep(60_000);
    engine.resume();
    expect(engine.display(rest).remainingMs).toBe(90_000);
    expect(onClockJump).not.toHaveBeenCalled();
  });

  it('computes the display at a fixed instant without reading the clocks', () => {
    const wall = vi.fn<() => number>(() => T0);
    const engine = createTimerEngine({ wall, mono: () => 0 });
    expect(engine.display(timer(), T0 + 150_000).done).toBe(true);
    expect(wall).not.toHaveBeenCalled();
  });
});
