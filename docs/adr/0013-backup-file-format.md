# ADR-0013: Backup file format: ZIP container with JSON tables, manifest and SHA-256

- Status: Accepted (resolved 2026-11-24: A, OQ-T6; confirmed by the product owner; v0.3, 2026-11-24: amended after M0, see below)
- Date: 2026-11-23
- Related: technical concept §8.3, §6.4, §6.5; PRD DAT-05…11, NFR-REL-02/06, NFR-SEC-02, NFR-MNT-03, TC-06, P-04

## Context

Backups are the only way to move data between devices. The file must contain all user data, a format version, the app version, a creation timestamp, record counts and an integrity checksum; it must stay usable without the app; every app version must import all earlier versions; photos (v1.2) may be large and split; optional passphrase encryption follows in v1.3. Chrome's Web Share allowlist excludes `.json`, `.zip` and `.ics` (PRD P-04), so delivery is a download or a save picker in any case. fflate 0.8.3 (MIT) was checked on 2026-11-23.

## Options considered

| Criterion (weight) | ZIP (manifest + JSON tables + binary photos) | Single JSON file (optionally gzip) | SQLite database file |
|---|---|---|---|
| Open and usable without the app (3) | 5 | 5 | 3 |
| Large photo payloads (3) | 5 | 1 (base64) | 4 |
| Integrity (per-entry hashes) (2) | 5 | 4 | 3 |
| Implementation simplicity (2) | 3 | 5 | 2 |
| Fits encryption (1) | 4 | 4 | 3 |
| Android handling (MIME, pickers) (2) | 5 | 4 | 3 |
| **Total (max 65)** | **60** | 48 | 40 |

## Decision

- File `powr-backup-YYYY-MM-DD-HHmm.zip` built with **fflate**: `manifest.json` first, `data/<table>.json` per raw table (arrays sorted by key), `README.txt`.
- Manifest: `format`, `formatVersion` (container), `dataVersion` (record schemas), app/rules/content versions, `createdAt` with offset, `backupId`, `part`, `encrypted`, `counts`, `dateRange`, `entries[]` with byte sizes and SHA-256, and `contentDigest`.
- Import order: structure → manifest → digests → per-record **migration with the same `@powr/formats` chain used by the local DB** → strict Zod validation → referential checks → preview → safety snapshot → one atomic replace-all transaction → derived rebuild.
- Newer `dataVersion` or unknown `formatVersion`: reject with "Update the app first".
- Fixtures for every `dataVersion` are kept forever and imported in CI.
- **v1.2 photos:** separate photo-part ZIPs (≤ 256 MB each, stored uncompressed) tied by `backupId`; streaming export.
- **v1.3 encryption:** still a `.zip` holding an unencrypted header manifest and `payload.bin` = AES-256-GCM chunked encryption of the inner backup, key from PBKDF2-HMAC-SHA-256 (600,000 iterations) via Web Crypto; Argon2id is decided at v1.3.
- Delivery: save picker where available, otherwise download. Never Web Share.

## Consequences

- Positive: human-inspectable, standard container; one migration chain for DB and backups; tamper and corruption detection; photos without base64 bloat.
- Negative: slightly more code than a single JSON file (zip handling, limits); fflate is small (about 12 KB gzipped).
- Negative: checksums are not authentication; authenticity comes only with encryption (v1.3).
- Runner-up: a single JSON file, if photos were never needed.

## Amendment (v0.3, 2026-11-24)

- **Synchronous fflate API.** The codec uses `zipSync`/`unzipSync`, not fflate's async API, which starts its workers from `blob:` URLs that the CSP's `worker-src 'self'` blocks. For large backups the codec moves into the engine worker (TD-16).
- **Canonical JSON.** Besides sorting arrays by primary key, object keys are sorted, so equal data gives equal bytes and hashes regardless of property order. To be stated in `docs/formats/backup-format.md` when that document is written.
- **Zip-bomb ratio.** The per-entry ratio limit of 200 applies to entries larger than 1 MiB; small, highly repetitive JSON legitimately compresses better. All limits are checked from the central directory before inflating.
- **Lazy chunk.** The codec, its Zod schemas and fflate are the separate entry `@powr/formats/backup` (use cases: `@powr/application/backup`), loaded on the first export or import and precached by the service worker.

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.
