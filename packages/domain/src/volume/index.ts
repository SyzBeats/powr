/**
 * `@powr/domain/volume`: set volume per muscle (EXL-05, WKT-04; EB §Volume, §Session ›
 * Techniques). A working set counts if it is hard (RIR ≤ 4 or unknown; above 20 reps only at
 * RIR ≤ 2); technique sets earn their registry credit (drop +0.5 per drop up to 2.0, …). Each
 * muscle gets fractional sets (Σ set credit × muscle credit) and direct sets (muscle credit 1.0
 * only); sub-regions `mu.<group>.<sub>` roll up to `mu.<group>` with the largest credit the
 * exercise gives the group, so one set never counts twice for the parent. Weekly totals are
 * classified against the hypertrophy bands (floor 4, default 10–20, high 20–30, warnings).
 */
import { explained, quantity, type Explained, type Fact } from '../explain';
import type { ExerciseId, LocalDate, MuscleId } from '../ids';
import type { Effort, MuscleCredit, SetType } from '../model';
import { TECHNIQUE_CREDIT_PARAM, type RuleSlice, type Technique } from '../rules';
import { weekStartOf, type IsoWeekday } from '../time';

export type HardSetRules = RuleSlice<
  'volume.hardSet.maxRir' | 'volume.hardSet.highReps' | 'volume.hardSet.unknownRirCounts'
>;

export type CreditRules = HardSetRules &
  RuleSlice<(typeof TECHNIQUE_CREDIT_PARAM)[keyof typeof TECHNIQUE_CREDIT_PARAM]>;

/** The parts of a logged set volume reads. */
export interface VolumeSet {
  readonly exerciseId: ExerciseId;
  readonly type: SetType;
  readonly state?: 'done' | 'skipped';
  readonly reps: number | null;
  readonly effort: Effort;
  readonly technique?: Technique;
}

export interface MuscleVolume {
  readonly fractional: number;
  readonly direct: number;
}

/** Hard-set rule (EXL-05): working, done, and close enough to failure (or effort unknown). */
export function isHardSet(set: VolumeSet, rules: HardSetRules): boolean {
  if (set.type === 'warmup' || set.state === 'skipped') return false;
  const rir = set.effort.source === 'entered' ? set.effort.rir : null;
  if (rir === null) return rules['volume.hardSet.unknownRirCounts'].value;
  const highReps = rules['volume.hardSet.highReps'].value;
  if (set.reps !== null && set.reps > highReps.above) return rir <= highReps.maxRir;
  return rir <= rules['volume.hardSet.maxRir'].value;
}

/** How many sets one logged set is worth: 0 if not hard, else 1 or its technique credit. */
export function setCredit(set: VolumeSet, rules: CreditRules): Explained<number> {
  const hardParams = [
    rules['volume.hardSet.maxRir'],
    rules['volume.hardSet.highReps'],
    rules['volume.hardSet.unknownRirCounts'],
  ];
  if (!isHardSet(set, rules)) {
    return explained(0, 'volume.notHardSet', {
      args: { type: set.type, rir: set.effort.rir, reps: set.reps },
      params: hardParams,
    });
  }
  if (!set.technique) {
    return explained(1, 'volume.setCredit', { args: { credit: 1 }, params: hardParams });
  }
  const param = rules[TECHNIQUE_CREDIT_PARAM[set.technique.kind]];
  const { base, perUnit, cap } = param.value;
  const units = set.technique.units ?? (set.technique.kind === 'partialExtension' ? 1 : 0);
  const credit = Math.min(cap, base + perUnit * units);
  return explained(credit, 'volume.setCredit', {
    args: { credit, technique: set.technique.kind, units },
    params: [...hardParams, param],
  });
}

/** 'mu.quads.vasti' → 'mu.quads'; a group ID is its own parent. */
export function parentMuscle(muscle: MuscleId): MuscleId {
  const parts = muscle.split('.');
  return (parts.length > 2 ? `${parts[0]}.${parts[1]}` : muscle) as MuscleId;
}

/**
 * The credit an exercise gives each muscle, sub-regions rolled up: a parent gets the largest
 * credit among itself and its sub-regions.
 */
export function creditTable(credits: readonly MuscleCredit[]): ReadonlyMap<MuscleId, number> {
  const table = new Map<MuscleId, number>();
  const raise = (muscle: MuscleId, credit: number) =>
    table.set(muscle, Math.max(table.get(muscle) ?? 0, credit));
  for (const { muscle, credit } of credits) {
    raise(muscle, credit);
    raise(parentMuscle(muscle), credit);
  }
  return table;
}

export type CreditsOf = (exerciseId: ExerciseId) => readonly MuscleCredit[] | undefined;

/**
 * Fractional and direct sets per muscle (sub-regions and groups) for the given sets, e.g.
 * 5 hard sets of curls (biceps 1.0) + 5 of rows (biceps 0.5) → biceps 7.5 fractional, 5 direct.
 */
export function muscleVolume(
  sets: readonly VolumeSet[],
  creditsOf: CreditsOf,
  rules: CreditRules,
): Explained<ReadonlyMap<MuscleId, MuscleVolume>> {
  const totals = new Map<MuscleId, { fractional: number; direct: number }>();
  const tables = new Map<ExerciseId, ReadonlyMap<MuscleId, number>>();
  let counted = 0;
  let unmapped = 0;
  for (const set of sets) {
    const credit = setCredit(set, rules).value;
    if (credit === 0) continue;
    let table = tables.get(set.exerciseId);
    if (!table) {
      const credits = creditsOf(set.exerciseId);
      if (!credits) {
        unmapped++;
        continue;
      }
      table = creditTable(credits);
      tables.set(set.exerciseId, table);
    }
    counted++;
    for (const [muscle, muscleCredit] of table) {
      if (muscleCredit === 0) continue;
      const total = totals.get(muscle) ?? { fractional: 0, direct: 0 };
      total.fractional += credit * muscleCredit;
      if (muscleCredit === 1) total.direct += credit;
      totals.set(muscle, total);
    }
  }
  const sorted = new Map(
    [...totals].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  ) as ReadonlyMap<MuscleId, MuscleVolume>;
  const facts: Fact[] = [quantity('countedSets', counted), quantity('unmappedSets', unmapped)];
  return explained(sorted, 'volume.muscles', {
    args: { counted, unmapped },
    facts,
    params: [
      rules['volume.hardSet.maxRir'],
      rules['volume.hardSet.highReps'],
      rules['volume.hardSet.unknownRirCounts'],
    ],
  });
}

/** Muscle volume per week (key: the week's first day for the user's week start, SET-11). */
export function weeklyMuscleVolume(
  sets: readonly (VolumeSet & { readonly localDate: LocalDate })[],
  creditsOf: CreditsOf,
  weekStartsOn: IsoWeekday,
  rules: CreditRules,
): ReadonlyMap<LocalDate, Explained<ReadonlyMap<MuscleId, MuscleVolume>>> {
  const byWeek = new Map<LocalDate, VolumeSet[]>();
  for (const set of sets) {
    const week = weekStartOf(set.localDate, weekStartsOn);
    byWeek.set(week, [...(byWeek.get(week) ?? []), set]);
  }
  return new Map(
    [...byWeek]
      .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([week, weekSets]) => [week, muscleVolume(weekSets, creditsOf, rules)]),
  );
}

export const VOLUME_BANDS = [
  'belowFloor',
  'low',
  'default',
  'high',
  'softWarning',
  'hardWarning',
] as const;
export type VolumeBand = (typeof VOLUME_BANDS)[number];

/**
 * Weekly fractional sets of one muscle against the hypertrophy bands: below 4 below the floor,
 * 4–<10 low, 10–20 default, >20–30 high, >30–40 soft warning ("no detectable superiority"),
 * above 40 hard warning ("no data"). Preliminary values (E-2).
 */
export function classifyWeeklyVolume(
  fractionalSets: number,
  rules: RuleSlice<'volume.hypertrophy.weeklyBands'>,
): Explained<VolumeBand> {
  const bands = rules['volume.hypertrophy.weeklyBands'].value;
  const band: VolumeBand =
    fractionalSets < bands.floor
      ? 'belowFloor'
      : fractionalSets < bands.defaultLow
        ? 'low'
        : fractionalSets <= bands.defaultHigh
          ? 'default'
          : fractionalSets <= bands.highHigh
            ? 'high'
            : fractionalSets <= bands.hardWarnAbove
              ? 'softWarning'
              : 'hardWarning';
  return explained(band, `volume.band.${band}`, {
    args: { sets: fractionalSets },
    params: [rules['volume.hypertrophy.weeklyBands']],
  });
}

/** The per-session soft cap (~11 fractional or ~8 direct sets per muscle): suggest another day. */
export function checkSessionVolume(
  volume: MuscleVolume,
  rules: RuleSlice<'volume.hypertrophy.perSessionSoftCap'>,
): Explained<boolean> {
  const cap = rules['volume.hypertrophy.perSessionSoftCap'].value;
  const exceeded = volume.fractional > cap.fractionalSets || volume.direct > cap.directSets;
  return explained(exceeded, exceeded ? 'volume.sessionCap.exceeded' : 'volume.sessionCap.within', {
    args: { fractional: volume.fractional, direct: volume.direct },
    params: [rules['volume.hypertrophy.perSessionSoftCap']],
  });
}
