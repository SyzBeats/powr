import { explained, quantity, type Explained } from '../explain';
import { effectiveLoadKg } from '../loading';
import type { Effort, LoadModel, SetType } from '../model';
import type { RuleSlice } from '../rules';
import type { Mass } from '../units';
import { curveParams, curvePct, type CurveRules } from './curves';
import { effectiveReps, rpeFromRir, setWeight, type BiasRules, type WeightRules } from './effort';

/**
 * e1RM from one logged set (PRG-01, technical concept §8.7.4) and the session e1RM. Sets logged
 * without effort follow E-1: they use the personal or default prior RIR at half weight, carry
 * extra measurement noise for the trend and never create e1RM PRs.
 */

export type E1rmRules = CurveRules &
  BiasRules &
  WeightRules &
  RuleSlice<
    | 'load.e1rm.setOrderDecay'
    | 'load.unknownEffort.priorRirDefault'
    | 'load.unknownEffort.priorRirSd'
    | 'load.unknownEffort.weightMultiplier'
    | 'load.unknownEffort.eligibleForE1rmPr'
  >;

/** The parts of a logged set the estimate reads; `LoggedSet` satisfies it. */
export interface E1rmSetInput {
  readonly type: SetType;
  readonly state?: 'done' | 'skipped';
  readonly load: Mass | null;
  readonly reps: number | null;
  readonly effort: Effort;
}

export type E1rmExercise = Pick<LoadModel, 'type' | 'curveClass' | 'bodyweightLoaded'>;

export interface SetE1rmOptions {
  /** 0 for the first working set of the exercise in the session, 1 for the next… */
  readonly setOrder?: number;
  /** Bodyweight trend at the set's date (bodyweight-loaded exercises). */
  readonly bodyweightKg?: number | null;
  /** Personal prior RIR (E-1, `personalPriorRir`); the registry default otherwise. */
  readonly priorRir?: number | null;
}

export interface SetE1rm {
  readonly e1rmKg: number;
  /** The load the estimate divides: external load, or bodyweight + external load. */
  readonly loadKg: number;
  readonly reps: number;
  /** Entered RIR, or the prior used for a set without effort. */
  readonly rir: number;
  readonly reff: number;
  readonly pct: number;
  readonly weight: number;
  readonly effortKnown: boolean;
  /** Extra log-scale noise from the effort prior (E-1); 0 for entered effort. */
  readonly effortLogSd: number;
  readonly prEligible: boolean;
}

export const E1RM_EXCLUSIONS = [
  'skipped',
  'warmup',
  'timedSet',
  'loadType',
  'pureBodyweight',
  'missingValues',
  'noBodyweight',
  'nonPositiveLoad',
  'undefinedCurve',
  'tooManyReps',
] as const;
export type E1rmExclusion = (typeof E1RM_EXCLUSIONS)[number];

export function estimateSetE1rm(
  set: E1rmSetInput,
  exercise: E1rmExercise,
  options: SetE1rmOptions,
  rules: E1rmRules,
): Explained<SetE1rm | null> {
  if (set.state === 'skipped') return exclusion('skipped');
  if (set.type === 'warmup') return exclusion('warmup');
  if (set.type === 'timed') return exclusion('timedSet');
  if (exercise.type === 'band' || exercise.type === 'timed') return exclusion('loadType');
  const bodyweightType =
    exercise.type === 'bodyweightAdded' || exercise.type === 'bodyweightAssisted';
  if (bodyweightType && !exercise.bodyweightLoaded) return exclusion('pureBodyweight');
  if (set.reps === null || set.reps < 1 || (set.load === null && !exercise.bodyweightLoaded)) {
    return exclusion('missingValues');
  }
  const loadKg = effectiveLoadKg(set.load, exercise, options.bodyweightKg ?? null);
  if (loadKg === null) return exclusion('noBodyweight');
  if (loadKg <= 0) return exclusion('nonPositiveLoad');

  const effortKnown = set.effort.source === 'entered' && set.effort.rir !== null;
  const rir = effortKnown
    ? (set.effort.rir ?? 0)
    : (options.priorRir ?? rules['load.unknownEffort.priorRirDefault'].value);
  const reff = effectiveReps(set.reps, rir, rules);
  const pct = curvePct(exercise.curveClass, reff, rules);
  const nextPct = curvePct(exercise.curveClass, reff + 1, rules);
  if (pct === null || pct <= 0) return exclusion('undefinedCurve');

  const decay = rules['load.e1rm.setOrderDecay'].value ** (options.setOrder ?? 0);
  const unknownFactor = effortKnown ? 1 : rules['load.unknownEffort.weightMultiplier'].value;
  const weight = setWeight(rpeFromRir(rir), reff, rules) * decay * unknownFactor;
  if (weight <= 0) return exclusion('tooManyReps');

  // One rep of RIR uncertainty moves the estimate by ln(pct(r) / pct(r + 1)), about 3%.
  const logSlope = nextPct !== null && nextPct > 0 ? Math.log(pct / nextPct) : 0;
  const effortLogSd = effortKnown ? 0 : rules['load.unknownEffort.priorRirSd'].value * logSlope;
  const value: SetE1rm = {
    e1rmKg: loadKg / pct,
    loadKg,
    reps: set.reps,
    rir,
    reff,
    pct,
    weight,
    effortKnown,
    effortLogSd,
    prEligible: effortKnown || rules['load.unknownEffort.eligibleForE1rmPr'].value,
  };

  return explained(value, effortKnown ? 'e1rm.set' : 'e1rm.set.unknownEffort', {
    args: {
      e1rm: { mass: { value: value.e1rmKg, unit: 'kg' } },
      reff,
      pct,
      weight,
      rir,
    },
    facts: [
      {
        kind: 'set',
        index: options.setOrder ?? 0,
        load: set.load,
        reps: set.reps,
        rir: effortKnown ? rir : null,
        effortKnown,
      },
      ...(exercise.bodyweightLoaded
        ? [quantity('bodyweightKg', options.bodyweightKg ?? null)]
        : []),
    ],
    params: [
      ...curveParams(exercise.curveClass, rules),
      rules['load.rirBias'],
      rules['load.e1rm.weightByRpe'],
      rules['load.e1rm.weightByReff'],
      rules['load.e1rm.setOrderDecay'],
      ...(effortKnown
        ? []
        : [
            rules['load.unknownEffort.priorRirDefault'],
            rules['load.unknownEffort.priorRirSd'],
            rules['load.unknownEffort.weightMultiplier'],
            rules['load.unknownEffort.eligibleForE1rmPr'],
          ]),
    ],
  });
}

function exclusion(reason: E1rmExclusion): Explained<null> {
  return explained(null, 'e1rm.set.excluded', { args: { reason } });
}

/**
 * The session e1RM of an exercise (§8.7.4): the candidate with the largest weight × e1RM,
 * reported with its weight; ties go to the earlier set.
 */
export function sessionE1rm(estimates: readonly SetE1rm[]): Explained<SetE1rm | null> {
  let best: SetE1rm | null = null;
  for (const estimate of estimates) {
    if (best === null || estimate.weight * estimate.e1rmKg > best.weight * best.e1rmKg) {
      best = estimate;
    }
  }
  return explained(best, 'e1rm.session', {
    args: {
      e1rm: best ? { mass: { value: best.e1rmKg, unit: 'kg' } } : null,
      weight: best?.weight ?? null,
      candidates: estimates.length,
    },
  });
}
