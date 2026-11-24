/** Vibration patterns (§8.8.2, PWA-07), in milliseconds: vibrate, pause, vibrate, … */
export const VIBRATION = {
  restEnd: [200, 100, 200],
  preAlert: [80],
  countdown: [40],
  gentle: [60],
  pr: [30, 40, 60],
} as const satisfies Record<string, readonly number[]>;

/** The notification tag shared by every rest notification: at most one is ever visible. */
export { REST_NOTIFICATION_TAG, MAX_SW_TIMER_MS } from '../../sw/protocol';
