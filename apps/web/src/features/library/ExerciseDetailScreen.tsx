import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChartLine, Copy, Pencil, Trophy } from 'lucide-react';
import { useId } from 'react';

import type { ExerciseDetailView } from '@powr/application/library';
import type { ExerciseId, MuscleId } from '@powr/domain';
import type { DetailMuscle } from '@powr/domain/library';

import { Badge } from '#ui/badge';
import { BodyMap } from '#ui/body-map/body-map';
import type { BodyMapMuscle, HeatBand, HeatStep } from '#ui/body-map/heat';
import { HeatLegend } from '#ui/body-map/heat-legend';
import { buttonClass } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { useLibraryQuery } from '../../hooks/use-library';
import { useCatalog } from '../../hooks/use-planning';
import { formatClock, formatLocalDate } from '../../i18n/format';
import { useLabels } from '../labels';
import { massFromKg, massText, useLoadUnit, useSessionWords } from '../session/words';
import { useEffortWords } from '../settings/effort';
import { WhyButton } from '../why/WhySheet';
import { DeleteCustomExercise, MarksCard, SetupMemoryCard } from './detail-parts';
import { useLibraryWords } from './words';

type Detail = ExerciseDetailView;

/**
 * EXL-03 exercise detail: cues, muscles worked with their credits and evidence tags (explained on
 * tap), the muscles on the body map (primary and secondary by pattern, not colour alone),
 * equipment and what is missing, defaults with the rest's "Why?", variants and substitutes
 * (EXL-07), the user's history, PRs and current e1RM (ANL-04 summary, the full history one tap
 * away), setup memory and training max (EXL-09), favourite / hidden / avoided marks (EXL-08), and
 * for custom exercises edit and delete (EXL-04).
 */
export function ExerciseDetailScreen({ exerciseId }: { exerciseId: string }) {
  const { t } = useLingui();
  const labels = useLabels();
  const detail = useLibraryQuery(`detail:${exerciseId}`, (library, deps) =>
    library.exerciseDetail(deps, exerciseId as ExerciseId),
  );
  if (!detail.loaded) {
    return (
      <Screen title={t`Exercise`}>
        <output className="block text-fg-muted">
          <Trans>Loading the exercise…</Trans>
        </output>
      </Screen>
    );
  }
  if (detail.value === null) {
    return (
      <Screen title={t`Exercise not found`}>
        <Card>
          <p>
            <Trans>This exercise is not in the library. It may have been deleted.</Trans>
          </p>
          <Link to="/explore/exercises" className={buttonClass({ size: 'lg' })}>
            <Trans>Back to the library</Trans>
          </Link>
        </Card>
      </Screen>
    );
  }
  return (
    <Screen title={labels.exercise(exerciseId)}>
      <DetailContent detail={detail.value} reload={detail.reload} />
    </Screen>
  );
}

function DetailContent({ detail, reload }: { detail: Detail; reload: () => void }) {
  const { info } = detail;
  const exercise = info.exercise;
  return (
    <>
      <Tags detail={detail} />
      <CuesCard detail={detail} />
      <MusclesCard muscles={info.muscles} exerciseName={exercise.name.en} />
      <BodyMapCard muscles={info.muscles} />
      <EquipmentCard detail={detail} />
      <DefaultsCard detail={detail} />
      <RelationsCard detail={detail} />
      <HistoryCard detail={detail} />
      <SetupMemoryCard
        key={exercise.id}
        exerciseId={exercise.id}
        userData={detail.userData}
        onSaved={reload}
      />
      <MarksCard detail={detail} onChanged={reload} />
      <ActionsCard detail={detail} onChanged={reload} />
    </>
  );
}

function Tags({ detail }: { detail: Detail }) {
  const labels = useLabels();
  const { info } = detail;
  const lift = info.relations.lift;
  const tags = [
    info.flags.custom ? (
      <Badge key="custom">
        <Trans>Custom exercise</Trans>
      </Badge>
    ) : null,
    info.exercise.status === 'active' ? null : (
      <Badge key="retired" tone="warning">
        <Trans>Retired</Trans>
      </Badge>
    ),
    lift && info.exercise.competitionLift ? (
      <Badge key="lift" tone="info" icon={Trophy}>
        <Trans>Competition lift: {labels.lift(lift)}</Trans>
      </Badge>
    ) : null,
    info.flags.favourite ? (
      <Badge key="favourite" tone="info">
        <Trans>Favourite</Trans>
      </Badge>
    ) : null,
    info.flags.hidden ? (
      <Badge key="hidden">
        <Trans>Hidden</Trans>
      </Badge>
    ) : null,
    info.flags.avoided || info.flags.avoidedPattern ? (
      <Badge key="avoided" tone="warning">
        <Trans>Avoided</Trans>
      </Badge>
    ) : null,
  ].filter(Boolean);
  if (tags.length === 0) return null;
  return <p className="flex flex-wrap gap-2">{tags}</p>;
}

function CuesCard({ detail }: { detail: Detail }) {
  const cues = detail.info.exercise.cues;
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>How to do it</Trans>
      </h2>
      {cues.length === 0 ? (
        <p className="text-fg-muted">
          <Trans>No cues yet. You can add your own when you edit a custom exercise.</Trans>
        </p>
      ) : (
        <ul className="list-disc pl-5" data-testid="exercise-cues">
          {cues.map((cue) => (
            <li key={cue.en}>{cue.en}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** EXL-03, EXL-05: every credited muscle; the evidence tag explained on tap. */
function MusclesCard({
  muscles,
  exerciseName,
}: {
  muscles: readonly DetailMuscle[];
  exerciseName: string;
}) {
  const labels = useLabels();
  const words = useLibraryWords();
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Muscles worked</Trans>
      </h2>
      <p className="text-sm text-fg-muted">
        <Trans>Tap a muscle to see what its credit is based on.</Trans>
      </p>
      <ul className="flex flex-col gap-1" data-testid="exercise-muscles">
        {muscles.map((muscle) => (
          <li key={muscle.muscle}>
            <details className="rounded-xl border border-border">
              <summary className="flex min-h-target cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                <span className="font-semibold">{labels.muscle(muscle.muscle)}</span>
                <span className="text-sm">
                  {words.role(muscle.role)} · {words.evidence(muscle.evidence)}
                </span>
                {muscle.convention ? (
                  <Badge tone="warning">
                    <Trans>Unvalidated convention</Trans>
                  </Badge>
                ) : null}
              </summary>
              <div className="flex flex-col gap-1 px-3 pb-3">
                <p>{words.credit(muscle.credit)}</p>
                <p className="text-fg-muted">{words.evidenceText(muscle, exerciseName)}</p>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Credit → the map's band: patterns tell primary (cross-hatch) and secondary (hatch) apart. */
const ROLE_STEP: Readonly<Record<DetailMuscle['role'], HeatStep | null>> = {
  primary: 5,
  secondary: 1,
  minor: 2,
  none: null,
};

/** EXL-03: the muscles on the body map; tapping one opens its ranked exercises (MAP-02). */
function BodyMapCard({ muscles }: { muscles: readonly DetailMuscle[] }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const words = useLibraryWords();
  const headingId = useId();
  const bands: readonly HeatBand[] = [
    { step: 5, label: t`Primary` },
    { step: 1, label: t`Secondary` },
    { step: 2, label: t`Minor` },
  ];
  const best = new Map<MuscleId, DetailMuscle>();
  for (const muscle of muscles) {
    const current = best.get(muscle.group);
    if (!current || muscle.credit > current.credit) best.set(muscle.group, muscle);
  }
  const map: Record<string, BodyMapMuscle> = Object.fromEntries(
    catalog.muscles().groups.map((group) => {
      const credited = best.get(group.id);
      const step = credited ? ROLE_STEP[credited.role] : null;
      return [
        group.id,
        step === null
          ? { name: group.name.en }
          : { name: group.name.en, step, valueText: words.role(credited!.role) },
      ];
    }),
  );
  return (
    <section className="flex flex-col gap-3" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-bold">
        <Trans>On the body map</Trans>
      </h2>
      <p className="text-sm text-fg-muted">
        <Trans>Tap a muscle to see the best exercises for it.</Trans>
      </p>
      <HeatLegend title={t`Role of each muscle`} bands={bands} />
      <BodyMap
        muscles={map}
        bands={bands}
        onSelect={(muscleId) =>
          void navigate({ to: '/explore/body-map/$muscleId', params: { muscleId } })
        }
      />
    </section>
  );
}

function EquipmentCard({ detail }: { detail: Detail }) {
  const labels = useLabels();
  const words = useLibraryWords();
  const { equipment } = detail.info;
  const either = new Intl.ListFormat(undefined, { type: 'disjunction' });
  const missing = [
    ...equipment.missing.allOf.map((id) => labels.equipment(id)),
    ...equipment.missing.anyOf.map((group) =>
      either.format(group.map((id) => labels.equipment(id))),
    ),
  ];
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Equipment</Trans>
      </h2>
      <p>{words.requirement(equipment.requirement)}</p>
      {equipment.available ? (
        <Badge tone="ok">
          <Trans>Available with your equipment</Trans>
        </Badge>
      ) : (
        <div className="flex flex-col gap-1">
          <Badge tone="warning">
            <Trans>Needs other equipment</Trans>
          </Badge>
          {missing.length > 0 ? (
            <p>
              <Trans>Missing: {missing.join('; ')}</Trans>
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function DefaultsCard({ detail }: { detail: Detail }) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useLibraryWords();
  const exercise = detail.info.exercise;
  const name = exercise.name.en;
  const rest = formatClock(detail.rest.value * 1000);
  const rows: [string, string][] = [
    [t`Reps for strength`, words.reps(exercise.defaults.repRange.strength)],
    [t`Reps for muscle size`, words.reps(exercise.defaults.repRange.hypertrophy)],
    [t`Tempo`, exercise.defaults.tempo],
    [t`Movement`, labels.pattern(exercise.pattern)],
    [t`Mechanics`, words.mechanics(exercise.mechanics)],
    [t`Loading`, words.loadType(exercise.load.type)],
    [t`One side at a time`, exercise.load.unilateral ? t`Yes` : t`No`],
    [t`Load curve for the 1-rep max estimate`, words.curveClass(exercise.load.curveClass)],
  ];
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Defaults</Trans>
      </h2>
      <dl className="flex flex-col gap-2">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt className="text-fg-muted">{term}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-fg-muted">
            <Trans>Rest between sets</Trans>
          </dt>
          <dd className="flex flex-wrap items-center gap-2 font-semibold tabular">
            {rest}
            <WhyButton why={detail.rest.why} subject={t`Rest for ${name}`} />
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function ExerciseLink({ id, note }: { id: ExerciseId; note?: string | null }) {
  const labels = useLabels();
  return (
    <Link
      to="/explore/exercises/$exerciseId"
      params={{ exerciseId: id }}
      className="flex min-h-target flex-wrap items-center gap-x-2 rounded-xl px-2 py-1 font-semibold underline underline-offset-4"
    >
      {labels.exercise(id)}
      {note ? <span className="text-sm font-normal text-fg-muted no-underline">{note}</span> : null}
    </Link>
  );
}

/** EXL-07: competition lift, variant of, close variants and substitutes. */
function RelationsCard({ detail }: { detail: Detail }) {
  const { t } = useLingui();
  const { relations } = detail.info;
  if (
    relations.variantOf === null &&
    relations.variants.length === 0 &&
    relations.substitutes.length === 0
  ) {
    return null;
  }
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Variants and alternatives</Trans>
      </h2>
      {relations.variantOf ? (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">
            <Trans>A close variant of</Trans>
          </h3>
          <ExerciseLink id={relations.variantOf} />
        </div>
      ) : null}
      {relations.variants.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">
            <Trans>Close variants</Trans>
          </h3>
          <ul>
            {relations.variants.map((id) => (
              <li key={id}>
                <ExerciseLink id={id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {relations.substitutes.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">
            <Trans>Substitutes (same movement and main muscles)</Trans>
          </h3>
          <ul>
            {relations.substitutes.map((entry) => (
              <li key={entry.exerciseId}>
                <ExerciseLink
                  id={entry.exerciseId}
                  note={entry.available ? null : t`needs other equipment`}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

/** EXL-03 and ANL-04 in short: exposures, last time, current e1RM, bests and the latest PRs. */
function HistoryCard({ detail }: { detail: Detail }) {
  const { t } = useLingui();
  const effortWords = useEffortWords();
  const unit = useLoadUnit();
  const words = useSessionWords();
  const { history, prs } = detail;
  const exerciseId = detail.info.exercise.id;
  const exposures = history.exposures;
  const last = history.last;
  const lastSets = last
    ? last.sets
        .filter((set) => set.state === 'done')
        .map((set) => {
          const load = massText(set.load) ?? t`Bodyweight`;
          const reps = set.reps ?? 0;
          const values = t`${load} × ${reps}`;
          if (set.rir === null) return values;
          const effort = effortWords.value(set.rir);
          return t`${values} · ${effort}`;
        })
    : [];
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Your history</Trans>
      </h2>
      {exposures === 0 ? (
        <p className="text-fg-muted">
          <Trans>You have not logged this exercise yet.</Trans>
        </p>
      ) : (
        <dl className="flex flex-col gap-2" data-testid="exercise-history">
          <div>
            <dt className="text-fg-muted">
              <Trans>Sessions</Trans>
            </dt>
            <dd className="font-semibold tabular">
              {history.firstDate && history.lastDate ? (
                <Trans>
                  {exposures}, from {formatLocalDate(history.firstDate, 'short')} to{' '}
                  {formatLocalDate(history.lastDate, 'short')}
                </Trans>
              ) : (
                exposures
              )}
            </dd>
          </div>
          {last ? (
            <div>
              <dt className="text-fg-muted">
                <Trans>Last time ({formatLocalDate(last.localDate, 'medium')})</Trans>
              </dt>
              <dd className="font-semibold">
                {lastSets.length > 0 ? lastSets.join(', ') : t`No sets done`}
              </dd>
            </div>
          ) : null}
          {history.e1rmKg !== null ? (
            <div>
              <dt className="text-fg-muted">
                <Trans>Estimated 1-rep max</Trans>
              </dt>
              <dd className="font-semibold tabular">
                {massFromKg(history.e1rmKg, unit, 1)}
                {history.calibration === 'calibrated' ? null : (
                  <span className="block text-sm font-normal text-fg-muted">
                    <Trans>Still settling: estimates firm up after a few sessions.</Trans>
                  </span>
                )}
              </dd>
            </div>
          ) : null}
          {history.bests?.loadKg ? (
            <div>
              <dt className="text-fg-muted">
                <Trans>Heaviest weight</Trans>
              </dt>
              <dd className="font-semibold tabular">{massFromKg(history.bests.loadKg, unit)}</dd>
            </div>
          ) : null}
          {history.bests?.volumeKg ? (
            <div>
              <dt className="text-fg-muted">
                <Trans>Best session volume</Trans>
              </dt>
              <dd className="font-semibold tabular">
                {massFromKg(history.bests.volumeKg, unit, 0)}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
      {prs.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">
            <Trans>Latest personal records</Trans>
          </h3>
          <ul className="flex flex-col gap-1" data-testid="exercise-prs">
            {prs.map((pr) => (
              <li key={pr.id}>
                <Link
                  to="/session/summary/$sessionId"
                  params={{ sessionId: pr.sessionId }}
                  className="flex min-h-target flex-col justify-center rounded-xl px-2 py-1 underline-offset-4 hover:underline"
                >
                  <span>{words.pr(pr)}</span>
                  <span className="text-sm text-fg-muted">
                    {formatLocalDate(pr.localDate, 'medium')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        to="/progress/exercise/$exerciseId"
        params={{ exerciseId }}
        className={buttonClass({ size: 'lg' })}
      >
        <ChartLine aria-hidden="true" className="size-5" />
        <Trans>Trend and full history</Trans>
      </Link>
    </Card>
  );
}

/** Copy (any exercise), edit and delete (custom ones) (EXL-04). */
function ActionsCard({ detail, onChanged }: { detail: Detail; onChanged: () => void }) {
  const exercise = detail.info.exercise;
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Make it your own</Trans>
      </h2>
      {detail.info.flags.custom && exercise.status === 'active' ? (
        <Link
          to="/explore/exercises/edit/$exerciseId"
          params={{ exerciseId: exercise.id }}
          className={buttonClass({ size: 'lg' })}
        >
          <Pencil aria-hidden="true" className="size-5" />
          <Trans>Edit this exercise</Trans>
        </Link>
      ) : null}
      <Link
        to="/explore/exercises/new"
        search={{ from: exercise.id }}
        className={buttonClass({ size: 'lg' })}
      >
        <Copy aria-hidden="true" className="size-5" />
        <Trans>Copy as a custom exercise</Trans>
      </Link>
      {detail.info.flags.custom && exercise.status === 'active' ? (
        <DeleteCustomExercise
          exerciseId={exercise.id}
          name={exercise.name.en}
          onRetired={onChanged}
        />
      ) : null}
    </Card>
  );
}
