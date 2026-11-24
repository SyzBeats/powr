import { createRouter } from '@tanstack/react-router';

import { routeTree } from '../routeTree.gen';
import type { Container } from './container';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  // Provided by <RouterProvider context={…}> in App.tsx.
  context: { container: undefined as unknown as Container },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
