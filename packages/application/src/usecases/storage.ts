import { toIsoWithOffset } from '@powr/domain';

import type { Deps } from '../deps';

export type PersistTrigger = 'user' | 'appinstalled' | 'notificationPermission';

/**
 * Asks the browser to protect the origin's storage from eviction (DAT-03) and records the
 * outcome with a timestamp in `meta.persistence`. Chromium decides silently (PRD P-03).
 */
export async function requestPersistentStorage(
  deps: Deps,
  trigger: PersistTrigger,
): Promise<boolean> {
  const granted = await deps.storage.requestPersist();
  const at = toIsoWithOffset(deps.clock.now());
  await deps.uow.write(['meta'], (repos) =>
    repos.meta.put({ key: 'persistence', value: { granted, at, trigger } }),
  );
  return granted;
}

export interface StorageStatus {
  readonly persisted: boolean;
  readonly estimate: { usage: number; quota: number } | null;
}

export async function getStorageStatus(deps: Deps): Promise<StorageStatus> {
  const [persisted, estimate] = await Promise.all([
    deps.storage.persisted(),
    deps.storage.estimate(),
  ]);
  return { persisted, estimate };
}
