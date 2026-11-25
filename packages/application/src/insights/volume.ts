import {
  addDays,
  toLocalDate,
  weekStartOf,
  type IsoWeekday,
  type LocalDate,
  type MuscleId,
  type PlannedSession,
} from '@powr/domain';
import {
  averageWeeks,
  muscleSeries,
  regionsOf,
  volumeRows,
  type BodyView,
  type MuscleSeriesPoint,
  type MuscleWeekRow,
  type WeeklyLift,
  type WeeklyRecord,
  type WeeklySessions,
  type WeeklyTargets,
} from '@powr/domain/analytics';

import type { Deps } from '../deps';
import type { Observable } from '../ports';
import { insightsContext, weekEnd, type InsightsContext } from './context';
import { ensureInsights } from './derived';

/*
 * Volume per muscle against its target (ANL-03) and the body map's heat map (MAP-04, MAP-06 list,
 * MAP-07 sub-regions): "this week" (with the planned remainder of the week as the outlined
 * overlay), "last week" and the "4-week average"; the weekly series per muscle for the ANL-03
 * chart. The values are the derived weeks (`dWeekly`), the same crediting as the session summary
 * and the plan editor (one calculation).
 */

export type VolumeMode = 'week' | 'lastWeek' | 'avg4';

export interface WeeklyVolumeView {
  readonly mode: VolumeMode;
  /** The week shown (the latest of the averaged weeks). */
  readonly weekStart: LocalDate;
  readonly weeks: readonly LocalDate[];
  /** One row per display group, keyed by `mu.*`, with its region per view and its heat step. */
  readonly rows: readonly MuscleWeekRow[];
  /** The body map's regions per view (MAP-01), in taxonomy order. */
  readonly regions: Readonly<
    Record<BodyView, readonly { readonly muscle: MuscleId; readonly region: string }[]>
  >;
  /** Per competition lift: heavy sets, sets and tonnage, with the plan's heavy-set target. */
  readonly lifts: readonly (WeeklyLift & { readonly target: number | null })[];
  readonly sessions: WeeklySessions | null;
  readonly targets: WeeklyTargets | null;
}

export interface VolumeQuery {
  readonly mode?: VolumeMode;
  /** Any day of the week to show (default: today). */
  readonly date?: LocalDate;
}

function weeksOf(
  ctx: Pick<InsightsContext, 'today' | 'weekStartsOn'>,
  query: VolumeQuery,
): LocalDate[] {
  const mode = query.mode ?? 'week';
  const anchor = weekStartOf(query.date ?? ctx.today, ctx.weekStartsOn);
  if (mode === 'week') return [anchor];
  const lastWeek = addDays(anchor, -7);
  if (mode === 'lastWeek') return [lastWeek];
  return [-28, -21, -14, -7].map((days) => addDays(anchor, days));
}

/** ANL-03, MAP-04: the weekly volume view (it rebuilds stale weeks first). */
export async function weeklyVolume(deps: Deps, query: VolumeQuery = {}): Promise<WeeklyVolumeView> {
  const ctx = await insightsContext(deps);
  const weeks = weeksOf(ctx, query);
  const from = weeks[0]!;
  const to = weekEnd(weeks.at(-1)!);
  await ensureInsights(deps, { from, to });
  const loaded = await deps.uow.read(['dWeekly', 'plannedSessions'], async (repos) => ({
    records: await repos.insights.weeks(from, to),
    planned: await repos.plannedSessions.inRange(ctx.today, to),
  }));
  return volumeView(deps, ctx, query.mode ?? 'week', weeks, loaded.records, loaded.planned);
}

/** The live weekly volume (the body map and the ANL-03 table): re-emits when the data changes. */
export function observeWeeklyVolume(
  deps: Deps,
  query: VolumeQuery = {},
): Observable<WeeklyVolumeView> {
  return {
    subscribe(observer) {
      let latest = 0;
      let closed = false;
      let context: Promise<InsightsContext> | null = null;
      const subscription = deps.queries
        .observe(['dWeekly', 'plannedSessions', 'settings', 'plans'], async (repos) => {
          // The weeks are computed inside the live query, so only they are read.
          const settings = await repos.settings.get();
          const plan = await repos.plans.getActive();
          const today = toLocalDate(deps.clock.now());
          const weekStartsOn = (settings?.weekStart ??
            plan?.schedule.weekStartsOn ??
            1) as IsoWeekday;
          const weeks = weeksOf({ today, weekStartsOn }, query);
          const to = weekEnd(weeks.at(-1)!);
          return {
            weeks,
            records: await repos.insights.weeks(weeks[0]!, to),
            planned: await repos.plannedSessions.inRange(today, to),
          };
        })
        .subscribe({
          next: (data) => {
            const sequence = ++latest;
            context ??= insightsContext(deps);
            context
              .then(async (ctx) => {
                const from = data.weeks[0]!;
                const to = weekEnd(data.weeks.at(-1)!);
                const report = await ensureInsights(deps, { from, to });
                // A rebuild re-runs the live query; that emission shows the fresh weeks.
                if (
                  closed ||
                  sequence !== latest ||
                  report.rebuiltWeeks + report.removedWeeks > 0
                ) {
                  return;
                }
                observer.next(
                  volumeView(
                    deps,
                    ctx,
                    query.mode ?? 'week',
                    data.weeks,
                    data.records,
                    data.planned,
                  ),
                );
              })
              .catch((error: unknown) => observer.error?.(error));
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

function volumeView(
  deps: Deps,
  ctx: InsightsContext,
  mode: VolumeMode,
  weeks: readonly LocalDate[],
  records: readonly WeeklyRecord[],
  planned: readonly PlannedSession[],
): WeeklyVolumeView {
  const byWeek = new Map(records.map((record) => [record.weekStart, record]));
  const chosen = weeks.map((week) => byWeek.get(week) ?? null);
  const record = mode === 'avg4' ? averageWeeks(chosen) : (chosen[0] ?? null);
  const weekStart = weeks.at(-1)!;
  const isCurrent = mode === 'week' && weekStart === ctx.currentWeek;
  const groups = deps.content.muscles().groups;
  const rows = volumeRows(
    {
      record,
      groups,
      exercise: (id) => deps.content.exercise(id),
      openPlanned: isCurrent ? planned.filter((entry) => entry.status === 'planned') : [],
    },
    ctx.prepared.rules(null),
  );
  const latest = chosen.at(-1) ?? null;
  const liftTargets = new Map(
    (latest?.targets?.lifts ?? []).map((entry) => [entry.lift, entry.heavySets]),
  );
  const lifts = mode === 'avg4' ? averageLifts(chosen) : (latest?.lifts ?? []);
  return {
    mode,
    weekStart,
    weeks,
    rows,
    regions: { front: regionsOf(groups, 'front'), back: regionsOf(groups, 'back') },
    lifts: lifts.map((lift) => ({ ...lift, target: liftTargets.get(lift.lift) ?? null })),
    sessions: mode === 'avg4' ? null : (latest?.sessions ?? null),
    targets: record?.targets ?? null,
  };
}

function averageLifts(records: readonly (WeeklyRecord | null)[]): WeeklyLift[] {
  const count = Math.max(1, records.length);
  const totals = new Map<
    WeeklyLift['lift'],
    { heavySets: number; sets: number; tonnageKg: number }
  >();
  for (const record of records) {
    for (const lift of record?.lifts ?? []) {
      const total = totals.get(lift.lift) ?? { heavySets: 0, sets: 0, tonnageKg: 0 };
      total.heavySets += lift.heavySets / count;
      total.sets += lift.sets / count;
      total.tonnageKg += lift.tonnageKg / count;
      totals.set(lift.lift, total);
    }
  }
  return [...totals].map(([lift, total]) => ({ lift, ...total }));
}

/** ANL-03 chart: fractional and direct sets per week for each muscle over a range. */
export async function volumeHistory(
  deps: Deps,
  input: {
    readonly from: LocalDate;
    readonly to?: LocalDate;
    readonly muscles?: readonly MuscleId[];
  },
): Promise<{
  readonly weeks: readonly LocalDate[];
  readonly series: readonly {
    readonly muscle: MuscleId;
    readonly points: readonly MuscleSeriesPoint[];
  }[];
}> {
  const ctx = await insightsContext(deps);
  const from = weekStartOf(input.from, ctx.weekStartsOn);
  const last = weekStartOf(input.to ?? ctx.today, ctx.weekStartsOn);
  await ensureInsights(deps, { from, to: weekEnd(last) });
  const records = await deps.uow.read(['dWeekly'], (repos) =>
    repos.insights.weeks(from, weekEnd(last)),
  );
  const weeks: LocalDate[] = [];
  for (let week = from; week <= last; week = addDays(week, 7)) weeks.push(week);
  const byWeek = new Map(records.map((record) => [record.weekStart, record]));
  const muscles = input.muscles ?? deps.content.muscles().groups.map((group) => group.id);
  return {
    weeks,
    series: muscles.map((muscle) => ({ muscle, points: muscleSeries(muscle, weeks, byWeek) })),
  };
}
