/**
 * `@powr/application/library`: the exercise library and the body map's lists and actions (M4a;
 * EXL-02…05, EXL-07…09, MAP-02…05). A lazy entry like the others: search, filters and detail,
 * custom exercises (merged into the catalog, backed up), favourites, hidden and avoided marks,
 * setup memory and training max, a muscle's ranked exercises with the MAP-03 "why", and the map's
 * actions. `IMPLEMENTATION_NOTES.md` ("M4a analytics core") documents the API.
 */
export {
  addExerciseToToday,
  bodyMapRegions,
  exerciseDetail,
  muscleExercises,
  planPlacements,
  searchExercises,
  type AddToTodayOutcome,
  type ExerciseDetailView,
  type PlanPlacement,
} from './browse';
export {
  customExerciseDraft,
  deleteCustomExercise,
  listCustomExercises,
  saveCustomExercise,
  type CustomExerciseError,
} from './custom';
export {
  exerciseUserData,
  exerciseUserDataFor,
  observeSessionSetups,
  saveExerciseUserData,
  setAvoided,
  setFavourite,
  setHidden,
  type ExerciseMarkError,
  type SetupError,
} from './user-data';
