import { create } from 'zustand';

/** Ephemeral cross-screen UI state (§8.5). Persisted data never lives here. */
interface AppUiState {
  offlineReady: boolean;
  updateAvailable: boolean;
  debug: boolean;
}

export const useAppUi = create<AppUiState>(() => ({
  offlineReady: false,
  updateAvailable: false,
  debug: false,
}));
