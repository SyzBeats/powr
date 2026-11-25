import { useContainer } from '../app/container-context';
import { useAppUi } from '../app/ui-store';

export function useOfflineReady(): boolean {
  return useAppUi((state) => state.offlineReady);
}

export function useDebugMode(): boolean {
  return useAppUi((state) => state.debug);
}

/** Update prompt state (PWA-04). Applying is refused while a session is active. */
export function useAppUpdate() {
  const { serviceWorker } = useContainer();
  const updateAvailable = useAppUi((state) => state.updateAvailable);
  const updateDeferred = useAppUi((state) => state.updateDeferred);
  return {
    updateAvailable,
    updateDeferred,
    applyUpdate: () => serviceWorker.applyUpdate(),
    /** TD-64: "Start without updating"; the banner still offers the update after the workout. */
    deferUpdate: () => useAppUi.setState({ updateDeferred: true }),
  };
}

export function usePlatform() {
  return useContainer().platform;
}

/** "Reload" after another window updated or deleted the database (§6.8, TD-14). */
export function useStaleWindow(): boolean {
  return useAppUi((state) => state.staleWindow);
}

export function useDiagnostics() {
  const { diagnostics, platform, serviceWorker } = useContainer();
  return {
    log: diagnostics.log,
    recent: diagnostics.recent,
    async exportToFile() {
      const { fileName, text } = await diagnostics.exportAll();
      platform.downloadText(fileName, text);
    },
    resetAppFiles: async () => {
      await serviceWorker.resetAppFiles();
      location.reload();
    },
  };
}

export const APP_INFO = {
  version: __APP_VERSION__,
  build: __APP_BUILD__,
  releaseTarget: __RELEASE_TARGET__,
} as const;
