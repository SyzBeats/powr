import { createFileRoute } from '@tanstack/react-router';

import { EditCustomExerciseScreen } from '../../../features/library/CustomExerciseScreen';

export const Route = createFileRoute('/explore/exercises/edit/$exerciseId')({ component: Page });

function Page() {
  const { exerciseId } = Route.useParams();
  return <EditCustomExerciseScreen key={exerciseId} exerciseId={exerciseId} />;
}
