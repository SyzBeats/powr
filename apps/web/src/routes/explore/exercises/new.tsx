import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../../app/route-search';
import { NewCustomExerciseScreen } from '../../../features/library/CustomExerciseScreen';
import { validateNewCustomSearch, type NewCustomSearch } from '../../../features/library/search';

export const Route = createFileRoute('/explore/exercises/new')({
  validateSearch: deferredSearch<NewCustomSearch>(),
  component: Page,
});

function Page() {
  const { from } = validateNewCustomSearch(Route.useSearch());
  return <NewCustomExerciseScreen key={from ?? ''} from={from ?? null} />;
}
