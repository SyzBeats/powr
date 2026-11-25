import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { GitCompare } from 'lucide-react';
import { useState } from 'react';

import type {
  ExerciseHistoryView,
  ExerciseTrendView,
  PerformanceView,
} from '@powr/application/insights';
import type { ExerciseId, MassUnit } from '@powr/domain';
import { seriesSummary, type ExposureSets, type RepMaxRow } from '@powr/domain/analytics';
import type { PointChange, PrType } from '@powr/domain/session';

import { Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import {
  TrendChart,
  type TrendChartProps,
  type TrendMarker,
  type TrendSeries,
} from '#ui/charts/trend-chart';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useInsight } from '../../hooks/use-insights';
import { useCatalog } from '../../hooks/use-planning';
import {
  addLocalDays,
  daysBetweenLocal,
  formatLocalDateWithYear,
  formatMass,
  formatNumber,
  todayLocal,
} from '../../i18n/format';
import { useLabels } from '../labels';
import { useSummaryWords } from '../session/past/parts';
import { massFromKg, useLoadUnit, useSessionWords } from '../session/words';
import { useEffortWords } from '../settings/effort';
import { WhyButton } from '../why/WhySheet';
import { Loading, SetsSheet } from './parts';
import type { TrendSource } from './search';
import { inUnit, useAnnotations, usePrTypeWords, useTrendSentence } from './words';

/** Sessions and PRs listed before "Show more". */
const SESSIONS_SHOWN = 5;
const PRS_SHOWN = 10;

/**
 * One exercise's progress (ANL-02, ANL-04): the estimated 1-rep max chart (session points, the
 * smoothed trend with its 95% band, PRs, "likely real" changes, blocks, lighter weeks and breaks)
 * for heavy sets or all sets; the performance series (top weight, volume load, reps at a weight);
 * then the history: current e1RM, training max, bests, the rep-max table, every session with its
 * sets and the PRs. Tapping a point shows that session's sets (ANL-02).
 */
export function ExerciseProgressScreen({
  exerciseId,
  source = 'strength',
}: {
  exerciseId: string;
  source?: TrendSource | undefined;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const catalog = useCatalog();
  const id = exerciseId as ExerciseId;
  const name = labels.exercise(id);
  const history = useInsight(`history:${id}`, (insights, deps) =>
    insights.exerciseHistory(deps, id),
  );
  const [openDate, setOpenDate] = useState<string | null>(null);

  if (catalog.exercise(id) === undefined) {
    return (
      <Screen title={t`Exercise not found`}>
        <Card>
          <p>
            <Trans>This exercise is not in your library. It may have been deleted.</Trans>
          </p>
          <Link to="/progress" className={buttonClass({ size: 'lg' })}>
            <Trans>Back to Progress</Trans>
          </Link>
        </Card>
      </Screen>
    );
  }

  const sessions = history.loaded ? (history.value?.sessions ?? []) : [];
  const open = openDate ? (sessions.find((entry) => entry.localDate === openDate) ?? null) : null;
  // Only older sessions: the one-year load would be empty, so load everything at once.
  const newest = sessions[0]?.localDate ?? null;
  const oldOnly = newest !== null && daysBetweenLocal(newest, todayLocal()) > 365;

  return (
    <Screen title={t`${name} progress`}>
      <E1rmSection id={id} name={name} source={source} oldOnly={oldOnly} onOpen={setOpenDate} />
      <Link
        to="/progress/compare"
        search={{ ids: id }}
        className={buttonClass({ variant: 'secondary', size: 'lg' })}
      >
        <GitCompare aria-hidden="true" className="size-5" />
        <Trans>Compare with other lifts</Trans>
      </Link>
      <PerformanceSection id={id} name={name} oldOnly={oldOnly} onOpen={setOpenDate} />
      {!history.loaded ? (
        <Loading />
      ) : history.value ? (
        <HistorySection id={id} name={name} history={history.value} />
      ) : null}
      <SetsSheet exercise={name} exposure={open} onClose={() => setOpenDate(null)} />
    </Screen>
  );
}

type RangeChange = NonNullable<TrendChartProps['onRangeChange']>;
type RangePreset = NonNullable<Parameters<RangeChange>[0]>;
type ChartWindow = Parameters<RangeChange>[1];

const isoDay = (epochMs: number): string => new Date(epochMs).toISOString().slice(0, 10);

/** The visible window of a chart: a preset's or a custom one (null: all data loaded). */
interface Frame {
  readonly preset: RangePreset | null;
  readonly from: string;
  readonly to: string;
}

function defaultFrame(): Frame {
  const today = todayLocal();
  return { preset: '12w', from: addLocalDays(today, -83), to: today };
}

function useChangeWords() {
  const { t } = useLingui();
  const words = useSummaryWords();
  return (change: Pick<PointChange, 'label' | 'direction' | 'repRange' | 'reason'>): string => {
    const text = words.trend(change);
    return change.repRange ? t`${text}, possibly from a change in rep range` : text;
  };
}

function usePrMarker() {
  const prType = usePrTypeWords();
  const { t } = useLingui();
  return (types: readonly PrType[]): string => {
    const list = new Intl.ListFormat(undefined, { type: 'conjunction' }).format(types.map(prType));
    return t`PR: ${list}`;
  };
}

/** The e1RM series as the chart draws it, in the user's unit; changes marked where they start. */
function e1rmSeries(
  view: ExerciseTrendView,
  name: string,
  unit: MassUnit,
  prLabel: (types: readonly PrType[]) => string,
  changeLabel: (change: PointChange) => string,
): TrendSeries {
  const markers: TrendMarker[] = [];
  let previous: string | null = null;
  for (const point of view.series.points) {
    if (point.prs.length > 0) {
      markers.push({ date: point.localDate, kind: 'pr', label: prLabel(point.prs) });
    }
    const change = point.change;
    const real = change !== null && (change.label === 'likely' || change.label === 'veryLikely');
    const key = real ? `${change.label}:${change.direction}` : null;
    if (real && key !== previous) {
      markers.push({
        date: point.localDate,
        kind: change.label === 'veryLikely' ? 'veryLikely' : 'likely',
        label: changeLabel(change),
      });
    }
    previous = key;
  }
  return {
    name,
    points: view.series.points.flatMap((point) =>
      point.rawKg === null ? [] : [{ date: point.localDate, value: inUnit(point.rawKg, unit) }],
    ),
    trend: view.series.points.flatMap((point) =>
      point.trend
        ? [
            {
              date: point.localDate,
              value: inUnit(point.trend.e1rmKg, unit),
              low: inUnit(point.trend.lowKg, unit),
              high: inUnit(point.trend.highKg, unit),
            },
          ]
        : [],
    ),
    markers,
  };
}

function E1rmSection({
  id,
  name,
  source,
  oldOnly,
  onOpen,
}: {
  id: ExerciseId;
  name: string;
  source: TrendSource;
  oldOnly: boolean;
  onOpen: (date: string) => void;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const unit = useLoadUnit();
  const sentence = useTrendSentence();
  const annotationsOf = useAnnotations();
  const prLabel = usePrMarker();
  const changeLabel = useChangeWords();
  const [frame, setFrame] = useState<Frame>(defaultFrame);
  const range = frame.preset === 'all' || oldOnly ? 'all' : '1y';
  const trend = useInsight(`e1rm:${id}:${source}:${range}`, (insights, deps) =>
    insights.exerciseTrend(deps, { exerciseId: id, range, source }),
  );
  const view = trend.loaded ? trend.value : null;
  const series = view ? [e1rmSeries(view, name, unit, prLabel, changeLabel)] : [];
  const annotations = view ? annotationsOf(view.annotations) : [];
  const summary = view
    ? frame.preset === 'all'
      ? view.series.summary
      : seriesSummary(
          view.series.points.filter(
            (point) => point.localDate >= frame.from && point.localDate <= frame.to,
          ),
        )
    : null;
  const latest = view?.series.latest ?? null;
  const pace = view?.pace ?? null;
  const format = (value: number) => formatMass(value, unit);

  const onRangeChange = (preset: RangePreset | null, window: ChartWindow) =>
    setFrame({ preset, from: isoDay(window.from), to: isoDay(window.to) });

  return (
    <>
      <Segmented
        label={t`Sets the estimate uses`}
        value={source}
        onChange={(next) =>
          void navigate({
            to: '/progress/exercise/$exerciseId',
            params: { exerciseId: id },
            search: next === 'strength' ? {} : { source: next },
            replace: true,
          })
        }
        options={[
          { value: 'strength', label: t`Heavy sets` },
          { value: 'all', label: t`All sets` },
        ]}
      />
      <p className="text-sm text-fg-muted">
        {source === 'strength' ? (
          <Trans>
            Heavy sets give the most reliable estimate. Lighter, high-rep sets are left out.
          </Trans>
        ) : (
          <Trans>Every working set counts, including lighter, high-rep sets.</Trans>
        )}
      </p>
      {!view || !summary ? (
        <Loading />
      ) : (
        <TrendChart
          measureId="exercise-e1rm"
          title={t`Estimated 1-rep max`}
          summary={sentence(name, summary, unit)}
          series={series}
          unit={unit}
          formatValue={format}
          annotations={annotations}
          labels={{ trend: t`Trend`, points: t`Each session's estimate` }}
          endDate={todayLocal()}
          onRangeChange={onRangeChange}
          onOpen={onOpen}
          openLabel={t`Show the sets`}
          emptyText={t`No sets with this exercise in this range yet.`}
        />
      )}
      {trend.loaded && trend.stale ? (
        <output className="block text-sm text-fg-muted">
          <Trans>Updating the chart…</Trans>
        </output>
      ) : null}
      {latest && latest.value.label !== 'insufficientData' ? (
        <p className="flex flex-wrap items-center gap-x-2">
          <span>
            <Trans>Latest change: {changeLabel({ ...latest.value, repRange: false })}</Trans>
          </span>
          <WhyButton why={latest.why} subject={t`${name} trend`} />
        </p>
      ) : null}
      {pace?.value.outrun ? (
        <Callout tone="info" title={t`Your planned increases are ahead of your trend`}>
          <p>
            <Trans>
              Your estimated 1-rep max is rising more slowly than the plan adds weight, so POWR
              suggests loads from your estimate for now. That keeps the sets at the right effort.
            </Trans>
          </p>
          <WhyButton why={pace.why} subject={t`${name} pace`} className="self-start" />
        </Callout>
      ) : null}
      {annotations.length > 0 ? (
        <details className="rounded-2xl bg-surface p-4">
          <summary className="min-h-target cursor-pointer font-semibold">
            <Trans>Blocks, lighter weeks and breaks in this chart</Trans>
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {annotations.map((entry) => {
              const from = formatLocalDateWithYear(entry.from);
              const to = formatLocalDateWithYear(entry.to);
              return (
                <li key={`${entry.label}-${entry.from}`}>
                  {entry.from === entry.to ? (
                    <Trans>
                      {entry.label} starts {from}
                    </Trans>
                  ) : (
                    <Trans>
                      {entry.label}: {from} to {to}
                    </Trans>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </>
  );
}

type Metric = 'top' | 'volume' | 'reps';

function PerformanceSection({
  id,
  name,
  oldOnly,
  onOpen,
}: {
  id: ExerciseId;
  name: string;
  oldOnly: boolean;
  onOpen: (date: string) => void;
}) {
  const { t } = useLingui();
  const unit = useLoadUnit();
  const [metric, setMetric] = useState<Metric>('top');
  const [all, setAll] = useState(false);
  const [loadKg, setLoadKg] = useState<number | null>(null);
  const range = all || oldOnly ? 'all' : '1y';
  const performance = useInsight(`performance:${id}:${range}:${loadKg ?? ''}`, (insights, deps) =>
    insights.exercisePerformance(deps, {
      exerciseId: id,
      range,
      ...(loadKg === null ? {} : { loadKg }),
    }),
  );
  const view: PerformanceView | null = performance.loaded ? performance.value : null;
  const chosenLoad = view?.repsAtLoad?.loadKg ?? null;
  const chosenText = chosenLoad === null ? '' : massFromKg(chosenLoad, unit);

  const series: TrendSeries[] = view
    ? [
        {
          name,
          points:
            metric === 'top'
              ? view.points.flatMap((point) =>
                  point.topLoadKg === null
                    ? []
                    : [{ date: point.localDate, value: inUnit(point.topLoadKg, unit) }],
                )
              : metric === 'volume'
                ? view.points.flatMap((point) =>
                    point.volumeKg > 0
                      ? [{ date: point.localDate, value: Math.round(inUnit(point.volumeKg, unit)) }]
                      : [],
                  )
                : (view.repsAtLoad?.points ?? []).map((point) => ({
                    date: point.localDate,
                    value: point.reps,
                  })),
        },
      ]
    : [];
  const values = series[0]?.points ?? [];
  const last = values.at(-1);
  const first = values[0];
  const lastText = last ? formatPerformance(metric, last.value, unit) : '';
  const firstText = first ? formatPerformance(metric, first.value, unit) : '';
  const count = values.length;
  const title =
    metric === 'top'
      ? t`Heaviest set per session`
      : metric === 'volume'
        ? t`Volume load per session`
        : t`Most reps at ${chosenText} or more`;
  const sessionsText = plural(count, { one: '# session', other: '# sessions' });
  const summary =
    count === 0
      ? t`No sessions for this view yet.`
      : count === 1
        ? t`${title}: ${lastText} in the one session so far.`
        : t`${title}: ${firstText} in the first and ${lastText} in the latest of ${sessionsText} loaded.`;

  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Performance</Trans>
      </h2>
      <Segmented
        label={t`What to show`}
        value={metric}
        onChange={setMetric}
        options={[
          { value: 'top', label: t`Heaviest set` },
          { value: 'volume', label: t`Volume load` },
          { value: 'reps', label: t`Reps at a weight` },
        ]}
      />
      {metric === 'reps' && view && view.loads.length > 0 ? (
        <Segmented
          label={t`Weight`}
          value={chosenLoad === null ? null : String(chosenLoad)}
          onChange={(value) => setLoadKg(Number(value))}
          options={view.loads.map((kg) => ({ value: String(kg), label: massFromKg(kg, unit) }))}
        />
      ) : null}
      {metric === 'volume' ? (
        <p className="text-sm text-fg-muted">
          <Trans>Weight × reps of the working sets. Compare it within this exercise only.</Trans>
        </p>
      ) : null}
      {!view ? (
        <Loading />
      ) : (
        <TrendChart
          measureId="exercise-performance"
          title={title}
          summary={summary}
          headingLevel={3}
          series={series}
          unit={metric === 'reps' ? t`reps` : unit}
          formatValue={(value) => formatPerformance(metric, value, unit)}
          labels={{ points: t`Each session` }}
          endDate={todayLocal()}
          onRangeChange={(preset) => {
            if (preset === 'all') setAll(true);
          }}
          onOpen={onOpen}
          openLabel={t`Show the sets`}
          emptyText={
            metric === 'reps'
              ? t`No working sets with a weight yet.`
              : t`No sessions with this exercise in this range yet.`
          }
        />
      )}
    </Card>
  );
}

function formatPerformance(metric: Metric, value: number, unit: MassUnit): string {
  return metric === 'reps'
    ? plural(value, { one: '# rep', other: '# reps' })
    : formatMass(value, unit);
}

function HistorySection({
  id,
  name,
  history,
}: {
  id: ExerciseId;
  name: string;
  history: ExerciseHistoryView;
}) {
  const unit = useLoadUnit();
  const sessionWords = useSessionWords();
  const summaryWords = useSummaryWords();
  const [sessionsShown, setSessionsShown] = useState(SESSIONS_SHOWN);
  const [allPrs, setAllPrs] = useState(false);
  const { e1rm } = history;
  const current = e1rm.strengthKg ?? e1rm.allKg;
  const prs = allPrs ? history.prs : history.prs.slice(0, PRS_SHOWN);
  const sessions = history.sessions.slice(0, sessionsShown);

  return (
    <>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Where you are now</Trans>
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-fg-muted">
            <Trans>Estimated 1-rep max</Trans>
          </dt>
          <dd className="font-semibold tabular">
            {current === null ? (
              <Trans>Not enough sets with an effort rating yet</Trans>
            ) : e1rm.lowKg !== null && e1rm.highKg !== null ? (
              <Trans>
                {massFromKg(current, unit, 1)} (95% range {massFromKg(e1rm.lowKg, unit, 1)} to{' '}
                {massFromKg(e1rm.highKg, unit, 1)})
              </Trans>
            ) : (
              massFromKg(current, unit, 1)
            )}
          </dd>
          {current !== null ? (
            <>
              <dt className="text-fg-muted">
                <Trans>Based on</Trans>
              </dt>
              <dd>
                {e1rm.strengthKg !== null ? <Trans>Heavy sets</Trans> : <Trans>All sets</Trans>}
                {history.calibration !== 'calibrated' ? (
                  <>
                    {' · '}
                    <Trans>still calibrating to your effort ratings</Trans>
                  </>
                ) : null}
              </dd>
            </>
          ) : null}
          <dt className="text-fg-muted">
            <Trans>Training max</Trans>
          </dt>
          <dd className="tabular">
            {history.trainingMax ? (
              <span className="font-semibold">
                {formatMass(history.trainingMax.value, history.trainingMax.unit)}
              </span>
            ) : (
              <Link
                to="/explore/exercises/$exerciseId"
                params={{ exerciseId: id }}
                className="inline-flex min-h-target items-center font-semibold text-info underline underline-offset-4"
              >
                <Trans>Not set. Set it in the exercise details</Trans>
              </Link>
            )}
          </dd>
          {history.bests?.loadKg != null ? (
            <>
              <dt className="text-fg-muted">
                <Trans>Heaviest weight</Trans>
              </dt>
              <dd className="font-semibold tabular">{massFromKg(history.bests.loadKg, unit)}</dd>
            </>
          ) : null}
          {history.bests?.volumeKg != null ? (
            <>
              <dt className="text-fg-muted">
                <Trans>Best session volume</Trans>
              </dt>
              <dd className="font-semibold tabular">
                {massFromKg(history.bests.volumeKg, unit, 0)}
              </dd>
            </>
          ) : null}
        </dl>
      </Card>

      <RepMaxTable name={name} rows={history.repMax} unit={unit} />

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>All sessions</Trans>
        </h2>
        {history.sessions.length === 0 ? (
          <p className="text-fg-muted">
            <Trans>No finished workouts with this exercise yet.</Trans>
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="exercise-sessions">
            {sessions.map((exposure) => (
              <SessionItem key={exposure.sessionId} exposure={exposure} words={summaryWords} />
            ))}
          </ul>
        )}
        {history.sessions.length > sessionsShown ? (
          <Button onClick={() => setSessionsShown((shown) => shown + 10)}>
            <Trans>Show more sessions</Trans>
          </Button>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Personal records</Trans>
        </h2>
        {history.prs.length === 0 ? (
          <p className="text-fg-muted">
            <Trans>No PRs on this exercise yet. Your first session sets the marks to beat.</Trans>
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {prs.map((record) => (
              <li key={record.id} className="flex flex-col">
                <Link
                  to="/session/summary/$sessionId"
                  params={{ sessionId: record.sessionId }}
                  className="flex min-h-target flex-col justify-center rounded-xl py-1 underline-offset-4 hover:underline"
                >
                  <span className="font-semibold">{sessionWords.pr(record, unit)}</span>
                  <span className="text-sm text-fg-muted">
                    {formatLocalDateWithYear(record.localDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {history.prs.length > PRS_SHOWN ? (
          <Button onClick={() => setAllPrs((shown) => !shown)}>
            {allPrs ? <Trans>Show fewer</Trans> : <Trans>Show all {history.prs.length} PRs</Trans>}
          </Button>
        ) : null}
        <Link
          to="/progress/prs"
          search={{ exercise: id }}
          className="inline-flex min-h-target items-center font-semibold text-info underline underline-offset-4"
        >
          <Trans>PR history with filters</Trans>
        </Link>
      </Card>
    </>
  );
}

function SessionItem({
  exposure,
  words,
}: {
  exposure: ExposureSets;
  words: ReturnType<typeof useSummaryWords>;
}) {
  return (
    <li className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0">
      <Link
        to="/session/summary/$sessionId"
        params={{ sessionId: exposure.sessionId }}
        className="inline-flex min-h-target items-center font-semibold underline-offset-4 hover:underline"
      >
        {formatLocalDateWithYear(exposure.localDate)}
      </Link>
      <ol className="flex flex-col gap-0.5 text-sm tabular">
        {exposure.sets.map((set) => (
          <li key={set.id}>
            {set.type === 'warmup' ? (
              <span className="text-fg-muted">
                <Trans>Warm-up: {words.setValues(set)}</Trans>
              </span>
            ) : (
              words.setValues(set)
            )}
          </li>
        ))}
      </ol>
    </li>
  );
}

/** ANL-04: the best load for 1…12+ reps, with the set that holds it. */
function RepMaxTable({
  name,
  rows,
  unit,
}: {
  name: string;
  rows: readonly RepMaxRow[];
  unit: MassUnit;
}) {
  const { t } = useLingui();
  const filled = rows.filter((row) => row.loadKg !== null);
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Rep maxes</Trans>
      </h2>
      {filled.length === 0 ? (
        <p className="text-fg-muted">
          <Trans>
            Your best weight for each rep count shows here after your first working set.
          </Trans>
        </p>
      ) : (
        <table
          className="w-full table-fixed border-collapse text-left text-sm tabular"
          data-testid="rep-max-table"
        >
          <caption className="pb-2 text-left text-fg-muted">
            {t`${name}: the heaviest weight lifted for at least this many reps`}
          </caption>
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[52%]" />
            <col className="w-[30%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-control">
              <th scope="col" className="py-1 pr-2">
                <Trans>Reps</Trans>
              </th>
              <th scope="col" className="py-1 pr-2">
                <Trans>Best set</Trans>
              </th>
              <th scope="col" className="py-1">
                <Trans>Estimate</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <RepMaxLine key={row.reps} row={row} unit={unit} />
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function RepMaxLine({ row, unit }: { row: RepMaxRow; unit: MassUnit }) {
  const { t } = useLingui();
  const effortWords = useEffortWords();
  const reps = row.reps === 12 ? t`12+` : formatNumber(row.reps, 0);
  if (row.loadKg === null) {
    return (
      <tr className="border-t border-border">
        <th scope="row" className="py-1 pr-2 font-semibold">
          {reps}
        </th>
        <td className="py-1 pr-2 text-fg-muted" colSpan={2}>
          <Trans>Not lifted yet</Trans>
        </td>
      </tr>
    );
  }
  const weight = massFromKg(row.loadKg, unit);
  const setReps = row.setReps ?? row.reps;
  const date = row.localDate ? formatLocalDateWithYear(row.localDate) : '';
  const effort =
    row.effortKnown && row.rir !== null ? effortWords.value(row.rir) : t`no effort rating`;
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="py-1 pr-2 font-semibold">
        {reps}
      </th>
      <td className="py-1 pr-2 wrap-anywhere">
        <span className="block font-semibold">{weight}</span>
        <span className="block text-fg-muted">{t`× ${setReps}, ${effort}, ${date}`}</span>
      </td>
      <td className="py-1 wrap-anywhere">
        {row.e1rmKg === null ? '–' : massFromKg(row.e1rmKg, unit, 1)}
      </td>
    </tr>
  );
}
