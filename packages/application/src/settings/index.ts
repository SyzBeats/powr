/**
 * `@powr/application/settings` (M5s): the Settings use cases (SET-02, SET-03, SET-05, SET-10,
 * TMR-01, PRG-03, TD-42; SET-05's advanced registry values). A separate entry the app loads with `import()`, so the resolver calls
 * behind the rest defaults stay off the startup path (§8.19). The profile answers and re-planning
 * (SET-08) live in the planning entry, next to the generator they use.
 */
export {
  setAlertSettings,
  setDisplayPreferences,
  setTrainingPreferences,
  setUnits,
} from './preferences';
export {
  MAX_REST_SECONDS,
  REST_PARAMS,
  isRestParam,
  resetExerciseRest,
  resetRestTimes,
  restTimes,
  setRestTime,
  type ExerciseRest,
  type RestParamId,
  type RestTime,
  type RestTimeError,
} from './rest';
export { exerciseChoices, setExerciseChoice, type ExerciseChoices } from './exercises';
export {
  OFFERED_EQUATIONS,
  OFFERED_MODELS,
  setTrainingParameter,
  trainingParameters,
  type TrainingChoice,
  type TrainingParameterError,
  type TrainingParameters,
} from './training';
