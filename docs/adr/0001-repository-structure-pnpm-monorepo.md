# ADR-0001: Repository structure: pnpm-workspace monorepo with layered packages

- Status: Accepted (v0.2, 2026-11-24: boundary enforcement re-designed after replacing ESLint with oxlint)
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
