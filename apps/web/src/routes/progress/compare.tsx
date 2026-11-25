import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../app/route-search';
import { CompareScreen } from '../../features/progress/CompareScreen';
import { validateCompareSearch, type CompareSearch } from '../../features/progress/search';

export const Route = createFileRoute('/progress/compare')({
  validateSearch: deferredSearch<CompareSearch>(),
  component: Page,
});

function Page() {
  const { ids } = validateCompareSearch(Route.useSearch());
  return <CompareScreen ids={ids} />;
}
