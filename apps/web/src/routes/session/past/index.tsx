import { createFileRoute } from '@tanstack/react-router';

import { PastSessionsScreen } from '../../../features/session/past/PastSessionsScreen';

export const Route = createFileRoute('/session/past/')({ component: PastSessionsScreen });
