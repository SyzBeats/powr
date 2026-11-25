import { createFileRoute } from '@tanstack/react-router';

import { NewCustomExerciseScreen } from '../../../features/library/CustomExerciseScreen';
import { validateNewCustomSearch } from '../../../features/library/search';

export const Route = createFileRoute('/explore/exercises/new')({
  validateSearch: validateNewCustomSearch,
  component: Page,
});

function Page() {
  const { from } = Route.useSearch();
  return <NewCustomExerciseScreen key={from ?? ''} from={from ?? null} />;
}
