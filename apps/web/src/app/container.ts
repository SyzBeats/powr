import type {
  AlertScheduler,
  CapabilityProbe,
  Deps,
  HapticsPort,
  NotificationPort,
  WakeLockPort,
} from '@powr/application';
import { customizableCatalog, isCustomizable, type ContentCatalog } from '@powr/content';
import type { CompiledRules } from '@powr/rules';

import type { TimerKit } from '../infrastructure/alerts';
import { capabilityProbe } from '../infrastructure/capabilities/probe';
import {
  createLiveQueries,
  createSafetySnapshots,
  createUnitOfWork,
  type PowrDb,
} from '../infrastructure/db';
import { createDiagnostics, type Diagnostics } from '../infrastructure/diagnostics/log';
import { systemClock } from '../infrastructure/platform/clock';
import { downloadGateway } from '../infrastructure/platform/files';
import { haptics } from '../infrastructure/platform/haptics';
import { uuidv7Generator } from '../infrastructure/platform/ids';
import { notifications } from '../infrastructure/platform/notifications';
import { alertScheduler, runtimeFlags } from '../infrastructure/platform/runtime-flags';
import { browserStorage } from '../infrastructure/platform/storage';
import { applyTheme } from '../infrastructure/platform/theme';
import { wakeLock } from '../infrastructure/platform/wake-lock';
import type { ServiceWorkerController } from '../infrastructure/pwa/registration';
import { createRulesProvider } from '../infrastructure/rules/provider';

const APP = { version: __APP_VERSION__, build: __APP_BUILD__ } as const;

// Timer and alert types for hooks and screens (hooks reach infrastructure only through here).
export type {
  AlertEvent,
  AlertLevel,
  AlertOptions,
  AlertPath,
  AlertStatusReport,
  MetronomeState,
  RestAlertTexts,
  TempoPhase,
  TimerDisplay,
  TimerKit,
  TimerState,
  WakeLockStatus,
} from '../infrastructure/alerts';

/**
 * The timer and alert kit, loaded on first use (product-owner decision 2026-11-24, §8.19): the
 * timer engine, the Web Audio cues, the wake-lock policy and the rest-alert scheduler stay off
 * the startup path until a session starts or resumes, Settings → Alerts or the debug harness
 * opens. `current()` is null until `load()` resolved. `load()` always returns the same promise;
 * once it resolved it carries React's `status: 'fulfilled'` and `value`, so `use(load())` reads
 * the kit without suspending again.
 */
export interface TimerKitLoader {
  readonly current: () => TimerKit | null;
  readonly load: () => Promise<TimerKit>;
}

function lazyTimerKit(create: () => Promise<TimerKit>): TimerKitLoader {
  let kit: TimerKit | null = null;
  let loading: Promise<TimerKit> | null = null;
  return {
    current: () => kit,
    load: () => {
      if (loading) return loading;
      // React's thenable fields: `use()` returns `value` at once while `status` is 'fulfilled'.
      const promise: Promise<TimerKit> & { status?: 'fulfilled'; value?: TimerKit } = create().then(
        (created) => {
          kit = created;
          promise.status = 'fulfilled';
          promise.value = created;
          return created;
        },
      );
      loading = promise;
      return promise;
    },
  };
}

/** Platform capabilities used by screens through hooks; never touched directly by features. */
export interface Platform {
  readonly wakeLock: WakeLockPort;
  readonly haptics: HapticsPort;
  readonly notifications: NotificationPort;
  /** Low level: service-worker `ARM_REST`/`DISARM` and the `fired:` flags (§8.8.4). */
  readonly alerts: AlertScheduler;
  /**
   * Timer display engine, Web Audio cues, rest-alert scheduler, wake-lock policy, honest status
   * (§8.8, M3t), loaded lazily (M3b).
   */
  readonly timers: TimerKitLoader;
  readonly capabilities: CapabilityProbe;
  readonly applyTheme: typeof applyTheme;
  readonly downloadText: (name: string, text: string) => void;
  /** Developer harness state that must survive a page kill (spike S-1); never user data. */
  readonly debugStore: {
    load(key: string): unknown;
    save(key: string, value: unknown): void;
  };
}

/** The composition root (§5.3): the one place where ports are bound to adapters. */
export interface Container {
  readonly deps: Deps;
  readonly platform: Platform;
  readonly diagnostics: Diagnostics;
  readonly serviceWorker: ServiceWorkerController;
}

export function createContainer(
  db: PowrDb,
  content: ContentCatalog,
  rules: CompiledRules,
  serviceWorker: ServiceWorkerController,
  diagnostics: Diagnostics,
): Container {
  const deps: Deps = {
    uow: createUnitOfWork(db),
    queries: createLiveQueries(db),
    clock: systemClock,
    ids: uuidv7Generator,
    // EXL-04 (M4a): the user's custom exercises merge into the catalog (`loadCustomExercises`).
    content: isCustomizable(content) ? content : customizableCatalog(content),
    rules: createRulesProvider(rules),
    app: APP,
    runtime: runtimeFlags,
    storage: browserStorage,
    files: downloadGateway,
    safety: createSafetySnapshots(),
  };
  const platform: Platform = {
    wakeLock,
    haptics,
    notifications,
    alerts: alertScheduler,
    timers: lazyTimerKit(async () => {
      const { createTimerKit } = await import('../infrastructure/alerts');
      return createTimerKit({
        haptics,
        notifications,
        transport: alertScheduler,
        log: diagnostics.log,
      });
    }),
    capabilities: capabilityProbe,
    applyTheme,
    downloadText: (name, text) =>
      void downloadGateway.save({
        name,
        bytes: new TextEncoder().encode(text),
        mime: 'text/plain',
      }),
    debugStore,
  };
  return { deps, platform, diagnostics, serviceWorker };
}

const debugStore: Platform['debugStore'] = {
  load(key) {
    try {
      return JSON.parse(localStorage.getItem(`powr.debug.${key}`) ?? 'null');
    } catch {
      return null;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(`powr.debug.${key}`, JSON.stringify(value));
    } catch {
      // Quota or private mode: the harness still works for this page.
    }
  },
};

export function createAppDiagnostics(): Diagnostics {
  return createDiagnostics({
    app: APP,
    context: async () => ({ capabilities: await capabilityProbe.probe() }),
  });
}
