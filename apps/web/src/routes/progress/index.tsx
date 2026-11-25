import { createFileRoute } from '@tanstack/react-router';

import { ProgressScreen } from '../../features/progress/ProgressScreen';

export const Route = createFileRoute('/progress/')({ component: ProgressScreen });
