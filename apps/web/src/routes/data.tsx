import { createFileRoute } from '@tanstack/react-router';

import { DataScreen } from '../features/data/DataScreen';

export const Route = createFileRoute('/data')({ component: DataScreen });
