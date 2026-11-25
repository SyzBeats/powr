import { createFileRoute } from '@tanstack/react-router';

import { ExerciseProgressScreen } from '../../features/progress/ExerciseProgressScreen';
import { validateExerciseSearch } from '../../features/progress/search';

export const Route = createFileRoute('/progress/exercise/$exerciseId')({
  validateSearch: validateExerciseSearch,
  component: Page,
});

function Page() {
  const { exerciseId } = Route.useParams();
  const { source } = Route.useSearch();
  return <ExerciseProgressScreen key={exerciseId} exerciseId={exerciseId} source={source} />;
}
