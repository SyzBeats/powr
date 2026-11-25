import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

import type { ExerciseChoices } from '@powr/application/settings';

import { Button } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useSettingsUseCases } from '../../hooks/use-settings';
import { formatClock } from '../../i18n/format';
import { useLabels } from '../labels';

type AutoStart = 'workout' | 'on' | 'off';

/**
 * TD-49 (M5s): the per-exercise choices the session core reads (`settings.session.exercises`):
 * PRG-03 manual mode, which PRG-09 calls "keep as last time" (the last performance is pre-filled
 * without progression), and TMR-01's rest auto-start per exercise; plus the rest remembered for
 * an exercise (TMR-03). Listed for the plan's exercises, recent ones and those with a choice.
 */
export function ExerciseChoicesScreen() {
  const { t } = useLingui();
  const run = useSettingsUseCases();
  const [list, setList] = useState<readonly ExerciseChoices[] | null>(null);
  const reload = useCallback(
    () => run((settings, deps) => settings.exerciseChoices(deps)).then(setList),
    [run],
  );
  useEffect(() => {
    void reload();
  }, [reload]);

  const groups = [
    { source: 'plan' as const, title: t`In your plan` },
    { source: 'recent' as const, title: t`From recent workouts` },
    { source: 'choice' as const, title: t`Other exercises with a choice` },
  ];

  return (
    <Screen title={t`Choices per exercise`}>
      <p>
        <Trans>
          "Keep as last time" pre-fills what you lifted last time instead of a progression. The rest
          timer can start by itself after a set, or only when you tap it.
        </Trans>
      </p>
      {list === null ? (
        <p className="text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      ) : list.length === 0 ? (
        <Card>
          <p>
            <Trans>
              Exercises from your plan and your recent workouts show up here. Set up a plan or log a
              workout first.
            </Trans>
          </p>
        </Card>
      ) : (
        groups.map((group) => {
          const entries = list.filter((entry) => entry.source === group.source);
          if (entries.length === 0) return null;
          return (
            <section key={group.source} aria-label={group.title} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <ul className="flex flex-col gap-3">
                {entries.map((entry) => (
                  <li key={entry.exerciseId}>
                    <ExerciseRow entry={entry} reload={reload} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      <Link
        to="/settings"
        hash="training"
        className="flex min-h-target items-center font-semibold text-primary underline-offset-4 hover:underline"
      >
        <Trans>Back to Settings</Trans>
      </Link>
    </Screen>
  );
}

function ExerciseRow({ entry, reload }: { entry: ExerciseChoices; reload: () => Promise<void> }) {
  const { t } = useLingui();
  const labels = useLabels();
  const run = useSettingsUseCases();
  const name = labels.exercise(entry.exerciseId);
  const set = (choice: { manual?: boolean; restAutoStart?: boolean | null }) =>
    void run((settings, deps) =>
      settings.setExerciseChoice(deps, { exerciseId: entry.exerciseId, ...choice }),
    ).then(reload);
  const autoStart: AutoStart =
    entry.restAutoStart === null ? 'workout' : entry.restAutoStart ? 'on' : 'off';
  const rest = entry.restSeconds === null ? null : formatClock(entry.restSeconds * 1000, 'down');
  return (
    <Card className="gap-2">
      <h3 className="font-semibold">{name}</h3>
      <CheckRow
        label={t`Keep as last time`}
        description={t`No automatic progression; you raise the weight yourself.`}
        checked={entry.manual}
        onChange={(manual) => set({ manual })}
      />
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="px-2 text-sm font-medium">
          <Trans>Rest timer after a set</Trans>
        </span>
        <Segmented<AutoStart>
          label={t`Rest timer after a set: ${name}`}
          value={autoStart}
          onChange={(next) => set({ restAutoStart: next === 'workout' ? null : next === 'on' })}
          options={[
            { value: 'workout', label: t`As set for all` },
            { value: 'on', label: t`Starts by itself` },
            { value: 'off', label: t`When I tap it` },
          ]}
        />
      </div>
      {rest ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">
            <Trans>Remembered rest: {rest}</Trans>
          </span>
          <Button
            aria-label={t`Forget the rest time of ${name}`}
            onClick={() =>
              void run((settings, deps) => settings.resetExerciseRest(deps, entry.exerciseId)).then(
                reload,
              )
            }
          >
            <Trans>Forget</Trans>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
