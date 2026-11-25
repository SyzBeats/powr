import { createFileRoute } from '@tanstack/react-router';

import type { SessionId } from '@powr/domain';

import { SummaryScreen } from '../../features/session/SummaryScreen';

export const Route = createFileRoute('/session/summary/$sessionId')({
  component: SummaryRoute,
});

function SummaryRoute() {
  const { sessionId } = Route.useParams();
  return <SummaryScreen key={sessionId} sessionId={sessionId as SessionId} />;
}
