import { createFileRoute } from '@tanstack/react-router';

import { isEnabled } from '../../feature-flags';
import { AlertsHarness } from '../../features/debug/AlertsHarness';
import { NotFound } from '../../features/shell/NotFound';

export const Route = createFileRoute('/debug/alerts')({ component: DebugAlertsRoute });

function DebugAlertsRoute() {
  return isEnabled('debugTools') ? <AlertsHarness /> : <NotFound />;
}
