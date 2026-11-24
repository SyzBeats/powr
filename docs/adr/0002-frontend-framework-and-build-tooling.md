# ADR-0002: Frontend framework and build tooling: React 19 + TypeScript 7.0 + Vite 8

- Status: Accepted (v0.2, 2026-11-24: TypeScript changed from 6.0.x to 7.0.x; v0.3, 2026-11-24: one alias exception, see below)
- Date: 2026-11-23, revised 2026-11-24
- Related: technical concept §4, §5.2, §8.9, §8.21; ADR-0017; PRD C-01, NFR-PERF-01/07, OC-01

## Context

The sole developer is proficient in React, Node and TypeScript. The product needs a static, offline-capable SPA with a strong PWA plugin ecosystem, small bundles for the Galaxy S22 cold-start budget (≤ 2 s) and the ≤ 3 MB offline install, and fast iteration. React is effectively fixed by the developer profile; the open choices are the build tool and the TypeScript version.

In v0.1, TypeScript was pinned to 6.0.x only because typescript-eslint 8.74 supports TypeScript < 6.1. v0.2 replaces ESLint with oxlint (ADR-0017), so that constraint is gone and the version was re-evaluated.

Registry and vendor facts (checked 2026-11-23/24):

- React 19.3.1 (MIT). Vite 8.3.8 (MIT; Rolldown-based; stable since 2026-03-12). `@vitejs/plugin-react` 6.3.0 with an optional `babel-plugin-react-compiler` 1.0.0 peer.
- **TypeScript 7.0.2** (Apache-2.0) is the native Go compiler, **stable since 2026-07-08**. 7.1.0-beta was published 2026-10-20 and daily 7.1 dev builds continue. The 7.0 announcement says:
  - `--build` and project references are supported (with parallel builders);
  - 7.0 **ships no programmatic API**; a new API is expected in 7.1;
  - tools that need the 6.0 API can use the side-by-side package `@typescript/typescript6` (6.0.2, `tsc6` binary) through an npm alias;
  - `strict` is on by default, `types` defaults to `[]`, and `baseUrl`, `moduleResolution: node10/classic` and `target: es5` are removed.
- The npm package `typescript@7.0.2` exports only `./unstable/*` API entry points, so `import ts from 'typescript'` with the classic API does not work.

## Options considered

### Build tool (unchanged from v0.1)

| Criterion (weight) | Vite 8 | Rsbuild | Next.js static export |
|---|---|---|---|
| Fit with React + TS (2) | 5 | 5 | 4 |
| Maintenance and community (2) | 5 | 4 | 5 |
| PWA plugin ecosystem (3) | 5 | 3 | 2 |
| Build and dev speed (1) | 5 | 5 | 3 |
| Bundle output control (2) | 4 | 4 | 3 |
| Solo productivity (2) | 5 | 4 | 3 |
| **Total (max 60)** | **58** | 48 | 39 |

### TypeScript version (new in v0.2): compatibility across the toolchain

| Tool | Needs the `typescript` package or API? | TypeScript 7.0 status |
|---|---|---|
| Vite 8 / Rolldown | No; types are stripped by Oxc during transform | ✓ |
| Vitest 5 | No (no type-check mode used) | ✓ |
| React Compiler (Babel plugin via `@rolldown/plugin-babel`) | No; Babel parses TypeScript syntax itself | ✓ |
| Lingui macros (Babel) and `@lingui/cli` extraction | No | ✓ |
| TanStack Router plugin / generator | No (Babel) | ✓ |
| oxlint type-aware (`oxlint-tsgolint` 7.0.2008) | Bundles TypeScript 7.0's Go implementation | ✓ (it already uses 7.0 semantics, so 7.0 in the project keeps lint and compiler aligned) |
| knip 6.48 | Parses with oxc; built against TypeScript 7.0.2 | ✓ |
| `tsc` in CI | `tsc -b` with project references | ✓ (7.0 supports build mode; about 10× faster per the announcement) |
| dependency-cruiser 18.9 | Uses the TypeScript API; supports `< 7` or `≥ 7.1` | ✗ → not used (TD-07; ADR-0001) |
| Editor | TypeScript 7 VS Code extension (LSP-based) | ✓ |

| Criterion (weight) | TypeScript 7.0.x | TypeScript 6.0.x | TS 7.0 for `tsc` + `@typescript/typescript6` for tools |
|---|---|---|---|
| Works with every tool in the v0.2 stack (3) | 5 | 5 | 5 |
| Type-check speed in CI and editor (2) | 5 | 2 | 5 |
| Alignment with type-aware oxlint (TS 7.0 Go) (2) | 5 | 3 | 5 |
| Future-proofing (2) | 5 | 2 | 4 |
| Simplicity (2) | 5 | 5 | 3 |
| **Total (max 55)** | **55** | 41 | 50 |

## Decision

- **React 19.3** with the **React Compiler** (automatic memoization).
- **Vite 8** as build tool and dev server; `vite-plugin-pwa` 2.0 (Vite 8 is in its peer range) for the PWA (ADR-0008).
- **TypeScript 7.0.x** (pinned to the minor; Dependabot proposes patch updates) for type-checking with `tsc -b` in CI and for the editor.
  - Required `tsconfig` conventions: `moduleResolution: "bundler"`, `module: "esnext"`, no `baseUrl` (no path aliases; workspace packages resolve through pnpm), explicit `types` (for example `["vite/client"]`), `strict: true` stated explicitly, `composite` + `references` per package (ADR-0001).
  - If a future tool needs the classic API before 7.1, it gets `@typescript/typescript6` through an npm alias scoped to that tool; the project compiler stays 7.0.
- Build target: Chromium 130+ (`build.target: ['chrome130']`; baseline resolved 2026-11-24: A, OQ-T4), ES modules, code splitting by route.

## Consequences

- Positive: one familiar stack; first-class PWA, Lingui, TanStack Router and Vitest integrations, all checked against Vite 8 peer ranges.
- Positive: React Compiler removes most manual `useMemo`/`useCallback` work and helps the 55 fps scroll budget.
- Positive: type checks are much faster, and the same TypeScript semantics are used by `tsc` and by type-aware oxlint.
- Negative: no TypeScript programmatic API until 7.1, so dependency-cruiser is dropped for now (risk T-03, TD-07).
- Negative: Rolldown is younger than Rollup; some Rollup-only plugins (for example `rollup-plugin-license`, peer `rollup ^1–4`) may not work, which is one reason the licence inventory is an own plugin (ADR-0018).

## Amendment (v0.3, 2026-11-24)

**One alias exception: `#ui/*` subpath imports** (approved by the product owner on 2026-11-24). The convention "no `baseUrl`, no path aliases" stays. The one exception is Node's standard `imports` field in `apps/web/package.json`:

```json
"imports": {
  "#ui/cn": "./src/ui/cn.ts",
  "#ui/*": "./src/ui/*.tsx"
}
```

- Why: the official shadcn CLI (`shadcn add`) needs an alias for the component directory (ADR-0003). Without one, `shadcn init` and `add` cannot place or import components.
- Why subpath imports and not `paths`: they need no `tsconfig` `paths`/`baseUrl` and no Vite `resolve.alias`. TypeScript 7 with `moduleResolution: "bundler"`, Vite 8, Vitest, oxlint (import plugin, type-aware rules) and knip resolve them natively, as Node does.
- The wildcard target ends in `.tsx`, so imports are extensionless (`#ui/button`) and resolve exactly; `#ui/cn` is an exact entry for the one `.ts` file. Entries for lib and hook files (`.ts`) are added with the first such file; knip reports unused entries.
- All design-system imports in the app use `#ui/*`. oxfmt's `sortImports` has a `subpath` group for them, between `@powr/*` and relative imports.

Also from M0: `vite.config.ts` was committed unformatted (double quotes, 80 columns), so `pnpm format:check` failed; it is formatted with oxfmt now.

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.
