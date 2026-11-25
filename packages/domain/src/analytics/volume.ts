/**
 * Weekly volume per muscle against its target (ANL-03) and the body-map heat map (MAP-04, MAP-07
 * data): rows per display group of the PRD §7.2 taxonomy, keyed by the content's muscle IDs
 * (`mu.*`), with the body-map region of each view (`front.chest`, `back.side-delts`), the
 * sub-regions for the drill-down, the exercises that contributed, the planned remainder of the
 * week (MAP-04's outlined overlay) and the heat step the body map colours by.
 *
 * Target band [INF, PLN-03, MAP-04]: from the plan's weekly target T of the muscle to the top of
 * the evidence default band (10–20 fractional sets, `volume.hypertrophy.weeklyBands`), or to T when
 * T is higher; without a plan target, the default band itself. Heat steps: 0 nothing logged,
 * 1 below the floor (< 4), 2 below the target band, 3 in it, 4 high (up to 30), 5 very high.
 */
import { explain, type Explanation } from '../explain';
import type { ExerciseId, LocalDate, MuscleId } from '../ids';
import type { ExerciseDef, MuscleTarget, PlannedSession } from '../model';
import { setsOf } from '../planning/analysis';
import { groupCredits } from '../planning/credits';
import type { RuleSlice } from '../rules';
import { classifyWeeklyVolume, creditTable, parentMuscle, type VolumeBand } from '../volume';
import type { WeeklyMuscle, WeeklyRecord } from './weekly';

/** The body-map views (MAP-01). */
export type BodyView = 'front' | 'back';

/** The display groups and sub-regions as the content's taxonomy describes them (PRD §7.2). */
export interface TaxonomyRegion {
  readonly id: MuscleId;
  /** Body-map region per view where the muscle is visible, e.g. `{ front: 'front.chest' }`. */
  readonly bodyMap: Readonly<Partial<Record<BodyView, string>>>;
}
export interface TaxonomyGroup extends TaxonomyRegion {
  readonly optional: boolean;
  readonly subRegions: readonly TaxonomyRegion[];
}

export const HEAT_STEPS = [
  'none',
  'belowFloor',
  'belowTarget',
  'inTarget',
  'high',
  'veryHigh',
] as const;
export type HeatLabel = (typeof HEAT_STEPS)[number];
/** Index into `HEAT_STEPS`, the `--heat-0…5` token of the body map (§8.11). */
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;

export type TargetStatus = 'under' | 'in' | 'over';

export interface TargetBand {
  readonly low: number;
  readonly high: number;
  /** The plan's weekly target and its source; null without one. */
  readonly sets: number | null;
  readonly source: MuscleTarget['source'] | 'band';
}

export interface VolumeContributor {
  readonly exerciseId: ExerciseId;
  /** Credited hard sets of the exercise. */
  readonly sets: number;
  /** Its credit for this muscle (sub-regions rolled up). */
  readonly credit: number;
  /** sets × credit: what it added to the muscle's fractional sets. */
  readonly fractional: number;
}

export interface SubRegionRow {
  readonly muscle: MuscleId;
  readonly fractional: number;
  readonly direct: number;
  readonly regions: Readonly<Partial<Record<BodyView, string>>>;
  readonly contributors: readonly VolumeContributor[];
}

export interface MuscleWeekRow {
  readonly muscle: MuscleId;
  readonly fractional: number;
  readonly direct: number;
  /** The evidence band of the fractional sets (EXL-05, `classifyWeeklyVolume`). */
  readonly band: VolumeBand;
  readonly heat: HeatStep;
  readonly heatLabel: HeatLabel;
  readonly status: TargetStatus;
  readonly target: TargetBand;
  /** The plan has a target for this muscle (others show against the default band). */
  readonly targeted: boolean;
  /** Fractional and direct sets still planned this week (open sessions from today on). */
  readonly remaining: { readonly fractional: number; readonly direct: number };
  readonly regions: Readonly<Partial<Record<BodyView, string>>>;
  readonly subRegions: readonly SubRegionRow[];
  readonly contributors: readonly VolumeContributor[];
  readonly why: Explanation;
}

export type VolumeRowRules = RuleSlice<'volume.hypertrophy.weeklyBands'>;

export interface VolumeRowsInput {
  /** The week (or the averaged weeks) to show; null: nothing logged. */
  readonly record: Pick<WeeklyRecord, 'muscles' | 'exercises' | 'targets'> | null;
  readonly groups: readonly TaxonomyGroup[];
  readonly exercise: (id: ExerciseId) => ExerciseDef | undefined;
  /** Open planned sessions of the week from today on (MAP-04 planned remainder). */
  readonly openPlanned: readonly Pick<PlannedSession, 'slots'>[];
}

/** One row per display group, in taxonomy order (ANL-03 table, MAP-04 heat map, MAP-06 list). */
export function volumeRows(input: VolumeRowsInput, rules: VolumeRowRules): MuscleWeekRow[] {
  const bands = rules['volume.hypertrophy.weeklyBands'];
  const logged = new Map<MuscleId, WeeklyMuscle>(
    (input.record?.muscles ?? []).map((entry) => [entry.muscle, entry]),
  );
  const targets = new Map(
    (input.record?.targets?.muscles ?? []).map((target) => [target.muscle, target]),
  );
  const remaining = plannedRemainder(input.openPlanned, input.exercise);
  const contributorsOf = contributorTable(input.record?.exercises ?? [], input.exercise);
  return input.groups.map((group) => {
    const entry = logged.get(group.id);
    const fractional = entry?.fractional ?? 0;
    const direct = entry?.direct ?? 0;
    const plan = targets.get(group.id);
    const target = targetBand(plan, bands.value);
    const heat = heatStep(fractional, target, bands.value);
    const status: TargetStatus =
      fractional < target.low - 1e-9 ? 'under' : fractional > target.high + 1e-9 ? 'over' : 'in';
    return {
      muscle: group.id,
      fractional,
      direct,
      band: classifyWeeklyVolume(fractional, rules).value,
      heat,
      heatLabel: HEAT_STEPS[heat],
      status,
      target,
      targeted: plan !== undefined,
      remaining: remaining.get(group.id) ?? { fractional: 0, direct: 0 },
      regions: group.bodyMap,
      subRegions: group.subRegions.map((sub) => ({
        muscle: sub.id,
        fractional: logged.get(sub.id)?.fractional ?? 0,
        direct: logged.get(sub.id)?.direct ?? 0,
        regions: sub.bodyMap,
        contributors: contributorsOf(sub.id),
      })),
      contributors: contributorsOf(group.id),
      why: explain('volume.target', {
        args: {
          muscle: group.id,
          sets: fractional,
          direct,
          low: target.low,
          high: target.high,
          target: target.sets,
          source: target.source,
          status,
          heat: HEAT_STEPS[heat],
        },
        params: [bands],
      }),
    };
  });
}

function targetBand(
  plan: MuscleTarget | undefined,
  bands: VolumeRowRules['volume.hypertrophy.weeklyBands']['value'],
): TargetBand {
  if (!plan) {
    return { low: bands.defaultLow, high: bands.defaultHigh, sets: null, source: 'band' };
  }
  return {
    low: plan.sets,
    high: Math.max(bands.defaultHigh, plan.sets),
    sets: plan.sets,
    source: plan.source,
  };
}

/** MAP-04 heat step of a muscle's fractional sets against its target band. */
export function heatStep(
  fractional: number,
  target: Pick<TargetBand, 'low' | 'high'>,
  bands: VolumeRowRules['volume.hypertrophy.weeklyBands']['value'],
): HeatStep {
  if (fractional <= 0) return 0;
  if (fractional < target.low - 1e-9) return fractional < bands.floor ? 1 : 2;
  if (fractional <= target.high + 1e-9) return 3;
  if (fractional <= Math.max(bands.highHigh, target.high) + 1e-9) return 4;
  return 5;
}

/** Fractional and direct sets of the open planned sessions per display group (PLN-09 counting). */
export function plannedRemainder(
  planned: readonly Pick<PlannedSession, 'slots'>[],
  exercise: (id: ExerciseId) => ExerciseDef | undefined,
): ReadonlyMap<MuscleId, { fractional: number; direct: number }> {
  const totals = new Map<MuscleId, { fractional: number; direct: number }>();
  for (const session of planned) {
    for (const slot of session.slots) {
      const def = exercise(slot.exerciseId);
      if (!def) continue;
      const sets = setsOf(slot.prescription);
      for (const [muscle, credit] of groupCredits(def)) {
        const total = totals.get(muscle) ?? { fractional: 0, direct: 0 };
        total.fractional += sets * credit;
        if (credit === 1) total.direct += sets;
        totals.set(muscle, total);
      }
    }
  }
  return totals;
}

/** Contributors per muscle: each exercise's credited sets × its credit (sub-regions rolled up). */
function contributorTable(
  exercises: WeeklyRecord['exercises'],
  lookup: (id: ExerciseId) => ExerciseDef | undefined,
): (muscle: MuscleId) => VolumeContributor[] {
  const tables = new Map<ExerciseId, ReadonlyMap<MuscleId, number>>();
  for (const entry of exercises) {
    const def = lookup(entry.exerciseId);
    if (def) tables.set(entry.exerciseId, creditTable(def.muscles));
  }
  return (muscle) =>
    exercises
      .flatMap((entry) => {
        const credit = tables.get(entry.exerciseId)?.get(muscle) ?? 0;
        return credit > 0 && entry.sets > 0
          ? [
              {
                exerciseId: entry.exerciseId,
                sets: entry.sets,
                credit,
                fractional: entry.sets * credit,
              },
            ]
          : [];
      })
      .toSorted(
        (a, b) =>
          b.fractional - a.fractional ||
          (a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : 0),
      );
}

/**
 * MAP-04 "4-week average" (and any multi-week view): the mean of the weeks' muscle and exercise
 * sets; weeks without a record count as zero. The targets are the latest week's.
 */
export function averageWeeks(
  records: readonly (Pick<WeeklyRecord, 'muscles' | 'exercises' | 'targets'> | null)[],
): Pick<WeeklyRecord, 'muscles' | 'exercises' | 'targets'> {
  const count = Math.max(1, records.length);
  const muscles = new Map<MuscleId, { fractional: number; direct: number }>();
  const exercises = new Map<ExerciseId, { sets: number; workingSets: number; volumeKg: number }>();
  for (const record of records) {
    for (const entry of record?.muscles ?? []) {
      const total = muscles.get(entry.muscle) ?? { fractional: 0, direct: 0 };
      total.fractional += entry.fractional / count;
      total.direct += entry.direct / count;
      muscles.set(entry.muscle, total);
    }
    for (const entry of record?.exercises ?? []) {
      const total = exercises.get(entry.exerciseId) ?? { sets: 0, workingSets: 0, volumeKg: 0 };
      total.sets += entry.sets / count;
      total.workingSets += entry.workingSets / count;
      total.volumeKg += entry.volumeKg / count;
      exercises.set(entry.exerciseId, total);
    }
  }
  const latestTargets = records.findLast((record) => record?.targets)?.targets ?? null;
  return {
    muscles: [...muscles]
      .map(([muscle, entry]) => ({ muscle, ...entry }))
      .toSorted((a, b) => (a.muscle < b.muscle ? -1 : a.muscle > b.muscle ? 1 : 0)),
    exercises: [...exercises]
      .map(([exerciseId, entry]) => ({ exerciseId, ...entry }))
      .toSorted((a, b) => (a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : 0)),
    targets: latestTargets,
  };
}

/** ANL-03 chart: one muscle's fractional and direct sets per week over a range. */
export interface MuscleSeriesPoint {
  readonly weekStart: LocalDate;
  readonly fractional: number;
  readonly direct: number;
  readonly target: number | null;
}

export function muscleSeries(
  muscle: MuscleId,
  weeks: readonly LocalDate[],
  records: ReadonlyMap<LocalDate, Pick<WeeklyRecord, 'muscles' | 'targets'>>,
): MuscleSeriesPoint[] {
  const group = parentMuscle(muscle) === muscle;
  return weeks.map((weekStart) => {
    const record = records.get(weekStart);
    const entry = record?.muscles.find((row) => row.muscle === muscle);
    const target = group
      ? (record?.targets?.muscles.find((row) => row.muscle === muscle)?.sets ?? null)
      : null;
    return {
      weekStart,
      fractional: entry?.fractional ?? 0,
      direct: entry?.direct ?? 0,
      target,
    };
  });
}
