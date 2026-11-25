import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../app/route-search';
import { PlanScreen } from '../../features/plan/PlanScreen';
import { validateWeekSearch, type WeekSearch } from '../../features/search';

export const Route = createFileRoute('/plan/')({
  validateSearch: deferredSearch<WeekSearch>(),
  component: PlanRoute,
});

function PlanRoute() {
  const { week } = validateWeekSearch(Route.useSearch());
  return <PlanScreen week={week} />;
}
