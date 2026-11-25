# ADR-0005: State management: Dexie liveQuery + Zustand + URL state + pure session reducer

- Status: Accepted (amended v0.7, 2026-11-24: session reducer as built in M3, see below)
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

## Amendment (v0.7, 2026-11-24)

The decision stands. M3 built the active session as decided, with one change of location and a few changes of detail (technical concept §8.5, §6.2, §8.8.7):

- **The reducer lives in the domain:** `reduceSession(state, event, ctx)` and `startSession` are in `@powr/domain/session`, not in `@powr/application/session`, so the domain lint enforces their purity (no `Date`, no I/O). The state is `{ session, sets }` (the logged sets are their own records); time and fresh record IDs come in the context (`ctx.now`, `ctx.ids`), so replays are deterministic. The use cases (`startWorkout`, `dispatch`, `resumeWorkout`, `finishWorkout`, `discardWorkout`, `observeActiveSession`, past sessions) are the lazy entry `@powr/application/session`, loaded with `import()`.
- **Effects:** the application runs `persist` (inside the event's one strict transaction), the plan effects, the service-worker gate (`activeSession`) and the derived-data rebuild at finish (`recompute`); the remaining **platform effects** (`timer.arm`, `timer.disarm`, `wakeLock`, `celebrate`, `cue`, `announce`) go back to the app's effect runner, which maps them onto the timer kit of ADR-0019 and dispatches `TIMER_FIRED` back when an alert fires. The planned `invalidate` effect is not needed: derived tables hold finished sessions only, and the active session's PRs and suggestions are computed from them and its own sets.
- **Undo** is one level, stored in the session record (so it survives a kill) and valid for 30 s; accepted by the product owner on 2026-11-24, with a mesocycle-wide substitution not undoable.
- **View state:** search parameters are validated by small typed functions, not Zod (v0.4, TD-17). **Forms:** React state, no form library and no client schema (v0.5).
- **Ephemeral state:** one small Zustand store, `sessionUi` (`features/session/session-ui.ts`): the resume banner, the runtime guard, "ended while hidden", the PR celebration, the proposals, the hints, a focus-after-confirm flag and the reactive-deload check after a finish; reset on start, finish and discard, lost on reload by design. The undo token is not in it: it lives in the session record and reaches the screen through the live view. The session screen, the shell's session runtime and the global mini timer read the session through **one shared live subscription** per container (`useSessionView` in `hooks/use-workout.ts`).
- The properties named under "Consequences" are property-tested: determinism, a valid cursor that survives persistence, undo restoring the previous state and its timer, no e1RM PR without entered effort, timers never negative after a recovery.

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M3a session core", "M3t timers and alerts" and "M3b session screens".
