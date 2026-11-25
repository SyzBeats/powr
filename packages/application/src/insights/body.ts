import {
  DEFAULT_MEASUREMENT_SITES,
  MEASUREMENT_SITES,
  addDays,
  isSkinfold,
  toKg,
  toLocalDate,
  type BodyweightEntry,
  type InstantTz,
  type LocalDate,
  type Mass,
  type MeasurementEntry,
  type MeasurementSite,
  type MeasurementUnit,
} from '@powr/domain';
import {
  bodyweightRate,
  bodyweightTrend,
  firstReadingPerDay,
  measurementSeries,
  rateBand,
  type BodyweightPoint,
  type BodyweightRate,
  type MeasurementSeries,
  type RateBand,
} from '@powr/domain/bodyweight';
import type { Explained } from '@powr/domain/explain';

import type { Deps } from '../deps';
import type { Observable } from '../ports';
import { err, ok, type Result } from '../result';
import { prepareFrom, PREPARE_TABLES, loadPrepareInputs } from '../session/context';

/*
 * Bodyweight (BOD-01, BOD-02) and body measurements (BOD-03): logging with date and time (default
 * now) and a note, editing and deleting past entries; the daily EMA trend from each day's first
 * reading (morning weigh-ins, EB §Nutrition › Trend smoothing), the weekly rate from the
 * regression over the last 14–28 days, and the rate against the phase's band with its "Why?"
 * (never an alert from a single day's weight). Measurements per site, with the configured list
 * of sites (circumferences by default, skinfolds opt-in).
 */

/** BOD-01 plausibility: a bodyweight between these (kg) is accepted. */
const BODYWEIGHT_KG = { min: 20, max: 400 } as const;

export type BodyweightError =
  | { readonly kind: 'implausible' }
  | { readonly kind: 'future' }
  | { readonly kind: 'notFound' };

function measuredAtOf(deps: Deps, at: InstantTz | undefined): InstantTz {
  return at ?? deps.clock.now();
}

function validMass(mass: Mass): boolean {
  const kg = toKg(mass);
  return Number.isFinite(kg) && kg >= BODYWEIGHT_KG.min && kg <= BODYWEIGHT_KG.max;
}

/** BOD-01: logs a bodyweight (now, or at a past time). */
export async function logBodyweight(
  deps: Deps,
  input: { readonly mass: Mass; readonly measuredAt?: InstantTz; readonly note?: string },
): Promise<Result<BodyweightEntry, BodyweightError>> {
  if (!validMass(input.mass)) return err({ kind: 'implausible' });
  const now = deps.clock.now();
  const measuredAt = measuredAtOf(deps, input.measuredAt);
  if (measuredAt.epochMs > now.epochMs + 60_000) return err({ kind: 'future' });
  const entry: BodyweightEntry = {
    id: deps.ids.next(),
    localDate: toLocalDate(measuredAt),
    measuredAt,
    mass: input.mass,
    ...(input.note ? { note: input.note.slice(0, 2000) } : {}),
  };
  await deps.uow.write(['bodyweights'], (repos) => repos.bodyweights.put(entry));
  return ok(entry);
}

/** BOD-01: edits a past entry (mass, time, note; an empty note removes it). */
export async function editBodyweight(
  deps: Deps,
  input: {
    readonly id: string;
    readonly mass?: Mass;
    readonly measuredAt?: InstantTz;
    readonly note?: string;
  },
): Promise<Result<BodyweightEntry, BodyweightError>> {
  if (input.mass && !validMass(input.mass)) return err({ kind: 'implausible' });
  if (input.measuredAt && input.measuredAt.epochMs > deps.clock.now().epochMs + 60_000)
    return err({ kind: 'future' });
  return deps.uow.write(['bodyweights'], async (repos) => {
    const current = await repos.bodyweights.get(input.id);
    if (!current) return err({ kind: 'notFound' as const });
    const measuredAt = input.measuredAt ?? current.measuredAt;
    const { note: _note, ...rest } = current;
    const note = input.note === undefined ? current.note : input.note.slice(0, 2000);
    const next: BodyweightEntry = {
      ...rest,
      mass: input.mass ?? current.mass,
      measuredAt,
      localDate: toLocalDate(measuredAt),
      ...(note ? { note } : {}),
    };
    await repos.bodyweights.put(next);
    return ok(next);
  });
}

/** BOD-01: deletes an entry. */
export async function deleteBodyweight(
  deps: Deps,
  id: string,
): Promise<Result<void, BodyweightError>> {
  return deps.uow.write(['bodyweights'], async (repos) => {
    if (!(await repos.bodyweights.get(id))) return err({ kind: 'notFound' as const });
    await repos.bodyweights.delete(id);
    return ok(undefined);
  });
}

export interface BodyweightView {
  /** Every entry, newest first (several per day are allowed). */
  readonly entries: readonly BodyweightEntry[];
  /** The trend over each day's first reading (BOD-02): raw, winsorised and smoothed values. */
  readonly points: readonly BodyweightPoint[];
  readonly latest: BodyweightPoint | null;
  readonly rate: Explained<BodyweightRate | null>;
  /** The rate against the phase's band (bulk, cut, maintain), with the sustained-rate guard. */
  readonly band: Explained<RateBand>;
}

/** BOD-02: the bodyweight trend, rate and band. */
export async function bodyweightOverview(
  deps: Deps,
  input: { readonly from?: LocalDate } = {},
): Promise<BodyweightView> {
  const loaded = await deps.uow.read(PREPARE_TABLES, loadPrepareInputs);
  return bodyweightFrom(deps, loaded, input.from ?? null);
}

/** BOD-02, live: re-emits after every logged, edited or deleted entry. */
export function observeBodyweight(
  deps: Deps,
  input: { readonly from?: LocalDate } = {},
): Observable<BodyweightView> {
  return mapped(deps.queries.observe(PREPARE_TABLES, loadPrepareInputs), (loaded) =>
    bodyweightFrom(deps, loaded, input.from ?? null),
  );
}

async function bodyweightFrom(
  deps: Deps,
  loaded: Awaited<ReturnType<typeof loadPrepareInputs>>,
  from: LocalDate | null,
): Promise<BodyweightView> {
  const prepared = await prepareFrom(deps, loaded);
  const rules = prepared.rules(null);
  const daily = firstReadingPerDay(loaded.bodyweights);
  const points = bodyweightTrend(
    daily.map((entry) => ({ localDate: entry.localDate, mass: entry.mass })),
    rules,
  ).value;
  const latest = points.at(-1) ?? null;
  const rateAt = (days: number) =>
    latest
      ? (bodyweightRate(
          points.filter((point) => point.localDate <= addDays(latest.localDate, -days)),
          rules,
        ).value?.pctPerWeek ?? null)
      : null;
  return {
    entries: loaded.bodyweights.toReversed(),
    points: from === null ? points : points.filter((point) => point.localDate >= from),
    latest,
    rate: bodyweightRate(points, rules),
    band: rateBand(
      [rateAt(0), rateAt(7), rateAt(14)],
      prepared.profile?.phase ?? 'notTracking',
      prepared.level,
      rules,
    ),
  };
}

// --- Measurements (BOD-03) ------------------------------------------------------------------

export type MeasurementError =
  | { readonly kind: 'invalidValue' }
  | { readonly kind: 'invalidUnit' }
  | { readonly kind: 'future' }
  | { readonly kind: 'notFound' };

function checkMeasurement(
  site: MeasurementSite,
  value: number,
  unit: MeasurementUnit,
): MeasurementError | null {
  if (!(MEASUREMENT_SITES as readonly string[]).includes(site)) return { kind: 'invalidUnit' };
  if (isSkinfold(site) !== (unit === 'mm')) return { kind: 'invalidUnit' };
  if (!Number.isFinite(value) || value <= 0 || value > 500) return { kind: 'invalidValue' };
  return null;
}

/** BOD-03: logs a measurement. */
export async function logMeasurement(
  deps: Deps,
  input: {
    readonly site: MeasurementSite;
    readonly value: number;
    readonly unit: MeasurementUnit;
    readonly measuredAt?: InstantTz;
    readonly note?: string;
  },
): Promise<Result<MeasurementEntry, MeasurementError>> {
  const problem = checkMeasurement(input.site, input.value, input.unit);
  if (problem) return err(problem);
  const measuredAt = measuredAtOf(deps, input.measuredAt);
  if (measuredAt.epochMs > deps.clock.now().epochMs + 60_000) return err({ kind: 'future' });
  const entry: MeasurementEntry = {
    id: deps.ids.next(),
    site: input.site,
    localDate: toLocalDate(measuredAt),
    measuredAt,
    value: input.value,
    unit: input.unit,
    ...(input.note ? { note: input.note.slice(0, 2000) } : {}),
  };
  await deps.uow.write(['measurements'], (repos) => repos.measurements.put(entry));
  return ok(entry);
}

/** BOD-03: edits a measurement (value, unit, time, note). */
export async function editMeasurement(
  deps: Deps,
  input: {
    readonly id: string;
    readonly value?: number;
    readonly unit?: MeasurementUnit;
    readonly measuredAt?: InstantTz;
    readonly note?: string;
  },
): Promise<Result<MeasurementEntry, MeasurementError>> {
  return deps.uow.write(['measurements'], async (repos) => {
    const current = await repos.measurements.get(input.id);
    if (!current) return err({ kind: 'notFound' as const });
    const value = input.value ?? current.value;
    const unit = input.unit ?? current.unit;
    const problem = checkMeasurement(current.site, value, unit);
    if (problem) return err(problem);
    const measuredAt = input.measuredAt ?? current.measuredAt;
    const { note: _note, ...rest } = current;
    const note = input.note === undefined ? current.note : input.note.slice(0, 2000);
    const next: MeasurementEntry = {
      ...rest,
      value,
      unit,
      measuredAt,
      localDate: toLocalDate(measuredAt),
      ...(note ? { note } : {}),
    };
    await repos.measurements.put(next);
    return ok(next);
  });
}

export async function deleteMeasurement(
  deps: Deps,
  id: string,
): Promise<Result<void, MeasurementError>> {
  return deps.uow.write(['measurements'], async (repos) => {
    if (!(await repos.measurements.get(id))) return err({ kind: 'notFound' as const });
    await repos.measurements.delete(id);
    return ok(undefined);
  });
}

export interface MeasurementsView {
  /** The sites to show: the configured list, plus any other site with data. */
  readonly sites: readonly MeasurementSite[];
  readonly series: readonly MeasurementSeries<MeasurementSite>[];
}

/** BOD-03: the trend of every shown site. */
export async function measurementsOverview(deps: Deps): Promise<MeasurementsView> {
  const loaded = await deps.uow.read(['measurements', 'settings'], async (repos) => ({
    entries: await repos.measurements.list(),
    settings: await repos.settings.get(),
  }));
  const configured = loaded.settings?.insights?.measurementSites ?? DEFAULT_MEASUREMENT_SITES;
  const withData = new Set(loaded.entries.map((entry) => entry.site));
  const sites = MEASUREMENT_SITES.filter((site) => configured.includes(site) || withData.has(site));
  return { sites, series: sites.map((site) => measurementSeries(site, loaded.entries)) };
}

/** Maps a live query's values with an async function, keeping their order. */
function mapped<T, U>(source: Observable<T>, map: (value: T) => Promise<U>): Observable<U> {
  return {
    subscribe(observer) {
      let latest = 0;
      let closed = false;
      const subscription = source.subscribe({
        next: (value) => {
          const sequence = ++latest;
          map(value).then(
            (result) => {
              if (!closed && sequence === latest) observer.next(result);
            },
            (error: unknown) => observer.error?.(error),
          );
        },
        error: (error) => observer.error?.(error),
      });
      return {
        unsubscribe: () => {
          closed = true;
          subscription.unsubscribe();
        },
      };
    },
  };
}
