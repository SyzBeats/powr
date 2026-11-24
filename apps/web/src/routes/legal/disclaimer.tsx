import { createFileRoute } from '@tanstack/react-router';

import { DisclaimerScreen } from '../../features/legal/LegalScreens';

export const Route = createFileRoute('/legal/disclaimer')({ component: DisclaimerScreen });
