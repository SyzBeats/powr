/**
 * `@powr/domain/planning`: plan generation, validation, scheduling and the next mesocycle
 * (PLN-01…15, PRG-10/13; technical concept §8.7.6). Pure and deterministic: the content
 * (exercises, templates), the resolved rules and the user's request are arguments; the same
 * inputs and seed give the same plan. Outputs the UI presents are explained (`Explained<T>`),
 * and every validation issue names its rule and registry parameters.
 */
export {
  analyzeWeek,
  dayMinutes,
  heavySets,
  meanReps,
  repRangesOf,
  rirRangesOf,
  setsOf,
  withSets,
} from './analysis';
export { muscleTargets, liftTargets } from './allocate';
export { creditFor, groupCredits, liftOf, type ExerciseLookup } from './credits';
export {
  applyPlanEdits,
  editsForFix,
  slotForExercise,
  type EditableWeek,
  type PlanEdit,
} from './edit';
export { generatePlan } from './generate';
export {
  proposeNextMesocycle,
  type NextMesocycleInput,
  type NextMesocycleProposal,
  type Rotation,
} from './next';
export { effectiveness, slotScore, type RankingRules } from './rank';
export { isEligible, rankCandidates, selectTemplate, toRir } from './select';
export {
  bringDeloadForward,
  doMissedToday,
  firstWeekStart,
  inBreak,
  materializeMesocycle,
  mergeMissed,
  missedSessions,
  moveSession,
  pauseForBreak,
  postponeDeload,
  resumeAfterBreak,
  sessionDate,
  sessionSpacing,
  skipDeload,
  skipSession,
  swapSessions,
} from './schedule';
export {
  assignWeekdays,
  sortWeekdays,
  spacingConflicts,
  weekOffset,
  type SpacingConflict,
} from './spacing';
export {
  PLAN_CONSTRAINTS,
  type ConstraintStatus,
  type DayWeek,
  type IssueCause,
  type IssueSeverity,
  type IssueSubject,
  type LiftWeek,
  type MuscleWeek,
  type PlanConstraint,
  type PlanFix,
  type PlanProposal,
  type PlanRequest,
  type PlanningCatalog,
  type PlanningRules,
  type RestRules,
  type SlotCandidate,
  type SlotChoice,
  type ValidationContext,
  type ValidationIssue,
  type ValidationReport,
  type WeekAnalysis,
} from './types';
export { validatePlan } from './validate';
