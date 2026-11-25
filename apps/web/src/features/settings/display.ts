import { useEffect } from 'react';

import { useDisplayPreferences } from '../../hooks/use-settings';

/**
 * SET-10 (M5s) large-controls mode: while the workout screen is shown, the dock's controls grow
 * from 48 to 56 px and its text by a step (`[data-large-controls]` in app.css).
 */
export function useLargeControls(): void {
  const { largeControls } = useDisplayPreferences();
  useEffect(() => {
    const root = document.documentElement;
    if (largeControls) root.dataset['largeControls'] = 'true';
    else delete root.dataset['largeControls'];
    return () => {
      delete root.dataset['largeControls'];
    };
  }, [largeControls]);
}
