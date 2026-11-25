import { createFileRoute } from '@tanstack/react-router';

import { isEnabled } from '../../feature-flags';
import { BodyMapDemo } from '../../features/debug/BodyMapDemo';
import { NotFound } from '../../features/shell/NotFound';

export const Route = createFileRoute('/debug/body-map')({ component: DebugBodyMapRoute });

function DebugBodyMapRoute() {
  return isEnabled('debugTools') ? <BodyMapDemo /> : <NotFound />;
}
