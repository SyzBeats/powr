import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { CircleArrowDown, CircleArrowUp, CircleCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { WeeklyVolumeView } from '@powr/application/insights';
import type { LocalDate, MuscleId } from '@powr/domain';
import { heatStep, type MuscleWeekRow, type TargetStatus } from '@powr/domain/analytics';
import { paramsUsed } from '@powr/domain/explain';
import type { WeeklyVolumeBands } from '@powr/domain/rules';

import { Badge } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { VolumeChart, type VolumeWeek } from '#ui/charts/volume-chart';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';
import { Sheet } from '#ui/sheet';

import { useInsight, useLiveInsight } from '../../hooks/use-insights';
import {
  addLocalDays,
  formatLocalDate,
  formatLocalDateWithYear,
  formatNumber,
  todayLocal,
} from '../../i18n/format';
import { useHeatBands, useSetsText, useVolumeWords } from '../insights/words';
import { useLabels } from '../labels';
import { massFromKg, useLoadUnit } from '../session/words';
import { WhyButton } from '../why/WhySheet';
import { Loading } from './parts';
import type { VolumeMode } from './search';
import { useLiftName } from './words';

/** About five years of weeks for "All" (the reference history size, §8.19). */
const ALL_DAYS = 5 * 365;

/**
 * ANL-03: weekly hard sets per muscle against the target band. The table lists every muscle for
 * this week, last week or the 4-week average (the same rows the body map colours, one
 * calculation); a muscle opens its contributing exercises, sub-regions and the weekly chart, and a
 * week of the chart opens that week's contributing exercises.
 */
export function VolumeScreen({
  mode = 'week',
  muscle,
}: {
  mode?: VolumeMode | undefined;
  muscle?: string | undefined;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const volume = useLiveInsight(`volume:${mode}`, (insights, deps) =>
    insights.observeWeeklyVolume(deps, { mode }),
  );
  const view = volume.loaded ? volume.value : null;
  const selected = view?.rows.find((row) => row.muscle === muscle) ?? null;

  const go = (next: { mode: VolumeMode; muscle: string | null }) =>
    void navigate({
      to: '/progress/volume',
      search: {
        ...(next.mode === 'week' ? {} : { mode: next.mode }),
        ...(next.muscle ? { muscle: next.muscle } : {}),
      },
      replace: true,
      resetScroll: false,
    });

  return (
    <Screen title={t`Volume per muscle`}>
      <Segmented
        label={t`Weeks shown`}
        value={mode}
        onChange={(next) => go({ mode: next, muscle: muscle ?? null })}
        options={[
          { value: 'week', label: t`This week` },
          { value: 'lastWeek', label: t`Last week` },
          { value: 'avg4', label: t`4-week average` },
        ]}
      />
      {!view ? (
        <Loading />
      ) : (
        <>
          <WeekLine view={view} />
          {selected ? (
            <MuscleDetail
              key={selected.muscle}
              row={selected}
              view={view}
              onClose={() => go({ mode, muscle: null })}
            />
          ) : null}
          <VolumeTable
            view={view}
            selected={muscle ?? null}
            onSelect={(id) => go({ mode, muscle: id === muscle ? null : id })}
          />
          <LiftsCard view={view} />
        </>
      )}
    </Screen>
  );
}

function WeekLine({ view }: { view: WeeklyVolumeView }) {
  const first = formatLocalDate(view.weeks[0] ?? view.weekStart, 'long');
  return (
    <p className="text-fg-muted">
      {view.mode === 'week' ? (
        <Trans>
          This week so far, from {first}. Planned sets still to come are listed per muscle.
        </Trans>
      ) : view.mode === 'lastWeek' ? (
        <Trans>Last week, from {first}.</Trans>
      ) : (
        <Trans>The average of the four weeks before this one, from {first}.</Trans>
      )}
    </p>
  );
}

function useStatusBadge() {
  const words = useVolumeWords();
  return (status: TargetStatus) =>
    status === 'in' ? (
      <Badge tone="ok" icon={CircleCheck}>
        {words.status(status)}
      </Badge>
    ) : status === 'under' ? (
      <Badge tone="info" icon={CircleArrowDown}>
        {words.status(status)}
      </Badge>
    ) : (
      <Badge tone="warning" icon={CircleArrowUp}>
        {words.status(status)}
      </Badge>
    );
}

/** The table's status: an icon by target status and the heat band in words (never colour alone). */
function StatusLine({ row }: { row: Pick<MuscleWeekRow, 'status' | 'heatLabel'> }) {
  const words = useVolumeWords();
  const Icon =
    row.status === 'in' ? CircleCheck : row.status === 'under' ? CircleArrowDown : CircleArrowUp;
  const tone =
    row.status === 'in' ? 'text-success' : row.status === 'under' ? 'text-info' : 'text-warning';
  return (
    <span className="flex items-start gap-1 font-medium">
      <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${tone}`} />
      <span>{words.heatLabel(row.heatLabel)}</span>
    </span>
  );
}

function VolumeTable({
  view,
  selected,
  onSelect,
}: {
  view: WeeklyVolumeView;
  selected: string | null;
  onSelect: (muscle: MuscleId) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useVolumeWords();
  const caption =
    view.mode === 'week'
      ? t`Hard sets per muscle this week`
      : view.mode === 'lastWeek'
        ? t`Hard sets per muscle last week`
        : t`Hard sets per muscle, 4-week average`;
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>All muscles</Trans>
      </h2>
      <table
        className="w-full table-fixed border-collapse text-left text-sm tabular"
        data-testid="volume-table"
      >
        <caption className="pb-2 text-left text-fg-muted">{caption}</caption>
        <colgroup>
          <col className="w-[38%]" />
          <col className="w-[30%]" />
          <col className="w-[32%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-control">
            <th scope="col" className="py-1 pr-2">
              <Trans>Muscle</Trans>
            </th>
            <th scope="col" className="py-1 pr-2">
              <Trans>Hard sets</Trans>
            </th>
            <th scope="col" className="py-1">
              <Trans>Target</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => {
            const name = labels.muscle(row.muscle);
            const direct = formatNumber(row.direct, 1);
            return (
              <tr key={row.muscle} className="border-b border-border align-top">
                <th scope="row" className="py-1 pr-2 font-normal wrap-anywhere hyphens-auto">
                  <button
                    type="button"
                    aria-pressed={selected === row.muscle}
                    onClick={() => onSelect(row.muscle)}
                    className="min-h-target w-full text-left font-semibold text-info underline underline-offset-4 aria-pressed:no-underline"
                  >
                    {name}
                  </button>
                </th>
                <td className="py-2 pr-2 wrap-anywhere">
                  <span className="block font-semibold">{formatNumber(row.fractional, 1)}</span>
                  <span className="block text-fg-muted">
                    <Trans>{direct} direct</Trans>
                  </span>
                </td>
                <td className="py-2 wrap-anywhere">
                  <span className="block">{words.band(row)}</span>
                  <StatusLine row={row} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-sm text-fg-muted">
        <Trans>
          Hard sets count each set fully for its main muscles and half for the muscles that help;
          direct sets count main muscles only. Choose a muscle for its exercises and weekly chart.
        </Trans>
      </p>
    </Card>
  );
}

function useTargetSourceText() {
  const { t } = useLingui();
  const labels = useLabels();
  return (source: MuscleWeekRow['target']['source']): string =>
    source === 'band' ? t`the evidence-based default` : labels.targetSource(source);
}

/** The weekly band values the row was classified with (the registry row in its "Why?"). */
function bandsOf(row: MuscleWeekRow): WeeklyVolumeBands | null {
  const ref = paramsUsed(row.why).find((param) => param.id === 'volume.hypertrophy.weeklyBands');
  return (ref?.value as WeeklyVolumeBands | undefined) ?? null;
}

function MuscleDetail({
  row,
  view,
  onClose,
}: {
  row: MuscleWeekRow;
  view: WeeklyVolumeView;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useVolumeWords();
  const setsText = useSetsText();
  const sourceText = useTargetSourceText();
  const badge = useStatusBadge();
  const heading = useRef<HTMLHeadingElement>(null);
  const name = labels.muscle(row.muscle);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const remaining = view.mode === 'week' && row.remaining.fractional > 0;
  const remainingText = setsText(row.remaining.fractional);
  return (
    <section
      aria-labelledby="volume-muscle"
      className="flex flex-col gap-3 rounded-2xl border-2 border-info bg-surface p-4"
      data-testid="volume-muscle"
    >
      <div className="flex items-start justify-between gap-2">
        <h2
          id="volume-muscle"
          ref={heading}
          tabIndex={-1}
          className="pt-2 text-xl font-bold outline-none"
        >
          {name}
        </h2>
        <Button size="icon" aria-label={t`Close ${name}`} onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-fg-muted">
          <Trans>Hard sets</Trans>
        </dt>
        <dd className="font-semibold tabular">{setsText(row.fractional)}</dd>
        <dt className="text-fg-muted">
          <Trans>Direct sets</Trans>
        </dt>
        <dd className="tabular">{setsText(row.direct)}</dd>
        <dt className="text-fg-muted">
          <Trans>Target</Trans>
        </dt>
        <dd>
          <Trans>
            {words.band(row)}, from {sourceText(row.target.source)}
          </Trans>
        </dd>
        <dt className="text-fg-muted">
          <Trans>Status</Trans>
        </dt>
        <dd className="flex flex-wrap items-center gap-2">
          {badge(row.status)}
          <span>{words.heatLabel(row.heatLabel)}</span>
        </dd>
        {remaining ? (
          <>
            <dt className="text-fg-muted">
              <Trans>Still planned</Trans>
            </dt>
            <dd className="tabular">
              <Trans>{remainingText} in this week's remaining sessions</Trans>
            </dd>
          </>
        ) : null}
      </dl>
      <WhyButton why={row.why} subject={t`${name} volume`} className="self-start" />
      <Contributors row={row} />
      {row.subRegions.some((sub) => sub.fractional > 0) ? (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">
            <Trans>By region</Trans>
          </h3>
          <ul className="flex flex-col gap-1">
            {row.subRegions.map((sub) => (
              <li key={sub.muscle} className="flex flex-wrap justify-between gap-x-2">
                <span>{labels.muscle(sub.muscle)}</span>
                <span className="tabular">{setsText(sub.fractional)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <MuscleHistory row={row} name={name} />
      <Link
        to="/explore/body-map/$muscleId"
        params={{ muscleId: row.muscle }}
        className={buttonClass({ size: 'lg' })}
      >
        <Trans>Best exercises for {name}</Trans>
      </Link>
    </section>
  );
}

function Contributors({ row }: { row: Pick<MuscleWeekRow, 'contributors'> }) {
  const labels = useLabels();
  const setsText = useSetsText();
  if (row.contributors.length === 0) {
    return (
      <p className="text-fg-muted">
        <Trans>No hard sets for this muscle in these weeks.</Trans>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-semibold">
        <Trans>Contributing exercises</Trans>
      </h3>
      <ul className="flex flex-col gap-1" data-testid="volume-contributors">
        {row.contributors.map((entry) => {
          const sets = formatNumber(entry.sets, 1);
          const credit = formatNumber(entry.credit, 2);
          const added = setsText(entry.fractional);
          return (
            <li key={entry.exerciseId} className="flex flex-col">
              <span className="font-semibold">{labels.exercise(entry.exerciseId)}</span>
              <span className="text-sm text-fg-muted">
                <Trans>
                  {sets} hard sets × {credit} credit = {added}
                </Trans>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MuscleHistory({ row, name }: { row: MuscleWeekRow; name: string }) {
  const { t } = useLingui();
  const bands = useHeatBands();
  const setsText = useSetsText();
  const [all, setAll] = useState(false);
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const today = todayLocal();
  const from = addLocalDays(today, all ? -ALL_DAYS : -364) as LocalDate;
  const history = useInsight(`volume-history:${row.muscle}:${from}`, (insights, deps) =>
    insights.volumeHistory(deps, { from, muscles: [row.muscle] }),
  );
  const weekly = bandsOf(row);
  const points = history.loaded ? (history.value.series[0]?.points ?? []) : [];
  const weeks: VolumeWeek[] = points.map((point) => {
    const target =
      point.target === null || weekly === null
        ? {
            low: weekly?.defaultLow ?? row.target.low,
            high: weekly?.defaultHigh ?? row.target.high,
          }
        : { low: point.target, high: Math.max(weekly.defaultHigh, point.target) };
    return {
      week: point.weekStart,
      sets: Math.round(point.fractional * 10) / 10,
      direct: Math.round(point.direct * 10) / 10,
      ...(weekly ? { step: heatStep(point.fractional, target, weekly) } : {}),
    };
  });
  const recent = weeks.slice(-12);
  const inTarget = recent.filter((week) => week.step === 3).length;
  const latest = weeks.at(-1);
  const summary =
    !latest || weeks.every((week) => week.sets === 0)
      ? t`${name}: no hard sets in the last year yet.`
      : t`${name}: ${setsText(latest.sets)} in the latest week; in your target in ${inTarget} of the last ${recent.length} weeks.`;
  return (
    <>
      {!history.loaded ? (
        <Loading />
      ) : (
        <VolumeChart
          measureId="volume-muscle"
          title={t`${name}: hard sets per week`}
          summary={summary}
          headingLevel={3}
          weeks={weeks}
          target={{ low: row.target.low, high: row.target.high }}
          bands={bands}
          endDate={today}
          onRangeChange={(preset) => {
            if (preset === 'all') setAll(true);
          }}
          onOpen={setOpenWeek}
          openLabel={t`Show the exercises`}
          emptyText={t`No hard sets logged yet.`}
        />
      )}
      <WeekSheet
        muscle={row.muscle}
        name={name}
        week={openWeek}
        onClose={() => setOpenWeek(null)}
      />
    </>
  );
}

/** ANL-03 drill-down: one week's contributing exercises of the muscle. */
function WeekSheet({
  muscle,
  name,
  week,
  onClose,
}: {
  muscle: MuscleId;
  name: string;
  week: string | null;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const setsText = useSetsText();
  const data = useInsight(`volume-week:${week ?? ''}`, async (insights, deps) =>
    week === null ? null : insights.weeklyVolume(deps, { mode: 'week', date: week as LocalDate }),
  );
  const row =
    data.loaded && !data.stale ? data.value?.rows.find((entry) => entry.muscle === muscle) : null;
  const date = week ? formatLocalDateWithYear(week) : '';
  return (
    <Sheet
      open={week !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t`${name}, week of ${date}`}
      closeLabel={t`Close`}
    >
      {row ? (
        <>
          <p className="font-semibold">{setsText(row.fractional)}</p>
          <Contributors row={row} />
        </>
      ) : (
        <Loading />
      )}
    </Sheet>
  );
}

/** PLN-03 for powerlifters: heavy sets, sets and tonnage per competition lift. */
function LiftsCard({ view }: { view: WeeklyVolumeView }) {
  const liftName = useLiftName();
  const unit = useLoadUnit();
  const lifts = view.lifts.filter((lift) => lift.sets > 0 || lift.target !== null);
  if (lifts.length === 0) return null;
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Competition lifts</Trans>
      </h2>
      <ul className="flex flex-col gap-2">
        {lifts.map((lift) => {
          const heavy = formatNumber(lift.heavySets, 1);
          const target = lift.target === null ? null : formatNumber(lift.target, 1);
          const sets = formatNumber(lift.sets, 1);
          const tonnage = massFromKg(lift.tonnageKg, unit, 0);
          return (
            <li key={lift.lift} className="flex flex-col">
              <span className="font-semibold">{liftName(lift.lift)}</span>
              <span className="text-sm">
                {target === null ? (
                  <Trans>
                    {heavy} heavy sets, {sets} sets in all, {tonnage} lifted
                  </Trans>
                ) : (
                  <Trans>
                    {heavy} of {target} planned heavy sets, {sets} sets in all, {tonnage} lifted
                  </Trans>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-fg-muted">
        <Trans>
          Heavy sets are hard sets of the lift or a close variant at about 80% of your 1-rep max or
          more, with 6 reps or fewer.
        </Trans>
      </p>
    </Card>
  );
}
