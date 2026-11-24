import { isContentExerciseId, type ExerciseDef } from '@powr/domain';

import { z } from './zod';

const localizedTextSchema = z.strictObject({ en: z.string().min(1).max(120) });

export const exerciseDefSchema = z.strictObject({
  id: z.string().refine(isContentExerciseId, 'Content exercise IDs look like ex.some-name'),
  name: localizedTextSchema,
  mechanics: z.enum(['compound', 'isolation']),
  competitionLift: z.enum(['squat', 'bench', 'deadlift']).optional(),
  status: z.enum(['active', 'deprecated']),
});

/** Validates one content exercise and returns it with its branded domain type. */
export function parseExerciseDef(input: unknown): ExerciseDef {
  const parsed = exerciseDefSchema.parse(input);
  const { competitionLift, ...rest } = parsed;
  return {
    ...rest,
    ...(competitionLift ? { competitionLift } : {}),
  };
}
