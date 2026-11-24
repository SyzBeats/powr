import { CSPProvider } from '@base-ui/react/csp-provider';
import { I18nProvider } from '@lingui/react';
import { RouterProvider } from '@tanstack/react-router';

import { i18n } from '../i18n';
import type { Container } from './container';
import { ContainerContext } from './container-context';
import { router } from './router';

export function App({ container }: { container: Container }) {
  return (
    <I18nProvider i18n={i18n}>
      {/* Base UI must not inject <style> elements: the CSP has no 'unsafe-inline' (§7.3). */}
      <CSPProvider disableStyleElements>
        <ContainerContext value={container}>
          <RouterProvider router={router} />
        </ContainerContext>
      </CSPProvider>
    </I18nProvider>
  );
}
