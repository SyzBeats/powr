import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { Check, CircleAlert, Layers, Trophy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ExerciseId, Mass } from '@powr/domain';
import type { Explained } from '@powr/domain/explain';
import { implementUnit } from '@powr/domain/loading';
import type { Technique } from '@powr/domain/rules';
import type {
  ExerciseView,
  PlannedSetView,
  PlausibilityIssue,
  SessionEvent,
  SessionView,
  SetInput,
  SetSuggestion,
} from '@powr/domain/session';

import { Badge, Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { cn } from '#ui/cn';
import { Dock } from '#ui/dock';
import { Card, Screen } from '#ui/screen';
import { Sheet } from '#ui/sheet';
import { Stepper } from '#ui/stepper';

import { useCatalog } from '../../hooks/use-planning';
import { useDisplayPreferences } from '../../hooks/use-settings';
import { useTimerDisplay } from '../../hooks/use-timers';
import { useSessionUseCases } from '../../hooks/use-workout';
import { formatClock, formatLocalDate, formatMass, formatMinutes } from '../../i18n/format';
import { useLabels } from '../labels';
import { useLargeControls } from '../settings/display';
import { rpeOf, useEffortWords } from '../settings/effort';
import { WhyButton, WhyText } from '../why/WhySheet';
import { useSessionCommands } from './commands';
import { ExerciseList, SessionActions } from './ExerciseList';
import { useLoadSteps, PlatesButton, type LoadImplement } from './loads';
import { useSessionPreferences } from './preferences';
import { RestPanel } from './RestPanel';
import { useSessionUi } from './session-ui';
import { sessionClock } from './SessionRuntime';
import { SetDetailsSheet, type SetExtras } from './SetDetailsSheet';
import { SetTimerButton, TempoCues } from './timed-set';
import { massText, useSessionWords } from './words';

/**
 * The logging view of the session screen (WKT-02…12, TMR-01…11; §8.9.4): the top of the screen
 * informs (clock, PR card, the current exercise and set with its prescription, "Why?", plates,
 * last time and cues), the dock at the bottom holds every primary control (rest timer, undo,
 * load and reps steppers, the effort chips and "Confirm set"), and the exercise list below lets
 * the user move, skip, add, swap and edit with buttons (never drag-only).
 */
export function LoggingView({ view }: { view: SessionView }) {
  const { t } = useLingui();
  useLargeControls();
  const implementsMap = useSessionImplements(view);
  const cursor = view.session.cursor;
  const exercise = cursor
    ? view.exercises.find((entry) => entry.slot.key === cursor.slotKey)
    : undefined;
  const planned = cursor
    ? exercise?.sets.find((entry) => entry.set.key === cursor.setKey)
    : undefined;
  const suggestion = view.current;
  const entryKey =
    cursor && suggestion
      ? `${cursor.slotKey}/${cursor.setKey}/${suggestion.value.load?.value ?? '-'}/${suggestion.value.reps ?? '-'}/${suggestion.value.rir ?? '-'}/${exercise?.slot.perSide === true}`
      : 'none';

  return (
    <Screen title={t`Workout`}>
      <ClockLine view={view} />
      <Celebration />
      <ResumeBanner view={view} />
      {exercise && planned && suggestion ? (
        <CurrentSet
          key={entryKey}
          view={view}
          exercise={exercise}
          planned={planned}
          suggestion={suggestion}
          implement={implementsMap.get(exercise.slot.exerciseId) ?? null}
        />
      ) : (
        <AllDone view={view} />
      )}
      <Hints />
      <ExerciseList view={view} implementsMap={implementsMap} />
      <SessionActions view={view} />
    </Screen>
  );
}

/** The load implements of the session's exercises (WKT-07 steps and plates), refreshed on change. */
function useSessionImplements(view: SessionView): ReadonlyMap<ExerciseId, LoadImplement> {
  const run = useSessionUseCases();
  const ids = [...new Set(view.session.exercises.map((slot) => slot.exerciseId))].toSorted();
  const idsKey = ids.join(',');
  const [loaded, setLoaded] = useState<{
    key: string;
    map: ReadonlyMap<ExerciseId, LoadImplement>;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const list = idsKey === '' ? [] : (idsKey.split(',') as ExerciseId[]);
    void run((session, deps) => session.loadImplements(deps, list)).then((map) => {
      if (!cancelled) setLoaded({ key: idsKey, map });
    });
    return () => {
      cancelled = true;
    };
  }, [run, idsKey]);
  return loaded?.map ?? EMPTY_IMPLEMENTS;
}

const EMPTY_IMPLEMENTS: ReadonlyMap<ExerciseId, LoadImplement> = new Map();

const dismissResumed = () => useSessionUi.setState({ resumed: null });

/**
 * WCAG 2.4.3: a confirmed set re-mounts the card and its dock for the next set (or the "all done"
 * state), so the button that had focus is gone. The new dock takes focus back on its primary
 * control ("Confirm set", else its first field), so keyboard and switch users carry on in place.
 */
function useFocusAfterConfirm() {
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!useSessionUi.getState().focusDock) return;
    useSessionUi.setState({ focusDock: false });
    const root = dock.current;
    const primary = root?.querySelector<HTMLElement>('[data-primary]:not(:disabled)');
    (primary ?? root?.querySelector<HTMLElement>('input,button:not(:disabled)'))?.focus();
  }, []);
  return dock;
}

const dismissHint = (index: number) =>
  useSessionUi.setState((state) => ({
    hints: state.hints.filter((_, position) => position !== index),
  }));

/** WKT-14: "Workout resumed" after a reload, and the stale prompt after 6 hours. */
function ResumeBanner({ view }: { view: SessionView }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { finish } = useSessionCommands();
  const resumed = useSessionUi((state) =>
    state.resumed?.sessionId === view.session.id ? state.resumed : null,
  );
  const [busy, setBusy] = useState(false);
  if (!resumed) return null;
  return (
    <Callout tone="info" title={t`Workout resumed`}>
      <p>
        {resumed.stale ? (
          <Trans>
            This workout has been open for more than 6 hours. Finish it at the last logged set?
          </Trans>
        ) : (
          <Trans>You are back where you left off. Timers kept running while POWR was closed.</Trans>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {resumed.stale ? (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void finish('finished', 'lastSet').then((outcome) => {
                setBusy(false);
                if (outcome.ok)
                  void navigate({
                    to: '/session/summary/$sessionId',
                    params: { sessionId: view.session.id },
                  });
              });
            }}
          >
            <Trans>Finish at the last logged set</Trans>
          </Button>
        ) : null}
        <Button onClick={dismissResumed}>
          {resumed.stale ? <Trans>Keep training</Trans> : <Trans>OK</Trans>}
        </Button>
      </div>
    </Callout>
  );
}

/** TMR-11: elapsed time and the estimated remaining time (PLN-14), in the session header. */
function ClockLine({ view }: { view: SessionView }) {
  const clock = useTimerDisplay(sessionClock(view));
  const elapsed = formatClock(clock.elapsedMs, 'down');
  const remaining = formatMinutes(view.clock.remainingS / 60);
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 text-fg-muted" data-testid="session-clock">
      <span>
        <Trans>
          Workout time <span className="text-lg font-bold text-fg tabular">{elapsed}</span>
        </Trans>
      </span>
      {view.clock.remainingS > 0 ? (
        <span>
          <Trans>About {remaining} left</Trans>
        </span>
      ) : null}
    </p>
  );
}

/**
 * MOT-02 (§8.9.6): the PR card at the top of the screen; it never covers the controls. A short
 * scale-and-glow animation, static under reduced motion (app.css zeroes every duration); a tap
 * dismisses it. The vibration, the sound and the announcement come from the effect runner.
 */
function Celebration() {
  const { t } = useLingui();
  const words = useSessionWords();
  const prs = useSessionUi((state) => state.celebration);
  // SET-10 (M5s): celebration animations can be switched off; the card still shows.
  const { celebrations } = useDisplayPreferences();
  if (!prs || prs.length === 0) return null;
  return (
    <div
      data-testid="pr-celebration"
      className={cn(
        'flex items-start gap-3 rounded-2xl border-2 border-success bg-surface p-3',
        celebrations && 'animate-[pr-pop_600ms_ease-out]',
      )}
    >
      <Trophy aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-pr-accent" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-bold">
          {prs.length === 1 ? (
            <Trans>New personal record</Trans>
          ) : (
            <Trans>New personal records: {prs.length}</Trans>
          )}
        </p>
        <ul className="text-sm">
          {prs.map((pr) => (
            <li key={pr.id}>{words.pr(pr)}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        aria-label={t`Dismiss`}
        onClick={() => useSessionUi.setState({ celebration: null })}
        className="flex size-target shrink-0 items-center justify-center rounded-xl"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

/** WKT-16: non-blocking hints after a set; each can be dismissed or turned off for good. */
function Hints() {
  const { t } = useLingui();
  const words = useSessionWords();
  const run = useSessionUseCases();
  const preferences = useSessionPreferences();
  const hints = useSessionUi((state) => state.hints).filter(
    (hint) => !preferences.hintsOff.includes(hint.kind),
  );
  if (hints.length === 0) return null;
  return (
    <section aria-label={t`Hints`} className="flex flex-col gap-2">
      {hints.map((hint, index) => (
        <Callout
          key={`${hint.kind}-${hint.slotKey}`}
          tone="warning"
          title={words.hintTitle(hint.kind)}
        >
          <p>
            <WhyText why={hint.why} />
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => dismissHint(index)}>
              <Trans>Dismiss</Trans>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                dismissHint(index);
                void run((session, deps) =>
                  session.updateSessionPreferences(deps, {
                    hintsOff: [...preferences.hintsOff, hint.kind],
                  }),
                );
              }}
            >
              <Trans>Don't show this hint again</Trans>
            </Button>
          </div>
        </Callout>
      ))}
    </section>
  );
}

interface Entry {
  readonly load: number | null;
  readonly reps: number | null;
  readonly repsLeft: number | null;
  readonly repsRight: number | null;
  readonly rir: number | null;
  readonly openEnded: boolean;
  readonly durationS: number | null;
  readonly extras: SetExtras;
}

/*
 * Per-side reps (WKT-11): the left and right steppers share one row at 360 px (each field ≥ 48 px,
 * NFR-A11Y-02) and wrap onto their own rows at 320 px or 200% text (NFR-A11Y-07).
 */
const repsStepperClass = 'min-w-0 flex-[1_1_10rem]';

type RirChip = '0' | '1' | '2' | '3' | '4' | '5+';
const RIR_CHIPS: readonly RirChip[] = ['0', '1', '2', '3', '4', '5+'];

/** The current set: its information at the top and its controls in the dock. */
function CurrentSet({
  view,
  exercise,
  planned,
  suggestion,
  implement,
}: {
  view: SessionView;
  exercise: ExerciseView;
  planned: PlannedSetView;
  suggestion: Explained<SetSuggestion>;
  implement: LoadImplement | null;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useSessionWords();
  const { dispatch } = useSessionCommands();
  const prescriptionText = usePrescriptionText();
  const { slot } = exercise;
  const definition = useExerciseDef(slot.exerciseId);
  const name = labels.exercise(slot.exerciseId);
  const value = suggestion.value;
  const assisted = definition?.load.type === 'bodyweightAssisted';
  const loadless =
    definition !== undefined &&
    (definition.load.type === 'band' ||
      definition.load.type === 'timed' ||
      ((definition.load.type === 'bodyweightAdded' || assisted) &&
        !definition.load.bodyweightLoaded));
  const timed = planned.set.durationS !== undefined || value.durationS !== null;
  const perSide = slot.perSide === true;
  const unit: Mass['unit'] =
    value.load?.unit ?? (implement ? implementUnit(implement.implement) : 'kg');
  const [entry, setEntry] = useState<Entry>(() => ({
    load: value.load === null ? null : Math.abs(value.load.value),
    reps: value.reps,
    repsLeft: value.reps,
    repsRight: value.reps,
    rir: value.rir,
    openEnded: false,
    durationS: value.durationS,
    extras: {
      type: value.type,
      technique: value.technique ?? null,
      flags: {},
      note: '',
      rated: value.rir !== null || value.rirRange !== null,
    },
  }));
  const [busy, setBusy] = useState(false);
  const focusRoot = useFocusAfterConfirm();
  const [error, setError] = useState<string | null>(null);
  const [implausible, setImplausible] = useState<readonly PlausibilityIssue[] | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const stepLoad = useLoadSteps(implement, unit);
  const update = (patch: Partial<Entry>) => setEntry((current) => ({ ...current, ...patch }));

  const needsLoad = !loadless && !timed && entry.load === null;
  const ofSameKind = exercise.sets.filter((set) =>
    planned.set.type === 'warmup' ? set.set.type === 'warmup' : set.set.type !== 'warmup',
  );
  const number = ofSameKind.indexOf(planned) + 1;
  const total = ofSameKind.length;

  const values = (): SetInput => {
    const technique: Technique | null = entry.extras.technique;
    const rir = entry.extras.rated ? entry.rir : null;
    return {
      load:
        loadless || entry.load === null
          ? null
          : { value: assisted ? -Math.abs(entry.load) : entry.load, unit },
      reps: perSide || timed ? null : entry.reps,
      rir,
      ...(entry.openEnded && rir !== null ? { openEnded: true } : {}),
      ...(perSide && entry.repsLeft !== null && entry.repsRight !== null
        ? { repsLeft: entry.repsLeft, repsRight: entry.repsRight }
        : {}),
      ...(timed && entry.durationS !== null
        ? { durationMs: Math.round(entry.durationS * 1000) }
        : {}),
      ...(technique ? { technique } : {}),
      ...(Object.values(entry.extras.flags).some(Boolean) ? { flags: entry.extras.flags } : {}),
      ...(entry.extras.note.trim() ? { note: entry.extras.note.trim() } : {}),
      ...(entry.extras.type === planned.set.type ? {} : { type: entry.extras.type }),
    };
  };

  const confirm = async (confirmImplausible = false) => {
    setBusy(true);
    setError(null);
    const event: SessionEvent = {
      type: 'CONFIRM_SET',
      slotKey: slot.key,
      setKey: planned.set.key,
      values: values(),
      ...(confirmImplausible ? { confirmImplausible: true } : {}),
    };
    // Set before the commit: the live view may re-mount the next set's card before it resolves.
    useSessionUi.setState({ focusDock: true });
    const outcome = await dispatch(event);
    setBusy(false);
    if (!outcome.ok) useSessionUi.setState({ focusDock: false });
    if (outcome.ok) {
      setImplausible(null);
      return;
    }
    if (outcome.error.kind === 'rejected' && outcome.error.rejection.kind === 'implausible') {
      setImplausible(outcome.error.rejection.issues);
      return;
    }
    setError(
      outcome.error.kind === 'rejected'
        ? words.rejection(outcome.error.rejection)
        : t`This workout has already ended.`,
    );
  };

  const simple = (event: SessionEvent) => void dispatch(event);

  const target = prescriptionText(value);
  const last = exercise.lastTime;
  const loadLabel = assisted
    ? t`Assistance`
    : definition?.load.type === 'bodyweightAdded'
      ? t`Added weight`
      : t`Weight`;

  return (
    <>
      <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4" data-testid="current-set">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold">{name}</h2>
          {exercise.groupKey ? (
            <Badge tone="info" icon={Layers}>
              <Trans>Superset</Trans>
            </Badge>
          ) : null}
        </div>
        <p className="font-semibold">
          {planned.set.type === 'warmup' ? (
            <Trans>
              Warm-up {number} of {total}
            </Trans>
          ) : (
            <Trans>
              Set {number} of {total}
            </Trans>
          )}
          {planned.set.type === 'working' || planned.set.type === 'warmup'
            ? null
            : ` · ${words.setType(planned.set.type)}`}
        </p>
        {target ? <p data-testid="prescription">{target}</p> : null}
        {definition && !timed ? <TempoCues tempo={definition.defaults.tempo} /> : null}
        <div className="flex flex-wrap items-center gap-1">
          <WhyButton why={suggestion.why} subject={name} />
          {implement?.implement.kind === 'barbell' && entry.load !== null ? (
            <PlatesButton
              implement={implement}
              load={entry.load}
              onUse={(load) => update({ load })}
            />
          ) : null}
          <Button variant="ghost" onClick={() => setDetailsOpen(true)}>
            <Trans>Set details</Trans>
          </Button>
          <Button
            variant="ghost"
            onClick={() => simple({ type: 'SKIP_SET', slotKey: slot.key, setKey: planned.set.key })}
          >
            <Trans>Skip this set</Trans>
          </Button>
        </div>
        {exercise.calibration !== 'calibrated' && value.load === null && !loadless && !timed ? (
          <Callout tone="info" title={t`Pick a starting weight`}>
            <p>
              <Trans>
                Choose a weight you could lift about 12 times, and stop with 3 to 4 reps left in the
                tank. POWR learns your loads from these sets.
              </Trans>
            </p>
          </Callout>
        ) : null}
        {exercise.baselineOld ? (
          <p className="text-sm text-fg-muted">
            <Trans>
              You lifted this max a while ago. POWR starts from it and refines it automatically from
              the sets you log.
            </Trans>
          </p>
        ) : null}
        {last ? <LastTime last={last} /> : null}
        {definition && definition.cues.length > 0 ? (
          <details className="text-sm">
            <summary className="flex min-h-target cursor-pointer items-center font-semibold">
              <Trans>How to do it</Trans>
            </summary>
            <ul className="list-disc pl-5">
              {definition.cues.map((cue) => (
                <li key={cue.en}>{cue.en}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <RememberRest view={view} />
      </div>

      <Dock label={t`Log this set`} ref={focusRoot}>
        <RestPanel
          view={view}
          onSetTimerStopped={(elapsedMs) => update({ durationS: Math.round(elapsedMs / 1000) })}
          aside={<UndoButton view={view} />}
        />
        {view.session.timer ? null : <UndoBar view={view} />}
        {error ? (
          <p role="alert" className="flex items-start gap-1 text-sm font-medium text-danger">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {loadless || timed ? null : (
            <Stepper
              inline
              label={`${loadLabel} (${unit})`}
              value={entry.load}
              onChange={(load) => update({ load })}
              onStep={stepLoad}
              decrementLabel={assisted ? t`Less assistance` : t`Less weight`}
              incrementLabel={assisted ? t`More assistance` : t`More weight`}
              max={2000}
            />
          )}
          {timed ? (
            <Stepper
              inline
              label={t`Seconds`}
              value={entry.durationS}
              onChange={(durationS) => update({ durationS })}
              onStep={(direction, current) => Math.max(0, (current ?? 0) + direction * 5)}
              decrementLabel={t`5 seconds less`}
              incrementLabel={t`5 seconds more`}
              decimal={false}
              max={3600}
            />
          ) : perSide ? (
            <div className="flex flex-wrap gap-2">
              <Stepper
                className={repsStepperClass}
                label={t`Reps left side`}
                value={entry.repsLeft}
                onChange={(repsLeft) => update({ repsLeft })}
                onStep={(direction, current) => Math.max(0, (current ?? 0) + direction)}
                decrementLabel={t`One rep fewer on the left`}
                incrementLabel={t`One rep more on the left`}
                decimal={false}
                max={1000}
              />
              <Stepper
                className={repsStepperClass}
                label={t`Reps right side`}
                value={entry.repsRight}
                onChange={(repsRight) => update({ repsRight })}
                onStep={(direction, current) => Math.max(0, (current ?? 0) + direction)}
                decrementLabel={t`One rep fewer on the right`}
                incrementLabel={t`One rep more on the right`}
                decimal={false}
                max={1000}
              />
            </div>
          ) : (
            <Stepper
              inline
              label={t`Reps`}
              value={entry.reps}
              onChange={(reps) => update({ reps })}
              onStep={(direction, current) => Math.max(0, (current ?? 0) + direction)}
              decrementLabel={t`One rep fewer`}
              incrementLabel={t`One rep more`}
              decimal={false}
              max={1000}
            />
          )}
        </div>
        {entry.extras.rated ? (
          <RirChips
            value={entry.rir}
            openEnded={entry.openEnded}
            onChange={(rir, openEnded) => update({ rir, openEnded })}
          />
        ) : null}
        {timed ? <SetTimerButton view={view} slotKey={slot.key} targetS={entry.durationS} /> : null}
        <Button
          variant="primary"
          size="lg"
          data-primary=""
          disabled={busy || needsLoad}
          onClick={() => void confirm()}
          aria-describedby={needsLoad ? 'confirm-needs-load' : undefined}
        >
          <Check aria-hidden="true" />
          <Trans>Confirm set</Trans>
        </Button>
        {needsLoad ? (
          <p id="confirm-needs-load" className="text-sm text-fg-muted">
            <Trans>Enter the weight first.</Trans>
          </p>
        ) : null}
      </Dock>

      <SetDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        exerciseName={name}
        plannedType={planned.set.type}
        extras={entry.extras}
        rir={entry.rir}
        onChange={(extras, rir) => update({ extras, rir })}
      />

      <Sheet
        open={implausible !== null}
        onOpenChange={(open) => (open ? null : setImplausible(null))}
        title={t`Check this set`}
        closeLabel={t`Close`}
      >
        <ul className="flex flex-col gap-1">
          {(implausible ?? []).map((issue) => (
            <li key={issue.kind}>
              <ImplausibleText issue={issue} />
            </li>
          ))}
        </ul>
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void confirm(true)}>
          <Trans>Log it anyway</Trans>
        </Button>
        <Button onClick={() => setImplausible(null)}>
          <Trans>Change the values</Trans>
        </Button>
      </Sheet>
    </>
  );
}

function ImplausibleText({ issue }: { issue: PlausibilityIssue }) {
  if (issue.kind === 'manyReps') {
    const reps = issue.reps;
    return <Trans>{reps} reps is more than 100. Is that right?</Trans>;
  }
  const e1rm = formatMass(Math.round(issue.e1rmKg * 10) / 10, 'kg');
  const factor = Math.round(issue.factor * 10) / 10;
  return (
    <Trans>
      That is {factor} times your estimated 1-rep max ({e1rm}). Is that right?
    </Trans>
  );
}

/** The prescription in words: "100 kg · 8–12 reps · 2 reps in reserve" (or "RPE 8", SET-05). */
function usePrescriptionText(): (value: SetSuggestion) => string | null {
  const { t } = useLingui();
  const effort = useEffortWords();
  return (value) => {
    const parts: string[] = [];
    const load = massText(value.load);
    if (load) parts.push(load);
    if (value.repRange) {
      const [low, high] = value.repRange;
      parts.push(low === high ? t`${low} reps` : t`${low}–${high} reps`);
    }
    if (value.durationS !== null) {
      const seconds = value.durationS;
      parts.push(t`${seconds} seconds`);
    }
    if (value.rirRange) {
      const [low, high] = value.rirRange;
      parts.push(effort.target(low, high));
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  };
}

/** WKT-02 "last time" with its note (WKT-10). */
function LastTime({ last }: { last: NonNullable<ExerciseView['lastTime']> }) {
  const date = formatLocalDate(last.localDate, 'short');
  const sets = last.sets
    .filter((set) => set.state === 'done')
    .map((set) => {
      const load = massText(set.load);
      const reps = set.reps ?? 0;
      return load ? `${load} × ${reps}` : `× ${reps}`;
    })
    .join(', ');
  return (
    <div className="text-sm" data-testid="last-time">
      <p>
        <span className="font-semibold">
          <Trans>Last time ({date}):</Trans>
        </span>{' '}
        {sets}
      </p>
      {last.note ? (
        <p className="text-fg-muted">
          <Trans>Note: {last.note}</Trans>
        </p>
      ) : null}
    </div>
  );
}

/**
 * WKT-03: the effort chips 0, 1, 2, 3, 4, 5+ (48 px, 8 px apart); a half step shows in the legend.
 * SET-05 (M5s): with RPE chosen the same six chips read 10, 9, 8, 7, 6 and "5 or less" (RPE =
 * 10 − RIR); with decimal entry a stepper in half steps replaces them. Stored effort stays RIR.
 */
function RirChips({
  value,
  openEnded,
  onChange,
}: {
  value: number | null;
  openEnded: boolean;
  onChange: (rir: number | null, openEnded: boolean) => void;
}) {
  const { t } = useLingui();
  const effort = useEffortWords();
  const rpe = effort.scale === 'rpe';
  if (effort.input === 'decimal')
    return (
      <Stepper
        inline
        label={rpe ? t`Effort (RPE)` : t`Reps in reserve`}
        value={value === null ? null : rpe ? rpeOf(value) : value}
        onChange={(next) =>
          onChange(
            next === null ? null : Math.min(10, Math.max(0, rpe ? rpeOf(next) : next)),
            false,
          )
        }
        onStep={(direction, current) =>
          Math.min(10, Math.max(0, (current ?? (rpe ? 8 : 2)) + direction * 0.5))
        }
        decrementLabel={rpe ? t`Half a point lower RPE` : t`Half a rep less in reserve`}
        incrementLabel={rpe ? t`Half a point higher RPE` : t`Half a rep more in reserve`}
        max={10}
      />
    );
  // A half step (the suggestion's "1.5") presses no chip; the legend names it, so the six chips
  // keep one row at 360 px (a seventh would wrap and push the dock up).
  const half = value !== null && !Number.isInteger(value) && value < 5 ? value : null;
  const selected: string | null =
    value === null || half !== null ? null : openEnded || value >= 5 ? '5+' : String(value);
  const chips = RIR_CHIPS;
  const halfText = half === null ? null : effort.value(half);
  const chipText = (chip: RirChip) =>
    rpe ? (chip === '5+' ? t`≤5` : String(rpeOf(Number(chip)))) : chip;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-fg-muted">
        {halfText === null ? (
          rpe ? (
            <Trans>Effort (RPE)</Trans>
          ) : (
            <Trans>Reps in reserve</Trans>
          )
        ) : rpe ? (
          <Trans>Effort: {halfText}</Trans>
        ) : (
          <Trans>Reps in reserve: {halfText}</Trans>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const pressed = selected === chip;
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={pressed}
              aria-label={chip === '5+' ? (rpe ? t`RPE 5 or less` : t`5 or more`) : undefined}
              onClick={() => (chip === '5+' ? onChange(5, true) : onChange(Number(chip), false))}
              className={cn(
                'min-h-target min-w-target flex-1 rounded-xl border border-control bg-surface px-2 text-lg font-semibold tabular',
                pressed && 'border-primary bg-primary text-on-primary',
              )}
            >
              {chipText(chip)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The undo token while it is valid (30 s, `UNDO_TTL_MS`), else null. */
function useLiveUndo(view: SessionView) {
  const undo = view.undo;
  const [expired, setExpired] = useState<string | null>(null);
  useEffect(() => {
    if (!undo) return undefined;
    const handle = setTimeout(
      () => setExpired(undo.token),
      Math.max(0, undo.expiresAtEpochMs - Date.now()),
    );
    return () => clearTimeout(handle);
  }, [undo]);
  return undo && expired !== undo.token ? undo : null;
}

/** WKT-12: undo the last confirm, skip or delete for 30 s, one-handed in the dock. */
function UndoButton({ view }: { view: SessionView }) {
  const { dispatch } = useSessionCommands();
  const undo = useLiveUndo(view);
  if (!undo) return null;
  return (
    <Button
      variant="secondary"
      className="shrink-0"
      onClick={() => void dispatch({ type: 'UNDO', token: undo.token })}
    >
      <Trans>Undo</Trans>
    </Button>
  );
}

/** The undo row when no timer runs (the rest panel carries the button otherwise). */
function UndoBar({ view }: { view: SessionView }) {
  const undo = useLiveUndo(view);
  if (!undo) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-raised pl-3">
      <span className="text-sm">
        <Trans>Changed by mistake?</Trans>
      </span>
      <UndoButton view={view} />
    </div>
  );
}

/** TMR-03 "remember for this exercise" after the rest was changed with ±15 s. */
function RememberRest({ view }: { view: SessionView }) {
  const labels = useLabels();
  const run = useSessionUseCases();
  const [saved, setSaved] = useState<string | null>(null);
  const timer = view.session.timer;
  if (!timer || timer.kind !== 'rest' || timer.adjustMs === 0 || !timer.slotKey) return null;
  const slot = view.session.exercises.find((entry) => entry.key === timer.slotKey);
  if (!slot) return null;
  const seconds = Math.round((timer.targetMs + timer.adjustMs) / 1000);
  const name = labels.exercise(slot.exerciseId);
  const time = formatClock(seconds * 1000);
  if (saved === timer.id)
    return (
      <p className="text-sm text-fg-muted">
        <Trans>
          {time} is now the rest for {name}.
        </Trans>
      </p>
    );
  return (
    <Button
      variant="ghost"
      className="self-start"
      onClick={() =>
        void run((session, deps) =>
          session.rememberRest(deps, { exerciseId: slot.exerciseId, seconds }),
        ).then((result) => {
          if (result.ok) setSaved(timer.id);
        })
      }
    >
      <Trans>
        Remember {time} rest for {name}
      </Trans>
    </Button>
  );
}

/** Every planned set is logged or skipped: undo, and finish. */
function AllDone({ view }: { view: SessionView }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { finish } = useSessionCommands();
  const [busy, setBusy] = useState(false);
  const focusRoot = useFocusAfterConfirm();
  const empty = view.session.exercises.length === 0;
  return (
    <>
      <Card>
        <h2 className="text-xl font-bold">
          {empty ? <Trans>Add your first exercise</Trans> : <Trans>All planned sets done</Trans>}
        </h2>
        <p className="text-fg-muted">
          {empty ? (
            <Trans>Use "Add exercise" below to pick what you train.</Trans>
          ) : (
            <Trans>Add another exercise or set, or finish the workout.</Trans>
          )}
        </p>
      </Card>
      <Dock label={t`Workout controls`} ref={focusRoot}>
        <RestPanel
          view={view}
          onSetTimerStopped={() => undefined}
          aside={<UndoButton view={view} />}
        />
        {view.session.timer ? null : <UndoBar view={view} />}
        {empty ? null : (
          <Button
            variant="primary"
            size="lg"
            data-primary=""
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void finish('finished').then((outcome) => {
                setBusy(false);
                if (outcome.ok)
                  void navigate({
                    to: '/session/summary/$sessionId',
                    params: { sessionId: view.session.id },
                  });
              });
            }}
          >
            <Trans>Finish workout</Trans>
          </Button>
        )}
      </Dock>
    </>
  );
}

function useExerciseDef(id: ExerciseId) {
  return useCatalog().exercise(id);
}
