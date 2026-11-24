import { createFileRoute } from '@tanstack/react-router';

import { isEnabled } from '../../feature-flags';
import { CapabilityProbe } from '../../features/debug/CapabilityProbe';
import { NotFound } from '../../features/shell/NotFound';

export const Route = createFileRoute('/debug/capabilities')({ component: DebugCapabilitiesRoute });

function DebugCapabilitiesRoute() {
  return isEnabled('debugTools') ? <CapabilityProbe /> : <NotFound />;
}
