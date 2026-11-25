/**
 * `@powr/application/session`: the workout session use cases (M3a; WKT-01…16, TMR data and
 * logic, PRG-03…13 in the session, RDY-01…03, MOT-01). A separate entry that the app loads with
 * `import()`, like the planning entry: the reducer, the engine and the rules resolver stay off the
 * startup path (§8.19). Every use case takes the composition root's `Deps`; expected failures are
 * `Result`s. `IMPLEMENTATION_NOTES.md` ("M3a session core") documents the API and the effects.
 */
export { ensureDerived, rebuildExercises } from './derived';
export {
  deletePastSession,
  editPastSession,
  listPastSessions,
  logPastSession,
  pastSessionDetail,
  previewPastEdit,
  type PastSessionError,
  type PastSessionSummary,
} from './past';
export { loadImplements, observeActiveSession, substitutionOptions } from './view';
export {
  discardWorkout,
  dispatch,
  finishWorkout,
  rememberRest,
  resumeWorkout,
  startWorkout,
  updateSessionPreferences,
  workoutSummary,
  type PlatformEffect,
  type StartSource,
  type StartWorkoutError,
  type WorkoutError,
  type WorkoutOutcome,
} from './workout';
export { preferencesOf } from './context';
