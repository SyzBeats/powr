/**
 * Platform capabilities (§5.5, §8.8). Every optional capability reports support honestly;
 * callers degrade gracefully when it is missing.
 */
export interface WakeLockPort {
  readonly supported: boolean;
  acquire(): Promise<'held' | 'denied' | 'unsupported'>;
  release(): Promise<void>;
}

export interface HapticsPort {
  readonly supported: boolean;
  /** Returns false when the browser refused (no user activation, unsupported). */
  vibrate(pattern: readonly number[]): boolean;
}

export type CueId = 'restEnd' | 'preAlert';

export interface AudioPort {
  /** Creates and resumes the audio context; must run inside a user gesture (autoplay policy). */
  unlock(): Promise<boolean>;
  play(cue: CueId, volume: number): void;
  /**
   * Experimental (S-1 variant E, OQ-T3): keeps quiet audio playing with a media-session entry
   * so the page may stay alive while hidden. Off unless explicitly started.
   */
  startKeepAlive(options: { title: string; gain: number }): Promise<boolean>;
  stopKeepAlive(): void;
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface NotificationPort {
  permission(): NotificationPermissionState;
  request(): Promise<NotificationPermissionState>;
  show(notification: {
    title: string;
    body: string;
    tag: string;
    url: string;
    renotify?: boolean;
    silent?: boolean;
  }): Promise<boolean>;
  closeByTag(tag: string): Promise<void>;
}

/** Hidden-state rest alerts: arms the service-worker timer and dedupes with the page path. */
export interface AlertScheduler {
  armRestEnd(alert: {
    timerId: string;
    endsAtEpochMs: number;
    title: string;
    body: string;
    url: string;
  }): Promise<void>;
  disarm(timerId: string): Promise<void>;
  /** True if this caller is the first path to fire for `timerId`. */
  claimFired(timerId: string, by: 'page' | 'sw'): Promise<boolean>;
  firedBy(timerId: string): Promise<{ by: 'page' | 'sw'; at: number } | undefined>;
}

/** Local diagnostics ring buffer (§8.17); never contains training data or free text. */
export interface DiagnosticsPort {
  readonly log: (
    level: 'debug' | 'info' | 'error',
    code: string,
    data?: Record<string, string | number | boolean | null>,
  ) => void;
  readonly exportAll: () => Promise<{ fileName: string; text: string }>;
}

export type CapabilityValue = string | number | boolean | null;

/** Feature-detection results grouped for display and diagnostics export (§8.23, spike S-2). */
export interface CapabilityReport {
  readonly probedAt: string;
  readonly groups: readonly {
    readonly name: string;
    readonly items: readonly { readonly key: string; readonly value: CapabilityValue }[];
  }[];
}

export interface CapabilityProbe {
  probe(): Promise<CapabilityReport>;
}
