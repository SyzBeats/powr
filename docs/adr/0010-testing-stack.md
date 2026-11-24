# ADR-0010: Testing stack

- Status: Accepted
- Date: 2026-11-23
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
