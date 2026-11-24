import { createFileRoute } from '@tanstack/react-router';

import { NextMesocycleScreen } from '../../features/plan/NextMesocycleScreen';

export const Route = createFileRoute('/plan/next')({ component: NextMesocycleScreen });
