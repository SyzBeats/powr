# ADR-0005: State management: Dexie liveQuery + Zustand + URL state + pure session reducer

- Status: Accepted
- Date: 2026-11-23
- Related: technical concept §8.5, §6.2; PRD WKT-02/03/12/14, TMR-12, NFR-PERF-03

## Context

Almost all application state is persisted in IndexedDB (raw logs and derived caches) and must update the UI when it changes, including changes written by the engine worker. A small amount of state is ephemeral but crosses screens (optimistic pending set, celebration queue, undo token, update-available flag, install-prompt event, capability snapshot). The active workout session has complex transitions (sets, rests, supersets, undo, substitutions) and must survive process kill, so its state of record must be in the database, not in memory.

Registry facts (2026-11-23): Zustand 5.1.0 (MIT, < 1 KB gzipped), Jotai 3.0.2 (MIT), Redux Toolkit 2.15.0 (MIT), Dexie 4.4.7 with `liveQuery` and `dexie-react-hooks` 4.4.0 (Apache-2.0).

## Options considered

| Criterion (weight) | Dexie `liveQuery` + Zustand | Dexie `liveQuery` + Jotai | TanStack Query over Dexie + Zustand | Redux Toolkit (+ listeners) |
|---|---|---|---|---|
| Fit with React + TS and the data model (3) | 5 | 5 | 4 | 4 |
| Maintenance and community (2) | 5 | 5 | 5 | 5 |
| Bundle size (2) | 5 | 5 | 3 | 3 |
| Solo productivity (3) | 5 | 4 | 4 | 3 |
| Testability (2) | 4 | 4 | 4 | 5 |
| **Total (max 60)** | **58** | 55 | 48 | 47 |

TanStack Query mainly solves server-cache problems (staleness, refetching) that a local database with live queries does not have. Redux adds ceremony without a server to synchronize with.

## Decision

1. **Persisted state:** repositories expose `observe*()` observables built on Dexie `liveQuery`; React reads them via a `useObservable` hook (`useSyncExternalStore`). Cross-context updates (engine worker writes) propagate automatically.
2. **Ephemeral cross-screen state:** Zustand stores (`appUi`, `sessionUi`). Persisted data is never copied into them except short-lived optimistic overlays.
3. **View state:** TanStack Router search params, validated with Zod.
4. **Active session:** a pure reducer in `@powr/application/session` returns the new `Session` plus effect descriptions; an infrastructure effect runner persists and triggers timers, cues and celebrations.
5. **Forms:** React Hook Form.

## Consequences

- Positive: one source of truth (the DB); interruption recovery is trivial; reducer and invariants are property-testable.
- Positive: minimal library surface.
- Negative: `liveQuery` re-runs whole queries on change; queries must be scoped (by session, exercise, week) and charts must read derived tables, not raw sets.
- Runner-up: Jotai instead of Zustand if atom-level composition becomes useful.
