# ADR-0001: Repository structure: pnpm-workspace monorepo with layered packages

- Status: Accepted (v0.2, 2026-11-24: boundary enforcement re-designed after replacing ESLint with oxlint; v0.3, 2026-11-24: amended after M0; v0.4, 2026-11-24: package entries as built in M1, see below)
- Date: 2026-11-23, revised 2026-11-24
- Related: technical concept §5; PRD NFR-MNT-01/02/06, TC-05, TC-15

## Context

The calculation engine, the rules registry, the content library and the backup formats must be framework-free, deterministic and testable in Node, and they are reused by build-time tools (content validation, licence inventory, dataset generator). The PRD requires deterministic, data-driven and tested calculation code (NFR-MNT-01/02, PRG-18) and validated content (NFR-MNT-06); the brief asks for clear layering (domain → application → infrastructure → UI) with enforceable dependency rules. A solo developer needs these boundaries to be enforced by tooling rather than by discipline alone.

## Options considered

1. **pnpm-workspace monorepo** with packages `@powr/domain`, `@powr/rules`, `@powr/content`, `@powr/formats`, `@powr/application`, the app `apps/web`, and `tools/*`.
2. **Single Vite app** with folders and lint rules for the layers.
3. **Multiple repositories** (engine, content, app) published as private packages.

| Criterion (weight) | Monorepo | Single app | Multi-repo |
|---|---|---|---|
| Enforceable boundaries (3) | 5 | 3 | 4 |
| Tooling simplicity (2) | 3 | 5 | 1 |
| Reuse by build tools and tests (2) | 5 | 3 | 2 |
| Solo productivity (3) | 4 | 5 | 1 |
| **Total (max 50)** | **43** | 40 | 21 |

## Decision

Use a **pnpm-workspace monorepo**. Dependency direction: `apps/web → application → {formats, rules, content} → domain`.

### Boundary enforcement (v0.2)

v0.1 used `eslint-plugin-boundaries` plus a dependency-cruiser cross-check. ESLint is replaced by oxlint (ADR-0017), and dependency-cruiser 18.9 does not support TypeScript 7.0 (ADR-0002), so enforcement was re-designed.

| Option | Assessment |
|---|---|
| oxlint JS plugin running `eslint-plugin-boundaries` | Rejected. JS plugins are alpha and not subject to semver; the plugin relies on ESLint settings and import-resolver integration that oxlint does not document as supported. |
| dependency-cruiser (MIT, 18.9.0) | Deferred. It supports TypeScript `< 7` or `≥ 7.1`; its swc parser alternative is marked experimental. Reconsider with TypeScript 7.1 (TD-07). |
| pnpm isolation + TypeScript project references | Chosen for the **package level**: both are hard compile-time gates with no extra tool |
| oxlint native rules with path `overrides` | Chosen for **layers inside a package**: `no-restricted-imports` (gitignore-style `patterns` with messages), `no-restricted-globals`, `import/no-cycle` are native, non-alpha rules |
| Small architecture test (Vitest) | Chosen as a **safety net** for what lint rules cannot express |

**Recommended combination (decided):**

1. **pnpm isolation:** a package can only import what its `package.json` declares.
2. **TypeScript project references:** each package's `tsconfig.json` is `composite` and `references` only its allowed internal packages. `tsc -b` (TypeScript 7.0) fails on imports from non-referenced packages and refuses cycles.
3. **oxlint `overrides`** in `oxlint.config.ts`:
   - per-folder `no-restricted-imports` patterns for `apps/web` (features ↛ infrastructure/Dexie, ui ↛ features/hooks/infrastructure/`@powr/*`, sw ↛ app code, and so on);
   - in `packages/domain`, a ban on React, Dexie, Zod and other `@powr/*` packages, plus `no-restricted-globals` for `Date`, `performance`, `crypto`, timers, DOM and storage globals;
   - `import/no-cycle` everywhere.
4. **`tools/arch-test`** (runs with the unit tests): asserts the allowed internal-dependency matrix from all `package.json` files and `tsconfig` references, and scans `packages/domain/src` for `Math.random`, `Date.now` and `new Date(`.

## Consequences

- Positive: the engine and formats are importable by Node scripts and tests without a browser; boundaries fail the build when violated (type-check, lint or arch test); content and rules have their own build steps and versions.
- Negative (v0.2): no dependency-graph visualization until dependency-cruiser supports the project's TypeScript version (TD-07).
- Positive: TypeScript project references give incremental type checks.
- Negative: more configuration (one `package.json` and `tsconfig` per package). Mitigated by a shared `tsconfig.base.json` and keeping packages source-only (no per-package bundling; Vite compiles them through the workspace).
- Negative: the runner-up (single app) would be faster to start. If the package overhead slows M0, packages can begin as folders inside one package, keeping the same import rules, and be split later.

## Amendment (v0.3, 2026-11-24)

The decision stands. M0 implemented it with these differences:

- **`@powr/rules` does not depend on `@powr/domain` yet.** M0 imports nothing from the domain there, and knip fails on unused dependencies. The allowed-dependency matrix of the architecture test still permits the edge; the dependency is declared in M1 together with the `RuleSet` types.
- **Lazy package entries.** `@powr/formats` and `@powr/application` each have a second entry, `./backup` (`package.json` `exports`). The package roots stay free of Zod schemas and fflate because they are on the app's startup path; the backup entries load with `import()` (technical concept §8.19). The package boundaries do not change: the same packages, the same references. A lint rule forbids static value imports of the backup entries in app code (type imports are allowed); oxlint also checks `import()`, so the single loader carries the one disable comment.
- **More native lint rules.** `no-restricted-properties` bans `Math.random` in `packages/domain` (in addition to the architecture test). Every `apps/web` override forbids importing `zod` directly (only `src/zod.ts` may, ADR-0009). The `#ui/*` subpath-imports alias (ADR-0003) is matched with `regex` patterns, because `#` starts a comment in gitignore-style `group` patterns; infrastructure and the service worker may not use it.
- **Boundary probes.** `tools/arch-test/test/boundary-probes.test.ts` writes forbidden files into the real source tree and asserts that oxlint or `tsc -b` fails on them.

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.

## Amendment (v0.4, 2026-11-24)

The decision stands. M1 built the packages with more entries than v0.3 described; the boundaries (packages, references, direction) are unchanged.

- **`@powr/domain`:** the root holds the shared contract (IDs, enums, `ExerciseDef`, evidence tags) and the `units` and `time` helpers; every engine module is a subpath export (`./e1rm`, `./trend`, `./progression`, `./loading`, `./warmup`, `./volume`, `./rest`, `./scoring`, `./bodyweight`, `./explain`, `./rules`), so consumers pull in only what they import.
- **`@powr/rules`** now declares its `@powr/domain` dependency (closing the v0.3 note). Entries: the root is Zod-free (`RULES_VERSION`, `rulesStamp`, `matchesCondition`, types) because the app's composition root imports it; `./schema` (row and value schemas), `./resolve` (resolver, lazy in the app from M2), `./sources` (registry validator) and the Node entries `./sources/node` and `./build/node`, which live in `packages/rules/scripts/`, a separate TypeScript project with Node types so `src/` stays Node-free. `"sideEffects": ["./src/zod.ts"]` keeps the JIT-less configuration while letting bundlers drop unused schemas.
- **`@powr/content`:** root (types and `createContentCatalog`, no Zod, no data), `./built-in` (the compiled `content.json`, loaded with `import()` at boot) and `./schema` (Zod, build time only).
- **`tools/content-build`** owns the content build, lint and coverage (not `packages/content/scripts`), because the source check needs `@powr/rules`, which the content runtime must not depend on. Its allowed dependencies are domain, rules and content.
- **Keeping Zod off the startup path (TD-17, closed).** oxlint forbids `zod` anywhere in `apps/web` (the app has no `src/zod.ts` any more), static value imports of `@powr/content/built-in` (one loader with a disable comment, like the backup loader), `@powr/content/schema`, and static value imports of every `@powr/rules/*` subpath in app code and in `packages/application`; type imports stay allowed. Boundary probes cover the Zod ban and the rules subpaths. Because lint sees only a file's own imports, the build check `apps/web/scripts/startup-check.ts` (part of `pnpm size`) fails if any first-wave script contains Zod, which also catches a package root that starts re-exporting a schema.

Source: `IMPLEMENTATION_NOTES.md` (repository root): §3 rows marked "Docs amended in v0.4" and the sections "M1-B content" and "M1-A engine and rules".
