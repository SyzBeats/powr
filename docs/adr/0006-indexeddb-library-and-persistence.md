# ADR-0006: IndexedDB library and persistence model: Dexie 4

- Status: Accepted (photo storage revisited after spike S-3b)
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
