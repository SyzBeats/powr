import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../app/route-search';
import { CalendarScreen } from '../../features/progress/CalendarScreen';
import { validateCalendarSearch, type CalendarSearch } from '../../features/progress/search';

export const Route = createFileRoute('/progress/calendar')({
  validateSearch: deferredSearch<CalendarSearch>(),
  component: Page,
});

function Page() {
  const { month } = validateCalendarSearch(Route.useSearch());
  return <CalendarScreen month={month} />;
}
