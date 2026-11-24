import { describe, expect, it, vi } from 'vitest';

import { createTimerEngine } from './engine';
import { fakeClock, fakeLifecycle, timer } from './test-support';
import { createDisplayStore, createTicker } from './ticker';

const setup = (initial: 'visible' | 'hidden' = 'visible') => {
  const clock = fakeClock();
  const lifecycle = fakeLifecycle(initial);
  const engine = createTimerEngine({ wall: clock.wall, mono: clock.mono });
  const resume = vi.spyOn(engine, 'resume');
  const ticker = createTicker({ engine, lifecycle, frames: clock.frames });
  return { clock, lifecycle, engine, ticker, resume };
};

describe('display ticker (§8.8.1, NFR-PERF-10)', () => {
  it('ticks 4 times a second, each on an animation frame, without drift', () => {
    const { clock, ticker } = setup();
    const listener = vi.fn<() => void>();
    ticker.subscribe(listener);
    clock.advance(10_016);
    expect(listener).toHaveBeenCalledTimes(40);
  });

  it('does nothing while hidden and stops when nobody listens', () => {
    const { clock, lifecycle, ticker } = setup();
    const listener = vi.fn<() => void>();
    const unsubscribe = ticker.subscribe(listener);
    clock.advance(1016);
    lifecycle.set('hidden');
    listener.mockClear();
    clock.advance(60_000);
    expect(listener).not.toHaveBeenCalled();
    expect(clock.pending()).toBe(0);
    unsubscribe();
    expect(lifecycle.listeners()).toBe(0);
  });

  it('recomputes at once on visible, pageshow and resume, after re-anchoring the engine', () => {
    const { clock, lifecycle, ticker, resume } = setup('hidden');
    const listener = vi.fn<() => void>();
    ticker.subscribe(listener);
    expect(clock.pending()).toBe(0);
    lifecycle.set('visible');
    expect(resume).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    lifecycle.show();
    expect(resume).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(2);
    clock.advance(266);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('feeds a display store that changes only when the display does', () => {
    const { clock, engine, ticker } = setup();
    const rest = timer({ startedAtEpochMs: clock.wall(), targetMs: 150_000 });
    const store = createDisplayStore(engine, ticker, rest);
    const onChange = vi.fn<() => void>();
    store.subscribe(onChange);
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    expect(first.remainingMs).toBe(150_000);
    clock.advance(1016);
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(store.getSnapshot().remainingMs).toBe(150_000 - 1016);
  });

  it('QS-03: a 2:30 rest hidden for 60 s shows 1:30 as soon as it is visible again', () => {
    const { clock, lifecycle, engine, ticker } = setup();
    const rest = timer({ startedAtEpochMs: clock.wall(), targetMs: 150_000 });
    const store = createDisplayStore(engine, ticker, rest);
    store.subscribe(() => undefined);
    store.getSnapshot();
    lifecycle.set('hidden');
    clock.sleep(60_000);
    lifecycle.set('visible');
    expect(store.getSnapshot().remainingMs).toBe(90_000);
  });

  it('freezes the display at a fixed instant (no subscription)', () => {
    const { clock, engine, ticker } = setup();
    const rest = timer({ startedAtEpochMs: clock.wall() });
    const store = createDisplayStore(engine, ticker, rest, clock.wall() + 60_000);
    store.subscribe(() => undefined);
    expect(store.getSnapshot().remainingMs).toBe(90_000);
    expect(clock.pending()).toBe(0);
  });
});
