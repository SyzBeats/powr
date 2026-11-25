import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import type { ExerciseDetailView, SetupError } from '@powr/application/library';
import {
  convertMass,
  SETUP_FIELDS,
  type ExerciseId,
  type ExerciseUserData,
  type SetupField,
} from '@powr/domain';

import { Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { DecimalField, Field } from '#ui/field';
import { Card } from '#ui/screen';
import { Sheet } from '#ui/sheet';

import { useLibrary } from '../../hooks/use-library';
import { formatNumber } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';
import { useLoadUnit } from '../session/words';
import { useLibraryWords } from './words';

interface SetupRow {
  readonly key: number;
  readonly field: SetupField;
  readonly label: string;
  readonly value: string;
}

function rowsOf(userData: ExerciseUserData | null): SetupRow[] {
  return (userData?.setup ?? []).map((entry, index) => ({
    key: index,
    field: entry.field,
    label: entry.label ?? '',
    value: entry.value,
  }));
}

/**
 * EXL-09 setup memory ("seat 4, pin 3, wide grip", shown in every session with the exercise) and
 * the ANL-04 training max, in the user's load unit. Empty rows are left out when saving.
 */
export function SetupMemoryCard({
  exerciseId,
  userData,
  onSaved,
}: {
  exerciseId: ExerciseId;
  userData: ExerciseUserData | null;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  const run = useLibrary();
  const words = useLibraryWords();
  const unit = useLoadUnit();
  const headingId = useId();
  const noteId = useId();
  const [rows, setRows] = useState<SetupRow[]>(() => rowsOf(userData));
  const [note, setNote] = useState(userData?.note ?? '');
  const [trainingMax, setTrainingMax] = useState<number | null>(() =>
    userData?.trainingMax ? Math.round(convertMass(userData.trainingMax, unit) * 100) / 100 : null,
  );
  const [errors, setErrors] = useState<{
    readonly rows: Readonly<Record<number, string>>;
    readonly trainingMax?: string;
    readonly form?: string;
  }>({ rows: {} });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key: number, patch: Partial<SetupRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const errorOf = (error: SetupError, kept: readonly SetupRow[]) => {
    switch (error.kind) {
      case 'invalidEntry': {
        const row = kept[error.index];
        return {
          rows: row ? { [row.key]: t`Enter a value of at most 60 characters.` } : {},
        };
      }
      case 'tooMany':
        return { rows: {}, form: t`Keep at most 12 settings.` };
      case 'invalidTrainingMax':
        return { rows: {}, trainingMax: t`Enter a training max above 0.` };
      case 'unknownExercise':
        return { rows: {}, form: t`This exercise is not in the library any more.` };
      default:
        return assertNever(error);
    }
  };

  const save = async () => {
    const kept = rows.filter((row) => row.value.trim() !== '' || row.label.trim() !== '');
    const found: Record<number, string> = {};
    for (const row of kept) {
      if (row.value.trim() === '') found[row.key] = t`Enter a value or remove this setting.`;
      else if (row.field === 'other' && row.label.trim() === '')
        found[row.key] = t`Name this setting, for example "Cable height".`;
    }
    const maxError =
      trainingMax !== null && !(trainingMax > 0)
        ? t`Enter a training max above 0, or leave it empty.`
        : undefined;
    if (Object.keys(found).length > 0 || maxError) {
      setErrors({ rows: found, ...(maxError ? { trainingMax: maxError } : {}) });
      setStatus('');
      return;
    }
    setBusy(true);
    const result = await run((library, deps) =>
      library.saveExerciseUserData(deps, {
        exerciseId,
        setup: kept.map((row) => ({
          field: row.field,
          ...(row.field === 'other' ? { label: row.label.trim() } : {}),
          value: row.value.trim(),
        })),
        note,
        trainingMax: trainingMax === null ? null : { value: trainingMax, unit },
      }),
    );
    setBusy(false);
    if (!result.ok) {
      setErrors(errorOf(result.error, kept));
      setStatus('');
      return;
    }
    setRows(kept);
    setErrors({ rows: {} });
    setStatus(t`Setup saved. It shows whenever this exercise is in a workout.`);
    onSaved();
  };

  return (
    <Card>
      <h2 id={headingId} className="text-lg font-bold">
        <Trans>Your setup</Trans>
      </h2>
      <p className="text-sm text-fg-muted">
        <Trans>
          Machine and grip settings, for example seat 4, pin 3, wide grip. They show in every
          workout with this exercise.
        </Trans>
      </p>
      {errors.form ? (
        <Callout tone="danger" title={t`Please check the setup`}>
          <p>{errors.form}</p>
        </Callout>
      ) : null}
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-3" data-testid="setup-rows">
          {rows.map((row, index) => (
            <li key={row.key}>
              <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <legend className="px-1 text-sm font-semibold">
                  <Trans>Setting {formatNumber(index + 1, 0)}</Trans>
                </legend>
                <SetupFieldSelect
                  value={row.field}
                  onChange={(field) => update(row.key, { field })}
                  label={t`What`}
                  optionLabel={words.setupField}
                />
                {row.field === 'other' ? (
                  <Field
                    label={t`Name of the setting`}
                    value={row.label}
                    maxLength={40}
                    onChange={(event) => update(row.key, { label: event.target.value })}
                  />
                ) : null}
                <Field
                  label={t`Value`}
                  value={row.value}
                  maxLength={60}
                  onChange={(event) => update(row.key, { value: event.target.value })}
                  error={errors.rows[row.key]}
                />
                <Button
                  onClick={() =>
                    setRows((current) => current.filter((entry) => entry.key !== row.key))
                  }
                >
                  <Trash2 aria-hidden="true" className="size-5" />
                  <Trans>Remove this setting</Trans>
                </Button>
              </fieldset>
            </li>
          ))}
        </ul>
      ) : null}
      {rows.length < 12 ? (
        <Button
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                key: Math.max(-1, ...current.map((row) => row.key)) + 1,
                field: nextField(current),
                label: '',
                value: '',
              },
            ])
          }
        >
          <Plus aria-hidden="true" className="size-5" />
          <Trans>Add a setting</Trans>
        </Button>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor={noteId} className="font-medium">
          <Trans>Note (optional)</Trans>
        </label>
        <textarea
          id={noteId}
          value={note}
          maxLength={2000}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-xl border border-input bg-transparent p-2.5 text-base"
        />
      </div>
      <DecimalField
        label={t`Training max (optional)`}
        hint={t`The reference weight for percentage-based plans, often a little below your true 1-rep max.`}
        value={trainingMax}
        onValueChange={setTrainingMax}
        suffix={unit}
        error={errors.trainingMax}
      />
      <Button variant="primary" size="lg" disabled={busy} onClick={() => void save()}>
        <Trans>Save setup</Trans>
      </Button>
      <output className="block text-sm font-semibold text-success">{status}</output>
    </Card>
  );
}

function nextField(rows: readonly SetupRow[]): SetupField {
  return SETUP_FIELDS.find((field) => !rows.some((row) => row.field === field)) ?? 'other';
}

function SetupFieldSelect({
  value,
  onChange,
  label,
  optionLabel,
}: {
  value: SetupField;
  onChange: (value: SetupField) => void;
  label: string;
  optionLabel: (field: SetupField) => string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as SetupField)}
        className="min-h-target w-full rounded-xl border border-control bg-surface px-3"
      >
        {SETUP_FIELDS.map((field) => (
          <option key={field} value={field}>
            {optionLabel(field)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * EXL-08: favourite (preferred by the generator and the rankings), hidden (out of the lists),
 * avoided (never generated or suggested), and avoiding the whole movement pattern (ONB-07).
 */
export function MarksCard({
  detail,
  onChanged,
}: {
  detail: ExerciseDetailView;
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const run = useLibrary();
  const labels = useLabels();
  const { flags, exercise } = detail.info;
  const pattern = labels.pattern(exercise.pattern);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const change = async (
    mark: 'favourite' | 'hidden' | 'avoided' | 'pattern',
    on: boolean,
    done: string,
  ) => {
    const result = await run((library, deps) => {
      switch (mark) {
        case 'favourite':
          return library.setFavourite(deps, { exerciseId: exercise.id, on });
        case 'hidden':
          return library.setHidden(deps, { exerciseId: exercise.id, on });
        case 'avoided':
          return library.setAvoided(deps, { exerciseId: exercise.id, on });
        case 'pattern':
          return library.setAvoided(deps, { pattern: exercise.pattern, on });
        default:
          return assertNever(mark);
      }
    });
    if (!result.ok) {
      setError(
        result.error.kind === 'noProfile'
          ? t`Marks are saved in your profile. Set up a plan or your profile first.`
          : t`This exercise is not in the library any more.`,
      );
      setStatus('');
      return;
    }
    setError(null);
    setStatus(done);
    onChanged();
  };

  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Your marks</Trans>
      </h2>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <CheckRow
        label={t`Favourite`}
        description={t`Plans and rankings prefer it.`}
        checked={flags.favourite}
        onChange={(on) =>
          void change('favourite', on, on ? t`Marked as a favourite.` : t`No longer a favourite.`)
        }
      />
      <CheckRow
        label={t`Hide from lists`}
        description={t`It stays in your history; the library shows it only when you ask.`}
        checked={flags.hidden}
        onChange={(on) => void change('hidden', on, on ? t`Hidden.` : t`Shown in lists again.`)}
      />
      <CheckRow
        label={t`Avoid this exercise`}
        description={t`Never put in a plan or suggested, for example because of an injury.`}
        checked={flags.avoided}
        onChange={(on) =>
          void change('avoided', on, on ? t`Avoided from now on.` : t`No longer avoided.`)
        }
      />
      <CheckRow
        label={t`Avoid every ${pattern} exercise`}
        description={t`The whole movement pattern, for plans and suggestions.`}
        checked={flags.avoidedPattern}
        onChange={(on) =>
          void change(
            'pattern',
            on,
            on
              ? t`Every ${pattern} exercise is avoided.`
              : t`${pattern} exercises are allowed again.`,
          )
        }
      />
      <output className="block text-sm font-semibold">{status}</output>
    </Card>
  );
}

/**
 * EXL-04: deletes a custom exercise after a confirmation; one with history or in a plan is retired
 * instead (it leaves the lists and plans; the logged sets stay).
 */
export function DeleteCustomExercise({
  exerciseId,
  name,
  onRetired,
}: {
  exerciseId: ExerciseId;
  name: string;
  onRetired: () => void;
}) {
  const { t } = useLingui();
  const run = useLibrary();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const remove = async () => {
    setBusy(true);
    const result = await run((library, deps) => library.deleteCustomExercise(deps, exerciseId));
    setBusy(false);
    setOpen(false);
    if (!result.ok) {
      setStatus(t`This exercise was already deleted.`);
      return;
    }
    if (result.value.outcome === 'deleted') {
      void navigate({ to: '/explore', replace: true });
      return;
    }
    setStatus(t`${name} is retired: it left the lists and plans, and your logged sets stay.`);
    onRetired();
  };

  return (
    <>
      <Button size="lg" variant="danger" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Trash2 aria-hidden="true" className="size-5" />
        <Trans>Delete this exercise</Trans>
      </Button>
      <output className="block text-sm font-semibold">{status}</output>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t`Delete ${name}?`}
        description={t`If you have logged it or a plan uses it, it is retired instead: it leaves the lists and plans, and your logged sets stay.`}
        closeLabel={t`Close`}
      >
        <Button variant="danger" size="lg" disabled={busy} onClick={() => void remove()}>
          <Trans>Delete</Trans>
        </Button>
        <Button size="lg" onClick={() => setOpen(false)}>
          <Trans>Keep it</Trans>
        </Button>
      </Sheet>
    </>
  );
}
