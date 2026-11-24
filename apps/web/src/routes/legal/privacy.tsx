import { createFileRoute } from '@tanstack/react-router';

import { PrivacyScreen } from '../../features/legal/LegalScreens';

export const Route = createFileRoute('/legal/privacy')({ component: PrivacyScreen });
