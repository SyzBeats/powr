import { createFileRoute } from '@tanstack/react-router';

import { ScoresScreen } from '../../features/progress/ScoresScreen';

export const Route = createFileRoute('/progress/scores')({ component: ScoresScreen });
