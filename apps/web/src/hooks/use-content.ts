import type { ExerciseDef } from '@powr/domain';

import { useContainer } from '../app/container-context';

export function useExercises(): readonly ExerciseDef[] {
  return useContainer().deps.content.exercises();
}
