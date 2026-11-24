import { SLOT_PRIORITIES } from '@powr/domain';
import {
  E1RM_EQUATIONS,
  CURVE_SOURCES,
  KEEP_FULL_SOURCES,
  PROGRESSION_MODELS,
  SCORE_FORMULAS,
  type ParamId,
  type ParamValues,
} from '@powr/domain/rules';

import { z } from './zod';

/**
 * One value schema per parameter ID (technical concept §8.6.1: "a Zod schema per parameter ID
 * gives types and ranges"). The registry is a closed set: the build rejects rows whose ID has no
 * schema here and reports schema IDs without a row. The `satisfies` clause ties every schema to
 * the value type the engine reads (`ParamValues` in @powr/domain), so data and code cannot drift.
 */

const num = z.number();
const nonNegative = z.number().min(0);
const positive = z.number().positive();
const fraction = z.number().min(0).max(1);
const percent = z.number().min(0).max(100);
const rir = z.number().min(0).max(10);
const seconds = z.number().int().min(0).max(1800);

const range = (inner: z.ZodNumber = num) =>
  z
    .strictObject({ min: inner, max: inner })
    .refine((r) => r.min <= r.max, 'min must not exceed max');

const byLevel = <T extends z.ZodType>(inner: T) =>
  z.strictObject({ novice: inner, intermediate: inner, advanced: inner });

const bySex = <T extends z.ZodType>(inner: T) => z.strictObject({ male: inner, female: inner });

const byDivisionEvent = <T extends z.ZodType>(inner: T) =>
  z.strictObject({
    classic: z.strictObject({ total: inner, bench: inner }),
    equipped: z.strictObject({ total: inner, bench: inner }),
  });

/** Nuzzo-style tables: %1RM falls as reps rise. */
const repsAtPctTable = z
  .array(z.strictObject({ pct: z.number().gt(0).max(100), reps: positive }))
  .min(2)
  .refine(
    (rows) =>
      rows.every(
        (row, i) => i === 0 || (row.pct < rows[i - 1]!.pct && row.reps > rows[i - 1]!.reps),
      ),
    'rows must be ordered by falling %1RM and rising reps',
  );

const pctAtReffTable = z
  .array(z.strictObject({ reff: z.number().min(1), pct: z.number().gt(0).max(100) }))
  .min(2)
  .refine(
    (rows) =>
      rows.every(
        (row, i) => i === 0 || (row.reff > rows[i - 1]!.reff && row.pct < rows[i - 1]!.pct),
      ),
    'rows must be ordered by rising r_eff and falling %1RM',
  );

const volumeTiers = z.array(
  z.strictObject({
    minSets: nonNegative,
    maxSets: nonNegative.nullable(),
    tier: z.string().min(1),
    extraSetsPerDetectableGain: positive.nullable(),
  }),
);

const warmupStep = z.strictObject({ pct: percent, reps: z.number().int().min(1) });
const warmupRamp = z.strictObject({
  barReps: z.number().int().min(1).nullable(),
  steps: z.array(warmupStep).min(1),
  optional: z.array(warmupStep),
});

const techniqueCredit = z
  .strictObject({ base: nonNegative, perUnit: nonNegative, cap: positive })
  .refine((credit) => credit.base <= credit.cap, 'base must not exceed cap');

const polynomial = z.array(num).min(2);
const ipfPoints = z.strictObject({ c1: num, c2: num, c3: num, c4: num });
const ipfGl = z.strictObject({ a: num, b: num, c: num });

const returnFromBreakRow = z.strictObject({
  maxDays: z.number().int().positive().nullable(),
  action: z.enum(['resume', 'reduce', 'reentry', 'recalibrate']),
  loadPct: range(percent).nullable(),
  setsPct: range(percent).nullable(),
  rirAdd: nonNegative,
  rampWeeks: range(positive).nullable(),
});

type ParamSchemas = { readonly [K in ParamId]: z.ZodType<ParamValues[K]> };

export const PARAM_SCHEMAS = {
  // load.yaml
  'load.e1rm.equation': z.enum(E1RM_EQUATIONS),
  'load.curve.classMap': z.strictObject({
    equation: z.enum(CURVE_SOURCES),
    legPressLike: z.enum(CURVE_SOURCES),
    pooled: z.enum(CURVE_SOURCES),
  }),
  'load.curve.nuzzoPooled': repsAtPctTable,
  'load.curve.nuzzoBench': repsAtPctTable,
  'load.curve.nuzzoLegPress': repsAtPctTable,
  'load.curve.rts': pctAtReffTable,
  'load.e1rm.weightByRpe': z
    .array(z.strictObject({ minRpe: z.number().min(0).max(10), weight: fraction }))
    .min(1),
  'load.e1rm.weightByReff': z.array(z.strictObject({ maxReff: positive, weight: fraction })).min(1),
  'load.e1rm.setOrderDecay': fraction,
  'load.rirBias': z.array(z.strictObject({ minRir: rir, add: z.number().min(0).max(3) })).min(1),
  'load.unknownEffort.priorRirDefault': rir,
  'load.unknownEffort.priorRirSd': nonNegative,
  'load.unknownEffort.weightMultiplier': fraction,
  'load.unknownEffort.personalPrior': z.strictObject({
    windowWeeks: positive,
    repTolerance: nonNegative,
  }),
  'load.unknownEffort.eligibleForE1rmPr': z.boolean(),
  'load.baseline.refineAfterDays': z.number().int().positive(),
  'load.trend.noiseHeavySd': z.number().positive().max(0.5),
  'load.trend.noiseTypicalSd': z.number().positive().max(0.5),
  'load.trend.heavySet': z.strictObject({ maxReff: positive, minRpe: z.number().min(0).max(10) }),
  'load.trend.strengthMaxReff': positive,
  'load.trend.processSdPerWeek': byLevel(z.number().positive().max(0.5)),
  'load.trend.noviceWidening': z.strictObject({ weeks: nonNegative, factor: z.number().min(1) }),
  'load.trend.typicalErrorCv': byLevel(z.number().positive().max(0.5)),
  'load.trend.changeThresholds': z.strictObject({
    likelyTe: positive,
    sustainSessions: z.number().int().min(1),
    veryLikelyTe: positive,
  }),
  'load.trend.reference': z.strictObject({ weeks: positive, sessions: z.number().int().min(1) }),
  'load.pr.minSetWeight': fraction,
  'load.reanchor.trigger': z.strictObject({
    maxReps: z.number().int().min(1),
    minRpe: z.number().min(0).max(10),
  }),
  // volume.yaml
  'volume.hypertrophy.weeklyBands': z
    .strictObject({
      floor: nonNegative,
      defaultLow: nonNegative,
      defaultHigh: nonNegative,
      highHigh: nonNegative,
      hardWarnAbove: nonNegative,
    })
    .refine(
      (b) =>
        b.floor <= b.defaultLow &&
        b.defaultLow <= b.defaultHigh &&
        b.defaultHigh <= b.highHigh &&
        b.highHigh <= b.hardWarnAbove,
      'bands must not decrease',
    ),
  'volume.hypertrophy.tiers': volumeTiers,
  'volume.strength.tiers': volumeTiers,
  'volume.puos': z.strictObject({
    hypertrophyFractionalSets: positive,
    strengthFractionalSets: positive,
    strengthSessionsPerWeek: positive,
  }),
  'volume.counting.default': z.enum(['fractional', 'direct']),
  'volume.hardSet.maxRir': rir,
  'volume.hardSet.highReps': z.strictObject({ above: z.number().int().min(1), maxRir: rir }),
  'volume.hardSet.unknownRirCounts': z.boolean(),
  'volume.frequency.hypertrophyPerMuscle': positive,
  'volume.frequency.strengthPerLift': range(positive),
  'volume.hypertrophy.perSessionSoftCap': z.strictObject({
    fractionalSets: positive,
    directSets: positive,
    nudge: range(positive),
  }),
  'volume.strength.perSessionHeavySets': range(positive),
  'volume.strength.weeklyHeavySetsPerLift': range(positive),
  'volume.startingVolume.maxFactor': z.number().min(1),
  'volume.maintenance': z.strictObject({ volumeFraction: fraction, minSessionsPerWeek: positive }),
  'volume.hypertrophy.minimumDose': z.strictObject({ setsPerWeek: positive }),
  'volume.repRange.hypertrophy': z.strictObject({
    compound: range(positive),
    isolation: range(positive),
    allowed: range(positive),
  }),
  'volume.repRange.strength': z.strictObject({
    main: range(positive),
    accessory: range(positive),
    mainMinPct1rm: percent,
  }),
  'volume.load.hypertrophyMinPct1rm': percent,
  'volume.effort.hypertrophyRir': range(rir),
  'volume.effort.strengthRpe': z.strictObject({ work: range(rir), heavySingle: range(rir) }),
  'volume.effort.hypertrophySlopePerRir': num,
  'volume.effort.strengthAccessoryRpe': range(z.number().min(1).max(10)),
  'volume.strength.minimumDosePerLift': range(nonNegative),
  // progression.yaml
  'progression.model.mainLift': byLevel(z.enum(PROGRESSION_MODELS)),
  'progression.model.accessory': z.enum(PROGRESSION_MODELS),
  'progression.double.incrementGuardPct': range(percent),
  'progression.increment.noviceLowerKg': positive,
  'progression.increment.noviceUpperKg': positive,
  'progression.increment.intermediatePctPerWeek': positive,
  'progression.increment.advancedLoadJumpWeeks': range(positive),
  'progression.increment.microplateKgPerSide': range(positive),
  'progression.stall.failedSessions': z.number().int().min(1),
  'progression.stall.resetPct': percent,
  'progression.apre.sixRm': z.strictObject({
    ramp: z.array(z.strictObject({ reps: z.number().int().min(1), pct: percent })).min(1),
    adjustments: z
      .array(
        z.strictObject({
          minReps: z.number().int().min(0),
          maxReps: z.number().int().min(0).nullable(),
          adjustKg: num,
          rangeKg: range(),
        }),
      )
      .min(1),
  }),
  'progression.calibration': z.strictObject({ exposures: range(positive), targetRir: range(rir) }),
  'progression.calibration.reliableSetWeight': fraction,
  'progression.classification.slopePctPerWeek': z.strictObject({
    noviceFrom: num,
    advancedBelow: num,
    minWeeks: positive,
  }),
  'progression.classification.trainingAgeMonths': z.strictObject({
    intermediateFrom: nonNegative,
    advancedFrom: nonNegative,
  }),
  // deload.yaml
  'deload.planned.everyWeeks': positive,
  'deload.planned.durationDays': positive,
  'deload.planned.postpone': z.strictObject({
    weeks: z.number().int().min(1),
    maxPerMesocycle: z.number().int().min(0),
  }),
  'deload.content': z.strictObject({
    setsReductionPct: range(percent),
    rirIncrease: range(rir),
    loadPct: range(percent),
    higherRepLoadReductionPct: range(percent),
    keepExercises: z.boolean(),
    keepFrequency: z.boolean(),
    dropAccessories: z.enum(['optional', 'always', 'never']),
  }),
  'deload.reactive': z.strictObject({
    signalsRequired: z.number().int().min(1),
    declineSessions: z.number().int().min(1),
    lowReadinessDays: z.number().int().min(1),
  }),
  'deload.returnFromBreak': z.array(returnFromBreakRow).min(1),
  'deload.returnFromBreak.sorenessNoteAfterDays': positive,
  // session.yaml
  'session.rest.strength': seconds,
  'session.rest.hypertrophyCompound': seconds,
  'session.rest.hypertrophyIsolation': seconds,
  'session.rest.timeSaver': seconds,
  'session.rest.supersetTransition': seconds,
  'session.rest.warmupLight': seconds,
  'session.rest.warmupBeforeWork': seconds,
  'session.rest.countUpSoftMin': z.strictObject({ compound: seconds, isolation: seconds }),
  'session.rest.competitionMinimum': seconds,
  'session.tempo.default': z.string().regex(/^\d+-\d+-(?:\d+|X)-\d+$/, 'tempo looks like 2-0-X-0'),
  'session.tempo.eccentricSeconds': range(nonNegative),
  'session.tempo.warnRepSeconds': positive,
  'session.duration.repSeconds': positive,
  'session.duration.warmupSetSeconds': seconds,
  'session.duration.transitionSeconds': seconds,
  'session.warmup.heavyTrigger': z.strictObject({
    maxReps: z.number().int().min(1),
    minPctE1rm: percent,
  }),
  'session.warmup.heavy': warmupRamp.extend({
    topUp: warmupStep.extend({ minPctE1rm: percent }),
  }),
  'session.warmup.compound': warmupRamp,
  'session.warmup.isolation': warmupRamp,
  'session.warmup.feeder': warmupRamp,
  'session.warmup.pruning': z.strictObject({
    minStepGapPct: percent,
    repCapFromPct: percent,
    longRestFromPct: percent,
  }),
  'session.techniqueCredit.drop': techniqueCredit,
  'session.techniqueCredit.restPause': techniqueCredit,
  'session.techniqueCredit.myoReps': techniqueCredit,
  'session.techniqueCredit.cluster': techniqueCredit,
  'session.techniqueCredit.lengthenedPartials': techniqueCredit,
  'session.techniqueCredit.partialExtension': techniqueCredit,
  // monitoring.yaml
  'monitoring.readiness.baseline': z.strictObject({
    windowDays: positive,
    minEntries: z.number().int().min(1),
  }),
  'monitoring.readiness.thresholds': z.strictObject({
    lowZ: num,
    modifyZ: num,
    prsLow: z.number().min(0).max(10),
    prsConsecutiveDays: z.number().int().min(1),
  }),
  'monitoring.readiness.adjustments': z.strictObject({
    topSetRirAdd: rir,
    dropBackoffSets: range(nonNegative),
  }),
  'monitoring.readiness.sleep': z.strictObject({
    shortHours: z.number().min(0).max(24),
    consecutiveShortNights: z.number().int().min(1),
  }),
  'monitoring.readiness.pmFromHour': z.number().int().min(0).max(23),
  'monitoring.spacing': z.strictObject({
    nonFailureHours: range(positive),
    failureHours: range(positive),
    unaccustomedDays: range(positive),
    highStressExtraHours: nonNegative,
  }),
  // scoring.yaml
  'scoring.display': z.strictObject({
    primary: z.array(z.enum(SCORE_FORMULAS)).min(1),
    legacy: z.array(z.enum(SCORE_FORMULAS)),
    decimals: z.number().int().min(0).max(6),
  }),
  'scoring.wilks.coefficients': bySex(polynomial),
  'scoring.wilks.bodyweightClampKg': bySex(range(positive)),
  'scoring.wilks2020.coefficients': bySex(polynomial),
  'scoring.wilks2020.bodyweightClampKg': bySex(range(positive)),
  'scoring.dots.coefficients': bySex(polynomial),
  'scoring.dots.bodyweightClampKg': bySex(range(positive)),
  'scoring.ipfPoints.coefficients': bySex(byDivisionEvent(ipfPoints)),
  'scoring.ipfPoints.minBodyweightKg': positive,
  'scoring.ipfGl.coefficients': bySex(byDivisionEvent(ipfGl)),
  'scoring.ipfGl.minBodyweightKg': positive,
  'scoring.allometric.exponent': positive,
  // planning.yaml
  'planning.mesocycle.accumulationWeeks': range(z.number().int().min(1)),
  'planning.novice.maxWorkingExercises': z.number().int().min(1),
  'planning.sessionBudget.tolerancePct': percent,
  'planning.slot.sets': range(z.number().int().min(1)),
  'planning.strength.accessorySets': z.number().int().min(1),
  'planning.volume.startPosition': z.strictObject({
    novice: fraction,
    intermediate: fraction,
    advanced: fraction,
    priority: fraction,
  }),
  'planning.rotation.perMuscle': range(z.number().int().min(0)),
  'planning.variety.pool': z.number().int().min(1),
  'planning.missed.mergePriorities': z.array(z.enum(SLOT_PRIORITIES)).min(1),
  'planning.timeBudget.fallback': z.strictObject({
    keepFull: z
      .array(z.enum(KEEP_FULL_SOURCES))
      .min(1)
      .refine((sources) => new Set(sources).size === sources.length, 'sources are unique'),
    templateSlots: z.array(z.enum(SLOT_PRIORITIES)).min(1),
  }),
  // ranking.yaml
  'ranking.effectiveness': z.strictObject({
    weights: z
      .strictObject({
        credit: fraction,
        evidence: fraction,
        stretch: fraction,
        overload: fraction,
        subRegion: fraction,
      })
      .refine(
        (w) => Math.abs(w.credit + w.evidence + w.stretch + w.overload + w.subRegion - 1) < 1e-9,
        'the weights add up to 1',
      ),
    evidenceScore: z.strictObject({ H: fraction, EMG: fraction, C: fraction }),
  }),
  // bodyweight.yaml
  'bodyweight.trend.alphaPerDay': z.number().gt(0).max(1),
  'bodyweight.trend.initialWeighIns': range(z.number().int().min(1)),
  'bodyweight.trend.winsorizePct': positive,
  'bodyweight.rate.windowDays': range(z.number().int().min(1)),
} satisfies ParamSchemas;

/** Every MVP parameter ID, sorted. */
export const PARAM_IDS: readonly ParamId[] = (Object.keys(PARAM_SCHEMAS) as ParamId[]).toSorted();

export function isParamId(id: string): id is ParamId {
  return Object.hasOwn(PARAM_SCHEMAS, id);
}
