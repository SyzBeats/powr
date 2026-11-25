import { Trans, useLingui } from '@lingui/react/macro';
import { AudioLines, Flag, Square, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { parseTempo } from '@powr/domain/session';
import type { SessionView } from '@powr/domain/session';

import { announce } from '#ui/announcer';
import { Button } from '#ui/button';
import { TimerRing } from '#ui/timer-ring';

import type { TempoPhase } from '../../app/container';
import { useAlertSettings } from '../../hooks/use-alert-settings';
import { useLeadIn, useMetronome } from '../../hooks/use-timed-set';
import type { TimerDisplay, TimerState } from '../../hooks/use-timers';
import { formatDurationLong } from '../../i18n/format';
import { useSessionCommands } from './commands';
import { useSessionUi } from './session-ui';

/**
 * TMR-09: a timed set starts its own countdown (large control); the rest panel stops it. With
 * Settings → Workout "3-2-1 before a timed set" on, a lead-in counts 3, 2, 1 first (the countdown
 * cue and a short vibration each second, one announcement, Cancel), then starts the same timer.
 * Focus follows the control that replaced the one the user pressed (Cancel, then Stop).
 */
export function SetTimerButton({
  view,
  slotKey,
  targetS,
}: {
  view: SessionView;
  slotKey: string;
  targetS: number | null;
}) {
  const { dispatch } = useSessionCommands();
  const { setTimerLeadIn } = useAlertSettings();
  const leadIn = useLeadIn();
  const cancelButton = useRef<HTMLButtonElement>(null);
  const focusCancel = useRef(false);
  const counting = leadIn.count !== null;

  useEffect(() => {
    if (!counting || !focusCancel.current) return;
    focusCancel.current = false;
    cancelButton.current?.focus();
  }, [counting]);

  if (view.session.timer?.kind === 'set') return null;

  const startTimer = () => {
    if (cancelButton.current?.contains(document.activeElement))
      useSessionUi.setState({ focusSetTimer: true });
    void dispatch({
      type: 'TIMER_START',
      kind: 'set',
      mode: targetS ? 'countdown' : 'countup',
      ...(targetS ? { targetMs: targetS * 1000 } : {}),
      slotKey,
    }).then((outcome) => {
      if (!outcome.ok) useSessionUi.setState({ focusSetTimer: false });
    });
  };

  if (counting)
    return (
      <div className="flex items-center gap-3" data-testid="lead-in">
        <p className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-sm text-fg-muted">
            <Trans>Get ready</Trans>
          </span>
          <span className="text-3xl font-bold tabular" data-testid="lead-in-count">
            {leadIn.count}
          </span>
        </p>
        <Button ref={cancelButton} size="lg" className="w-auto" onClick={leadIn.cancel}>
          <X aria-hidden="true" />
          <Trans>Cancel</Trans>
        </Button>
      </div>
    );

  return (
    <Button
      size="lg"
      onClick={(event) => {
        if (!setTimerLeadIn) {
          startTimer();
          return;
        }
        focusCancel.current = event.currentTarget === document.activeElement;
        leadIn.start(startTimer);
      }}
    >
      <Flag aria-hidden="true" />
      <Trans>Start set timer</Trans>
    </Button>
  );
}

/**
 * The running set timer in the dock (TMR-09): the ring, the time and a large Stop that hands the
 * achieved time to the set. With Settings → Workout "Stop the set timer at the target" on, a
 * countdown stops itself once its end alert has fired ("Time is up": sound, vibration,
 * announcement, as before) and the set gets the target time, not the overrun (also after a
 * return to a page that was hidden). Count-up set timers never stop by themselves. When Stop had
 * focus, focus moves to "Confirm set" (WCAG 2.4.3).
 */
export function SetTimerPanel({
  timer,
  display,
  label,
  time,
  onStopped,
}: {
  timer: TimerState;
  display: TimerDisplay;
  label: string;
  time: string;
  onStopped: (elapsedMs: number) => void;
}) {
  const { t } = useLingui();
  const { dispatch } = useSessionCommands();
  const { setTimerAutoStop } = useAlertSettings();
  const stopButton = useRef<HTMLButtonElement>(null);
  const autoStopped = useRef<string | null>(null);

  useEffect(() => {
    if (!useSessionUi.getState().focusSetTimer) return;
    useSessionUi.setState({ focusSetTimer: false });
    stopButton.current?.focus();
  }, []);

  const stop = useCallback(
    (auto: boolean) => {
      const button = stopButton.current;
      const hadFocus = button !== null && button === document.activeElement;
      const dock = button?.closest('[data-dock]');
      const targetMs = Math.max(0, timer.targetMs + timer.adjustMs);
      void dispatch({ type: 'TIMER_STOP' }).then((outcome) => {
        if (!outcome.ok || outcome.value.result.elapsedMs === undefined) return;
        const elapsedMs = auto
          ? Math.min(outcome.value.result.elapsedMs, targetMs)
          : outcome.value.result.elapsedMs;
        onStopped(elapsedMs);
        if (auto) {
          const duration = formatDurationLong(elapsedMs);
          // One message: the announcer keeps only the latest of a burst ("Time is up" just before).
          announce(t`Time is up, set timer stopped at ${duration}`);
        }
        if (hadFocus) dock?.querySelector<HTMLElement>('[data-primary]:not(:disabled)')?.focus();
      });
    },
    [dispatch, onStopped, t, timer.targetMs, timer.adjustMs],
  );

  const due =
    setTimerAutoStop && timer.mode === 'countdown' && display.done && timer.fired.end === true;
  useEffect(() => {
    if (!due || autoStopped.current === timer.id) return;
    autoStopped.current = timer.id;
    stop(true);
  }, [due, timer.id, stop]);

  return (
    <div className="flex items-center gap-3" data-testid="rest-panel">
      <TimerRing progress={display.progress} done={display.done} />
      <p className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-fg-muted">{label}</span>
        <span className="text-3xl font-bold tabular" data-testid="timer-time">
          {time}
        </span>
      </p>
      <Button ref={stopButton} size="lg" className="w-auto" onClick={() => stop(false)}>
        <Square aria-hidden="true" />
        <Trans>Stop</Trans>
      </Button>
    </div>
  );
}

/**
 * TMR-10: the tempo metronome for the current set, shown when Settings → Workout "Tempo cues" is
 * on and the exercise has a tempo. One toggle (its name stays the same, `aria-pressed` carries
 * on/off); while it runs, a label shows the repetition and the phase. The label changes at phase
 * starts only (at most about once a second), has no animation (reduced motion) and is hidden from
 * screen readers, which hear one announcement on start and one on stop instead of every beat.
 */
export function TempoCues({ tempo }: { tempo: string }) {
  const { tempoCues } = useAlertSettings();
  const parsed = useMemo(() => parseTempo(tempo), [tempo]);
  if (!tempoCues || !parsed) return null;
  return <TempoControl tempo={parsed} name={tempo} />;
}

function TempoControl({
  tempo,
  name,
}: {
  tempo: NonNullable<ReturnType<typeof parseTempo>>;
  name: string;
}) {
  const { t } = useLingui();
  const metronome = useMetronome();
  const { running, phase, rep } = metronome.state;
  const phaseLabel = usePhaseLabel();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="tempo-cues">
      <Button
        variant={running ? 'info' : 'secondary'}
        aria-pressed={running}
        onClick={() => (running ? metronome.stop() : metronome.start(tempo, name))}
      >
        <AudioLines aria-hidden="true" />
        <span>
          <Trans>Tempo cues {name}</Trans>
        </span>
      </Button>
      {running ? (
        <span aria-hidden="true" className="font-semibold tabular" data-testid="tempo-phase">
          {phase === null ? t`Starting…` : t`Rep ${rep} · ${phaseLabel(phase)}`}
        </span>
      ) : null}
    </div>
  );
}

function usePhaseLabel(): (phase: TempoPhase) => string {
  const { t } = useLingui();
  const labels: Record<TempoPhase, string> = {
    lower: t`Lower`,
    bottom: t`Pause`,
    lift: t`Lift`,
    top: t`Pause`,
  };
  return (phase) => labels[phase];
}
