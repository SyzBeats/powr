import type {
  AlertScheduler,
  AudioPort,
  CapabilityProbe,
  Deps,
  HapticsPort,
  NotificationPort,
  WakeLockPort,
} from '@powr/application';
import { builtInContent } from '@powr/content';
import { RULES_VERSION } from '@powr/rules';

import { capabilityProbe } from '../infrastructure/capabilities/probe';
import {
  createLiveQueries,
  createSafetySnapshots,
  createUnitOfWork,
  type PowrDb,
} from '../infrastructure/db';
import { createDiagnostics, type Diagnostics } from '../infrastructure/diagnostics/log';
import { audio } from '../infrastructure/platform/audio';
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

const APP = { version: __APP_VERSION__, build: __APP_BUILD__ } as const;

/** Platform capabilities used by screens through hooks; never touched directly by features. */
export interface Platform {
  readonly wakeLock: WakeLockPort;
  readonly haptics: HapticsPort;
  readonly audio: AudioPort;
  readonly notifications: NotificationPort;
  readonly alerts: AlertScheduler;
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
  serviceWorker: ServiceWorkerController,
  diagnostics: Diagnostics,
): Container {
  const deps: Deps = {
    uow: createUnitOfWork(db),
    queries: createLiveQueries(db),
    clock: systemClock,
    ids: uuidv7Generator,
    content: builtInContent(),
    rulesVersion: RULES_VERSION,
    app: APP,
    runtime: runtimeFlags,
    storage: browserStorage,
    files: downloadGateway,
    safety: createSafetySnapshots(),
  };
  const platform: Platform = {
    wakeLock,
    haptics,
    audio,
    notifications,
    alerts: alertScheduler,
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
