import { describe, expect, it } from 'vitest';

import { parseTempo, type Tempo } from '@powr/domain/session';

import { createLeadIn, LEAD_IN_VIBRATION } from './lead-in';
import {
  createMetronome,
  METRONOME_LIMIT_MS,
  METRONOME_START_DELAY_MS,
  TEMPO_VIBRATION,
  tempoRep,
  type MetronomeOptions,
} from './metronome';
import { fakeClock, fakeLifecycle } from './test-support';

const tempo = (text: string): Tempo => {
  const parsed = parseTempo(text);
  if (!parsed) throw new Error(`bad tempo ${text}`);
  return parsed;
};

describe('tempoRep (TMR-10)', () => {
  it('3-1-1-0: lower with two ticks, a pause, a lift; 5 s per rep', () => {
    expect(tempoRep(tempo('3-1-1-0'))).toEqual({
      repMs: 5000,
      beats: [
        { atMs: 0, phase: 'lower', cue: 'tempoLower', phaseStart: true },
        { atMs: 1000, phase: 'lower', cue: 'tempoTick', phaseStart: false },
        { atMs: 2000, phase: 'lower', cue: 'tempoTick', phaseStart: false },
        { atMs: 3000, phase: 'bottom', cue: 'tempoPause', phaseStart: true },
        { atMs: 4000, phase: 'lift', cue: 'tempoLift', phaseStart: true },
      ],
    });
  });

  it('2-0-X-0: no pauses, "X" lifts as fast as possible in one second', () => {
    expect(tempoRep(tempo('2-0-X-0'))).toEqual({
      repMs: 3000,
      beats: [
        { atMs: 0, phase: 'lower', cue: 'tempoLower', phaseStart: true },
        { atMs: 1000, phase: 'lower', cue: 'tempoTick', phaseStart: false },
        { atMs: 2000, phase: 'lift', cue: 'tempoLift', phaseStart: true },
      ],
    });
  });

  it('2-0-X-1 ends with a top pause; a tempo without duration has no beats', () => {
    expect(tempoRep(tempo('2-0-X-1'))?.beats.at(-1)).toEqual({
      atMs: 3000,
      phase: 'top',
      cue: 'tempoPause',
      phaseStart: true,
    });
    expect(tempoRep(tempo('0-0-0-0'))).toBeNull();
  });
});

function setup(options: Partial<MetronomeOptions> = {}) {
  const clock = fakeClock();
  const lifecycle = fakeLifecycle();
  const sounds: { cue: string; at: number; volume: number }[] = [];
  const cancelled: number[] = [];
  const vibrations: { pattern: readonly number[]; at: number }[] = [];
  const metronome = createMetronome({
    timers: clock.frames,
    now: clock.mono,
    lifecycle,
    output: {
      sound: (cue, volume, delayMs) => {
        const at = clock.mono() + delayMs;
        sounds.push({ cue, at, volume });
        return () => cancelled.push(at);
      },
      vibrate: (pattern) => vibrations.push({ pattern, at: clock.mono() }),
    },
  });
  const start = () =>
    metronome.start(tempo('3-1-1-0'), { sound: true, volume: 0.8, vibration: true, ...options });
  return { clock, lifecycle, sounds, cancelled, vibrations, metronome, start };
}

describe('metronome (TMR-10, fake clock)', () => {
  it('schedules every beat ahead on the audio clock, in time, and vibrates at phase starts', () => {
    const t = setup();
    const t0 = t.clock.mono();
    expect(t.start()).toBe(true);
    expect(t.metronome.state()).toEqual({ running: true, phase: null, rep: 0 });
    t.clock.advance(METRONOME_START_DELAY_MS + 10_000 + 100);
    const origin = t0 + METRONOME_START_DELAY_MS;
    // Two full repetitions of 3-1-1-0, each beat exactly on its second.
    expect(t.sounds.filter((sound) => sound.at < origin + 10_000)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((second) => ({
        cue: ['tempoLower', 'tempoTick', 'tempoTick', 'tempoPause', 'tempoLift'][second % 5],
        at: origin + second * 1000,
        volume: 0.8,
      })),
    );
    // Never more than the look-ahead window in advance.
    expect(Math.max(...t.sounds.map((sound) => sound.at))).toBeLessThan(t.clock.mono() + 1000);
    // Vibration only when a phase starts, with a pattern per phase.
    expect(t.vibrations.filter((entry) => entry.at < origin + 5000)).toEqual([
      { pattern: TEMPO_VIBRATION.lower, at: origin },
      { pattern: TEMPO_VIBRATION.bottom, at: origin + 3000 },
      { pattern: TEMPO_VIBRATION.lift, at: origin + 4000 },
    ]);
    expect(t.metronome.state()).toEqual({ running: true, phase: 'lower', rep: 3 });
  });

  it('reports phase changes only (no update per tick)', () => {
    const t = setup();
    const updates: string[] = [];
    t.metronome.subscribe(() => {
      const { running, phase, rep } = t.metronome.state();
      updates.push(running ? `${rep}:${phase}` : 'stopped');
    });
    t.start();
    t.clock.advance(METRONOME_START_DELAY_MS + 5000 + 100);
    expect(updates).toEqual(['0:null', '1:lower', '1:bottom', '1:lift', '2:lower']);
  });

  it('stop cancels the scheduled sounds and leaves no timeout behind (NFR-PERF-10)', () => {
    const t = setup();
    t.start();
    t.clock.advance(METRONOME_START_DELAY_MS + 900);
    const scheduledAhead = t.sounds.filter((sound) => sound.at > t.clock.mono()).length;
    expect(scheduledAhead).toBeGreaterThan(0);
    t.metronome.stop();
    expect(t.cancelled).toHaveLength(scheduledAhead);
    expect(t.clock.pending()).toBe(0);
    expect(t.lifecycle.listeners()).toBe(0);
    expect(t.metronome.state()).toEqual({ running: false, phase: null, rep: 0 });
    const heard = t.sounds.length;
    t.clock.advance(10_000);
    expect(t.sounds).toHaveLength(heard);
  });

  it('respects sound and vibration off', () => {
    const silent = setup({ sound: false });
    silent.start();
    silent.clock.advance(METRONOME_START_DELAY_MS + 5000);
    expect(silent.sounds).toEqual([]);
    expect(silent.vibrations.length).toBeGreaterThan(0);

    const still = setup({ vibration: false });
    still.start();
    still.clock.advance(METRONOME_START_DELAY_MS + 5000);
    expect(still.vibrations).toEqual([]);
    expect(still.sounds.length).toBeGreaterThan(0);
    // The visible phase still follows without vibration.
    expect(still.metronome.state().phase).not.toBeNull();
  });

  it('stops when the page is hidden and after the time limit, telling the screen why', () => {
    const t = setup();
    const reasons: string[] = [];
    t.metronome.onAutoStop((reason) => reasons.push(reason));
    t.start();
    t.clock.advance(2000);
    t.lifecycle.set('hidden');
    expect(t.metronome.state().running).toBe(false);
    expect(t.clock.pending()).toBe(0);

    t.lifecycle.set('visible');
    t.start();
    t.clock.advance(METRONOME_LIMIT_MS + METRONOME_START_DELAY_MS + 1000);
    expect(t.metronome.state().running).toBe(false);
    expect(t.clock.pending()).toBe(0);
    expect(reasons).toEqual(['hidden', 'limit']);

    // A stop the user asked for is not reported.
    t.start();
    t.metronome.stop();
    expect(reasons).toEqual(['hidden', 'limit']);
  });

  it('a restart replaces the running metronome; a tempo without duration does not start', () => {
    const t = setup();
    t.start();
    t.clock.advance(METRONOME_START_DELAY_MS + 100);
    t.start();
    expect(t.metronome.state()).toEqual({ running: true, phase: null, rep: 0 });
    expect(t.metronome.start(tempo('0-0-0-0'), { sound: true, volume: 1, vibration: true })).toBe(
      false,
    );
    expect(t.metronome.state().running).toBe(false);
    expect(t.clock.pending()).toBe(0);
  });
});

function leadInSetup() {
  const clock = fakeClock();
  const beeps: number[] = [];
  const vibrations: number[] = [];
  const leadIn = createLeadIn({
    timers: clock.frames,
    beep: () => beeps.push(clock.mono()),
    vibrate: (pattern) => {
      expect(pattern).toEqual(LEAD_IN_VIBRATION);
      vibrations.push(clock.mono());
    },
  });
  return { clock, beeps, vibrations, leadIn };
}

describe('lead-in (TMR-09, fake clock)', () => {
  it('counts 3, 2, 1 a second apart with a beep and a vibration each, then starts', () => {
    const t = leadInSetup();
    const t0 = t.clock.mono();
    const counts: (number | null)[] = [];
    t.leadIn.subscribe(() => counts.push(t.leadIn.count()));
    let done = 0;
    t.leadIn.start({ sound: true, volume: 0.8, vibration: true }, () => {
      done++;
      // The timer starts while the count is still shown (no gap without a control).
      expect(t.leadIn.count()).toBe(1);
    });
    expect(t.leadIn.count()).toBe(3);
    t.clock.advance(2999);
    expect(done).toBe(0);
    t.clock.advance(1);
    expect(done).toBe(1);
    expect(counts).toEqual([3, 2, 1, null]);
    expect(t.beeps).toEqual([t0, t0 + 1000, t0 + 2000]);
    expect(t.vibrations).toEqual(t.beeps);
    expect(t.clock.pending()).toBe(0);
  });

  it('cancel stops the count and never starts the timer; sound and vibration can be off', () => {
    const t = leadInSetup();
    let done = 0;
    t.leadIn.start({ sound: false, volume: 0.8, vibration: false }, () => done++);
    t.clock.advance(1500);
    t.leadIn.cancel();
    expect(t.leadIn.count()).toBeNull();
    t.clock.advance(5000);
    expect(done).toBe(0);
    expect(t.beeps).toEqual([]);
    expect(t.vibrations).toEqual([]);
    expect(t.clock.pending()).toBe(0);
  });
});
