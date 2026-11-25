import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../../app/route-search';
import { MuscleScreen } from '../../../features/bodymap/MuscleScreen';
import { validateMuscleSearch, type MuscleSearch } from '../../../features/bodymap/search';

export const Route = createFileRoute('/explore/body-map/$muscleId')({
  validateSearch: deferredSearch<MuscleSearch>(),
  component: Page,
});

function Page() {
  const { muscleId } = Route.useParams();
  const search = validateMuscleSearch(Route.useSearch());
  return <MuscleScreen key={muscleId} muscleId={muscleId} search={search} />;
}
