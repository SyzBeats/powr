# ADR-0008: PWA tooling and service-worker strategy

- Status: Accepted
- Date: 2026-11-23
- Related: technical concept §8.4, §6.3, §6.7; PRD PWA-01…05, PWA-03, PWA-04, DAT-14, NFR-REL-08, TC-04

## Context

The app must be installable, fully offline after first load, update without ever interrupting a workout, never run data migrations during an active session, and survive a failed update. The service worker also carries the hidden-state rest alert timer (ADR-0019) and, from v1.3, the share target.

Facts checked 2026-11-23:

- vite-plugin-pwa 2.0.0 (MIT; peer range includes Vite 8; depends on workbox-build 7.4).
- workbox-precaching, workbox-routing and workbox-window 7.4.1 (MIT; last release May 2026).
- serwist and @serwist/vite 9.5.15 (MIT; active Workbox fork; peer `rollup >= 4` alongside Vite).

## Options considered

| Criterion (weight) | vite-plugin-pwa (`injectManifest`) + Workbox | Serwist (`@serwist/vite`) | Hand-written SW + own manifest plugin |
|---|---|---|---|
| Fit with Vite 8 / React (2) | 5 | 4 (Vite 8 + Rolldown to confirm) | 3 |
| Maintenance (3) | 4 | 5 | 5 (no dependency) |
| Control over the update flow (3) | 5 | 5 | 5 |
| Precache correctness (revisions, cleanup) (2) | 5 | 5 | 3 |
| Solo productivity (2) | 5 | 4 | 2 |
| **Total (max 60)** | **57** | 56 | 46 |

`generateSW` mode was not considered, because the install gate and alert messaging need custom code.

## Decision

- **vite-plugin-pwa 2.0 in `injectManifest` mode** with an own `src/sw/service-worker.ts` using `PrecacheController` (workbox-precaching) and a `NavigationRoute` to the precached `index.html`.
- **Precache everything** the app can need (all chunks including lazy routes and the chart chunk, `content` and `rules` JSON, icons, attributions). No runtime caching of other origins (there are none).
- **Prompt-only updates:** `registerType: 'prompt'`. `SKIP_WAITING` is sent only after the user accepts and no session is active. Update checks run on start, on return to the foreground (at most every 6 h), and after a session ends.
- **Install gate:** the `install` handler reads `activeSession` from the `powr-runtime` database and rejects the install before downloading anything while a workout is active. The app calls `registration.update()` when the session ends.
- **Pre-session check:** starting a session while an update is waiting offers "Update first".
- `index.html`, `sw.js`, the manifest, `changelog.json` and `version.json` are served with `Cache-Control: no-cache`; hashed assets are `immutable`.

## Consequences

- Positive: an update can never interrupt a workout in the common case (update published mid-workout), and migrations only run on cold start or after an accepted update.
- Positive: failed installs leave the old version untouched; failed migrations roll back inside IndexedDB (ADR-0006).
- Negative: rare edge case (an update was waiting, the user declined it, then the process was killed mid-session) activates the new version on cold start. Accepted with mitigations (risk T-05); the version-pinning fallback is documented in §6.3.
- Negative: a rejected install wastes one `sw.js` fetch per check; negligible.
- Runner-up: **Serwist**, a drop-in replacement for the Workbox modules if Workbox maintenance stalls.
