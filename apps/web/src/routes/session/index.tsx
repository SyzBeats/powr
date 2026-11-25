import { createFileRoute } from '@tanstack/react-router';

import { validateSessionSearch } from '../../features/session/search';
import { SessionScreen } from '../../features/session/SessionScreen';

export const Route = createFileRoute('/session/')({
  validateSearch: validateSessionSearch,
  component: SessionRoute,
});

function SessionRoute() {
  const { start } = Route.useSearch();
  return <SessionScreen startToday={start === 'today'} />;
}
