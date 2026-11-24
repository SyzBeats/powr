/** Nominal typing for string IDs, so a SetId can never be passed where a SessionId is expected. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** 'ex.barbell-back-squat' (content) or 'cx.<uuidv7>' (custom). */
export type ExerciseId = Brand<string, 'ExerciseId'>;
/**
 * 'mu.quads' (a display group of the PRD §7.2 taxonomy) or 'mu.quads.vasti' (one of its
 * sub-regions, which rolls up to the parent for display and volume, EXL-05).
 */
export type MuscleId = Brand<string, 'MuscleId'>;
/** 'eq.barbell-olympic': an item of the equipment catalog (EQP-01). */
export type EquipmentId = Brand<string, 'EquipmentId'>;
/**
 * 'src.kubo2019': an entry of the source registry in packages/rules/data/sources. The naming
 * convention is documented in that directory's README.
 */
export type SourceId = Brand<string, 'SourceId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type SetId = Brand<string, 'SetId'>;
/** Calendar day, 'YYYY-MM-DD' (Temporal.PlainDate string). */
export type LocalDate = Brand<string, 'LocalDate'>;

// Lowercase ASCII words joined by single hyphens, e.g. "barbell-back-squat".
const CONTENT_EXERCISE_ID = /^ex\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MUSCLE_ID = /^mu\.[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const EQUIPMENT_ID = /^eq\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_ID = /^src\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function isContentExerciseId(value: string): value is ExerciseId {
  return CONTENT_EXERCISE_ID.test(value);
}

export function isMuscleId(value: string): value is MuscleId {
  return MUSCLE_ID.test(value);
}

export function isEquipmentId(value: string): value is EquipmentId {
  return EQUIPMENT_ID.test(value);
}

export function isSourceId(value: string): value is SourceId {
  return SOURCE_ID.test(value);
}
