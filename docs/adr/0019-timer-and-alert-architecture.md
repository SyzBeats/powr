# ADR-0019: Timer and alert architecture

- Status: Accepted (calibrated by device spike S-1 / V-01; v0.2, 2026-11-24: audio keep-alive decided OQ-T3 = B; amended v0.7: implemented in M3, matrix empty until S-1)
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

## Amendment (v0.7, 2026-11-24)

The decision stands and is implemented (M3t, wired to the session screens in M3b; technical concept §8.8, §6.2). The follow-up ("update this ADR with the measured matrix and the final status texts") still waits for S-1.

- **As built:** a timer engine that keeps monotonic time while the page is visible (a device clock change does not move a timer; the jump is logged) and rebuilds its anchor from the wall clock on `visible`, `pageshow` and `resume`, because Android's monotonic clock stops in deep sleep; a 4 Hz ticker that does nothing while hidden; a rest-alert scheduler that arms the page timeout, the service-worker timer (rests ending within 5 minutes; a longer rest is armed 5 minutes before its end) and the notifications for **every timer kind**, deduplicated by `fired:<timerId>@<end>` so that a rest extended after it ended alerts again; Web Audio cues including a `gentle` cue on return after a rest ended while away; a reference-counted wake-lock policy; one polite live region in the shell; the honest status from runtime detection and the shipped matrix.
- **Deviations:** the service worker claims the `fired` flag only when it can show a notification (otherwise the page still beeps); the silent "Resting – ends at …" notification carries no vibration pattern (Chromium rejects it); the matrix is keyed by browser family, version range, platform, display mode, condition, battery saver and variant, a cell holds for 2 later majors, the worse battery-saver result counts, C and D stand for each other, and "Supported" needs ≥ 3 runs (accepted by the product owner, 2026-11-24).
- **Decision (product owner, 2026-11-24): the alert code loads on first use.** The timer kit (engine, ticker, scheduler facade, wake-lock policy, cues) leaves the entry chunk and loads when a session starts or resumes, Settings → Alerts or the debug harness opens, or boot finds an active session (so interruption recovery re-arms the alerts right after boot); the live region stays in the shell. Entry JS target ≤ about 179 KB, budget 186 KB unchanged. **Measured (M3b):** entry JS 182.73 → 177.34 KB gzip with the kit as a 3.3 KB lazy chunk (plus the 2.1 KB scheduler and 0.9 KB status chunks); the first wave went from 15 scripts to 1 (one startup chunk, technical concept §8.19).
- **Decision (product owner, 2026-11-24): alert defaults.** Pre-alert on with a selectable time of 5, 10 or 15 s (default 10 s), 3-2-1 off, the "Resting" notice on, volume 80%, keep screen on, the gentle cue on return, locked-screen alerts for every timer kind.
- **Decision (product owner, 2026-11-24): records.** The machine records (harness exports) stay in `tools/capability-matrix/records/`, compiled by `pnpm capability-matrix` into `apps/web/src/infrastructure/alerts/capability-matrix.json`; the human-readable protocol and results template are `docs/device-tests/S-1-protocol.md`. The audio keep-alive (variant E) is a device-local runtime flag that only the harness can switch on; it gets no user-facing toggle until S-1 shows it works.
- **Status today:** S-1 has not run, so the matrix is empty and every browser shows "Limited (best effort)" (technical concept TD-38).

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M3t timers and alerts" and "M3b session screens".
