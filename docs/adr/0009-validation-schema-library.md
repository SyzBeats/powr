# ADR-0009: Validation / schema library: Zod 4

- Status: Accepted (v0.3, 2026-11-24: CSP wrapper and lazy backup schemas, see below)
- Date: 2026-11-23, amended 2026-11-24
- Related: technical concept §8.3.5, §8.6, §8.12, §7.3, §8.19; PRD DAT-06/07, NFR-SEC-02, NFR-MNT-03/06

## Context

Schemas are needed for: untrusted backup import (every record, strict), persisted record versions (one schema per `dataVersion`), the rules registry and content build (Node, build time), forms (onboarding, editors), and router search params. The backup format must be documented per version (DAT-07), ideally generated from the same schemas. The strict CSP forbids `eval` and `new Function`.

Facts checked 2026-11-23: zod 4.6.7 (MIT; full package about 87 KB gzipped, tree-shakable `zod/mini` exists; built-in `z.toJSONSchema()`; JIT can be disabled with `z.config({ jitless: true })`), valibot 1.5.0 (MIT; about 14 KB gzipped full, highly tree-shakable), arktype 2.2.10 (MIT).

## Options considered

| Criterion (weight) | Zod 4 | Valibot 1.5 | ArkType 2 |
|---|---|---|---|
| Fit with React + TS (2) | 5 | 5 | 4 |
| Maintenance and community (2) | 5 | 4 | 4 |
| Bundle size (2) | 3 | 5 | 3 |
| JSON Schema export (backup format docs) (2) | 5 | 4 | 4 |
| Ecosystem (React Hook Form resolver, router, docs) (2) | 5 | 4 | 3 |
| Solo productivity (2) | 5 | 4 | 4 |
| **Total (max 60)** | **56** | 52 | 44 |

## Decision

Use **Zod 4** everywhere schemas are needed. Call `z.config({ jitless: true })` at startup in the app and in the engine worker (CSP). Large schemas (backup import) live in lazily loaded chunks so they do not affect cold start. Backup-format JSON Schemas are generated with `z.toJSONSchema()` per `dataVersion` into `docs/formats/schema/`.

## Consequences

- Positive: one schema language from build tools to UI forms; generated format documentation; mature resolver for React Hook Form.
- Negative: larger than Valibot; acceptable because heavy schemas are lazy and the budget is checked by `size-limit`.
- Negative: JIT-less parsing is slower; irrelevant at the data sizes involved (import of 40,000 sets is still within seconds; checked in the import performance test).
- Runner-up: **Valibot**, if bundle size becomes critical.

## Amendment (v0.3, 2026-11-24)

- **JIT-less through a local `zod.ts`, not a startup call.** Zod 4.6 probes `new Function` as soon as an object schema is *created*. Schemas are created at module top level, which in a code-split bundle can run before any startup code, and the probe triggers a CSP violation report. So every package with schemas (`rules`, `content`, `formats`) and the app have a local `zod.ts` that calls `z.config({ jitless: true })` and re-exports `z`; all other files import `z` from there. oxlint's `no-restricted-imports` (regex `^zod(/.*)?$`) forbids importing `zod` directly in the packages and, since v0.3, everywhere in `apps/web`; the `zod.ts` files are the exemptions. The content catalog is built on first use rather than at import time.
- **Large schemas in lazy chunks: implemented for backups.** The backup record and manifest schemas live in `@powr/formats/backup`, which the app loads with `import()` on the first export or import (technical concept §8.19). Entry JS went from 211.4 KB to 202.5 KB gzipped.
- **Zod's core is still in the entry chunk** (about 25 KB gzipped), because the M0 content stub is parsed at startup and `@powr/rules` exports its schemas from the package root. M1 keeps the startup path schema-free once content and rules are validated at build time (TD-17).

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.
