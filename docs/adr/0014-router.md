# ADR-0014: Router: TanStack Router

- Status: Accepted (amended v0.8: search params validated by plain functions; the M4 routes)
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

## Amendment (v0.8, 2026-11-25)

The decision stands. As built (technical concept §8.9.1):

- **Search params** are validated by plain typed functions, not Zod (since v0.4: route definitions are on the startup path and Zod is not, TD-17); unknown parameters are dropped.
- **M4 routes** are nested file routes under `src/routes/explore/` (hub, `body-map`, `body-map/$muscleId`, `exercises`, `exercises/$exerciseId`, `exercises/new`, `exercises/edit/$exerciseId`), `src/routes/progress/` (hub, `exercise/$exerciseId`, `compare`, `volume`, `prs`, `calendar`, `scores`, `streak`) and `src/routes/body/` (`/body`, `/body/log`). Filters, modes and chart choices that matter for a reload or a shared link (for example the body map's week mode or list view) live in search params.
- **The body map's muscle panel (MAP-02) is a route of its own** rather than a sheet over the map, so it has its own heading, Back and a deep link, and its follow-up actions (placing an exercise in the plan, "Why?") do not stack dialogs.

Source: `IMPLEMENTATION_NOTES.md` (repository root), section "M4b insight screens".

## Amendment (v0.9, 2026-11-25)

The decision stands. As built in M5 (technical concept §8.9.1):

- **Search validation moved into the lazy route chunks (TD-63).** TanStack Router reads `validateSearch` from the route definition before it loads the route's chunk, so even small plain validators were entry JS for every launch. The definitions now take `deferredSearch<T>()` (`app/route-search.ts`): typed for links and `navigate` through `SearchSchemaInput`, a pass-through at runtime, and `Route.useSearch()` returns `RawSearch<T>` with every value `unknown`. The route's component, which the router plugin splits, validates with the route's own validator, so the types still force validation before use.
- **M5 routes:** `/data`, `/plan/calendar`, `/settings/device-support`, `/settings/rest`, `/settings/exercises`, `/settings/profile/$answer`, and one `/legal/$page` for the five legal pages (one definition instead of three; the URLs stayed).
- **Back and sheets (PWA-12):** an open sheet owns one same-URL history entry, so Back closes it before leaving the screen. TanStack's browser history batches the writes of one task into a single native write, so code that pushes after a replace calls `history.flush()` between them (the launch seeding).

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M5d data, calendar and PWA", "M5s settings, legal and explainability" and "M5z bundle trim, fixes and docs".
