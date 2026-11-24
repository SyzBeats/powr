import { createFileRoute } from '@tanstack/react-router';

import { PlanScreen } from '../features/placeholder/screens';

export const Route = createFileRoute('/plan')({ component: PlanScreen });
