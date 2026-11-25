import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import type { ParamId } from '@powr/domain/rules';

/**
 * The registry's parameter labels in words (TD-33): `ParamDef.label` is `params.<id>`, so each
 * label is a message with that explicit ID, in the lazy `params` catalog (lingui.config.ts). The
 * "Why?" sheet and "How POWR decides" show them once the catalog is loaded, else the ID in words.
 * The type makes the list complete: a new registry parameter needs its label here.
 */
export const PARAM_LABELS = {
  'bodyweight.rate.bulk': msg({
    id: 'params.bodyweight.rate.bulk',
    message: 'Weekly gain while building',
  }),
  'bodyweight.rate.cut': msg({
    id: 'params.bodyweight.rate.cut',
    message: 'Weekly loss while cutting',
  }),
  'bodyweight.rate.maintain': msg({
    id: 'params.bodyweight.rate.maintain',
    message: 'Weekly change counted as maintaining',
  }),
  'bodyweight.rate.windowDays': msg({
    id: 'params.bodyweight.rate.windowDays',
    message: 'Days the weekly rate is worked out over',
  }),
  'bodyweight.trend.alphaPerDay': msg({
    id: 'params.bodyweight.trend.alphaPerDay',
    message: 'Smoothing of the body-weight trend',
  }),
  'bodyweight.trend.initialWeighIns': msg({
    id: 'params.bodyweight.trend.initialWeighIns',
    message: 'Weigh-ins that start the trend',
  }),
  'bodyweight.trend.winsorizePct': msg({
    id: 'params.bodyweight.trend.winsorizePct',
    message: 'Limit for unusual weigh-ins',
  }),
  'deload.content': msg({ id: 'params.deload.content', message: 'What changes in a lighter week' }),
  'deload.planned.durationDays': msg({
    id: 'params.deload.planned.durationDays',
    message: 'Length of a lighter week',
  }),
  'deload.planned.everyWeeks': msg({
    id: 'params.deload.planned.everyWeeks',
    message: 'How often a lighter week comes',
  }),
  'deload.planned.postpone': msg({
    id: 'params.deload.planned.postpone',
    message: 'Postponing a lighter week',
  }),
  'deload.reactive': msg({
    id: 'params.deload.reactive',
    message: 'Signals for an earlier lighter week',
  }),
  'deload.returnFromBreak': msg({
    id: 'params.deload.returnFromBreak',
    message: 'Easing back in after a break',
  }),
  'deload.returnFromBreak.sorenessNoteAfterDays': msg({
    id: 'params.deload.returnFromBreak.sorenessNoteAfterDays',
    message: 'Break length that brings extra soreness',
  }),
  'load.baseline.refineAfterDays': msg({
    id: 'params.load.baseline.refineAfterDays',
    message: 'Age of a 1-rep max that gets refined',
  }),
  'load.curve.classMap': msg({
    id: 'params.load.curve.classMap',
    message: 'Reps-to-weight table per kind of exercise',
  }),
  'load.curve.nuzzoBench': msg({
    id: 'params.load.curve.nuzzoBench',
    message: 'Reps at a share of the 1-rep max (bench press)',
  }),
  'load.curve.nuzzoLegPress': msg({
    id: 'params.load.curve.nuzzoLegPress',
    message: 'Reps at a share of the 1-rep max (leg press)',
  }),
  'load.curve.nuzzoPooled': msg({
    id: 'params.load.curve.nuzzoPooled',
    message: 'Reps at a share of the 1-rep max (all exercises)',
  }),
  'load.curve.rts': msg({
    id: 'params.load.curve.rts',
    message: 'Effort chart for weight, reps and RPE',
  }),
  'load.e1rm.equation': msg({
    id: 'params.load.e1rm.equation',
    message: 'Formula for the estimated 1-rep max',
  }),
  'load.e1rm.setOrderDecay': msg({
    id: 'params.load.e1rm.setOrderDecay',
    message: 'Weight of later sets in the estimate',
  }),
  'load.e1rm.weightByReff': msg({
    id: 'params.load.e1rm.weightByReff',
    message: 'Weight of a set by its reps',
  }),
  'load.e1rm.weightByRpe': msg({
    id: 'params.load.e1rm.weightByRpe',
    message: 'Weight of a set by its effort',
  }),
  'load.pr.minSetWeight': msg({
    id: 'params.load.pr.minSetWeight',
    message: 'Sets that can set a 1-rep max record',
  }),
  'load.reanchor.trigger': msg({
    id: 'params.load.reanchor.trigger',
    message: 'Hard sets that re-check the estimate',
  }),
  'load.rirBias': msg({
    id: 'params.load.rirBias',
    message: 'Correction for misjudged reps in reserve',
  }),
  'load.trend.changeThresholds': msg({
    id: 'params.load.trend.changeThresholds',
    message: 'When a strength change counts as real',
  }),
  'load.trend.heavySet': msg({
    id: 'params.load.trend.heavySet',
    message: 'What counts as a heavy set for the trend',
  }),
  'load.trend.noiseHeavySd': msg({
    id: 'params.load.trend.noiseHeavySd',
    message: 'Day-to-day variation of heavy sets',
  }),
  'load.trend.noiseTypicalSd': msg({
    id: 'params.load.trend.noiseTypicalSd',
    message: 'Day-to-day variation of typical sets',
  }),
  'load.trend.noviceWidening': msg({
    id: 'params.load.trend.noviceWidening',
    message: 'Wider ranges in the first weeks',
  }),
  'load.trend.processSdPerWeek': msg({
    id: 'params.load.trend.processSdPerWeek',
    message: 'Expected weekly change in strength',
  }),
  'load.trend.reference': msg({
    id: 'params.load.trend.reference',
    message: 'Point a change is measured from',
  }),
  'load.trend.repRangeShift': msg({
    id: 'params.load.trend.repRangeShift',
    message: 'Rep change that flags a jump',
  }),
  'load.trend.strengthMaxReff': msg({
    id: 'params.load.trend.strengthMaxReff',
    message: 'Reps that count for the strength trend',
  }),
  'load.trend.typicalErrorCv': msg({
    id: 'params.load.trend.typicalErrorCv',
    message: 'Typical measurement error of a 1-rep max',
  }),
  'load.unknownEffort.eligibleForE1rmPr': msg({
    id: 'params.load.unknownEffort.eligibleForE1rmPr',
    message: 'Records from sets without an effort rating',
  }),
  'load.unknownEffort.personalPrior': msg({
    id: 'params.load.unknownEffort.personalPrior',
    message: 'Your usual effort, for sets without a rating',
  }),
  'load.unknownEffort.priorRirDefault': msg({
    id: 'params.load.unknownEffort.priorRirDefault',
    message: 'Assumed reps in reserve without a rating',
  }),
  'load.unknownEffort.priorRirSd': msg({
    id: 'params.load.unknownEffort.priorRirSd',
    message: 'Uncertainty of an assumed effort',
  }),
  'load.unknownEffort.weightMultiplier': msg({
    id: 'params.load.unknownEffort.weightMultiplier',
    message: 'Weight of sets without an effort rating',
  }),
  'monitoring.readiness.adjustments': msg({
    id: 'params.monitoring.readiness.adjustments',
    message: 'Changes offered on a low-readiness day',
  }),
  'monitoring.readiness.baseline': msg({
    id: 'params.monitoring.readiness.baseline',
    message: 'Check-ins your usual level is based on',
  }),
  'monitoring.readiness.pmFromHour': msg({
    id: 'params.monitoring.readiness.pmFromHour',
    message: 'Hour from which a session counts as afternoon',
  }),
  'monitoring.readiness.sleep': msg({
    id: 'params.monitoring.readiness.sleep',
    message: 'Short sleep before a session',
  }),
  'monitoring.readiness.thresholds': msg({
    id: 'params.monitoring.readiness.thresholds',
    message: 'When readiness counts as low',
  }),
  'monitoring.spacing': msg({
    id: 'params.monitoring.spacing',
    message: 'Rest between hard sessions',
  }),
  'motivation.streak.defaultWeeklyTarget': msg({
    id: 'params.motivation.streak.defaultWeeklyTarget',
    message: 'Weekly sessions for a streak without a plan',
  }),
  'motivation.streak.graceSessions': msg({
    id: 'params.motivation.streak.graceSessions',
    message: 'Sessions a week may be short (grace)',
  }),
  'motivation.streak.partialMinShare': msg({
    id: 'params.motivation.streak.partialMinShare',
    message: 'Share of sets for a partial session to count',
  }),
  'motivation.streak.retroactiveBreakWeeks': msg({
    id: 'params.motivation.streak.retroactiveBreakWeeks',
    message: 'Weeks back a break can be marked',
  }),
  'planning.mesocycle.accumulationWeeks': msg({
    id: 'params.planning.mesocycle.accumulationWeeks',
    message: 'Training weeks before the lighter week',
  }),
  'planning.missed.mergePriorities': msg({
    id: 'params.planning.missed.mergePriorities',
    message: 'What moves when sessions are merged',
  }),
  'planning.novice.maxWorkingExercises': msg({
    id: 'params.planning.novice.maxWorkingExercises',
    message: 'Exercises per session for beginners',
  }),
  'planning.rotation.perMuscle': msg({
    id: 'params.planning.rotation.perMuscle',
    message: 'Exercises swapped per muscle between blocks',
  }),
  'planning.sessionBudget.tolerancePct': msg({
    id: 'params.planning.sessionBudget.tolerancePct',
    message: 'Allowed overrun of your session time',
  }),
  'planning.slot.sets': msg({ id: 'params.planning.slot.sets', message: 'Sets per exercise' }),
  'planning.strength.accessorySets': msg({
    id: 'params.planning.strength.accessorySets',
    message: 'Sets of assistance work for strength',
  }),
  'planning.timeBudget.fallback': msg({
    id: 'params.planning.timeBudget.fallback',
    message: 'Muscles that keep their sets when time is short',
  }),
  'planning.variety.pool': msg({
    id: 'params.planning.variety.pool',
    message: 'Exercises to choose from in variety mode',
  }),
  'planning.volume.startPosition': msg({
    id: 'params.planning.volume.startPosition',
    message: 'Where in the range weekly sets start',
  }),
  'progression.apre.sixRm': msg({
    id: 'params.progression.apre.sixRm',
    message: 'Adjustment table for sets of six',
  }),
  'progression.calibration': msg({
    id: 'params.progression.calibration',
    message: 'First sessions with a new exercise',
  }),
  'progression.calibration.reliableSetWeight': msg({
    id: 'params.progression.calibration.reliableSetWeight',
    message: 'Sets reliable enough to end calibration',
  }),
  'progression.classification.slopePctPerWeek': msg({
    id: 'params.progression.classification.slopePctPerWeek',
    message: 'Strength gains that set your level',
  }),
  'progression.classification.trainingAgeMonths': msg({
    id: 'params.progression.classification.trainingAgeMonths',
    message: 'Training experience that sets your level',
  }),
  'progression.double.incrementGuardPct': msg({
    id: 'params.progression.double.incrementGuardPct',
    message: 'Largest weight step when reps go up',
  }),
  'progression.increment.advancedLoadJumpWeeks': msg({
    id: 'params.progression.increment.advancedLoadJumpWeeks',
    message: 'Weeks between weight steps when advanced',
  }),
  'progression.increment.intermediatePctPerWeek': msg({
    id: 'params.progression.increment.intermediatePctPerWeek',
    message: 'Weekly weight step for intermediates',
  }),
  'progression.increment.microplateKgPerSide': msg({
    id: 'params.progression.increment.microplateKgPerSide',
    message: 'Smallest plate per side',
  }),
  'progression.increment.noviceLowerKg': msg({
    id: 'params.progression.increment.noviceLowerKg',
    message: 'Weight step for beginners, lower body',
  }),
  'progression.increment.noviceUpperKg': msg({
    id: 'params.progression.increment.noviceUpperKg',
    message: 'Weight step for beginners, upper body',
  }),
  'progression.model.accessory': msg({
    id: 'params.progression.model.accessory',
    message: 'How assistance exercises progress',
  }),
  'progression.model.mainLift': msg({
    id: 'params.progression.model.mainLift',
    message: 'How main lifts progress',
  }),
  'progression.pace.window': msg({
    id: 'params.progression.pace.window',
    message: 'When weight steps outpace your progress',
  }),
  'progression.stall.failedSessions': msg({
    id: 'params.progression.stall.failedSessions',
    message: 'Missed sessions before a reset',
  }),
  'progression.stall.resetPct': msg({
    id: 'params.progression.stall.resetPct',
    message: 'Weight drop after a stall',
  }),
  'ranking.effectiveness': msg({
    id: 'params.ranking.effectiveness',
    message: 'How exercises are ranked for a muscle',
  }),
  'scoring.allometric.exponent': msg({
    id: 'params.scoring.allometric.exponent',
    message: 'Body-weight exponent for relative strength',
  }),
  'scoring.display': msg({ id: 'params.scoring.display', message: 'Points formulas shown' }),
  'scoring.dots.bodyweightClampKg': msg({
    id: 'params.scoring.dots.bodyweightClampKg',
    message: 'Body-weight limits for DOTS',
  }),
  'scoring.dots.coefficients': msg({
    id: 'params.scoring.dots.coefficients',
    message: 'DOTS coefficients',
  }),
  'scoring.ipfGl.coefficients': msg({
    id: 'params.scoring.ipfGl.coefficients',
    message: 'IPF GL coefficients',
  }),
  'scoring.ipfGl.minBodyweightKg': msg({
    id: 'params.scoring.ipfGl.minBodyweightKg',
    message: 'Lowest body weight for IPF GL points',
  }),
  'scoring.ipfPoints.coefficients': msg({
    id: 'params.scoring.ipfPoints.coefficients',
    message: 'IPF Points coefficients',
  }),
  'scoring.ipfPoints.minBodyweightKg': msg({
    id: 'params.scoring.ipfPoints.minBodyweightKg',
    message: 'Lowest body weight for IPF Points',
  }),
  'scoring.wilks.bodyweightClampKg': msg({
    id: 'params.scoring.wilks.bodyweightClampKg',
    message: 'Body-weight limits for Wilks',
  }),
  'scoring.wilks.coefficients': msg({
    id: 'params.scoring.wilks.coefficients',
    message: 'Wilks coefficients',
  }),
  'scoring.wilks2020.bodyweightClampKg': msg({
    id: 'params.scoring.wilks2020.bodyweightClampKg',
    message: 'Body-weight limits for Wilks2020',
  }),
  'scoring.wilks2020.coefficients': msg({
    id: 'params.scoring.wilks2020.coefficients',
    message: 'Wilks2020 coefficients',
  }),
  'session.duration.repSeconds': msg({
    id: 'params.session.duration.repSeconds',
    message: 'Time per rep for session length',
  }),
  'session.duration.transitionSeconds': msg({
    id: 'params.session.duration.transitionSeconds',
    message: 'Time to change exercises',
  }),
  'session.duration.warmupSetSeconds': msg({
    id: 'params.session.duration.warmupSetSeconds',
    message: 'Time per warm-up set',
  }),
  'session.rest.competitionMinimum': msg({
    id: 'params.session.rest.competitionMinimum',
    message: 'Shortest rest on competition lifts',
  }),
  'session.rest.countUpSoftMin': msg({
    id: 'params.session.rest.countUpSoftMin',
    message: 'Minimum rest when counting up',
  }),
  'session.rest.hypertrophyCompound': msg({
    id: 'params.session.rest.hypertrophyCompound',
    message: 'Rest between muscle-building sets, compound exercises',
  }),
  'session.rest.hypertrophyIsolation': msg({
    id: 'params.session.rest.hypertrophyIsolation',
    message: 'Rest between muscle-building sets, isolation exercises',
  }),
  'session.rest.strength': msg({
    id: 'params.session.rest.strength',
    message: 'Rest between strength sets',
  }),
  'session.rest.supersetTransition': msg({
    id: 'params.session.rest.supersetTransition',
    message: 'Pause between the exercises of a superset',
  }),
  'session.rest.timeSaver': msg({
    id: 'params.session.rest.timeSaver',
    message: 'Rest in time-saver mode',
  }),
  'session.rest.warmupBeforeWork': msg({
    id: 'params.session.rest.warmupBeforeWork',
    message: 'Rest after the last warm-up set',
  }),
  'session.rest.warmupLight': msg({
    id: 'params.session.rest.warmupLight',
    message: 'Rest after light warm-up sets',
  }),
  'session.techniqueCredit.cluster': msg({
    id: 'params.session.techniqueCredit.cluster',
    message: 'Credit for cluster sets',
  }),
  'session.techniqueCredit.drop': msg({
    id: 'params.session.techniqueCredit.drop',
    message: 'Credit for drop sets',
  }),
  'session.techniqueCredit.lengthenedPartials': msg({
    id: 'params.session.techniqueCredit.lengthenedPartials',
    message: 'Credit for lengthened partials',
  }),
  'session.techniqueCredit.myoReps': msg({
    id: 'params.session.techniqueCredit.myoReps',
    message: 'Credit for myo-reps',
  }),
  'session.techniqueCredit.partialExtension': msg({
    id: 'params.session.techniqueCredit.partialExtension',
    message: 'Credit for partials after the last full rep',
  }),
  'session.techniqueCredit.restPause': msg({
    id: 'params.session.techniqueCredit.restPause',
    message: 'Credit for rest-pause sets',
  }),
  'session.tempo.default': msg({ id: 'params.session.tempo.default', message: 'Default tempo' }),
  'session.tempo.eccentricSeconds': msg({
    id: 'params.session.tempo.eccentricSeconds',
    message: 'Time for the lowering part of a rep',
  }),
  'session.tempo.warnRepSeconds': msg({
    id: 'params.session.tempo.warnRepSeconds',
    message: 'Rep length that shows a hint',
  }),
  'session.warmup.compound': msg({
    id: 'params.session.warmup.compound',
    message: 'Warm-up for compound exercises',
  }),
  'session.warmup.feeder': msg({
    id: 'params.session.warmup.feeder',
    message: 'Warm-up set for a later exercise',
  }),
  'session.warmup.heavy': msg({
    id: 'params.session.warmup.heavy',
    message: 'Warm-up before heavy sets',
  }),
  'session.warmup.heavyTrigger': msg({
    id: 'params.session.warmup.heavyTrigger',
    message: 'When the heavy warm-up is used',
  }),
  'session.warmup.isolation': msg({
    id: 'params.session.warmup.isolation',
    message: 'Warm-up for isolation exercises',
  }),
  'session.warmup.pruning': msg({
    id: 'params.session.warmup.pruning',
    message: 'Warm-up sets left out when close together',
  }),
  'volume.counting.default': msg({
    id: 'params.volume.counting.default',
    message: 'How sets count for each muscle',
  }),
  'volume.effort.hypertrophyRir': msg({
    id: 'params.volume.effort.hypertrophyRir',
    message: 'Effort for muscle-building sets',
  }),
  'volume.effort.hypertrophySlopePerRir': msg({
    id: 'params.volume.effort.hypertrophySlopePerRir',
    message: 'Growth lost per rep left in reserve',
  }),
  'volume.effort.strengthAccessoryRpe': msg({
    id: 'params.volume.effort.strengthAccessoryRpe',
    message: 'Effort for assistance work in strength training',
  }),
  'volume.effort.strengthRpe': msg({
    id: 'params.volume.effort.strengthRpe',
    message: 'Effort for strength sets',
  }),
  'volume.frequency.hypertrophyPerMuscle': msg({
    id: 'params.volume.frequency.hypertrophyPerMuscle',
    message: 'Sessions per week for each muscle',
  }),
  'volume.frequency.strengthPerLift': msg({
    id: 'params.volume.frequency.strengthPerLift',
    message: 'Sessions per week for each competition lift',
  }),
  'volume.hardSet.highReps': msg({
    id: 'params.volume.hardSet.highReps',
    message: 'When a high-rep set counts as hard',
  }),
  'volume.hardSet.maxRir': msg({
    id: 'params.volume.hardSet.maxRir',
    message: 'Most reps in reserve for a hard set',
  }),
  'volume.hardSet.unknownRirCounts': msg({
    id: 'params.volume.hardSet.unknownRirCounts',
    message: 'Sets without an effort rating count as hard',
  }),
  'volume.hypertrophy.minimumDose': msg({
    id: 'params.volume.hypertrophy.minimumDose',
    message: 'Fewest weekly sets that still build muscle',
  }),
  'volume.hypertrophy.perSessionSoftCap': msg({
    id: 'params.volume.hypertrophy.perSessionSoftCap',
    message: 'Useful sets per muscle in one session',
  }),
  'volume.hypertrophy.tiers': msg({
    id: 'params.volume.hypertrophy.tiers',
    message: 'Growth at each weekly set count',
  }),
  'volume.hypertrophy.weeklyBands': msg({
    id: 'params.volume.hypertrophy.weeklyBands',
    message: 'Weekly sets per muscle for growth',
  }),
  'volume.load.hypertrophyMinPct1rm': msg({
    id: 'params.volume.load.hypertrophyMinPct1rm',
    message: 'Lightest weight for muscle building',
  }),
  'volume.maintenance': msg({
    id: 'params.volume.maintenance',
    message: 'Sets that keep what you built',
  }),
  'volume.puos': msg({
    id: 'params.volume.puos',
    message: 'Weekly sets beyond which more shows no clear benefit',
  }),
  'volume.repRange.hypertrophy': msg({
    id: 'params.volume.repRange.hypertrophy',
    message: 'Reps per set for muscle building',
  }),
  'volume.repRange.strength': msg({
    id: 'params.volume.repRange.strength',
    message: 'Reps per set for strength',
  }),
  'volume.startingVolume.maxFactor': msg({
    id: 'params.volume.startingVolume.maxFactor',
    message: 'Most a new plan raises your recent volume',
  }),
  'volume.strength.heavySet': msg({
    id: 'params.volume.strength.heavySet',
    message: 'What counts as a heavy strength set',
  }),
  'volume.strength.minimumDosePerLift': msg({
    id: 'params.volume.strength.minimumDosePerLift',
    message: 'Fewest weekly heavy sets per competition lift',
  }),
  'volume.strength.perSessionHeavySets': msg({
    id: 'params.volume.strength.perSessionHeavySets',
    message: 'Heavy sets per lift in one session',
  }),
  'volume.strength.tiers': msg({
    id: 'params.volume.strength.tiers',
    message: 'Strength gain at each weekly set count',
  }),
  'volume.strength.weeklyHeavySetsPerLift': msg({
    id: 'params.volume.strength.weeklyHeavySetsPerLift',
    message: 'Weekly heavy sets per competition lift',
  }),
} as const satisfies Record<ParamId, MessageDescriptor>;
