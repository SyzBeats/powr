import { createFileRoute } from '@tanstack/react-router';

import { ExploreScreen } from '../../features/library/ExploreScreen';

export const Route = createFileRoute('/explore/')({ component: ExploreScreen });
