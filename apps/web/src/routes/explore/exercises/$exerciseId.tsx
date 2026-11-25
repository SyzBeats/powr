import { createFileRoute } from '@tanstack/react-router';

import { ExerciseDetailScreen } from '../../../features/library/ExerciseDetailScreen';

export const Route = createFileRoute('/explore/exercises/$exerciseId')({ component: Page });

function Page() {
  const { exerciseId } = Route.useParams();
  return <ExerciseDetailScreen key={exerciseId} exerciseId={exerciseId} />;
}
