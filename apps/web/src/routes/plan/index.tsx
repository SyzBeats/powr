import { createFileRoute } from '@tanstack/react-router';

import { PlanScreen } from '../../features/plan/PlanScreen';
import { validateWeekSearch } from '../../features/search';

export const Route = createFileRoute('/plan/')({
  validateSearch: validateWeekSearch,
  component: PlanRoute,
});

function PlanRoute() {
  const { week } = Route.useSearch();
  return <PlanScreen week={week} />;
}
