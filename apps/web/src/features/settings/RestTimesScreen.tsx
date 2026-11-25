import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExerciseRest, RestParamId, RestTime } from '@powr/application/settings';

import { Badge } from '#ui/badge';
import { Button } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { Card, Screen } from '#ui/screen';
import { Stepper } from '#ui/stepper';

import { useSettingsUseCases } from '../../hooks/use-settings';
import { formatClock } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';
import { useEvidenceLabels } from '../why/evidence';

/** One step of the rest steppers (TMR-03 uses ±15 s too). */
const STEP_S = 15;
/** Typed values are saved once the user pauses (each keystroke would store a passing value). */
const SAVE_AFTER_MS = 700;

const clock = (seconds: number) => formatClock(seconds * 1000, 'down');

/**
 * SET-03 / TMR-02 (M5s): the rest time for each kind of set with its evidence default for the
 * user's style and level, the user's own value (accepted outside the range with a note), reset per
 * row or all at once ("reset to evidence defaults"), and the rests remembered for single
 * exercises (TMR-03). A workout reads the same values through the resolver.
 */
export function RestTimesScreen() {
  const { t } = useLingui();
  const run = useSettingsUseCases();
  const [data, setData] = useState<{
    readonly times: readonly RestTime[];
    readonly exercises: readonly ExerciseRest[];
  } | null>(null);
  const [status, setStatus] = useState('');
  const [alsoExercises, setAlsoExercises] = useState(false);

  const reload = useCallback(
    () => run((settings, deps) => settings.restTimes(deps)).then(setData),
    [run],
  );
  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async (paramId: RestParamId, seconds: number) => {
    const result = await run((settings, deps) => settings.setRestTime(deps, { paramId, seconds }));
    if (result.ok) await reload();
  };
  const resetAll = async () => {
    const { removed } = await run((settings, deps) =>
      settings.resetRestTimes(deps, { exercises: alsoExercises }),
    );
    await reload();
    setStatus(
      removed === 0
        ? t`All rest times already follow the evidence defaults.`
        : t`Rest times reset to the evidence defaults.`,
    );
  };

  return (
    <Screen title={t`Rest times`}>
      <p>
        <Trans>
          Each kind of set has a rest time from research. Change one to use it in every workout from
          now on; a value outside the usual range is fine, POWR only notes it.
        </Trans>
      </p>
      <output className="block min-h-6 font-medium" data-testid="rest-status">
        {status}
      </output>
      {data === null ? (
        <p className="text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {data.times.map((time) => (
              <li key={time.id} data-testid={`rest-${time.id}`}>
                <RestRow time={time} onSave={save} />
              </li>
            ))}
          </ul>
          {data.exercises.length > 0 ? (
            <ExerciseRests rests={data.exercises} reload={reload} />
          ) : null}
          <Card>
            <h2 className="text-lg font-semibold">
              <Trans>Reset to evidence defaults</Trans>
            </h2>
            {data.exercises.length > 0 ? (
              <CheckRow
                label={t`Also forget the rest times remembered for single exercises`}
                checked={alsoExercises}
                onChange={setAlsoExercises}
              />
            ) : null}
            <Button onClick={() => void resetAll()}>
              <Trans>Reset all rest times</Trans>
            </Button>
          </Card>
        </>
      )}
      <Link
        to="/settings"
        hash="workout"
        className="flex min-h-target items-center font-semibold text-primary underline-offset-4 hover:underline"
      >
        <Trans>Back to Settings</Trans>
      </Link>
    </Screen>
  );
}

function RestRow({
  time,
  onSave,
}: {
  time: RestTime;
  onSave: (paramId: RestParamId, seconds: number) => Promise<void>;
}) {
  const { t } = useLingui();
  const evidence = useEvidenceLabels();
  const name = useRestName()(time.id);
  // undefined: nothing typed; null: the field is empty while the user types.
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const commit = (seconds: number | null, delay: number) => {
    setDraft(seconds);
    if (timer.current) clearTimeout(timer.current);
    if (seconds === null) return;
    const value = Math.min(1800, Math.max(0, Math.round(seconds)));
    timer.current = setTimeout(() => {
      void onSave(time.id, value).then(() => setDraft(undefined));
    }, delay);
  };
  const shown = draft === undefined ? time.seconds : draft;
  const evidenceDefault = clock(time.evidenceDefault);
  const competition = time.competitionDefault === null ? null : clock(time.competitionDefault);
  return (
    <Card className="gap-2">
      <Stepper
        label={name}
        value={shown}
        unit={t`s`}
        onChange={(next) => commit(next, SAVE_AFTER_MS)}
        onStep={(direction, current) =>
          Math.min(1800, Math.max(0, (current ?? time.seconds) + direction * STEP_S))
        }
        decrementLabel={t`15 seconds less: ${name}`}
        incrementLabel={t`15 seconds more: ${name}`}
        decimal={false}
        max={1800}
        hint={shown === null ? undefined : <Trans>{clock(shown)} minutes</Trans>}
      />
      <p className="text-sm text-fg-muted">
        {competition ? (
          <Trans>
            Evidence default: {evidenceDefault} (squat and deadlift {competition}). Your value
            applies to them too.
          </Trans>
        ) : (
          <Trans>Evidence default: {evidenceDefault}</Trans>
        )}
      </p>
      <span className="flex flex-wrap gap-2">
        {time.own ? <Badge tone="neutral">{t`Your setting`}</Badge> : null}
        {evidence.of(time.evidence).map((label) => (
          <Badge key={label} tone="info" icon={null}>
            {label}
          </Badge>
        ))}
        {time.verified ? null : <Badge tone="warning">{t`Preliminary value`}</Badge>}
      </span>
      {time.own && time.outOfRange ? (
        <p className="text-sm font-medium" data-testid="rest-out-of-range">
          <Trans>
            Outside the range research supports for this kind of set. That is your choice; POWR uses
            it.
          </Trans>
        </p>
      ) : null}
      {time.own ? (
        <Button
          onClick={() => commit(time.evidenceDefault, 0)}
          aria-label={t`Use the evidence default: ${name}`}
        >
          <Trans>Use the evidence default</Trans>
        </Button>
      ) : null}
    </Card>
  );
}

/** TMR-03: rests remembered for single exercises, each can be forgotten. */
function ExerciseRests({
  rests,
  reload,
}: {
  rests: readonly ExerciseRest[];
  reload: () => Promise<void>;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const run = useSettingsUseCases();
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Remembered for single exercises</Trans>
      </h2>
      <ul className="flex flex-col gap-2">
        {rests.map((rest) => {
          const name = labels.exercise(rest.exerciseId);
          const time = clock(rest.seconds);
          return (
            <li
              key={`${rest.exerciseId}-${rest.paramId}`}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span>
                <Trans>
                  {name}: {time}
                </Trans>
              </span>
              <Button
                aria-label={t`Forget the rest time of ${name}`}
                onClick={() =>
                  void run((settings, deps) =>
                    settings.resetExerciseRest(deps, rest.exerciseId),
                  ).then(reload)
                }
              >
                <Trans>Forget</Trans>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The kinds of set in words (TMR-02's table). */
function useRestName() {
  const { t } = useLingui();
  return (id: RestParamId): string => {
    switch (id) {
      case 'session.rest.strength':
        return t`Strength sets`;
      case 'session.rest.hypertrophyCompound':
        return t`Muscle building, compound exercises`;
      case 'session.rest.hypertrophyIsolation':
        return t`Muscle building, isolation exercises`;
      case 'session.rest.timeSaver':
        return t`Time-saver mode`;
      case 'session.rest.supersetTransition':
        return t`Between the exercises of a superset`;
      case 'session.rest.warmupLight':
        return t`After light warm-up sets`;
      case 'session.rest.warmupBeforeWork':
        return t`Before the first working set`;
      default:
        return assertNever(id);
    }
  };
}
