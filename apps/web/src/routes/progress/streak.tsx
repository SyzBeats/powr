import { createFileRoute } from '@tanstack/react-router';

import { StreakScreen } from '../../features/motivation/StreakScreen';

export const Route = createFileRoute('/progress/streak')({ component: StreakScreen });
