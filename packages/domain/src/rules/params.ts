import type { TechniqueKind } from './techniques';

/**
 * Value types of the rules registry parameters (technical concept §8.6). The registry data
 * (`packages/rules/data/*.yaml`) supplies the values; `@powr/rules` validates each row against a
 * schema that must produce exactly these types, so engine code reads typed values only.
 */

/** Trainee level (PRG-10); selects increments, trend noise and typical error. */
export const TRAINEE_LEVELS = ['novice', 'intermediate', 'advanced'] as const;
export type TraineeLevel = (typeof TRAINEE_LEVELS)[number];

/** The sex reference used for scoring coefficients (ANL-07). */
export const SEX_REFERENCES = ['male', 'female'] as const;
export type SexReference = (typeof SEX_REFERENCES)[number];

/** Unit of a parameter value; compound values name their parts (`nonFailureHours`). */
export const PARAM_UNITS = [
  'none',
  'fraction',
  'pct',
  'reps',
  'rir',
  'rpe',
  'sets',
  'sessions',
  'seconds',
  'days',
  'weeks',
  'kg',
  'pctPerWeek',
  'table',
  'coefficients',
  'mixed',
] as const;
export type ParamUnit = (typeof PARAM_UNITS)[number];

/** Inclusive range. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

export type ByLevel<T> = Readonly<Record<TraineeLevel, T>>;
export type BySex<T> = Readonly<Record<SexReference, T>>;

// --- Load, e1RM and change detection (EB §Defaults › Load) ---------------------------------

/** Rep-max equation for bench-like exercises (PRG-01). Lombardi, Lander, O'Conner are not exposed. */
export const E1RM_EQUATIONS = ['wathan', 'epley', 'brzycki', 'rts'] as const;
export type E1rmEquation = (typeof E1RM_EQUATIONS)[number];

/** Where an exercise class gets its reps-to-%1RM curve from (E-3). */
export const CURVE_SOURCES = ['equation', 'nuzzoPooled', 'nuzzoBench', 'nuzzoLegPress'] as const;
export type CurveSource = (typeof CURVE_SOURCES)[number];

/** Nuzzo 2024: mean reps to failure at a %1RM. */
export interface RepsAtPctRow {
  readonly pct: number;
  readonly reps: number;
}

/** The one-dimensional RTS chart: %1RM at an effective rep count. */
export interface PctAtReffRow {
  readonly reff: number;
  readonly pct: number;
}

export interface RpeWeightTier {
  readonly minRpe: number;
  readonly weight: number;
}

export interface ReffWeightTier {
  readonly maxReff: number;
  readonly weight: number;
}

export interface RirBiasTier {
  readonly minRir: number;
  readonly add: number;
}

export interface HeavySetRule {
  readonly maxReff: number;
  readonly minRpe: number;
}

export interface ChangeThresholds {
  /** "Likely real": the change exceeds this many typical errors… */
  readonly likelyTe: number;
  /** …and this many standard deviations of its own uncertainty (any claim, rules 1.6.0)… */
  readonly likelyZ: number;
  /** …and keeps its sign for this many consecutive sessions. */
  readonly sustainSessions: number;
  /** "Very likely real": the change exceeds this many typical errors. */
  readonly veryLikelyTe: number;
}

/**
 * The reference of a change label (PRG-02): the smoothed value `weeks[level]` weeks or `sessions`
 * sessions earlier, whichever is older, never one of the series' first `sessions` points.
 */
export interface TrendReference {
  readonly weeks: ByLevel<number>;
  readonly sessions: number;
}

// --- Volume, frequency, load and effort (EB §Defaults › Volume) ----------------------------

/** Weekly fractional sets per muscle (hypertrophy). Above `highHigh` a soft warning applies. */
export interface WeeklyVolumeBands {
  readonly floor: number;
  readonly defaultLow: number;
  readonly defaultHigh: number;
  readonly highHigh: number;
  readonly hardWarnAbove: number;
}

export interface VolumeTier {
  readonly minSets: number;
  readonly maxSets: number | null;
  readonly tier: string;
  readonly extraSetsPerDetectableGain: number | null;
}

export interface HighRepRule {
  readonly above: number;
  readonly maxRir: number;
}

export interface SessionSoftCap {
  readonly fractionalSets: number;
  readonly directSets: number;
  readonly nudge: Range;
}

export interface RepRangesHypertrophy {
  readonly compound: Range;
  readonly isolation: Range;
  readonly allowed: Range;
}

export interface RepRangesStrength {
  readonly main: Range;
  readonly accessory: Range;
  readonly mainMinPct1rm: number;
}

// --- Progression (EB §Defaults › Progression) ----------------------------------------------

export const PROGRESSION_MODELS = ['doubleProgression', 'rpe', 'linear', 'apre'] as const;
export type ProgressionModel = (typeof PROGRESSION_MODELS)[number];

export interface ApreStep {
  readonly reps: number;
  readonly pct: number;
}

export interface ApreAdjustment {
  readonly minReps: number;
  readonly maxReps: number | null;
  /** The suggested change of the 6RM load: the midpoint of `rangeKg`. */
  readonly adjustKg: number;
  readonly rangeKg: Range;
}

export interface AprePreset {
  /** Sets 1 and 2; set 3 is an AMRAP at the 6RM load, set 4 an AMRAP at the adjusted load. */
  readonly ramp: readonly ApreStep[];
  readonly adjustments: readonly ApreAdjustment[];
}

// --- Deloads and breaks (data only in M1) ------------------------------------------------

export interface DeloadContent {
  readonly setsReductionPct: Range;
  readonly rirIncrease: Range;
  readonly loadPct: Range;
  readonly higherRepLoadReductionPct: Range;
  readonly keepExercises: boolean;
  readonly keepFrequency: boolean;
  readonly dropAccessories: 'optional' | 'always' | 'never';
}

export interface ReactiveDeload {
  readonly signalsRequired: number;
  readonly declineSessions: number;
  readonly lowReadinessDays: number;
}

export interface ReturnFromBreakRow {
  /** The row applies up to this many days since the lift was last trained; null = longer. */
  readonly maxDays: number | null;
  readonly action: 'resume' | 'reduce' | 'reentry' | 'recalibrate';
  readonly loadPct: Range | null;
  readonly setsPct: Range | null;
  readonly rirAdd: number;
  readonly rampWeeks: Range | null;
}

// --- Session design (EB §Defaults › Session) ----------------------------------------------

export interface WarmupStep {
  /** Percent of the working load. */
  readonly pct: number;
  readonly reps: number;
}

export interface WarmupRamp {
  /** Empty-bar set for barbell exercises; null = none. */
  readonly barReps: number | null;
  readonly steps: readonly WarmupStep[];
  /** Added only on request (e.g. the optional 85% × 2 of the compound ramp). */
  readonly optional: readonly WarmupStep[];
}

export interface HeavyWarmupTopUp extends WarmupStep {
  /** Added when the working load is at least this percent of e1RM. */
  readonly minPctE1rm: number;
}

export interface HeavyWarmupRamp extends WarmupRamp {
  readonly topUp: HeavyWarmupTopUp;
}

export interface WarmupTrigger {
  readonly maxReps: number;
  readonly minPctE1rm: number;
}

export interface WarmupPruning {
  /** Drop a step within this percent of the working load of the previous step. */
  readonly minStepGapPct: number;
  /** From this percent of the working load on, warm-up reps stay below the working reps. */
  readonly repCapFromPct: number;
  /** Steps from this percent on are followed by the longer rest before work. */
  readonly longRestFromPct: number;
}

/** Volume credit of a technique set: min(cap, base + perUnit × units), WKT-04. */
export interface TechniqueCredit {
  readonly base: number;
  readonly perUnit: number;
  readonly cap: number;
}

export interface CountUpSoftMin {
  readonly compound: number;
  readonly isolation: number;
}

// --- Monitoring and readiness (data only in M1) --------------------------------------------

export interface ReadinessBaseline {
  readonly windowDays: number;
  readonly minEntries: number;
}

export interface ReadinessThresholds {
  readonly lowZ: number;
  readonly modifyZ: number;
  readonly prsLow: number;
  readonly prsConsecutiveDays: number;
}

export interface ReadinessAdjustments {
  readonly topSetRirAdd: number;
  readonly dropBackoffSets: Range;
}

/** RDY-03 sleep rules (EB §Monitoring › Sleep & stress). */
export interface SleepRules {
  /** A night shorter than this many hours is short. */
  readonly shortHours: number;
  /** This many short nights in a row lower expectations on multi-joint lifts. */
  readonly consecutiveShortNights: number;
}

export interface SessionSpacing {
  readonly nonFailureHours: Range;
  readonly failureHours: Range;
  readonly unaccustomedDays: Range;
  readonly highStressExtraHours: number;
}

// --- Scoring (EB §Scoring) -----------------------------------------------------------------

export const SCORE_FORMULAS = [
  'ipfGl',
  'dots',
  'ipfPoints',
  'wilks',
  'wilks2020',
  'allometric',
] as const;
export type ScoreFormula = (typeof SCORE_FORMULAS)[number];

export interface ScoringDisplay {
  readonly primary: readonly ScoreFormula[];
  readonly legacy: readonly ScoreFormula[];
  readonly decimals: number;
}

/** Polynomial coefficients in ascending powers of bodyweight: c0 + c1·x + c2·x² + … */
export type Polynomial = readonly number[];

/** IPF Points: C1…C4 of 500 + 100·(T − (C1·ln BW − C2)) / (C3·ln BW − C4). */
export interface IpfPointsCoefficients {
  readonly c1: number;
  readonly c2: number;
  readonly c3: number;
  readonly c4: number;
}

/** IPF GL: A, B, C of 100 / (A − B·e^(−C·BW)). */
export interface IpfGlCoefficients {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/** Per division (classic/equipped) and event (3-lift total/bench only). */
export interface ByDivisionEvent<T> {
  readonly classic: { readonly total: T; readonly bench: T };
  readonly equipped: { readonly total: T; readonly bench: T };
}

// --- Planning and ranking (M2: EB §Defaults › Volume, › Session; PRD PLN-01…14, MAP-03) -------

/**
 * Where a weekly target starts inside its default band (PLN-03): a fraction of the way from the
 * band's low to its high end, by trainee level; priority muscles use `priority`.
 */
export interface StartPosition {
  readonly novice: number;
  readonly intermediate: number;
  readonly advanced: number;
  readonly priority: number;
}

/**
 * Where the group that keeps its full weekly target comes from when the session time budget
 * cannot fit every target (PLN-14): the user's priority muscles, the template's emphasis (the
 * display groups its hypertrophy slots of a `templateSlots` priority target); the first
 * non-empty group wins.
 */
export const KEEP_FULL_SOURCES = ['priorities', 'template'] as const;
export type KeepFullSource = (typeof KEEP_FULL_SOURCES)[number];

export interface TimeBudgetFallback {
  readonly keepFull: readonly KeepFullSource[];
  readonly templateSlots: readonly ('primary' | 'secondary' | 'optional')[];
}

/** MAP-03 effectiveness: factor weights (sum 1) and the score of each mapping evidence code. */
export interface RankingEffectiveness {
  readonly weights: {
    readonly credit: number;
    readonly evidence: number;
    readonly stretch: number;
    readonly overload: number;
    readonly subRegion: number;
  };
  readonly evidenceScore: { readonly H: number; readonly EMG: number; readonly C: number };
}

// --- Insight and motivation (M4a: PRD MOT-03/04, BOD-02, PRG-07, PLN-03; EB §Nutrition) -------

/**
 * Weekly bodyweight gain while bulking (BOD-02; EB §Nutrition › Bulking): the target band in
 * % of bodyweight per week by trainee level, and how many weeks above it count as sustained.
 */
export interface BulkRate {
  readonly target: ByLevel<Range>;
  readonly sustainedWeeks: number;
}

/**
 * Weekly bodyweight loss while cutting (BOD-02; EB §Nutrition › Cutting), in % of bodyweight per
 * week (positive = loss): the default target band, the allowed range and the hard warning above
 * `hardWarnAbove` when it lasts `sustainedWeeks` weeks.
 */
export interface CutRate {
  readonly target: Range;
  readonly allowed: Range;
  readonly hardWarnAbove: number;
  readonly sustainedWeeks: number;
}

/** PLN-03 "heavy sets": at least `minPct1rm` % of 1RM and at most `maxReps` reps. */
export interface HeavySetDefinition {
  readonly minPct1rm: number;
  readonly maxReps: number;
}

/** PRG-07 (TD-44): the window over which planned increases are compared with the e1RM trend. */
export interface PaceWindow {
  readonly weeks: number;
  readonly minExposures: number;
}

// --- The registry ------------------------------------------------------------------------

/** Every MVP parameter by ID, with its value type. IDs are stable (technical concept §8.1). */
export interface ParamValues {
  // load.yaml
  'load.e1rm.equation': E1rmEquation;
  'load.curve.classMap': Readonly<Record<'equation' | 'legPressLike' | 'pooled', CurveSource>>;
  'load.curve.nuzzoPooled': readonly RepsAtPctRow[];
  'load.curve.nuzzoBench': readonly RepsAtPctRow[];
  'load.curve.nuzzoLegPress': readonly RepsAtPctRow[];
  'load.curve.rts': readonly PctAtReffRow[];
  'load.e1rm.weightByRpe': readonly RpeWeightTier[];
  'load.e1rm.weightByReff': readonly ReffWeightTier[];
  'load.e1rm.setOrderDecay': number;
  'load.rirBias': readonly RirBiasTier[];
  'load.unknownEffort.priorRirDefault': number;
  'load.unknownEffort.priorRirSd': number;
  'load.unknownEffort.weightMultiplier': number;
  'load.unknownEffort.personalPrior': {
    readonly windowWeeks: number;
    readonly repTolerance: number;
  };
  'load.unknownEffort.eligibleForE1rmPr': boolean;
  /** ONB-08: a known 1RM older than this many days shows the "refined automatically" hint. */
  'load.baseline.refineAfterDays': number;
  'load.trend.noiseHeavySd': number;
  'load.trend.noiseTypicalSd': number;
  'load.trend.heavySet': HeavySetRule;
  'load.trend.strengthMaxReff': number;
  'load.trend.processSdPerWeek': ByLevel<number>;
  'load.trend.noviceWidening': { readonly weeks: number; readonly factor: number };
  'load.trend.typicalErrorCv': ByLevel<number>;
  'load.trend.changeThresholds': ChangeThresholds;
  'load.trend.reference': TrendReference;
  'load.reanchor.trigger': { readonly maxReps: number; readonly minRpe: number };
  /** MOT-01: e1RM PRs come only from sets the e1RM pipeline weighs at least this much (R-07). */
  'load.pr.minSetWeight': number;
  // volume.yaml
  'volume.hypertrophy.weeklyBands': WeeklyVolumeBands;
  'volume.hypertrophy.tiers': readonly VolumeTier[];
  'volume.strength.tiers': readonly VolumeTier[];
  'volume.puos': {
    readonly hypertrophyFractionalSets: number;
    readonly strengthFractionalSets: number;
    readonly strengthSessionsPerWeek: number;
  };
  'volume.counting.default': 'fractional' | 'direct';
  'volume.hardSet.maxRir': number;
  'volume.hardSet.highReps': HighRepRule;
  'volume.hardSet.unknownRirCounts': boolean;
  'volume.frequency.hypertrophyPerMuscle': number;
  'volume.frequency.strengthPerLift': Range;
  'volume.hypertrophy.perSessionSoftCap': SessionSoftCap;
  'volume.strength.perSessionHeavySets': Range;
  'volume.strength.weeklyHeavySetsPerLift': Range;
  'volume.startingVolume.maxFactor': number;
  'volume.maintenance': { readonly volumeFraction: number; readonly minSessionsPerWeek: number };
  'volume.hypertrophy.minimumDose': { readonly setsPerWeek: number };
  'volume.repRange.hypertrophy': RepRangesHypertrophy;
  'volume.repRange.strength': RepRangesStrength;
  'volume.load.hypertrophyMinPct1rm': number;
  'volume.effort.hypertrophyRir': Range;
  'volume.effort.strengthRpe': { readonly work: Range; readonly heavySingle: Range };
  'volume.effort.hypertrophySlopePerRir': number;
  'volume.effort.strengthAccessoryRpe': Range;
  'volume.strength.minimumDosePerLift': Range;
  // progression.yaml
  'progression.model.mainLift': ByLevel<ProgressionModel>;
  'progression.model.accessory': ProgressionModel;
  'progression.double.incrementGuardPct': Range;
  'progression.increment.noviceLowerKg': number;
  'progression.increment.noviceUpperKg': number;
  'progression.increment.intermediatePctPerWeek': number;
  'progression.increment.advancedLoadJumpWeeks': Range;
  'progression.increment.microplateKgPerSide': Range;
  'progression.stall.failedSessions': number;
  'progression.stall.resetPct': number;
  'progression.apre.sixRm': AprePreset;
  'progression.calibration': { readonly exposures: Range; readonly targetRir: Range };
  /** PRG-08: one exposure calibrates when one of its sets has at least this e1RM set weight. */
  'progression.calibration.reliableSetWeight': number;
  'progression.classification.slopePctPerWeek': {
    readonly noviceFrom: number;
    readonly advancedBelow: number;
    readonly minWeeks: number;
  };
  'progression.classification.trainingAgeMonths': {
    readonly intermediateFrom: number;
    readonly advancedFrom: number;
  };
  // deload.yaml
  'deload.planned.everyWeeks': number;
  'deload.planned.durationDays': number;
  'deload.planned.postpone': { readonly weeks: number; readonly maxPerMesocycle: number };
  'deload.content': DeloadContent;
  'deload.reactive': ReactiveDeload;
  'deload.returnFromBreak': readonly ReturnFromBreakRow[];
  'deload.returnFromBreak.sorenessNoteAfterDays': number;
  // session.yaml
  'session.rest.strength': number;
  'session.rest.hypertrophyCompound': number;
  'session.rest.hypertrophyIsolation': number;
  'session.rest.timeSaver': number;
  'session.rest.supersetTransition': number;
  'session.rest.warmupLight': number;
  'session.rest.warmupBeforeWork': number;
  'session.rest.countUpSoftMin': CountUpSoftMin;
  /** WKT-16: rest on a competition lift below this many seconds gets a hint (never < 2:00). */
  'session.rest.competitionMinimum': number;
  'session.tempo.default': string;
  'session.tempo.eccentricSeconds': Range;
  'session.tempo.warnRepSeconds': number;
  'session.duration.repSeconds': number;
  'session.duration.warmupSetSeconds': number;
  'session.duration.transitionSeconds': number;
  'session.warmup.heavyTrigger': WarmupTrigger;
  'session.warmup.heavy': HeavyWarmupRamp;
  'session.warmup.compound': WarmupRamp;
  'session.warmup.isolation': WarmupRamp;
  'session.warmup.feeder': WarmupRamp;
  'session.warmup.pruning': WarmupPruning;
  'session.techniqueCredit.drop': TechniqueCredit;
  'session.techniqueCredit.restPause': TechniqueCredit;
  'session.techniqueCredit.myoReps': TechniqueCredit;
  'session.techniqueCredit.cluster': TechniqueCredit;
  'session.techniqueCredit.lengthenedPartials': TechniqueCredit;
  'session.techniqueCredit.partialExtension': TechniqueCredit;
  // monitoring.yaml
  'monitoring.readiness.baseline': ReadinessBaseline;
  'monitoring.readiness.thresholds': ReadinessThresholds;
  'monitoring.readiness.adjustments': ReadinessAdjustments;
  'monitoring.readiness.sleep': SleepRules;
  /** RDY-03: a session starting at or after this local hour is a "PM session". */
  'monitoring.readiness.pmFromHour': number;
  'monitoring.spacing': SessionSpacing;
  // scoring.yaml
  'scoring.display': ScoringDisplay;
  'scoring.wilks.coefficients': BySex<Polynomial>;
  'scoring.wilks.bodyweightClampKg': BySex<Range>;
  'scoring.wilks2020.coefficients': BySex<Polynomial>;
  'scoring.wilks2020.bodyweightClampKg': BySex<Range>;
  'scoring.dots.coefficients': BySex<Polynomial>;
  'scoring.dots.bodyweightClampKg': BySex<Range>;
  'scoring.ipfPoints.coefficients': BySex<ByDivisionEvent<IpfPointsCoefficients>>;
  'scoring.ipfPoints.minBodyweightKg': number;
  'scoring.ipfGl.coefficients': BySex<ByDivisionEvent<IpfGlCoefficients>>;
  /** Rules 1.8.0 (T-01, V-5): by sex, as the IPF GL document applies the formula (40 / 35 kg). */
  'scoring.ipfGl.minBodyweightKg': BySex<number>;
  'scoring.allometric.exponent': number;
  // planning.yaml
  'planning.mesocycle.accumulationWeeks': Range;
  'planning.novice.maxWorkingExercises': number;
  'planning.sessionBudget.tolerancePct': number;
  'planning.slot.sets': Range;
  'planning.strength.accessorySets': number;
  'planning.volume.startPosition': StartPosition;
  'planning.rotation.perMuscle': Range;
  'planning.variety.pool': number;
  'planning.missed.mergePriorities': readonly ('primary' | 'secondary' | 'optional')[];
  'planning.timeBudget.fallback': TimeBudgetFallback;
  // ranking.yaml
  'ranking.effectiveness': RankingEffectiveness;
  // bodyweight.yaml
  'bodyweight.trend.alphaPerDay': number;
  'bodyweight.trend.initialWeighIns': Range;
  'bodyweight.trend.winsorizePct': number;
  'bodyweight.rate.windowDays': Range;
  // M4a (rules 1.5.0): rates by phase (BOD-02), streaks (MOT-03/04), PRG-07 pace (TD-44),
  // the rep-range artefact flag (PRG-02, TD-26) and heavy sets (PLN-03).
  'bodyweight.rate.bulk': BulkRate;
  'bodyweight.rate.cut': CutRate;
  'bodyweight.rate.maintain': Range;
  'motivation.streak.partialMinShare': number;
  'motivation.streak.graceSessions': number;
  'motivation.streak.retroactiveBreakWeeks': number;
  'motivation.streak.defaultWeeklyTarget': number;
  'progression.pace.window': PaceWindow;
  'load.trend.repRangeShift': number;
  'volume.strength.heavySet': HeavySetDefinition;
}

export type ParamId = keyof ParamValues;

/** The technique-credit parameter of each technique kind. */
export const TECHNIQUE_CREDIT_PARAM = {
  drop: 'session.techniqueCredit.drop',
  restPause: 'session.techniqueCredit.restPause',
  myoReps: 'session.techniqueCredit.myoReps',
  cluster: 'session.techniqueCredit.cluster',
  lengthenedPartials: 'session.techniqueCredit.lengthenedPartials',
  partialExtension: 'session.techniqueCredit.partialExtension',
} as const satisfies Record<TechniqueKind, ParamId>;
