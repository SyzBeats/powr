/**
 * Labs flags (runtime, per device). OQ-T3 = B: the audio keep-alive (S-1 variant E) is an opt-in
 * Labs capability, **off and hidden by default**. There is no user-facing toggle until S-1 shows
 * that it clearly works; only the developer harness `/debug/alerts` (`?debug=1`) can switch it on
 * for this device, so the production timers can be measured with it over a real session.
 */
const AUDIO_KEEP_ALIVE = 'powr.labs.audioKeepAlive';

export interface LabsFlags {
  audioKeepAlive(): boolean;
  setAudioKeepAlive(on: boolean): void;
  /** Keep-alive gain: low enough to be inaudible, high enough not to count as silence. */
  readonly keepAliveGain: number;
}

export const labs: LabsFlags = {
  keepAliveGain: 0.001,
  audioKeepAlive() {
    try {
      return localStorage.getItem(AUDIO_KEEP_ALIVE) === '1';
    } catch {
      return false;
    }
  },
  setAudioKeepAlive(on) {
    try {
      if (on) localStorage.setItem(AUDIO_KEEP_ALIVE, '1');
      else localStorage.removeItem(AUDIO_KEEP_ALIVE);
    } catch {
      // Private mode or quota: the flag stays off.
    }
  },
};
