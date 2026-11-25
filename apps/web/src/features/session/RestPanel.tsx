import { Trans, useLingui } from '@lingui/react/macro';
import { RotateCcw, SkipForward } from 'lucide-react';
import type { ReactNode } from 'react';

import type { SessionView } from '@powr/domain/session';

import { cn } from '#ui/cn';
import { TimerRing } from '#ui/timer-ring';

import { useTimerDisplay } from '../../hooks/use-timers';
import { formatClock, formatDurationLong } from '../../i18n/format';
import { useLabels } from '../labels';
import { useSessionCommands } from './commands';
import { useSessionUi } from './session-ui';
import { SetTimerPanel } from './timed-set';

const STEP_MS = 15_000;

/**
 * The running timer in the dock (TMR-01…09, TMR-13): the ring and the time (≥ 1.5× body text),
 * "Rest over · +0:42" once it ended (TMR-04), the count-up with its soft minimum (TMR-07), the
 * superset transition with the next exercise (TMR-13), and ±15 s, skip and restart (TMR-03). A
 * set timer (TMR-09) shows a large Stop that hands the achieved time to the set, or stops itself
 * at the target when the user chose that (`SetTimerPanel`, M4v).
 */
export function RestPanel({
  view,
  onSetTimerStopped,
  aside,
}: {
  view: SessionView;
  onSetTimerStopped: (elapsedMs: number) => void;
  /** Shown next to the time (the undo button), so the dock stays short. */
  aside?: ReactNode;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const { dispatch } = useSessionCommands();
  const timer = view.session.timer;
  const display = useTimerDisplay(timer);
  const endedWhileHidden = useSessionUi((state) => state.endedWhileHidden);
  if (!timer) return null;

  const slot = timer.slotKey
    ? view.session.exercises.find((entry) => entry.key === timer.slotKey)
    : undefined;
  const name = slot ? labels.exercise(slot.exerciseId) : null;
  const over = formatClock(display.overMs, 'down');

  let label: string;
  let time: string;
  if (timer.kind === 'set') {
    label = t`Set timer`;
    time =
      timer.mode === 'countup'
        ? formatClock(display.elapsedMs, 'down')
        : display.done
          ? t`Time is up · +${over}`
          : formatClock(display.remainingMs);
  } else if (timer.kind === 'transition') {
    label = name ? t`Next: ${name}` : t`Next exercise`;
    time = display.done ? t`Go · +${over}` : formatClock(display.remainingMs);
  } else if (timer.mode === 'countup') {
    const minimum = formatClock(display.durationMs);
    label = display.done ? t`Ready when you are` : t`Resting, at least ${minimum}`;
    time = formatClock(display.elapsedMs, 'down');
  } else {
    label = t`Rest`;
    time = display.done ? t`Rest over · +${over}` : formatClock(display.remainingMs);
  }

  if (timer.kind === 'set') {
    return (
      <SetTimerPanel
        timer={timer}
        display={display}
        label={label}
        time={time}
        onStopped={onSetTimerStopped}
      />
    );
  }

  const controlClass =
    'flex min-h-target min-w-target flex-1 items-center justify-center rounded-xl border border-control bg-surface font-semibold';
  return (
    <div
      data-testid="rest-panel"
      className={cn(
        'flex flex-col gap-2 rounded-xl',
        // TMR-05 visual state: a static frame once the rest is over (never flashing, A11Y-08/09).
        display.done && 'outline-2 outline-offset-4 outline-success',
      )}
    >
      <div className="flex items-center gap-2">
        <TimerRing progress={display.progress} done={display.done} size={40} stroke={4} />
        <p className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm text-fg-muted">{label}</span>
          <span
            className="text-3xl font-bold tabular"
            data-testid="timer-time"
            data-done={display.done ? '' : undefined}
          >
            {time}
          </span>
        </p>
        {aside}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={t`−15 seconds`}
          onClick={() => void dispatch({ type: 'TIMER_ADJUST', deltaMs: -STEP_MS })}
          className={controlClass}
        >
          <Trans>−15</Trans>
        </button>
        <button
          type="button"
          aria-label={t`+15 seconds`}
          onClick={() => void dispatch({ type: 'TIMER_ADJUST', deltaMs: STEP_MS })}
          className={controlClass}
        >
          <Trans>+15</Trans>
        </button>
        <button
          type="button"
          aria-label={t`Restart rest`}
          onClick={() => void dispatch({ type: 'TIMER_RESTART' })}
          className={controlClass}
        >
          <RotateCcw aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={timer.kind === 'transition' ? t`Skip transition` : t`Skip rest`}
          onClick={() => void dispatch({ type: 'TIMER_SKIP' })}
          className={controlClass}
        >
          <SkipForward aria-hidden="true" />
        </button>
      </div>
      {endedWhileHidden && display.done ? (
        <p className="sr-only">
          <Trans>Rest over, {formatDurationLong(display.overMs)} ago</Trans>
        </p>
      ) : null}
    </div>
  );
}
