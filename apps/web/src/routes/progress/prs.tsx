import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../app/route-search';
import { PrHistoryScreen } from '../../features/progress/PrHistoryScreen';
import { validatePrSearch, type PrSearch } from '../../features/progress/search';

export const Route = createFileRoute('/progress/prs')({
  validateSearch: deferredSearch<PrSearch>(),
  component: Page,
});

function Page() {
  const { type, exercise } = validatePrSearch(Route.useSearch());
  return <PrHistoryScreen type={type} exercise={exercise} />;
}
