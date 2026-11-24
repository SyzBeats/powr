# ADR-0014: Router: TanStack Router

- Status: Accepted
- Date: 2026-11-23
- Related: technical concept §8.9.1; PRD PWA-05, PWA-12, NFR-PERF-04, ANL-02/11

## Context

The SPA needs stable deep links for shortcuts and reloads (PWA-05, PWA-12), typed search params for filters and chart ranges, route-level code splitting, navigation blockers so the Android back gesture never discards unsaved edits, and guards (onboarding, legal acknowledgement). Facts checked 2026-11-23: `@tanstack/react-router` 1.170.46 (MIT, about 30 KB gzipped) with `@tanstack/router-plugin` (Vite ≥ 6); `react-router` 8.5.2 (MIT, about 63 KB gzipped full).

## Options considered

| Criterion (weight) | TanStack Router | React Router 8 |
|---|---|---|
| Fit with React + TS (3) | 5 | 5 |
| Maintenance and community (2) | 5 | 5 |
| Bundle size (2) | 4 | 3 |
| Type safety of params and search (2) | 5 | 3 |
| Features: blockers, validated search params, code splitting (2) | 5 | 4 |
| Solo productivity (2) | 4 | 5 |
| **Total (max 65)** | **61** | 55 |

## Decision

Use **TanStack Router** with file-based routes (Vite plugin), lazy route components, Zod-validated search params, `beforeLoad` guards (legal acknowledgement, onboarding) and `useBlocker` for unsaved edits. Back from `/session` navigates to Home while the session continues.

## Consequences

- Positive: compile-time safety for every link and search param; state in URLs makes shortcuts and reloads deterministic.
- Negative: smaller community than React Router; acceptable given active maintenance.
- Runner-up: **React Router 8** (data mode).
