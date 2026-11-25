import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../app/route-search';
import { validateSessionSearch, type SessionSearch } from '../../features/session/search';
import { SessionScreen } from '../../features/session/SessionScreen';

export const Route = createFileRoute('/session/')({
  validateSearch: deferredSearch<SessionSearch>(),
  component: SessionRoute,
});

function SessionRoute() {
  const { start } = validateSessionSearch(Route.useSearch());
  return <SessionScreen startToday={start === 'today'} />;
}
