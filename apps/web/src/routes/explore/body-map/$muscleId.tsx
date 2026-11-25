import { createFileRoute } from '@tanstack/react-router';

import { MuscleScreen } from '../../../features/bodymap/MuscleScreen';
import { validateMuscleSearch } from '../../../features/bodymap/search';

export const Route = createFileRoute('/explore/body-map/$muscleId')({
  validateSearch: validateMuscleSearch,
  component: Page,
});

function Page() {
  const { muscleId } = Route.useParams();
  const search = Route.useSearch();
  return <MuscleScreen key={muscleId} muscleId={muscleId} search={search} />;
}
