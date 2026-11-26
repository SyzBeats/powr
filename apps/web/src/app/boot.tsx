import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  loadCustomExercises,
  reconcileRuntimeFlags,
  requestPersistentStorage,
} from '@powr/application';
import type { ContentCatalog } from '@powr/content';
import { DATA_VERSION } from '@powr/formats';
import { rulesStamp } from '@powr/rules';

import { activateLocale } from '../i18n';
import { PowrDb } from '../infrastructure/db';
import {
  guardFreshStart,
  observedIndexedDB,
  sharedDataMarker,
  storedDataPresent,
  type DataLoss,
} from '../infrastructure/db/data-guard';
import { pendingUpgrade } from '../infrastructure/db/stored-version';
import { applyTheme, storedTheme } from '../infrastructure/platform/theme';
import { captureInstallPrompt } from '../infrastructure/pwa/install';
import type { ServiceWorkerController } from '../infrastructure/pwa/registration';
import { loadBuiltInRules } from '../infrastructure/rules/provider';
import { App } from './App';
import { createAppDiagnostics, createContainer, type Container } from './container';
import { resolveDebugMode } from './debug-mode';
import { seedLaunchHistory } from './launch';
import { router } from './router';
import { StartupError } from './StartupError';
import { useAppUi, type DeferredInstallPrompt } from './ui-store';

/** Boot sequence (§6.7): theme is already applied by theme-init.js before first paint. */
export async function boot(rootElement: HTMLElement): Promise<void> {
  // PWA-02: the browser's install prompt fires early; keep it for a meaningful moment.
  captureInstallPrompt({
    onPrompt: (event) => useAppUi.setState({ installPrompt: event as DeferredInstallPrompt }),
    onInstalled: () => useAppUi.setState({ installPrompt: null, installed: true }),
  });
  const locale = activateLocale();
  useAppUi.setState({ debug: resolveDebugMode(location.search) });

  const root = createRoot(rootElement);
  const diagnostics = createAppDiagnostics();
  installErrorLogging(diagnostics);

  // The built-in content and the rules data are lazy chunks (§8.19, TD-17, TD-31) and load in
  // parallel with the database.
  const contentLoad = loadBuiltInContent();
  const rulesLoad = loadBuiltInRules();
  const guard = {
    root,
    diagnostics,
    versions: async () => {
      const [content, rules] = await Promise.allSettled([contentLoad, rulesLoad]);
      return {
        content: content.status === 'fulfilled' ? content.value.version : 'unknown',
        rules: rules.status === 'fulfilled' ? rulesStamp(rules.value) : 'unknown',
      };
    },
  };

  // DAT-14 (§6.7 step 3): a data update runs only after a safety copy of the stored data. The
  // guard is a lazy chunk, loaded only when the stored database is older than the code.
  // M6d: the data marker is read alongside (a file read; `data-guard.ts`).
  const marker = sharedDataMarker();
  const [pending, marked] = await Promise.all([
    pendingUpgrade(),
    withTimeout(marker.load(), () => marker.present()),
  ]);
  if (pending) {
    await locale.catch(() => undefined);
    const { prepareUpgrade } = await import('./upgrade');
    if (!(await prepareUpgrade(guard, pending))) return;
  }

  // DB gate: open (and upgrade, §8.2.3) before anything reads data. M6d: never start fresh over
  // lost data (`data-guard.ts`): while the marker says the database held data, or this page has
  // seen it, Dexie may not create it from scratch, at boot or when it reopens a connection the
  // browser closed.
  let dataExisted = marked;
  let created: DataLoss | null = null;
  const db = new PowrDb({
    indexedDB: observedIndexedDB(indexedDB, (dataLoss) => {
      created = dataLoss;
    }),
  });
  let started = false;
  // The `localStorage` copy also covers data stored by this page's own first run (onboarding).
  const freshStart = guardFreshStart(
    db,
    () => dataExisted || marker.present(),
    () => {
      diagnostics.log('error', 'db.missing', {
        phase: started ? 'running' : 'boot',
        existing: false,
        dataLoss: created ?? 'unknown',
      });
      // While the app runs, the browser closed the connection and the data is gone: the recovery
      // screen replaces the app (at boot, the failed open below shows it).
      if (started)
        void import('./upgrade').then(({ showRecovery }) => showRecovery(guard, 'missing'));
    },
  );
  const openedAt = performance.now();
  const [opened, content, rules, catalog] = await Promise.allSettled([
    db.open().then(() => Math.round(performance.now() - openedAt)),
    contentLoad,
    rulesLoad,
    // The UI catalog is a lazy chunk too (§8.19).
    locale,
  ]);
  const failed = (code: 'content.error' | 'rules.error' | 'i18n.error', error: unknown) => {
    diagnostics.log('error', code, { name: error instanceof Error ? error.name : 'unknown' });
    root.render(<StartupError />);
  };
  if (opened.status === 'rejected') {
    const { showRecovery } = await import('./upgrade');
    // M6d: the database held data and is gone; the guard refused to start fresh.
    if (freshStart.refused()) return showRecovery(guard, 'missing');
    // §6.8: a failed upgrade is rolled back by IndexedDB; never delete, offer a copy instead.
    const error: unknown = opened.reason;
    diagnostics.log('error', 'db.error', { name: error instanceof Error ? error.name : 'unknown' });
    showRecovery(guard, pending ? 'upgrade' : 'open');
    return;
  }
  if (created !== null) {
    // A new database: a first run, or (with `dataLoss: total`) the browser dropped a damaged one.
    diagnostics.log(created === 'total' ? 'error' : 'info', 'db.created', { dataLoss: created });
  }
  // M6d: an existing database without the data the marker remembers is not a first run either;
  // one that cannot be read is an open failure (never "no data").
  const present = await storedDataPresent(db).catch(() => null);
  if (present !== true && (present === null || dataExisted)) {
    db.close();
    const { showRecovery } = await import('./upgrade');
    if (present === null) {
      diagnostics.log('error', 'db.error', { name: 'ReadError' });
      return showRecovery(guard, 'open');
    }
    diagnostics.log('error', 'db.missing', { phase: 'boot', existing: true, dataLoss: 'none' });
    return showRecovery(guard, 'missing');
  }
  if (present) {
    dataExisted = true;
    void marker.set();
  }
  // §6.8: another window updated the database; this one lets go and asks for a reload.
  db.on('versionchange', () => {
    diagnostics.log('info', 'db.versionchange');
    useAppUi.setState({ staleWindow: true });
  });
  if (content.status === 'rejected') return failed('content.error', content.reason);
  if (rules.status === 'rejected') return failed('rules.error', rules.reason);
  if (catalog.status === 'rejected') return failed('i18n.error', catalog.reason);
  diagnostics.log('info', 'db.open', { ms: opened.value, dataVersion: DATA_VERSION });

  const serviceWorker = lazyServiceWorker(diagnostics);
  const container = createContainer(db, content.value, rules.value, serviceWorker, diagnostics);
  await reconcileStartupState(container);
  // PWA-12: a shortcut or deep link opened as the first page gets Home beneath it, so Back
  // goes up the hierarchy instead of closing the app.
  seedLaunchHistory(router, location, history.length);

  root.render(
    <StrictMode>
      <App container={container} />
    </StrictMode>,
  );
  started = true;
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

/** The marker's file read may not hold up the start: after a second, `localStorage` decides. */
function withTimeout(load: Promise<boolean>, fallback: () => boolean): Promise<boolean> {
  return Promise.race([
    load,
    new Promise<boolean>((resolve) => setTimeout(() => resolve(fallback()), 1_000)),
  ]);
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
  // EXL-04: custom exercises behave like built-in ones from the first screen on.
  await loadCustomExercises(container.deps);
  // The settings table is the source of truth for the theme (it survives restore).
  const settings = await container.deps.uow.read(['settings'], (repos) => repos.settings.get());
  if (settings && settings.theme !== storedTheme()) applyTheme(settings.theme);
}

/**
 * Defers registration until after first paint while handing out a stable controller now. The
 * registration code is a lazy chunk too (TD-63): nothing before the first screen needs it.
 */
function lazyServiceWorker(
  diagnostics: Container['diagnostics'],
): ServiceWorkerController & { start(): void } {
  let controller: ServiceWorkerController | null = null;
  let starting: Promise<void> | null = null;
  const register = async () => {
    const { registerServiceWorker } = await import('../infrastructure/pwa/registration');
    controller = registerServiceWorker({
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
  };
  return {
    start() {
      starting ??= register().catch((error: unknown) =>
        diagnostics.log('error', 'sw.error', {
          name: error instanceof Error ? error.name : 'unknown',
        }),
      );
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
