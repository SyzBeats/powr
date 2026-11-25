import { createFileRoute } from '@tanstack/react-router';

import type { SessionId } from '@powr/domain';

import { PastSessionEditor } from '../../../features/session/past/PastSessionEditor';

export const Route = createFileRoute('/session/past/$sessionId')({
  component: PastSessionRoute,
});

function PastSessionRoute() {
  const { sessionId } = Route.useParams();
  return <PastSessionEditor key={sessionId} sessionId={sessionId as SessionId} />;
}
