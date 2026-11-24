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

| ADR | Title | Decision | Runner-up | Status |
|---|---|---|---|---|
| [0001](0001-repository-structure-pnpm-monorepo.md) | Repository structure and boundary enforcement | pnpm-workspace monorepo; boundaries via pnpm isolation + TypeScript project references + oxlint `no-restricted-imports` overrides + architecture test | Single app with lint-enforced folders | Accepted (revised v0.2) |
| [0002](0002-frontend-framework-and-build-tooling.md) | Frontend framework and build tooling | React 19 + **TypeScript 7.0** + Vite 8 + React Compiler | Rsbuild (build tool); TypeScript 6.0 | Accepted (revised v0.2) |
| [0003](0003-ui-component-library.md) | UI component library | shadcn/ui on Base UI | Mantine 9 | Accepted |
| [0004](0004-styling-and-design-tokens.md) | Styling and design tokens | Tailwind CSS v4 + CSS-variable tokens; class sorting by oxfmt | CSS Modules + CSS variables | Accepted |
| [0005](0005-state-management.md) | State management | Dexie `liveQuery` + Zustand + URL state + pure session reducer | Dexie `liveQuery` + Jotai | Accepted |
| [0006](0006-indexeddb-library-and-persistence.md) | IndexedDB library and persistence model | Dexie 4, strict durability, separate auxiliary DBs, photos as IDB Blobs | SQLite WASM on OPFS | Accepted (photos revisited after S-3) |
| [0007](0007-charts.md) | Charts | Apache ECharts 6 (modular, lazy) + own SVG sparklines | Recharts 3 | Accepted (confirm in S-4) |
| [0008](0008-pwa-tooling-and-service-worker-strategy.md) | PWA tooling and service-worker strategy | vite-plugin-pwa `injectManifest` + Workbox precaching; prompt-only updates; install gate | Serwist | Accepted |
| [0009](0009-validation-schema-library.md) | Validation / schema library | Zod 4 (JIT-less) | Valibot | Accepted |
| [0010](0010-testing-stack.md) | Testing stack | Vitest 5, fast-check, Testing Library, Playwright, axe-core | Jest + Cypress | Accepted |
| [0011](0011-hosting.md) | Hosting | **Hetzner Cloud VPS (Nuremberg, Germany) + self-hosted Coolify 4.7**; Traefik + Let's Encrypt; own nginx image; GitHub Actions → GHCR → Coolify webhook | Cloudflare Pages | Accepted (product-owner decision 2026-11-24; rewritten v0.2) |
| [0012](0012-rules-registry.md) | Rules registry | YAML tables + Zod schema → versioned JSON; layered overrides | TypeScript constant tables | Accepted |
| [0013](0013-backup-file-format.md) | Backup file format | ZIP + manifest + SHA-256 + shared migration chain | Single JSON file | Accepted (resolved 2026-11-24: A) |
| [0014](0014-router.md) | Router | TanStack Router | React Router 8 | Accepted |
| [0015](0015-date-and-time-handling.md) | Date and time handling | Temporal via `temporal-polyfill` | date-fns 4 + `@date-fns/tz` | Accepted |
| [0016](0016-internationalisation.md) | Internationalisation | Lingui 6 + `Intl`; oxlint `react/jsx-no-literals` + catalog check | i18next | Accepted (revised v0.2) |
| [0017](0017-lint-and-format.md) | Lint and format: oxlint + oxfmt | **oxlint 1.95** (type-aware via oxlint-tsgolint) + **oxfmt 0.80** (beta); Prettier removed | ESLint 10 + typescript-eslint + Prettier 3 | Accepted (product-owner decision 2026-11-24; rewritten v0.2) |
| [0018](0018-licence-compliance-tooling.md) | Licence compliance tooling | Own inventory from the bundle graph + SPDX gate | `rollup-plugin-license` | Accepted |
| [0019](0019-timer-and-alert-architecture.md) | Timer and alert architecture | Timestamp timers; multi-path best-effort hidden alerts; honest status; audio keep-alive tested in S-1, opt-in Labs only if it clearly works | Visible-only alerts | Accepted (calibrated by S-1) |
| [0020](0020-calculation-engine-design.md) | Calculation engine design | Pure functional core with injected rules and explanation traces | Generic rules-engine library | Accepted |
| [0021](0021-package-manager.md) | Package manager | pnpm 12 | Bun | Accepted (resolved 2026-11-24: A) |
