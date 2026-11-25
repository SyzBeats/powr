import { createFileRoute } from '@tanstack/react-router';

import { LogPastSessionScreen } from '../../../features/session/past/LogPastSessionScreen';

export const Route = createFileRoute('/session/past/new')({ component: LogPastSessionScreen });
