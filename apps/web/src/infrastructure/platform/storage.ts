import type { StoragePort } from '@powr/application';

/** navigator.storage with honest fallbacks where the API is missing (§8.23). */
export const browserStorage: StoragePort = {
  persisted: async () => (navigator.storage?.persisted ? navigator.storage.persisted() : false),
  requestPersist: async () => (navigator.storage?.persist ? navigator.storage.persist() : false),
  estimate: async () => {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return usage === undefined || quota === undefined ? null : { usage, quota };
  },
};
