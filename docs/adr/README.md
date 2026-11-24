# Architecture Decision Records (ADRs)

Lightweight MADR format: context, options considered (with a weighted matrix where the choice is significant), decision, consequences. The main document is [`../technical-concept.md`](../technical-concept.md); §9 there summarizes these ADRs.

**Scoring convention.** Scores run from 1 (poor) to 5 (excellent). Weights run from 1 to 4 and reflect this project's quality goals (Q1 data integrity, Q2 offline reliability, Q3 correct and explainable logic, Q4 privacy and licence compliance, Q5 fast, accessible one-handed UX) and the solo-developer constraint. **Licence is a pass/fail gate**, not a weighted criterion: every option listed passes the LEG-08 permissive-licence policy unless noted. Versions and licences were checked on the npm registry on 2026-11-23.

**Status values.** Proposed (needs a spike or a product-owner answer), Accepted, Superseded by ADR-nnnn. All open questions were resolved by the product owner on 2026-11-24.

**v0.2 (2026-11-24).** Product-owner decisions applied:
- ADR-0011 was rewritten for Hetzner + Coolify.
- ADR-0017 was rewritten for oxlint + oxfmt (no linter named "OCX" exists; the request was read as Oxc's oxlint).
- ADR-0002 moved to TypeScript 7.0.
- ADR-0001 re-designed the boundary enforcement.
- ADR-0004, 0010, 0013, 0016, 0019 and 0021 were updated.

**v0.3 (2026-11-24).** After M0, every deviation recorded in `IMPLEMENTATION_NOTES.md` §3 (repository root) was folded into the documents. The decisions themselves stand; each affected ADR keeps its history and gets an "Amendment (v0.3, 2026-11-24)" section saying what changed and why:
- ADR-0001 (lazy package entries, deferred `@powr/rules` → `@powr/domain` dependency, more native lint rules), 0002 (`#ui/*` subpath imports as the one alias exception), 0003 (`#ui/*` alias and shadcn CLI workflow, approved by the product owner), 0006 (no `dexie-react-hooks`, M0 schema), 0008 (own service-worker registration, `sw.ts`, own icon generator), 0009 (per-package `zod.ts` wrapper, lazy backup schemas), 0010 (E2E test server with production headers), 0013 (synchronous fflate API, canonical JSON, zip-bomb ratio), 0016 (`jsx-no-literals` configuration, catalog check in the build), 0017 (ESLint only as an unused peer, native React Compiler rules), 0018 (own SPDX evaluator; licence exceptions approved by the product owner) and 0021 (`minimumReleaseAgeExclude` until 2026-12-01).
- No ADR was superseded; titles are unchanged.

**v0.4 (2026-11-24).** After M1 (engine, rules registry, content pipeline), the implementation and the product-owner decisions of 2026-11-24 were folded in. Each affected ADR keeps its history and gets an "Amendment (v0.4, 2026-11-24)" section:
- ADR-0001 (package entries as built: domain subpaths, Zod-free `@powr/rules` root with `schema`/`resolve`/`sources` entries, `@powr/content` entries, `tools/content-build`; lint and build checks that keep Zod off the startup path), 0003 (TD-21 resolved by the product owner: keep `#ui/cn`, shadcn colour bridge), 0009 (no Zod on the startup path; reserved keys checked before Zod), 0012 (registry as built: 109 parameters, source directory and ID convention, build, golden tests, resolver), 0013 (backup import hardened against `__proto__`/`constructor`/`prototype` keys, deep nesting and hostile entry names), 0018 (content licence entries approved by the product owner) and 0020 (engine as built; product-owner decision on the curve class of the competition squat and deadlift).
- No ADR was superseded; titles are unchanged.

**v0.5 (2026-11-24).** After M2 (planning core and the onboarding and planning screens), the implementation and the product-owner decisions of 2026-11-24 were folded in. Each affected ADR gets an "Amendment (v0.5, 2026-11-24)" section:
- ADR-0004 (the mock-up's visual direction under WCAG 2.2 AA, new tokens, the token contrast gate), 0006 (`dataVersion` 2 with the M2 tables, TD-19 decided), 0010 (component tests in Vitest browser mode, axe in both themes) and 0020 (planning on the main thread in the lazy planning chunk until the engine worker exists; time-budget prioritisation; curve class `equation`).
- v0.5 also folds in the M2 tooling (TD-09 native Lingui macro, TD-10 native React Compiler lint rules, TD-12 Lighthouse CI and Trusted Types in dev/E2E) and the Sentry package block list: ADR-0010 (the E2E server enforces Trusted Types; Lighthouse CI with per-environment baselines), 0016 (native macro transform), 0017 (alpha `eslint-plugin-react-hooks` removed, React Compiler rules native only, ESLint only as the peer of `eslint-plugin-lingui`), 0018 (package block list `deniedPackages` with no Sentry, a product-owner decision of 2026-11-24; two never-loaded build-only packages removed by pnpm `overrides`) and 0021 (pnpm `overrides` in `pnpm-workspace.yaml`).
- No ADR was superseded; titles are unchanged.

**v0.6 (2026-11-24).** After M2c (planning gaps), ADR-0016 and ADR-0017 get an "Amendment (v0.6, 2026-11-24)" section: `pnpm lint` denies warnings, so the alpha Lingui rule blocks in practice. No ADR was superseded; titles are unchanged.

| ADR | Title | Decision | Runner-up | Status |
|---|---|---|---|---|
| [0001](0001-repository-structure-pnpm-monorepo.md) | Repository structure and boundary enforcement | pnpm-workspace monorepo; boundaries via pnpm isolation + TypeScript project references + oxlint `no-restricted-imports` overrides + architecture test | Single app with lint-enforced folders | Accepted (revised v0.2, amended v0.3, v0.4) |
| [0002](0002-frontend-framework-and-build-tooling.md) | Frontend framework and build tooling | React 19 + **TypeScript 7.0** + Vite 8 + React Compiler | Rsbuild (build tool); TypeScript 6.0 | Accepted (revised v0.2, amended v0.3) |
| [0003](0003-ui-component-library.md) | UI component library | shadcn/ui on Base UI; `#ui/*` alias for the shadcn CLI; `#ui/cn` + shadcn colour bridge | Mantine 9 | Accepted (amended v0.3, v0.4) |
| [0004](0004-styling-and-design-tokens.md) | Styling and design tokens | Tailwind CSS v4 + CSS-variable tokens; class sorting by oxfmt | CSS Modules + CSS variables | Accepted (amended v0.5) |
| [0005](0005-state-management.md) | State management | Dexie `liveQuery` + Zustand + URL state + pure session reducer | Dexie `liveQuery` + Jotai | Accepted |
| [0006](0006-indexeddb-library-and-persistence.md) | IndexedDB library and persistence model | Dexie 4, strict durability, separate auxiliary DBs, photos as IDB Blobs | SQLite WASM on OPFS | Accepted (photos revisited after S-3; amended v0.3, v0.5) |
| [0007](0007-charts.md) | Charts | Apache ECharts 6 (modular, lazy) + own SVG sparklines | Recharts 3 | Accepted (confirm in S-4) |
| [0008](0008-pwa-tooling-and-service-worker-strategy.md) | PWA tooling and service-worker strategy | vite-plugin-pwa `injectManifest` + Workbox precaching; prompt-only updates; install gate | Serwist | Accepted (amended v0.3) |
| [0009](0009-validation-schema-library.md) | Validation / schema library | Zod 4 (JIT-less), never on the startup path | Valibot | Accepted (amended v0.3, v0.4) |
| [0010](0010-testing-stack.md) | Testing stack | Vitest 5, fast-check, Testing Library, Playwright, axe-core | Jest + Cypress | Accepted (amended v0.3, v0.5) |
| [0011](0011-hosting.md) | Hosting | **Hetzner Cloud VPS (Nuremberg, Germany) + self-hosted Coolify 4.7**; Traefik + Let's Encrypt; own nginx image; GitHub Actions → GHCR → Coolify webhook | Cloudflare Pages | Accepted (product-owner decision 2026-11-24; rewritten v0.2) |
| [0012](0012-rules-registry.md) | Rules registry | YAML tables + Zod schema → versioned JSON; layered overrides | TypeScript constant tables | Accepted (amended v0.4) |
| [0013](0013-backup-file-format.md) | Backup file format | ZIP + manifest + SHA-256 + shared migration chain | Single JSON file | Accepted (resolved 2026-11-24: A; amended v0.3, v0.4) |
| [0014](0014-router.md) | Router | TanStack Router | React Router 8 | Accepted |
| [0015](0015-date-and-time-handling.md) | Date and time handling | Temporal via `temporal-polyfill` | date-fns 4 + `@date-fns/tz` | Accepted |
| [0016](0016-internationalisation.md) | Internationalisation | Lingui 6 + `Intl`; oxlint `react/jsx-no-literals` + catalog check | i18next | Accepted (revised v0.2, amended v0.3, v0.5, v0.6) |
| [0017](0017-lint-and-format.md) | Lint and format: oxlint + oxfmt | **oxlint 1.95** (type-aware via oxlint-tsgolint) + **oxfmt 0.80** (beta); Prettier removed | ESLint 10 + typescript-eslint + Prettier 3 | Accepted (product-owner decision 2026-11-24; rewritten v0.2, amended v0.3, v0.5, v0.6) |
| [0018](0018-licence-compliance-tooling.md) | Licence compliance tooling | Own inventory from the bundle graph + SPDX gate | `rollup-plugin-license` | Accepted (amended v0.3: licence exceptions approved by the product owner; v0.4: content entries approved; v0.5: no Sentry, package block list) |
| [0019](0019-timer-and-alert-architecture.md) | Timer and alert architecture | Timestamp timers; multi-path best-effort hidden alerts; honest status; audio keep-alive tested in S-1, opt-in Labs only if it clearly works | Visible-only alerts | Accepted (calibrated by S-1) |
| [0020](0020-calculation-engine-design.md) | Calculation engine design | Pure functional core with injected rules and explanation traces | Generic rules-engine library | Accepted (amended v0.4, v0.5) |
| [0021](0021-package-manager.md) | Package manager | pnpm 12 | Bun | Accepted (resolved 2026-11-24: A; amended v0.3, v0.5) |
