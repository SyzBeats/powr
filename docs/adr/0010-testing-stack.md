# ADR-0010: Testing stack

- Status: Accepted (v0.3, 2026-11-24: E2E test server, see below; amended v0.5)
- Date: 2026-11-23, amended 2026-11-24
- Related: technical concept §8.20, §10.2; PRD NFR-MNT-02/03/05, NFR-A11Y-11, TC-13, M9–M12

## Context

The PRD requires reference-vector tests for all calculations, migration tests for all historical versions, E2E tests for onboarding, a full workout, offline mode, the update flow and interruption recovery, accessibility audits, and a manual device protocol. There is no telemetry, so automated tests are the main quality signal. Tests must run in CI without paid services.

Facts checked 2026-11-23: vitest 5.1.1 with `@vitest/browser-playwright` 5.1.1 (MIT), fast-check 4.11.0 (MIT), @testing-library/react 16.3.3 and user-event 14.6.13 (MIT), @playwright/test 1.65.1 (Apache-2.0), axe-core 4.14.1 and @axe-core/playwright 4.14.0 (MPL-2.0, test-only), fake-indexeddb 6.2.8 (Apache-2.0), jest 30.5.2 (MIT), cypress 16.3.0 (MIT).

## Options considered

Unit and component tests:

| Criterion (weight) | Vitest 5 | Jest 30 |
|---|---|---|
| Fit with Vite / ESM / TS (3) | 5 | 2 |
| Maintenance (2) | 5 | 4 |
| Speed (2) | 5 | 3 |
| Real-browser component testing (2) | 4 | 1 |
| Solo productivity (2) | 5 | 3 |
| **Total (max 55)** | **53** | 28 |

End-to-end tests:

| Criterion (weight) | Playwright | Cypress |
|---|---|---|
| Android emulation, service worker and offline control (3) | 5 | 3 |
| Maintenance (2) | 5 | 4 |
| Speed (1) | 4 | 3 |
| Multi-context, process kill, clock API (2) | 5 | 2 |
| Solo productivity (2) | 5 | 4 |
| **Total (max 50)** | **49** | 32 |

## Decision

- **Vitest 5** for unit, property (with **fast-check**), content, rules and migration tests (Node environment, `fake-indexeddb` for Dexie), and **Vitest browser mode** with the Playwright provider for component tests (**Testing Library**, **user-event**, **axe-core**).
- **Playwright** for E2E against the production build with the service worker, served from the same nginx container image that is deployed (v0.2, ADR-0011), so the real headers and cache rules are tested: Chromium with Android device emulation; offline via `context.setOffline`; update flow by swapping builds on the test server; interruption by closing contexts and killing the browser; Playwright's clock API for timers; a network-log privacy test; axe scans.
- **Reference suites** copy EB tables into fixtures with section references (NFR-MNT-02).
- **Manual device protocol** on the Galaxy S22 (Chrome, Samsung Internet) and one other Android phone before each release.
- axe-core's MPL-2.0 licence is acceptable because it is a test-only tool that is never distributed; it is recorded in the inventory as `distributed: false` (ADR-0018).

## Consequences

- Positive: one runner for all JavaScript tests, sharing Vite's config and transforms; real Chromium for components and E2E; deterministic property tests with fixed seeds in CI and random seeds nightly.
- Negative: emulated Chromium is not a Galaxy S22; device-specific behaviour (alerts, freezing, Samsung Internet) relies on the manual protocol (technical debt TD-04).
- Runner-up: Jest + Cypress (not recommended; listed for completeness).

## Amendment (v0.3, 2026-11-24)

- **E2E test server.** Playwright runs against `apps/web/e2e/static-server.ts`, which serves `dist` with the headers read from `deploy/security-headers.conf` and with nginx's cache rules and SPA fallback. Each test gets its own server and origin, so tests can stop the server (offline) or deploy version N+1 on the same origin (update gate). `vite preview` was not used because it sends no CSP. The same suite runs against the nginx image with `E2E_BASE_URL` (tests that stop or swap the server are skipped there); CI does both.
- Every E2E test fails on any CSP violation and on any request to another origin or any non-GET request (QS-06).
- **Not built in M0:** Vitest browser-mode component tests with Testing Library and the Lingui pseudo-locale expansion test (M1, TD-11).

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.

## Amendment (v0.5, 2026-11-24)

The decision stands. Component tests exist since M2b (TD-11): Vitest browser mode (`@vitest/browser-playwright` 5.1.1, real Chromium) with Testing Library 16.3, user-event 14.6 and axe-core 4.14 (a development-only MPL-2.0 dependency the licence policy allows). The project reuses the app's Vite configuration (Lingui, React Compiler, Tailwind), renders at 360 × 780 and runs the screens against the real container and a real IndexedDB; it is part of `pnpm test`. The Lingui expansion test (+30%) builds its own expanded catalog, because Lingui's pseudo-locale only accents characters (technical concept §8.15, §8.20). The E2E suite runs axe in both themes on every new screen and reflow checks at 320 px and 200% text. Because the component tests run in a real Chromium, the CI `test` job runs `pnpm --filter @powr/web exec playwright install --with-deps chromium` before `pnpm test`.

v0.5 also folds in the M2 tooling (TD-09 native Lingui macro, TD-10 native React Compiler lint rules, TD-12 Lighthouse CI and Trusted Types in dev/E2E) and the Sentry package block list. For this ADR:

- **The E2E server enforces Trusted Types.** `e2e/static-server.ts` appends `require-trusted-types-for 'script'; trusted-types powr-sw` (defined once in `apps/web/scripts/trusted-types.ts`) to the CSP from `deploy/security-headers.conf` (`startStaticServer({ trustedTypes })`, on by default). Every E2E test therefore runs with Trusted Types enforced, and the fixture's CSP-violation check covers them. `e2e/trusted-types.spec.ts` passes the first-run gate (`skipOnboarding`), then asserts the header, the registered service worker, and that string script sinks, an unknown policy and a second `powr-sw` policy throw. It is skipped against the nginx image, which does not send the directives until TD-03. The production headers in `deploy/` are unchanged.
- **Lighthouse CI with per-environment baselines.** `apps/web/scripts/lighthouse.ts` (`pnpm lighthouse`) runs Lighthouse CI 0.16.1 (Lighthouse 13.6.0, mobile preset, 3 runs, median) against the production build, served by the same test server with `trustedTypes: false`, so exactly with the production headers. FCP, LCP, Speed Index, TTI and TBT fail at more than 20% above the stored baseline, with a minimum margin of 100 ms (TTI 150 ms). Baselines are kept per environment in `apps/web/lighthouse-baseline.json` (`local`, later `ci`), because simulated throttling scales the CPU time of the measuring machine. Without a baseline a run only reports. The CI job `lighthouse` runs on `main`, nightly and on demand, never on pull requests. Lighthouse CI is not part of `pnpm verify` and is not a device measurement (technical concept §8.19, §8.21).

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M2b screens" and "M2 tooling (TD-09, TD-10, TD-12)".
