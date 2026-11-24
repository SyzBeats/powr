import { createRootRoute } from '@tanstack/react-router';

import { AppShell } from '../features/shell/AppShell';
import { NotFound } from '../features/shell/NotFound';
import { RouteError } from '../features/shell/RouteError';

export const Route = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});
