import { createFileRoute } from '@tanstack/react-router';

import { CalendarScreen } from '../../features/progress/CalendarScreen';
import { validateCalendarSearch } from '../../features/progress/search';

export const Route = createFileRoute('/progress/calendar')({
  validateSearch: validateCalendarSearch,
  component: Page,
});

function Page() {
  const { month } = Route.useSearch();
  return <CalendarScreen month={month} />;
}
