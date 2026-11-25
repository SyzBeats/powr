import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import type { PastSessionError } from '@powr/application/session';
import type { ExerciseId, LocalDate, MassUnit } from '@powr/domain';

import { ActionBar } from '#ui/action-bar';
import { Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { Field } from '#ui/field';
import { Card, Screen } from '#ui/screen';

import { useCatalog } from '../../../hooks/use-planning';
import { useSessionUseCases } from '../../../hooks/use-workout';
import { todayLocal } from '../../../i18n/format';
import { assertNever } from '../../exhaustive';
import { useLabels } from '../../labels';
import { useLoadUnit } from '../words';
import {
  EMPTY_SET,
  SetFields,
  setInputOf,
  useSetChecks,
  type SetDraft,
  type SetErrors,
} from './set-fields';

/** At most this many search results (the list stays short on a phone). */
const RESULTS_SHOWN = 8;

interface DraftSetRow {
  readonly key: string;
  readonly values: SetDraft;
}

interface DraftExercise {
  readonly key: string;
  readonly exerciseId: ExerciseId;
  readonly sets: readonly DraftSetRow[];
}

interface FormErrors {
  readonly summary: readonly string[];
  /** `date`, `exercises`, or `<exerciseKey>.<setKey>.<field>`. */
  readonly fields: Readonly<Record<string, string>>;
}

const newKey = () => crypto.randomUUID();

/**
 * WKT-15: logs a finished session for a past day (or earlier today): the date, an optional start
 * time, exercises from the library and their sets. The derived data (e1RM, PRs) is recomputed by
 * the use case; then the editor of the new session opens.
 */
export function LogPastSessionScreen() {
  const { t } = useLingui();
  const run = useSessionUseCases();
  const navigate = useNavigate();
  const labels = useLabels();
  const unit = useLoadUnit();
  const checkSet = useSetChecks();
  const today = todayLocal();
  const noteId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState<string>(today);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [exercises, setExercises] = useState<readonly DraftExercise[]>([]);
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [busy, setBusy] = useState(false);

  const updateSet = (exerciseKey: string, setKey: string, values: SetDraft) =>
    setExercises((current) =>
      current.map((exercise) =>
        exercise.key === exerciseKey
          ? {
              ...exercise,
              sets: exercise.sets.map((set) => (set.key === setKey ? { ...set, values } : set)),
            }
          : exercise,
      ),
    );
  const addSet = (exerciseKey: string) =>
    setExercises((current) =>
      current.map((exercise) =>
        exercise.key === exerciseKey
          ? {
              ...exercise,
              // A new set starts with the previous one's values: usually only the reps change.
              sets: [
                ...exercise.sets,
                { key: newKey(), values: exercise.sets.at(-1)?.values ?? EMPTY_SET },
              ],
            }
          : exercise,
      ),
    );
  const removeSet = (exerciseKey: string, setKey: string) =>
    setExercises((current) =>
      current.map((exercise) =>
        exercise.key === exerciseKey
          ? { ...exercise, sets: exercise.sets.filter((set) => set.key !== setKey) }
          : exercise,
      ),
    );

  const validate = (): FormErrors => {
    const summary: string[] = [];
    const fields: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
      fields['date'] = t`Choose a date that is today or earlier.`;
      summary.push(fields['date']);
    }
    if (!exercises.some((exercise) => exercise.sets.length > 0)) {
      fields['exercises'] = t`Add at least one exercise with a set.`;
      summary.push(fields['exercises']);
    }
    for (const exercise of exercises) {
      const name = labels.exercise(exercise.exerciseId);
      for (const [index, set] of exercise.sets.entries()) {
        const number = index + 1;
        for (const [field, message] of Object.entries(checkSet(set.values))) {
          fields[`${exercise.key}.${set.key}.${field}`] = message;
          summary.push(t`${name}, set ${number}: ${message}`);
        }
      }
    }
    return { summary, fields };
  };

  const showErrors = (next: FormErrors) => {
    setErrors(next);
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const errorText = (error: PastSessionError): string => {
    switch (error.kind) {
      case 'futureDate':
        return t`Choose a date that is today or earlier.`;
      case 'empty':
        return t`Add at least one exercise with a set.`;
      case 'invalidValues':
        return t`Some values are out of range. Check the weights, reps and reps in reserve.`;
      case 'unknownExercise':
        return t`One of the exercises is not in the library any more.`;
      case 'activeSession':
      case 'unknownSession':
      case 'unknownSet':
      case 'idsExhausted':
        return t`The workout could not be saved. Try again.`;
      default:
        return assertNever(error);
    }
  };

  const save = async () => {
    const found = validate();
    if (found.summary.length > 0) {
      showErrors(found);
      return;
    }
    setBusy(true);
    const result = await run((session, deps) =>
      session.logPastSession(deps, {
        localDate: date as LocalDate,
        ...(time ? { startTime: time } : {}),
        exercises: exercises
          .filter((exercise) => exercise.sets.length > 0)
          .map((exercise) => ({
            exerciseId: exercise.exerciseId,
            sets: exercise.sets.map((set) => setInputOf(set.values, unit)),
          })),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    );
    setBusy(false);
    if (!result.ok) {
      showErrors({ summary: [errorText(result.error)], fields: {} });
      return;
    }
    void navigate({
      to: '/session/past/$sessionId',
      params: { sessionId: result.value.session.id },
      replace: true,
    });
  };

  const fieldError = (key: string) => errors?.fields[key];

  return (
    <Screen title={t`Log a past workout`}>
      {errors && errors.summary.length > 0 ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="outline-none">
          <Callout tone="danger" title={t`Please check the workout`}>
            <ul className="list-disc pl-5">
              {errors.summary.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Callout>
        </div>
      ) : null}

      <Card>
        <Field
          label={t`Date`}
          type="date"
          value={date}
          max={today}
          onChange={(event) => setDate(event.target.value)}
          error={fieldError('date')}
        />
        <Field
          label={t`Start time (optional)`}
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
      </Card>

      {exercises.map((exercise) => (
        <ExerciseDraftCard
          key={exercise.key}
          exercise={exercise}
          unit={unit}
          fieldError={fieldError}
          onSetChange={(setKey, values) => updateSet(exercise.key, setKey, values)}
          onAddSet={() => addSet(exercise.key)}
          onRemoveSet={(setKey) => removeSet(exercise.key, setKey)}
          onRemove={() =>
            setExercises((current) => current.filter((entry) => entry.key !== exercise.key))
          }
        />
      ))}

      <ExerciseSearch
        exclude={exercises.map((exercise) => exercise.exerciseId)}
        error={fieldError('exercises')}
        onAdd={(exerciseId) =>
          setExercises((current) => [
            ...current,
            { key: newKey(), exerciseId, sets: [{ key: newKey(), values: EMPTY_SET }] },
          ])
        }
      />

      <Card>
        <label htmlFor={noteId} className="font-medium">
          <Trans>Note (optional)</Trans>
        </label>
        <textarea
          id={noteId}
          value={note}
          maxLength={2000}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-xl border border-input bg-transparent p-2.5 text-base"
        />
      </Card>

      <ActionBar>
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void save()}>
          <Trans>Save workout</Trans>
        </Button>
      </ActionBar>
    </Screen>
  );
}

function ExerciseDraftCard({
  exercise,
  unit,
  fieldError,
  onSetChange,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  exercise: DraftExercise;
  unit: MassUnit;
  fieldError: (key: string) => string | undefined;
  onSetChange: (setKey: string, values: SetDraft) => void;
  onAddSet: () => void;
  onRemoveSet: (setKey: string) => void;
  onRemove: () => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const headingId = useId();
  const name = labels.exercise(exercise.exerciseId);
  return (
    <section aria-labelledby={headingId}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={headingId} className="text-lg font-semibold">
            {name}
          </h2>
          <Button aria-label={t`Remove exercise ${name}`} onClick={onRemove}>
            <Trash2 aria-hidden="true" className="size-5" />
            <Trans>Remove exercise</Trans>
          </Button>
        </div>
        {exercise.sets.map((set, index) => {
          const number = index + 1;
          const load = fieldError(`${exercise.key}.${set.key}.load`);
          const reps = fieldError(`${exercise.key}.${set.key}.reps`);
          const rir = fieldError(`${exercise.key}.${set.key}.rir`);
          const errorsOf: SetErrors = {
            ...(load ? { load } : {}),
            ...(reps ? { reps } : {}),
            ...(rir ? { rir } : {}),
          };
          return (
            <fieldset
              key={set.key}
              className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-3"
            >
              <legend className="px-1 font-semibold">
                <Trans>Set {number}</Trans>
              </legend>
              <SetFields
                draft={set.values}
                unit={unit}
                errors={errorsOf}
                onChange={(values) => onSetChange(set.key, values)}
              />
              <Button
                aria-label={t`Remove set ${number}, ${name}`}
                onClick={() => onRemoveSet(set.key)}
              >
                <Trans>Remove set</Trans>
              </Button>
            </fieldset>
          );
        })}
        <Button aria-label={t`Add set, ${name}`} onClick={onAddSet}>
          <Plus aria-hidden="true" className="size-5" />
          <Trans>Add set</Trans>
        </Button>
      </Card>
    </section>
  );
}

/** A search over the exercise library by name and synonym; each result adds the exercise. */
function ExerciseSearch({
  exclude,
  error,
  onAdd,
}: {
  exclude: readonly ExerciseId[];
  error: string | undefined;
  onAdd: (exerciseId: ExerciseId) => void;
}) {
  const { t } = useLingui();
  const catalog = useCatalog();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const results =
    needle.length < 2
      ? []
      : catalog
          .exercises()
          .filter(
            (exercise) =>
              exercise.status === 'active' &&
              !exclude.includes(exercise.id) &&
              (exercise.name.en.toLowerCase().includes(needle) ||
                exercise.synonyms.some((synonym) => synonym.toLowerCase().includes(needle))),
          )
          .slice(0, RESULTS_SHOWN);
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Add an exercise</Trans>
      </h2>
      <Field
        label={t`Find an exercise`}
        hint={t`Type at least two letters of its name.`}
        type="search"
        value={query}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
        error={error}
      />
      {results.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {results.map((exercise) => {
            const name = exercise.name.en;
            return (
              <li key={exercise.id}>
                <Button
                  className="w-full justify-start text-left"
                  onClick={() => {
                    onAdd(exercise.id);
                    setQuery('');
                  }}
                >
                  <Plus aria-hidden="true" className="size-5 shrink-0" />
                  <Trans>Add {name}</Trans>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : needle.length >= 2 ? (
        <p className="text-fg-muted">
          <Trans>No exercise matches. Try another name.</Trans>
        </p>
      ) : null}
    </Card>
  );
}
