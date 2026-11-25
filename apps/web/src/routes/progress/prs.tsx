import { createFileRoute } from '@tanstack/react-router';

import { PrHistoryScreen } from '../../features/progress/PrHistoryScreen';
import { validatePrSearch } from '../../features/progress/search';

export const Route = createFileRoute('/progress/prs')({
  validateSearch: validatePrSearch,
  component: Page,
});

function Page() {
  const { type, exercise } = Route.useSearch();
  return <PrHistoryScreen type={type} exercise={exercise} />;
}
