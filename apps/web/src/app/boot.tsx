import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { reconcileRuntimeFlags, requestPersistentStorage } from '@powr/application';
import type { ContentCatalog } from '@powr/content';
import { DATA_VERSION } from '@powr/formats';

import { activateLocale } from '../i18n';
import { PowrDb } from '../infrastructure/db';
import { applyTheme, storedTheme } from '../infrastructure/platform/theme';
import {
  registerServiceWorker,
  type ServiceWorkerController,
} from '../infrastructure/pwa/registration';
import { loadBuiltInRules } from '../infrastructure/rules/provider';
import { App } from './App';
import { createAppDiagnostics, createContainer, type Container } from './container';
import { resolveDebugMode } from './debug-mode';
import { StartupError } from './StartupError';
import { useAppUi } from './ui-store';

/** Boot sequence (§6.7): theme is already applied by theme-init.js before first paint. */
export async function boot(rootElement: HTMLElement): Promise<void> {
  const locale = activateLocale();
  useAppUi.setState({ debug: resolveDebugMode(location.search) });

  const root = createRoot(rootElement);
  const diagnostics = createAppDiagnostics();
  installErrorLogging(diagnostics);

  // DB gate: open (and upgrade, §8.2.3) before anything reads data. The built-in content and the
  // rules data are lazy chunks (§8.19, TD-17, TD-31) and load in parallel.
  const db = new PowrDb();
  const openedAt = performance.now();
  const [opened, content, rules, catalog] = await Promise.allSettled([
    db.open().then(() => Math.round(performance.now() - openedAt)),
    loadBuiltInContent(),
    loadBuiltInRules(),
    // The UI catalog is a lazy chunk too (§8.19).
    locale,
  ]);
  const failed = (
    code: 'db.error' | 'content.error' | 'rules.error' | 'i18n.error',
    error: unknown,
  ) => {
    diagnostics.log('error', code, { name: error instanceof Error ? error.name : 'unknown' });
    root.render(<StartupError />);
  };
  if (opened.status === 'rejected') return failed('db.error', opened.reason);
  if (content.status === 'rejected') return failed('content.error', content.reason);
  if (rules.status === 'rejected') return failed('rules.error', rules.reason);
  if (catalog.status === 'rejected') return failed('i18n.error', catalog.reason);
  diagnostics.log('info', 'db.open', { ms: opened.value, dataVersion: DATA_VERSION });

  const serviceWorker = lazyServiceWorker(diagnostics);
  const container = createContainer(db, content.value, rules.value, serviceWorker, diagnostics);
  await reconcileStartupState(container);

  root.render(
    <StrictMode>
      <App container={container} />
    </StrictMode>,
  );
  diagnostics.log('info', 'app.start', {
    releaseTarget: __RELEASE_TARGET__,
    standalone: matchMedia('(display-mode: standalone)').matches,
  });

  // Register after first render so it does not compete with first paint (§6.7). The service
  // worker is a production-build feature; `vite dev` runs without it (§8.4).
  if (import.meta.env.PROD) requestAnimationFrame(() => setTimeout(() => serviceWorker.start(), 0));
  addEventListener('appinstalled', () => {
    void requestPersistentStorage(container.deps, 'appinstalled');
  });
}

/**
 * The content data (`@powr/content/built-in`, about 17 kB gzip) is not part of the entry chunk;
 * the service worker precaches it with every other chunk, so it loads offline too.
 */
async function loadBuiltInContent(): Promise<ContentCatalog> {
  // oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the content
  const { builtInContent } = await import('@powr/content/built-in');
  return builtInContent();
}

async function reconcileStartupState(container: Container): Promise<void> {
  // The service-worker install gate must agree with the database (§8.2.4).
  await reconcileRuntimeFlags(container.deps);
  // The settings table is the source of truth for the theme (it survives restore).
  const settings = await container.deps.uow.read(['settings'], (repos) => repos.settings.get());
  if (settings && settings.theme !== storedTheme()) applyTheme(settings.theme);
}

/** Defers registration until after first paint while handing out a stable controller now. */
function lazyServiceWorker(
  diagnostics: Container['diagnostics'],
): ServiceWorkerController & { start(): void } {
  let controller: ServiceWorkerController | null = null;
  return {
    start() {
      controller ??= registerServiceWorker({
        onOfflineReady: () => {
          useAppUi.setState({ offlineReady: true });
          diagnostics.log('info', 'sw.offlineReady');
        },
        onUpdateAvailable: () => {
          useAppUi.setState({ updateAvailable: true });
          diagnostics.log('info', 'sw.updateAvailable');
        },
        onError: (error) =>
          diagnostics.log('error', 'sw.error', {
            name: error instanceof Error ? error.name : 'unknown',
          }),
      });
    },
    checkForUpdate: async () => controller?.checkForUpdate(),
    applyUpdate: () => controller?.applyUpdate(),
    resetAppFiles: async () => controller?.resetAppFiles(),
  };
}

function installErrorLogging(diagnostics: Container['diagnostics']): void {
  addEventListener('error', (event) => {
    diagnostics.log('error', 'error.unhandled', {
      name: event.error instanceof Error ? event.error.name : 'Error',
      source: `${event.filename.split('/').pop() ?? ''}:${event.lineno}`,
    });
  });
  addEventListener('unhandledrejection', (event) => {
    diagnostics.log('error', 'error.unhandled', {
      name: event.reason instanceof Error ? event.reason.name : 'UnhandledRejection',
      source: 'promise',
    });
  });
}
