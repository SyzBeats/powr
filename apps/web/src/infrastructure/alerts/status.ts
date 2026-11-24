import type { NotificationPermissionState } from '@powr/application';

import { currentBrowser, type BrowserFamily, type BrowserInfo, type DisplayMode } from './browser';
import shippedMatrix from './capability-matrix.json' with { type: 'json' };

/**
 * Honest status (technical concept §8.8.5, TMR-06, SET-04, PWA-13): "Alerts while screen is
 * locked: Supported / Limited / Not supported" from runtime detection combined with the shipped
 * capability matrix (`capability-matrix.json`, compiled by `tools/capability-matrix` from S-1
 * device-test records). Without a matching record the answer is "Limited (best effort)": it never
 * claims a reliability that device tests did not show.
 */
export type AlertLevel = 'supported' | 'limited' | 'not-supported';

/** The S-1 variant the app runs: C (page + service worker), D (C + resting notice), E (Labs). */
export type ProductionVariant = 'C' | 'D' | 'E';

/** One compiled matrix cell (format owned by tools/capability-matrix). */
export interface MatrixEntry {
  readonly family: BrowserFamily;
  readonly minMajor: number;
  /** Last major version the result is assumed to hold for; null = open-ended. */
  readonly maxMajor: number | null;
  readonly platform: 'android' | 'other';
  readonly displayMode: DisplayMode;
  readonly condition: 'locked' | 'switched';
  readonly batterySaver: boolean;
  readonly variant: 'A' | 'B' | 'C' | 'D' | 'E';
  readonly device: string;
  readonly runs: number;
  readonly onTime: number;
  readonly late: number;
  readonly missed: number;
  readonly status: AlertLevel;
  /** Placeholder rows (no real device test) never count. */
  readonly placeholder: boolean;
}

export interface CapabilityMatrix {
  readonly matrixVersion: 1;
  readonly entries: readonly MatrixEntry[];
}

export interface AlertCapabilities {
  readonly serviceWorker: boolean;
  readonly notificationApi: boolean;
  readonly showNotification: boolean;
  readonly permission: NotificationPermissionState;
  readonly browser: BrowserInfo;
}

export type AlertStatusReason =
  /** The matrix decides (a device test for this browser, mode and variant exists). */
  | 'tested'
  /** No device-test record matches: Limited (best effort). */
  | 'untested'
  /** Notifications are not allowed yet: at most Limited until the user allows them. */
  | 'permission-needed'
  /** Notifications are blocked in the browser's site settings. */
  | 'permission-denied'
  /** No service worker or notification API: nothing can alert while hidden. */
  | 'unsupported';

export interface AlertStatusReport {
  readonly level: AlertLevel;
  readonly reason: AlertStatusReason;
  /** The device-test result used, if any (worst of battery saver on and off). */
  readonly tested: {
    readonly level: AlertLevel;
    readonly device: string;
    readonly runs: number;
    readonly onTime: number;
  } | null;
  readonly runtime: AlertCapabilities;
}

const RANK: Record<AlertLevel, number> = { 'not-supported': 0, limited: 1, supported: 2 };
const worse = (a: AlertLevel, b: AlertLevel): AlertLevel => (RANK[a] <= RANK[b] ? a : b);

/** Variants whose screen-locked result stands for the variant the app runs. */
const FALLBACK: Record<ProductionVariant, readonly MatrixEntry['variant'][]> = {
  C: ['C', 'D'],
  D: ['D', 'C'],
  E: ['E'],
};

/** The screen-locked device-test result for this browser, or null (pure; unit-tested). */
export function lookupMatrix(
  matrix: CapabilityMatrix,
  browser: BrowserInfo,
  variant: ProductionVariant,
): AlertStatusReport['tested'] {
  if (browser.major === null) return null;
  const major = browser.major;
  const matching = matrix.entries.filter(
    (entry) =>
      !entry.placeholder &&
      entry.condition === 'locked' &&
      entry.family === browser.family &&
      entry.platform === browser.platform &&
      entry.displayMode === browser.displayMode &&
      entry.minMajor <= major &&
      (entry.maxMajor === null || major <= entry.maxMajor),
  );
  for (const candidate of FALLBACK[variant]) {
    const cells = matching.filter((entry) => entry.variant === candidate);
    if (cells.length === 0) continue;
    // Battery saver cannot be detected: the worse result of the two counts (never over-claim).
    const level = cells.map((cell) => cell.status).reduce(worse);
    const used = cells.find((cell) => cell.status === level) ?? cells[0]!;
    return { level, device: used.device, runs: used.runs, onTime: used.onTime };
  }
  return null;
}

export function alertStatus(
  runtime: AlertCapabilities,
  matrix: CapabilityMatrix,
  variant: ProductionVariant,
): AlertStatusReport {
  const report = (level: AlertLevel, reason: AlertStatusReason, tested = lookup()) => ({
    level,
    reason,
    tested,
    runtime,
  });
  function lookup() {
    return lookupMatrix(matrix, runtime.browser, variant);
  }
  if (!runtime.serviceWorker || !runtime.notificationApi || !runtime.showNotification) {
    return report('not-supported', 'unsupported', null);
  }
  if (runtime.permission === 'unsupported') return report('not-supported', 'unsupported', null);
  if (runtime.permission === 'denied') return report('not-supported', 'permission-denied');
  const tested = lookup();
  if (tested?.level === 'not-supported') return report('not-supported', 'tested', tested);
  if (runtime.permission === 'default') return report('limited', 'permission-needed', tested);
  return tested ? report(tested.level, 'tested', tested) : report('limited', 'untested', null);
}

function detectRuntime(permission?: NotificationPermissionState): AlertCapabilities {
  return {
    serviceWorker: 'serviceWorker' in navigator,
    notificationApi: 'Notification' in globalThis,
    showNotification:
      typeof ServiceWorkerRegistration !== 'undefined' &&
      'showNotification' in ServiceWorkerRegistration.prototype,
    permission:
      permission ?? ('Notification' in globalThis ? Notification.permission : 'unsupported'),
    browser: currentBrowser(),
  };
}

/** The status for this browser now (Settings → Alerts). Loaded lazily with the matrix. */
export function detectAlertStatus(
  variant: ProductionVariant,
  permission?: NotificationPermissionState,
): AlertStatusReport {
  return alertStatus(detectRuntime(permission), shippedMatrix as CapabilityMatrix, variant);
}
