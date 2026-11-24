import { createFileRoute } from '@tanstack/react-router';

import { ProgressScreen } from '../features/placeholder/screens';

export const Route = createFileRoute('/progress')({ component: ProgressScreen });
