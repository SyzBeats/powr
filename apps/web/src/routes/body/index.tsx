import { createFileRoute } from '@tanstack/react-router';

import { BodyScreen } from '../../features/body/BodyScreen';

export const Route = createFileRoute('/body/')({ component: BodyScreen });
