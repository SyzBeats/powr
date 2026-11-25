import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../app/route-search';
import { ExerciseProgressScreen } from '../../features/progress/ExerciseProgressScreen';
import { validateExerciseSearch, type ExerciseSearch } from '../../features/progress/search';

export const Route = createFileRoute('/progress/exercise/$exerciseId')({
  validateSearch: deferredSearch<ExerciseSearch>(),
  component: Page,
});

function Page() {
  const { exerciseId } = Route.useParams();
  const { source } = validateExerciseSearch(Route.useSearch());
  return <ExerciseProgressScreen key={exerciseId} exerciseId={exerciseId} source={source} />;
}
