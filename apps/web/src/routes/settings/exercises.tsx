import { createFileRoute } from '@tanstack/react-router';

import { ExerciseChoicesScreen } from '../../features/settings/ExerciseChoicesScreen';

export const Route = createFileRoute('/settings/exercises')({ component: ExerciseChoicesScreen });
