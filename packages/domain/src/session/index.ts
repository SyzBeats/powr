/**
 * `@powr/domain/session`: the workout session core (M3a; WKT-01…16, TMR-01…13 data and logic,
 * PRG-03…13 in the session, RDY-01…03, MOT-01; technical concept §6.2, §6.9, §8.5, §8.8.1).
 * The pure reducer and its events and effects, set suggestions with "Why?", the derived exercise
 * state and its recompute, PR detection, readiness, guardrails, timers, past sessions and the
 * read models. No I/O: the application (`@powr/application/session`) runs the effects.
 */
export {
  DEFAULT_ADDED_SETS,
  addedExercise,
  exercisesFromPlannedSession,
  plannedSetsOf,
  warmupsFor,
} from './build';
export { sessionMuscleVolume, setGuardrails } from './guardrails';
export {
  calibrationStatus,
  currentE1rm,
  derivationKey,
  emptyExerciseState,
  exposuresOf,
  foldExposure,
  rebuildExerciseState,
  seedFromBaseline,
  sortSets,
  type CalibrationStatus,
  type ExerciseState,
  type Exposure,
  type ExposureSummary,
  type FoldInput,
  type FoldResult,
  type PerformedSetSummary,
  type PointChange,
  type RebuildResult,
  type RecentExposure,
  type SessionE1rmPoint,
  type TrendBand,
} from './history';
export { sessionPrs, type SessionPrs } from './live';
export {
  PAST_SET_SPACING_MS,
  applyPastEdits,
  pastSession,
  type PastEdit,
  type PastError,
  type PastExerciseInput,
  type PastSessionInput,
} from './past';
export {
  EMPTY_BESTS,
  PR_TYPES,
  exposurePrs,
  explainFirstTime,
  explainPr,
  prCandidate,
  repMax,
  type ExerciseBests,
  type PrRecord,
  type PrType,
  type RepBest,
} from './prs';
export {
  assessReadiness,
  lowReadinessDays,
  readinessProposals,
  returnProposals,
  type ReadinessRules,
} from './readiness';
export { reduceSession, restSecondsFor, startSession, type StartInput } from './reduce';
export { cursorOrder, firstPending, slotOf } from './slots';
export { implementOf, loadless, prefillReps, prefillRir, suggestSet } from './suggest';
export {
  STALE_SESSION_MS,
  TIMER_STEP_MS,
  UNDO_TTL_MS,
  adjustTimer,
  newTimer,
  parseTempo,
  restartTimer,
  sessionElapsedMs,
  tempoRepSeconds,
  timerEndEpochMs,
  timerView,
  type Tempo,
  type TimerView,
} from './timers';
export {
  DEFAULT_SESSION_PREFERENCES,
  GUARDRAIL_KINDS,
  READINESS_ITEMS,
  type Announcement,
  type ExerciseEquipment,
  type ExercisePreference,
  type Guardrail,
  type GuardrailKind,
  type NoteTarget,
  type PlausibilityIssue,
  type PrescriptionChange,
  type ReadinessAssessment,
  type ReadinessItem,
  type ReadinessOutcome,
  type SessionContext,
  type SessionEffect,
  type SessionEvent,
  type SessionEventType,
  type SessionPreferences,
  type SessionProposal,
  type SessionRejection,
  type SessionResult,
  type SessionState,
  type SetInput,
  type SetSuggestion,
  type Transition,
} from './types';
export { PLAUSIBILITY, plausibilityIssues } from './values';
export {
  estimateRemainingS,
  sessionSummary,
  sessionView,
  type E1rmChange,
  type ExerciseView,
  type MuscleVolumeRow,
  type PlannedSetView,
  type SessionSummary,
  type SessionView,
} from './view';
