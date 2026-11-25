import { Trans, useLingui } from '@lingui/react/macro';
import { useId } from 'react';

import type { RoundingMode } from '@powr/domain';
import type { GuardrailKind, SessionPreferences } from '@powr/domain/session';

import { CheckRow } from '#ui/choice';
import { Card } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useAlertSettings, useSetAlertSettings } from '../../hooks/use-alert-settings';
import { useSessionUseCases } from '../../hooks/use-workout';
import { useSessionPreferences } from '../session/preferences';
import { useSessionWords } from '../session/words';

const HINTS: readonly GuardrailKind[] = ['sessionVolume', 'failure', 'shortRest', 'slowReps'];

/**
 * Settings → Workout (SET-03, SET-05; M3b): the session preferences the session core reads
 * (`settings.session`): rest auto-start (TMR-01), countdown or count-up rest (TMR-07), the
 * readiness check-in (RDY-01), the in-session hints one by one (WKT-16) and the rounding
 * direction of suggested loads (WKT-07). Read from the settings record (no lazy chunk); a change
 * goes through the lazy session entry's `updateSessionPreferences`. M4v adds the timed-set and
 * tempo switches (TMR-09, TMR-10), stored with the alert settings.
 */
export function WorkoutSection() {
  const { t } = useLingui();
  const preferences = useSessionPreferences();
  const run = useSessionUseCases();
  const words = useSessionWords();
  const headingId = useId();
  if (!preferences.loaded) return null;

  const save = (patch: Partial<SessionPreferences>) =>
    void run((session, deps) => session.updateSessionPreferences(deps, patch));

  return (
    <Card>
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <h2 id={headingId} className="text-lg font-semibold">
          <Trans>Workout</Trans>
        </h2>

        <CheckRow
          label={t`Start the rest timer after each set`}
          checked={preferences.restAutoStart}
          onChange={(restAutoStart) => save({ restAutoStart })}
        />

        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="px-2 font-medium">
            <Trans>Rest timer</Trans>
          </span>
          <Segmented<SessionPreferences['restMode']>
            label={t`Rest timer`}
            value={preferences.restMode}
            onChange={(restMode) => save({ restMode })}
            options={[
              { value: 'countdown', label: t`Count down` },
              { value: 'countup', label: t`Count up, ready when you are` },
            ]}
          />
          <p className="px-2 text-sm text-fg-muted">
            {preferences.restMode === 'countup' ? (
              <Trans>
                Counts up from the end of a set, with a gentle cue after a short minimum (60 s for
                isolation, 90 s for compound exercises).
              </Trans>
            ) : (
              <Trans>Counts down the evidence-based rest for each exercise.</Trans>
            )}
          </p>
        </div>

        <CheckRow
          label={t`Check-in before a workout`}
          description={t`Sleep, energy and soreness in under 30 seconds; it can suggest lighter work on bad days.`}
          checked={preferences.readinessCheckIn}
          onChange={(readinessCheckIn) => save({ readinessCheckIn })}
        />

        <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
          <legend className="mb-1 px-2 font-medium">
            <Trans>Hints during a workout</Trans>
          </legend>
          {HINTS.map((kind) => (
            <CheckRow
              key={kind}
              label={words.hintTitle(kind)}
              checked={!preferences.hintsOff.includes(kind)}
              onChange={(on) =>
                save({
                  hintsOff: on
                    ? preferences.hintsOff.filter((entry) => entry !== kind)
                    : [...preferences.hintsOff, kind],
                })
              }
            />
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="px-2 font-medium">
            <Trans>Round suggested weights</Trans>
          </span>
          <Segmented<RoundingMode>
            label={t`Round suggested weights`}
            value={preferences.rounding}
            onChange={(rounding) => save({ rounding })}
            options={[
              { value: 'nearestTiesDown', label: t`To the nearest` },
              { value: 'down', label: t`Down` },
              { value: 'up', label: t`Up` },
            ]}
          />
          <p className="px-2 text-sm text-fg-muted">
            <Trans>
              Suggestions use the plates and weights you have. "To the nearest" picks the lighter
              one on a tie.
            </Trans>
          </p>
        </div>

        <TimedSetsAndTempo />
      </section>
    </Card>
  );
}

/**
 * TMR-09 and TMR-10 (M4v): the timed set's 3-2-1 lead-in and its automatic stop at the target,
 * and the tempo metronome's control on the session screen; all off by default. Stored with the
 * alert settings (`settings.alerts`), whose sound, volume and vibration they use.
 */
function TimedSetsAndTempo() {
  const { t } = useLingui();
  const settings = useAlertSettings();
  const save = useSetAlertSettings();
  if (!settings.loaded) return null;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className="mb-1 px-2 font-medium">
        <Trans>Timed sets and tempo</Trans>
      </legend>
      <CheckRow
        label={t`Count down 3-2-1 before a timed set`}
        description={t`A beep and a short vibration each second, then the set timer starts.`}
        checked={settings.setTimerLeadIn}
        onChange={(setTimerLeadIn) => void save({ setTimerLeadIn })}
      />
      <CheckRow
        label={t`Stop the set timer at the target time`}
        description={t`After the "Time is up" alert, the target time is entered for the set. Otherwise the timer runs on until you tap Stop.`}
        checked={settings.setTimerAutoStop}
        onChange={(setTimerAutoStop) => void save({ setTimerAutoStop })}
      />
      <CheckRow
        label={t`Tempo cues`}
        description={t`Shows a metronome button on each set: a cue when you start lowering, at each pause and when you lift, by sound and vibration as set under Alerts.`}
        checked={settings.tempoCues}
        onChange={(tempoCues) => void save({ tempoCues })}
      />
    </fieldset>
  );
}
