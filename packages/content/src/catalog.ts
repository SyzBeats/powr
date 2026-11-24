import type { ExerciseDef, ExerciseId } from '@powr/domain';

import { parseExerciseDef } from './schema';

export interface ContentCatalog {
  /** SemVer + content hash, e.g. "1.0.4+sha.3f2a" (§7.8). */
  readonly version: string;
  exercise(id: ExerciseId): ExerciseDef | undefined;
  exercises(): readonly ExerciseDef[];
}

export function createContentCatalog(
  version: string,
  rawExercises: readonly unknown[],
): ContentCatalog {
  const exercises = rawExercises.map(parseExerciseDef);
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  if (byId.size !== exercises.length) throw new Error('Duplicate exercise IDs in content');
  return {
    version,
    exercise: (id) => byId.get(id),
    exercises: () => exercises,
  };
}
