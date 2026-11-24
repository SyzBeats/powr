import { createFileRoute } from '@tanstack/react-router';

import { LogSetScreen } from '../features/session/LogSetScreen';
import { validateSessionSearch } from '../features/session/search';

export const Route = createFileRoute('/session')({
  validateSearch: validateSessionSearch,
  component: LogSetScreen,
});
