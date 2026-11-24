/**
 * PR detection (MOT-01, TD-27; EB §Load › Real change). Checked when a set is confirmed and
 * recomputed from the logs whenever they change (WKT-15):
 * - rep PR: more load than ever lifted for at least that many reps (the rep-max table,
 *   ANL-04: the n-rep max is the heaviest load of any set with ≥ n reps);
 * - load PR: the heaviest external load ever for the exercise;
 * - e1RM PR: only from sets with entered effort that the e1RM pipeline weighs at least
 *   `load.pr.minSetWeight` (PRG-01 tiers; sets without effort never qualify, E-1);
 * - volume PR: the best single-session volume load, once per session (the set that crosses it);
 * - first time: the first exposure of an exercise is a milestone, not a PR, and sets no PRs.
 * Warm-ups, timed sets, assisted sets (negative load) and band exercises are excluded. PRs are
 * per exercise, never across variants.
 */
import { effectiveReps, estimateSetE1rm, rpeFromRir, setWeight, type E1rmRules } from '../e1rm';
import { explain, type Explanation } from '../explain';
import type { ExerciseId, LocalDate, SessionId, SetId } from '../ids';
import type { ExerciseDef, LoggedSet } from '../model';
import type { RuleSlice } from '../rules';
import { toKg } from '../units';

export const PR_TYPES = ['rep', 'load', 'e1rm', 'volume'] as const;
export type PrType = (typeof PR_TYPES)[number];

/** A detected PR (derived; table `dPrs`). */
export interface PrRecord {
  /** `<setId>.<type>`: one PR of a type per set. */
  readonly id: string;
  readonly type: PrType;
  readonly exerciseId: ExerciseId;
  readonly sessionId: SessionId;
  readonly setId: SetId;
  readonly localDate: LocalDate;
  /** Reps of the set (rep and load PRs); null for e1RM and volume PRs. */
  readonly reps: number | null;
  /** The new best: load, e1RM or session volume load, in kg. */
  readonly valueKg: number;
  /** The best it beat; null when the rep count was never reached before. */
  readonly previousKg: number | null;
}

/** The best load lifted for exactly `reps` reps. */
export interface RepBest {
  readonly reps: number;
  readonly loadKg: number;
}

export interface ExerciseBests {
  readonly loadKg: number | null;
  readonly e1rmKg: number | null;
  readonly volumeKg: number | null;
  /** Sorted by reps. */
  readonly reps: readonly RepBest[];
}

export const EMPTY_BESTS: ExerciseBests = { loadKg: null, e1rmKg: null, volumeKg: null, reps: [] };

export type PrRules = E1rmRules & RuleSlice<'load.pr.minSetWeight'>;

/** Floating-point slack: equal loads entered in lb and kg never count as a PR. */
const EPSILON_KG = 1e-6;

/** The external load and reps a PR check reads, or null when the set cannot set a PR. */
export function prCandidate(
  set: Pick<LoggedSet, 'state' | 'type' | 'load' | 'reps'>,
  exercise: Pick<ExerciseDef, 'load'>,
): { readonly loadKg: number; readonly reps: number } | null {
  if (set.state !== 'done' || set.type === 'warmup' || set.type === 'timed') return null;
  if (set.reps === null || set.reps < 1) return null;
  const type = exercise.load.type;
  if (type === 'band' || type === 'timed' || type === 'bodyweightAssisted') return null;
  const loadKg = set.load ? toKg(set.load) : type === 'bodyweightAdded' ? 0 : null;
  if (loadKg === null || loadKg < 0) return null;
  return { loadKg, reps: set.reps };
}

/** The n-rep max: the heaviest load of any set with at least `reps` reps (null: none yet). */
export function repMax(bests: readonly RepBest[], reps: number): number | null {
  let best: number | null = null;
  for (const entry of bests) {
    if (entry.reps >= reps && (best === null || entry.loadKg > best)) best = entry.loadKg;
  }
  return best;
}

function withRepBest(bests: readonly RepBest[], reps: number, loadKg: number): RepBest[] {
  const current = bests.find((entry) => entry.reps === reps);
  if (current && current.loadKg >= loadKg) return [...bests];
  return [...bests.filter((entry) => entry.reps !== reps), { reps, loadKg }].toSorted(
    (a, b) => a.reps - b.reps,
  );
}

export interface ExposurePrsInput {
  readonly bests: ExerciseBests;
  /** No earlier exposure: a milestone, no PRs. */
  readonly firstExposure: boolean;
  /** This exercise's sets of one session, in order. */
  readonly sets: readonly LoggedSet[];
  readonly exercise: Pick<ExerciseDef, 'load'>;
  readonly rules: PrRules;
  /** Bodyweight on the set's day (bodyweight-loaded exercises). */
  readonly bodyweightKg: number | null;
}

export interface ExposurePrs {
  readonly prs: readonly PrRecord[];
  /** Bests after the exposure. */
  readonly bests: ExerciseBests;
  /** The session's volume load (kg × reps of the working sets); null without one. */
  readonly volumeKg: number | null;
  /** The first-time milestone: the exposure's first PR-eligible set. */
  readonly firstTimeSetId: SetId | null;
}

/**
 * The PRs of one exposure, set by set against the bests before it (earlier sets of the same
 * session count, so a second heavier set is a PR again). The volume PR compares with earlier
 * sessions only and fires once, on the set that crosses the previous best.
 */
export function exposurePrs(input: ExposurePrsInput): ExposurePrs {
  const { exercise, rules } = input;
  const minWeight = rules['load.pr.minSetWeight'].value;
  const priorVolume = input.bests.volumeKg;
  let bests: ExerciseBests = input.bests;
  let volumeKg: number | null = null;
  let volumeFired = false;
  let firstTimeSetId: SetId | null = null;
  const prs: PrRecord[] = [];
  for (const set of input.sets) {
    const candidate = prCandidate(set, exercise);
    if (!candidate) continue;
    if (firstTimeSetId === null) firstTimeSetId = set.id;
    const record = (
      type: PrType,
      valueKg: number,
      previousKg: number | null,
      reps: number | null,
    ) =>
      prs.push({
        id: `${set.id}.${type}`,
        type,
        exerciseId: set.exerciseId,
        sessionId: set.sessionId,
        setId: set.id,
        localDate: set.localDate,
        reps,
        valueKg,
        previousKg,
      });

    // Rep and load PRs from the actual load × reps (unaffected by effort, E-1).
    const rm = repMax(bests.reps, candidate.reps);
    if (!input.firstExposure && (rm === null || candidate.loadKg > rm + EPSILON_KG)) {
      record('rep', candidate.loadKg, rm, candidate.reps);
    }
    if (
      !input.firstExposure &&
      candidate.loadKg > 0 &&
      (bests.loadKg === null || candidate.loadKg > bests.loadKg + EPSILON_KG)
    ) {
      record('load', candidate.loadKg, bests.loadKg, candidate.reps);
    }

    // e1RM PR: entered effort and a trusted set only.
    let e1rmKg = bests.e1rmKg;
    const estimate = estimateSetE1rm(
      set,
      exercise.load,
      { setOrder: 0, bodyweightKg: input.bodyweightKg },
      rules,
    ).value;
    if (estimate?.prEligible) {
      const baseWeight = setWeight(
        rpeFromRir(estimate.rir),
        effectiveReps(estimate.reps, estimate.rir, rules),
        rules,
      );
      if (baseWeight >= minWeight) {
        if (
          !input.firstExposure &&
          (bests.e1rmKg === null || estimate.e1rmKg > bests.e1rmKg + EPSILON_KG)
        ) {
          record('e1rm', estimate.e1rmKg, bests.e1rmKg, null);
        }
        e1rmKg = Math.max(e1rmKg ?? 0, estimate.e1rmKg);
      }
    }

    // Volume load of the session so far.
    const volumeLoadKg = exercise.load.bodyweightLoaded
      ? input.bodyweightKg === null
        ? null
        : input.bodyweightKg + candidate.loadKg
      : candidate.loadKg;
    if (volumeLoadKg !== null && volumeLoadKg > 0) {
      volumeKg = (volumeKg ?? 0) + volumeLoadKg * candidate.reps;
      if (
        !input.firstExposure &&
        !volumeFired &&
        (priorVolume === null || volumeKg > priorVolume + EPSILON_KG)
      ) {
        volumeFired = true;
        record('volume', volumeKg, priorVolume, null);
      }
    }

    bests = {
      loadKg: candidate.loadKg > 0 ? Math.max(bests.loadKg ?? 0, candidate.loadKg) : bests.loadKg,
      e1rmKg,
      volumeKg: bests.volumeKg,
      reps: withRepBest(bests.reps, candidate.reps, candidate.loadKg),
    };
  }
  // The volume PR's value is the session's final volume load.
  const final = volumeKg;
  const settled = prs.map((pr) =>
    pr.type === 'volume' && final !== null ? { ...pr, valueKg: final } : pr,
  );
  return {
    prs: settled,
    bests: {
      ...bests,
      volumeKg:
        final !== null && (priorVolume === null || final > priorVolume) ? final : priorVolume,
    },
    volumeKg: final,
    firstTimeSetId: input.firstExposure ? firstTimeSetId : null,
  };
}

/** The "Why?" of a PR (MOT-01: e1RM PRs are labelled estimates). */
const mass = (kg: number | null) =>
  kg === null ? null : { mass: { value: kg, unit: 'kg' as const } };

export function explainPr(record: PrRecord, rules?: PrRules): Explanation {
  return explain(`pr.${record.type}`, {
    args: {
      exerciseId: record.exerciseId,
      reps: record.reps,
      value: mass(record.valueKg),
      previous: mass(record.previousKg),
    },
    params:
      record.type === 'e1rm' && rules
        ? [rules['load.pr.minSetWeight'], rules['load.unknownEffort.eligibleForE1rmPr']]
        : [],
  });
}

/** The first-time milestone's "Why?". */
export function explainFirstTime(exerciseId: ExerciseId): Explanation {
  return explain('pr.firstTime', { args: { exerciseId } });
}
