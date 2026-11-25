import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useRouterState } from '@tanstack/react-router';
import { Timer } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { SessionView } from '@powr/domain/session';

import { TimerRing } from '#ui/timer-ring';

import { useTimerKit } from '../../hooks/use-timer-kit';
import {
  useScreenWakeLock,
  useTimerAlerts,
  useTimerDisplay,
  type TimerState,
} from '../../hooks/use-timers';
import { useSessionUseCases, useSessionView } from '../../hooks/use-workout';
import { formatClock } from '../../i18n/format';
import { useLabels } from '../labels';
import { useSessionUi } from './session-ui';

/**
 * The session runtime, mounted once by the shell while a session is active (a lazy chunk):
 * - arms the alerts of the persisted timer (`useTimerAlerts`, §8.8.2/§8.8.4) and records M3t's
 *   `pre-alert` and `end` events in the session (`TIMER_FIRED`), so a reload never alerts twice;
 * - WKT-14: a session found active when the app opened is resumed once (`RESUME`): its timer is
 *   re-armed and the screen shows "Workout resumed" (and the stale prompt after 6 hours);
 * - TMR-12: the global mini timer on every other screen, one tap back to the session.
 */
export default function SessionRuntime() {
  const view = useSessionView();
  if (!view.loaded || !view.value) return null;
  return <Runtime view={view.value} />;
}

function Runtime({ view }: { view: SessionView }) {
  const sessionId = view.session.id;
  const timer = view.session.timer;
  const run = useSessionUseCases();
  const { restAlerts } = useTimerKit();
  const { endedWhileHidden } = useTimerAlerts(timer, { url: '/session' });

  useEffect(() => {
    useSessionUi.setState({ endedWhileHidden });
  }, [endedWhileHidden]);

  // WKT-14: once per page and session (a session this page started needs no RESUME).
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || useSessionUi.getState().runtimeFor === sessionId) return;
    resumed.current = true;
    useSessionUi.setState({ runtimeFor: sessionId });
    void run((session, deps) => session.resumeWorkout(deps)).then((outcome) => {
      if (!outcome.ok) return;
      useSessionUi.setState({
        resumed: { sessionId, stale: outcome.value.result.stale === true },
      });
    });
  }, [run, sessionId]);

  // M3t's alert events → M3a's TIMER_FIRED (the record marks what fired; §8.8.4 dedupe).
  const timerId = timer?.id ?? null;
  useEffect(() => {
    if (!timerId) return undefined;
    return restAlerts.subscribe((event) => {
      if (event.type !== 'pre-alert' && event.type !== 'end') return;
      if (event.timer.id !== timerId) return;
      const which = event.type === 'end' ? 'end' : 'preAlert';
      void run((session, deps) => session.dispatch(deps, { type: 'TIMER_FIRED', timerId, which }));
    });
  }, [restAlerts, run, timerId]);

  const onSessionScreen = useRouterState({
    select: (state) => {
      const path = state.location.pathname.replace(/\/$/, '');
      return path === '/session' || path.startsWith('/onboarding');
    },
  });
  return onSessionScreen ? null : <MiniTimer view={view} timer={timer} />;
}

/**
 * TMR-12: a compact timer above the bottom navigation on every screen but the session itself:
 * the running rest (or set timer) with its ring, else the session clock (TMR-11), as one link
 * back to the session. Keeps the screen on like the session screen (PWA-06).
 */
function MiniTimer({ view, timer }: { view: SessionView; timer: TimerState | null }) {
  const { t } = useLingui();
  const labels = useLabels();
  useScreenWakeLock(true);
  const display = useTimerDisplay(timer);
  const clock = useTimerDisplay(sessionClock(view));
  const bar = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const element = bar.current;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--mini-timer-inset', `${element?.offsetHeight ?? 0}px`);
    });
    if (element) observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--mini-timer-inset');
    };
  }, []);
  const slot = timer?.slotKey
    ? view.session.exercises.find((entry) => entry.key === timer.slotKey)
    : undefined;
  const name = slot ? labels.exercise(slot.exerciseId) : null;
  const time = display.done
    ? t`Rest over · +${formatClock(display.overMs, 'down')}`
    : timer?.mode === 'countup'
      ? formatClock(display.elapsedMs, 'down')
      : formatClock(display.remainingMs);
  const what = !timer
    ? t`Workout in progress`
    : timer.kind === 'set'
      ? t`Set timer`
      : timer.kind === 'transition'
        ? t`Next exercise`
        : t`Resting`;
  return (
    <Link
      ref={bar}
      to="/session"
      data-testid="mini-timer"
      className="fixed inset-x-0 bottom-(--bottom-nav-height,3.5rem) z-10 mx-auto flex min-h-target max-w-xl items-center gap-3 border-t border-border bg-surface-raised px-4 py-1"
    >
      {timer ? (
        <TimerRing progress={display.progress} done={display.done} size={40} stroke={4} />
      ) : (
        <Timer aria-hidden="true" className="size-6 shrink-0 text-info" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-fg-muted">
          {what}
          {name ? ` · ${name}` : ''}
        </span>
        <span className="text-lg font-bold tabular">
          {timer ? time : formatClock(clock.elapsedMs, 'down')}
        </span>
      </span>
      <span className="font-semibold text-primary">
        <Trans>Back to workout</Trans>
      </span>
    </Link>
  );
}

const clocks = new Map<string, TimerState>();

/**
 * TMR-11: the session clock as a count-up timer from the session start (display only). One
 * object per session, so the display store is not rebuilt on every emission of the live view.
 */
export function sessionClock(view: SessionView): TimerState {
  const cached = clocks.get(view.session.id);
  if (cached) return cached;
  const clock: TimerState = {
    id: `clock:${view.session.id}`,
    kind: 'rest',
    mode: 'countup',
    startedAtEpochMs: view.session.startedAt.epochMs,
    targetMs: 0,
    adjustMs: 0,
    fired: {},
  };
  clocks.clear();
  clocks.set(view.session.id, clock);
  return clock;
}
