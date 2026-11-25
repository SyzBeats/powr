import { createFileRoute } from '@tanstack/react-router';

import { RestTimesScreen } from '../../features/settings/RestTimesScreen';

export const Route = createFileRoute('/settings/rest')({ component: RestTimesScreen });
