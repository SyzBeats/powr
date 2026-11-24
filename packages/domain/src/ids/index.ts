/** Nominal typing for string IDs, so a SetId can never be passed where a SessionId is expected. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** 'ex.barbell-back-squat' (content) or 'cx.<uuidv7>' (custom). */
export type ExerciseId = Brand<string, 'ExerciseId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type SetId = Brand<string, 'SetId'>;
/** Calendar day, 'YYYY-MM-DD' (Temporal.PlainDate string). */
export type LocalDate = Brand<string, 'LocalDate'>;

const CONTENT_EXERCISE_ID = /^ex\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isContentExerciseId(value: string): value is ExerciseId {
  return CONTENT_EXERCISE_ID.test(value);
}
