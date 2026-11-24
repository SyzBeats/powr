import { createFileRoute } from '@tanstack/react-router';

import { LogSetScreen } from '../features/session/LogSetScreen';
import { z } from '../zod';

const searchSchema = z.object({ source: z.enum(['shortcut']).optional() });

export const Route = createFileRoute('/session')({
  validateSearch: searchSchema,
  component: LogSetScreen,
});
