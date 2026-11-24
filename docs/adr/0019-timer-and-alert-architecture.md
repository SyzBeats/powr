# ADR-0019: Timer and alert architecture

- Status: Accepted (calibrated by device spike S-1 / V-01; v0.2, 2026-11-24: audio keep-alive decided OQ-T3 = B)
- Date: 2026-11-23
- Related: technical concept §8.8, §6.2; PRD TMR-04…06, PWA-06…08, SET-04, C-10, NG-13, NG-14, OQ-01, R-01, V-01, V-07, TC-03

## Context

The product decision OQ-01 = A fixes the baseline: pure PWA, no native wrapper, Screen Wake Lock during workouts, sound and vibration while visible, a best-effort notification while hidden, and an honest status note in settings. Platform facts:

- There are no scheduled local notifications for serverless PWAs (Notification Triggers ended; PRD P-01).
- Hidden pages' timers are throttled (PRD P-02).
- Chrome on Android freezes background renderers after a 5-minute grace period (Blink intent "Freezing task queues in background on mobile").
- Notifications on Android Chrome and Samsung Internet can only be shown from a service worker.
- Vibration requires prior user activation (MDN BCD notes).
- Wake Lock is available in Chrome Android 84+ and Samsung Internet 14+.

## Options considered

| Criterion (weight) | C: timestamp timers + multi-path best-effort hidden alerts + honest status | A: timestamp timers, visible-only alerts | B: C + background audio keep-alive by default |
|---|---|---|---|
| Alert reliability when hidden (3) | 4 | 2 | 5 (expected; unverified) |
| Fit with the OQ-01 decision and honesty (3) | 5 | 5 | 2 (changes UX and battery profile) |
| Battery and energy (2) | 3 | 5 | 2 |
| Implementation simplicity (2) | 4 | 5 | 2 |
| Platform risk (2) | 4 | 2 | 3 |
| **Total (max 60)** | **49** | 45 | 35 |

A native wrapper is excluded by C-10/NG-14 and was not scored.

## Decision

1. **Timers are timestamps** (`startedAtEpochMs`, target, adjustments) persisted in the session record; the display anchors to the monotonic clock while alive and recomputes on every visibility or lifecycle event.
2. **Visible:** Web Audio synthesized cues (no audio files), vibration patterns, visual state and a polite live region; the wake lock is held while a session is active and its UI is visible.
3. **Hidden:** arm (a) a one-shot page timeout, (b) a service-worker `waitUntil` timer for rests ending within 5 minutes, and (c) notifications via `showNotification` ("Resting – ends at hh:mm" on hide, "Rest over" at the end), deduplicated through a `fired` flag in `powr-runtime` and the notification tag `rest`.
4. **Honest status** from runtime detection combined with a shipped capability matrix compiled from device-test records; the default without a record is "Limited (best effort)".
5. **Audio keep-alive (decided 2026-11-24, OQ-T3 = B):** tested in S-1 (variant E) on the S22 with Chrome and Samsung Internet. It ships only if it clearly works: the "Supported" rule (≥ 95% of runs alert within 2 s for rests ≤ 5 min with the screen locked) is met and battery use is acceptable. Even then it ships only as an opt-in Labs setting, off by default.

## Consequences

- Positive: timers are always correct when the user looks; alerts while hidden work as well as the platform allows, without servers.
- Negative: alerts with the screen locked remain best effort and may fail on some devices, browsers or battery-saver settings (accepted with OQ-01; risk R-01, T-13).
- Follow-up: after S-1, update this ADR with the measured matrix and the final status texts.
