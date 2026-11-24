import { createFileRoute } from '@tanstack/react-router';

import { ExploreScreen } from '../features/placeholder/screens';

export const Route = createFileRoute('/explore')({ component: ExploreScreen });
