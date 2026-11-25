import type { Result } from '@powr/application';
import type {
  PlatformEffect,
  StartSource,
  StartWorkoutError,
  WorkoutError,
  WorkoutOutcome,
} from '@powr/application/session';
import type { PlanId } from '@powr/domain';
import type { SessionEvent, SessionView } from '@powr/domain/session';

import { announce } from '#ui/announcer';

import type { TimerKit } from '../../app/container';
import { useAlertSettings, type AlertSettings } from '../../hooks/use-alert-settings';
import { useDiagnostics, usePlatform } from '../../hooks/use-app';
import { useActivePlan, usePlanning } from '../../hooks/use-planning';
import { useCheckForUpdate } from '../../hooks/use-settings';
import { useTimerKit } from '../../hooks/use-timer-kit';
import { useUnlockAudio } from '../../hooks/use-timers';
import { useSessionUseCases } from '../../hooks/use-workout';
import { resetSessionUi, useSessionUi } from './session-ui';
import { useSessionWords, type SessionWords } from './words';

/** What the effect runner needs from the platform and the words of the screens. */
export interface EffectEnvironment {
  readonly kit: Pick<TimerKit, 'restAlerts' | 'audio'>;
  readonly vibrate: (pattern: readonly number[]) => void;
  readonly settings: Pick<AlertSettings, 'sound' | 'volume' | 'vibration'>;
  readonly words: Pick<SessionWords, 'announcement' | 'pr'>;
  readonly announce: (text: string) => void;
  readonly celebrate: (prs: Extract<PlatformEffect, { kind: 'celebrate' }>['prs']) => void;
}

/**
 * The effect runner (§8.5, M3a's `PlatformEffect`s on M3t's API):
 * - `timer.arm`: nothing here; the shell's session runtime arms the persisted timer with
 *   `useTimerAlerts` (texts, settings, re-arm on a new end), and `arm` is idempotent;
 * - `timer.disarm`: `restAlerts.disarm(id)` at once (a skipped rest must not pre-alert while the
 *   live query catches up);
 * - `wakeLock`: nothing here; `useScreenWakeLock` holds the lock while the session screen or the
 *   mini timer is mounted, and finish and discard call `restAlerts.stopAll()`;
 * - `celebrate`: the PR card (top of the screen), the PR vibration and sound (MOT-02);
 * - `cue`: a haptic tick;
 * - `announce`: one polite announcement per event, the parts joined (the announcer keeps only
 *   the latest of a burst, so separate calls would drop the middle ones).
 */
export function runPlatformEffects(
  effects: readonly PlatformEffect[],
  view: SessionView | null,
  env: EffectEnvironment,
): void {
  const texts: string[] = [];
  for (const effect of effects) {
    switch (effect.kind) {
      case 'timer.arm':
      case 'wakeLock':
        break;
      case 'timer.disarm':
        env.kit.restAlerts.disarm(effect.timerId);
        break;
      case 'celebrate': {
        env.celebrate(effect.prs);
        if (env.settings.vibration) env.vibrate([30, 40, 60]);
        if (env.settings.sound) env.kit.audio.play('pr', env.settings.volume);
        const first = effect.prs[0];
        if (first) texts.push(env.words.pr(first));
        break;
      }
      case 'cue':
        if (env.settings.vibration)
          env.vibrate(effect.cue === 'setConfirmed' ? [20] : [10, 30, 10]);
        break;
      case 'announce': {
        const text = env.words.announcement(effect.announcement, view);
        if (text) texts.push(text);
        break;
      }
      default:
        break;
    }
  }
  if (texts.length > 0) env.announce(texts.join(' '));
}

type Outcome = Result<WorkoutOutcome, WorkoutError>;

/**
 * Command hooks of the session screens: every event goes through the lazy session entry, then
 * its platform effects run. Logs the commit latency of a confirmed set (NFR-PERF-03).
 */
export function useSessionCommands() {
  const run = useSessionUseCases();
  const planning = usePlanning();
  const plan = useActivePlan();
  const kit = useTimerKit();
  const unlockAudio = useUnlockAudio();
  const { haptics, timers } = usePlatform();
  const settings = useAlertSettings();
  const words = useSessionWords();
  const { log } = useDiagnostics();
  const checkForUpdate = useCheckForUpdate();

  const env: EffectEnvironment = {
    kit,
    vibrate: (pattern) => void haptics.vibrate([...pattern]),
    settings,
    words,
    announce,
    celebrate: (prs) => useSessionUi.setState({ celebration: prs }),
  };

  const apply = (outcome: Outcome): Outcome => {
    if (outcome.ok) runPlatformEffects(outcome.value.effects, outcome.value.view, env);
    return outcome;
  };

  const dispatch = async (event: SessionEvent): Promise<Outcome> => {
    const startedAt = performance.now();
    const outcome = await run((session, deps) => session.dispatch(deps, event));
    if (outcome.ok && event.type === 'CONFIRM_SET') {
      log('info', 'set.logged', { commitMs: Math.round(performance.now() - startedAt) });
      const hints = outcome.value.result.hints;
      // The "Workout resumed" banner has done its job once the user logs on (WKT-14).
      useSessionUi.setState({ celebration: null, hints, resumed: null });
    }
    return apply(outcome);
  };

  /** WKT-01: starts a session; the tap also unlocks audio (autoplay policy, §8.8.2). */
  const start = async (source: StartSource): Promise<Result<WorkoutOutcome, StartWorkoutError>> => {
    // Inside the tap, before anything is awaited (the autoplay policy needs the gesture).
    void unlockAudio();
    const outcome = await run((session, deps) => session.startWorkout(deps, { source }));
    if (outcome.ok) {
      resetSessionUi();
      const proposals = outcome.value.result.readiness?.proposals ?? [];
      useSessionUi.setState({
        runtimeFor: outcome.value.view.session.id,
        proposals:
          proposals.length > 0
            ? { sessionId: outcome.value.view.session.id, items: proposals, swapWith: null }
            : null,
      });
      runPlatformEffects(outcome.value.effects, outcome.value.view, env);
    }
    return outcome;
  };

  /** WKT-13: finish (or finish as partial); stops every alert; checks the reactive deload. */
  const finish = async (as: 'finished' | 'partial', endAt?: 'now' | 'lastSet') => {
    const outcome = await run((session, deps) =>
      session.finishWorkout(deps, { as, ...(endAt ? { endAt } : {}) }),
    );
    if (!outcome.ok) return outcome;
    timers.current()?.restAlerts.stopAll();
    apply(outcome);
    // The install gate may have deferred an app update during the workout (§6.3).
    checkForUpdate();
    const sessionId = outcome.value.view.session.id;
    resetSessionUi();
    useSessionUi.setState({ deloadCheck: null });
    const planId: PlanId | undefined = plan.loaded ? plan.value?.id : undefined;
    const lowReadinessDays = outcome.value.lowReadinessDays;
    if (planId) {
      // PRG-12: low readiness on ≥ 3 days is one of the two signals (RDY-02).
      const check = await planning((entry, deps) =>
        entry.checkReactiveDeload(deps, {
          planId,
          ...(lowReadinessDays === undefined ? {} : { lowReadinessDays }),
        }),
      );
      if (check.ok)
        useSessionUi.setState({ deloadCheck: { sessionId, planId, check: check.value } });
    }
    log('info', 'session.finished');
    return outcome;
  };

  /** WKT-13: discard (the screen confirms first); stops every alert. */
  const discard = async () => {
    const outcome = await run((session, deps) => session.discardWorkout(deps));
    if (outcome.ok) {
      timers.current()?.restAlerts.stopAll();
      apply(outcome);
      resetSessionUi();
      checkForUpdate();
    }
    return outcome;
  };

  return { dispatch, start, finish, discard, run };
}
