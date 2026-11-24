import type { RuleId } from '@powr/domain/explain';

/*
 * The values each rule's explanation can carry (TD-28): its `args` and the names of its
 * `quantity` facts, from every place the engine produces the rule. A `why.<rule>` message may
 * only interpolate these (checked by messages.test.ts); `format.ts` converts them. Rules with
 * several producers list the union: `deload.week`, `break.return.reduce`/`recalibrate` and
 * `schedule.missed.merge` are also rebuilt from a stored adjustment (`explainAdjustment`), and
 * `plan.mesocycle`, `deload.reactive.propose`, `schedule.moved` and `e1rm.loadForTarget` pass
 * different args per producer or outcome.
 */

const ROUNDING = ['target', 'chosen', 'below', 'above', 'exact', 'reason', 'mixedUnits'];
const SET_E1RM = ['e1rm', 'reff', 'pct', 'weight', 'rir', 'bodyweightKg'];
const TREND_CHANGE = [
  'deltaPct',
  'typicalErrorPct',
  'direction',
  'referenceDate',
  'referenceE1rmKg',
  'currentE1rmKg',
];
const LINEAR_FACTS = ['lastSessionMet', 'missedInARow'];
const WARMUP = ['workingLoad', 'heavy', 'steps', 'workingReps', 'pctE1rm', 'firstForPattern'];
const BAND = ['sets'];
const SESSION_CAP = ['fractional', 'direct'];
const POLYNOMIAL_SCORE = ['value', 'coefficient', 'clamped', 'informal'];
const IPF_SCORE = ['value', 'unsupportedLift'];
const RANKING_FACTOR = ['value', 'weight', 'contribution'];
const TEMPLATE = ['style', 'days', 'level', 'template'];
const SLOT_CHOICE = ['exercise', 'slot', 'pattern', 'rank', 'candidates', 'variety'];
const MUSCLE_VOLUME = ['muscle', 'sets', 'target'];
const STRENGTH_DOSE = ['lift', 'heavySets', 'min', 'max'];
/** A stored session adjustment rebuilt for the sheet (`explainAdjustment`). */
const ADJUSTMENT = ['loadMin', 'loadMax', 'setsMin', 'setsMax', 'rirAdd', 'daysOff', 'notes'];
const RETURN = ['daysOff', 'action', 'weeks'];

export const WHY_VALUES: { readonly [K in RuleId]: readonly string[] } = {
  'loading.round': ROUNDING,
  'e1rm.set': SET_E1RM,
  'e1rm.set.unknownEffort': SET_E1RM,
  'e1rm.set.excluded': ['reason'],
  'e1rm.baseline': ['kind', 'e1rm', 'old', 'ageDays'],
  'e1rm.baseline.none': ['exposuresMin', 'exposuresMax', 'rirMin', 'rirMax'],
  'e1rm.session': ['e1rm', 'weight', 'candidates'],
  'e1rm.loadForTarget': [
    'reff',
    'pct',
    'total',
    'load',
    'e1rmKg',
    'targetReps',
    'targetRir',
    'bodyweightKg',
  ],
  'trend.series': ['level', 'observations'],
  'trend.change.insufficientData': [],
  'trend.change.none': TREND_CHANGE,
  'trend.change.likely': TREND_CHANGE,
  'trend.change.veryLikely': TREND_CHANGE,
  'progression.double.topReached': ['from', 'to', 'reps', 'atMaxLoad', 'targetRir'],
  'progression.double.repsUp': ['load', 'reps', 'top', 'targetRir'],
  'progression.double.noHistory': [],
  'progression.rpe.load': ['reps', 'rir', 'load'],
  'progression.rpe.backoff': ['reason', 'todayE1rm', 'reps', 'rir', 'topSetRir'],
  'progression.apre.session': ['sixRm'],
  'progression.apre.adjust': ['amrapReps', 'adjustKg', 'from', 'to'],
  'progression.linear.increase': ['increment', 'level', 'from', 'to', ...LINEAR_FACTS],
  'progression.linear.retry': ['load', ...LINEAR_FACTS],
  'progression.linear.stallReset': ['resetPct', 'failedSessions', 'from', 'to', ...LINEAR_FACTS],
  'progression.linear.advancedHold': LINEAR_FACTS,
  'progression.percent.load': ['pct', 'base'],
  'progression.level.trainingAge': ['trainingAgeMonths'],
  'progression.level.slope': ['slopePctPerWeek', 'weeksOfData'],
  'warmup.heavy': WARMUP,
  'warmup.compound': WARMUP,
  'warmup.isolation': WARMUP,
  'warmup.feeder': WARMUP,
  'warmup.none': WARMUP,
  'rest.default': ['seconds', 'restClass', 'timeSaver'],
  'volume.setCredit': ['credit', 'technique', 'units'],
  'volume.notHardSet': ['type', 'rir', 'reps'],
  'volume.muscles': ['counted', 'unmapped', 'countedSets', 'unmappedSets'],
  'volume.band.belowFloor': BAND,
  'volume.band.low': BAND,
  'volume.band.default': BAND,
  'volume.band.high': BAND,
  'volume.band.softWarning': BAND,
  'volume.band.hardWarning': BAND,
  'volume.sessionCap.within': SESSION_CAP,
  'volume.sessionCap.exceeded': SESSION_CAP,
  'scoring.wilks': POLYNOMIAL_SCORE,
  'scoring.wilks2020': POLYNOMIAL_SCORE,
  'scoring.dots': POLYNOMIAL_SCORE,
  'scoring.ipfPoints': IPF_SCORE,
  'scoring.ipfGl': IPF_SCORE,
  'scoring.allometric': ['value', 'exponent'],
  'bodyweight.trend': ['trend', 'days', 'winsorized'],
  'bodyweight.rate': ['kgPerWeek', 'pctPerWeek', 'spanDays'],
  'bodyweight.rate.insufficientData': ['spanDays', 'readings'],
  'equipment.availability': ['exercise', 'available', 'missing'],
  'ranking.effectiveness': ['exercise', 'muscle', 'score', 'evidence'],
  'ranking.factor.credit': RANKING_FACTOR,
  'ranking.factor.evidence': RANKING_FACTOR,
  'ranking.factor.stretch': RANKING_FACTOR,
  'ranking.factor.overload': RANKING_FACTOR,
  'ranking.factor.subRegion': RANKING_FACTOR,
  'plan.template.default': [...TEMPLATE, 'split'],
  'plan.template.chosen': [...TEMPLATE, 'split'],
  'plan.template.none': [...TEMPLATE, 'reason'],
  'plan.template.levelMismatch': [...TEMPLATE, 'levels'],
  // No producer yet (the level is explained by progression.level.*); assumed to carry the level.
  'plan.level': ['level'],
  'plan.lift.unavailable': ['lift', 'slot', 'avoided'],
  'plan.slot.exercise': SLOT_CHOICE,
  'plan.slot.preferred': SLOT_CHOICE,
  'plan.slot.substituted': SLOT_CHOICE,
  'plan.slot.dropped': ['dayKey', 'slot', 'reason'],
  'plan.slot.rotated': ['slot', 'from', 'to', 'reason'],
  'plan.slot.kept': ['slot', 'exercise', 'locked'],
  'plan.volume.target': ['muscle', 'sets', 'source', 'level', 'recent', 'full'],
  'plan.volume.liftTarget': ['lift', 'heavySets', 'level'],
  'plan.volume.sets': ['added', 'deficit'],
  'plan.volume.budget': ['lowered', 'minutes', 'emphasis'],
  'plan.prescription': ['slot', 'mode', 'reps', 'rir', 'fromTemplate'],
  'plan.duration': ['dayKey', 'minutes'],
  'plan.time.trimmed': ['dayKey', 'slot', 'budget', 'action', 'sets', 'deficit'],
  'plan.schedule.weekdays': ['weekdays', 'order', 'conflicts'],
  // New plan (generatePlan): the first five; next mesocycle (proposeNextMesocycle): the last three.
  'plan.mesocycle': [
    'accumulationWeeks',
    'deloadWeeks',
    'valid',
    'defaultWeeks',
    'chosen',
    'index',
    'rotations',
    'level',
  ],
  'plan.next.volume': ['muscle', 'planned', 'logged', 'next'],
  'validate.equipment.unavailable': ['exercise'],
  'validate.avoided': ['exercise'],
  'validate.volume.belowFloor': MUSCLE_VOLUME,
  'validate.volume.low': MUSCLE_VOLUME,
  'validate.volume.high': MUSCLE_VOLUME,
  'validate.volume.veryHigh': MUSCLE_VOLUME,
  'validate.volume.targetOutsideBand': MUSCLE_VOLUME,
  'validate.volume.timeBudget': [...MUSCLE_VOLUME, 'full'],
  'validate.frequency.muscle': ['muscle', 'sessions', 'required'],
  'validate.frequency.lift': ['lift', 'sessions', 'min', 'max'],
  'validate.sessionCap.muscle': ['muscle', 'fractional', 'direct'],
  'validate.sessionCap.lift': ['lift', 'sets', 'max'],
  'validate.strength.belowMinimum': STRENGTH_DOSE,
  'validate.strength.weeklyLow': STRENGTH_DOSE,
  'validate.strength.weeklyHigh': STRENGTH_DOSE,
  'validate.lift.missing': ['lift'],
  'validate.time.overBudget': ['minutes', 'budget', 'limit'],
  'validate.spacing': ['subject', 'fromDay', 'toDay', 'gapHours', 'requiredHours'],
  'validate.order.lift': ['lift', 'before'],
  // No args when the deload week is missing; these when the block length is out of range.
  'validate.deload.missing': ['accumulationWeeks', 'min', 'max'],
  'validate.prescription.reps': ['exercise', 'goal'],
  'validate.prescription.effort': ['exercise', 'tooEasy', 'failureOnCompound', 'liftFailure'],
  'validate.novice.exercises': ['exercises', 'max'],
  'validate.coverage': ['muscle', 'rule', 'part'],
  'deload.week': ['keepSharePct', ...ADJUSTMENT],
  // reactiveDeload: signals, declining, required; bringDeloadForward: week, removed.
  'deload.reactive.propose': ['signals', 'declining', 'required', 'week', 'removed'],
  'deload.reactive.none': ['signals', 'declining', 'required'],
  'deload.postponed': ['allowed', 'weeks'],
  'deload.skipped': ['sessions'],
  'break.return.resume': RETURN,
  'break.return.reduce': [...RETURN, ...ADJUSTMENT],
  'break.return.reentry': RETURN,
  'break.return.recalibrate': [...RETURN, ...ADJUSTMENT],
  'schedule.missed.doToday': ['session', 'from', 'to', 'shifted'],
  'schedule.missed.skip': ['session', 'date'],
  'schedule.missed.merge': ['session', 'target', 'merged', 'dropped', ...ADJUSTMENT],
  'schedule.moved': ['session', 'from', 'to', 'swappedWith'],
};
