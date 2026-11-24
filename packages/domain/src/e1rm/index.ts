/**
 * `@powr/domain/e1rm`: estimated 1RM from logged sets and loads for targets (PRG-01, PRG-05;
 * EB §Load). Effective reps, Wathan/Epley/Brzycki and the exact RTS lookup, exercise-class curves
 * from Nuzzo 2024, set weighting, the RIR bias, the unknown-effort policy (E-1) and the inverse
 * direction, load = e1RM × pct(target reps + target RIR); the starting e1RM of an onboarding
 * baseline (ONB-08) through the same pipeline.
 */
export {
  baselineE1rm,
  calibrationFallback,
  type BaselineE1rm,
  type BaselineRules,
} from './baseline';
export { curvePct, equationPct, rtsPct, tablePct, type CurveRules } from './curves';
export {
  effectiveReps,
  personalPriorRir,
  rirBias,
  rirFromRpe,
  rpeFromRir,
  setWeight,
  type BiasRules,
  type EffortHistoryEntry,
  type WeightRules,
} from './effort';
export {
  E1RM_EXCLUSIONS,
  estimateSetE1rm,
  sessionE1rm,
  type E1rmExclusion,
  type E1rmExercise,
  type E1rmRules,
  type E1rmSetInput,
  type SetE1rm,
  type SetE1rmOptions,
} from './estimate';
export {
  loadForTarget,
  type LoadTarget,
  type LoadTargetInput,
  type TargetEquipment,
  type TargetRules,
} from './target';
