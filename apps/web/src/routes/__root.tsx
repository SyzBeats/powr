import { createRootRouteWithContext } from '@tanstack/react-router';

import { guardFirstRun } from '../app/first-run';
import type { RouterContext } from '../app/router-context';
import { AppShell } from '../features/shell/AppShell';
import { NotFound } from '../features/shell/NotFound';
import { RouteError } from '../features/shell/RouteError';

export const Route = createRootRouteWithContext<RouterContext>()({
  // First-run guard (ONB-01, ONB-12): legal acknowledgement and onboarding come first.
  beforeLoad: ({ context, location }) => guardFirstRun(context.container, location.pathname),
  component: AppShell,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});
