# ADR-0006: IndexedDB library and persistence model: Dexie 4

- Status: Accepted (photo storage revisited after spike S-3b; v0.3, 2026-11-24: amended after M0, see below; amended v0.5, v0.7, v0.9, v0.11)
- Date: 2026-11-23
- Related: technical concept §8.2, §6.3, §6.5, §6.8; PRD DAT-01…04, DAT-14, NFR-REL-01…08, TC-01, TC-14

## Context

All user data stays on the device. Requirements: durable writes within 500 ms of confirmation, atomic multi-record changes (finish session, import, migration), versioned schema migrations with rollback, reactive UI updates, fast queries over 40,000 sets, storage of progress photos from v1.2, and support in Chrome for Android and Samsung Internet.

Facts checked 2026-11-23:

- Dexie 4.4.7 (Apache-2.0, actively released). It exposes `chromeTransactionDurability: 'default' | 'strict' | 'relaxed'` in its constructor options (verified in the 4.4.7 type definitions).
- Chrome changed the IndexedDB default durability to "relaxed" in Chrome 121 (Chrome developer blog).
- `idb` 8.0.4 (ISC).
- `@sqlite.org/sqlite-wasm` 3.54.1 (Apache-2.0).
- OPFS is available in Chrome Android 109+ and Samsung Internet 21+ (MDN BCD 8.1.10).

## Options considered

| Criterion (weight) | Dexie 4 | SQLite WASM on OPFS (worker) | idb 8 (thin wrapper) |
|---|---|---|---|
| Fit with React + TS (2) | 4 | 3 | 4 |
| Maintenance and community (2) | 4 | 5 | 3 |
| Bundle size / cold start (2) | 4 | 1 (WASM ≈ several hundred KB, async init) | 5 |
| Transactions, migrations, integrity (3) | 4 | 5 | 3 |
| Reactive queries (3) | 5 | 1 | 1 |
| Solo productivity (3) | 5 | 3 | 2 |
| **Total (max 75)** | **66** | 45 | 42 |

## Decision

- **Dexie 4.4** for the main database `powr`. All raw writes use **strict durability**; derived caches use relaxed durability.
- Separate small databases: `powr-runtime` (flags shared with the service worker; frozen schema), `powr-safety` (safety snapshots), `powr-diag` (diagnostics). The service worker never opens `powr`, so it can never block a version upgrade.
- `dataVersion` equals the Dexie version. Record migrations are pure functions in `@powr/formats`, shared with backup import (ADR-0013). Upgrades run inside the `versionchange` transaction, so failures roll back automatically; a safety snapshot is taken before.
- Raw tables hold the truth; derived tables are rebuildable and stamped with engine, rules and content versions.
- **Photos (v1.2)** are stored as IndexedDB Blobs in a `photoBlobs` table, behind a `PhotoStore` port. Spike S-3b compares IndexedDB with OPFS on the S22 before v1.2 work starts.

## Consequences

- Positive: atomic transactions across all tables; live queries for the UI; mature migration support; works identically in the page and the engine worker.
- Positive: photos are deleted atomically with their metadata (NFR-PRIV-05).
- Negative: no SQL for ad-hoc analytics; mitigated by derived tables designed for the hot queries.
- Negative: strict durability adds write latency; measured in spike S-3a (budget 500 ms leaves a wide margin).
- Runner-up: **SQLite WASM on OPFS** if analytics queries over raw data become a bottleneck (would require a worker-only data layer and reactive invalidation done by hand).

## Amendment (v0.3, 2026-11-24)

- **No `dexie-react-hooks`.** React reads live queries through the app's own `useObservable` hook on `useSyncExternalStore` (ADR-0005), one mechanism instead of two. The package was never installed; knip confirms there are no unused dependencies.
- **M0 schema.** `powr` version 1 holds the four walking-skeleton tables `meta`, `settings`, `sessions` and `sets` (WP0.5). Indexes use nested key paths on the stored `InstantTz` (`startedAt.epochMs`, `[exerciseId+performedAt.epochMs]`) instead of denormalized `startedAtMs`/`performedAtMs` fields. Before the first beta with user data it is decided whether the remaining MVP tables extend version 1 or arrive as version 2 with a migration (TD-19).
- **`powr-runtime`** is plain IndexedDB without Dexie (version 1, one `kv` store), so the service worker stays small and Dexie-free.

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.

## Amendment (v0.5, 2026-11-24)

The decision stands. TD-19 is decided: the MVP tables of M2 arrived as **`dataVersion` 2** (seven tables: `profile`, `equipmentProfiles`, `plans`, `plannedSessions`, `breaks`, `meets`, `bodyweights`; settings gain `weekStart` and `overrides`) with a pass-through migration from version 1, run by the Dexie upgrade and by backup import, so both paths are exercised before real user data exists (technical concept §8.2.2). Version 2 was still unreleased when M2b added `Plan.dismissedIssues` (dismissed plan warnings, PLN-09) and `MuscleTarget.full` (time-budget targets) to its record schemas, so no version 3 was needed.

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M2a planning core" and "M2b screens".

## Amendment (v0.7, 2026-11-24)

The decision stands, with one deviation that the product owner accepted on 2026-11-24 (technical concept §8.2.2, §8.2.4, §8.2.8):

- **Derived writes are strict too.** Dexie sets the durability per database, not per transaction, so the derived tables (`dExerciseState`, `dSessionE1rm`, `dPrs`) are written with strict durability like the raw data. They are written at finish and after past edits, not per logged set, so the set-commit path does not pay for it.
- **Version 2 amended again (unreleased), no version 3:** `sessions.plannedSessionId` and the stores `readiness`, `dExerciseState`, `dSessionE1rm` and `dPrs`; the session record's M3 core and the settings' `session` and `alerts` objects. Development devices that ran an M2 build hold the old layout under the same version number and clear their site data once (product-owner decision, 2026-11-24; no migration, no beta users yet).
- **One event, one transaction:** every session event reads and writes `sessions`, `sets`, `readiness`, `dExerciseState`, `plannedSessions` and `plans` in one strict transaction; the pure reducer runs inside it.
- **Transaction scopes are `async` functions (M3b fix):** Dexie keeps its transaction zone across native `await`s only for a scope function it recognises as async. The unit of work passed a plain arrow, so after a few nested awaits (the FINISH of a planned session: persist, then mark the planned session done) a repository call ran outside the transaction and Dexie reported `PrematureCommitError`. `createUnitOfWork` now passes `async () => fn(repos)`; a component test on real IndexedDB guards it (the application tests run on in-memory fakes).

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M3a session core" and "M3b session screens".

## Amendment (v0.9, 2026-11-25)

The decision stands. As built in M5 (technical concept §6.7, §6.8, §8.2.1):

- **Delete all data (DAT-13)** deletes `powr`, `powr-safety`, `powr-diag` and `powr-runtime` through **their own instances** with auto-open off: Dexie closes a database on `versionchange` with auto-open still on, so a later write would recreate a deleted database. Both web storages are cleared; Cache Storage (app files only) stays, so the app still opens offline into the first run.
- **The data-update guard (DAT-14)** checks the stored version with `indexedDB.databases()` before opening anything, reads every store at the stored version without Dexie (`infrastructure/db/raw-read.ts`, never creating or upgrading) and writes the safety snapshot as a regular backup of the **stored** `dataVersion` (`encodeRawSnapshot`), so the normal restore migrates it; without a writable snapshot the update does not run. A failing upgrade is rolled back by IndexedDB and the recovery screen offers "Try again", "Save a copy of your data" and "Export diagnostics" (no restore: it needs the database at the current version).
- **Safety copies** are listed, saved and deleted (`SafetySnapshots.list`, `read`, `delete`), but **not auto-pruned** after 30 days or a newer backup; only the rotation of the latest two deletes one (open product decision, TD-67). **Amendment (v0.10, M6a, TD-67 closed):** auto-pruning is built: the latest two copies are always kept, plus every copy younger than 30 days; only copies that are neither are deleted, after each new copy and when Data and backups lists them. Deleting a copy after a newer regular backup is not built, because POWR cannot know the exported file was kept. Whether to cap the count (for example at five) is an open product decision (decided in v0.11, below).
- `dataVersion` 2 was amended once more (settings `backup`, `training`, `display`; `meta.backupReminder`, `meta.calendarExport`); the install-prompt state is in `localStorage`, not in `meta`, because it belongs to the browser rather than to the training data.

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M5d data, calendar and PWA" and "M5z bundle trim, fixes and docs".

## Amendment (v0.11, 2026-11-25)

The decision stands. **Safety copies are capped at five** (product-owner decision 2026-11-25, technical concept §8.2.1): the rule is still "the latest two copies, plus every copy younger than 30 days", but **never more than five copies in all**; past five, the oldest go first. `SAFETY_COPIES.keepMax` in `@powr/application/data`; `safetyCopiesToPrune` returns the IDs to delete oldest first. Several restores in a month therefore keep at most five full copies (each the size of a backup); a copy taken before a restore stays up to 30 days unless five newer copies follow it in that time. Data and backups says: "It keeps the latest two copies and any from the last 30 days, never more than five, and deletes the oldest ones by itself." Tests: `packages/application/test/m6c.test.ts` (the cap, the same-day restores, unreadable times, a fast-check property: at most five kept, never fewer than two, every kept copy newer than every deleted one, oldest deleted first; six restores in a row leave five copies).

Source: `IMPLEMENTATION_NOTES.md` (repository root), section "M6c checklist rows and decisions".
