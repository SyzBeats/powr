import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { Tempo } from '@powr/domain/session';

import { announce } from '#ui/announcer';

import type { MetronomeState } from '../app/container';
import { useAlertSettings } from './use-alert-settings';
import { useTimerKit } from './use-timer-kit';

/*
 * The timed-set lead-in (TMR-09, TD-48) and the tempo metronome (TMR-10, TD-39) for the session
 * screen (M4v). Both live in the lazy timer kit, so these hooks suspend until it is loaded (the
 * session screen already loads it). Sound and vibration follow Settings → Alerts; each start is a
 * tap, so audio is unlocked inside the gesture. Announcements are polite and one per start or
 * stop, never per count or beat (NFR-A11Y-06).
 */

/** The 3-2-1 lead-in before a timed set: `count` is 3, 2, 1 while it runs, else null. */
export function useLeadIn(): {
  readonly count: number | null;
  /** In the tap: counts 3-2-1, then calls `onDone` (which starts the set timer). */
  readonly start: (onDone: () => void) => void;
  readonly cancel: () => void;
} {
  const { t } = useLingui();
  const { leadIn, audio } = useTimerKit();
  const settings = useAlertSettings();
  const count = useSyncExternalStore(leadIn.subscribe, leadIn.count);
  // Leaving the set (confirm, skip, another screen) drops a lead-in that has not finished.
  useEffect(() => () => leadIn.cancel(), [leadIn]);
  const start = useCallback(
    (onDone: () => void) => {
      void audio.unlock();
      announce(t`Set timer starts in 3 seconds`);
      leadIn.start(
        { sound: settings.sound, volume: settings.volume, vibration: settings.vibration },
        onDone,
      );
    },
    [audio, leadIn, settings.sound, settings.volume, settings.vibration, t],
  );
  const cancel = useCallback(() => {
    leadIn.cancel();
    announce(t`Set timer cancelled`);
  }, [leadIn, t]);
  return { count, start, cancel };
}

/**
 * The tempo metronome for the current set. `state.running` drives the control's pressed state,
 * `state.phase` and `state.rep` an optional visible label (they change at phase starts only).
 * It stops when the component that uses it unmounts (the set was confirmed or skipped, the screen
 * changed), silently, so the set's own announcement is not replaced.
 */
export function useMetronome(): {
  readonly state: MetronomeState;
  /** In the tap. `name` is the tempo as written (3-1-1-0), for the announcement. */
  readonly start: (tempo: Tempo, name: string) => void;
  readonly stop: () => void;
} {
  const { t } = useLingui();
  const { metronome, audio } = useTimerKit();
  const settings = useAlertSettings();
  const state = useSyncExternalStore(metronome.subscribe, metronome.state);
  useEffect(() => () => metronome.stop(), [metronome]);
  useEffect(
    () =>
      metronome.onAutoStop(() => {
        announce(t`Tempo cues stopped`);
      }),
    [metronome, t],
  );
  const start = useCallback(
    (tempo: Tempo, name: string) => {
      void audio.unlock();
      if (
        metronome.start(tempo, {
          sound: settings.sound,
          volume: settings.volume,
          vibration: settings.vibration,
        })
      )
        announce(t`Tempo cues on, ${name}`);
    },
    [audio, metronome, settings.sound, settings.volume, settings.vibration, t],
  );
  const stop = useCallback(() => {
    metronome.stop();
    announce(t`Tempo cues off`);
  }, [metronome, t]);
  return { state, start, stop };
}
