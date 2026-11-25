import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import type { PastSessionError } from '@powr/application/session';
import type { ExerciseId, LoggedSet, MassUnit, SessionId } from '@powr/domain';
import type { PastEdit, PrRecord, SessionState } from '@powr/domain/session';

import { announce } from '#ui/announcer';
import { Badge, Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { Card, Screen } from '#ui/screen';
import { Sheet } from '#ui/sheet';

import { useSessionUseCases } from '../../../hooks/use-workout';
import { formatLocalDate, formatTime } from '../../../i18n/format';
import { assertNever } from '../../exhaustive';
import { useLabels } from '../../labels';
import { useLoadUnit, useSessionWords } from '../words';
import { useSummaryWords } from './parts';
import { SetFields, setInputOf, useSetChecks, type SetDraft, type SetErrors } from './set-fields';

type SetTarget =
  | { readonly kind: 'edit'; readonly set: LoggedSet; readonly number: number }
  | { readonly kind: 'add'; readonly exerciseId: ExerciseId; readonly number: number };

interface PendingSave {
  readonly edits: readonly PastEdit[];
  readonly removed: readonly PrRecord[];
  readonly added: readonly PrRecord[];
}

/**
 * WKT-15: edits a finished session: set values, deleted and added sets, removed exercises and
 * the note, or deletes the whole session. Every change is previewed first (`previewPastEdit`):
 * when it removes or adds a PR, the screen says which before saving ("This will remove a PR").
 * The use case recomputes everything derived (e1RM, PRs) for the exercises it touched.
 */
export function PastSessionEditor({ sessionId }: { sessionId: SessionId }) {
  const { t } = useLingui();
  const run = useSessionUseCases();
  const navigate = useNavigate();
  const labels = useLabels();
  const [detail, setDetail] = useState<SessionState | 'missing' | null>(null);
  const [target, setTarget] = useState<SetTarget | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState<PendingSave | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void run((session, deps) => session.pastSessionDetail(deps, sessionId)).then((result) => {
      if (!cancelled) setDetail(result.ok ? result.value : 'missing');
    });
    return () => {
      cancelled = true;
    };
  }, [run, sessionId]);

  const reload = async () => {
    const result = await run((session, deps) => session.pastSessionDetail(deps, sessionId));
    setDetail(result.ok ? result.value : 'missing');
  };

  const errorText = (failure: PastSessionError): string => {
    switch (failure.kind) {
      case 'invalidValues':
        return t`Some values are out of range. Check the weights, reps and reps in reserve.`;
      case 'unknownSession':
        return t`This workout was not found. It may have been deleted.`;
      case 'activeSession':
        return t`This workout is still in progress. Edit it on the workout screen.`;
      case 'futureDate':
      case 'empty':
      case 'unknownExercise':
      case 'unknownSet':
      case 'idsExhausted':
        return t`The change could not be saved. Try again.`;
      default:
        return assertNever(failure);
    }
  };

  const apply = async (edits: readonly PastEdit[]) => {
    setBusy(true);
    const result = await run((session, deps) =>
      session.editPastSession(deps, { sessionId, edits }),
    );
    setBusy(false);
    setPending(null);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    setError(null);
    announce(t`Workout updated.`);
    await reload();
  };

  /** Previews the PR effect first (WKT-15) and asks when the edit removes or adds one. */
  const submit = async (edits: readonly PastEdit[]) => {
    setBusy(true);
    const preview = await run((session, deps) =>
      session.previewPastEdit(deps, { sessionId, edits }),
    );
    setBusy(false);
    if (!preview.ok) {
      setError(errorText(preview.error));
      return;
    }
    const { removed, added } = preview.value;
    if (removed.length > 0 || added.length > 0) {
      setPending({ edits, removed, added });
      return;
    }
    await apply(edits);
  };

  const deleteWorkout = async () => {
    setBusy(true);
    const result = await run((session, deps) => session.deletePastSession(deps, sessionId));
    setBusy(false);
    setConfirmDelete(false);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    announce(t`Workout deleted.`);
    void navigate({ to: '/session/past', replace: true });
  };

  const openSet = (next: SetTarget) => {
    setTarget(next);
    setSheetOpen(true);
  };

  if (detail === null || detail === 'missing') {
    return (
      <Screen title={t`Edit workout`}>
        {detail === null ? (
          <output className="block text-fg-muted">
            <Trans>Loading the workout…</Trans>
          </output>
        ) : (
          <Card>
            <p>
              <Trans>This workout was not found. It may have been deleted.</Trans>
            </p>
            <Link to="/session/past" className={buttonClass({ size: 'lg' })}>
              <Trans>Back to past workouts</Trans>
            </Link>
          </Card>
        )}
      </Screen>
    );
  }

  const { session, sets } = detail;
  const exerciseIds = [
    ...new Set([
      ...session.exercises.map((exercise) => exercise.exerciseId),
      ...sets.map((set) => set.exerciseId),
    ]),
  ].filter((id) => sets.some((set) => set.exerciseId === id));
  const date = formatLocalDate(session.localDate, 'long');
  const started = formatTime(session.startedAt.epochMs);

  return (
    <Screen title={t`Edit workout`}>
      <Card>
        <p className="text-lg font-semibold">
          <Trans>
            {date}, {started}
          </Trans>
        </p>
        <div className="flex flex-wrap gap-2">
          {session.status === 'partial' ? <Badge tone="neutral">{t`Partial`}</Badge> : null}
          {session.backdated ? <Badge tone="info">{t`Logged later`}</Badge> : null}
        </div>
        <Link
          to="/session/summary/$sessionId"
          params={{ sessionId }}
          className="flex min-h-target items-center font-semibold text-primary underline-offset-4"
        >
          <Trans>Show the summary</Trans>
        </Link>
      </Card>

      {error ? (
        <Callout tone="danger" title={t`Not saved`}>
          <p>{error}</p>
        </Callout>
      ) : null}

      {exerciseIds.map((exerciseId) => (
        <ExerciseSets
          key={exerciseId}
          name={labels.exercise(exerciseId)}
          sets={sets.filter((set) => set.exerciseId === exerciseId)}
          busy={busy}
          onEdit={(set, number) => openSet({ kind: 'edit', set, number })}
          onDelete={(set) => void submit([{ kind: 'deleteSet', setId: set.id }])}
          onAdd={(number) => openSet({ kind: 'add', exerciseId, number })}
          onRemove={() => void submit([{ kind: 'deleteExercise', exerciseId }])}
        />
      ))}

      <NoteEditor
        key={`${session.id}:${session.revision}`}
        stored={session.note ?? ''}
        busy={busy}
        onSave={(note) => void submit([{ kind: 'note', note: note.trim() ? note : null }])}
      />

      <Card>
        <h2 className="text-lg font-semibold">
          <Trans>Delete this workout</Trans>
        </h2>
        <p className="text-fg-muted">
          <Trans>
            Deletes the workout and its sets. Records and estimates are recalculated without it.
          </Trans>
        </p>
        <Button variant="danger" size="lg" onClick={() => setConfirmDelete(true)}>
          <Trash2 aria-hidden="true" className="size-5" />
          <Trans>Delete workout</Trans>
        </Button>
      </Card>

      <SetSheet
        open={sheetOpen}
        target={target}
        onOpenChange={setSheetOpen}
        onSave={(draft, unit) => {
          if (!target) return;
          setSheetOpen(false);
          const values = setInputOf(draft, unit);
          void submit(
            target.kind === 'edit'
              ? [{ kind: 'editSet', setId: target.set.id, values }]
              : [{ kind: 'addSet', exerciseId: target.exerciseId, values }],
          );
        }}
      />

      <PrConfirmSheet
        pending={pending}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(edits) => void apply(edits)}
      />

      <Sheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t`Delete this workout?`}
        description={t`This cannot be undone. Its sets, records and estimates are removed.`}
        closeLabel={t`Close`}
      >
        <Button variant="danger" size="lg" disabled={busy} onClick={() => void deleteWorkout()}>
          <Trans>Delete workout</Trans>
        </Button>
        <Button size="lg" onClick={() => setConfirmDelete(false)}>
          <Trans>Keep it</Trans>
        </Button>
      </Sheet>
    </Screen>
  );
}

function ExerciseSets({
  name,
  sets,
  busy,
  onEdit,
  onDelete,
  onAdd,
  onRemove,
}: {
  name: string;
  sets: readonly LoggedSet[];
  busy: boolean;
  onEdit: (set: LoggedSet, number: number) => void;
  onDelete: (set: LoggedSet) => void;
  onAdd: (number: number) => void;
  onRemove: () => void;
}) {
  const { t } = useLingui();
  const words = useSessionWords();
  const summaryWords = useSummaryWords();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Card>
        <h2 id={headingId} className="text-lg font-semibold">
          {name}
        </h2>
        <ol className="flex flex-col gap-3">
          {sets.map((set, index) => {
            const number = index + 1;
            return (
              <li
                key={set.id}
                data-testid="past-set"
                className="flex flex-col gap-2 border-b border-border pb-3 last:border-0"
              >
                <p>
                  <span className="font-semibold">
                    <Trans>Set {number}</Trans>
                  </span>
                  {set.type === 'working' ? null : (
                    <span className="text-fg-muted"> · {words.setType(set.type)}</span>
                  )}
                  <span className="block text-lg font-semibold tabular">
                    {summaryWords.setValues(set)}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    aria-label={t`Edit set ${number}, ${name}`}
                    disabled={busy}
                    onClick={() => onEdit(set, number)}
                  >
                    <Pencil aria-hidden="true" className="size-5" />
                    <Trans>Edit</Trans>
                  </Button>
                  <Button
                    aria-label={t`Delete set ${number}, ${name}`}
                    disabled={busy}
                    onClick={() => onDelete(set)}
                  >
                    <Trash2 aria-hidden="true" className="size-5" />
                    <Trans>Delete</Trans>
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label={t`Add set, ${name}`}
            disabled={busy}
            onClick={() => onAdd(sets.length + 1)}
          >
            <Plus aria-hidden="true" className="size-5" />
            <Trans>Add set</Trans>
          </Button>
          <Button aria-label={t`Remove exercise ${name}`} disabled={busy} onClick={onRemove}>
            <Trash2 aria-hidden="true" className="size-5" />
            <Trans>Remove exercise</Trans>
          </Button>
        </div>
      </Card>
    </section>
  );
}

function NoteEditor({
  stored,
  busy,
  onSave,
}: {
  stored: string;
  busy: boolean;
  onSave: (note: string) => void;
}) {
  const noteId = useId();
  const [note, setNote] = useState(stored);
  return (
    <Card>
      <label htmlFor={noteId} className="text-lg font-semibold">
        <Trans>Workout note</Trans>
      </label>
      <textarea
        id={noteId}
        value={note}
        maxLength={2000}
        rows={3}
        onChange={(event) => setNote(event.target.value)}
        className="w-full rounded-xl border border-input bg-transparent p-2.5 text-base"
      />
      <Button disabled={busy || note.trim() === stored.trim()} onClick={() => onSave(note)}>
        <Trans>Save note</Trans>
      </Button>
    </Card>
  );
}

/** The values of one set, edited or added, in a bottom sheet. */
function SetSheet({
  open,
  target,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  target: SetTarget | null;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: SetDraft, unit: MassUnit) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const profileUnit = useLoadUnit();
  const name = target
    ? labels.exercise(target.kind === 'edit' ? target.set.exerciseId : target.exerciseId)
    : '';
  const number = target?.number ?? 1;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={target?.kind === 'add' ? t`Add set ${number}` : t`Edit set ${number}`}
      description={name}
      closeLabel={t`Close`}
    >
      {target ? (
        <SetForm
          key={target.kind === 'edit' ? target.set.id : `add:${target.exerciseId}`}
          initial={
            target.kind === 'edit'
              ? {
                  load: target.set.load?.value ?? null,
                  reps: target.set.reps,
                  rir: target.set.effort.rir,
                }
              : { load: null, reps: null, rir: null }
          }
          unit={target.kind === 'edit' ? (target.set.load?.unit ?? profileUnit) : profileUnit}
          onSave={onSave}
        />
      ) : null}
    </Sheet>
  );
}

function SetForm({
  initial,
  unit,
  onSave,
}: {
  initial: SetDraft;
  unit: MassUnit;
  onSave: (draft: SetDraft, unit: MassUnit) => void;
}) {
  const check = useSetChecks();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<SetErrors>({});
  return (
    <>
      <SetFields draft={draft} errors={errors} unit={unit} onChange={setDraft} />
      <Button
        variant="primary"
        size="lg"
        onClick={() => {
          const found = check(draft);
          setErrors(found);
          if (Object.keys(found).length === 0) onSave(draft, unit);
        }}
      >
        <Trans>Save set</Trans>
      </Button>
    </>
  );
}

/** WKT-15: "This will remove a PR" before the change is written. */
function PrConfirmSheet({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: PendingSave | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (edits: readonly PastEdit[]) => void;
}) {
  const { t } = useLingui();
  const words = useSessionWords();
  const unit = useLoadUnit();
  return (
    <Sheet
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={t`This change affects your records`}
      closeLabel={t`Close`}
    >
      {pending ? (
        <>
          {pending.removed.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="prs-removed">
              <h3 className="font-semibold">
                <Trans>This will remove a PR:</Trans>
              </h3>
              <ul className="flex flex-col gap-1">
                {pending.removed.map((pr) => (
                  <li key={`${pr.id}|${pr.valueKg}`} className="flex items-start gap-2">
                    <Trophy aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                    <span>{words.pr(pr, unit)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {pending.added.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="prs-added">
              <h3 className="font-semibold">
                <Trans>This will add a PR:</Trans>
              </h3>
              <ul className="flex flex-col gap-1">
                {pending.added.map((pr) => (
                  <li key={`${pr.id}|${pr.valueKg}`} className="flex items-start gap-2">
                    <Trophy aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pr-accent" />
                    <span>{words.pr(pr, unit)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            disabled={busy}
            onClick={() => onConfirm(pending.edits)}
          >
            <Trans>Save anyway</Trans>
          </Button>
          <Button size="lg" onClick={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}
