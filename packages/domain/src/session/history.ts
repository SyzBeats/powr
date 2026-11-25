/**
 * The derived state of one exercise (technical concept §5.6 `dExerciseState`, §8.7.5): a fold of
 * its exposures (one per session, oldest first) over an empty or baseline-seeded start. It holds
 * what the session engine reads instead of scanning raw sets (§8.7.8): the strength and all-sets
 * trend states, the last exposure (double progression, manual mode, "last time"), the linear
 * progression outcomes, the calibration progress (PRG-08), the PR bests (MOT-01) and the entered
 * RIR history for the unknown-effort prior (E-1). Everything is recomputable from the raw logs and
 * the versions (§4, NFR-REL-03); `key` fingerprints the inputs, so a stale state is rebuilt.
 */
import {
  baselineE1rm,
  effectiveReps,
  estimateSetE1rm,
  personalPriorRir,
  rpeFromRir,
  sessionE1rm,
  setWeight,
  type EffortHistoryEntry,
  type SetE1rm,
} from '../e1rm';
import type { ExerciseId, LocalDate, SessionId, SetId } from '../ids';
import type { Baseline, ExerciseDef, LoggedSet, SetType } from '../model';
import type { RuleSet, TraineeLevel } from '../rules';
import { daysBetween } from '../time';
import {
  isStrengthSet,
  labelChange,
  median,
  repRangeShift,
  trendObservation,
  trendStep,
  type ChangeLabel,
  type TrendPoint,
} from '../trend';
import { toKg, type Mass } from '../units';
import { EMPTY_BESTS, exposurePrs, type ExerciseBests, type PrRecord } from './prs';

/** A performed set as later sessions read it. */
export interface PerformedSetSummary {
  readonly type: SetType;
  readonly load: Mass | null;
  readonly reps: number | null;
  /** Entered RIR, else null. */
  readonly rir: number | null;
  readonly effortKnown: boolean;
  readonly state: 'done' | 'skipped';
  readonly durationMs?: number;
}

/** The last exposure: "last time" (WKT-02), double progression (PRG-04), manual mode (PRG-03). */
export interface ExposureSummary {
  readonly sessionId: SessionId;
  readonly localDate: LocalDate;
  /** Working sets (warm-ups excluded), in order, skipped ones included. */
  readonly sets: readonly PerformedSetSummary[];
  /** WKT-10: the exercise's note in that session. */
  readonly note?: string;
  /** Linear progression (PRG-06): every planned working set reached its target reps. */
  readonly prescribedRepsMet: boolean | null;
}

/**
 * One recent exposure (M4a): what the PRG-07 pace check (TD-44) and the rep-range artefact flag
 * (PRG-02, TD-26) read without scanning raw sets.
 */
export interface RecentExposure {
  readonly localDate: LocalDate;
  /** Session e1RM from all sets and its weight; null when the exposure gave none. */
  readonly e1rmKg: number | null;
  readonly weight: number | null;
  /** The heaviest external load of a working set, kg. */
  readonly topLoadKg: number | null;
  /** Median reps of the working sets. */
  readonly medianReps: number | null;
}

export interface ExerciseState {
  readonly exerciseId: ExerciseId;
  /** Fingerprint of the inputs (versions, overrides, level, baseline, bodyweight). */
  readonly key: string;
  /** Sessions with at least one done working set. */
  readonly exposures: number;
  readonly firstDate: LocalDate | null;
  readonly lastDate: LocalDate | null;
  /** PRG-08: exposures with entered effort, and whether one of them had a reliable set. */
  readonly calibration: { readonly entered: number; readonly reliable: boolean };
  /** ONB-08: the starting e1RM from a baseline (seeds the trend). */
  readonly baseline: {
    readonly e1rmKg: number;
    readonly localDate: LocalDate;
    readonly old: boolean;
  } | null;
  /** Trend states (PRG-02): strength sets only, and all sets. */
  readonly strength: TrendPoint | null;
  readonly all: TrendPoint | null;
  /**
   * Recent strength trend points, oldest first (change labels need a reference 4–12 weeks or 3
   * sessions back, `load.trend.reference`; at most MAX_POINTS).
   */
  readonly points: readonly TrendPoint[];
  readonly last: ExposureSummary | null;
  /** PRG-06: prescribed reps met per exposure, oldest first (the last few). */
  readonly linear: readonly boolean[];
  readonly bests: ExerciseBests;
  /** E-1: entered RIR of recent working sets, for the personal prior. */
  readonly effort: readonly EffortHistoryEntry[];
  /**
   * M4a: the last exposures (at most MAX_RECENT), oldest first (absent in states an M3 build
   * stored).
   */
  readonly recent?: readonly RecentExposure[];
}

/**
 * PRG-02 at one session (M4a): the strength trend's change label after it, and whether it
 * coincides with a rep-range shift (TD-26, "possibly a rep-range effect").
 */
export interface PointChange {
  readonly label: ChangeLabel['label'];
  readonly direction: ChangeLabel['direction'];
  readonly deltaPct: number;
  readonly referenceDate: LocalDate | null;
  readonly repRange: boolean;
}

/** One point per exercise per session (table `dSessionE1rm`, the chart source of ANL-02). */
export interface SessionE1rmPoint {
  readonly exerciseId: ExerciseId;
  readonly sessionId: SessionId;
  readonly localDate: LocalDate;
  /** Raw session e1RM (all sets) and its weight. */
  readonly e1rmKg: number | null;
  readonly weight: number | null;
  /** Smoothed strength and all-sets trend after the session, with the 95% bands. */
  readonly strength: TrendBand | null;
  readonly all: TrendBand | null;
  /** M4a: the strength trend's change label at this session; null without a strength point. */
  readonly change?: PointChange | null;
}

export interface TrendBand {
  readonly e1rmKg: number;
  readonly lowKg: number;
  readonly highKg: number;
}

/** One exercise's sets of one session. */
export interface Exposure {
  readonly sessionId: SessionId;
  readonly localDate: LocalDate;
  /** In order (performedAt, then index). */
  readonly sets: readonly LoggedSet[];
  readonly note?: string;
}

export interface FoldInput {
  readonly exercise: ExerciseDef;
  readonly rules: RuleSet;
  readonly level: TraineeLevel;
  /** Bodyweight trend value on a day (bodyweight-loaded exercises). */
  readonly bodyweightAt: (date: LocalDate) => number | null;
}

/**
 * How many strength-trend points and recent exposures the state keeps (TD-60, M5). The change
 * label needs a point `load.trend.reference` weeks back (12 for advanced lifters) that is not one
 * of the kept series' first `sessions` (3) points, and the rep-range flag the exposures on or
 * before that date: 12 weeks × 4 sessions a week + 4 = 52, so both keep 60 (before: 30 points
 * and 12 exposures, which an 8-week window outgrew at 3.4 sessions a week).
 */
const MAX_POINTS = 60;
const MAX_LINEAR = 6;
const MAX_EFFORT = 200;
const MAX_RECENT = 60;

export function emptyExerciseState(exerciseId: ExerciseId, key: string): ExerciseState {
  return {
    exerciseId,
    key,
    exposures: 0,
    firstDate: null,
    lastDate: null,
    calibration: { entered: 0, reliable: false },
    baseline: null,
    strength: null,
    all: null,
    points: [],
    last: null,
    linear: [],
    bests: EMPTY_BESTS,
    effort: [],
    recent: [],
  };
}

/**
 * Seeds the trend with an onboarding baseline (ONB-08, M2c open item): the baseline's e1RM is the
 * first observation, dated when it was lifted (or `fallbackDate`), with its own weight and noise,
 * so logged sessions refine it like any other observation.
 */
export function seedFromBaseline(
  state: ExerciseState,
  baseline: Baseline,
  dates: { readonly today: LocalDate; readonly fallback: LocalDate },
  input: FoldInput,
): ExerciseState {
  const estimate = baselineE1rm(baseline, input.exercise.load, dates.today, input.rules).value;
  if (!estimate) return state;
  const localDate = baseline.date ?? dates.fallback;
  const observation = trendObservation(
    estimate,
    localDate,
    { level: input.level, weeksOfData: 0 },
    input.rules,
  );
  const all = trendStep(null, observation, input.level, input.rules);
  const strength = isStrengthSet(estimate, input.rules) ? all : null;
  return {
    ...state,
    baseline: { e1rmKg: estimate.e1rmKg, localDate, old: estimate.old },
    all,
    strength,
    points: strength ? [strength] : [],
  };
}

export interface FoldResult {
  readonly state: ExerciseState;
  readonly point: SessionE1rmPoint | null;
  readonly prs: readonly PrRecord[];
  /** The first-time milestone (MOT-01) when this was the first exposure. */
  readonly firstTimeSetId: SetId | null;
}

/** The e1RM estimates of an exposure's working sets (set order, personal prior RIR, E-1). */
function exposureEstimates(state: ExerciseState, exposure: Exposure, input: FoldInput): SetE1rm[] {
  const bodyweightKg = input.bodyweightAt(exposure.localDate);
  const estimates: SetE1rm[] = [];
  let order = 0;
  for (const set of exposure.sets) {
    if (set.state !== 'done' || set.type === 'warmup') continue;
    const priorRir =
      set.reps === null
        ? null
        : personalPriorRir(state.effort, { reps: set.reps, asOf: exposure.localDate }, input.rules);
    const estimate = estimateSetE1rm(
      set,
      input.exercise.load,
      { setOrder: order, bodyweightKg, priorRir },
      input.rules,
    ).value;
    order++;
    if (estimate) estimates.push(estimate);
  }
  return estimates;
}

/** Folds one exposure into the state: trend steps, PRs, calibration, last exposure. */
export function foldExposure(
  state: ExerciseState,
  exposure: Exposure,
  input: FoldInput,
): FoldResult {
  const { rules } = input;
  const working = exposure.sets.filter((set) => set.type !== 'warmup');
  if (!working.some((set) => set.state === 'done')) {
    return { state, point: null, prs: [], firstTimeSetId: null };
  }
  const date = exposure.localDate;
  const prs = exposurePrs({
    bests: state.bests,
    firstExposure: state.exposures === 0,
    sets: exposure.sets,
    exercise: input.exercise,
    rules,
    bodyweightKg: input.bodyweightAt(date),
  });

  const estimates = exposureEstimates(state, exposure, input);
  const firstDate = state.firstDate ?? date;
  const weeksOfData = Math.max(0, daysBetween(firstDate, date)) / 7;
  const context = { level: input.level, weeksOfData };
  const all = sessionE1rm(estimates).value;
  const strong = sessionE1rm(estimates.filter((estimate) => isStrengthSet(estimate, rules))).value;
  const allPoint = all
    ? trendStep(state.all, trendObservation(all, date, context, rules), input.level, rules)
    : state.all;
  const strengthPoint = strong
    ? trendStep(state.strength, trendObservation(strong, date, context, rules), input.level, rules)
    : state.strength;

  const entered = estimates.filter((estimate) => estimate.effortKnown);
  const reliableWeight = rules['progression.calibration.reliableSetWeight'].value;
  const reliable = entered.some(
    (estimate) =>
      setWeight(
        rpeFromRir(estimate.rir),
        effectiveReps(estimate.reps, estimate.rir, rules),
        rules,
      ) >= reliableWeight,
  );

  const windowDays = rules['load.unknownEffort.personalPrior'].value.windowWeeks * 7;
  const effort = [
    ...state.effort,
    ...working.flatMap((set) =>
      set.state === 'done' &&
      set.effort.source === 'entered' &&
      set.effort.rir !== null &&
      set.reps !== null
        ? [{ localDate: date, reps: set.reps, rir: set.effort.rir }]
        : [],
    ),
  ]
    .filter((entry) => daysBetween(entry.localDate, date) <= windowDays)
    .slice(-MAX_EFFORT);

  const met = prescribedRepsMet(working);
  const recent = [
    ...(state.recent ?? []),
    recentExposure(date, working, all?.e1rmKg ?? null, all?.weight ?? null),
  ].slice(-MAX_RECENT);
  const points =
    strong && strengthPoint ? [...state.points, strengthPoint].slice(-MAX_POINTS) : state.points;
  const change = strong && strengthPoint ? pointChange(points, recent, input) : null;
  const next: ExerciseState = {
    ...state,
    exposures: state.exposures + 1,
    firstDate,
    lastDate: state.lastDate === null || date > state.lastDate ? date : state.lastDate,
    calibration: {
      entered: state.calibration.entered + (entered.length > 0 ? 1 : 0),
      reliable: state.calibration.reliable || reliable,
    },
    all: allPoint,
    strength: strengthPoint,
    points,
    last: {
      sessionId: exposure.sessionId,
      localDate: date,
      sets: working.map(summarize),
      ...(exposure.note ? { note: exposure.note } : {}),
      prescribedRepsMet: met,
    },
    linear: met === null ? state.linear : [...state.linear, met].slice(-MAX_LINEAR),
    bests: prs.bests,
    effort,
    recent,
  };
  return {
    state: next,
    point: {
      exerciseId: state.exerciseId,
      sessionId: exposure.sessionId,
      localDate: date,
      e1rmKg: all?.e1rmKg ?? null,
      weight: all?.weight ?? null,
      strength: strong ? band(strengthPoint) : null,
      all: all ? band(allPoint) : null,
      change,
    },
    prs: prs.prs,
    firstTimeSetId: prs.firstTimeSetId,
  };
}

/** The exposure's summary for `ExerciseState.recent`. */
function recentExposure(
  localDate: LocalDate,
  working: readonly LoggedSet[],
  e1rmKg: number | null,
  weight: number | null,
): RecentExposure {
  const done = working.filter((set) => set.state === 'done' && set.type !== 'timed');
  const reps = done.flatMap((set) => (set.reps === null ? [] : [set.reps]));
  const loads = done.flatMap((set) => (set.load === null ? [] : [toKg(set.load)]));
  return {
    localDate,
    e1rmKg,
    weight,
    topLoadKg: loads.length > 0 ? Math.max(...loads) : null,
    medianReps: median(reps),
  };
}

/** The strength trend's label after this session, with the rep-range check (PRG-02, TD-26). */
function pointChange(
  points: readonly TrendPoint[],
  recent: readonly RecentExposure[],
  input: FoldInput,
): PointChange {
  const label = labelChange(points, input.level, input.rules).value;
  const real = label.label === 'likely' || label.label === 'veryLikely';
  return {
    label: label.label,
    direction: label.direction,
    deltaPct: label.deltaPct,
    referenceDate: label.referenceDate,
    repRange: real && repRangeShift(recent, label.referenceDate, input.rules).value.shifted,
  };
}

function band(point: TrendPoint | null): TrendBand | null {
  return point ? { e1rmKg: point.e1rmKg, lowKg: point.lowKg, highKg: point.highKg } : null;
}

function summarize(set: LoggedSet): PerformedSetSummary {
  const effortKnown = set.effort.source === 'entered' && set.effort.rir !== null;
  return {
    type: set.type,
    load: set.load,
    reps: set.reps,
    rir: effortKnown ? set.effort.rir : null,
    effortKnown,
    state: set.state,
    ...(set.durationMs === undefined ? {} : { durationMs: set.durationMs }),
  };
}

/** PRG-06 "prescribed reps achieved": null when no set carries its prescription. */
function prescribedRepsMet(working: readonly LoggedSet[]): boolean | null {
  const judged = working.filter((set) => set.prescription?.reps != null || set.state === 'skipped');
  if (!judged.some((set) => set.prescription?.reps != null)) return null;
  return judged.every(
    (set) => set.state === 'done' && set.reps !== null && set.reps >= (set.prescription?.reps ?? 0),
  );
}

export interface RebuildResult {
  readonly state: ExerciseState;
  readonly points: readonly SessionE1rmPoint[];
  readonly prs: readonly PrRecord[];
}

/** The full rebuild of one exercise from its exposures (§6.9 recompute; incremental ≡ full). */
export function rebuildExerciseState(
  start: ExerciseState,
  exposures: readonly Exposure[],
  input: FoldInput,
): RebuildResult {
  let state = start;
  const points: SessionE1rmPoint[] = [];
  const prs: PrRecord[] = [];
  for (const exposure of exposures) {
    const folded = foldExposure(state, exposure, input);
    state = folded.state;
    if (folded.point) points.push(folded.point);
    prs.push(...folded.prs);
  }
  return { state, points, prs };
}

/** The current e1RM the engine loads from: the strength trend, else the all-sets trend. */
export function currentE1rm(state: ExerciseState | null): number | null {
  return state?.strength?.e1rmKg ?? state?.all?.e1rmKg ?? null;
}

export type CalibrationStatus = 'uncalibrated' | 'calibrating' | 'calibrated';

/**
 * PRG-08 (TD-27): uncalibrated → calibrating (first 1–2 exposures at RIR 3–4) → calibrated. A
 * baseline (ONB-08) skips calibration. One exposure with entered effort calibrates when it had a
 * reliable set (`progression.calibration.reliableSetWeight`), otherwise the second does; without
 * entered effort, `exposures.max` exposures with an e1RM do.
 */
export function calibrationStatus(
  state: ExerciseState | null,
  rules: Pick<RuleSet, 'progression.calibration'>,
): CalibrationStatus {
  if (!state) return 'uncalibrated';
  if (state.baseline) return 'calibrated';
  const { exposures } = rules['progression.calibration'].value;
  const { entered, reliable } = state.calibration;
  if (entered >= exposures.max || (entered >= exposures.min && reliable)) return 'calibrated';
  if (state.all !== null && state.exposures >= exposures.max) return 'calibrated';
  return state.all === null ? 'uncalibrated' : 'calibrating';
}

/** Groups an exercise's sets into exposures (sessions in `order`), each in set order. */
export function exposuresOf(
  sets: readonly LoggedSet[],
  sessions: readonly {
    readonly id: SessionId;
    readonly localDate: LocalDate;
    readonly note?: string | undefined;
  }[],
): Exposure[] {
  const bySession = new Map<SessionId, LoggedSet[]>();
  for (const set of sets)
    bySession.set(set.sessionId, [...(bySession.get(set.sessionId) ?? []), set]);
  return sessions.flatMap((session) => {
    const own = bySession.get(session.id);
    if (!own) return [];
    return [
      {
        sessionId: session.id,
        localDate: session.localDate,
        sets: sortSets(own),
        ...(session.note ? { note: session.note } : {}),
      },
    ];
  });
}

/** Session order: performedAt, then the per-exercise index (§8.1, NFR-REL-05). */
export function sortSets<T extends Pick<LoggedSet, 'performedAt' | 'index' | 'id'>>(
  sets: readonly T[],
): T[] {
  return sets.toSorted(
    (a, b) =>
      a.performedAt.epochMs - b.performedAt.epochMs ||
      a.index - b.index ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * The fingerprint of everything a derived state depends on besides the raw sets (FNV-1a over
 * the parts' JSON): engine, rules and content versions, the user's overrides, the level, the
 * baseline and a bodyweight digest. A mismatch marks the stored state stale (§8.2.8).
 */
export function derivationKey(parts: Readonly<Record<string, unknown>>): string {
  const text = canonical(parts);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** JSON with object keys sorted at every depth. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .toSorted()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(',')}}`;
}
