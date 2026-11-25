import type { SessionView } from '@powr/domain/session';

import { useScreenWakeLock } from '../../hooks/use-timers';
import { useSessionView } from '../../hooks/use-workout';
import { Proposals, ReadinessCheckIn } from './CheckIn';
import { LoggingView } from './LoggingView';
import { useSessionPreferences } from './preferences';
import { useSessionUi } from './session-ui';
import { StartScreen } from './StartScreen';

/**
 * `/session`: the start screen without an active session (WKT-01), else the active session:
 * the readiness check-in before the first set when enabled (RDY-01), the proposed changes
 * (RDY-03, PRG-13), then the logging view (WKT-02). The views swap inside the route with their
 * own titles, so `Screen` moves focus to each new heading.
 */
export function SessionScreen({ startToday = false }: { startToday?: boolean }) {
  const view = useSessionView();
  if (!view.loaded) return null;
  if (!view.value) return <StartScreen startToday={startToday} />;
  return <ActiveSession view={view.value} />;
}

function ActiveSession({ view }: { view: SessionView }) {
  // PWA-06: the screen stays on from the check-in to the last set (the mini timer elsewhere).
  useScreenWakeLock(true);
  const preferences = useSessionPreferences();
  const proposals = useSessionUi((state) =>
    state.proposals?.sessionId === view.session.id ? state.proposals : null,
  );
  if (!preferences.loaded) return null;
  const started = view.exercises.some((exercise) =>
    exercise.sets.some((set) => set.status !== 'pending'),
  );
  if (preferences.readinessCheckIn && view.session.readiness === null && !started)
    return <ReadinessCheckIn view={view} />;
  if (proposals && !started) return <Proposals view={view} proposals={proposals} />;
  return <LoggingView view={view} />;
}
