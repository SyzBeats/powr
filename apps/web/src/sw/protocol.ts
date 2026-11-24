/** Messages between the page and the service worker. Shared by both builds; types only. */
export type PageToSwMessage =
  | { readonly type: 'SKIP_WAITING' }
  | { readonly type: 'GET_BUILD' }
  | {
      readonly type: 'ARM_REST';
      readonly timerId: string;
      readonly endsAtEpochMs: number;
      readonly title: string;
      readonly body: string;
      /** Where a notification tap should lead. */
      readonly url: string;
    }
  | { readonly type: 'DISARM'; readonly timerId: string };

export type SwToPageMessage = { readonly type: 'BUILD'; readonly build: string };

/** Notification tag shared by all rest alerts, so at most one is ever visible (§8.8.4). */
export const REST_NOTIFICATION_TAG = 'rest';

/** Chromium ends service-worker events that run longer than this (§8.8.4). */
export const MAX_SW_TIMER_MS = 5 * 60 * 1000;
