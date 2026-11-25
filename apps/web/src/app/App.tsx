import { CSPProvider } from '@base-ui/react/csp-provider';
import { I18nProvider } from '@lingui/react';
import { RouterProvider } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import { i18n } from '../i18n';
import type { Container } from './container';
import { ContainerContext } from './container-context';
import { router } from './router';
import { useAppUi } from './ui-store';

/** "Delete all data" (DAT-13) replaces the whole app; a lazy chunk, like every screen. */
const DataDeletedScreen = lazy(() => import('../features/data/DataDeletedScreen'));

export function App({ container }: { container: Container }) {
  // Once deleting starts, nothing may read the database again: the router (and every live
  // query under it) unmounts until the user starts again with a reload.
  const wiping = useAppUi((state) => state.wipe !== null);
  return (
    <I18nProvider i18n={i18n}>
      {/* Base UI must not inject <style> elements: the CSP has no 'unsafe-inline' (§7.3). */}
      <CSPProvider disableStyleElements>
        <ContainerContext value={container}>
          {wiping ? (
            <Suspense fallback={null}>
              <DataDeletedScreen />
            </Suspense>
          ) : (
            <RouterProvider router={router} context={{ container }} />
          )}
        </ContainerContext>
      </CSPProvider>
    </I18nProvider>
  );
}
