import { createFileRoute } from '@tanstack/react-router';

import { isEnabled } from '../../feature-flags';
import ChartsDemo from '../../features/debug/ChartsDemo';
import { NotFound } from '../../features/shell/NotFound';

export const Route = createFileRoute('/debug/charts')({ component: DebugChartsRoute });

function DebugChartsRoute() {
  return isEnabled('debugTools') ? <ChartsDemo /> : <NotFound />;
}
