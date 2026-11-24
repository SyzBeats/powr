import type { AlertScheduler, RuntimeFlags } from '@powr/application';

import type { PageToSwMessage } from '../../sw/protocol';
import { claimRuntimeFlag, getRuntimeValue, setRuntimeValue } from '../runtime-db';

export const runtimeFlags: RuntimeFlags = {
  setActiveSession: (value) => setRuntimeValue('activeSession', value),
};

async function postToServiceWorker(message: PageToSwMessage): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const worker = registration?.active;
  if (!worker) return false;
  worker.postMessage(message);
  return true;
}

export const alertScheduler: AlertScheduler = {
  async armRestEnd(alert) {
    await postToServiceWorker({ type: 'ARM_REST', ...alert });
  },
  async disarm(timerId) {
    await postToServiceWorker({ type: 'DISARM', timerId });
  },
  claimFired: (timerId, by) => claimRuntimeFlag(`fired:${timerId}`, { by, at: Date.now() }),
  firedBy: (timerId) => getRuntimeValue(`fired:${timerId}`),
};
