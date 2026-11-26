import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

import type { Deps } from '@powr/application';
import type { BodyweightView, MeasurementsView } from '@powr/application/insights';
import type { BodyweightEntry, MassUnit } from '@powr/domain';
import type { MeasurementSeries } from '@powr/domain/bodyweight';

import { announce } from '#ui/announcer';
import { Button, buttonClass } from '#ui/button';
import { BodyweightChart } from '#ui/charts/bodyweight-chart';
import { TrendChart } from '#ui/charts/trend-chart';
import { DecimalField, Field } from '#ui/field';
import { Card, Screen } from '#ui/screen';
import { Sheet } from '#ui/sheet';

import { useInsight, useInsights, useLiveInsight, type Insights } from '../../hooks/use-insights';
import { useProfile } from '../../hooks/use-planning';
import { formatDateTime, formatLocalDate, formatNumber, todayLocal } from '../../i18n/format';
import { WhyButton } from '../why/WhySheet';
import { bodyMass, kgToUnit, useBodyWords, useBodyweightUnit } from './words';

const KG_PER_LB = 0.45359237;
/** How many weigh-ins the list shows before "Show all". */
const SHOWN = 10;

const openBodyweight = (insights: Insights, deps: Deps) => insights.observeBodyweight(deps);

function kgOf(mass: BodyweightEntry['mass']): number {
  return mass.unit === 'kg' ? mass.value : mass.value * KG_PER_LB;
}

/**
 * BOD-02 and BOD-03: the bodyweight trend (the EMA of each day's first reading) with the weekly
 * rate against the phase's band and its "Why?", every weigh-in (edit and delete, BOD-01), and the
 * measurements per site with their changes and trend. Reached from Home and the Progress tab.
 */
export function BodyScreen() {
  const { t } = useLingui();
  const view = useLiveInsight('bodyweight', openBodyweight);
  // The user's unit comes with the profile; no values in a default unit before it is known.
  const profile = useProfile();
  return (
    <Screen title={t`Bodyweight and measurements`}>
      <div className="flex flex-col gap-2">
        <Link to="/body/log" className={buttonClass({ variant: 'primary', size: 'lg' })}>
          <Trans>Log bodyweight</Trans>
        </Link>
        <Link
          to="/body/log"
          search={{ what: 'measurements' }}
          className={buttonClass({ size: 'lg' })}
        >
          <Trans>Log measurements</Trans>
        </Link>
      </div>
      {view.loaded && profile.loaded ? (
        <>
          <TrendCard view={view.value} />
          <WeighIns entries={view.value.entries} />
        </>
      ) : (
        <output className="block text-fg-muted">
          <Trans>Loading your weigh-ins…</Trans>
        </output>
      )}
      <Measurements />
    </Screen>
  );
}

function TrendCard({ view }: { view: BodyweightView }) {
  const { t } = useLingui();
  const unit = useBodyweightUnit();
  const words = useBodyWords();
  const toUnit = (kg: number) => Math.round(kgToUnit(kg, unit) * 10) / 10;
  const entries = view.points.map((point) => ({
    date: point.localDate,
    value: toUnit(point.rawKg),
  }));
  const trend = view.points.flatMap((point) =>
    point.trendKg === null ? [] : [{ date: point.localDate, value: toUnit(point.trendKg) }],
  );
  const latestTrend = view.latest?.trendKg ?? null;
  const rate = view.rate.value;
  const summary =
    latestTrend === null
      ? t`Your trend starts after a few weigh-ins.`
      : rate
        ? t`Trend ${words.mass(latestTrend, unit)}, changing by ${words.rate(rate, unit)}.`
        : t`Trend ${words.mass(latestTrend, unit)}. Not enough data yet for a weekly rate: it shows once your weigh-ins span ${view.rateMinDays} days.`;
  const format = (value: number) =>
    unit === 'kg' ? bodyMass(value, 'kg') : bodyMass(value * KG_PER_LB, 'lb');
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Trend</Trans>
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-fg-muted">
          <Trans>Trend</Trans>
        </dt>
        <dd className="font-semibold tabular" data-testid="body-trend">
          {latestTrend === null ? <Trans>Not yet</Trans> : words.mass(latestTrend, unit)}
        </dd>
        <dt className="text-fg-muted">
          <Trans>Weekly rate</Trans>
        </dt>
        <dd className="font-semibold tabular" data-testid="body-rate">
          {rate ? words.rate(rate, unit) : <Trans>Not enough data yet</Trans>}
        </dd>
        <dt className="text-fg-muted">
          <Trans>Target range</Trans>
        </dt>
        <dd className="flex flex-wrap items-center gap-x-2 font-semibold">
          {words.band(view.band.value)}
          <WhyButton why={view.band.why} subject={t`your bodyweight rate`} />
        </dd>
      </dl>
      {view.rate.value ? (
        <WhyButton why={view.rate.why} subject={t`the weekly rate`} className="self-start">
          <Trans>How the rate is worked out</Trans>
        </WhyButton>
      ) : null}
      <BodyweightChart
        title={t`Bodyweight trend`}
        headingLevel={3}
        summary={summary}
        entries={entries}
        trend={trend}
        unit={unit}
        formatValue={format}
        endDate={todayLocal()}
        defaultRange="12w"
      />
      <p className="text-sm text-fg-muted">
        <Trans>
          The trend smooths out day-to-day water and food changes, so a single weigh-in never raises
          an alarm. It uses each day's first weigh-in.
        </Trans>
      </p>
    </Card>
  );
}

function WeighIns({ entries }: { entries: readonly BodyweightEntry[] }) {
  const unit = useBodyweightUnit();
  const words = useBodyWords();
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<BodyweightEntry | null>(null);
  const shown = all ? entries : entries.slice(0, SHOWN);
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Weigh-ins</Trans>
      </h2>
      {entries.length === 0 ? (
        <p className="text-fg-muted">
          <Trans>No weigh-ins yet.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col" data-testid="weigh-ins">
          {shown.map((entry) => {
            const value = words.mass(kgOf(entry.mass), unit);
            const when = formatDateTime(entry.measuredAt.epochMs);
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold tabular">{value}</span>
                  <span className="text-sm text-fg-muted">{when}</span>
                  {entry.note ? <span className="text-sm">{entry.note}</span> : null}
                </span>
                <EditButton label={value} when={when} onClick={() => setEditing(entry)} />
              </li>
            );
          })}
        </ul>
      )}
      {entries.length > SHOWN && !all ? (
        <Button size="lg" onClick={() => setAll(true)}>
          <Trans>Show all {entries.length} weigh-ins</Trans>
        </Button>
      ) : null}
      {editing ? (
        <EditWeighIn
          key={editing.id}
          entry={editing}
          unit={unit}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}

function EditButton({
  label,
  when,
  onClick,
}: {
  label: string;
  when: string;
  onClick: () => void;
}) {
  const { t } = useLingui();
  return (
    <button
      type="button"
      aria-label={t`Edit ${label}, ${when}`}
      aria-haspopup="dialog"
      onClick={onClick}
      className="flex size-target shrink-0 items-center justify-center rounded-xl border border-control"
    >
      <Pencil aria-hidden="true" className="size-5" />
    </button>
  );
}

/** BOD-01: edit or delete a past weigh-in (delete asks once more). */
function EditWeighIn({
  entry,
  unit,
  onClose,
}: {
  entry: BodyweightEntry;
  unit: MassUnit;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const run = useInsights();
  const [value, setValue] = useState<number | null>(
    Math.round(kgToUnit(kgOf(entry.mass), unit) * 10) / 10,
  );
  const [note, setNote] = useState(entry.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (value === null) {
      setError(t`Enter a bodyweight, for example 80.5.`);
      return;
    }
    const result = await run((insights, deps) =>
      insights.editBodyweight(deps, { id: entry.id, mass: { value, unit }, note: note.trim() }),
    );
    if (!result.ok) {
      setError(
        result.error.kind === 'implausible'
          ? t`That weight looks off. Check the number and the unit.`
          : t`This weigh-in no longer exists.`,
      );
      return;
    }
    announce(t`Weigh-in updated.`);
    onClose();
  };

  const remove = async () => {
    await run((insights, deps) => insights.deleteBodyweight(deps, entry.id));
    announce(t`Weigh-in deleted.`);
    onClose();
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t`Edit weigh-in`}
      description={formatDateTime(entry.measuredAt.epochMs)}
      closeLabel={t`Close`}
    >
      <DecimalField
        label={t`Bodyweight`}
        suffix={unit === 'kg' ? t`kg` : t`lb`}
        value={value}
        onValueChange={setValue}
        error={error ?? undefined}
      />
      <Field
        label={t`Note (optional)`}
        value={note}
        maxLength={2000}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button variant="primary" size="lg" onClick={() => void save()}>
        <Trans>Save changes</Trans>
      </Button>
      {confirmDelete ? (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-danger p-3">
          <p className="font-semibold">
            <Trans>Delete this weigh-in? This cannot be undone.</Trans>
          </p>
          <Button variant="danger" size="lg" onClick={() => void remove()}>
            <Trans>Delete weigh-in</Trans>
          </Button>
          <Button size="lg" onClick={() => setConfirmDelete(false)}>
            <Trans>Keep it</Trans>
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={() => setConfirmDelete(true)}>
          <Trans>Delete…</Trans>
        </Button>
      )}
    </Sheet>
  );
}

/** BOD-03: every tracked site with its latest value, its changes and, on request, its trend. */
function Measurements() {
  const overview = useInsight('measurements', (insights, deps) =>
    insights.measurementsOverview(deps),
  );
  return (
    <Card>
      <h2 id="measurements" className="text-lg font-semibold">
        <Trans>Measurements</Trans>
      </h2>
      {overview.loaded ? (
        <MeasurementList view={overview.value} />
      ) : (
        <output className="block text-fg-muted">
          <Trans>Loading your measurements…</Trans>
        </output>
      )}
      <Link to="/settings" hash="insights" className={buttonClass({ size: 'lg' })}>
        <Trans>Choose which sites to track</Trans>
      </Link>
    </Card>
  );
}

function MeasurementList({ view }: { view: MeasurementsView }) {
  const withData = view.series.filter((series) => series.points.length > 0);
  if (withData.length === 0) {
    return (
      <p className="text-fg-muted">
        <Trans>
          No measurements yet. Waist, hips, arms and thighs show change that the scale can miss.
        </Trans>
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3" data-testid="measurements">
      {withData.map((series) => (
        <li key={series.site}>
          <SiteRow series={series} />
        </li>
      ))}
    </ul>
  );
}

/** "+1.5", "−0.4": a change with its sign. */
function signed(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(Math.round(value * 10) / 10);
}

function SiteRow({ series }: { series: MeasurementSeries<MeasurementsView['sites'][number]> }) {
  const { t } = useLingui();
  const words = useBodyWords();
  const name = words.site(series.site);
  const latest = series.latest;
  const unitWord = series.unit === 'mm' ? t`mm` : series.unit === 'cm' ? t`cm` : t`in`;
  const points = series.points.map((point) => ({ date: point.localDate, value: point.value }));
  const chartSeries = [{ name, points, trend: points }];
  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="flex min-h-target cursor-pointer flex-wrap items-center justify-between gap-x-3">
        <span className="font-semibold">{name}</span>
        <span className="tabular">
          {latest ? words.length(latest.value, series.unit) : null}
          {series.fourWeeks !== null ? (
            <span className="block text-sm text-fg-muted">
              <Trans>
                {signed(series.fourWeeks)} {unitWord} in 4 weeks
              </Trans>
            </span>
          ) : series.sinceFirst !== null ? (
            <span className="block text-sm text-fg-muted">
              <Trans>
                {signed(series.sinceFirst)} {unitWord} since the first
              </Trans>
            </span>
          ) : null}
        </span>
      </summary>
      <div className="pt-3">
        <TrendChart
          title={t`${name} over time`}
          headingLevel={3}
          summary={
            latest && series.sinceFirst !== null
              ? t`${name}: ${words.length(latest.value, series.unit)} on ${formatLocalDate(latest.localDate, 'long')}, ${signed(series.sinceFirst)} ${unitWord} since your first measurement.`
              : t`${name}: one measurement so far.`
          }
          series={chartSeries}
          unit={series.unit}
          formatValue={(value) => words.length(value, series.unit)}
          endDate={todayLocal()}
          defaultRange="all"
          measureId={`measurement-${series.site}`}
        />
        <p className="pt-2 text-sm text-fg-muted">
          {formatNumber(series.points.length, 0)}{' '}
          {series.points.length === 1 ? <Trans>measurement</Trans> : <Trans>measurements</Trans>}
        </p>
      </div>
    </details>
  );
}
