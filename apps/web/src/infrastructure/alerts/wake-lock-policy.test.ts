import { describe, expect, it, vi } from 'vitest';

import { fakeLifecycle } from './test-support';
import { createWakeLockPolicy, type WakeLockApi } from './wake-lock-policy';

function fakeApi(outcome: 'grant' | Error = 'grant') {
  const sentinels: { released: boolean; onRelease: (() => void) | null }[] = [];
  const request = vi.fn<WakeLockApi['request']>(async () => {
    if (outcome instanceof Error) throw outcome;
    const sentinel = { released: false, onRelease: null as (() => void) | null };
    sentinels.push(sentinel);
    return {
      release: async () => {
        sentinel.released = true;
        sentinel.onRelease?.();
      },
      addEventListener: (_type: 'release', listener: () => void) => {
        sentinel.onRelease = listener;
      },
    };
  });
  const api: WakeLockApi = { request };
  /** The browser releases the lock itself (page hidden). */
  const browserRelease = () => {
    const last = sentinels.at(-1);
    if (last && !last.released) {
      last.released = true;
      last.onRelease?.();
    }
  };
  return { api, request, sentinels, browserRelease };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('screen wake lock policy (§8.8.3, PWA-06, SET-10)', () => {
  it('holds while a session UI is mounted and visible; re-acquires after the page was hidden', async () => {
    const { api, request, sentinels, browserRelease } = fakeApi();
    const lifecycle = fakeLifecycle();
    const log = vi.fn<(state: string, reason: string | null) => void>();
    const policy = createWakeLockPolicy({ api, lifecycle, log });
    expect(policy.status()).toMatchObject({ supported: true, state: 'off' });

    const release = policy.hold();
    await flush();
    expect(policy.status().state).toBe('held');

    lifecycle.set('hidden');
    browserRelease();
    expect(policy.status().state).toBe('released');
    lifecycle.set('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(policy.status().state).toBe('held');

    release();
    await flush();
    expect(sentinels.at(-1)?.released).toBe(true);
    expect(policy.status().state).toBe('off');
    expect(lifecycle.listeners()).toBe(0);
    expect(log).toHaveBeenCalledWith('held', null);
  });

  it('releases when the setting is switched off and acquires again when it is on', async () => {
    const { api, sentinels } = fakeApi();
    const policy = createWakeLockPolicy({ api, lifecycle: fakeLifecycle() });
    policy.hold();
    await flush();
    policy.setEnabled(false);
    await flush();
    expect(sentinels[0]?.released).toBe(true);
    expect(policy.status()).toMatchObject({ enabled: false, state: 'off' });
    policy.setEnabled(true);
    await flush();
    expect(policy.status()).toMatchObject({ enabled: true, state: 'held' });
  });

  it('reports a refusal with its reason and does not retry in a loop', async () => {
    const refused = Object.assign(new Error('Battery saver'), { name: 'NotAllowedError' });
    const { api, request } = fakeApi(refused);
    const lifecycle = fakeLifecycle();
    const policy = createWakeLockPolicy({ api, lifecycle });
    policy.hold();
    await flush();
    await flush();
    expect(policy.status()).toMatchObject({ state: 'denied', reason: 'NotAllowedError' });
    expect(request).toHaveBeenCalledTimes(1);
    lifecycle.set('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not request while hidden or without a holder', async () => {
    const { api, request } = fakeApi();
    const lifecycle = fakeLifecycle('hidden');
    const policy = createWakeLockPolicy({ api, lifecycle });
    policy.setEnabled(true);
    policy.hold();
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it('reports "unsupported" without the API', () => {
    const policy = createWakeLockPolicy({ api: null, lifecycle: fakeLifecycle() });
    policy.hold();
    expect(policy.status()).toMatchObject({ supported: false, state: 'unsupported' });
  });
});
