import type { HapticsPort } from '@powr/application';

export const haptics: HapticsPort = {
  supported: 'vibrate' in navigator,
  vibrate: (pattern) => ('vibrate' in navigator ? navigator.vibrate([...pattern]) : false),
};
