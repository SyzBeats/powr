import type { WakeLockPort } from '@powr/application';

let sentinel: WakeLockSentinel | null = null;

export const wakeLock: WakeLockPort = {
  supported: 'wakeLock' in navigator,
  async acquire() {
    if (!('wakeLock' in navigator)) return 'unsupported';
    try {
      sentinel = await navigator.wakeLock.request('screen');
      return 'held';
    } catch {
      // Battery saver, policy or a hidden page; the caller shows the reason (§8.8.3).
      return 'denied';
    }
  },
  async release() {
    await sentinel?.release();
    sentinel = null;
  },
};
