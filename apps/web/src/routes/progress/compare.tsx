import { createFileRoute } from '@tanstack/react-router';

import { CompareScreen } from '../../features/progress/CompareScreen';
import { validateCompareSearch } from '../../features/progress/search';

export const Route = createFileRoute('/progress/compare')({
  validateSearch: validateCompareSearch,
  component: Page,
});

function Page() {
  const { ids } = Route.useSearch();
  return <CompareScreen ids={ids} />;
}
