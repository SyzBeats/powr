import { useEffect, useMemo, useState } from 'react';

import type { CapabilityReport } from '@powr/application';

import { useContainer } from '../app/container-context';
import { useAppUi } from '../app/ui-store';

/*
 * Install promotion and device support (PWA-02, PWA-13). Only lazy screens import this file, so
 * none of it is on the startup path; the deferred prompt itself is captured at boot.
 */

/** Runtime feature detection (§8.23) for the device-support screen (PWA-13). Null while probing. */
export function useCapabilityReport(): CapabilityReport | null {
  const { platform } = useContainer();
  const [report, setReport] = useState<CapabilityReport | null>(null);
  useEffect(() => {
    let cancelled = false;
    void platform.capabilities.probe().then((next) => {
      if (!cancelled) setReport(next);
    });
    return () => {
      cancelled = true;
    };
  }, [platform]);
  return report;
}

/** No re-offer within this many days after "Not now" (PWA-02). */
export const INSTALL_SNOOZE_DAYS = 14;

/**
 * Install promotion (PWA-02): the deferred `beforeinstallprompt` (Chrome), Samsung Internet's
 * menu path as the fallback, whether POWR already runs installed, and the dismissal.
 */
export function useInstall() {
  const { platform, diagnostics } = useContainer();
  const deferred = useAppUi((state) => state.installPrompt);
  const installedNow = useAppUi((state) => state.installed);
  const standalone = useMemo(() => matchMedia('(display-mode: standalone)').matches, []);
  const samsung = useMemo(() => /\bSamsungBrowser\//.test(navigator.userAgent), []);
  return {
    /** The browser offered its own install dialog (Chrome). */
    available: deferred !== null,
    installed: installedNow || standalone,
    samsung,
    firstVisit: platform.install.firstVisit,
    /** Dismissed less than {@link INSTALL_SNOOZE_DAYS} days ago. */
    snoozed: () => {
      const at = platform.install.dismissedAt();
      return at !== null && Date.now() - at < INSTALL_SNOOZE_DAYS * 86_400_000;
    },
    dismiss: () => platform.install.dismiss(),
    /** Opens the browser's install dialog; 'unavailable' without a deferred prompt. */
    prompt: async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
      if (!deferred) return 'unavailable';
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // A prompt can be used once; Chrome fires a new event later if it still applies.
      useAppUi.setState({ installPrompt: null });
      diagnostics.log('info', 'install.prompt', { outcome });
      return outcome;
    },
  };
}
