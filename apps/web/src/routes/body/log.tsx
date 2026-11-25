import { createFileRoute } from '@tanstack/react-router';

import { LogBodyScreen } from '../../features/body/LogBodyScreen';
import { validateBodyLogSearch } from '../../features/body/search';

export const Route = createFileRoute('/body/log')({
  validateSearch: validateBodyLogSearch,
  component: LogBodyRoute,
});

function LogBodyRoute() {
  const { what } = Route.useSearch();
  return <LogBodyScreen key={what ?? 'bodyweight'} what={what ?? 'bodyweight'} />;
}
