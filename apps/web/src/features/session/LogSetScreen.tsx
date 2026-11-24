import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import type { ExerciseDef, ExerciseId, LoggedSet, Session } from '@powr/domain';

import { Button } from '#ui/button';
import { NumberField } from '#ui/number-field';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useExercises } from '../../hooks/use-content';
import {
  useActiveSession,
  useFinishSession,
  useLogSet,
  useSessionSets,
} from '../../hooks/use-session';
import { formatNumber, formatTime } from '../../i18n/format';

type RirChoice = '0' | '1' | '2' | '3' | '4' | '5' | 'none';

/** M0 "log one set" screen: proves UI -> use case -> strict IndexedDB write end to end. */
export function LogSetScreen() {
  const { t } = useLingui();
  const exercises = useExercises();
  const session = useActiveSession();
  const logSet = useLogSet();
  const finishSession = useFinishSession();

  const [exerciseId, setExerciseId] = useState<ExerciseId | null>(exercises[0]?.id ?? null);
  const [load, setLoad] = useState<number | null>(60);
  const [reps, setReps] = useState<number | null>(5);
  const [rir, setRir] = useState<RirChoice>('2');
  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const exerciseName = (id: ExerciseId) =>
    exercises.find((exercise) => exercise.id === id)?.name.en ?? id;

  const confirm = async () => {
    if (!exerciseId) return;
    setSaving(true);
    const result = await logSet({
      exerciseId,
      values: {
        load: load === null ? null : { value: load, unit: 'kg' },
        reps,
        rir: rir === 'none' ? null : Number(rir),
      },
    });
    setSaving(false);
    if (result.ok) {
      const name = exerciseName(exerciseId);
      const weight = load === null ? '-' : formatNumber(load, 3);
      setStatus(t`Saved: ${name}, ${weight} kg × ${reps ?? 0}`);
    } else {
      setStatus(t`Not saved. Check the values and try again.`);
    }
  };

  const finish = async () => {
    const result = await finishSession();
    if (result.ok) setStatus(t`Workout finished.`);
  };

  return (
    <Screen title={t`Log a set`}>
      <Card>
        <ExercisePicker exercises={exercises} value={exerciseId} onChange={setExerciseId} />
        <NumberField
          label={t`Load`}
          unit={t`kg`}
          value={load}
          onChange={setLoad}
          step={2.5}
          min={0}
          max={1000}
          decrementLabel={t`Decrease load`}
          incrementLabel={t`Increase load`}
        />
        <NumberField
          label={t`Reps`}
          value={reps}
          onChange={setReps}
          step={1}
          min={0}
          max={100}
          decrementLabel={t`Fewer reps`}
          incrementLabel={t`More reps`}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg-muted">
            <Trans>Reps in reserve</Trans>
          </span>
          <Segmented<RirChoice>
            label={t`Reps in reserve`}
            value={rir}
            onChange={setRir}
            options={[
              { value: '0', label: '0' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
              { value: '5', label: '5' },
              { value: 'none', label: t`n/a` },
            ]}
          />
        </div>
        <Button
          variant="primary"
          size="lg"
          disabled={saving || !exerciseId}
          onClick={() => void confirm()}
        >
          <Trans>Confirm set</Trans>
        </Button>
        <output aria-live="polite" data-testid="log-status" className="block min-h-6 text-sm">
          {status}
        </output>
      </Card>

      {session.loaded && session.value ? (
        <SessionSets
          session={session.value}
          exerciseName={exerciseName}
          onFinish={() => void finish()}
        />
      ) : null}
    </Screen>
  );
}

function ExercisePicker({
  exercises,
  value,
  onChange,
}: {
  exercises: readonly ExerciseDef[];
  value: ExerciseId | null;
  onChange: (id: ExerciseId) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-fg-muted">
        <Trans>Exercise</Trans>
      </legend>
      {exercises.map((exercise) => (
        <label
          key={exercise.id}
          className="flex min-h-target items-center gap-3 rounded-xl border border-control px-3 has-[:checked]:border-primary has-[:checked]:bg-surface-raised"
        >
          <input
            type="radio"
            name="exercise"
            value={exercise.id}
            checked={value === exercise.id}
            onChange={() => onChange(exercise.id)}
            className="size-5 accent-primary"
          />
          {exercise.name.en}
        </label>
      ))}
    </fieldset>
  );
}

function SessionSets({
  session,
  exerciseName,
  onFinish,
}: {
  session: Session;
  exerciseName: (id: ExerciseId) => string;
  onFinish: () => void;
}) {
  const { t } = useLingui();
  const sets = useSessionSets(session.id);
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>This workout</Trans>
      </h2>
      <ol data-testid="session-sets" className="flex flex-col gap-1">
        {sets.loaded
          ? sets.value.map((set) => (
              <SetRow key={set.id} set={set} name={exerciseName(set.exerciseId)} />
            ))
          : null}
      </ol>
      <Button onClick={onFinish} aria-label={t`Finish workout`}>
        <Trans>Finish workout</Trans>
      </Button>
    </Card>
  );
}

function SetRow({ set, name }: { set: LoggedSet; name: string }) {
  const weight = set.load ? formatNumber(set.load.value, 3) : '-';
  const unit = set.load?.unit ?? '';
  const reps = set.reps ?? 0;
  const time = formatTime(set.performedAt.epochMs);
  return (
    <li className="flex justify-between gap-2 border-b border-border py-1 tabular last:border-0">
      <span>{name}</span>
      <span>
        <Trans>
          {weight} {unit} × {reps} · {time}
        </Trans>
      </span>
    </li>
  );
}
