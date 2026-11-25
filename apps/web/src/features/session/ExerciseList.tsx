import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { Circle, CircleCheck, CircleSlash, Ellipsis, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ExerciseId, LoggedSet } from '@powr/domain';
import type { SlotCandidate } from '@powr/domain/planning';
import type { ExerciseView, NoteTarget, PlannedSetView, SessionView } from '@powr/domain/session';

import { Badge, Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { ChoiceCards } from '#ui/choice';
import { cn } from '#ui/cn';
import { Field } from '#ui/field';
import { Sheet } from '#ui/sheet';
import { Stepper } from '#ui/stepper';

import { useCatalog } from '../../hooks/use-planning';
import { useSessionUseCases } from '../../hooks/use-workout';
import { formatClock } from '../../i18n/format';
import { useLabels } from '../labels';
import { useEffortWords } from '../settings/effort';
import { useSessionCommands } from './commands';
import { useLoadSteps, type LoadImplement } from './loads';
import { massText, useSessionWords } from './words';

type SheetState =
  | { readonly kind: 'options'; readonly slotKey: string }
  | { readonly kind: 'swap'; readonly slotKey: string }
  | { readonly kind: 'rest'; readonly slotKey: string }
  | { readonly kind: 'note'; readonly target: NoteTarget; readonly current: string }
  | { readonly kind: 'edit'; readonly set: LoggedSet }
  | { readonly kind: 'add' }
  | { readonly kind: 'finish' }
  | { readonly kind: 'discard' }
  | null;

/**
 * WKT-02 the exercise list and progress, WKT-09 on-the-fly changes with buttons (move up and
 * down, skip, add and remove sets and exercises, never drag-only), WKT-05 supersets, WKT-08
 * swaps, WKT-10 notes, WKT-11 per-side logging, WKT-06 warm-ups, and editing a logged set.
 */
export function ExerciseList({
  view,
  implementsMap,
}: {
  view: SessionView;
  implementsMap: ReadonlyMap<ExerciseId, LoadImplement>;
}) {
  const { t } = useLingui();
  const [sheet, setSheet] = useState<SheetState>(null);
  const { dispatch } = useSessionCommands();
  if (view.exercises.length === 0) return null;
  const close = () => setSheet(null);
  return (
    <section
      aria-labelledby="exercise-list"
      className="flex flex-col gap-3"
      data-testid="session-sets"
    >
      <h2 id="exercise-list" className="text-lg font-bold">
        <Trans>Exercises</Trans>
      </h2>
      {view.exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.slot.key}
          view={view}
          exercise={exercise}
          position={index}
          onOptions={() => setSheet({ kind: 'options', slotKey: exercise.slot.key })}
          onEdit={(set) => setSheet({ kind: 'edit', set })}
          onPending={(planned) =>
            void dispatch({
              type: 'MOVE_CURSOR',
              slotKey: exercise.slot.key,
              setKey: planned.set.key,
            })
          }
        />
      ))}
      {sheet?.kind === 'options' ? (
        <OptionsSheet view={view} slotKey={sheet.slotKey} onClose={close} onSheet={setSheet} />
      ) : null}
      {sheet?.kind === 'swap' ? (
        <SwapSheet view={view} slotKey={sheet.slotKey} onClose={close} />
      ) : null}
      {sheet?.kind === 'rest' ? (
        <RestSheet view={view} slotKey={sheet.slotKey} onClose={close} />
      ) : null}
      {sheet?.kind === 'note' ? (
        <NoteSheet target={sheet.target} current={sheet.current} onClose={close} />
      ) : null}
      {sheet?.kind === 'edit' ? (
        <EditSetSheet
          set={sheet.set}
          implement={implementsMap.get(sheet.set.exerciseId) ?? null}
          onClose={close}
        />
      ) : null}
      <p className="sr-only">{t`End of the exercise list`}</p>
    </section>
  );
}

function ExerciseCard({
  view,
  exercise,
  position,
  onOptions,
  onEdit,
  onPending,
}: {
  view: SessionView;
  exercise: ExerciseView;
  position: number;
  onOptions: () => void;
  onEdit: (set: LoggedSet) => void;
  onPending: (planned: PlannedSetView) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useSessionWords();
  const { slot } = exercise;
  const name = labels.exercise(slot.exerciseId);
  const working = exercise.sets.filter((entry) => entry.set.type !== 'warmup');
  const done = working.filter((entry) => entry.status === 'done').length;
  const total = working.length;
  const headingId = `exercise-${slot.key}`;
  const cursor = view.session.cursor;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-2 rounded-2xl bg-surface p-3',
        cursor?.slotKey === slot.key && 'border-2 border-primary',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 id={headingId} className="text-lg font-semibold">
            <span className="sr-only">{t`Exercise ${position + 1}:`} </span>
            {name}
          </h3>
          <p className="text-sm text-fg-muted">
            <Trans>
              {done} of {total} sets done
            </Trans>
          </p>
          <div className="flex flex-wrap gap-1">
            {exercise.groupKey ? (
              <Badge tone="info">
                <Trans>Superset</Trans>
              </Badge>
            ) : null}
            {slot.skipped ? (
              <Badge>
                <Trans>Skipped</Trans>
              </Badge>
            ) : null}
            {slot.substitutedFrom ? (
              <Badge>
                <Trans>Swapped</Trans>
              </Badge>
            ) : null}
          </div>
          {slot.note ? (
            <p className="text-sm">
              <Trans>Note: {slot.note}</Trans>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={t`Options for ${name}`}
          aria-haspopup="dialog"
          onClick={onOptions}
          className="flex size-target shrink-0 items-center justify-center rounded-xl border border-control"
        >
          <Ellipsis aria-hidden="true" />
        </button>
      </div>
      <ol className="flex flex-col gap-1">
        {exercise.sets.map((planned, index) => {
          const current = cursor?.slotKey === slot.key && cursor.setKey === planned.set.key;
          const warmup = planned.set.type === 'warmup';
          const number = exercise.sets
            .slice(0, index + 1)
            .filter((entry) => (entry.set.type === 'warmup') === warmup).length;
          return (
            <li key={planned.set.key}>
              <SetRow
                planned={planned}
                number={number}
                current={current}
                typeName={words.setType(planned.set.type)}
                onEdit={onEdit}
                onPending={() => onPending(planned)}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SetRow({
  planned,
  number,
  current,
  typeName,
  onEdit,
  onPending,
}: {
  planned: PlannedSetView;
  number: number;
  current: boolean;
  typeName: string;
  onEdit: (set: LoggedSet) => void;
  onPending: () => void;
}) {
  const { t } = useLingui();
  const words = useSessionWords();
  const { logged, status } = planned;
  const warmup = planned.set.type === 'warmup';
  const label = warmup ? t`Warm-up ${number}` : t`Set ${number}`;
  const { valuesText, suggestionText } = useSetTexts();
  const values = logged
    ? valuesText(logged)
    : planned.suggestion
      ? suggestionText(planned.suggestion.value)
      : '';
  const Icon = status === 'done' ? CircleCheck : status === 'skipped' ? CircleSlash : Circle;
  const statusText =
    status === 'done'
      ? t`done`
      : status === 'skipped'
        ? t`skipped`
        : current
          ? t`current`
          : t`to do`;
  return (
    <button
      type="button"
      data-testid={logged && status === 'done' ? 'logged-set' : undefined}
      aria-current={current ? 'step' : undefined}
      onClick={() => (logged ? onEdit(logged) : onPending())}
      className={cn(
        'flex min-h-target w-full items-center gap-2 rounded-xl border border-control px-2 text-left',
        current && 'border-2 border-primary',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('size-5 shrink-0', status === 'done' ? 'text-success' : 'text-fg-muted')}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">
          {label}
          {warmup || planned.set.type === 'working' ? '' : ` · ${typeName}`}
          <span className="sr-only">{`, ${statusText}`}</span>
        </span>
        <span className="text-sm text-fg-muted tabular">{values}</span>
      </span>
      {planned.prs.length > 0 ? (
        <span className="flex items-center gap-1 text-sm font-semibold text-success">
          <Trophy aria-hidden="true" className="size-4" />
          <Trans>PR</Trans>
          <span className="sr-only">{planned.prs.map((pr) => words.pr(pr)).join('; ')}</span>
        </span>
      ) : null}
    </button>
  );
}

/** A logged set and a suggestion in short words: "100 kg × 5 @ RIR 2" (or "@ RPE 8", SET-05). */
function useSetTexts() {
  const { t } = useLingui();
  const effortWords = useEffortWords();
  const valuesText = (set: LoggedSet): string => {
    if (set.state === 'skipped') return '';
    const load = massText(set.load);
    const reps =
      set.repsLeft !== undefined && set.repsRight !== undefined
        ? `${set.repsLeft}/${set.repsRight}`
        : set.reps === null
          ? ''
          : String(set.reps);
    const duration = set.durationMs === undefined ? '' : formatClock(set.durationMs, 'down');
    const main = [load, reps ? `× ${reps}` : '', duration].filter(Boolean).join(' ');
    if (set.effort.rir === null) return main;
    const effort = effortWords.value(set.effort.rir, set.effort.openEnded === true);
    return t`${main} @ ${effort}`;
  };
  const suggestionText = (value: {
    load: LoggedSet['load'];
    reps: number | null;
    rir: number | null;
  }): string => {
    const load = massText(value.load);
    const main = [load, value.reps === null ? '' : `× ${value.reps}`].filter(Boolean).join(' ');
    if (value.rir === null) return main;
    const effort = effortWords.value(value.rir);
    return t`${main} @ ${effort}`;
  };
  return { valuesText, suggestionText };
}

/** The actions of one exercise (WKT-05, 06, 08, 09, 10, 11, TMR-03). */
function OptionsSheet({
  view,
  slotKey,
  onClose,
  onSheet,
}: {
  view: SessionView;
  slotKey: string;
  onClose: () => void;
  onSheet: (sheet: SheetState) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const catalog = useCatalog();
  const { dispatch } = useSessionCommands();
  const words = useSessionWords();
  const [error, setError] = useState<string | null>(null);
  const index = view.exercises.findIndex((entry) => entry.slot.key === slotKey);
  const exercise = view.exercises[index];
  if (!exercise) return null;
  const { slot } = exercise;
  const name = labels.exercise(slot.exerciseId);
  const order = view.exercises.map((entry) => entry.slot.key);
  const next = view.exercises[index + 1];
  const group = view.session.groups.find((entry) => entry.slotKeys.includes(slotKey));
  const hasLogged = exercise.sets.some((entry) => entry.status !== 'pending');
  const pending = exercise.sets.filter((entry) => entry.status === 'pending');
  const lastPending = pending.at(-1);
  const unilateral = catalog.exercise(slot.exerciseId)?.load.unilateral === true;
  const hasWarmups = exercise.sets.some((entry) => entry.set.type === 'warmup');

  const act = async (event: Parameters<typeof dispatch>[0]) => {
    setError(null);
    const outcome = await dispatch(event);
    if (outcome.ok) onClose();
    else
      setError(
        outcome.error.kind === 'rejected'
          ? words.rejection(outcome.error.rejection)
          : t`This workout has already ended.`,
      );
  };
  const move = (delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const reordered = [...order];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    void act({ type: 'REORDER', order: reordered });
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={name}
      closeLabel={t`Close`}
    >
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <div className="flex flex-col gap-2">
        <Button onClick={() => onSheet({ kind: 'swap', slotKey })}>
          <Trans>Swap exercise</Trans>
        </Button>
        <Button onClick={() => void act({ type: 'ADD_SET', slotKey })}>
          <Trans>Add a set</Trans>
        </Button>
        {lastPending && pending.length > 0 ? (
          <Button
            onClick={() => void act({ type: 'REMOVE_SET', slotKey, setKey: lastPending.set.key })}
          >
            <Trans>Remove the last open set</Trans>
          </Button>
        ) : null}
        {hasWarmups ? null : (
          <Button onClick={() => void act({ type: 'GENERATE_WARMUPS', slotKey })}>
            <Trans>Add warm-up sets</Trans>
          </Button>
        )}
        <Button onClick={() => onSheet({ kind: 'rest', slotKey })}>
          <Trans>Rest time</Trans>
        </Button>
        {unilateral ? (
          <Button
            onClick={() =>
              void act({ type: 'SET_PER_SIDE', slotKey, perSide: slot.perSide !== true })
            }
          >
            {slot.perSide ? (
              <Trans>Log both sides together</Trans>
            ) : (
              <Trans>Log left and right separately</Trans>
            )}
          </Button>
        ) : null}
        {group ? (
          <Button onClick={() => void act({ type: 'UNGROUP', groupKey: group.key })}>
            <Trans>Remove from the superset</Trans>
          </Button>
        ) : next && !view.session.groups.some((entry) => entry.slotKeys.includes(next.slot.key)) ? (
          <Button
            onClick={() =>
              void act({ type: 'GROUP', kind: 'superset', slotKeys: [slotKey, next.slot.key] })
            }
          >
            <Trans>Superset with {labels.exercise(next.slot.exerciseId)}</Trans>
          </Button>
        ) : null}
        <Button
          onClick={() =>
            onSheet({
              kind: 'note',
              target: { kind: 'exercise', slotKey },
              current: slot.note ?? '',
            })
          }
        >
          <Trans>Note on this exercise</Trans>
        </Button>
        <Button disabled={index === 0} onClick={() => move(-1)}>
          <Trans>Move up</Trans>
        </Button>
        <Button disabled={index === order.length - 1} onClick={() => move(1)}>
          <Trans>Move down</Trans>
        </Button>
        {pending.length > 0 ? (
          <Button onClick={() => void act({ type: 'SKIP_EXERCISE', slotKey })}>
            <Trans>Skip this exercise</Trans>
          </Button>
        ) : null}
        {hasLogged ? null : (
          <Button variant="danger" onClick={() => void act({ type: 'REMOVE_EXERCISE', slotKey })}>
            <Trans>Remove from this workout</Trans>
          </Button>
        )}
      </div>
    </Sheet>
  );
}

/** WKT-08: ranked alternatives (MAP-03) with the reason, for this session or the mesocycle. */
function SwapSheet({
  view,
  slotKey,
  onClose,
}: {
  view: SessionView;
  slotKey: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const catalog = useCatalog();
  const run = useSessionUseCases();
  const { dispatch } = useSessionCommands();
  const [candidates, setCandidates] = useState<readonly SlotCandidate[] | null>(null);
  const [scope, setScope] = useState<'session' | 'mesocycle'>('session');
  const [busy, setBusy] = useState(false);
  const slot = view.session.exercises.find((entry) => entry.key === slotKey);
  useEffect(() => {
    let cancelled = false;
    void run((session, deps) => session.substitutionOptions(deps, slotKey)).then((list) => {
      if (!cancelled) setCandidates(list);
    });
    return () => {
      cancelled = true;
    };
  }, [run, slotKey]);
  if (!slot) return null;
  const current = catalog.exercise(slot.exerciseId);
  const name = labels.exercise(slot.exerciseId);
  const reason = (id: ExerciseId): string => {
    const candidate = catalog.exercise(id);
    if (!candidate || !current) return '';
    if (candidate.pattern === current.pattern) {
      const pattern = labels.pattern(current.pattern);
      return t`Same movement (${pattern})`;
    }
    const shared = candidate.muscles
      .filter((credit) => credit.credit === 1)
      .find((credit) =>
        current.muscles.some((own) => own.credit === 1 && own.muscle === credit.muscle),
      );
    if (shared) {
      const muscle = labels.muscle(shared.muscle);
      return t`Trains the ${muscle} directly`;
    }
    return t`A related exercise for your equipment`;
  };
  const swap = async (exerciseId: ExerciseId) => {
    setBusy(true);
    const outcome = await dispatch({ type: 'SUBSTITUTE', slotKey, exerciseId, scope });
    setBusy(false);
    if (outcome.ok) onClose();
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={t`Swap ${name}`}
      description={t`Best matches first: the same movement, then exercises for the same muscles, all with your equipment.`}
      closeLabel={t`Close`}
    >
      {view.session.plannedSessionId && slot.planSlotKey ? (
        <ChoiceCards
          legend={t`For how long?`}
          value={scope}
          onChange={setScope}
          options={[
            { value: 'session', label: t`This workout only` },
            {
              value: 'mesocycle',
              label: t`For the rest of this block`,
              description: t`Also changes the planned workouts of this block. This cannot be undone.`,
            },
          ]}
        />
      ) : null}
      {candidates === null ? (
        <p>
          <Trans>Finding alternatives…</Trans>
        </p>
      ) : candidates.length === 0 ? (
        <p>
          <Trans>No alternative fits your equipment.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="swap-options">
          {candidates.slice(0, 12).map((candidate, index) => {
            const option = labels.exercise(candidate.exerciseId);
            return (
              <li key={candidate.exerciseId}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void swap(candidate.exerciseId)}
                  className="flex min-h-target w-full flex-col items-start rounded-xl border border-control px-3 py-2 text-left"
                >
                  <span className="font-semibold">
                    {index === 0 ? <Trans>Best match: {option}</Trans> : option}
                  </span>
                  <span className="text-sm text-fg-muted">{reason(candidate.exerciseId)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

/** TMR-02/03: the rest after this exercise's working sets for this session. */
function RestSheet({
  view,
  slotKey,
  onClose,
}: {
  view: SessionView;
  slotKey: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const { dispatch } = useSessionCommands();
  const slot = view.session.exercises.find((entry) => entry.key === slotKey);
  const [seconds, setSeconds] = useState<number | null>(slot?.restSeconds ?? null);
  if (!slot) return null;
  const name = labels.exercise(slot.exerciseId);
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={t`Rest after ${name}`}
      closeLabel={t`Close`}
    >
      <Stepper
        label={t`Seconds of rest`}
        value={seconds}
        onChange={setSeconds}
        onStep={(direction, current) =>
          Math.max(0, Math.min(1800, (current ?? 120) + direction * 15))
        }
        decrementLabel={t`15 seconds less rest`}
        incrementLabel={t`15 seconds more rest`}
        decimal={false}
        max={1800}
        hint={
          seconds === null ? t`Empty: the evidence-based default for this exercise.` : undefined
        }
      />
      <Button
        variant="primary"
        onClick={() =>
          void dispatch({ type: 'SET_REST', slotKey, seconds }).then((outcome) => {
            if (outcome.ok) onClose();
          })
        }
      >
        <Trans>Save rest time</Trans>
      </Button>
      <Button
        onClick={() =>
          void dispatch({ type: 'SET_REST', slotKey, seconds: null }).then((outcome) => {
            if (outcome.ok) onClose();
          })
        }
      >
        <Trans>Use the default</Trans>
      </Button>
    </Sheet>
  );
}

/** WKT-10: a note on the session, an exercise or a set. */
function NoteSheet({
  target,
  current,
  onClose,
}: {
  target: NoteTarget;
  current: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const { dispatch } = useSessionCommands();
  const [note, setNote] = useState(current);
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={target.kind === 'session' ? t`Workout note` : t`Exercise note`}
      closeLabel={t`Close`}
    >
      <Field
        label={t`Note`}
        hint={target.kind === 'exercise' ? t`Shown next time you do this exercise.` : undefined}
        value={note}
        maxLength={2000}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        variant="primary"
        onClick={() =>
          void dispatch({ type: 'SET_NOTE', target, note: note.trim() || null }).then((outcome) => {
            if (outcome.ok) onClose();
          })
        }
      >
        <Trans>Save note</Trans>
      </Button>
    </Sheet>
  );
}

/** Edit or delete a logged set of this session (EDIT_SET, DELETE_SET; undoable). */
function EditSetSheet({
  set,
  implement,
  onClose,
}: {
  set: LoggedSet;
  implement: LoadImplement | null;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useSessionWords();
  const { dispatch } = useSessionCommands();
  const unit = set.load?.unit ?? 'kg';
  const [load, setLoad] = useState<number | null>(set.load ? Math.abs(set.load.value) : null);
  const [reps, setReps] = useState<number | null>(set.reps);
  const [rir, setRir] = useState<number | null>(set.effort.rir);
  const [error, setError] = useState<string | null>(null);
  const stepLoad = useLoadSteps(implement, unit);
  const negative = (set.load?.value ?? 0) < 0;
  const name = labels.exercise(set.exerciseId);
  const save = async () => {
    const outcome = await dispatch({
      type: 'EDIT_SET',
      setId: set.id,
      values: {
        load: load === null ? null : { value: negative ? -load : load, unit },
        reps,
        rir,
      },
    });
    if (outcome.ok) onClose();
    else
      setError(
        outcome.error.kind === 'rejected'
          ? words.rejection(outcome.error.rejection)
          : t`This workout has already ended.`,
      );
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={t`Edit set`}
      description={name}
      closeLabel={t`Close`}
    >
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {set.load === null ? null : (
        <Stepper
          label={t`Weight (${unit})`}
          value={load}
          onChange={setLoad}
          onStep={stepLoad}
          decrementLabel={t`Less weight`}
          incrementLabel={t`More weight`}
          max={2000}
        />
      )}
      <Stepper
        label={t`Reps`}
        value={reps}
        onChange={setReps}
        onStep={(direction, current) => Math.max(0, (current ?? 0) + direction)}
        decrementLabel={t`One rep fewer`}
        incrementLabel={t`One rep more`}
        decimal={false}
        max={1000}
      />
      <Stepper
        label={t`Reps in reserve`}
        value={rir}
        onChange={setRir}
        onStep={(direction, current) => Math.max(0, Math.min(10, (current ?? 2) + direction * 0.5))}
        decrementLabel={t`Half a rep less in reserve`}
        incrementLabel={t`Half a rep more in reserve`}
        max={10}
      />
      <Button variant="primary" onClick={() => void save()}>
        <Trans>Save set</Trans>
      </Button>
      <Button
        variant="danger"
        onClick={() =>
          void dispatch({ type: 'DELETE_SET', setId: set.id }).then((outcome) => {
            if (outcome.ok) onClose();
          })
        }
      >
        <Trans>Delete set</Trans>
      </Button>
    </Sheet>
  );
}

/** Add exercise, the workout note, finish and discard (WKT-09, WKT-10, WKT-13). */
export function SessionActions({ view }: { view: SessionView }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { finish, discard } = useSessionCommands();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [busy, setBusy] = useState(false);
  const close = () => setSheet(null);
  const pending = view.exercises.reduce(
    (sum, exercise) =>
      sum +
      exercise.sets.filter((entry) => entry.status === 'pending' && entry.set.type !== 'warmup')
        .length,
    0,
  );
  const sessionId = view.session.id;
  const end = async (as: 'finished' | 'partial') => {
    setBusy(true);
    const outcome = await finish(as);
    setBusy(false);
    if (outcome.ok) void navigate({ to: '/session/summary/$sessionId', params: { sessionId } });
  };
  return (
    <section aria-label={t`Workout actions`} className="flex flex-col gap-2">
      <Button onClick={() => setSheet({ kind: 'add' })}>
        <Trans>Add exercise</Trans>
      </Button>
      <Button
        onClick={() =>
          setSheet({ kind: 'note', target: { kind: 'session' }, current: view.session.note ?? '' })
        }
      >
        <Trans>Workout note</Trans>
      </Button>
      <Button onClick={() => setSheet({ kind: 'finish' })}>
        <Trans>Finish workout</Trans>
      </Button>
      <Button variant="ghost" className="text-danger" onClick={() => setSheet({ kind: 'discard' })}>
        <Trans>Discard workout</Trans>
      </Button>

      {sheet?.kind === 'add' ? <AddExerciseSheet onClose={close} /> : null}
      {sheet?.kind === 'note' ? (
        <NoteSheet target={sheet.target} current={sheet.current} onClose={close} />
      ) : null}
      {sheet?.kind === 'finish' ? (
        <Sheet
          open
          onOpenChange={(open) => (open ? null : close())}
          title={t`Finish workout?`}
          closeLabel={t`Close`}
        >
          {pending > 0 ? (
            <p>
              <Plural
                value={pending}
                one="# planned set is not done. Finish anyway, or mark the workout as partial."
                other="# planned sets are not done. Finish anyway, or mark the workout as partial."
              />
            </p>
          ) : (
            <p>
              <Trans>Every planned set is done.</Trans>
            </p>
          )}
          <Button variant="primary" size="lg" disabled={busy} onClick={() => void end('finished')}>
            <Trans>Finish workout</Trans>
          </Button>
          {pending > 0 ? (
            <Button disabled={busy} onClick={() => void end('partial')}>
              <Trans>Finish as partial</Trans>
            </Button>
          ) : null}
          <Button variant="ghost" onClick={close}>
            <Trans>Keep training</Trans>
          </Button>
        </Sheet>
      ) : null}
      {sheet?.kind === 'discard' ? (
        <Sheet
          open
          onOpenChange={(open) => (open ? null : close())}
          title={t`Discard this workout?`}
          description={t`The sets you logged in it are not kept for your progress. This cannot be undone.`}
          closeLabel={t`Close`}
        >
          <Button
            variant="danger"
            size="lg"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void discard().then((outcome) => {
                setBusy(false);
                if (outcome.ok) void navigate({ to: '/' });
              });
            }}
          >
            <Trans>Discard workout</Trans>
          </Button>
          <Button onClick={close}>
            <Trans>Keep the workout</Trans>
          </Button>
        </Sheet>
      ) : null}
    </section>
  );
}

/** WKT-09: add an exercise on the fly (search by name and synonym). */
function AddExerciseSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLingui();
  const catalog = useCatalog();
  const { dispatch } = useSessionCommands();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = catalog
    .exercises()
    .filter((exercise) => exercise.status === 'active')
    .filter(
      (exercise) =>
        needle === '' ||
        exercise.name.en.toLowerCase().includes(needle) ||
        exercise.synonyms.some((synonym) => synonym.toLowerCase().includes(needle)),
    )
    .toSorted((a, b) => a.name.en.localeCompare(b.name.en))
    .slice(0, 30);
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={t`Add exercise`}
      closeLabel={t`Close`}
    >
      <Field
        label={t`Search exercises`}
        type="search"
        value={query}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className="flex flex-col gap-1" data-testid="add-exercise-options">
        {matches.map((exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              onClick={() =>
                void dispatch({ type: 'ADD_EXERCISE', exerciseId: exercise.id }).then((outcome) => {
                  if (outcome.ok) onClose();
                })
              }
              className="flex min-h-target w-full items-center rounded-xl border border-control px-3 text-left font-medium"
            >
              {exercise.name.en}
            </button>
          </li>
        ))}
      </ul>
      {matches.length === 0 ? (
        <p>
          <Trans>No exercise matches.</Trans>
        </p>
      ) : null}
    </Sheet>
  );
}
