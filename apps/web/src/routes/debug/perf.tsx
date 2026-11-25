import { createFileRoute } from '@tanstack/react-router';

import { isEnabled } from '../../feature-flags';
import { PerfTools } from '../../features/debug/PerfTools';
import { NotFound } from '../../features/shell/NotFound';

export const Route = createFileRoute('/debug/perf')({ component: DebugPerfRoute });

function DebugPerfRoute() {
  return isEnabled('debugTools') ? <PerfTools /> : <NotFound />;
}
