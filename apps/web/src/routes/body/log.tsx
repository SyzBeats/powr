import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../app/route-search';
import { LogBodyScreen } from '../../features/body/LogBodyScreen';
import { validateBodyLogSearch, type BodyLogSearch } from '../../features/body/search';

export const Route = createFileRoute('/body/log')({
  validateSearch: deferredSearch<BodyLogSearch>(),
  component: LogBodyRoute,
});

function LogBodyRoute() {
  const { what } = validateBodyLogSearch(Route.useSearch());
  return <LogBodyScreen key={what ?? 'bodyweight'} what={what ?? 'bodyweight'} />;
}
