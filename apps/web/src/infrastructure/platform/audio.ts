import type { AudioPort, CueId } from '@powr/application';

/**
 * Alert sounds (§8.8.2, TMR-05, PWA-07, MOT-02), synthesized with Web Audio: no audio files, so
 * nothing to download or license. `restEnd` and `preAlert` are the application port's cues; the
 * rest are the web app's own: one 3-2-1 `countdown` beep, a `gentle` two-note cue (count-up soft
 * minimum, "Rest over" noticed on return) and the PR `pr` arpeggio.
 */
export type AlertCue = CueId | 'countdown' | 'gentle' | 'pr';

export interface AlertAudio extends AudioPort {
  /** Plays a cue at `volume` (0–1, the in-app volume, applied as gain). */
  play(cue: AlertCue, volume: number): void;
  /** Suspends the audio context when the session ends (§8.8.6). */
  suspend(): Promise<void>;
}

interface Note {
  readonly frequency: number;
  readonly startMs: number;
  readonly durationMs: number;
  /** Relative to the cue's volume. */
  readonly level?: number;
  readonly type?: OscillatorType;
}

const beeps = (frequency: number, durationMs: number, count: number): readonly Note[] =>
  Array.from({ length: count }, (_, i) => ({ frequency, startMs: i * durationMs * 2, durationMs }));

const CUES: Record<AlertCue, readonly Note[]> = {
  restEnd: beeps(880, 180, 3),
  preAlert: beeps(660, 120, 1),
  countdown: beeps(660, 90, 1),
  gentle: [
    { frequency: 523.25, startMs: 0, durationMs: 160, level: 0.6, type: 'triangle' },
    { frequency: 659.25, startMs: 170, durationMs: 220, level: 0.6, type: 'triangle' },
  ],
  pr: [
    { frequency: 523.25, startMs: 0, durationMs: 110, type: 'triangle' },
    { frequency: 659.25, startMs: 100, durationMs: 110, type: 'triangle' },
    { frequency: 783.99, startMs: 200, durationMs: 110, type: 'triangle' },
    { frequency: 1046.5, startMs: 300, durationMs: 320, type: 'triangle' },
  ],
};

/** Attack and release of every note, so beeps do not click. */
const RAMP_S = 0.01;
const UNLOCK_WAIT_MS = 500;

let context: AudioContext | null = null;
let keepAlive: { oscillator: OscillatorNode; element: HTMLAudioElement } | null = null;

export const audio: AlertAudio = {
  /**
   * Creates and resumes the audio context. Call it in a user gesture (the "Start session" tap):
   * the autoplay policy only lets a context start after user activation (§8.8.2).
   */
  async unlock() {
    if (!('AudioContext' in globalThis)) return false;
    context ??= new AudioContext();
    if (context.state !== 'running') {
      // Without user activation `resume()` stays pending until the next gesture: do not wait.
      await Promise.race([
        context.resume().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, UNLOCK_WAIT_MS)),
      ]);
    }
    return context.state === 'running';
  },

  play(cue, volume) {
    if (!context || context.state !== 'running') return;
    const gainLevel = Math.min(1, Math.max(0, volume));
    if (gainLevel === 0) return;
    const base = context.currentTime;
    for (const note of CUES[cue]) {
      const start = base + note.startMs / 1000;
      const end = start + note.durationMs / 1000;
      const peak = gainLevel * (note.level ?? 1);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = note.type ?? 'sine';
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + RAMP_S);
      gain.gain.setValueAtTime(peak, Math.max(start + RAMP_S, end - RAMP_S));
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  },

  async suspend() {
    if (context?.state === 'running') await context.suspend().catch(() => undefined);
  },

  // Variant E of spike S-1 (OQ-T3 = B, Labs only): a very quiet tone routed into an <audio>
  // element through a MediaStream (srcObject is not a URL, so neither the CSP media rules nor
  // Trusted Types apply) plus a Media Session entry. Whether Android keeps the page alive this
  // way is what S-1 measures.
  async startKeepAlive({ title, gain }) {
    if (keepAlive) return true;
    if (!(await this.unlock()) || !context) return false;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const destination = context.createMediaStreamDestination();
    oscillator.frequency.value = 440;
    volume.gain.value = gain;
    oscillator.connect(volume).connect(destination);
    oscillator.start();
    const element = new Audio();
    element.srcObject = destination.stream;
    try {
      await element.play();
    } catch {
      oscillator.stop();
      return false;
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'POWR' });
      navigator.mediaSession.playbackState = 'playing';
    }
    keepAlive = { oscillator, element };
    return true;
  },

  stopKeepAlive() {
    if (!keepAlive) return;
    keepAlive.oscillator.stop();
    keepAlive.element.pause();
    keepAlive.element.srcObject = null;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
    keepAlive = null;
  },
};
