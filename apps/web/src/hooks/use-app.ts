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
  return { updateAvailable, applyUpdate: () => serviceWorker.applyUpdate() };
}

export function usePlatform() {
  return useContainer().platform;
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
