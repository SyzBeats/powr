import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { CircleSlash, Star, UserPen } from 'lucide-react';
import { Suspense, useState } from 'react';

import type { AddToTodayOutcome } from '@powr/application/library';
import type { ExerciseId, MuscleId } from '@powr/domain';
import type { RankedExercise } from '@powr/domain/analytics';

import { announce } from '#ui/announcer';
import { Badge, Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { Segmented } from '#ui/segmented';

import { useLibrary, useLibraryQuery } from '../../hooks/use-library';
import { useLabels } from '../labels';
import { useSessionCommands } from '../session/commands';
import { WhyButton } from '../why/WhySheet';
import { PlaceInPlanSheet } from './PlaceInPlan';
import type { RankSort } from './search';
import { useBodyMapWords } from './words';

/** How many ranked exercises show before "Show more". */
const PAGE = 8;

/**
 * MAP-02/03: the exercises that train the muscle, filtered to the active equipment and without
 * avoided or hidden ones, ranked by Effectiveness (the transparent composite) or Focus, each with
 * its role and credit, evidence, rating with "Why?", the last performance and the MAP-05 actions:
 * add to today, place in the plan, details and history.
 */
export function RankedExercises({
  muscle,
  name,
  sort,
  includeUnavailable,
  onSortChange,
  onIncludeUnavailableChange,
}: {
  muscle: MuscleId;
  name: string;
  sort: RankSort;
  includeUnavailable: boolean;
  onSortChange: (sort: RankSort) => void;
  onIncludeUnavailableChange: (include: boolean) => void;
}) {
  const { t } = useLingui();
  const [shown, setShown] = useState(PAGE);
  const ranked = useLibraryQuery(
    `${muscle}|${sort}|${String(includeUnavailable)}`,
    (library, deps) => library.muscleExercises(deps, { muscle, mode: sort, includeUnavailable }),
  );
  const list = ranked.loaded ? ranked.value : [];
  const more = Math.min(PAGE, list.length - shown);

  return (
    <section aria-labelledby="ranked-heading" className="flex flex-col gap-3">
      <h2 id="ranked-heading" className="text-xl font-bold">
        <Trans>Best exercises for {name}</Trans>
      </h2>
      <p className="text-fg-muted">
        <Trans>
          Only exercises your equipment allows; avoided and hidden exercises are left out.
        </Trans>
      </p>
      <Segmented<RankSort>
        label={t`Sort by`}
        value={sort}
        onChange={onSortChange}
        options={[
          { value: 'effectiveness', label: t`Effectiveness` },
          { value: 'focus', label: t`Focus` },
        ]}
      />
      <p className="text-sm text-fg-muted">
        {sort === 'effectiveness' ? (
          <Trans>
            Effectiveness weighs the muscle's credit, the evidence behind it, training at long
            muscle lengths, how well the exercise loads and how many parts of the muscle it covers.
            Tap "Why?" for the factors.
          </Trans>
        ) : (
          <Trans>
            Focus puts exercises first where this muscle is a main mover and does most of the work.
          </Trans>
        )}
      </p>
      <CheckRow
        label={t`Include exercises your equipment does not allow`}
        checked={includeUnavailable}
        onChange={onIncludeUnavailableChange}
      />
      {!ranked.loaded ? (
        <output className="block text-fg-muted">
          <Trans>Ranking the exercises…</Trans>
        </output>
      ) : list.length === 0 ? (
        <p>
          <Trans>
            No exercise for this muscle fits your equipment. Include the others to see what they
            need.
          </Trans>
        </p>
      ) : (
        <>
          <ol
            className="flex flex-col gap-3"
            data-testid="ranked-exercises"
            aria-busy={ranked.stale}
          >
            {list.slice(0, shown).map((entry) => (
              <li key={entry.exerciseId}>
                <RankedItem entry={entry} muscle={muscle} muscleName={name} sort={sort} />
              </li>
            ))}
          </ol>
          {more > 0 ? (
            <Button onClick={() => setShown((count) => count + PAGE)}>
              <Trans>Show {more} more</Trans>
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

type AddState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'done'; readonly outcome: AddToTodayOutcome }
  | { readonly kind: 'failed' };

function RankedItem({
  entry,
  muscle,
  muscleName,
  sort,
}: {
  entry: RankedExercise;
  muscle: MuscleId;
  muscleName: string;
  sort: RankSort;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useBodyMapWords();
  const library = useLibrary();
  const [add, setAdd] = useState<AddState>({ kind: 'idle' });
  const [placing, setPlacing] = useState(false);
  const name = labels.exercise(entry.exerciseId);
  const evidence = words.evidence(entry.evidence);
  const missing = words.missing(entry.missing);
  const last = words.last(entry.last);

  const addToToday = async () => {
    setAdd({ kind: 'busy' });
    const result = await library((lib, deps) => lib.addExerciseToToday(deps, entry.exerciseId));
    setAdd(result.ok ? { kind: 'done', outcome: result.value } : { kind: 'failed' });
    // One polite announcement of what happened (the callout below says the same and leads on).
    if (!result.ok) announce(t`${name} could not be added. Try again.`);
    else if (result.value.kind === 'addedToSession')
      announce(t`${name} was added to your workout.`);
    else if (result.value.kind === 'addedToPlanned')
      announce(t`${name} was added to today's planned session.`);
    else announce(t`No workout today yet. Start one with ${name}?`);
  };

  return (
    <article
      aria-label={name}
      className="flex flex-col gap-2 rounded-2xl border border-control bg-surface p-3"
      data-exercise={entry.exerciseId}
    >
      <h3 className="flex items-baseline gap-2 text-lg font-semibold">
        <span aria-hidden="true" className="text-fg-muted tabular">
          {`${entry.rank}.`}
        </span>
        <span>{name}</span>
      </h3>
      {entry.favourite || entry.custom || !entry.available ? (
        <div className="flex flex-wrap gap-2">
          {entry.favourite ? (
            <Badge tone="info" icon={Star}>
              <Trans>Favourite</Trans>
            </Badge>
          ) : null}
          {entry.custom ? (
            <Badge icon={UserPen}>
              <Trans>Custom, unrated</Trans>
            </Badge>
          ) : null}
          {entry.available ? null : (
            <Badge tone="warning" icon={CircleSlash}>
              <Trans>Not available with your equipment</Trans>
            </Badge>
          )}
        </div>
      ) : null}
      <p>{words.role(entry)}</p>
      {evidence ? <p className="text-sm text-fg-muted">{evidence}</p> : null}
      <div className="flex flex-wrap items-center gap-x-2">
        <p>
          <Trans>Effectiveness: {words.score(entry.effectiveness.value)}</Trans>
        </p>
        <WhyButton why={entry.effectiveness.why} subject={t`effectiveness of ${name}`} />
      </div>
      {sort === 'focus' ? (
        <div className="flex flex-wrap items-center gap-x-2">
          <p>
            <Trans>
              Focus on {muscleName}: {words.score(entry.focus.value)}
            </Trans>
          </p>
          <WhyButton why={entry.focus.why} subject={t`focus of ${name}`} />
        </div>
      ) : null}
      {missing ? <p className="font-medium">{missing}</p> : null}
      {last ? <p className="text-sm">{last}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          aria-label={t`Add to today: ${name}`}
          disabled={add.kind === 'busy'}
          onClick={() => void addToToday()}
        >
          <Trans>Add to today</Trans>
        </Button>
        <Button
          aria-label={t`Place in the plan: ${name}`}
          aria-haspopup="dialog"
          onClick={() => setPlacing(true)}
        >
          <Trans>Place in the plan</Trans>
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-4">
        <Link
          to="/explore/exercises/$exerciseId"
          params={{ exerciseId: entry.exerciseId }}
          aria-label={t`Exercise details: ${name}`}
          className="flex min-h-target items-center font-semibold text-info underline underline-offset-4"
        >
          <Trans>Exercise details</Trans>
        </Link>
        <Link
          to="/progress/exercise/$exerciseId"
          params={{ exerciseId: entry.exerciseId }}
          aria-label={t`History: ${name}`}
          className="flex min-h-target items-center font-semibold text-info underline underline-offset-4"
        >
          <Trans>History</Trans>
        </Link>
      </div>
      <div data-testid="add-outcome">
        {add.kind === 'done' ? (
          <AddOutcome outcome={add.outcome} exerciseId={entry.exerciseId} name={name} />
        ) : add.kind === 'failed' ? (
          <Callout tone="danger">
            <p>
              <Trans>{name} could not be added. Try again.</Trans>
            </p>
          </Callout>
        ) : null}
      </div>
      <PlaceInPlanSheet
        exerciseId={entry.exerciseId}
        muscle={muscle}
        name={name}
        open={placing}
        onOpenChange={setPlacing}
      />
    </article>
  );
}

/** MAP-05 "add to today": what happened, and the way on. */
function AddOutcome({
  outcome,
  exerciseId,
  name,
}: {
  outcome: AddToTodayOutcome;
  exerciseId: ExerciseId;
  name: string;
}) {
  switch (outcome.kind) {
    case 'addedToSession':
      return (
        <Callout tone="ok">
          <p>
            <Trans>{name} was added to your workout.</Trans>
          </p>
          <Link to="/session" className={buttonClass({ variant: 'primary' }, 'self-start')}>
            <Trans>Back to the workout</Trans>
          </Link>
        </Callout>
      );
    case 'addedToPlanned':
      return (
        <Callout tone="ok">
          <p>
            <Trans>{name} was added to today's planned session.</Trans>
          </p>
          <Link to="/session" className={buttonClass({}, 'self-start')}>
            <Trans>Go to Train</Trans>
          </Link>
        </Callout>
      );
    case 'noSessionToday':
      return (
        <Callout tone="info">
          <p>
            <Trans>No workout today yet. Start one with {name}?</Trans>
          </p>
          <Suspense
            fallback={
              <Button disabled className="self-start">
                <Trans>Start a workout with it</Trans>
              </Button>
            }
          >
            <StartWithExercise exerciseId={exerciseId} name={name} />
          </Suspense>
        </Callout>
      );
    default:
      return null;
  }
}

/**
 * Starts a freestyle workout with the exercise, like the start screen (WKT-01): the tap unlocks
 * audio for the timer kit, so this suspends until the kit is loaded (only after "Add to today"
 * found no workout today).
 */
function StartWithExercise({ exerciseId, name }: { exerciseId: ExerciseId; name: string }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { start } = useSessionCommands();
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const begin = async () => {
    setState('busy');
    const outcome = await start({ kind: 'freestyle', exerciseIds: [exerciseId] });
    if (outcome.ok) {
      void navigate({ to: '/session' });
      return;
    }
    setState('failed');
  };
  return (
    <>
      <Button
        variant="primary"
        className="self-start"
        aria-label={t`Start a workout with it: ${name}`}
        disabled={state === 'busy'}
        onClick={() => void begin()}
      >
        <Trans>Start a workout with it</Trans>
      </Button>
      {state === 'failed' ? (
        <p className="font-medium">
          <Trans>The workout could not be started. Try again from Train.</Trans>
        </p>
      ) : null}
    </>
  );
}
