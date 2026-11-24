import type { AudioPort, CueId } from '@powr/application';

/** Synthesized cues: no audio files, nothing to download or license (§8.8.2). */
const CUES: Record<CueId, { frequency: number; durationMs: number; repeat: number }> = {
  restEnd: { frequency: 880, durationMs: 180, repeat: 3 },
  preAlert: { frequency: 660, durationMs: 120, repeat: 1 },
};

let context: AudioContext | null = null;
let keepAlive: { oscillator: OscillatorNode; element: HTMLAudioElement } | null = null;

export const audio: AudioPort = {
  async unlock() {
    context ??= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  },

  play(cue, volume) {
    if (!context || context.state !== 'running') return;
    const { frequency, durationMs, repeat } = CUES[cue];
    for (let i = 0; i < repeat; i++) {
      const start = context.currentTime + (i * durationMs * 2) / 1000;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.01);
      gain.gain.linearRampToValueAtTime(0, start + durationMs / 1000);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + durationMs / 1000 + 0.02);
    }
  },

  // Variant E of spike S-1: a very quiet tone routed into an <audio> element through a
  // MediaStream (srcObject is not a URL, so the CSP media rules do not apply) plus a
  // Media Session entry. Whether Android keeps the page alive this way is what S-1 measures.
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
