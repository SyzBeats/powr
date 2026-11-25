# POWR implementation notes

Running log of how the implementation follows (and where it deviates from) `docs/technical-concept.md`
and the ADRs. M0 was built against v0.2; on 2026-11-24 every deviation below was folded into v0.3
(rows marked "Docs amended in v0.3"). M1 (contract, content, engine and rules) and the M1 cleanup were
folded into v0.4 on the same day (rows marked "Docs amended in v0.4"). Each deviation lists the
follow-up still needed, if any.

## 1. Run instructions

### Prerequisites

- Node 26 (`.node-version`), pnpm 12. The root `package.json` pins `pnpm@12.23.0`; an older pnpm 12
  switches to it automatically.
- Docker (only for the image build and the image tests).
- Playwright's Chromium for E2E: `pnpm --filter @powr/web exec playwright install chromium`.

### Everyday commands (repository root)

| Command                                       | What it does                                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                | Install (lockfile committed; dependency install scripts are blocked, see `pnpm-workspace.yaml`)                               |
| `pnpm dev`                                    | Vite dev server on http://localhost:5173 (no service worker in dev)                                                           |
| `pnpm build`                                  | Lingui catalog check, then the production build into `apps/web/dist` (service worker, licence collector, `version.json`)      |
| `pnpm preview`                                | Serve the build on http://localhost:4173 (Vite preview, without the production headers)                                       |
| `pnpm lint`                                   | oxlint, type-aware, with the layer rules and the alpha JS plugins (warnings)                                                  |
| `pnpm format` / `pnpm format:check`           | oxfmt (Tailwind class and import sorting)                                                                                     |
| `pnpm typecheck`                              | `tsc -b` over all project references (TypeScript 7.0)                                                                         |
| `pnpm test`                                   | Vitest: unit, property (fast-check), migration (fake-indexeddb), licence and architecture tests                               |
| `pnpm e2e`                                    | Playwright against `apps/web/dist`, served with the production headers (run `pnpm build` first)                               |
| `pnpm knip`                                   | Unused files, exports and dependencies                                                                                        |
| `pnpm i18n:extract` / `pnpm i18n:check`       | Update / verify the Lingui catalogs                                                                                           |
| `pnpm licence`                                | Licence gate and `licence-inventory.json` (after `pnpm build`)                                                                |
| `pnpm licence:demo-gpl`                       | Proves the gate: a build with a GPL fixture fails, `MIT OR GPL` passes as MIT, a clean build passes                           |
| `pnpm size`                                   | size-limit budgets (entry JS/CSS, service worker) and the precache budget (after `pnpm build`)                                |
| `pnpm icons`                                  | Regenerates the placeholder icons (own artwork)                                                                               |
| `pnpm --filter @powr/web ui:add <component>`  | Adds a shadcn component via `scripts/ui-add.ts` (pinned CLI, `cn` → `#ui/cn`, formatting), then review the diff per §8.9.2    |
| `pnpm verify`                                 | The whole CI pipeline locally: lint, format, knip, i18n, typecheck, test, build, licence, size, e2e                           |
| `pnpm docker:build` / `pnpm docker:run`       | Build and run the nginx image on http://localhost:8080 (after `pnpm build`)                                                   |
| `pnpm docker:smoke`                           | Header, caching and SPA smoke test against http://localhost:8080                                                              |
| `E2E_BASE_URL=http://localhost:8080 pnpm e2e` | The E2E suite against the running image (tests that stop or swap the server are skipped)                                      |
| `POWR_TEST_BROWSER_PORT=24123 pnpm test`      | The component tests' browser server from another first port (default 23315; a busy port moves on to the next free one, TD-58) |

`pnpm ci` is a pnpm built-in (clean install), hence the name `pnpm verify`.

### Testing on the Galaxy S22 (spikes S-1, S-2, S-8)

Service workers, notifications and wake lock need a secure context: HTTPS or `localhost`.
`pnpm preview --host` on the LAN (`http://192.168.x.y:4173`) is **not** a secure context, so the
service worker would not register there. Two practical options until the beta server exists (S-7):

1. **USB + `adb reverse` (recommended).** Enable USB debugging on the phone, connect it, then:
   ```sh
   pnpm build && pnpm docker:build && pnpm docker:run   # real nginx headers on :8080
   adb reverse tcp:8080 tcp:8080
   ```
   Open `http://localhost:8080/?debug=1` on the phone in Chrome **and** in Samsung Internet (`adb reverse`
   works for every app). `localhost` is a secure context, so install, service worker and notifications work.
   Alternatively use `pnpm preview` and `adb reverse tcp:4173 tcp:4173` (no production headers).
2. **Chrome remote debugging port forwarding.** `chrome://inspect/#devices` on the desktop → Port
   forwarding → `8080 → localhost:8080`. This only covers Chrome on the phone; it also gives DevTools
   for the phone's tab (console, Application panel, network log).

On the phone:

- `/?debug=1` switches developer tools on for that browser (`?debug=0` switches them off). They appear
  under Settings → Developer tools: links to both harnesses, "Export diagnostics", "Reset app files".
- **`/debug/alerts` (S-1):** enter the device and browser label (e.g. "S22 Chrome PWA"), allow
  notifications, choose variant A–E and the rest length (60 s, 3 min, 5 min, 8 min), tap **Start run**,
  lock the screen or switch apps, come back after the rest, repeat. Variant E is the background-audio
  keep-alive experiment (OQ-T3 = B; gain adjustable). **Export results** writes a `.txt` file (JSON,
  `harnessVersion` 2) for `tools/capability-matrix/records/`; `pnpm capability-matrix` compiles the
  records into the shipped matrix. Results survive a killed page (stored locally on the device). The
  full protocol (cells, condition, battery saver, the results template) is
  `docs/device-tests/S-1-protocol.md`.
- **`/debug/capabilities` (S-2):** detection results (service worker, storage persistence, wake lock,
  vibration, notifications, `canShare` per file type, save picker, display mode, …) plus tap-to-run
  checks; **Export report** writes a `.txt` file.
- **S-8 (update gate on device):** needs two deployed versions on one origin, i.e. the beta server
  (S-7). Locally, `apps/web/e2e/update-gate.spec.ts` covers the flow in Chromium.

## 2. Status of M0

| WP                   | Status                    | Evidence (all commands run locally, 2026-11-24)                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WP0.1 Repository     | Done                      | `pnpm lint` and `pnpm test` green; temporary forbidden imports fail `pnpm lint` (features → Dexie/infrastructure, domain → `@powr/formats`) and `pnpm typecheck` (TS2307); permanent probes in `tools/arch-test/test/boundary-probes.test.ts`                                                                                                                                          |
| WP0.2 CI             | Done (cannot run Actions) | `pnpm verify` green; workflows validated with actionlint 1.7.12 (exit 0); `pnpm licence:demo-gpl`: GPL fixture build fails naming `gpl-widget@1.0.0`, clean build passes                                                                                                                                                                                                               |
| WP0.3 App shell      | Done                      | `e2e/shell.spec.ts`: shell, bottom nav (≥ 48 px targets), theme switch without reload and before first paint, axe scan; every E2E test fails on any CSP violation or foreign/non-GET request                                                                                                                                                                                           |
| WP0.4 PWA            | Done                      | `e2e/offline.spec.ts` (install, server stopped, offline reload, deep link, logging offline); `e2e/update-gate.spec.ts` (install rejected mid-workout, offered after finishing, applied on accept)                                                                                                                                                                                      |
| WP0.5 Persistence    | Done                      | `e2e/persistence.spec.ts` (reload; persistent profile closed right after the write and relaunched; strict durability observed in Chromium); Dexie unit tests with fake-indexeddb                                                                                                                                                                                                       |
| WP0.6 Backup         | Done                      | `packages/formats/test/backup.test.ts` (fast-check round trip, tampered `sets.json` rejected, digest, schema, zip bomb, references); `e2e/backup.spec.ts` (download → restore into a fresh context; edited file rejected)                                                                                                                                                              |
| WP0.7 Deploy (local) | Done (local parts)        | `docker build` + run; `node deploy/smoke.ts http://localhost:8080` (110 checks passed); E2E against the image (16 passed, 2 version-swapping tests skipped); offline reload after `docker stop` verified                                                                                                                                                                               |
| WP0.8 Diagnostics    | Done                      | `e2e/diagnostics.spec.ts`: `?debug=1` diagnostics export; alert harness exports results as a file; variant B service-worker timer fires while the page is hidden; capability probe export                                                                                                                                                                                              |
| M0 cleanup           | Done                      | `pnpm verify` green (89 unit tests, 20 E2E); entry JS 211.42 → 202.54 kB gzip (backup chunk 9.5 kB, lazy); `e2e/backup.spec.ts` exports and restores offline on first use (also against the nginx image); `shadcn@4.23.0 add input` through `#ui/*`; licence gate with recorded approvals; docs v0.3 (Mermaid: 9 blocks parse; all § references, ADR links and TD/T/QS/OQ IDs resolve) |
| M1 contract          | Done                      | `pnpm verify` green (101 unit tests, 20 E2E); shared domain types and source registry (section 5): 22 seeded sources (3 excluded, 19 mapping) pass `packages/rules/scripts/sources.test.ts`; a throwaway tools package checked every stub citation through `@powr/rules/sources/node` and `checkSourceRefs` (then removed); entry JS 202.55 → 204.29 kB gzip                           |
| TD-21                | Done                      | `pnpm --filter @powr/web ui:add input --overwrite --yes` through the new script: import rewritten to `#ui/cn`, `cn` removed, `package.json` and lockfile unchanged; `e2e/shell.spec.ts` checks the shadcn `Input` in four theme × OS combinations (fails with Tailwind's own `dark:`); `scripts/theme-bridge.test.ts` checks AA for 18 bridged pairs; entry CSS 3.79 → 4.51 kB gzip    |
| Backup hardening     | Done                      | `FC_SEED=637004341` reproduced the `__proto__` failure; `packages/formats/test/untrusted.test.ts` (seed case, crafted pollution attempts, deep nesting, entry names, never-silent property); 10,000 runs per backup property with a random seed green; each guard checked by disabling it once (tests fail)                                                                            |
| TD-17                | Done                      | Entry JS 202.07 → **176.44 kB** gzip (`pnpm size`), budget 230 → 186 kB; `scripts/startup-check.ts`: 8 first-wave scripts, 0 with Zod (failed on the old build); new E2E `the session route validates its search parameters` passed before and after; 22 E2E green                                                                                                                     |
| Docs v0.4            | Done                      | Technical concept v0.4 and ADR amendments (0001, 0003, 0009, 0012, 0013, 0018, 0020); the earlier agents' checkers: 9 Mermaid blocks parse, all § references, ADR links and TD/T/QS/OQ/TA IDs resolve (0 problems)                                                                                                                                                                     |

## 3. Deviations from the concept and ADRs

| Date       | WP         | Concept / ADR says                                                                          | What I did                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Why                                                                                                                                                                                                                                                  | Follow-up                                                                                                                                                                                                                                                                 |
| ---------- | ---------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-24 | 0.1        | `minimumReleaseAge: 10080` (§8.18, ADR-0021) and the exact versions of Appendix B           | Kept both; added `minimumReleaseAgeExclude` for the pinned versions that were < 7 days old (oxlint 1.95.0, oxfmt 0.80.0, oxlint-tsgolint 7.0.2008, knip 6.48.0, lucide-react 1.78.0, vitest 5.1.1, fast-check 4.11.0, pnpm 12.23.0) and their platform binary packages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | pnpm refuses immature versions otherwise; name patterns cannot carry versions, so binary packages are excluded by name                                                                                                                               | Remove the entries after 2026-12-01 (section 4, TD-18). **Docs amended in v0.3** (ADR-0021, §8.18)                                                                                                                                                                        |
| 2026-11-24 | 0.1        | Appendix B: tailwind-merge 3.7                                                              | 3.7.0 (3.7.1 was 5 days old); `@babel/core` 8.1.2 (8.1.3 too new)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | minimumReleaseAge                                                                                                                                                                                                                                    | **Docs amended in v0.3** (Appendix B)                                                                                                                                                                                                                                     |
| 2026-11-24 | 0.1        | "No ESLint in the repository" (ADR-0017)                                                    | ESLint 10.15.0 is installed as an auto-installed **peer** of eslint-plugin-lingui and eslint-plugin-react-hooks; it is never run. eslint-plugin-lingui 0.16 and `@typescript-eslint/utils` declare TypeScript < 6.1 (peer warning); the rules work without type info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | The alpha JS plugins need their peer to load                                                                                                                                                                                                         | Re-check when the plugins support TS 7. **Docs amended in v0.3** (ADR-0017, §8.21)                                                                                                                                                                                        |
| 2026-11-24 | 0.1        | React Compiler rules only via the alpha JS plugin, as warnings (§8.5, OQ-T10)               | Same, but oxlint 1.95 also ships native ports of some of them (e.g. `react/purity`) in the blocking `correctness` category                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Native rules are stable and cheap                                                                                                                                                                                                                    | Enable the native rules explicitly and narrow OQ-T10 after a parity check (TD-10). **Docs amended in v0.3** (§8.5, ADR-0017)                                                                                                                                              |
| 2026-11-24 | 0.1        | `react/jsx-no-literals` with an allow-list (§8.15)                                          | `noStrings: false` + `restrictedAttributes` (aria-label, title, placeholder, alt, label) + `<Trans>`/`<Plural>` allowed; `lingui/no-unlocalized-strings` (warn) scoped to features/ui/routes with identifier-like strings ignored; the debug harness pages are exempt from both                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | In oxlint `noStrings: true` flags every attribute literal (className, to, …)                                                                                                                                                                         | **Docs amended in v0.3** (ADR-0016, §8.15)                                                                                                                                                                                                                                |
| 2026-11-24 | 0.1        | Lint cannot ban member calls; the arch test scans for `Math.random` (§5.2)                  | Arch test as specified, plus native `no-restricted-properties` for `Math.random` in the domain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Earlier feedback in the editor                                                                                                                                                                                                                       | **Docs amended in v0.3** (§5.2, ADR-0001)                                                                                                                                                                                                                                 |
| 2026-11-24 | 0.1        | `@powr/rules` depends on `@powr/domain` (§5.1)                                              | No dependency in M0 (nothing to import yet; knip flags unused dependencies); the matrix still allows it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Honest dependency graph                                                                                                                                                                                                                              | Add when the `RuleSet` types land (M1). **Docs amended in v0.3** (§5.1, ADR-0001)                                                                                                                                                                                         |
| 2026-11-24 | 0.1        | §8.2.1 lists `dexie-react-hooks`                                                            | Not used: own `useObservable` on `useSyncExternalStore` (as §8.5 describes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | One mechanism instead of two                                                                                                                                                                                                                         | **Docs amended in v0.3** (§5.2, §8.2.1, Appendix B, ADR-0006)                                                                                                                                                                                                             |
| 2026-11-24 | 0.1        | Feature flags in `apps/web/src/features.ts` (§8.22)                                         | `apps/web/src/feature-flags.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Avoids confusion with the `features/` folder                                                                                                                                                                                                         | **Docs amended in v0.3** (§5.3, §8.22)                                                                                                                                                                                                                                    |
| 2026-11-24 | 0.2        | Licence tool uses spdx-expression-parse **and** spdx-satisfies                              | Own evaluator over the spdx-expression-parse AST; `LicenseRef-Own-Work` on the allowlist for own assets; reviewed exception for `spdx-exceptions@2.5.0` (CC-BY-3.0, build-only data of the licence tool)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The evaluator must record the chosen licence of `OR` expressions and apply the glob deny list                                                                                                                                                        | Exception and `LicenseRef-Own-Work` approved by the product owner on 2026-11-24 (see the cleanup rows). **Docs amended in v0.3** (§8.21, ADR-0018)                                                                                                                        |
| 2026-11-24 | 0.2        | Plugin collects in `generateBundle`, attributions precached (§8.21)                         | The app build writes its package list; the service-worker build's plugin merges both lists, writes `attributions.json` and fails the build, before Workbox builds the precache manifest                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Two builds (app + SW); this ordering puts `attributions.json` into the precache                                                                                                                                                                      | **Docs amended in v0.3** (§8.21, ADR-0018)                                                                                                                                                                                                                                |
| 2026-11-24 | 0.2        | CI pipeline incl. Lighthouse CI and component tests (§8.21)                                 | `ci.yml`: quality, typecheck, test, build (licence, size, image, header smoke test), E2E (test server and image). `deploy.yml` (beta via `workflow_run` with the CI image artifact; production on tag with approval), `rollback.yml`. Actions pinned by commit SHA; Dependabot for npm, Actions, Docker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Lighthouse CI and Vitest browser-mode component tests are not part of M0's work packages                                                                                                                                                             | Add in M1 (section 4, TD-11, TD-12). **Docs amended in v0.3** (§8.20, §8.21)                                                                                                                                                                                              |
| 2026-11-24 | 0.2        | —                                                                                           | actionlint run via its official Docker image (`rhysd/actionlint:1.7.12`, MIT)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | No permissive binary in the toolchain; the image bundles shellcheck (GPL-3.0) as a separate tool, used only locally, never a dependency or shipped                                                                                                   | **Docs amended in v0.3** (§8.21)                                                                                                                                                                                                                                          |
| 2026-11-24 | 0.3        | `z.config({ jitless: true })` at startup (§7.3, ADR-0009)                                   | Every package with schemas (rules, content, formats) and the app import `z` from a local `zod.ts` that sets `jitless` first; lint forbids importing `zod` directly there; the content catalog is built lazily                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Zod 4.6 probes `new Function` when an object schema is **created** (module top level), which triggers a CSP violation report before any startup code can run in a code-split bundle                                                                  | **Docs amended in v0.3** (§7.3, ADR-0009); the lint ban now covers all of `apps/web` (cleanup row) Since v0.4 the app imports no Zod at all (TD-17 row below)                                                                                                             |
| 2026-11-24 | 0.3        | Lingui macro through Babel (`@rolldown/plugin-babel`) (§8.15)                               | As specified; verified under Rolldown (macros compiled, catalogs loaded). Lingui 6.12 now recommends its native `macroTransform` and prints a warning, suppressed via `LINGUI_SUPPRESS_BABEL_WARNING`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Concept decision; Babel is needed for the React Compiler anyway                                                                                                                                                                                      | Evaluate the native macro transform (faster, one fewer Babel plugin; TD-09). **Docs amended in v0.3** (§8.15, ADR-0016)                                                                                                                                                   |
| 2026-11-24 | 0.3        | CI fails if `lingui extract` changes the catalog                                            | Also `pnpm build` runs the catalog check first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Production macros drop source messages, so a stale catalog shows message hashes in the UI; `failOnMissing` does not catch unextracted messages                                                                                                       | **Docs amended in v0.3** (§8.15, ADR-0016)                                                                                                                                                                                                                                |
| 2026-11-24 | 0.3        | "shadcn on Base UI init" (WP0.3)                                                            | `components.json` written by hand (style `base-nova`, Base UI); Button, segmented control (ToggleGroup) and NumberField written in shadcn style on Base UI in `src/ui`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `shadcn init` 4.23 needs a path alias or package `imports` (ADR-0002 forbids path aliases) and adds the Geist web font (conflicts with OQ-T7), `tw-animate-css` and the `shadcn` package                                                             | Resolved: `#ui/*` approved by the product owner on 2026-11-24 (cleanup rows). **Docs amended in v0.3** (§8.9.2, ADR-0002, ADR-0003)                                                                                                                                       |
| 2026-11-24 | 0.3        | —                                                                                           | Base UI's `CSPProvider disableStyleElements` at the root                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Base UI would otherwise inject `<style>` elements, blocked by `style-src 'self'`                                                                                                                                                                     | **Docs amended in v0.3** (§7.3, ADR-0003)                                                                                                                                                                                                                                 |
| 2026-11-24 | 0.3        | Pre-paint theme script as an external file (§8.9.3)                                         | `public/theme-init.js` (not content-hashed) and added to nginx's `no-cache` list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | It must be a classic synchronous script                                                                                                                                                                                                              | **Docs amended in v0.3** (§7.3, §8.9.3, ADR-0008)                                                                                                                                                                                                                         |
| 2026-11-24 | 0.4        | `virtual:pwa-register/react` (`useRegisterSW`) (§8.4, ADR-0008)                             | Own registration (`src/infrastructure/pwa/registration.ts`, ~90 lines); `injectRegister: false`; `workbox-window` is not a dependency                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | workbox-window stops listening to `updatefound` after the first update it considers external, and a gate-rejected install mid-workout is exactly that, so the post-workout update would not be offered                                               | **Docs amended in v0.3** (§8.4, ADR-0008)                                                                                                                                                                                                                                 |
| 2026-11-24 | 0.4        | `src/sw/service-worker.ts`                                                                  | `src/sw/sw.ts`, built as IIFE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | vite-plugin-pwa derives the output name `/sw.js` from the source file name                                                                                                                                                                           | **Docs amended in v0.3** (§5.3, §8.4, ADR-0008)                                                                                                                                                                                                                           |
| 2026-11-24 | 0.4        | Icons from `@vite-pwa/assets-generator` (§8.4)                                              | Own generator `tools/icons` (Node, zlib PNG encoder) for the placeholder logo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | assets-generator depends on sharp, whose prebuilt libvips binary is LGPL-3.0                                                                                                                                                                         | **Docs amended in v0.3** (§8.4, Appendix B, ADR-0008)                                                                                                                                                                                                                     |
| 2026-11-24 | 0.4        | `changelog.json` shown with the update notice (§8.4)                                        | Not generated yet; `version.json` is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | No release notes exist before the first release (`tools/release-notes`)                                                                                                                                                                              | Add with the first release (TD-20). **Docs amended in v0.3** (§7.1, §8.4, ADR-0008)                                                                                                                                                                                       |
| 2026-11-24 | 0.4/0.7    | `Permissions-Policy` includes `bluetooth=()` (§7.3)                                         | Removed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Chromium 159 logs "Unrecognized feature: 'bluetooth'" on every page load; the entry has no effect                                                                                                                                                    | **Docs amended in v0.3** (§7.3)                                                                                                                                                                                                                                           |
| 2026-11-24 | 0.5        | Dexie `powr` v1 with all MVP tables (§8.2.2)                                                | v1 holds the M0 tables only (meta, settings, sessions, sets), as WP0.5 asks; indexes use nested key paths (`startedAt.epochMs`, `[exerciseId+performedAt.epochMs]`) instead of denormalized `startedAtMs`/`performedAtMs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Smaller M0 scope; no duplicated fields                                                                                                                                                                                                               | Decide before the first beta with user data whether the remaining tables extend v1 or become v2 (TD-19). **Docs amended in v0.3** (§8.2.2, ADR-0006)                                                                                                                      |
| 2026-11-24 | 0.5        | `powr-runtime` shared with the service worker                                               | Plain IndexedDB (no Dexie), schema version 1, one `kv` store                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Keeps the service worker small and Dexie-free (lint rule)                                                                                                                                                                                            | **Docs amended in v0.3** (§8.2.1, ADR-0006)                                                                                                                                                                                                                               |
| 2026-11-24 | 0.6        | ZIP built "off the main thread via fflate's async API" (§6.4)                               | fflate's sync API (`zipSync`/`unzipSync`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | The async API starts workers from `blob:` URLs, which `worker-src 'self'` blocks                                                                                                                                                                     | Run the codec in the engine worker for large backups (M1+, TD-16). **Docs amended in v0.3** (§6.4, ADR-0013)                                                                                                                                                              |
| 2026-11-24 | 0.6        | Arrays sorted by primary key for deterministic output                                       | Also canonical JSON (sorted object keys)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Equal data must give equal bytes and hashes regardless of property order                                                                                                                                                                             | Note in `docs/formats/backup-format.md` when written. **Docs amended in v0.3** (§6.4, ADR-0013)                                                                                                                                                                           |
| 2026-11-24 | 0.6        | Zip-bomb ratio ≤ 200 per entry (§8.3.5)                                                     | Applied to entries larger than 1 MiB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Small, highly repetitive JSON legitimately exceeds the ratio                                                                                                                                                                                         | **Docs amended in v0.3** (§8.3.5, ADR-0013)                                                                                                                                                                                                                               |
| 2026-11-24 | 0.7        | nginx excerpt `types { application/manifest+json webmanifest; }` in the server block (§7.3) | `include /etc/nginx/mime.types;` before it; added gzip, `listen [::]:8080`, `try_files` for `/icons/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | A `types` block replaces the inherited MIME map, so every other file would be served as `application/octet-stream`                                                                                                                                   | **Docs amended in v0.3** (§7.3)                                                                                                                                                                                                                                           |
| 2026-11-24 | E2E        | Playwright against `vite preview` with the service worker (§8.20)                           | `apps/web/e2e/static-server.ts` serves `dist` with the headers from `deploy/security-headers.conf` and nginx's cache rules (one server per test, so tests can stop it or deploy N+1); the same suite runs against the Docker image via `E2E_BASE_URL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `vite preview` sends no CSP; the update test must swap versions on one origin                                                                                                                                                                        | **Docs amended in v0.3** (§8.20, ADR-0010)                                                                                                                                                                                                                                |
| 2026-11-24 | Cleanup    | ADR-0009: large schemas in lazily loaded chunks; one entry per package (§5.1)               | `@powr/formats` and `@powr/application` got a second entry `./backup` (`package.json` `exports`). The roots are free of Zod schemas and fflate: `RAW_TABLES` (keys and schemas) became the schema-free `RAW_TABLE_KEYS` in `records/tables.ts`; validation moved to `records/validate.ts`. `src/hooks/use-data.ts` loads `@powr/application/backup` with `import()`. oxlint forbids static value imports of both entries in app code (type imports allowed); a boundary probe covers it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Product-owner decision 2026-11-24 (bundle). Entry JS 211.42 → 202.47 kB gzip; the backup chunk is 9.5 kB. oxlint's `no-restricted-imports` also checks `import()`, so the one loader carries the only disable comment                                | **Docs amended in v0.3** (§5.1, §5.2, §6.4, §8.19, ADR-0001, ADR-0009, ADR-0013)                                                                                                                                                                                          |
| 2026-11-24 | Cleanup    | Everything is precached, so lazy chunks work offline (§8.4, §8.19)                          | New E2E test in `e2e/backup.spec.ts`: install, stop the server, export and restore; it asserts that the backup chunk is not loaded before the first export and is loaded once after it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Proves the lazy chunk is precached: with the chunk removed from the built precache manifest, the test fails (checked once by hand)                                                                                                                   | **Docs amended in v0.3** (§6.5, §8.19, §8.20)                                                                                                                                                                                                                             |
| 2026-11-24 | Cleanup    | ADR-0002: no path aliases                                                                   | `#ui/*` subpath imports in `apps/web/package.json`: `#ui/cn` → `./src/ui/cn.ts`, `#ui/*` → `./src/ui/*.tsx`. `components.json` aliases `#ui`, `#ui/cn`, `#ui/lib`, `#ui/hooks`. All design-system imports use `#ui/*`; oxfmt has a `subpath` import group; oxlint regex patterns keep the alias out of infrastructure and the service worker; `ui:add` script pins `shadcn@4.23.0`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Product-owner decision 2026-11-24 (shadcn alias approved). The `.tsx` wildcard target makes the CLI write extensionless imports that resolve exactly. Lib and hook entries (`.ts`) come with the first such file, because knip flags unused subpaths | **Docs amended in v0.3** (§5.3, §8.9.2, ADR-0002, ADR-0003)                                                                                                                                                                                                               |
| 2026-11-24 | Cleanup    | shadcn components come from the registry (ADR-0003)                                         | `shadcn@4.23.0 add input` created `src/ui/input.tsx` and added `cn@0.5.2`. Kept the component; reverted the `cn` dependency (import changed to `#ui/cn`); mapped shadcn token names to POWR tokens; 48 px target; global focus outline instead of the ring; no `dark:` classes. `Input` replaced the hand-written text inputs; `jsx-a11y/label-has-associated-control` lists `Input` as a control                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Constraints of the decision: no extra dependencies, system fonts. shadcn's registry now imports `cn` from the `cn` npm package, but `#ui/cn` already merges classes. The CLI changed no CSS, fonts or other files                                    | Decide on adopting `cn` and on a token bridge when more components arrive (TD-21). **Docs amended in v0.3** (§8.9.2, ADR-0003)                                                                                                                                            |
| 2026-11-24 | Cleanup    | ADR-0018: exceptions carry reviewer and date                                                | Exceptions also carry `approval`, and the gate ignores an exception without it (policy test). Approvals for `LicenseRef-Own-Work` (allowlist entry and each asset in `assets-inventory.yaml`) and for `spdx-exceptions@2.5.0` recorded with approver and date                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Product-owner decision 2026-11-24 (licence exceptions approved)                                                                                                                                                                                      | **Docs amended in v0.3** (§8.21, ADR-0018)                                                                                                                                                                                                                                |
| 2026-11-24 | Cleanup    | ADR-0009: JIT-less Zod through a local `zod.ts`, lint-enforced                              | The ban on importing `zod` directly now covers every `apps/web` override (before: packages and `src/routes` only); `apps/web/src/zod.ts` is exempt like the packages' `zod.ts` files; boundary probe added                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The CSP guarantee should hold app-wide, not only where schemas exist today                                                                                                                                                                           | **Docs amended in v0.3** (§5.2, §7.3, ADR-0009); superseded in v0.4: the app has no Zod and no `src/zod.ts` any more (TD-17 row below)                                                                                                                                    |
| 2026-11-24 | Cleanup    | §8.2.1, §8.21 and Appendix B list `dexie-react-hooks` and `spdx-satisfies`                  | knip reports no unused dependencies: neither package was ever installed. Removed from the docs and from the oxlint list of storage libraries                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Product-owner decision 2026-11-24 (unused dependencies)                                                                                                                                                                                              | **Docs amended in v0.3** (§5.2, §8.2.1, §8.21, Appendix B)                                                                                                                                                                                                                |
| 2026-11-24 | Cleanup    | —                                                                                           | `apps/web/vite.config.ts` reformatted with oxfmt (no behaviour change)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | It was committed with double quotes and an 80-column width, so `pnpm format:check` (and with it `pnpm verify`) failed on `main`                                                                                                                      | None                                                                                                                                                                                                                                                                      |
| 2026-11-24 | Cleanup    | Entry JS ≤ 230 kB gzip (§8.19)                                                              | Zod's core (about 25 kB gzip) is still in the entry chunk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | The M0 content stub is parsed with Zod at startup, and `@powr/rules` exports its schemas from the package root; outside the scope of the backup lazy-load                                                                                            | M1, with build-time validation of content and rules (TD-17). **Docs amended in v0.3** (§8.19, ADR-0009) **Closed in the M1 cleanup** (TD-17 row below); **Docs amended in v0.4** (§5.2, §8.19, §11.2, ADR-0009)                                                           |
| 2026-11-24 | M1         | One `packages/rules/sources.yaml` (§5.3, §8.6.1, §8.6.5, §8.12; ADR-0012)                   | A directory `packages/rules/data/sources/*.yaml`, merged and validated as one registry; IDs must be unique across all files. Seeded `excluded.yaml` and `exercise-mapping.yaml`; the README there assigns topic files (`load.yaml`, `volume.yaml`, …) to the rules engine work and `content-*.yaml` to the content work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Rules engine and content are built in parallel; one file per owner and topic avoids merge conflicts and keeps diffs small                                                                                                                            | **Docs amended in v0.4** (§5.3 tree, §8.6.1, §8.6.5 check 2, §8.12, ADR-0012)                                                                                                                                                                                             |
| 2026-11-24 | M1         | Source IDs such as `kubo-2019`, `grgic-2018-rest`, `remmert-2025-preprint` (§8.6.1, §8.12)  | `src.<first author><year>[a\|b]` (`src.kubo2019`, `src.barbalho2020a`); without an author in the EB `src.pmid…`, `src.nct…`, `src.researchsquare…`; POWR's own documents `src.powr-<topic>`. `isSourceId` in `@powr/domain` checks the format; `paramDefSchema.sources` and the content schema use it. Full convention: `packages/rules/data/sources/README.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | One checkable scheme with a prefix, like `ex.`, `mu.` and `eq.`; the EB itself uses `2023a`/`2023b` suffixes                                                                                                                                         | **Docs amended in v0.4** (§8.1, §8.6.1 examples, §8.12, ADR-0012)                                                                                                                                                                                                         |
| 2026-11-24 | M1         | `SourceDef { id, citation, url?, tag, status, reason? }` (§8.6.1)                           | Added optional `seeAlso` (further http(s) links to the same work) and `note` (caveats); `reason` is required for excluded and forbidden for active entries; unknown keys fail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | The EB gives several links for one work (Pelland 2026: PubMed and the sponet record; Retraction Watch for Barbalho), and caveats such as "verify before hard-coding" are not exclusion reasons                                                       | **Docs amended in v0.4** (§8.6.1, ADR-0012)                                                                                                                                                                                                                               |
| 2026-11-24 | M1         | `EvidenceTag` in the rules section (§8.6.1); M0 kept `EVIDENCE_TAGS` in `@powr/rules`       | `EVIDENCE_TAGS`/`EvidenceTag` and `MAPPING_EVIDENCE` live in `@powr/domain` (`model/evidence.ts`); `@powr/rules` builds `evidenceTagSchema` from them and now declares its `@powr/domain` dependency (package.json and tsconfig)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Domain code (explanations, MAP-03 ranking) and content need the tags without depending on rules; closes the M0 row on the deferred `@powr/rules` → `@powr/domain` dependency                                                                         | **Docs amended in v0.4** (§5.1, §5.6)                                                                                                                                                                                                                                     |
| 2026-11-24 | M1         | No shared source loader; rules and content builds both check sources (§8.6.5, §8.12)        | Pure validator in the subpath entry `@powr/rules/sources` (`sourceDefSchema`, `buildSourceRegistry`, `checkSourceRefs`); Node loader in `@powr/rules/sources/node` (`packages/rules/scripts/sources.ts`: `loadSourceRegistry`, `SOURCES_DIR`). `packages/rules/scripts/` is its own TS project with Node types (root tsconfig reference); Vitest and knip include `packages/*/scripts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | The rules build and a tools/ content build can both import it while the `@powr/content` runtime stays free of `@powr/rules`; `src/` stays Node-free; subpath entries keep it out of the app bundle                                                   | **Docs amended in v0.4** (§5.1, §5.3, §8.6.1, ADR-0001, ADR-0012)                                                                                                                                                                                                         |
| 2026-11-24 | M1         | Movement patterns as listed in PRD §7.1 (18)                                                | `MOVEMENT_PATTERNS`: the 18 PRD members plus `shoulderHorizontalAdduction`, `shoulderHorizontalAbduction`, `shrug`, `wristFlexion`, `wristExtension`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | EXL-01 needs a pattern for every exercise, and the §7.2 groups forearms, upper traps and rear delts and the EB mapping rows fly, rear-delt fly and shrug have none in the PRD list                                                                   | **Docs amended in v0.4** (technical concept §5.6); amending PRD §7.1 stays with the product owner (the PRD was not edited)                                                                                                                                                |
| 2026-11-24 | M1         | Tag set of the EB "How to read the evidence tags" (§8.6.1)                                  | Kept the 14 tags. The EB body also marks two acute EMG studies `[EMG]` (Ema 2016, PubMed 34644424); the registry tags them `OBS` with a note, and EMG stays a muscle-credit evidence code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `[EMG]` is not in the EB tag table and has no UI label in §8.6.4                                                                                                                                                                                     | **Docs amended in v0.4** (§8.6.1, §8.6.4, ADR-0012)                                                                                                                                                                                                                       |
| 2026-11-24 | M1         | Every muscle credit cites a registry source (§8.12)                                         | Added `src.powr-eb-mapping` (tag `INF`), the EB mapping table itself, as the source of credits the EB rates C (convention or biomechanics)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The EB's only basis for C rows is its own convention; without a sanctioned ID each author would invent one                                                                                                                                           | **Docs amended in v0.4** (§8.6.1, §8.12, ADR-0012)                                                                                                                                                                                                                        |
| 2026-11-24 | TD-21      | §8.9.2 review: replace the `cn` import, rename shadcn tokens, remove `dark:` (TD-21 open)   | **TD-21 resolved by product owner 2026-11-24: keep `#ui/cn` + colour bridge.** `ui:add` runs `scripts/ui-add.ts`: the pinned CLI, then `from "cn"` → `#ui/cn`, the `cn` package removed, `src/ui` formatted. `app.css` aliases shadcn's colour names to POWR tokens (`--input` → `--fg-muted`), scopes `dark:` to the theme attribute and sets the default border colour. `Input` re-added through the script; edits: target, radius, focus, one `dark:` class                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `components.json` aliases cannot redirect the bare `cn` package import. The bridge lets registry components render with POWR colours in both themes at WCAG AA (`--border` is decorative, < 3:1, so `--input` uses `--fg-muted`)                     | **Docs amended in v0.4** (§8.9.2 workflow steps 1, 2, 4; §8.9.3; TD-21 closed in §11.2; ADR-0003)                                                                                                                                                                         |
| 2026-11-24 | Cleanup M1 | Backup import validates untrusted files strictly (§8.3.5, NFR-SEC-02)                       | **`__proto__` finding.** A fast-check run (seed 637004341, `packages/formats/test/backup.test.ts`, both round-trip properties) produced a meta value `{ "__proto__": 0 }`. Root cause: `encodeBackup` writes it as an own key (`Object.fromEntries`), `JSON.parse` reads it back as an own key, and Zod 4's record parser (inside `z.json()`) skips `__proto__` without an issue, so the restore succeeded with `value: {}` after every checksum passed (silent data loss). Crafted files with recomputed hashes showed two more weaknesses: about 2,000 levels of nesting overflowed Zod's recursive JSON schema (`RangeError`: the import threw instead of returning an error), and a ZIP entry named `__proto__` replaced the prototype of fflate's plain result object and slipped past the unlisted-entry check (`ok: true`); a repeated entry name silently replaced the earlier one. **Not exploitable for prototype pollution:** `JSON.parse` creates own keys, Zod skips `__proto__` when copying, strict schemas reject it as an unknown key, and nothing merges parsed data by assignment; `Object.prototype` stayed untouched in every case. **Fix:** `packages/formats/src/json.ts` (`findUnsafeJson`, `parseUntrustedJson`: iterative walk, reserved keys `__proto__`/`constructor`/`prototype`, depth ≤ 32) runs on the manifest and every data file before migration and schemas (`invalidManifest`/`invalidData` with key and path); the meta value schema runs the same check before `z.json()`; `encodeBackup` throws on such data; `unzipWithLimits` rejects reserved and repeated entry names from the central directory and keeps entries in a `Map` (every central-directory name must arrive) | Backups are untrusted input; a restore must never differ silently from the file, and a crafted file must fail with a typed error, not an exception                                                                                                   | **Docs amended in v0.4** (§6.5, §8.3.5, §8.20, ADR-0009, ADR-0013); the format document and a hostile fixture remain (TD-22)                                                                                                                                              |
| 2026-11-24 | Cleanup M1 | Zod's core still in the entry chunk (TD-17)                                                 | `@powr/rules` root made Zod-free (`RULES_VERSION`, `rulesStamp`, `matchesCondition`, types); schemas → `@powr/rules/schema`, resolver → `@powr/rules/resolve` (rules tests and scripts import those). `/session` validates `?source` with `validateSessionSearch` (`src/features/session/search.ts`, unit-tested; unknown parameters dropped, an invalid value throws into the route error boundary as the Zod schema did). `apps/web/src/zod.ts` and the app's `zod` dependency removed. oxlint: `zod` banned in all of `apps/web`; static value imports of `@powr/rules/*` subpaths banned in app code and `packages/application` (type imports allowed); boundary probes for both. New build check `apps/web/scripts/startup-check.ts` in `pnpm size`: no first-wave script may contain Zod                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Entry JS 202.07 → 176.44 kB gzip (the M1-B experiment predicted 176.39 kB)                                                                                                                                                                           | **Docs amended in v0.4** (§4, §5.1, §5.2, §7.3, §8.5, §8.9.1, §8.19, §11.2, ADR-0001, ADR-0009)                                                                                                                                                                           |
| 2026-11-24 | Cleanup M1 | Entry JS ≤ 230 kB gzip (§8.19)                                                              | `size-limit` budget for entry JS lowered to **186 kB** (176.44 kB measured + about 10 kB); 230 kB stays the concept's ceiling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | A budget close to the real size makes a regression visible in the PR that causes it                                                                                                                                                                  | **Docs amended in v0.4** (§8.19)                                                                                                                                                                                                                                          |
| 2026-11-24 | Cleanup M1 | M1-A: squat and deadlift use the Nuzzo pooled curve (`pooled` in content)                   | **Product-owner decision 2026-11-24:** the competition squat and deadlift and their close variants (back squat, paused back squat, deadlift, sumo deadlift, deficit deadlift) use `curveClass: benchLike` (Wathan/RTS equation) until the personal curve fit exists. The content YAML change is made separately in the main checkout; not edited here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | The pooled curve includes leg-press data and suggested about 5–6% more load than the RTS chart for 5 @ RPE 8; there are no squat- or deadlift-specific reps-vs-%1RM data                                                                             | **Docs amended in v0.4** (§5.6, §8.7.4, §8.7.7, §8.12, ADR-0020); rename of `benchLike` (e.g. `equation`) proposed as a contract change (TD-30); revisit with the curve fit (TD-26)                                                                                       |
| 2026-11-24 | Cleanup M1 | M1-B: the four `powr-content-*` licence entries await approval                              | **Product-owner decision 2026-11-24:** approved as own work. The inventory change is made separately in the main checkout; not edited here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | LEG-08                                                                                                                                                                                                                                               | **Docs amended in v0.4** (§8.12, ADR-0018). Note: the build writes these entries from `tools/content-build/src/inventory.ts` (`OWN_WORK.approval` still says pending), so the approval text must change there too, or `pnpm content:check` reports the inventory as stale |

## 4. Not done in M0 / open items

- Vitest browser-mode component tests (`@vitest/browser-playwright`, Testing Library) and the Lingui
  pseudo-locale expansion test: done in M2b (section "M2b screens").
- Lighthouse CI and Trusted Types in dev/E2E builds; the token contrast gate (`tools/tokens-check`)
  is done in M2b.
- QS-01 in full: randomized process kills (200 runs, `SIGKILL` of the browser). M0 covers reload and an
  abrupt close of a persistent browser profile.
- The pre-session "Update first" offer (§6.3 rule 2) needs the session start sheet (M3); the safety-copy
  UI (download/delete) and the "POWR was updated in another window" handling (§6.8) are not built yet.
- Save-picker delivery of backups (Android Chrome 132+) after device test S-2.
- **Reminder: remove `minimumReleaseAgeExclude` from `pnpm-workspace.yaml` after 2026-12-01**
  (ADR-0021, TD-18).
- Entry JS is 176.4 kB gzip (budget 186 kB since the M1 cleanup; 211.4 kB in M0, 202.1 kB after the
  M1 merge). The startup path is free of Zod (TD-17 closed; lint rules and `scripts/startup-check.ts`).
- Tempo of the competition lifts: decided by the content work, `2-0-X-0`; paused variants carry the
  pause (`2-2-X-0`, `2-3-X-0`). Docs amended in v0.4 (§5.6).
- Types for the muscle taxonomy, the equipment catalog and templates live in `@powr/content`
  (`src/types.ts`) for now (M1-B); what the engine needs moves into `@powr/domain` with the
  generator (M2). Presets are not mapped to `Implement` yet (TD-29). Docs amended in v0.4 (§5.6).
- Custom exercises (EXL-04) need a source for user-set credits, because `MuscleCredit.source` is
  required.
- TD-21 is resolved (section 3): `#ui/cn` stays, and `app.css` bridges shadcn's colour names. Not
  bridged: shadcn's radius scale (`--radius`, used through `rounded-*` and `var(--radius-md)`) and
  its chart colours; the `ui:add` review still replaces translucent focus rings (`ring-ring/50` is
  below 3:1) with the global outline and sets 48 px targets.
- These items are also in the technical concept's technical-debt list (§11.2): component and
  pseudo-locale tests TD-11; Lighthouse CI, token gate and Trusted Types TD-12; QS-01 TD-13; update
  and recovery UI TD-14; save picker TD-15. M1 follow-ups (v0.4): backup format document and hostile
  fixture TD-22; 74 → 150+ exercises TD-23; 8 missing templates TD-24; `verified: false`
  verification passes TD-25; personal curve fit and per-exercise correction TD-26; PR detection and
  calibration TD-27; English `why.*` messages TD-28; presets → `Implement` TD-29; curve-class rename
  TD-30; hashed `VersionStamp.rules` TD-31.

## 5. M1 shared contract: domain types and source registry

Landed on 2026-11-24, before the M1 engine-and-rules work and the content work start in parallel.
Both build on the names below; a change to them is a contract change for both.

### 5.1 Exports of `@powr/domain` (types and constants only)

All are exported from the package root (`packages/domain/src/index.ts`). The constants are tiny
`as const` arrays that content validates against at runtime; the union types derive from them.
Unused ones are tree-shaken, so only what the content schema uses reaches the entry chunk.

| File                | Constants                                                                                                                                                          | Types                                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ids/index.ts`      | format guards `isContentExerciseId`, `isMuscleId`, `isEquipmentId`, `isSourceId`                                                                                   | `Brand`, `ExerciseId`, `MuscleId`, `EquipmentId`, `SourceId`, `SessionId`, `SetId`, `LocalDate`                                                                                                                                                                                          |
| `model/evidence.ts` | `EVIDENCE_TAGS`, `MAPPING_EVIDENCE`                                                                                                                                | `EvidenceTag`, `MappingEvidence`                                                                                                                                                                                                                                                         |
| `model/training.ts` | `GOALS`, `TRAINING_STYLES`                                                                                                                                         | `Goal`, `TrainingStyle`                                                                                                                                                                                                                                                                  |
| `model/exercise.ts` | `MOVEMENT_PATTERNS`, `MECHANICS`, `COMPETITION_LIFTS`, `LOAD_TYPES`, `CURVE_CLASSES`, `REST_CLASSES`, `CREDIT_VALUES`, `OVERLOAD_SUITABILITY`, `EXERCISE_STATUSES` | `MovementPattern`, `Mechanics`, `CompetitionLift`, `LoadType`, `CurveClass`, `RestClass`, `CreditValue`, `OverloadSuitability`, `ExerciseStatus`, `MuscleCredit`, `EquipmentRequirement`, `LoadModel`, `RepRange`, `ExerciseDefaults`, `ExerciseRanking`, `ExerciseDef`, `LocalizedText` |

ID formats: `ex.<slug>`, `mu.<group>[.<sub-region>]` (one sub-region level), `eq.<slug>`,
`src.<…>` (section 5.3); a slug is lowercase ASCII words joined by single hyphens. `ExerciseDef`
follows the technical concept §5.6 sketch; its inline parts got names (`EquipmentRequirement`,
`LoadModel`, `ExerciseDefaults`, `ExerciseRanking`, `RepRange`).

### 5.2 Enum members and their sources

Member values are camelCase, like the existing unions (`TechniqueKind`, `curveClass`).

| Constant               | Members                                                                                                                                                                                                                                                                                                                                                                     | Source                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `MOVEMENT_PATTERNS`    | `squat`, `hinge`, `horizontalPush`, `verticalPush`, `horizontalPull`, `verticalPull`, `lunge`, `kneeExtension`, `kneeFlexion`, `elbowFlexion`, `elbowExtension`, `shoulderAbduction`, `hipExtension`, `hipAbduction`, `hipAdduction`, `calf`, `core`, `carry`; plus `shoulderHorizontalAdduction`, `shoulderHorizontalAbduction`, `shrug`, `wristFlexion`, `wristExtension` | PRD §7.1 "Classification" (EXL-01, EXL-02, ONB-07); the last five extend it for PRD §7.2 and the EB mapping table (section 3) |
| `LOAD_TYPES`           | `barbell`, `dumbbell` (load per hand), `machine` (stack, plate-loaded or cable), `bodyweightAdded`, `bodyweightAssisted` (negative load, WKT-11), `band`, `timed`                                                                                                                                                                                                           | EXL-04, PRD §7.1 "Load model"                                                                                                 |
| `REST_CLASSES`         | `strength`, `hypertrophyCompound`, `hypertrophyIsolation`                                                                                                                                                                                                                                                                                                                   | TMR-02 rows 1–3; the squat/deadlift, novice, time-saver, superset and warm-up rows are context variants in the rules registry |
| `GOALS`                | `hypertrophy`, `strength`                                                                                                                                                                                                                                                                                                                                                   | ONB-03, PLN-07, PRD §7.1 "Rep range per goal"                                                                                 |
| `TRAINING_STYLES`      | `bodybuilding`, `powerlifting`, `powerbuilding`                                                                                                                                                                                                                                                                                                                             | ONB-03, PLN-02                                                                                                                |
| `EVIDENCE_TAGS`        | `MA`, `SR`, `RCT-T`, `RCT-U`, `RCT`, `POS`, `OBS`, `DELPHI/SURVEY`, `NARR`, `PREPRINT`, `PRACT`, `OFFICIAL`, `MODEL`, `INF`                                                                                                                                                                                                                                                 | EB "How to read the evidence tags"; technical concept §8.6.1                                                                  |
| `MAPPING_EVIDENCE`     | `H`, `EMG`, `C`                                                                                                                                                                                                                                                                                                                                                             | EXL-05                                                                                                                        |
| `CREDIT_VALUES`        | `1`, `0.5`, `0.25`, `0`                                                                                                                                                                                                                                                                                                                                                     | EXL-05                                                                                                                        |
| `MECHANICS`            | `compound`, `isolation`                                                                                                                                                                                                                                                                                                                                                     | EXL-01, PRD §7.1                                                                                                              |
| `COMPETITION_LIFTS`    | `squat`, `bench`, `deadlift`                                                                                                                                                                                                                                                                                                                                                | EXL-07                                                                                                                        |
| `CURVE_CLASSES`        | `benchLike`, `legPressLike`, `pooled`                                                                                                                                                                                                                                                                                                                                       | EXL-04; technical concept §8.7.4 (E-3)                                                                                        |
| `OVERLOAD_SUITABILITY` | `0`, `1`, `2`, `3`                                                                                                                                                                                                                                                                                                                                                          | MAP-03 (d); technical concept §5.6                                                                                            |
| `EXERCISE_STATUSES`    | `active`, `deprecated`                                                                                                                                                                                                                                                                                                                                                      | Technical concept §5.6, §8.12 (ID stability)                                                                                  |

### 5.3 Source registry

- **Layout:** `packages/rules/data/sources/` holds `README.md` (format, ID convention, file
  owners), `excluded.yaml` (3 sources: `src.barbalho2019`, `src.barbalho2020a`,
  `src.barbalho2020b`) and `exercise-mapping.yaml` (19: the 18 sources the EB mapping section cites
  plus `src.powr-eb-mapping`). 22 sources in total. The rules engine work adds `<topic>.yaml` files,
  the content work `content-*.yaml` files.
- **ID convention:** `src.<first author><year>[a|b]`; without an author in the EB, the registry name
  plus identifier (`src.pmid24265879`); POWR's own documents `src.powr-<topic>`. Details in the
  README and at `sourceDefSchema` (`packages/rules/src/sources/schema.ts`).
- **Where the code lives, and why:**
  - `@powr/rules` (root): `evidenceTagSchema`, `sourceIdSchema`, `paramDefSchema` (whose `sources`
    must now be valid source IDs).
  - `@powr/rules/sources` → `packages/rules/src/sources/` (pure, environment-free): `sourceDefSchema`,
    `SOURCE_STATUSES`, `buildSourceRegistry(files)`, `checkSourceRefs(sources, refs)`; types
    `SourceDef`, `SourceStatus`, `SourceFile`, `SourceRef`, `SourceRegistry`.
  - `@powr/rules/sources/node` → `packages/rules/scripts/sources.ts`: `loadSourceRegistry(dir?)`
    reads and parses every `*.yaml` file (stray files and YAML errors become issues) and
    `SOURCES_DIR`.
  - The rules build lives in `@powr/rules` (technical concept §8.6.5), and a tools/ package may
    depend on `@powr/rules`, while the `@powr/content` runtime must not. So the loader sits in
    `@powr/rules`, behind subpath entries that the app never imports. `packages/rules/scripts/` is a
    separate TypeScript project with Node types (referenced from the root `tsconfig.json`), so
    `src/` keeps failing the type check on any Node import.
- **How the consumers use it:** the rules engine work cites IDs in `ParamDef.sources` and checks
  all rows with `loadSourceRegistry()` and `checkSourceRefs`. The content work adds a tools package
  (for example `tools/content-build`; its `ALLOWED_DEPENDENCIES` entry needs `@powr/rules`,
  `@powr/content` and `@powr/domain`) that checks every `MuscleCredit.source` the same way. These
  checks run under Vitest: plain `node` cannot import workspace sources, which use extensionless
  imports. A throwaway probe package proved this path (type check and test) before it was removed.
- **Tests:** `packages/rules/test/sources.test.ts` (valid registry; duplicate ID across files;
  excluded entry without a reason; reason on an active entry; unknown tag; malformed ID; missing
  field; unknown key; non-http URL; a file that is not a list; unknown and excluded citations),
  `packages/rules/scripts/sources.test.ts` (the shipped registry is valid and excludes exactly the
  three Barbalho papers; YAML errors and stray files are reported; files merge in name order) and
  `packages/domain/test/ids.test.ts`.

### 5.4 Content stub

- The three competition lifts in the full `ExerciseDef` shape, with credits from the EB mapping
  table and seeded source IDs. Squat: vasti 1.0 H (`src.kubo2019`), rectus femoris 0 EMG
  (`src.ema2016`), glute max 0.5 H (`src.plotkin2023`), adductors 0.5 H and hamstrings 0 H
  (`src.kubo2019`). Bench: sternocostal pec 1.0 H and triceps 0.5 H (`src.pmid24265879`), front
  delts 0.5 C (`src.powr-eb-mapping`). Deadlift: every credit C (`src.powr-eb-mapping`): glutes and
  lower back 1.0; quads, hamstrings and adductors 0.5; upper traps and forearms 0.25.
- Rep ranges hypertrophy 6–15 and strength 1–6 (EB §Defaults › Volume, PLN-07); rest class
  `strength`; tempo `2-0-X-0`; curve class `pooled` (squat, deadlift) and `benchLike` (bench).
- Muscle and equipment IDs are placeholders that follow the technical concept's examples
  (`mu.quads.vasti`, `eq.barbell-olympic`, …) until the content work defines the taxonomy and the
  catalog.
- The content schema checks rep ranges and credit values with plain arrays and refinements instead
  of `z.tuple`/`z.literal`, because it still runs at startup (TD-17); that saved 0.8 kB of entry JS.

## 6. Changelog of this file

- 2026-11-24: M0 walking skeleton (WP0.1–WP0.8).
- 2026-11-24: M0 cleanup (product-owner decisions of 2026-11-24): lazy-loaded backup path, `#ui/*`
  alias with the shadcn CLI (`Input`), licence approvals recorded and enforced, app-wide Zod lint
  rule, docs v0.3. Section 3: every row marked "Docs amended in v0.3" and nine cleanup rows added;
  section 4 updated (reminder for `minimumReleaseAgeExclude`, entry size, `cn` decision).
- 2026-11-24: M1 contract step: shared domain types (full `ExerciseDef`, enums, ID types, evidence
  tags) and the source registry directory with loader, validator and 22 seeded sources. New
  section 5 (the changelog moved to section 6); eight M1 rows in section 3; section 4 updated.
- 2026-11-24: TD-21 resolved by the product owner (keep `#ui/cn` + colour bridge): `ui:add` script,
  colour bridge and theme-scoped `dark:` in `app.css`, `Input` re-added through the script. Run
  instructions, section 2, a section 3 row and section 4 updated.
- 2026-11-24: M1-B content: section "M1-B content" (pipeline, lint and coverage rules, content set,
  decisions, merge assumptions).
- 2026-11-24: M1-A engine and rules: section "M1-A engine and rules".
- 2026-11-24: M1 cleanup and docs v0.4: backup import hardening (`__proto__` finding), Zod off the
  startup path (TD-17 closed, entry budget 186 kB), product-owner decisions (TD-21; curve class of
  the competition squat and deadlift; content licence entries), technical concept v0.4 and seven ADR
  amendments. Section 2: three rows; section 3: the M1 rows marked "Docs amended in v0.4" and five
  cleanup rows; section 4 updated; the M1-B and M1-A sections record the decisions.
- 2026-11-24: M2a planning core (no UI): section "M2a planning core" at the end.
- 2026-11-24: M2b screens and the M2 docs pass (technical concept v0.5): section "M2b screens" after
  the M2a section; section 4 updated (component tests, pseudo-locale test and token gate done).
- 2026-11-24/25: M2 tooling, M2c planning gaps, M3a session core, M3t timers and alerts and M3b
  session screens with the M3 docs pass (technical concept v0.7, `docs/device-tests/S-1-protocol.md`):
  one section each at the end; section 1 points to the S-1 protocol.
- 2026-11-25: M4a, M4v, M4b with the M4 docs pass (technical concept v0.8), the trend-label
  calibration, M5d, M5s, M5p, and M5z with the M5 docs pass (technical concept v0.9): one section
  each at the end; section 1 lists `POWR_TEST_BROWSER_PORT`.

## M1-B content

Content pipeline and first content set (technical concept Appendix A.4, M1 content part), built in
parallel with the M1 engine and rules work. Status 2026-11-24: `pnpm verify` green.

### Pipeline

| Piece                     | Where                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authoring (YAML)          | `packages/content/data/`: `muscles.yaml`, `equipment.yaml`, `presets.yaml`, `exercises/<pattern>.yaml` (one file per movement pattern), `templates/<slug>.yaml`            |
| Schemas (Zod)             | `@powr/content/schema` → `packages/content/src/schema/`; each schema `satisfies z.ZodType<…>` of its runtime type                                                          |
| Runtime (no Zod, no data) | `@powr/content` → types (`src/types.ts`) and `createContentCatalog(bundle)` (`src/catalog.ts`)                                                                             |
| Compiled data             | `packages/content/generated/content.json` (`format`, `version` = `0.1.0+sha.<8 hex>`, `hash` = SHA-256 of the canonical JSON), read by `@powr/content/built-in`            |
| Build, lint, coverage     | `tools/content-build`: `src/load.ts`, `compile.ts`, `lint.ts`, `coverage.ts`, `ids.ts`, `inventory.ts`, `build.ts`, `cli.ts`                                               |
| Commands                  | `pnpm content:build` writes `content.json`, `packages/content/ids.lock.json` and the `powr-content-*` entries of `assets-inventory.yaml`; `pnpm content:check` checks only |
| App loading               | `src/app/boot.tsx` loads `@powr/content/built-in` with `import()` in parallel with `db.open()` and passes the catalog to `createContainer(db, content, …)`                 |

- **Entry chunk (`pnpm size`, gzip):** 204.29 kB before, **202.38 kB** after. The content data is
  the lazy chunk `built-in-*.js` (16.5 kB gzip, 122 kB raw), precached by the service worker. The
  offline E2E test now logs a set with a library exercise after an offline reload.
- **TD-17 was only partly closed here; closed in the M1 cleanup** (section 3: entry JS 176.44 kB).
  Content no longer reaches Zod, but Zod's core stays in the entry
  through two other importers: `@powr/rules` (the container imports `RULES_VERSION` from the
  package root, which also builds the parameter schemas) and `src/routes/session.tsx`
  (`validateSearch` with `z.object`). Measured once with both made Zod-free (then reverted): entry
  **176.39 kB** gzip. Follow-up: the rules work makes the `@powr/rules` root schema-free (or loads
  `rules.json` like content), and the session route validates its one search parameter without Zod.
- Lint guards (oxlint, every app override): `@powr/content/built-in` only as a type import or
  through the one `import()` in `boot.tsx` (disable comment, as for the backup loader);
  `@powr/content/schema` never in app code.

### Linter and coverage rules

Schema (per entry, `@powr/content/schema`): ID formats (`ex.`, `mu.`, `eq.`, `preset.`, `tpl.`,
`sg.`, `src.`), the enums of the M1 contract, unknown keys rejected, 3–6 cues of ≤ 140 characters
that are sentences, tempo `e-p-c-p` (`X` allowed), rep ranges `[min, max]`, an `anyOf` group offers
≥ 2 items, bar weights and stack increments in both kg and lb, preset inventories (unique plate
denominations, dumbbell ranges in whole steps), template day count = `daysPerWeek`, half-point RIR
0–5 or RPE 5–10, mesocycles of 3–8 accumulation weeks (PLN-08).

Lint (`tools/content-build/src/lint.ts`, on schema-valid content):

- IDs unique per kind; names and synonyms unique case-insensitively per kind (§8.12).
- Taxonomy: a group ID has one segment, a sub-region is `<group>.<sub>`; body-map regions are unique
  and only in views where the group is drawn.
- Presets: items exist and are unique; an inventory field exists exactly when its item is selected;
  inventories in both kg and lb.
- Exercises: equipment exists and is not repeated; the load type matches the requirement (barbell →
  a bar and plates, dumbbell → dumbbells or kettlebells, machine → a machine or cable, band →
  bands); `bodyweightAssisted` ⇒ `bodyweightLoaded` ⇒ a bodyweight load type; muscles exist, none
  twice, never a group together with its own sub-region (the roll-up would count one set twice); at
  least one credit of 1; 0.25 ⇒ C; C ⇔ `src.powr-eb-mapping` (H and EMG cite a study);
  `ranking.subRegions` are sub-regions credited ≥ 0.5 directly or through their group; `variantOf`
  and `replacedBy` resolve to active exercises, no variant of a variant, no `competitionLift`
  together with `variantOf`, deprecated ⇔ `replacedBy`; competition lifts and close variants have
  `fixedRom`, rest class `strength`, the lift's pattern and strength reps within 1–6; isolation ⇒
  `hypertrophyIsolation`; rep ranges within the EB bands (hypertrophy 5–30, strength 1–12); no
  repeated cue; the file name matches the pattern.
- Sources: every credit's source exists in the registry and is not excluded (`checkSourceRefs` with
  `loadSourceRegistry()`, hence the tools package's `@powr/rules` dependency).
- Templates: at most one default per style × days; unique day and slot keys; targets exist; goals
  fit the style (bodybuilding hypertrophy, powerlifting strength, powerbuilding both); a lift slot
  uses the lift's pattern; stated reps, RIR and RPE within the EB bands (main-lift strength reps 1–6,
  RPE 6–9.5, hypertrophy RIR 0–4); every slot has at least one candidate exercise.
- ID lock: every ID in `ids.lock.json` (200 IDs: exercises, substitution groups, muscles, equipment,
  presets, templates) still exists; the build appends new ones.

Coverage (`tools/content-build/test/coverage.test.ts`). Known gaps are exact lists, so closing a
gap fails the test until the list shrinks:

| Rule                                                             | Threshold | Known exceptions                                                                                                 |
| ---------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| Exercises crediting each display group ≥ 0.5 (whole library)     | ≥ 2       | `mu.tibialis` (optional; the contract has no dorsiflexion pattern)                                               |
| Exercises crediting or ranking each sub-region                   | ≥ 1       | none                                                                                                             |
| Available exercises per preset with equipment                    | ≥ 15      | none (smallest: bodyweight and bands, 19)                                                                        |
| Exercises crediting each display group ≥ 0.5 per preset (EXL-01) | ≥ 2       | bodyweight-bands × calves, forearms, lower back, upper traps; dumbbells-bench × upper traps; hotel × upper traps |
| Competition lifts with a close variant                           | ≥ 1 each  | none                                                                                                             |
| Movement patterns with an exercise                               | ≥ 1       | `carry`                                                                                                          |
| PLN-02 cells with a default template                             | 1 each    | BB 2; PL 2, 5, 6; PB 2, 3, 5, 6                                                                                  |

Proof tests (`tools/content-build/test/lint.test.ts`): a broken `variantOf`, `replacedBy`,
equipment and muscle reference, a missing cue, an excluded source (`src.barbalho2019`), an unknown
source, the 0.25 and C rules, a double roll-up credit, a missing primary, a duplicate synonym,
competition-lift semantics, a wrong load type, a wrong file, a sub-region outside its group, preset
mismatches, and template targets, bands, goals and defaults. Each is the only issue reported.

### Content

- **Taxonomy:** 19 display groups (PRD §7.2, tibialis `optional`) with 16 sub-regions; body-map
  region IDs such as `front.chest`, `back.side-delts`, `front.chest.clavicular`; `area` (chest,
  shoulders, arms, back, core, legs); `ebHypertrophyData` per muscle.
- **Equipment:** 49 items in EQP-01 order (7 bars with kg and lb default weights, `variesByModel`
  for all but the Olympic and women's bars) and 6 presets (EQP-02: commercial, home barbell,
  dumbbells and bench, bodyweight and bands, hotel, custom empty) with kg and lb inventories.
- **Exercises:** 74. By pattern: squat 5, hinge 6, horizontal push 7, vertical push 4, horizontal
  pull 5, vertical pull 4, lunge 2, knee extension 2, knee flexion 3, elbow flexion 5, elbow
  extension 4, shoulder abduction 3, hip extension 3, hip abduction 1, hip adduction 1, calf 4,
  core 5, horizontal adduction 2, horizontal abduction 4, shrug 2, wrist flexion 1, wrist
  extension 1. 217 credits: 42 H, 4 EMG, 171 C. Competition lifts: back squat, bench press,
  deadlift, sumo deadlift; close variants: paused squat, long-pause and close-grip bench, deficit
  deadlift. The M0 IDs `ex.barbell-back-squat`, `ex.barbell-bench-press` and `ex.barbell-deadlift`
  are kept.
- **Templates:** 7 defaults: BB full body ×3, upper/lower ×2, upper/lower + PPL (5 days), PPL ×2;
  PL SBD ×3 (heavy/light/moderate), SBD 4-day; PB upper/lower with strength and hypertrophy days.
- **Sources:** no `content-*.yaml` was needed; the credits cite 12 seeded studies and
  `src.powr-eb-mapping`.

### Decisions and deviations

| Concept or brief says                                                   | What I did                                                                                                                                                                                                                           | Why                                                                                                                                             | Follow-up                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One YAML file per exercise (§8.12)                                      | One file per movement pattern (as briefed), checked by the lint                                                                                                                                                                      | 22 files instead of 74; "where does it go?" stays obvious                                                                                       | **Docs amended in v0.4** (§8.12)                                                                                                                                                                                      |
| `content.json` emitted by the build (§8.12 step 5)                      | Committed under `packages/content/generated/` (pretty JSON, excluded from oxfmt); `build.test.ts` fails when it, `ids.lock.json` or the inventory entries are stale                                                                  | Typecheck, Vitest, knip and Vite import it without a pre-build step; same pattern as the Lingui catalogs                                        | **Docs amended in v0.4** (§8.12)                                                                                                                                                                                      |
| `packages/content/scripts/{build,lint}.ts` (§5.3)                       | `tools/content-build` (`ALLOWED_DEPENDENCIES`: domain, rules, content); the CLI loads the pipeline through Vite's `runnerImport`                                                                                                     | The source check needs `@powr/rules`, which the content runtime must not depend on (section 5.3); plain `node` cannot resolve workspace sources | **Docs amended in v0.4** (§5.1, §5.3, §8.12, ADR-0001)                                                                                                                                                                |
| `mappingTemplate` expanding EB rows (§8.12 example)                     | Credits written out per exercise; each file header names the EB rows it follows                                                                                                                                                      | Explicit data per exercise; the C ⇔ convention-source and 0.25 ⇒ C rules keep the tags consistent                                               | Reconsider at 150+ exercises                                                                                                                                                                                          |
| Content types to be agreed (section 4)                                  | `MuscleGroupDef`, `EquipmentDef`, `EquipmentPresetDef`, `TemplateDef`, `ContentBundle` and their enums in `@powr/content` (`src/types.ts`); `ContentCatalog` gained `muscles()`, `equipment()`, `templates()`, `template(id)` (§5.5) | `@powr/domain` is read-only for this work                                                                                                       | Merge: move or mirror what the engine needs into `@powr/domain`; **Docs amended in v0.4** (§5.6, §8.12)                                                                                                               |
| Tempo of the competition lifts open (section 4)                         | `2-0-X-0` ("controlled down" = 2 s, inside the EB's 1–4 s); paused variants carry the pause (`2-2-X-0`, `2-3-X-0`)                                                                                                                   | Four-part format of TMR-10; the EB models the paused bench as its own exercise                                                                  | None                                                                                                                                                                                                                  |
| EB rows "RDL …" and "45° back extension": H (Bourne 2017)               | Hamstrings H; glute max C                                                                                                                                                                                                            | Bourne 2017 measured the hamstrings only                                                                                                        | Re-tag if glute data appear                                                                                                                                                                                           |
| EB "Lateral raise: C/EMG"; incline "EMG + one unverified study"; curl H | Lateral raise C (no EMG source cited); incline cites `src.pmid34644424` only; curls cite `src.mannarino2021`; variants the table does not name (front and goblet squat, machine press, pike push-up, hammer and band curl) are C     | Registry note on `src.pmid36334406`: verify before it backs a credit; extrapolation is convention                                               | None                                                                                                                                                                                                                  |
| EB "sumo: adductors 1.0?"                                               | 1.0, tagged C, commented                                                                                                                                                                                                             | Closest to the table; C marks it as unvalidated                                                                                                 | None                                                                                                                                                                                                                  |
| No EB rows for abs, obliques, forearms, hip abduction and adduction     | C; trunk-flexion exercises credit the obliques 0.5 as synergists                                                                                                                                                                     | EB: count synergist sets as half                                                                                                                | None                                                                                                                                                                                                                  |
| Every exercise has a pattern (EXL-01)                                   | No tibialis or carry exercise and no timed exercise (planks)                                                                                                                                                                         | `MOVEMENT_PATTERNS` has no ankle dorsiflexion; `defaults.repRange` is required, so timed exercises and carries have no honest default           | Contract: a dorsiflexion pattern and duration defaults for timed and carries (TD-23)                                                                                                                                  |
| Sumo deadlift                                                           | `competitionLift: deadlift`, not `variantOf`                                                                                                                                                                                         | A legal competition deadlift; the lifter's stance is a profile choice                                                                           | Engine: allow two exercises per competition lift; **Docs amended in v0.4** (§8.12)                                                                                                                                    |
| Dips                                                                    | Pattern `verticalPush`                                                                                                                                                                                                               | Pressing along the body's long axis; the chest credit comes from the mapping                                                                    | None                                                                                                                                                                                                                  |
| EQP-01 "each item has an icon"                                          | Items carry a `category`; the UI maps category to an icon                                                                                                                                                                            | No per-item artwork yet                                                                                                                         | M2 equipment editor                                                                                                                                                                                                   |
| Content entries of the licence inventory                                | The build owns the `powr-content-*` entries of `assets-inventory.yaml` (exercises, muscle taxonomy, equipment, templates; `LicenseRef-Own-Work`; version = content SemVer); the stub entry is gone                                   | LEG-08; the licence gate already reads this file                                                                                                | **Approved by the product owner 2026-11-24** (inventory change made separately; the build's template `tools/content-build/src/inventory.ts` must carry the approval text); **Docs amended in v0.4** (§8.12, ADR-0018) |
| —                                                                       | Diagnostic code `content.error`; `packages/application/test/fakes.ts` and `apps/web/src/infrastructure/db/db.test.ts` import `@powr/content/built-in`                                                                                | Startup can now fail on the content chunk; `builtInContent` left the package root                                                               | None                                                                                                                                                                                                                  |
| EB bands in the rules registry                                          | The EB rep, RIR and RPE bands are constants in `lint.ts`                                                                                                                                                                             | The rules registry does not exist yet                                                                                                           | Read them from `rules.json` after the merge                                                                                                                                                                           |
| Body map (§8.11)                                                        | Region IDs only; no `smallRegion` flags and no pain-log regions (RDY-04)                                                                                                                                                             | Both depend on the artwork                                                                                                                      | With the artwork (S-5)                                                                                                                                                                                                |

### Assumptions the merge with the engine and rules work must align

- **Presets → `PlateInventory` / `BarSpec`:** `preset.inventory[unit]` holds plain numbers in that
  unit: `plates` and `microplates` as `{ weight, pairs }`, `dumbbells` as `{ weights }` or
  `{ from, to, step }`, `kettlebells` as a list. Bars are catalog items with
  `loading: { kind: 'bar', defaultWeight: Mass[] }` (one kg and one lb value) and `variesByModel`;
  stacks have `defaultIncrement: Mass[]`; plate-loaded machines leave the empty weight to the user.
  Presets carry no collars (EQP-03 default 0).
- **Template prescription modes:** the PLN-07 list (`fixed`, `percent`, `rpe`, `doubleProgression`,
  `topBackoff`, `amrap`, `timed`, `technique`), the names of the technical concept's `Prescription`
  sketch. Slots are flat (`goal`, `mode`, optional `repRange`, `effort` as `{ rir }` or `{ rpe }`,
  `rest`, and `backoff` for `topBackoff`); the generator allocates the sets.
- **Rule references:** `mesocycle.deloadRule: deload.planned` (a parameter ID in the `paramDefSchema`
  format; the ID itself is assumed). Slots without `effort` take the registry's effort target for
  their `goal` (EB: hypertrophy RIR 1–2, strength RPE 6–9); slots without `rest` take the exercise's
  `RestClass`. Progression models `doubleProgression` (PRG-04), `rpeLoad` (PRG-05), `linearLoad`
  (PRG-06).
- **Volume roll-up:** a group's credit from one exercise is the largest of its own and its
  sub-regions' credits; the lint guarantees that no exercise credits a group and one of its
  sub-regions together.
- **Equipment availability:** `tools/content-build/src/coverage.ts` has its own `isAvailable`
  (allOf + anyOf); the engine's `equipment` module should own it, and the tests can switch to it.
- **Library order:** competition lifts first, then the `MOVEMENT_PATTERNS` order (the M0 log screen
  preselects the first exercise, the back squat).

### What remains

- **74 → 150+ exercises (M4):** first the coverage gaps above (bodyweight calf, forearm, lower-back
  and trap options; trap work for the dumbbell and hotel presets), then the variants the templates'
  accessory slots will want (incline barbell, Smith and machine variants, more pulls and rows,
  preacher and cable curls, lunges), the missing patterns (carry, dorsiflexion) once the contract
  allows them, and partners for the seven single-member substitution groups. `pnpm content:build`
  prints the current gaps.
- Templates for the eight missing PLN-02 cells (2-day templates; PL 5 and 6; PB 3, 5 and 6), the PL
  meet-prep variant (v1.1) and the PLN-01 constraint checks (M2).
- Educational texts (§7.6, Markdown → restricted AST) and achievements (v1.2) are not started.
- The TD-17 remainder (see Pipeline): closed in the M1 cleanup (section 3).

## M1-A engine and rules

Written 2026-11-24 by the M1 engine-and-rules work (roadmap A.4 "M1 Engine and content
foundations", engine part). Content (taxonomy, equipment catalog, exercises, templates) is the
parallel M1 content work and is not covered here.

### Run instructions

| Command                                                | What it does                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @powr/rules build`                      | Validates `packages/rules/data/*.yaml` and the source registry, writes `packages/rules/dist/rules.json` (gitignored), prints the `verified: false` rows |
| `pnpm --filter @powr/rules build -- --diff <old.json>` | Same, plus the registry diff report (added, removed, changed parameters) against an earlier `rules.json`                                                |
| `pnpm test`                                            | Runs every registry check (schema, sources, Barbalho, ID lock, hash) and the golden tests under Vitest, as before                                       |

Plain `node` cannot import the workspace sources (extensionless imports, section 5.3). The build
runs with a 20-line resolve hook, `packages/rules/scripts/ts-resolve.ts` (`node --import`), that
retries a relative import with `.ts` and `/index.ts`; Node 26 strips the types itself.

### What landed

`@powr/domain` (pure; temporal-polyfill only; new modules are subpath exports, the root index is
unchanged apart from the new `units` and `time` helpers):

| Subpath                    | Public API                                                                                                                                                                                                                | PRD                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| root (`units`)             | `roundToStep(value, step, mode?, origin?)`, `displayMass(mass, unit, step = 0.1)`, `fromKg`, `cleanFloat`, `ROUNDING_MODES`/`RoundingMode`; `Length`, `toCm`, `convertLength`                                             | SET-02, SET-05, NFR-REL-07     |
| root (`time`)              | `addDays`, `daysBetween`, `weekStartOf(date, weekStartsOn)`, `isoWeekOf`, `isoWeekKey`, `IsoWeekday`                                                                                                                      | SET-11                         |
| `@powr/domain/rules`       | `ParamValues` (every parameter ID → value type), `ParamId`, `Param<V>`, `ParamMeta`, `RuleSet`, `RuleSlice<K>`, `TRAINEE_LEVELS`, `SEX_REFERENCES`, `PARAM_UNITS`, `TECHNIQUE_KINDS`/`Technique` …                        | PRG-18                         |
| `@powr/domain/explain`     | `Explained<T>`, `Explanation`, `RULE_IDS`/`RuleId` (closed), `ParamRef`, `Fact`, `explain`, `explained`, `paramRef`, `paramsUsed`                                                                                         | PRG-09, LEG-05                 |
| `@powr/domain/loading`     | `Implement` (`barbell`, `list`, `steps`, `loosePlates`), `BarSpec`, `PlateInventory`, `roundToAchievable(target, implement, mode)`, `nextLoadAbove`, `maxLoad`, `barbellTotal`, `effectiveLoadKg`, `externalLoadForTotal` | WKT-07, EQP-03, PRG-07, WKT-11 |
| `@powr/domain/e1rm`        | `equationPct`, `rtsPct`, `tablePct`, `curvePct`, `effectiveReps`, `rirBias`, `setWeight`, `personalPriorRir`, `estimateSetE1rm`, `sessionE1rm`, `loadForTarget`                                                           | PRG-01, PRG-05                 |
| `@powr/domain/trend`       | `trendObservation`, `isStrengthSet`, `runTrend` (local-level Kalman filter on ln e1RM), `labelChange`                                                                                                                     | PRG-02                         |
| `@powr/domain/progression` | `suggestDoubleProgression`, `suggestRpeLoad`, `suggestBackoff`, `apreSession`, `suggestApre`, `suggestLinear`, `percentLoad`, `classifyTrainee`, `bodyRegionOf`                                                           | PRG-03…07, PRG-10              |
| `@powr/domain/warmup`      | `generateWarmup(input, { implement, mode }, rules)`                                                                                                                                                                       | WKT-06                         |
| `@powr/domain/volume`      | `isHardSet`, `setCredit`, `creditTable`, `parentMuscle`, `muscleVolume`, `weeklyMuscleVolume`, `classifyWeeklyVolume`, `checkSessionVolume`                                                                               | EXL-05, WKT-04                 |
| `@powr/domain/rest`        | `restSeconds({ restClass, timeSaver }, rules)`                                                                                                                                                                            | TMR-02                         |
| `@powr/domain/scoring`     | `score(formula, { sex, bodyweightKg, liftedKg, division, lift }, rules)` for `ipfGl`, `dots`, `ipfPoints`, `wilks`, `wilks2020`, `allometric`                                                                             | ANL-07                         |
| `@powr/domain/bodyweight`  | `bodyweightTrend(weighIns, rules)`, `bodyweightRate(points, rules)`                                                                                                                                                       | BOD-02                         |

Every suggestion and derived value is an `Explained<T>` with the rule ID, a `why.<rule>` message
ID, arguments, facts and the registry parameters used (with evidence tags, sources, `verified` and
origin). Engine functions take the rule slice they read (`RuleSlice<…>`) as an argument.

`@powr/rules`: `data/*.yaml` (8 tables, 109 parameters), `src/params.ts` (one Zod value schema per
parameter ID, tied to `ParamValues` with `satisfies`), `src/compile.ts` (`compileRules`: row schema,
value/variant/range schemas, unique IDs, complete MVP set, sources exist and are not excluded, no
blocked MVP row), `src/resolve.ts` (`resolveParam`, `resolveRules(compiled, context, overrides)` →
`{ version, rules: RuleSet, issues }`, `parseCompiledRules`, `rulesStamp`), `src/context.ts`
(`ResolveContext`, `matchesCondition`), `scripts/build.ts` (Node build, SHA-256 of canonical JSON,
unverified report, diff report), `ids.lock.json` (stable parameter IDs). `RULES_VERSION` is now
`1.0.0`; the compiled file adds the hash (`1.0.0+<hash12>`).

| Table              | Parameters | `verified: false` |
| ------------------ | ---------- | ----------------- |
| `load.yaml`        | 25         | 7                 |
| `volume.yaml`      | 21         | 10                |
| `progression.yaml` | 14         | 3                 |
| `deload.yaml`      | 6          | 0                 |
| `session.yaml`     | 23         | 0                 |
| `monitoring.yaml`  | 4          | 0                 |
| `scoring.yaml`     | 12         | 4                 |
| `bodyweight.yaml`  | 4          | 0                 |
| **Total**          | **109**    | **24**            |

New source files (71 sources): `load.yaml` 13, `volume.yaml` 13, `progression.yaml` 8,
`deload.yaml` 4, `session.yaml` 15, `monitoring.yaml` 4, `scoring.yaml` 10, `bodyweight.yaml` 4.

### Decisions and deviations

| Concept / brief says                                                         | What I did                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ResolvedRuleSet` is a typed tree, `rs.rest.strength.default.value` (§8.6.2) | A flat record keyed by the stable parameter ID: `rules['session.rest.strength'].value`. Same typing, IDs match explanations and overrides one to one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ParamDef` with `range?`, `guard?: unknown` (§8.6.1)                         | `unit` is required (closed list `PARAM_UNITS`); `range` is checked with the parameter's own schema and drives the out-of-range note for user values; `guard` is a JSON object of UI warning thresholds; `sources` needs at least one ID; `label` defaults to `params.<id>`, `since` to `mvp`; optional `note`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| A `verified` flag per row                                                    | `verified: false` for preprint-derived values (Pelland tiers and bands, PUOS, Remmert caps, Marzagao noise, Robinson RIR slope), for values the EB flags as unverified (RIR bias, §Gaps #26; APRE table; RTS chart from a secondary source) and for POWR design values the EB gives only a direction for (set-order decay 0.85, Kalman process noise, novice widening 1.5, reference window, training-age mapping, calibration rule). A test fails if any row that cites a preprint is verified                                                                                                                                                                                                                                                                                                                            |
| Scoring rows stay `verified: false` until the cross-check (§8.7.7)           | IPF Points coefficients are `verified: true` (the EB research note checked them against the IPF document, including C4 = 67.4926); Wilks, Wilks2020, DOTS and GL coefficients `verified: false`; the clamps and floors are rows of their own, tagged [INF] as an app implementation choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Curve classes (E-3): benchLike = Wathan/RTS, legPressLike and pooled = Nuzzo | As specified, but data-driven: `load.curve.classMap` maps each class to `equation`, `nuzzoPooled`, `nuzzoBench` or `nuzzoLegPress`. Consequence: the user's equation setting (Wathan/Epley/Brzycki/RTS) only affects bench-like exercises; squat and deadlift (`pooled` in the content stub) use the Nuzzo pooled curve, which prescribes about 5–6% more load than Wathan at 5 @ RPE 8. **Product decision needed**; switching `pooled` to `equation` is a one-line data change **Decided by the product owner 2026-11-24:** the competition squat and deadlift and their close variants use `benchLike` (Wathan/RTS) until the personal curve fit exists (content data change made separately); renaming `benchLike` (e.g. `equation`) is proposed as a contract change (TD-30). Docs amended in v0.4 (§8.7.4, ADR-0020) |
| Nuzzo tables inverted                                                        | Piecewise-linear, anchored at 1 rep = 100%, flat beyond the last row. The RTS chart beyond 13.5 r_eff follows Wathan scaled to meet the chart (continuous and decreasing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Brzycki `w·36/(37 − r)`                                                      | The original `w / (1.0278 − 0.0278·r)`; equal to 4 decimals in the EB range, undefined from r ≈ 37. At 8 reps it gives 80.56% where the EB prints 80.5 (within the ±0.1 tolerance)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| RIR bias (MVP 0 / +0.5)                                                      | Applied in both directions: to reported RIR in the e1RM and to the target RIR in load-for-target, so the two are exact inverses before rounding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Ranges given as defaults in the EB                                           | One value per row: the conservative end where there is one (novice increments 2.5 kg lower / 1 kg upper, rounded up to an achievable step; rest-pause +0.33; intermediate +1%/week), the midpoint otherwise (APRE adjustments, warm-up rest 45/90 s, superset transition 20 s), and the EB range kept in `range` or `guard`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| TMR-02 rows as context variants (section 5.2)                                | Squat/deadlift (4:00) and novice (1:30/1:00) are variants; time-saver, superset transition and warm-up rest are separate parameters because they are different timers; `restSeconds` picks the time-saver value for hypertrophy classes only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `nutrition.yaml` holds the EMA α (§8.6.1)                                    | `bodyweight.yaml` (parameters and sources), because BOD-02 is MVP and the rest of nutrition is v1.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Return-from-break bands ≤ 7, 8–14, 15–28 days, 5–8 weeks, > 2–3 months       | Contiguous rows by `maxDays` 7, 14, 28, 56, open: days 29–34 fall into the "5–8 weeks" row and 57–90 into "rebuild", the more cautious side                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Sub-region roll-up                                                           | A set counts once for the parent `mu.<group>`, with the largest credit the exercise gives the group or any of its sub-regions (no data needed beyond the ID convention)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Hard sets above 20 reps only at RIR ≤ 2                                      | Sets without effort count in every case (E-1 "RIR unknown counts"), also above 20 reps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Warm-ups: "never warm-up reps ≥ working reps at ≥ 70%"                       | Capped at working reps − 1 but never below 1, so a heavy-single day still gets its warm-up singles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| e1RM change "95% interval of Δ excludes 0"                                   | Var(Δ) = P_now + P_ref (ignores the positive covariance of filter states), which is conservative                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Plate math `nearest-ties-down` etc.                                          | Mode names `nearestTiesDown`, `down`, `up`. Targets are compared on the 0.01 grid of the implement's unit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@powr/rules` has no side effects                                            | `package.json` declares `"sideEffects": ["./src/zod.ts"]`, so the app (which imports only `RULES_VERSION`) does not pull the schemas into the entry chunk; entry JS is 204.09 kB gzip (204.3 kB before). M1 cleanup: the root is now Zod-free and the schemas and resolver are the entries `@powr/rules/schema` and `@powr/rules/resolve` (section 3, TD-17)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Tooling                                                                      | Only package-local changes: `@powr/domain` subpath exports, `@powr/rules` `build` script, `./build/node` subpath and `sideEffects`. No change to the Vitest projects, knip, tsconfig references or the arch-test matrix (the `scripts/` project reaches `@powr/domain` through its `..` reference)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Not shipped, on purpose: Lombardi, Lander, O'Conner, the regression equations with intercepts and
the Marzagao weight-dependent formula (EB §Gaps #3–4); velocity-based anything (MVT priors, VL
presets, load–velocity 1RM, the Sánchez-Medina equation; NG-06, §Gaps #12–13); OPL's single-lift
IPF constants (§Gaps #17); ACWR zones, Banister constants, "monotony > 2" (§Gaps #10–11); the RP
landmark table (a coaching overlay for M4).

### For the content work and the merge

- **Equipment:** presets map onto `Implement` in `@powr/domain/loading`: a bar plus plate set →
  `{ kind: 'barbell', bar: BarSpec, plates: PlateInventory, collarWeight? }` (plates as
  `{ weight, pairs }` in the plate set's own unit, microplates included); a dumbbell rack or
  kettlebells → `{ kind: 'list', unit, weights }`; adjustable dumbbells, cable and machine stacks →
  `{ kind: 'steps', unit, start, step, max?, addOns? }`; dip belt → `{ kind: 'loosePlates', plates }`;
  `LoadModel.increment` → `{ kind: 'steps', unit, start: 0, step }`. Collars are per collar.
- **Templates:** `Goal` and `RestClass` come from the contract unchanged; the rules resolver's
  `ResolveContext` matches `competitionLift`, `restClass`, `pattern`, `mechanics`, `curveClass`,
  `level`, `style`, `goal`, `sex` and `timeSaver`. Templates should reference rep ranges and RIR
  targets by goal; the registry holds the defaults (`volume.repRange.*`, `volume.effort.*`).
- **New engine types the content may want:** `TraineeLevel` (`@powr/domain/rules`, for level rules
  in templates) and `TechniqueKind` (for technique slots). Neither is in the shared contract; no
  contract file was changed.
- **Source IDs:** 71 new IDs in topic files. If the content work added any of the same works (e.g.
  `src.schoenfeld2019b`, `src.wolf2025b`, `src.kassiano2023`…), the merge must keep one definition:
  `pnpm test` fails on a duplicate ID across files.
- **Curve class of squat and deadlift:** decided by the product owner (see the classMap row above).

### Not done / open items

- Personal load–rep curve fit with shrinkage, the per-exercise correction factor (re-anchoring; only
  its trigger is in the registry) and the rep-range artefact flag (technical concept §8.7.4/8.7.5;
  TD-26).
- PR detection (MOT-01) and the calibration state machine (PRG-08) only have their inputs
  (`prEligible`, `progression.calibration`); deload, return-from-break, readiness and spacing are
  data only (TD-27).
- `VersionStamp.rules` in the app still uses `RULES_VERSION` (`1.0.0`); from M2 it should use
  `resolveRules(...).version` (`1.0.0+<hash12>`) of the loaded `rules.json` (TD-31).
- Message catalog: every `RuleId` needs an English `why.*` message (PRG-09 coverage test) once the UI
  renders explanations (TD-28).
- Verification passes before the `verified: false` rows can flip: Pelland Sports Med 2026 and the
  published Remmert paper (E-2), Russo 2025 for the RIR bias (§Gaps #26), primary Wilks/DOTS/GL
  documents, an RTS original, the APRE source tables (TD-25).

## M2a planning core

Written 2026-11-24 by the M2a work (roadmap A.4 "M2 Onboarding and planning", the part without UI:
ONB-01…13 data and logic, EQP-01…05/07, PLN-01…15, PRG-10…13 planning side). The screens (M2b)
build on the application API below. Status: `pnpm verify` green.

### What landed

`@powr/domain` (pure; new subpath exports, the root gains types only):

| Entry                    | Public API                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | PRD                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| root (`model/`)          | `Profile`, `EquipmentProfile`, `Plan`, `Mesocycle`, `PlanDay`, `PlanSlot`, `Prescription`, `PlannedSession`, `SessionAdjustment`, `TrainingBreak`, `MeetInfo`, `BodyweightEntry` and their enums; the equipment catalog, preset and template types moved here from `@powr/content` (re-exported there, §5.6)                                                                                                                                                                         | ONB-02…09, EQP, PLN       |
| `@powr/domain/equipment` | `isAvailable(exercise, profile or item set)` (the one EQP-04 check; content-build uses it now), `missingEquipment`, `itemsOf`, `profileFromPreset` and `implementFor` (TD-29: preset → profile → `Implement`), `plateInventory`                                                                                                                                                                                                                                                      | EQP-02…04, EQP-07, TD-29  |
| `@powr/domain/planning`  | `generatePlan`, `validatePlan`, `analyzeWeek`, `selectTemplate`, `rankCandidates`, `effectiveness` (MAP-03), `assignWeekdays`, `spacingConflicts`, `materializeMesocycle`, `firstWeekStart`, `missedSessions`, `doMissedToday`, `skipSession`, `mergeMissed`, `moveSession`, `swapSessions`, `sessionSpacing`, `pauseForBreak`, `resumeAfterBreak`, `postponeDeload`, `skipDeload`, `bringDeloadForward`, `proposeNextMesocycle`, `applyPlanEdits`, `editsForFix`, `slotForExercise` | PLN-01…15, PRG-10, MAP-03 |
| `@powr/domain/deload`    | `deloadSlots` (PRG-11), `reactiveDeload`, `declineStreak` (PRG-12), `returnFromBreak`, `applyReturnStep` (PRG-13), `explainAdjustment`                                                                                                                                                                                                                                                                                                                                               | PRG-11…13                 |

The generator (§8.7.6) as built: template by style × days (or the user's choice, refused with the
reason when days, style or level do not fit) → candidates per slot (equipment, avoid list, pattern,
a target credited ≥ 0.5, the lift rule), ranked favourites first, then MAP-03 effectiveness, then
ID; a slot with no candidate of its pattern takes an exercise that trains a target directly
(`plan.slot.substituted`), else it is dropped with a note; a strength template whose competition
lift cannot be done fails (`plan.lift.unavailable`, naming the missing equipment) → novice limit
(5 exercises) → order (lifts and priority muscles, compounds, isolation) → weekly targets (PLN-03)
→ time fit (drop optional, then secondary accessories, then cut heavy sets to 2, then optional and
secondary lift slots) → greedy set allocation (largest weekly deficit closed per set; slot ≤ 5
sets, ≤ 11 fractional / 8 direct sets per muscle per session, day ≤ budget, no target above its
band; sets below the floor weigh double) → local repair (leave out an optional accessory when that
closes at least one more set of deficit) → weekdays (all ≤ 720 orders, fewest spacing conflicts) →
validation. Every key choice is an `Explanation` (template, mesocycle, targets, each slot with the
ranking factors, prescription and rest, trims, weekday order). Every validation issue carries its
rule (`validate.*`) and the registry parameters it used, a stable `key` for "dismissed" (PLN-09),
`fixes` where a plan change resolves it, and a `cause` (`timeBudget`, `sessionCap`, `slotLimit`,
`equipment`, `template`, `days`) where the inputs make it unavoidable. `report.ok` means no
avoidable violation.

`@powr/application`: ports for the seven new tables (`profile`, `equipment`, `plans`,
`plannedSessions`, `breaks`, `meets`, `bodyweights` repositories; `sessions.latestBefore/inRange`,
`sets.inRange`, `meta.delete`), live queries (`profile`, `equipmentProfiles`, `activePlan`,
`plannedSessions(from, to)`, `breaks`) and the rules port `RulesProvider { version, resolve }`,
which replaces `Deps.rulesVersion` (TD-31: sessions, plans and backups are stamped with
`1.1.0+<hash12>`). The use cases are the lazy entry `@powr/application/planning` (oxlint
`LAZY_PLANNING`, like the backup entry). In-memory fakes cover every port (`test/fakes.ts`).

`apps/web` (no UI): Dexie version 2 with the new stores and repositories; the rules provider
(`src/infrastructure/rules/provider.ts`: `@powr/rules/built-in` loads at boot in parallel with the
database and the content, `@powr/rules/resolve` on the first `resolve`); diagnostic code
`rules.error`.

### Application API (for M2b)

All take the container's `deps`; expected failures are `Result`s.

- **Onboarding:** `saveOnboardingDraft`, `loadOnboardingDraft`, `acknowledgeLegal`,
  `isLegalAcknowledged`, `completeOnboarding({ answers, preview | null })` (one transaction: profile,
  settings, default equipment profile, first bodyweight, meet, plan and sessions; draft cleared;
  ONB-04 time off ramps the first weeks in, PRG-13).
- **Equipment:** `listEquipmentPresets`, `equipmentProfileFromPreset`, `newCustomEquipmentItem`,
  `saveEquipmentProfile`, `setDefaultEquipmentProfile`, `deleteEquipmentProfile`,
  `previewEquipmentChange` and `applyEquipmentChange` (EQP-05).
- **Plan:** `generatePlanPreview({ answers, options })` → `PlanPreview { proposal, why, level,
  levelWhy, schedule, startDate, calendar, versions }`, `acceptPlan`, `previewPlanEdit` and
  `savePlanEdit({ edits, scope: 'nextSession' | 'nextMesocycle' })`.
- **Schedule:** `moveSession`, `swapSessions`, `listMissedSessions`, `resolveMissedSession({ choice:
  'doToday' | 'skip' | 'merge' })` (each returns the changed sessions, the explanation and the
  spacing conflicts of the touched weeks), `startBreak`, `endBreak`.
- **Mesocycle:** `postponeDeload`, `skipDeload`, `checkReactiveDeload({ lowReadinessDays?,
  painFlags? })`, `bringDeloadForward`, `proposeNextMesocycle`, `acceptNextMesocycle`.
- `answersFromProfile` and `traineeLevel` help the re-planning screens.

### Rules and content

- **Registry 1.0.0 → 1.1.0** (`1.1.0+fc07efc1c16a`), 109 → **125 parameters**, 24 → 30
  `verified: false`. New tables `planning.yaml` (`planning.mesocycle.accumulationWeeks` 3–8,
  `planning.novice.maxWorkingExercises` 5, `planning.sessionBudget.tolerancePct` 10,
  `planning.slot.sets` 2–5, `planning.strength.accessorySets` 3, `planning.volume.startPosition`
  novice 0.2 / intermediate and advanced 0.5 / priority 0.8, `planning.rotation.perMuscle` 1–2,
  `planning.variety.pool` 3, `planning.missed.mergePriorities` [primary]) and `ranking.yaml`
  (`ranking.effectiveness`: weights credit 0.4, evidence 0.15, stretch 0.15, overload 0.2,
  sub-region 0.1; evidence H 1, EMG 0.5, C 0). New rows `session.duration.repSeconds` 3.5 (EB
  3–4 s), `session.duration.warmupSetSeconds` 60, `session.duration.transitionSeconds` 90 (EB
  1–2 min), `volume.strength.minimumDosePerLift` 3–6, `volume.effort.strengthAccessoryRpe` 7–9,
  `deload.planned.postpone` (1 week, once per mesocycle). New sources (`data/sources/planning.yaml`):
  `src.powr-prd`, `src.kassiano2022`, `src.bazvalle2019`, `src.iversen2021`. POWR design values (slot
  sets, accessory sets, start positions, variety pool, merge priorities, ranking weights) ship
  `verified: false`; PRD numbers and EB-transcribed values `verified: true`, as in M1.
- **`rules.json` is committed** (`packages/rules/generated/rules.json`, like `content.json`; the
  build writes it and `build.test.ts` fails when it is stale) and is the new entry
  `@powr/rules/built-in`.
- **Rule references:** the templates' `deloadRule: deload.planned` named no parameter; it is now
  `deload.content` (the deload week's content, PRG-11), and the content lint fails on a
  `deloadRule` that is not a registry parameter (proof test added). The lint reads the EB rep, RIR
  and RPE bands from the compiled registry instead of mirroring them (M1-B follow-up closed).
- **Progression names aligned:** templates use the registry's `ProgressionModel` names (`rpe`,
  `linear` instead of `rpeLoad`, `linearLoad`); content re-exports `PROGRESSION_MODELS` and
  `TRAINEE_LEVELS` from `@powr/domain/rules`.
- **TD-24 closed:** eight new default templates (BB full body ×2; PL SBD ×2, 5-day and 6-day
  advanced; PB full body ×2 and ×3, UL + PPL 5-day, PPL ×2 with strength days). Every PLN-02 cell
  has one; the coverage test's gap list is empty.

### Persistence (TD-19 decided: version 2, not an extended version 1)

IndexedDB creates object stores only in a version change, so devices with M0/M1 data (developer
phones, the S22 test runs) need a version bump to get the new stores, and backups made by M0/M1
builds must keep importing (DAT-07). No beta users exist, so extending v1 was possible, but it would
have exercised neither path before real data exists (R-13). `DATA_VERSION` 2 adds seven tables
(`profile 'id'`, `equipmentProfiles 'id'`, `plans 'id, status'`, `plannedSessions 'id, localDate,
[planId+localDate], status'`, `breaks 'id, startDate'`, `meets 'id, date'`, `bodyweights 'id,
localDate, measuredAt.epochMs'`); settings gains optional `weekStart` and `overrides` (expand only).
Migration 1 → 2 passes records through (every v1 record is valid at v2; a test pins that) and runs
in the Dexie upgrade and in backup import like any later step. Strict v2 record schemas live in
`records/v2.ts` (the v1 schemas are unchanged); the manifest's `counts` became partial so v1 backups
validate; referential checks cover plans → equipment profiles, planned sessions → plans, slot
exercises, one active plan and one default profile. The reserved-key and depth check already runs
on every data file, so it covers the new tables; the free-form `settings.overrides[].value` gets the
same check in its schema (TD-22 item; hostile-key tests for the new tables added). The committed
fixture `packages/formats/fixtures/backups/v1/active-session.zip` (made by the M1 encoder, with an
active session) is imported by `test/fixtures.test.ts`; `db.test.ts` upgrades a v1 database with
an active session to v2.

### Decisions and deviations

| Concept / brief says                                                | What I did                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan generation in the engine worker (§6.1, §8.7.8)                 | Runs in the lazy `@powr/application/planning` chunk on the main thread (no worker exists yet); a few ms per plan on the dev machine (the matrix test asserts < 1 s, NFR-PERF-09). Move it to the engine worker with the recompute work (M3/M4)                                      |
| `exerciseUserData.flags` holds `avoid` (§8.2.2)                     | The avoid list (exercises and patterns), priorities and favourites live in `profile`: one source for ONB-07 and EXL-08, and patterns have no exercise row. M4 can move exercise flags to `exerciseUserData` with a migration                                                        |
| `Prescription` sketch (§5.6) with single reps and RIR               | Reps and RIR are ranges (`SetBlock`), because templates state ranges; RPE is stored as RIR (RPE = 10 − RIR). Slots carry `progression` separately: a double-progression slot progresses by double progression, RPE and top-set slots by the template's main (novices: novice) model |
| "Heavy sets" (≥ 80% 1RM, 1–6 reps, PLN-03)                          | The sets of strength lift slots at ≤ 6 reps on heavy or moderate days; light days are submaximal practice and count for frequency only. No %1RM is computed at plan time                                                                                                            |
| "De-prioritized muscles at the floor or maintenance level" (PLN-03) | Muscles that only optional template slots train get a maintenance target (`volume.maintenance`: a third of the band target, at least the floor of 4) and need one session a week                                                                                                    |
| Deload content ranges (sets −40–60%, RIR +2–3)                      | Sets × 0.5 (the midpoint), RIR + 2 (the low end), load 85–100% (80–90% for hypertrophy work); accessories kept and marked optional                                                                                                                                                  |
| Return from break "back to plan within 1–2 weeks" etc. (PRG-13)     | The row's longer ramp, linear back to 100% per week (8–14 days: 2 weeks; 5–8 weeks: 4 weeks); 8–14 days applies to the whole first week, not only session 1 (the cautious side)                                                                                                     |
| "Do it today (shifting the rest of the week)" (PLN-11)              | Later sessions of the week move only as far as needed to stay a day apart; one that would leave the week stays on its last day (the spacing warning then shows)                                                                                                                     |
| Reactive deload "any 2 signals" (PRG-12)                            | Two different signal kinds. e1RM decline comes from logged sets (session e1RMs of the primary lifts); readiness and pain are inputs until RDY-02 (M3) and RDY-04 (v1.3). Proposes only while the deload is more than a week away                                                    |
| PLN-13 "adjusts volume targets in small steps (PRG-16, v1.x)"       | Targets are re-derived for the re-evaluated level and capped at logged volume × 1.2 where the logs show less; performance-driven steps are PRG-16 (v1.x)                                                                                                                            |
| Plan-matrix snapshot (§8.6.5 check 5)                               | `packages/application/test/__snapshots__/plan-matrix.test.ts.snap`: one line per template × preset × level at 60 minutes (exercises, sets, violations with their cause)                                                                                                             |
| `RULES_VERSION` 1.0.0                                               | Bumped to 1.1.0 (16 new parameters, two new tables)                                                                                                                                                                                                                                 |

### Template matrix

15 templates × 6 presets × 3 levels × 6 budgets (30, 45, 60, 75, 90, 90+) = 1,620 combinations:
744 plans, every one with `report.ok` (no avoidable violation, only available exercises, every day
over budget + 10% flagged); 552 expected `plan.lift.unavailable` (powerlifting and powerbuilding
templates with the dumbbell, bodyweight, hotel and empty presets: no barbell and rack); 324 expected
`plan.template.levelMismatch` (templates not offered to the level: BB 5- and 6-day, PL 4- and 5-day,
PB 4-, 5- and 6-day for novices; PL 6-day also for intermediates). Unavoidable violations remain and
are flagged with their cause: at 60 minutes most bodybuilding and powerbuilding plans leave some
muscles below target (time budget), and without a budget a few stay low because the template gives
them one or two slots of at most 5 sets (side delts, adductors, obliques). The empty "Custom" preset
generates bodyweight-only plans with `equipment` causes. Property tests (3,000 random runs each,
once, besides the CI default): determinism under shuffled content and any seed; never an
unavailable or avoided exercise in the plan or the swap lists; no avoidable violation, or an
explained refusal. The determinism property found one order dependence (the missing-equipment list
of `plan.lift.unavailable`), fixed by sorting.

### Evidence

`pnpm verify` green: lint, format, knip, i18n, typecheck, 567 unit tests (50 files), build,
licence, size (entry JS **177.1 kB** gzip, budget 186 kB; startup path 8 scripts, 0 with Zod) and 22
E2E. No screen imports the planning chunk yet; the rules data chunk (`built-in-*.js`, about 48 kB
raw) loads at boot, the resolver chunk on first use.

### Open items

- **For M2b:** the screens and hooks (one lazy loader for `@powr/application/planning` with the lint
  disable comment, as `use-data.ts` does for backups); the route guard (no profile → onboarding;
  `isLegalAcknowledged`); English `why.*` messages for the new rule IDs (TD-28); storing dismissed
  warning keys (PLN-09) in `meta`; the week-start default from `Intl.Locale` (SET-11) when settings
  have none; equipment item icons by category.
- **Product owner:** (1) at 45–60 minutes the PLN-03 bands are out of reach for many muscles in
  full-body and powerbuilding templates; the duration model (EB: warm-up set ~1 min, transition
  1–2 min, compound rest 2:30) or the templates' slot count may need a decision (fewer accessories
  per day, more than 5 sets per slot, or time-saver rest by default); (2) the POWR design values
  above (`verified: false`); (3) maintenance targets for optional-only muscles; (4) whether
  "Custom (empty)" should plan bodyweight work or ask for equipment first; (5) deload RIR +2 vs +3
  and the 50% set cut.
- **Later:** generation in the engine worker; per-lift days since training for PRG-13 (now days
  since the last logged session); readiness and pain signals (M3, v1.3); PRG-16 volume steps (v1.x);
  peaking (PLN-16, v1.1); the `docs/` pass for M2.

## M2b screens

Written 2026-11-24 by the M2b work (roadmap A.4 "M2 Onboarding and planning", the screens on top
of M2a, plus the product-owner decisions of 2026-11-24 listed below). Status: `pnpm verify` green.

### What landed

| Area                    | Where                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| First-run guard         | Root route `beforeLoad` (`src/app/first-run.ts`, `firstRunState` in the `@powr/application` root, `src/features/legal/versions.ts`)           |
| Lazy loader, live data  | `src/hooks/use-planning.ts`: `usePlanning()` (the one `import('@powr/application/planning')`), live queries, `useWeekStart()`                 |
| Onboarding              | `src/features/onboarding/` (`OnboardingFlow.tsx`, `steps.tsx`, `answers.ts`), routes `/onboarding/$step` and `/plan/setup/$step`              |
| Legal texts             | `src/features/legal/LegalScreens.tsx`, routes `/legal/privacy`, `/legal/disclaimer` (drafts for the legal review V-06)                        |
| Equipment               | `src/features/equipment/` (editor, profile list, preset picker, substitution review), routes `/settings/equipment`, `…/$profileId`            |
| Plan preview, editor    | `src/features/plan/` (`PlanPreviewView.tsx`, `PlanEditorScreen.tsx`, `parts.tsx`, `format.ts`), route `/plan/edit`                            |
| Schedule, next block    | `src/features/plan/PlanScreen.tsx` (week view, missed sessions, breaks, deload), `NextMesocycleScreen.tsx`, routes `/plan`, `/plan/next`      |
| "Why?"                  | `src/features/why/` (`WhySheet.tsx` reusable, `format.ts` arguments → words, `messages.ts` 117 rules, `args.ts`, `messages.test.ts`)          |
| Labels                  | `src/features/labels.ts` (content names and enum labels)                                                                                      |
| Design system           | `src/ui/tokens.css`, `app.css`, new `sheet.tsx`, `badge.tsx`, `choice.tsx`, `field.tsx`; `button.tsx`, `segmented.tsx`, `screen.tsx` edited   |
| Token gate              | `tools/tokens-check` (`pnpm tokens:check`, in `pnpm verify` and the CI quality job)                                                           |
| Use cases added         | `firstRunState`, `setWeekStart` (root); `slotCandidates`, `addCandidates`, `newPlanSlot` (planning entry, `src/planning/candidates.ts`)       |
| Domain (delegated, M2b) | Time-budget prioritisation (`planning/budget.ts`), `equation` curve class, `Plan.dismissedIssues` with `dismissPlanIssue`/`restorePlanIssues` |
| Tests                   | `apps/web/test/` (component tests), `apps/web/e2e/planning.spec.ts` and `planning.ts`, `packages/application/test/m2b.test.ts`                |

Home shows the next planned session or "Plan not set up"; Settings gained Equipment, the week start
and the legal texts. The existing E2E specs pass the first-run guard with `skipOnboarding` (the legal
gate, then "Just let me log").

### Product-owner decisions (2026-11-24) and what they became

1. **The mock-up's look, accessibility first.** Tokens retuned (deep slate surfaces, green action,
   teal `--info`, amber `--warning`, coral `--danger`, heat-map steps); WCAG 2.2 AA wins every
   conflict (see "Mock-up vs accessibility" below). The token gate checks every pair.
2. **Time budget: prioritise.** Priority muscles (else the template's primary-slot muscles) keep
   their full target; the others fall back towards 4 weekly sets; the plan shows the reason and
   the fixes (more minutes, an extra day). Evidence below.
3. **Empty "Custom" preset:** picking it opens the editor ("Toggle what you have access to")
   before a plan is generated; saved empty, the preview shows a bodyweight plan with the note "You
   saved your equipment list empty, so this plan uses bodyweight exercises only…". Powerlifting
   and powerbuilding without a barbell get no plan; the preview says why and offers "Change
   equipment" and "Change goal".
4. **Deload and maintenance defaults approved:** deload RIR +2 and sets −50%; maintenance a third
   of normal, at least 4 sets and one session a week. No value changed.
5. **TD-30:** `benchLike` → `equation` in `CURVE_CLASSES`, `load.curve.classMap`, the content
   YAML and schema, `content.json`, tests and fixtures (no ID lock affected). Rules 1.1.0 → 1.2.0
   (`1.2.0+4a41caaa2812`), content 0.1.0 → 0.2.0 (`0.2.0+sha.37ed9c7b`).

### Evidence for the new parameters (rules 1.2.0: 125 → 127 parameters, 30 → 31 `verified: false`)

| Parameter                        | Value                                                            | Evidence and sources                    | Verified | Why                                                                                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------- | --------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `volume.hypertrophy.minimumDose` | `{ setsPerWeek: 4 }`                                             | [NARR] `src.iversen2021`                | true     | EB §Volume › Minimum and maintenance doses: Iversen recommends at least 4 weekly sets per muscle at 6–15RM. A row of its own: `weeklyBands.floor` is the same number but a preprint detectability limit the validator flags against |
| `planning.timeBudget.fallback`   | `{ keepFull: [priorities, template], templateSlots: [primary] }` | [INF] `src.powr-prd`, `src.iversen2021` | false    | POWR design value (product-owner decision): which muscles keep their full target when the budget is tight; the first non-empty group wins                                                                                           |

**Plan-matrix snapshot diff** (`packages/application/test/__snapshots__/plan-matrix.test.ts.snap`,
the 60-minute lines): 73 of 270 lines changed; exercise counts unchanged everywhere; total sets per
plan unchanged in 45 lines, +1 in 24, +2 in 3, +4 in 1; violations in the changed lines 518 → 393
(59 lines fewer, 2 lines one more: `bb-full-body-3day` with bodyweight and bands for intermediates
and advanced, where abs and calves rise from below the floor to low and the front delts give sets
to the minimum-dose step). 77 of 124 generated 60-minute plans now carry lowered targets (207
targets; most often 15 → 4, 15 → 5.5, 15 → 5, 15 → 9, 15 → 14.5); none in powerlifting templates.
Example `bb-full-body-2day | commercial-gym | intermediate`: 12 violations → 9; elbow flexors, side
delts and triceps lowered 15 → 5 / 4 / 5; abs and calves rise from 3 / 2.5 to 4 / 4.75 sets. Whole
matrix (every budget): 371 of 1,620 combinations changed, 346 plans with lowered targets (1,124
targets), nothing changed at 90+, `report.ok` changed for no plan (all 744 still pass). Suggested
budgets: 30 → 45 to 75; 45 → 60 to 90+; 60 → 75 to 90+; 90 → 90+.

### PRD coverage (requirement → screen or element)

| PRD                    | Screen or element                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ONB-01, LEG-01…03      | `/onboarding/welcome`: what POWR is, privacy summary (3 sentences) with link, health notice with link, two confirmations (notices; 16 or older); nothing stored before; route guard; re-ask on a new version; `/legal/*`, Settings links                                                                                     |
| ONB-02                 | Step "Units and body": weight and length units, sex with the reference-set question for "prefer not to say", birth year, height, body weight (first bodyweight entry)                                                                                                                                                        |
| ONB-03                 | Step "Your goal": three styles with a one-sentence description and an example week; body-weight goal optional                                                                                                                                                                                                                |
| ONB-04                 | Step "Your experience": training age, time off, RPE/RIR familiarity with an explanation on tap. Not asked: recent weekly sets per muscle (optional in the PRD; TD-34)                                                                                                                                                        |
| ONB-05                 | Step "Your week": 2–6 days (chips in the locale's week order), 30–90+ minutes, optional start times                                                                                                                                                                                                                          |
| ONB-06, EQP-02         | Step "Your equipment": six presets, pick and "Use this preset" (2 taps); "Adjust the equipment list"; Custom opens the editor                                                                                                                                                                                                |
| ONB-07                 | Step "Priorities" (optional, skippable): up to 3 priority muscles, movement patterns and exercises to avoid                                                                                                                                                                                                                  |
| ONB-08, ONB-09, ONB-11 | Not built (TD-34): baselines (the calibration fallback applies), meet details, the system set-up step (persistent storage stays on the Data screen)                                                                                                                                                                          |
| ONB-10                 | Step "Your plan" (`PlanPreviewView`): template and level with "Why?", first week on the calendar, sessions with exercises, sets, reps, effort, rest, minutes, weekly sets per muscle against the band, progression, start date, checks; change days/time, goal or equipment and regenerate; "Accept plan", "Accept and edit" |
| ONB-12                 | Draft saved after every step, `/onboarding/resume` continues it; "Skip this step"; "Just let me log" on every step; answers changeable through `/plan/setup/*` (prefilled)                                                                                                                                                   |
| ONB-13                 | One profile, no account, no e-mail or name asked                                                                                                                                                                                                                                                                             |
| EQP-01                 | Editor: categories with toggle rows, search by name and synonym ("hex bar" finds the trap bar). Item icons: category headings only (TD-34)                                                                                                                                                                                   |
| EQP-03                 | Editor load details: bar weights (with "models differ"), collars, plate and microplate pairs with ±, dumbbells, kettlebells, machine and cable steps, bands                                                                                                                                                                  |
| EQP-04                 | Every list (plan, swap, add, substitutions) comes from the use cases' `isAvailable` filter                                                                                                                                                                                                                                   |
| EQP-05                 | Settings → Equipment → Edit → Save: `previewEquipmentChange`, then "Review plan changes" (best match preselected, or keep), then `applyEquipmentChange`                                                                                                                                                                      |
| EQP-07                 | Editor "Your own items"                                                                                                                                                                                                                                                                                                      |
| PLN-01, PLN-04         | "Plan checks" in the preview and "Checks" in the editor: severity, message, cause, fixes; schedule changes show a spacing heads-up                                                                                                                                                                                           |
| PLN-02                 | Template chosen by the generator with its "Why?"; choosing another template is not offered yet (TD-34)                                                                                                                                                                                                                       |
| PLN-03                 | Weekly sets per muscle against target and band (mini heat map), target source and full target; editor "Change weekly targets"                                                                                                                                                                                                |
| PLN-05, PLN-06         | "Why?" per exercise (ranking factors); editor move up/down buttons                                                                                                                                                                                                                                                           |
| PLN-07                 | Prescriptions in words (sets × reps, RIR or "reps left" for novices, rest)                                                                                                                                                                                                                                                   |
| PLN-08                 | Plan card "week N of M", deload card with its dates; block length choice not offered (TD-34)                                                                                                                                                                                                                                 |
| PLN-09                 | `/plan/edit`: `PlanEdit`s, live `previewPlanEdit`, one-tap fixes, dismiss (persisted), undo, scope question on save                                                                                                                                                                                                          |
| PLN-11                 | `/plan` week view, session sheet (move, today, swap), missed sessions (do today, merge, skip), each change with its explanation                                                                                                                                                                                              |
| PLN-12, PRG-13         | Breaks card: start (reason, dates), end ("I'm back") with the return ramp; "Easing back in" badges                                                                                                                                                                                                                           |
| PLN-13, PRG-10         | `/plan/next`: proposal, rotations with reasons, level with "Why?", accept                                                                                                                                                                                                                                                    |
| PLN-14                 | Minutes per session against the budget, "over your time" badge, time-budget note with "Allow N min per session" and "Add a training day"                                                                                                                                                                                     |
| PLN-15                 | "Just let me log"; "Plan not set up" on Plan and Home                                                                                                                                                                                                                                                                        |
| PRG-11, PRG-12         | Deload card: postpone (once), skip, "Do I need it sooner?" (reactive check) and "Bring the lighter week forward"                                                                                                                                                                                                             |
| PRG-09, NFR-USE-04     | `WhyButton` / `WhySheet` everywhere a choice or warning shows                                                                                                                                                                                                                                                                |
| SET-11, NFR-L10N-01    | Settings "First day of the week" (locale default from `Intl.Locale` week info)                                                                                                                                                                                                                                               |
| PLN-10, SET-05, SET-08 | Not built (TD-34)                                                                                                                                                                                                                                                                                                            |

### Mock-up vs accessibility (for comparing with the screenshots)

| Mock-up                                              | Changed to (and why)                                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| White text on the vibrant green button               | Dark text `#03200f` on green `#34d27b` in dark (8.75:1); light theme green `#137a3e` with white (5.41:1), which also passes as text on white                                                                       |
| Dim grey captions ("No account required", "Last: …") | `--fg-muted` passes 4.5:1 on every surface in both themes (lowest 6.11:1)                                                                                                                                          |
| Small teal labels                                    | `--info` `#0d7068` / `#3fc8bf` (5.0:1 / 7.1:1 at the lowest)                                                                                                                                                       |
| Faint card and list outlines                         | Decorative `--border` for cards; controls (toggles, inputs, chips, buttons) get `--control` (≥ 3.88:1)                                                                                                             |
| Dark navy "under 4 sets" heat step                   | Every step ≥ 3:1 on every surface and ≥ ΔE00 10.7 from its neighbours with simulated protanopia, deuteranopia and tritanopia; band numbers next to every swatch; "Target met" / "N below target" badges with icons |
| Status by amber/coral colour                         | Icon plus words ("Needs attention", "Worth a look", "Target met")                                                                                                                                                  |
| Plate inventory as disc pictures                     | Text rows "20 kg × 4 pairs" with ± buttons named "One pair more of 20 kg"                                                                                                                                          |
| Check marks as the only toggle state                 | Real checkboxes (box plus check) with the item name as the label                                                                                                                                                   |
| Portrait-only phone frames                           | The layouts reflow at 320 px and 200% text; the manifest's portrait lock conflicted with WCAG 1.3.4 and was removed at the merge (TD-35 closed)                                                                    |

Also from the accessibility brief: unique page titles; focus clear of the sticky header and bottom
navigation; sheets return focus to their trigger; errors in words next to the question plus a
focused summary; polite live regions that change only when the content changes; move and reorder
by buttons; reduced motion for sheets and transitions.

**Fixed at merge (coordinator, 2026-11-24): focus behind the sticky action bars (WCAG 2.4.11).**
The equipment editor and the plan editor stack a sticky Save/Cancel (Undo) bar on top of the
bottom navigation, but the page's `scroll-padding-bottom` (7rem) only covered the navigation, so a
checkbox reached by Tab could scroll fully behind the bar. Both screens now use
`ui/action-bar.tsx` (`ActionBar`): it measures its own height with a `ResizeObserver` and sets
`--action-bar-inset` on the root through the CSSOM, and `app.css` adds it to the scroll padding.
That also covers the buttons wrapping at 320 px or 200% text. The E2E test "keyboard focus never
hides behind the sticky action bar (WCAG 2.4.11)" tabs through the equipment editor at 100% and
200% text and checks every focused field against the header and the bar. With the old fixed
padding it fails, as it should.

**Fixed at merge: a view swapped inside the same route kept the old scroll position.** After "Save
equipment", the editor shows "Review plan changes" in the same route, so React kept the `Screen`:
the review opened 857 px down, with its heading off screen and its first options under the
sticky header (axe flagged a target-size violation). `Screen` now treats a title change as a new
screen: it scrolls to the top and moves focus to the new h1. The first render still leaves the
position to the router's scroll restoration. The EQP-05 test asserts that the review heading is
in the viewport and focused.

**Still needs a manual TalkBack pass on the S22** (axe cannot verify): the announcements of the
editor's check summary and of schedule changes (once, not flooding); the sheets' focus trap and
return with TalkBack gestures; radio cards whose name includes a long description; the weekday and
muscle chips' pressed state; `<details>` explanations; the native date and time inputs and the
weekday `<select>`; real 200% system font scaling (E2E uses root font size 200%); the reading order
of the plan preview.

### Decisions and deviations

| Concept / brief says                                                       | What I did                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes `/plan/week/$n`, `/plan/edit/$planId`, `/plan/session/$id` (§8.9.1) | `/plan?week=YYYY-MM-DD`, `/plan/edit` (the active plan), the planned session as a bottom sheet; added `/plan/setup/$step`, `/plan/next`, `/settings/equipment/*`, `/legal/*` (§8.9.1 amended in v0.5)                                                          |
| Forms with React Hook Form + Zod (§8.5)                                    | React state; steps check only that required answers are given; the use cases validate ranges and return field errors that map to their step. No Zod in the app, no `src/zod.ts`                                                                                |
| Re-planning                                                                | `/plan/setup/*` asks the onboarding questions again (prefilled) and stores through `completeOnboarding`, which now keeps the profile's `createdAt`                                                                                                             |
| `--accent` token                                                           | `--info`: shadcn's `--accent` is the bridged hover surface in `app.css`                                                                                                                                                                                        |
| Missed sessions                                                            | Derived on the screen from the live planned sessions with the domain's `missedSessions` (the rule `listMissedSessions` uses), so the list updates as soon as one is resolved                                                                                   |
| The English catalog in the entry chunk                                     | A lazy chunk loaded at boot in parallel with the database, content and rules: the "Why?" texts and the new screens grew it by about 20 kB gzip (entry 202.75 → 178.29 kB); a failure shows the startup error (`i18n.error`)                                    |
| `lingui extract --clean`                                                   | Also `--overwrite` (script and catalog check): Lingui keeps the old text of a changed explicit-ID message otherwise                                                                                                                                            |
| Lingui pseudo-locale for the +30% test (§8.15)                             | It only accents characters; the component test builds an expanded catalog itself                                                                                                                                                                               |
| Component tests next to the code                                           | `apps/web/test/`, outside `src`: they compose infrastructure (Dexie, the rules provider), which `src/features` may not import; Vitest project `apps/web/vitest.components.config.ts` reusing the app's Vite config, `LINGUI_CONFIG` set for runs from the root |
| "Sources" in the Why sheet (§8.7.3)                                        | Short names from the source IDs and parameter IDs in words (TD-33)                                                                                                                                                                                             |
| Tailwind class detection                                                   | `@source not` for scripts, E2E, public, configs, JSON, catalogs, the service worker, infrastructure and tests (only a dead `accent-foreground` utility left the CSS)                                                                                           |
| `role="status"`                                                            | `<output>` (oxlint `prefer-tag-over-role`)                                                                                                                                                                                                                     |
| Dismissed warning keys "in `meta`" (M2a open items)                        | On the plan record (`Plan.dismissedIssues`, the issue keys, at most 500), amending the unreleased version-2 record schema; `dismissPlanIssue` and `restorePlanIssues` in the planning entry                                                                    |
| A flaky property test (`plates.test.ts`)                                   | Bound 0.005 → 0.01 + 1e-9 (the solver is right; 0.01-grid ties), counterexample pinned                                                                                                                                                                         |

### Evidence

`pnpm verify` green on 2026-11-24: lint (0 errors), format, token gate ("24 colours × 2 themes;
170 pairs; lowest text 4.56, on fills 5.41, UI 3.88, heat map 3.13; heat-map steps ΔE00 ≥ 10.7"),
knip, catalog check, typecheck, 615 tests in 58 files (603 unit, property and migration tests in 54
files plus 12 component tests in 4 files), build, licence gate (33 distributed, 621 build-only,
passed), size (entry JS **178.29 kB** gzip of 186 kB, CSS 5.78 kB, service worker 7.71 kB; precache
80 files, 462.3 kB; startup path 7 scripts, 0 with Zod) and 32 E2E tests (10 new in
`planning.spec.ts`: core path with "Why?", resume, "Just let me log", empty Custom, equipment
change with substitution, plan edit with a live warning and a fix, missed session, offline
onboarding, reflow at 320 px and 200% text, the remaining screens; axe in both themes on every new
screen). Screenshots at 360 × 780, light and dark, were handed to the coordinator outside the
repository.

### Open items

- TD-32…TD-36 (technical concept §11.2): generation in the engine worker; citations and parameter
  labels in the Why sheet; the screens not built (ONB-08, ONB-09, ONB-11, PLN-02 template choice,
  PLN-08 block length, PLN-10, SET-05, SET-08, equipment icons); the time-budget step in the
  next-mesocycle proposal. TD-35 (portrait lock) is closed.

**Product-owner answers after M2b (2026-11-24):**

- Manifest orientation lock removed (WCAG 1.3.4, TD-35); `offline.spec.ts` asserts it stays absent.
- en-US defaults to lb, every other locale to kg (units stay changeable in onboarding and settings).
- The time-budget trade-off is accepted: keep-full muscles may lose about 1 set to the
  minimum-dose step, and in full-body templates mostly arms, calves and side delts fall back.
- The next-block proposal follows the same time-budget rule (TD-36).
- A short **M2c** before M3: ONB-08 baselines, the PLN-02 template override, the PLN-08 block
  length, TD-36 and the lint-warning clean-up.
- PRD v0.4 adds both M2b decisions (PLN-14 time budget; EQP-02/ONB-06 Custom (empty)).
- Dev databases with plans written by M2a builds lack `dismissedIssues` and fail the strict v2
  schema on backup import: reset them (no released data is affected).
- `pnpm --filter @powr/rules build -- --diff <old>` crashes when the old `rules.json` lacks a new
  parameter (the new file is still written first).
- If the catalog chunk itself fails to load, the startup error shows message IDs instead of its
  text.

## M2 tooling (TD-09, TD-10, TD-12)

Written 2026-11-24 by the M2 tooling work, in parallel with the M2b screens. Scope: TD-09, TD-10
and the Lighthouse CI and Trusted Types parts of TD-12. The token contrast gate
(`tools/tokens-check`, the rest of TD-12) and TD-11 stay with M2b. Status: `pnpm verify` green;
Lighthouse run locally.

### What changed

| TD    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Files                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-09 | Lingui macros through Lingui's native transform (`lingui({ macroTransform: true })`, `@lingui/native-tools` 0.2.0, SWC-based, already installed as a dependency of `@lingui/cli` and `@lingui/vite-plugin`). Babel keeps only the React Compiler preset. `linguiTransformerBabelPreset`, `LINGUI_SUPPRESS_BABEL_WARNING` and the app's `@lingui/babel-plugin-lingui-macro` devDependency are gone (the Lingui CLI's extractor depends on that package itself) | `apps/web/vite.config.ts`, `apps/web/package.json`, `pnpm-lock.yaml`                                                                                                                                                                                    |
| TD-10 | The React Compiler rules run natively only: 13 rules explicitly blocking, 4 compiler versions of hook rules explicitly as warnings; the alpha `eslint-plugin-react-hooks` JS plugin, its 12 rule entries and the root devDependency are removed. OQ-T10 now covers `eslint-plugin-lingui` only. The OQ-T10 probe test that expected `react-hooks-js(purity)` warnings is replaced by a probe that proves five native rules block                              | `oxlint.config.ts`, `package.json`, `pnpm-lock.yaml`, `tools/arch-test/test/boundary-probes.test.ts`                                                                                                                                                    |
| TD-12 | Lighthouse CI 0.16.1 (Lighthouse 13.6.0): `pnpm lighthouse` against the production build served with the production headers; budgets relative to a stored per-environment baseline; CI job on `main` pushes, nightly and on demand                                                                                                                                                                                                                            | `apps/web/scripts/lighthouse.ts`, `apps/web/lighthouse-baseline.json`, `apps/web/package.json`, `package.json`, `.github/workflows/ci.yml`, `.gitignore`, `pnpm-workspace.yaml` (overrides), `pnpm-lock.yaml`                                           |
| TD-12 | Trusted Types in dev and E2E: `require-trusted-types-for 'script'; trusted-types powr-sw` on the Vite dev server and appended to the production CSP by the E2E server; one named policy for the only script sink (the service-worker URL); one E2E test proves enforcement. `deploy/` is unchanged (production stays TD-03)                                                                                                                                   | `apps/web/scripts/trusted-types.ts`, `apps/web/vite.config.ts`, `apps/web/e2e/static-server.ts`, `apps/web/e2e/trusted-types.spec.ts`, `apps/web/src/infrastructure/security/trusted-types.ts` (new), `apps/web/src/infrastructure/pwa/registration.ts` |

### TD-09: native Lingui macro transform (switched)

- **Plugin order matters.** Both `lingui()` (its macro plugin) and `@rolldown/plugin-babel` are
  `enforce: 'pre'`, so they run in array order. With Babel first, the React Compiler saw the raw
  macros and skipped four components ("(BuildHIR::lowerExpression) Handle tagged template with
  interpolations": `LogSetScreen`, `DataScreen` ×3), and the data and session chunks lost their
  memoization (8,126 → 7,174 and 23,974 → 21,885 bytes). `lingui()` now comes first, with a comment.
- **Build output.** Two Babel builds were byte-identical (determinism check). The native build,
  compared with the Babel build chunk by chunk with content hashes normalised: 29 of 30 assets
  identical; the session chunk differs only in the key order of one message's `values` object
  (`{0: …, name, weight}` vs `{name, weight, 0: …}`: the same object at runtime, integer keys
  enumerate first). The compiler report has the same single bail-out as before
  (`features/debug/CapabilityProbe.tsx`).
- **Dev output** (`transformRequest` of three macro-heavy files): identical message descriptors
  (`id`, `message`, `values`); only helper import names (`_useLingui` → `$_useLingui`, `_Trans` →
  `Trans_`), property order, React Refresh signatures and the `jsxDEV` line numbers differ (one
  lower in files where the native transform drops the macro import line; dev-only debug data).
- **Catalog.** `pnpm i18n:extract` leaves `messages.po` unchanged (79 messages; extraction runs in
  the Lingui CLI and does not use the Vite transform); `pnpm i18n:check` passes. No build warning.
- **Tailwind gotcha found on the way.** Tailwind's automatic source detection scans all of
  `apps/web`, including `vite.config.ts` and `scripts/`: a comment with the word "transform" added
  the `.transform` utility and five `@property` rules to the CSS, and two words in a script comment
  added two more utilities. The comments were reworded (final CSS identical to the baseline).
  Proposal for M2b (owner of `src/ui/app.css`): exclude non-UI folders, e.g.
  `@source not "../../scripts"; @source not "../../e2e";`.

### TD-10: React Compiler lint parity (alpha plugin removed)

Method: a scratch oxlint config enabled every compiler rule twice, natively (`react/*`, error) and
through the alpha plugin (`eslint-plugin-react-hooks` 7.1.1 as JS plugin, warn), and linted 30
probe files (at least one per rule, plus a clean control that neither flags). On the code base both sets reported nothing before the
change, and the native set reports nothing after it.

| Rule                             | Native oxlint 1.95           | Probe                                                       | Alpha fires                                                                                               | Native fires                                                            | Now                                  |
| -------------------------------- | ---------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| `purity`                         | correctness                  | `Math.random()`, `Date.now()` in render                     | 2                                                                                                         | 2 (same lines)                                                          | error                                |
| `refs`                           | correctness                  | `ref.current` written in render                             | yes                                                                                                       | yes                                                                     | error                                |
| `immutability`                   | correctness                  | mutate a `useState` object, props, a value passed to a hook | yes                                                                                                       | yes                                                                     | error                                |
| `globals`                        | correctness                  | module variable reassigned in render                        | yes                                                                                                       | yes                                                                     | error                                |
| `set-state-in-render`            | correctness                  | `setState` in the render body                               | yes                                                                                                       | yes                                                                     | error                                |
| `set-state-in-effect`            | correctness                  | synchronous `setState` in `useEffect` (also derived state)  | yes                                                                                                       | yes                                                                     | error                                |
| `static-components`              | correctness                  | component declared in render                                | yes                                                                                                       | yes                                                                     | error                                |
| `use-memo`                       | correctness                  | `async` and parameterised `useMemo` callbacks               | yes                                                                                                       | yes                                                                     | error                                |
| `void-use-memo`                  | correctness                  | `useMemo` without return, result unused                     | yes                                                                                                       | yes                                                                     | error (not in the alpha set before)  |
| `preserve-manual-memoization`    | correctness                  | memo dependency mutated after a hook call                   | yes                                                                                                       | yes                                                                     | error                                |
| `incompatible-library`           | correctness                  | `useVirtualizer` from `@tanstack/react-virtual`             | yes                                                                                                       | yes                                                                     | error                                |
| `error-boundaries`               | correctness                  | JSX in `try`/`catch`                                        | yes                                                                                                       | yes                                                                     | error                                |
| `unsupported-syntax`             | restriction (off by default) | `eval` in render                                            | yes                                                                                                       | yes                                                                     | error (was an alpha warning)         |
| `hooks`                          | suspicious                   | hook in a condition                                         | yes                                                                                                       | yes                                                                     | warn (`rules-of-hooks` blocks)       |
| `memo-dependencies`              | suspicious                   | missing `useMemo` dependency                                | yes                                                                                                       | yes                                                                     | warn (`exhaustive-deps` blocks)      |
| `capitalized-calls`              | suspicious                   | call of a capitalized non-component                         | yes                                                                                                       | yes                                                                     | warn                                 |
| `exhaustive-effect-dependencies` | suspicious                   | missing effect dependency                                   | never (behind the flag `eprh_enableExhaustiveEffectDependenciesCompilerLint`, `'off'` in 7.1.1)           | yes                                                                     | warn (native is stricter)            |
| `no-deriving-state-in-effects`   | perf                         | state derived in an effect                                  | no (both report `set-state-in-effect`)                                                                    | no                                                                      | off (as before)                      |
| `todo`                           | restriction                  | `try`/`finally` in a component                              | yes                                                                                                       | yes                                                                     | off (compiler limitation, not a bug) |
| `rule-suppression`               | restriction                  | `eslint-disable` of `react-hooks/exhaustive-deps`           | no                                                                                                        | no                                                                      | off                                  |
| `syntax`, `invariant`            | restriction                  | internal compiler errors                                    | not triggered                                                                                             | `invariant` fires on `CapabilityProbe.tsx` (the build's known bail-out) | off                                  |
| `memoized-effect-dependencies`   | no port                      | non-memoized effect dependency                              | never (the compiler raises its category nowhere in 7.1.1)                                                 | —                                                                       | nothing lost                         |
| `config`, `gating`               | no port                      | —                                                           | validate compiler options given to the ESLint plugin; oxlint gives none, the Vite build validates its own | —                                                                       | nothing lost                         |
| `fbt`                            | no port                      | —                                                           | fbt is not used                                                                                           | —                                                                       | —                                    |

Messages match too (native "Cannot call impure function during render", alpha the same reason with
the compiler's long description). Every rule we ran through the alpha plugin has a native port that
fires on the same code, so the plugin is removed instead of trimmed; ESLint 10 stays installed only
as the peer of `eslint-plugin-lingui`. The probe test writes `apps/web/src/hooks/__probe__.tsx`
(five violating components), asserts a failing lint with `error react(purity)`, `refs`,
`set-state-in-render`, `immutability` and `unsupported-syntax` and no `react-hooks-js` output, and
deletes the file.

### TD-12: Lighthouse CI

- **Runner** `apps/web/scripts/lighthouse.ts` (`pnpm lighthouse`, after `pnpm build`): starts the
  E2E test server in-process with `trustedTypes: false` (exactly the production headers), writes a
  temporary `lighthouserc.json` and runs `lhci collect`, `upload` (filesystem reports in
  `apps/web/.lighthouseci/reports`, gitignored) and `assert`. Mobile preset (Lighthouse's default:
  simulated slow 4G, 4× CPU), 3 runs (`--runs N`), median aggregation. Chrome: `CHROME_PATH` or
  Playwright's Chromium (`chromium.executablePath()`), `--no-sandbox` as Playwright does. The
  `lhci` calls are asynchronous: `spawnSync` blocks the in-process server and deadlocks the run.
- **Budgets (§8.19, relative in CI).** FCP, LCP, Speed Index, TTI (`interactive`) and TBT fail when
  the median is more than 20% above the baseline, with a minimum margin (100 ms; TTI 150 ms) so that
  the ~25 ms of blocking time cannot fail on noise. CLS ≤ 0.1 and accessibility and best-practices
  scores of 100 are warnings (not §8.19 budgets). The device budgets (first content ≤ 1.0 s,
  interactive ≤ 2.0 s, S22, installed, offline) stay a device measurement.
- **Baselines per environment** (`apps/web/lighthouse-baseline.json`: `local`, later `ci`;
  `LIGHTHOUSE_BASELINE=<name>` picks another). Simulated throttling scales the CPU time measured on
  the machine, so a baseline does not transfer between machines. Evidence (2 runs each, CPU slowdown
  4× / 6× / 8×): FCP 901 / 901 / 901 ms, Speed Index 1.63 / 1.58 / 1.49 s, TTI 4.33 / 4.61 / 4.71 s,
  TBT 26 / 111 / 212 ms. Without a baseline for its environment a run reports only, writes
  `.lighthouseci/baseline-candidate.json` and passes (a `::warning::` on GitHub).
  `pnpm lighthouse --update-baseline` stores the medians of the run. Assertion failures were checked
  once with a deliberately tight baseline (FCP and TTI failed, exit code 1).
- **Local result** (the committed `local` baseline: final build, 5 runs, benchmark index 2,708):
  performance, accessibility, best practices and SEO 100 in every run; FCP 901, LCP 901, Speed
  Index 1,678, TTI 4,528, TBT 27 ms; CLS 0; 781 kB over 17 requests. Spread over runs: FCP ±0.1%,
  Speed Index between about 1,570 and 1,680 (two clusters), TTI −4%…0%, TBT 23–33 ms. A 3-run check
  against it passed in 33 s (FCP 901, Speed Index 1,572, TTI 4,533, TBT 32 ms).
  TTI is 4.5 s because the service worker's precache download (about 1 MB) follows the first render
  on a cold, throttled load and Lighthouse waits for network quiet; it is a regression signal, not
  the §8.19 number.
- **Not in `pnpm verify`:** about 33 s for 3 runs, and hardware-dependent (above).
- **CI:** job `lighthouse` in `ci.yml`, `needs: build` (measures the tested `dist` artifact), only
  when `github.event_name != 'pull_request'`; the workflow gained `schedule` (02:30 UTC nightly, so
  the whole pipeline runs nightly) and `workflow_dispatch`; the concurrency group now includes the
  event name, so a nightly run never cancels a push run (and its beta deploy). Reports are uploaded
  as the `lighthouse` artifact (`include-hidden-files`). actionlint 1.7.12 passes. Until a `ci`
  baseline is committed the job only reports; once it is, a regression fails CI on `main` and so
  holds back the beta deploy (deploy after green, §8.21).
- **Licence gate.** The first install failed the gate on two build-only transitive packages:
  `sentry@0.49.0` (`FSL-1.1-Apache-2.0`, source-available; lighthouse → `@sentry/node` 11.13 →
  `@sentry/bundler-plugins`; every `@sentry/node` in Lighthouse's range `^11.8.0` has it) and `argparse@3.0.4` (`PSF-2.0`, not
  on the allowlist; `@lhci/utils` → `js-yaml` 5.5). Neither is ever loaded: Lighthouse imports
  `@sentry/node` only with `--enable-error-reporting`, inside a `try`; js-yaml uses argparse only in
  its own command-line binary. `pnpm-workspace.yaml` `overrides` remove both (`'-'`), with a
  comment. Gate: "33 distributed, 820 build-only; passed". Product-owner alternative: allow
  `PSF-2.0` (permissive, OSI-approved) and drop that override.

### TD-12: Trusted Types in dev and E2E builds

- **Header** (one place: `apps/web/scripts/trusted-types.ts`): `require-trusted-types-for 'script';
  trusted-types powr-sw`. The Vite dev server sends only these directives (the production CSP would
  reject Vite's dev preamble and injected styles); the E2E server appends them to the CSP from
  `deploy/security-headers.conf` (`startStaticServer({ trustedTypes })`, default on). `vite preview`
  and the nginx image are unchanged; Lighthouse measures without them.
- **What broke:** only `navigator.serviceWorker.register('/sw.js')`, a `TrustedScriptURL` sink. A
  search of `src` and `public` found no other sink (`innerHTML`, `new Worker`, `eval`,
  `importScripts`, `document.write` …), and the full E2E suite (React, TanStack Router, Base UI,
  Dexie, Workbox in the service worker, which gets the same CSP) shows no violation.
- **Fix:** `src/infrastructure/security/trusted-types.ts` creates the policy `powr-sw` once; its
  `createScriptURL` returns `/sw.js` and throws for anything else. `registration.ts` passes
  `serviceWorkerScriptUrl()` instead of the string. TypeScript 7.0's DOM types have no Trusted
  Types, so the module types the factory structurally (no `@types/trusted-types`). Entry JS +0.1 kB
  gzip.
- **Evidence:** all 22 existing E2E tests pass under the header (the fixture fails any test with a
  CSP violation). New `e2e/trusted-types.spec.ts` asserts the header, the registered service
  worker, and that `innerHTML` and `script.src` string assignments, an unknown policy and a second
  `powr-sw` policy all throw `TypeError`, with exactly those four violation reports (then cleared
  from the fixture's list); skipped against the nginx image. Negative check: with the plain string
  URL the offline test and this test fail ("Preparing offline use…", a `require-trusted-types-for`
  violation). Dev server: `/`, `/session`, `/settings`, `/data`, `/plan`, `/progress`, `/explore`
  and `/?debug=1` load in Chromium with no CSP violation, error or warning.

### Deviations

| Concept / brief says                                                                          | What I did                                                                                                         |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "CI uses relative thresholds (fail if more than 20% slower than the stored baseline)" (§8.19) | 20% plus a minimum margin per metric (100 ms, TTI 150 ms); one baseline per environment; no baseline → report only |
| Lighthouse in the CI pipeline before deploy (§8.21 diagram)                                   | Job in `ci.yml` after `build`, skipped on pull requests; nightly schedule added to the whole workflow              |
| Licence gate on every build-only package (§8.21)                                              | Two never-loaded transitive packages removed with pnpm `overrides` instead of an exception or an allowlist change  |
| Trusted Types "in development and E2E builds" (§7.3)                                          | Dev server: Trusted Types directives only, not the production CSP; E2E: production CSP plus the directives         |
| `@lingui/vite-plugin` with the Babel macro plugin (§8.15, Appendix B)                         | Native macro transform; `@lingui/babel-plugin-lingui-macro` no longer a direct dependency                          |

### Doc amendments for the docs pass

- **§11.2:** TD-09 closed (native macro transform; evidence above). TD-10 closed (all compiler
  rules native, alpha plugin removed). TD-12: Lighthouse CI and Trusted Types in dev/E2E done; what
  remains is the token contrast gate (M2b; close TD-12 if M2b lands it) and committing the `ci`
  Lighthouse baseline from the first `main` run (artifact `lighthouse`,
  `baseline-candidate.json`). TD-03 unchanged (dev/E2E now enforce, production does not).
- **§7.3** CSP notes: "Trusted Types are enforced in development and E2E builds: header in
  `apps/web/scripts/trusted-types.ts`, one policy `powr-sw` for the service-worker URL
  (`src/infrastructure/security/trusted-types.ts`); production later (TD-03)."
- **§8.5** item 4: replace the v0.3 sentences on native ports and TD-10 with: the React Compiler
  rules run natively in oxlint (13 blocking; `hooks`, `memo-dependencies`,
  `exhaustive-effect-dependencies` and `capitalized-calls` as warnings), parity checked rule by
  rule; `eslint-plugin-react-hooks` is no longer used; OQ-T10 covers only `eslint-plugin-lingui`.
- **§8.15** (Lingui paragraph): macros compile with Lingui's native `macroTransform`
  (`@lingui/native-tools`, SWC); Babel runs only the React Compiler; `lingui()` must precede the
  Babel plugin (both `enforce: 'pre'`).
- **§8.19:** Lighthouse CI as built (runner, mobile preset, relative budgets with minimum margins,
  per-environment baselines, local numbers above, TTI caveat). **§8.20** Performance row:
  "Lighthouse CI 0.16 (from M2)". **§8.21:** M0-state paragraph (Lighthouse CI joined in M2:
  `main`, nightly, manual; component tests still TD-11), the alpha JS plugin bullet (only
  `eslint-plugin-lingui`; ESLint 10 is its peer), licence-gate note on the two `overrides`.
- **Risks:** T-08 (Lingui macro now native; Babel only for the compiler), T-16 (React Compiler lint
  fully native; only Lingui rules are alpha).
- **OQ-T10** entry: note that the alpha scope is `eslint-plugin-lingui` only.
- **Appendix B:** Lint row without `eslint-plugin-react-hooks` 7.1.1; i18n row: native macro
  transform (`@lingui/native-tools` 0.2.0, transitive) instead of
  `@lingui/babel-plugin-lingui-macro`; Budgets row unchanged (`@lhci/cli` 0.16.1, Lighthouse 13.6.0).
- **ADR amendments:** ADR-0016 (native macro transform), ADR-0017 (alpha React plugin removed,
  native compiler rules, ESLint peer only for Lingui), ADR-0010 (E2E server enforces Trusted Types;
  Lighthouse CI with per-environment baselines), ADR-0018 (the two build-only `overrides`),
  ADR-0021 (pnpm `overrides` in `pnpm-workspace.yaml`).

### Open items

- Commit the `ci` baseline after the first `main` run (download the `lighthouse` artifact, copy
  the `ci` entry of `baseline-candidate.json` into `apps/web/lighthouse-baseline.json`).
- Tailwind source exclusion for `scripts/` and `e2e/` (proposal above; `src/ui/app.css` is M2b's).
- Trusted Types in production (TD-03, v1.1): add the two directives to
  `deploy/security-headers.conf` once ECharts' tooltip is confirmed compatible.

## M2c planning gaps

Written 2026-11-24 by the M2c work (roadmap A.4 "M2c Planning gaps", added by the product owner
before M3): ONB-08 baselines, the PLN-02 template override, the PLN-08 block length, TD-36 (the
time-budget step in the next-block proposal), the lint clean-up to zero warnings with warnings
denied, and the rules diff fix from the M2b open items. Status: `pnpm verify` green (numbers under
"Evidence").

### What landed

| Task                 | PRD / TD                | Where                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Baselines         | ONB-08, PRG-05, PRG-08  | Domain `baselineE1rm`, `calibrationFallback` (`packages/domain/src/e1rm/baseline.ts`); use cases `baselineLifts`, `estimateBaseline`, the baseline check in `completeOnboarding` (`packages/application/src/planning/baselines.ts`); step "Your current lifts" (`apps/web/src/features/onboarding/BaselinesStep.tsx`, `baseline-input.ts`), route `/onboarding/baselines` and `/plan/setup/baselines` |
| 2. Template override | PLN-02                  | Use case `templateChoices` (`plan.ts`); `TemplateChooser.tsx` (sheet) in the preview; refused choices show the generator's reason with "Use the recommended plan"; the choice is kept in the draft (`OnboardingAnswers.planOptions`) while the user changes days; a new style drops it                                                                                                                |
| 3. Block length      | PLN-08                  | Domain `defaultAccumulationWeeks` (`generate.ts`), `plan.mesocycle` args `defaultWeeks` and `chosen`; `PlanPreview.blockLength` (range and default); preview control "Training weeks before the lighter week" (3–8) with "Recommended: 5 weeks" and "Why?", and "Your first block" on the calendar (`PlanPreviewView.tsx`)                                                                            |
| 4. Next block        | PLN-13, PLN-14, TD-36   | `NextMesocycleInput.template`; the time step (`fitTime`, `allocateWithRepair`, `prioritiseForBudget`, `annotate`, `budgetNote`, `loweredTargetNote`) moved from `generate.ts` to `planning/budget.ts` and runs in `proposeNextMesocycle`; `validate.strength.belowMinimum` with cause `timeBudget` gets the input fixes; the next-block screen shows the shared `BudgetNote` (`parts.tsx`)            |
| 5. Lint              | NFR-MNT-04, ADR-0016/17 | Zero warnings; `"lint": "oxlint --type-aware --deny-warnings"`; `assertNever` (`apps/web/src/features/exhaustive.ts`); Lingui messages for the source names and the page title; two narrow `ignore` patterns; OQ-T10 probe asserts the flag                                                                                                                                                           |
| 6. Rules diff        | §8.6.5 check 6          | `parsePreviousRules` in `packages/rules/scripts/build.ts`: the diff reads an older `rules.json` without today's parameter set or value schemas, and reads it before the build overwrites `generated/rules.json`; missing parameters are listed as added                                                                                                                                               |
| Tests                |                         | `packages/domain/test/reference/baseline.test.ts`, `test/planning/budget.test.ts` (TD-36 reference tests), `packages/application/test/m2c.test.ts`, `plan-properties.test.ts` (next-block properties), `plan-matrix.test.ts` (next-block guarantees and summary), `packages/rules/scripts/build.test.ts`, `apps/web/test/m2c.test.tsx`, `pseudo-locale.test.tsx`, `apps/web/e2e/m2c.spec.ts`          |

**Task 1 in detail.** The step sits between "Priorities" and "Your plan" and is the second
optional step: "Skip this step" moves on in one tap (NFR-USE-02; the step counter grows by one).
It asks for the plan's main lifts (`baselineLifts`): the compound exercises of the primary slots of
the plan the answers give, competition lifts first (squat, bench press, deadlift), one per movement
pattern, at most four, loaded with a bar, dumbbells or a machine. Powerlifting with a commercial
gym: barbell back squat, bench press, deadlift; a 3-day bodybuilder: back squat, dumbbell bench
press, seated cable row, Romanian deadlift. Lifts already started stay listed. Per lift: "Not now",
"A recent set" (weight, reps, reps left in the tank 0–4 or "Not sure") or "My 1-rep max" (weight,
optional date). Each complete entry shows "Estimated 1-rep max: …" from the engine with "Why?"; a
1RM more than 90 days old shows "You lifted this max a while ago. POWR starts from it and refines
it automatically from the sets you log." (PRD ONB-08). The step's own "Why?" explains the
calibration fallback (`e1rm.baseline.none`: first 1–2 exposures at RIR 3–4, a load the user picks;
`progression.calibration`). An entry the engine cannot use (effective reps above 15) shows the
engine's reason instead of an estimate and is still stored as given.

**Where the result is stored (for M3).** The entries are raw user data in `Profile.baselines`
(`Baseline { exerciseId, kind, load, reps, rir, date? }`; a 1RM is stored with reps 1 and RIR 0),
written by `completeOnboarding` in its one transaction, validated there (`invalidBaselines`: load

> 0 and ≤ 2,000 kg, whole reps 1–100, RIR 0–10 in half steps or null, at most 20, one per
> exercise) and covered by the strict version-2 profile record and the backups. The starting e1RM is
> **derived**, not stored, as the concept's core rule asks (§4: everything but the raw logs is a
> function of them and the versions): M3's session engine calls `baselineE1rm(baseline,
> exercise.load, today, rules)` (`@powr/domain/e1rm`) for an exercise that has a baseline and no
> logged sets, and seeds `dExerciseState` with the result (`e1rmKg`, its `weight` and
> `effortLogSd`); a later equation setting or registry change recomputes it. The first-session load
> is then PRG-05's `loadForTarget`. No schema or Dexie change was needed: `Profile.baselines` and its
> record schema existed since M2a. The onboarding draft (meta, JSON) also keeps the step's inputs as
> typed (`Draft.baselineInputs`, web only) and the preview's plan choices (`planOptions`), so a
> resumed onboarding shows them again; `completeOnboarding` deletes the draft.

**Task 3: the default and its why.** `defaultAccumulationWeeks` is the user's own
`deload.planned.everyWeeks` (a settings override), else the template's accumulation weeks: 5 in
every MVP template, the registry's evidence default `deload.planned.everyWeeks` = 5 ([DELPHI/SURVEY,
INF], Rogerson 2024: athletes deload every 5.6 ± 2.3 weeks; Bell 2023: deloads in each mesocycle,
frequency by response; EB §Defaults › Deloads "every 4–6 weeks, user-selectable 3–8"). The range is
`planning.mesocycle.accumulationWeeks` (3–8, PRD PLN-08). The block's "Why?" (`plan.mesocycle`) now
says "This is the plan's default, in line with how often strength athletes and coaches report
taking a lighter week" or "You chose this length; the plan's default is 5 weeks", with the
parameters and their sources. Picking the default again removes the choice. The E2E test picks 7
weeks: the first block lists weeks 1–8 with week 8 as the lighter week, and the accepted plan has
seven training weeks and the deload (application test).

**Task 2: what "override" can mean today.** Every MVP style × days cell has exactly one template
(15 templates, 15 cells), so another plan always needs other training days (`plan.template.none`,
reason `mismatch`) or another level (`plan.template.levelMismatch`). The chooser therefore lists
all plans of the style, recommended first, with "Recommended for your N training days and your
level.", "Needs N training days a week." or "Made for other levels (…).", computed with the
generator's own `selectTemplate`. A refused choice shows the generator's text; "Change days" keeps
the choice, so with matching days the plan is generated with `plan.template.chosen` ("You chose
Upper/lower ×2 …"). Missing equipment (`plan.lift.unavailable`, substitutions, dropped slots) and
the time budget (the time-budget note and issues) show in the regenerated preview, as for the
default plan.

### Evidence for the new parameter (rules 1.2.0 → 1.3.0: 127 → 128 parameters, 31 `verified: false`)

| Parameter                       | Value | Evidence and sources | Verified | Why                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load.baseline.refineAfterDays` | 90    | [INF] `src.powr-prd` | true     | PRD ONB-08: "Entering a 1RM older than 3 months shows a hint that it will be refined automatically." The PRD's own number (about 3 months), so `verified: true` as M2a did for PRD numbers. The e1RM is not discounted: time off has the ONB-04 return ramp (PRG-13) |

Stamp `1.3.0+b74ec9402fc3`. `pnpm --filter @powr/rules build -- --diff <1.2.0 rules.json>` prints
"- Added load.baseline.refineAfterDays: `90` [INF]". Content unchanged (0.2.0).

**The baseline estimate uses only existing engine rules:** effective reps = reps + RIR (+ the RIR
bias for RIR ≥ 3, `load.rirBias`), the user's equation (Wathan default, `load.e1rm.equation`,
EB §Defaults › Load), unknown RIR → the prior 2 at weight × 0.5 (`load.unknownEffort.*`, EB
"Unknown RIR → assume 2–3 or mark non-informative"), exclusion above 15 effective reps
(`load.e1rm.weightByReff`, EB set weighting). Reference values: 100 kg × 4 at RIR 2 → r_eff 6 →
Wathan 83.1% → 120.3 kg (EB worked example; RTS 83.7%); 120.9 kg × 5 at RIR 2 → e1RM 150 kg, and
PRG-05 gives back 120.9 kg for 5 at RPE 8 (PRD PRG-05 example); 102.5 kg × 5 with unknown RIR →
127.1 kg. Two UI limits are not training logic and stay constants: at most 4 lifts in the step
(`MAX_BASELINE_LIFTS`, a short optional step) and at most 30 reps typed (`MAX_BASELINE_REPS`; the
engine decides what it can use).

### TD-36: plan-matrix snapshot diff

The plan-matrix test (`packages/application/test/plan-matrix.test.ts`) now also proposes the next
block for every generated plan (mesocycle 0 as accepted, no logged sets, seed + 1, as the use case
does) and asserts the same guarantees: no avoidable violation, only available exercises, every day
over budget + 10% flagged. The snapshot gained a second entry, "matches the reviewed next-block
summary" (124 lines, the 60-minute next blocks: exercises, sets, violations with cause, and the
lowered targets as `muscle:full→sets`). The first-plan entry is **unchanged** (the move of the time
step to `budget.ts` is behaviour-neutral, and the strength input fixes do not show in the
summary).

The next-block entry against the same next blocks computed before TD-36 (recorded from the old
code, then the change):

- **60 minutes (the snapshot):** 85 of 124 lines changed; exercise counts −1 in 6 lines, equal in
  79; total sets −1 in 4, equal in 56, +1 in 16, +2 in 8, +4 in 1; violations in the changed lines
  581 → 460; 83 next blocks carry lowered targets (227 targets). Example `bb-full-body-2day |
  commercial-gym | intermediate`: 12 violations → 9, 36 → 38 sets; elbow flexors 15 → 5, side
  delts 15 → 4, triceps 15 → 4.5 lowered; abs and calves rise from below the floor to "low", the
  same pattern as the first plan (9 violations, 38 sets).
- **Every budget** (a scratch run over all 1,620 combinations, not committed): 744 next blocks,
  352 changed (30 min 96, 45 min 101, 60 min 85, 75 min 44, 90 min 26, 90+ none). 344 next blocks
  now carry lowered targets (1,109 targets; the first plans: 346 and 1,124); most often 15 → 4,
  then 15 → 5, 15 → 8, 15 → 9. Before TD-36, **34 next blocks had an avoidable violation**
  (`time.overBudget` at 30 min in 28 and at 45 min in 6: a rotated exercise with longer rest or
  more warm-up pushed a day over the budget, and the next block had no time fit); now none. 76
  next blocks have 1–3 exercises fewer (the time fit or the local repair leaves out an optional or
  secondary accessory, with a `plan.time.trimmed` note). No powerlifting next block lowers a
  target. The 30 `strength.belowMinimum[timeBudget]` issues are unchanged in number and now carry
  the input fixes (e.g. "Allow 45 min" and "Add a training day" for the 30-minute PL 3-day plan,
  and 45 minutes does give the deadlift its minimum dose).

Reference tests (`packages/domain/test/planning/budget.test.ts`): at 45 minutes the next block
keeps the priority muscle at its full target (18) and lowers the others towards the minimum dose
(chest 6, elbow flexors 10, glutes 11, lats 6, mid-back 6, quads 9.5) with the budget note
(`emphasis: priorities`, 90 minutes would fit) and `report.ok`; without priorities the template
emphasis stays full and the same muscles as in the first plan are lowered; without a budget
nothing changes; the strength minimum-dose issue gets `[sessionMinutes 45, addDay]`. Property tests
(`plan-properties.test.ts`, also run once with 1,500 runs each): the next block is deterministic,
lowers targets only with a budget, never below the minimum dose, never for priority or
maintenance muscles, has a budget note exactly when it lowers, offers a longer session (or "90+")
and another day for every time-budget issue (now including the strength dose), never drops a
locked slot, never proposes an unavailable or avoided exercise and has no avoidable violation.

### Task 5: lint clean-up

44 warnings before (`pnpm lint` on the baseline): 26 `lingui(no-unlocalized-strings)`, 16
`typescript(consistent-return)` and 2 `unicorn(consistent-function-scoping)`. Now 0, and `pnpm lint` is `oxlint --type-aware --deny-warnings`, so CI's
quality job and `pnpm verify` fail on any warning. No rule was turned off or downgraded.

- **UI text:** the source names of the Why sheet ("PubMed {pmid}", "POWR {topic}") moved into a
  hook `useSourceName()` with Lingui messages; the page title is the message `{title} · POWR`
  (translated, because screen readers announce it and the order is a translator's choice).
- **Not UI text, restructured:** the imperial-region codes became a regex literal.
- **Not UI text, ignored narrowly** (the rule's `ignore` list in `oxlint.config.ts`): route patterns
  with TanStack `$params` (`$` added to the existing identifier pattern) and single camelCase tokens
  (`^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$`: union members and `kind` discriminants such as
  `'setWeekday'`, `'doToday'`). English text starts with a capital or contains a space, so it never
  matches; the plugin's type-aware `useTsTypes` would cover these, but oxlint gives JS plugins no
  type information. The file-wide disable comment in `why/args.ts` became unnecessary and is gone.
- **`consistent-return`:** every exhaustive switch ends with `default: return assertNever(value)`
  (`labels.ts`, `plan/format.ts`, `parts.tsx`, `WhySheet.tsx`, `OnboardingFlow.tsx`); effects that
  return a cleanup on one path return `undefined` explicitly on the other. `targetSource` gained an
  explicit `case 'timeBudget'` (it fell through `default` before).
- **`consistent-function-scoping`:** `WhySheet`'s `label` and `m2b.test.ts`'s `withPlan` moved out.
- **Gate check:** the OQ-T10 probe test (`tools/arch-test`) asserts that the `lint` script keeps
  `--deny-warnings` and that the Lingui warning fails under it.

### Decisions and deviations

| Brief / concept says                                                         | What I did                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Store the result where M3's session screen will read it"                    | The raw entries in `Profile.baselines`; the starting e1RM is derived with `baselineE1rm` when M3 needs it (§4: derived data is a function of raw data and versions), not stored next to the entry                                                                                                                          |
| ONB-08 "the main lifts of the chosen style"                                  | The plan's primary compound lifts, competition lifts first, one per movement pattern, at most four (so a bodybuilder is asked about the lifts the plan prescribes, not about a barbell bench press the plan does not use). Proposed PRD wording below                                                                      |
| PLN-02 "pick a different template than the default for their style and days" | With one MVP template per cell, the chooser lists every plan of the style with the generator's verdict; another plan always needs other days or another level, and the preview explains a refusal in the existing words. Choosing another style's plan is not offered (the generator refuses it; "Change goal" is the way) |
| TD-36 "run the same step"                                                    | The next block runs the first plan's whole time step: the time fit (a rotated exercise can push a day over the budget; 34 next blocks had an avoidable over-budget violation before), the local repair and the tiers. Locked slots are never dropped or cut. The rotations list leaves out slots the time fit dropped      |
| The time-budget fixes in the next block                                      | The next-block screen shows the note and the fixes as text ("Possible fix: …" in the checks); applying "Allow N min" or "Add a training day" is a re-plan (`/plan/setup`), because the next block keeps the plan's schedule                                                                                                |
| Block length "in plan setup or the plan preview"                             | In the preview (the onboarding and re-planning flows share it), next to the template; the first block shows on the calendar as a list of weeks with their start dates                                                                                                                                                      |
| The baselines step's inputs                                                  | Kept as typed text in the draft (`baselineInputs`), so "102." keeps its point while typing and an unfinished entry is pointed out on Continue (summary and field, WCAG 3.3.1) rather than dropped; "Skip this step" keeps complete entries, as for the priorities step                                                     |
| The lift list reloads when the first entry adds its lift to the kept list    | The step keeps showing the previous list while a new one loads, so the cards and the focus in them never vanish                                                                                                                                                                                                            |
| Rules diff "lists it as added"                                               | Also reads the older file before the build rewrites `generated/rules.json`, so `--diff packages/rules/generated/rules.json` diffs against the committed file instead of itself                                                                                                                                             |

### Evidence

`pnpm verify` green on 2026-11-24: lint (0 errors, 0 warnings, `--deny-warnings`), format, token
gate (unchanged: lowest text 4.56, on fills 5.41, UI 3.88, heat map 3.13), knip, catalog check (832
messages), typecheck, 649 tests in 61 files (631 unit, property, reference, migration and
architecture tests in 56 files plus 18 component tests in 5 files; baseline 617), build, licence
gate (33 distributed, 841 build-only, passed), size (entry JS **178.08 kB** gzip of 186 kB, was
178.42; CSS 5.82 kB; service worker 7.69 kB; precache 79 files + sw.js, 471.1 kB; startup path 5
scripts, 0 with Zod) and 39 E2E tests (34 before), 5 of them new in `e2e/m2c.spec.ts` (baselines entered, kept and shown again when re-planning; the step skipped in
one tap with the calibration "Why?"; a template override refused with the generator's reason and
then planned with four days at 45 minutes, with the time-budget note; a block-length change from 5
to 7 weeks on the calendar; the next block at 45 minutes with the time-budget note). axe (WCAG 2.2
A/AA) finds no serious or critical issue in light and dark on the baselines step (empty and
filled), the template sheet, the refused choice, the chosen plan, the block length and the next
block; reflow at 320 px and 200% text on the filled baselines step and the preview with the block
control; the +30% expansion test covers the baselines step and the preview's new controls.
Screenshots at 360 × 780, light and dark, were handed to the coordinator outside the repository.

### Open items

- **For M3:** seed `dExerciseState` from `Profile.baselines` with `baselineE1rm` for exercises
  without logged sets (and show the PRD ONB-08 hint again on the first exposure of an old 1RM);
  a baseline of one exercise is not transferred to its variants yet (e.g. a back-squat 1RM to a
  paused squat); the session's calibration (PRG-08) is what runs without a baseline.
- **Product owner:** (1) whether a bodybuilder's "main lifts" should be the plan's primary
  compound lifts (as built) or only the competition lifts; (2) whether the next block may leave out
  optional accessories to fit the budget (as built, like the first plan) or should keep the
  exercise list and only flag; (3) whether PLN-02 should get real alternatives per cell (the PRD
  table names "Full body ×5" for bodybuilding at 5 days), so that an override is possible without
  changing days; (4) `load.baseline.refineAfterDays` 90 days as "older than 3 months".
  **Answered 2026-11-24:** (1) the plan's primary compound lifts, as built; (2) yes, as built;
  (3) later content pass (TD-37); (4) 90 days stays. PRD v0.5 carries the ONB-08 and PLN-02
  wording.
- **Found on the way, fixed by the coordinator before the merge:** the body step's decimal fields
  (height, body weight) stored the parsed number on every keystroke, so the typed point was lost:
  typing "80.5" in "Body weight" gave **805**. Both now use `DecimalField` (`ui/field.tsx`), which
  shows the text as typed while it still means the current value ("80.", "80,5") and the value
  itself when it changes from outside. Component tests type "180.5" and "80,5" and check the
  fields and the saved draft. The equipment editor's `type="number"` fields were not affected; a
  component test now types a 2.5 collar weight to keep it that way.
- Manual TalkBack pass (S22): the baselines step's regions and toggle groups, the template sheet's
  radio cards with long descriptions, and the native date input.

## M3a session core

Written 2026-11-24 by the M3a work (roadmap A.4 "M3 Workout session", the part without UI:
the session core below the screens; M3t built the timers, alerts, wake lock and audio in
parallel, M3b wires both into the screens). Status: `pnpm verify` green (numbers under
"Evidence").

### What landed

| Area                  | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | PRD (logic side)                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Session model         | `packages/domain/src/model/session.ts`: `Session` (origin, planned-session link, exercise slots, superset groups, cursor, timer, note, readiness, accepted changes, revision, undo), `SessionExercise` (planned vs actual: plan slot, substitution, prescription, planned sets, rest, load percentage, note, skipped, per side), `PlannedSet`, `LoggedSet` (slot and planned-set keys, technique, per-side reps, duration, flags, rest before, prescription snapshot, note, "5+" effort), `TimerState`, `ReadinessEntry`, `SessionChange`, `UndoEntry`, `SESSION_DEFAULTS` | WKT-02…05, 09…12, TMR-04/08/09, RDY-01               |
| Reducer               | `@powr/domain/session` (new subpath, pure): `reduceSession(state, event, ctx) → { state, effects, result }`, `startSession(input, ctx)`                                                                                                                                                                                                                                                                                                                                                                                                                                    | §8.5, WKT-01…16, TMR-01…13                           |
| Engine in the session | `session/suggest.ts` (set suggestions with "Why?"), `history.ts` (derived exercise state, trend steps, calibration state machine, baseline seeding), `prs.ts`, `readiness.ts`, `guardrails.ts`, `build.ts` (planned sets, warm-ups, freestyle and repeat), `past.ts` (backdated sessions and edits), `view.ts` (session view, summary, remaining time), `timers.ts`, `values.ts` (WKT-03 checks)                                                                                                                                                                           | PRG-03…08, 11…13, WKT-06/07/13/16, MOT-01, RDY-02/03 |
| Trend                 | `trendStep` in `@powr/domain/trend` (one filter step; `runTrend` now loops over it, golden tests unchanged)                                                                                                                                                                                                                                                                                                                                                                                                                                                                | PRG-02                                               |
| Rules                 | registry 1.3.0 → **1.4.0** (`1.4.0+d3aff3c74c11`), 128 → 133 parameters, 31 → 34 `verified: false`; 16 new `RuleId`s with English `why.*` messages                                                                                                                                                                                                                                                                                                                                                                                                                         | PRG-18, PRG-09                                       |
| Records               | `packages/formats/src/records/v2.ts` amended (unreleased version 2): session, set, readiness and settings `session` schemas; `withSessionDefaults` and the 1 → 2 migration; reference checks; v2 fixture `fixtures/backups/v2/m3-active-session.zip`                                                                                                                                                                                                                                                                                                                       | DAT-05…07, NFR-SEC-02                                |
| Application           | `@powr/application/session` (new lazy entry): the use cases below; ports for the readiness and derived tables, more set/session/bodyweight queries, two live queries; M0 `logSet`/`finishSession` write M3-shaped sessions                                                                                                                                                                                                                                                                                                                                                 | §5.5, §6.2, §6.9                                     |
| Persistence           | `apps/web/src/infrastructure/db`: Dexie version 2 amended (`sessions.plannedSessionId`, tables `readiness`, `dExerciseState`, `dSessionE1rm`, `dPrs`), repositories, live queries `activeSessionData` and `sessionPrs`                                                                                                                                                                                                                                                                                                                                                     | §8.2.2, §8.2.4, §8.2.8                               |
| Lint                  | `LAZY_SESSION` in `oxlint.config.ts`: `@powr/application/session` is import()-only in the app (M3b's loader carries the one disable comment, like `usePlanning`)                                                                                                                                                                                                                                                                                                                                                                                                           | §8.19                                                |
| "Why?" texts          | `apps/web/src/features/why/{messages,args}.ts` and both catalogs: messages for the 16 new rules (needed to keep the PRG-09 coverage test and the `WHY_MESSAGES` type complete; no screen change)                                                                                                                                                                                                                                                                                                                                                                           | PRG-09                                               |

PRD IDs covered on the logic side: WKT-01…16 (WKT-07 through the existing loading service),
TMR-01…03, 07, 08, 09, 11, 13 (the data and the state; display, alerts, sound and wake lock are
M3t), TMR-10 (tempo parsing for the rep-speed guardrail; the metronome is M3t/M3b), PRG-03…08,
PRG-11…13 as they apply in a session, RDY-01…03, MOT-01 (detection; the celebration UI is M3b).

### Application API for M3b (`@powr/application/session`, lazy)

All take the container's `deps`; expected failures are `Result`s. Every outcome carries the
domain `SessionView` (every planned set with its logged record or its suggestion and "Why?",
the last-time panel with its note, calibration status, e1RM, timer with a computed view,
clock and remaining time, PRs so far, volume per muscle, stale flag, live undo token) and the
platform effects to run.

| Use case                                                                                                                                                               | Returns                                                                                                              | Notes                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startWorkout(deps, { source, warmups? })`, `source`: `{ kind: 'planned', plannedSessionId }`, `{ kind: 'freestyle', exerciseIds }` or `{ kind: 'repeat', sessionId }` | `Result<WorkoutOutcome, StartWorkoutError>` (`activeSession` with its ID, `unknownPlannedSession`, `unknownSession`) | WKT-01: one active session, checked inside the write transaction; warm-up ramps where a working load is known; `result.readiness.proposals` holds the per-lift return-from-break proposals (PRG-13) |
| `dispatch(deps, event)`                                                                                                                                                | `Result<WorkoutOutcome, WorkoutError>` (`noActiveSession`, `rejected` with the reducer's reason)                     | Any `SessionEvent` (table below), one strict transaction                                                                                                                                            |
| `resumeWorkout(deps)`                                                                                                                                                  | as `dispatch`                                                                                                        | WKT-14: `RESUME`; re-arms the stored timer, `result.stale` after 6 h ("Finish session at last logged set?" → `finishWorkout({ as, endAt: 'lastSet' })`), the still-valid undo token                 |
| `finishWorkout(deps, { as: 'finished' or 'partial', endAt?: 'now' or 'lastSet' })`                                                                                     | as `dispatch`, plus `summary` (WKT-13) and `lowReadinessDays`                                                        | Marks the planned session done, rebuilds the exercises' derived data; pass `lowReadinessDays` to the planning entry's `checkReactiveDeload` (PRG-12)                                                |
| `discardWorkout(deps)`                                                                                                                                                 | as `dispatch`                                                                                                        | WKT-13 (the UI confirms first)                                                                                                                                                                      |
| `observeActiveSession(deps)`                                                                                                                                           | `Observable<SessionView or null>`                                                                                    | The live session screen (one Dexie live query, ordered emissions)                                                                                                                                   |
| `substitutionOptions(deps, slotKey)`                                                                                                                                   | ranked `SlotCandidate[]`                                                                                             | WKT-08: same pattern first, then exercises training a primary muscle directly; equipment-valid, not avoided, MAP-03 ranking                                                                         |
| `rememberRest(deps, { exerciseId, seconds })`                                                                                                                          | `Result<void, …>`                                                                                                    | TMR-03 "remember for this exercise": a per-exercise rest override in settings, applied to the active session's slots                                                                                |
| `updateSessionPreferences(deps, patch)`                                                                                                                                | void                                                                                                                 | Settings `session` (below)                                                                                                                                                                          |
| `workoutSummary(deps, sessionId)`                                                                                                                                      | `SessionSummary or null`                                                                                             | The summary of any session against the history before it                                                                                                                                            |
| `logPastSession(deps, { localDate, startTime?, exercises, note? })`                                                                                                    | `Result<SessionState, PastSessionError>`                                                                             | WKT-15 backdated logging; recomputes the touched exercises                                                                                                                                          |
| `previewPastEdit(deps, { sessionId, edits })`                                                                                                                          | `{ removed, added }` PRs                                                                                             | WKT-15 "this will remove a PR", before anything is written                                                                                                                                          |
| `editPastSession(deps, { sessionId, edits })`, `deletePastSession(deps, sessionId)`                                                                                    | `Result<…>`                                                                                                          | Edits: `editSet`, `deleteSet`, `addSet`, `deleteExercise`, `note`; delete unlinks the check-in and puts a done planned session back to planned                                                      |
| `ensureDerived`, `rebuildExercises`                                                                                                                                    |                                                                                                                      | Rebuild stale or missing derived data (used by the above; "Verify data" can call them)                                                                                                              |
| `preferencesOf(settings)`                                                                                                                                              | `SessionPreferences`                                                                                                 | The settings record's `session` with defaults                                                                                                                                                       |

**Events** (`SessionEvent`, `@powr/domain/session`). "Undo" = records an undo entry (WKT-12);
"keep" = leaves the pending undo in place.

| Event                                                                                                                                                              | What it does                                                                                                                                                                                                                                                    | Undo                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `CONFIRM_SET { slotKey, setKey, values, confirmImplausible? }`                                                                                                     | Logs a planned set (load, reps, RIR or none, "5+", per-side reps, duration, technique, flags, note, type); records the suggestion it replaced (PRG-03), the actual rest (TMR-08); starts the rest, warm-up or superset-transition timer (TMR-01/13); PRs, hints | undo                                        |
| `EDIT_SET`, `SKIP_SET`, `DELETE_SET`                                                                                                                               | Edit a logged set; log a planned set as skipped (WKT-09: never deleted); delete a logged record                                                                                                                                                                 | undo                                        |
| `ADD_SET`, `REMOVE_SET`, `SKIP_EXERCISE`, `ADD_EXERCISE`, `REMOVE_EXERCISE`, `REORDER`, `CHANGE_PRESCRIPTION`                                                      | On-the-fly changes (WKT-09): sets, exercises (defaults by goal and level), order, reps/RIR/load/duration/technique/set count/rest, manual mode                                                                                                                  | undo                                        |
| `SUBSTITUTE { slotKey, exerciseId, scope }`                                                                                                                        | WKT-08; `mesocycle` also updates the rest of the mesocycle (effect `plan.substitute`)                                                                                                                                                                           | undo (session scope); clears it (mesocycle) |
| `GROUP`, `UNGROUP`                                                                                                                                                 | Supersets and circuits (WKT-05)                                                                                                                                                                                                                                 | undo                                        |
| `GENERATE_WARMUPS { slotKey, includeOptional? }`                                                                                                                   | WKT-06 ramp from the slot's suggested working load                                                                                                                                                                                                              | undo                                        |
| `APPLY_CHANGES { changes }`                                                                                                                                        | Accepted readiness and return-from-break proposals (RDY-03, PRG-13)                                                                                                                                                                                             | undo                                        |
| `SET_NOTE`, `SET_PER_SIDE`, `MOVE_CURSOR`, `SET_REST`, `READINESS { items or null, soreMuscles? }`                                                                 | Notes (WKT-10), per-side logging (WKT-11), the set in focus, slot rest, the check-in (RDY-01; null = skipped) with its assessment and proposals                                                                                                                 | keep                                        |
| `TIMER_START { kind: 'rest' or 'set', mode?, targetMs?, slotKey? }`, `TIMER_STOP` (returns `elapsedMs`), `TIMER_ADJUST { deltaMs }`, `TIMER_SKIP`, `TIMER_RESTART` | TMR-03/07/09                                                                                                                                                                                                                                                    | keep                                        |
| `TIMER_FIRED { timerId, which: 'preAlert' or 'end' }`                                                                                                              | Sets `fired.preAlert`/`fired.end` so a reload does not alert again (M3t's `pre-alert` and `end` events)                                                                                                                                                         | keep                                        |
| `UNDO { token }`                                                                                                                                                   | Restores the session and the set records as before the last undoable event, timer included; PRs follow (computed from the sets); token valid 30 s (`UNDO_TTL_MS`)                                                                                               | clears                                      |
| `FINISH { as, endAt? }`, `DISCARD`                                                                                                                                 | WKT-13/14                                                                                                                                                                                                                                                       | clears                                      |
| `RESUME`                                                                                                                                                           | WKT-14 recovery; changes nothing, returns the effects to re-arm                                                                                                                                                                                                 | keep                                        |

**Effects** (`SessionEffect`). The application runs the first five; `WorkoutOutcome.effects`
(`PlatformEffect`) holds the rest for the app's effect runner (M3t/M3b).

| Effect                                                          | Runs it                                                                           | When                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `persist { session, putSets, deleteSetIds, readiness? }`        | application, in the event's strict transaction                                    | Every accepted event that changes state                                                         |
| `activeSession { sessionId or null }`                           | application, after the commit (`RuntimeFlags`, the service worker's update gate)  | Start, resume (re-asserted), finish, discard                                                    |
| `plan.substitute { plannedSessionId, planSlotKey, exerciseId }` | application, same transaction                                                     | `SUBSTITUTE` with scope `mesocycle`                                                             |
| `plan.complete { plannedSessionId }`                            | application, same transaction                                                     | `FINISH` of a planned session                                                                   |
| `recompute { exerciseIds, fromDate }`                           | application, after the commit (rebuilds `dExerciseState`, `dSessionE1rm`, `dPrs`) | `FINISH`                                                                                        |
| `timer.arm { timer }`                                           | app (M3t `restAlerts.arm(timer, …)`)                                              | A new timer, or a changed schedule (start, adjust, restart, undo, resume)                       |
| `timer.disarm { timerId }`                                      | app (M3t `disarm(id)`)                                                            | The timer was replaced, skipped, stopped, or the session ended                                  |
| `wakeLock { action }`                                           | app                                                                               | `acquire` on start and resume, `release` on finish and discard (PWA-06)                         |
| `celebrate { prs }`                                             | app (M3b)                                                                         | A confirmed or edited set set PRs (MOT-02: one celebration per set)                             |
| `cue { 'setConfirmed' or 'setSkipped' or 'undone' }`            | app (haptic tick)                                                                 | Confirm, skip, undo                                                                             |
| `announce { announcement }`                                     | app (live region)                                                                 | `setLogged`, `setSkipped`, `restStarted`, `transition`, `exerciseDone`, `sessionDone`, `undone` |

**Result** (`SessionResult`): `rejected`, `undoToken`, `setId`, `prs`, `next` (the cursor's
suggestion with "Why?"), `hints` (WKT-16), `timer`, and per event `elapsedMs` (TIMER_STOP),
`stale` (RESUME), `readiness` (READINESS and start: assessment and proposals); the outcome adds
`swapWith` (a lighter later session of the week to swap with on low readiness, RDY-03; M3b calls
the planning entry's `swapSessions`).

**Settings** (one optional field, separate from M3t's `alerts`): `settings.session` =
`{ restAutoStart?, restMode?: 'countdown' or 'countup', readinessCheckIn?, hintsOff?: GuardrailKind[],
rounding?: RoundingMode, exercises?: { exerciseId, manual?, restAutoStart?, perSide? }[] }`
(TMR-01, TMR-07, RDY-01, WKT-16, SET-05, PRG-03 manual mode, WKT-11). Per-exercise rest is a
parameter override with `exerciseId` (`rememberRest`).

### TimerState as built

```ts
interface TimerState {
  readonly id: string;
  readonly kind: 'rest' | 'set' | 'transition';
  readonly mode: 'countdown' | 'countup';
  readonly startedAtEpochMs: number;
  readonly targetMs: number;
  readonly adjustMs: number;
  readonly fired: { readonly preAlert?: boolean; readonly end?: boolean };
  readonly softMinMs?: number; // optional (M3a): count-up soft minimum, the gentle cue (TMR-07)
  readonly slotKey?: string; // optional (M3a): the slot it belongs to (alert and display text)
}
```

Exported from the `@powr/domain` root (`model/session.ts`). Warm-up rests are kind `rest`
(the concept's `warmupRest` kind is not used). `targetMs + adjustMs` never goes below 0
(`adjustTimer`); `timerView(timer, nowMs)` clamps elapsed, remaining and over at 0 (property
test across clock jumps). The session clock (TMR-11) is `sessionElapsedMs(session, now)`.

### The engine in the session

- **Suggestion order** (`suggestSet`): fixed values (warm-up steps, timed sets, a fixed or
  user-set load) → in the session after a working set of the slot: back-offs from the top set's
  e1RM (PRG-05), the next set from the last set's e1RM when its RIR left the target range (RPE
  mode) or during calibration, else the last set's load → from the history: manual mode or
  load-less work from the last performance (reps up for pure bodyweight, A-19), double
  progression (PRG-04) and linear with the stall rule (PRG-06; intermediates once a week) from
  the last exposure, calibration while no reliable e1RM exists (PRG-08), else load for target
  from the current e1RM (PRG-05; percent prescriptions as a percentage of it) → deload and
  return-from-break loads at the middle of the slot's percentage of the normal load
  (PRG-11/13). Every load goes through `roundToAchievable` with the user's equipment and
  rounding mode (WKT-07). Pre-filled reps are the middle of the range, RIR the middle in half
  steps.
- **Calibration state machine** (PRG-08, TD-27): `uncalibrated` (no e1RM) → `calibrating`
  → `calibrated`. A baseline (ONB-08) calibrates at once; one exposure with entered effort does
  when one of its sets reaches `progression.calibration.reliableSetWeight` (0.5: RPE ≥ 7 and
  ≤ 12 effective reps), otherwise the second does (`exposures.max`); without entered effort two
  exposures with an e1RM do. While calibrating, targets are RIR 3–4, the first set has no load
  (the user picks; "about 12 times"), and the next sets load from the first one's e1RM. For
  double progression and linear progression the first exposure is the calibration: from the
  second on they run from the last performance.
- **Baselines** (M2c open item): `seedFromBaseline` makes the baseline's e1RM the first trend
  observation (its own weight and noise, dated when lifted, else at onboarding), so logged
  sessions refine it; a changed baseline, equation or override changes the state's key and
  rebuilds it. Baselines still do not transfer to variants.
- **PRs** (MOT-01): rep PR = more than the n-rep max (the heaviest load of any set with ≥ n
  reps, so a heavier set with more reps also sets the lower rep maxes); load PR; e1RM PR only
  from sets with entered effort whose base weight reaches `load.pr.minSetWeight` (0.5); volume
  PR once per session, on the crossing set, valued at the session's final volume load; the first
  exposure is a milestone without PRs; warm-ups, timed, assisted and band sets never count. In
  the session PRs are computed from each exercise's bests and this session's sets, so undo and
  edits move them; `dPrs` stores them for finished sessions.
- **Readiness** (RDY-02/03): z-scores per item against the 28-day baseline (≥ 7 entries),
  soreness and stress inverted, composite = mean; `low` ≤ −1.0, `modify` ≤ −1.5 or PRS ≤ 3 on two
  days in a row; proposals: +1 RIR on top sets (or the working sets of RPE compound slots), drop
  1 back-off set (2 when "modify"), after < 6 h sleep before a PM session trim one working set
  per exercise, after ≥ 2 short nights +1 RIR on compounds; a lighter later day of the week is
  offered as `swapWith`. Nothing applies without `APPLY_CHANGES`.
- **Return from break per lift** (PRG-13, WKT-01): exercises last trained more than 7 days ago
  get the first step of their row as a proposal at start (not when the planned session already
  carries a deload or break adjustment).
- **Guardrails** (WKT-16): session fractional sets above the per-session soft cap (once per
  muscle), RIR 0 or a failure flag on a barbell squat or hinge or a heavy barbell press (≤ 6
  reps), rest below 2:00 between sets of a competition lift, reps slower than 8 s (measured, or
  from the exercise tempo). Each can be turned off (`hintsOff`).
- **WKT-03 plausibility**: more than 100 reps, or a load above 3× the current e1RM, is rejected
  as `implausible` until confirmed (`confirmImplausible`); constants, not training logic.

### Persistence and recovery

- **One event = one strict transaction** over sessions, sets, readiness, the derived exercise
  state and (for plan effects) planned sessions and plans; the reducer runs inside it (pure,
  synchronous), rules are resolved and stale derived data rebuilt before it (§8.2.4).
- **Recovery** (WKT-14): the session record holds the cursor, the timer and the undo entry, so a
  killed app resumes exactly; `resumeWorkout` re-arms the stored timer. Tested in memory (a new
  process over the same data) and in Dexie (close and reopen).
- **Derived data** (§8.2.8): `dExerciseState` (keyed by exercise; `key` fingerprints the engine,
  rules and content versions, the overrides, the level, the baseline and, for bodyweight-loaded
  exercises, the bodyweight log), `dSessionE1rm`, `dPrs`. They hold finished and partial
  sessions only; the active session's PRs and suggestions are computed from them and its own
  sets. A stale or missing state is rebuilt from the raw sets before use; finishing, editing,
  deleting and backdating rebuild the touched exercises; M0's quick-log `finishSession` drops
  their states (rebuilt on use); a restore clears the derived tables.
- **Records** (version 2 amended, not a version 3): v1 session records get the empty session
  core in the 1 → 2 step (`withSessionDefaults`); the Dexie readers apply the same function to
  version-2 sessions an M2 build wrote. New strict schemas cover the nested undo snapshot; the
  reserved-key and depth check already runs on every file (hostile-key tests added for the
  session slots, the undo snapshot, readiness and the settings' `session`). Reference checks:
  a set's slot and planned set exist in its session, a session's slots have unique keys and
  known exercises, groups name existing slots, a check-in's session exists. Fixture
  `v2/m3-active-session.zip` (active session with timer, undo, warm-ups, technique, check-in and
  preferences) round-trips; the v1 fixture still imports.
- **Dexie**: `sessions` gains the index `plannedSessionId`; new stores `readiness 'id,
  localDate, sessionId'`, `dExerciseState 'exerciseId'`, `dSessionE1rm '[exerciseId+sessionId],
  [exerciseId+localDate], sessionId'`, `dPrs 'id, exerciseId, setId, sessionId, localDate,
  type'`. A developer device that already holds a version-2 database from an M2 build has the
  old store layout at the same version number: clear the site data once (no beta users exist).

### Evidence for the new parameters (rules 1.3.0 → 1.4.0: 128 → 133 parameters, 34 `verified: false`)

| Parameter                                   | Value                 | Evidence and sources                                                                    | Verified | Why                                                                                                                                                                                                                          |
| ------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load.pr.minSetWeight`                      | 0.5                   | [INF] `src.powr-prd`, `src.halperin2022`, `src.grgic2020`                               | false    | PRD MOT-01 "e1RM PR only from qualifying sets per PRG-01 weighting" and R-07 (false PRs from noise); the EB set weights are 1.0 / 0.5 / ≤ 0.1; the 0.5 tier (RPE ≥ 7, ≤ 12 effective reps) as the cut is a POWR design value |
| `progression.calibration.reliableSetWeight` | 0.5                   | [INF] `src.powr-technical-concept`, `src.halperin2022`                                  | false    | PRD PRG-08 "first 1–2 exposures": when one exposure suffices is not in the EB; a design value tied to the same set-weight tier                                                                                               |
| `session.rest.competitionMinimum`           | 120 s                 | [SR] `src.grgic2018b`                                                                   | true     | EB §Defaults › Session "never < 2:00 on competition lifts"; PRD WKT-16                                                                                                                                                       |
| `monitoring.readiness.sleep`                | short < 6 h, 2 nights | [MA, SR, INF] `src.craven2022` (new), `src.knowles2018` (new), `src.powr-eb-monitoring` | true     | EB §Monitoring › Sleep & stress rules (Craven 2022: PM tasks impaired; Knowles 2018: consecutive nights reduce multi-joint force)                                                                                            |
| `monitoring.readiness.pmFromHour`           | 12                    | [INF] `src.craven2022`, `src.powr-eb-monitoring`                                        | false    | "PM session" is not defined in the EB; noon is a design value                                                                                                                                                                |

`pnpm --filter @powr/rules build -- --diff <1.3.0 rules.json>` lists exactly these five as
added. Two sources added to `data/sources/monitoring.yaml`.

### Decisions and deviations

| Concept / brief says                                           | What I did                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The reducer lives in `@powr/application/session` (§8.5)        | In `@powr/domain/session`, so the domain lint enforces its purity (no `Date`, no I/O); the application entry runs the effects and holds the use cases                                                                                                      |
| `reduceSession(s, e, ctx)`                                     | State = `{ session, sets }` (the logged sets are their own records); `startSession` creates the first state; IDs come from a pool in the context (`ctx.ids`), time from `ctx.now`, so replays are deterministic                                            |
| §6.2 writes `dPrs`, `dExerciseState`, `dWeekly` after each set | The derived tables hold finished sessions only; in-session PRs, suggestions and volume are computed from them plus the session's sets (undo and edits stay consistent without derived writes). `dWeekly` and `dStreak` are left to M4 (analytics, streaks) |
| Derived writes with relaxed durability (§8.2.4)                | Strict like everything else: Dexie sets durability per database, not per transaction                                                                                                                                                                       |
| Forward recompute in the engine worker (§6.9, §8.2.8)          | Per-exercise full rebuild in the lazy session chunk on the main thread (TD-32 still open): simple and exactly equal to the incremental path                                                                                                                |
| "Sets without effort never create PRs" (brief)                 | As E-1 (§8.7.7): no e1RM PR from a set without effort (`load.unknownEffort.eligibleForE1rmPr`, property-tested); its actual load × reps can set rep, load and volume PRs, as E-1 states. **Product-owner decision** if no PR at all was meant              |
| Rep PR "best load at that rep count, 1–12+" (MOT-01)           | Best load for at least that many reps (the rep-max table of ANL-04), every rep count; the first ever set of a rep count is a rep PR (except in the first exposure)                                                                                         |
| `warmupRest` timer kind (§5.6 sketch)                          | Warm-up rests are `rest` timers (the shared contract has three kinds)                                                                                                                                                                                      |
| Deload "load 85–100%"                                          | The middle of the slot's range on top of the normal suggestion (history-based loads only; in-session autoregulated loads already follow the day's performance)                                                                                             |
| Undo (WKT-12)                                                  | One level, stored in the session record (survives a kill), token valid 30 s; restores the session (with a fresh revision) and the set records exactly; a mesocycle-wide substitution is not undoable                                                       |
| Finish "partial" counts for the streak (MOT-03)                | `countsForStreak`: finished, or partial with ≥ 50% of the planned working sets done (added exercises not counted as planned)                                                                                                                               |
| WKT-11 per-side reps                                           | `reps` is the weaker side when both sides are given; one set for volume (A-18)                                                                                                                                                                             |
| APRE progression                                               | Loaded like RPE mode (the APRE-6 session structure is not built; no MVP template uses it)                                                                                                                                                                  |
| Substitution list (WKT-08)                                     | Same pattern and primary muscles, without the plan's competition-lift rule (a swap for the session may leave the lift); the starting load of an exercise without history is the calibration (PRG-08), no cross-exercise conversion (the PRD's "Could")     |
| Readiness scales (RDY-01)                                      | Sleep hours (0–24 in quarter hours), sleep quality, energy, soreness, stress, motivation 1–5, PRS 0–10; per-muscle soreness 1–5; every item optional                                                                                                       |

### Evidence

`pnpm verify` green on 2026-11-24: lint (0 errors, 0 warnings, `--deny-warnings`), format, token
gate, knip, catalog check, typecheck, 708 tests in 64 files (651 before; 57 new), build, licence gate (33 distributed,
841 build-only, passed), size (entry JS **179.0 kB** gzip of 186, was 178.08: the Dexie
repositories and live queries of the new tables; the session use cases are the lazy entry and
not in any chunk yet; CSS 5.82 kB; precache 78 files + sw.js, 476.1 kB; startup path 5 scripts,
0 with Zod) and 39 E2E tests (unchanged; the session screens are M3b). New tests: `packages/domain/test/session/reference.test.ts` (27 reference tests: PRG-05
golden 150 kg → 120 kg, back-offs −3.0% after RPE 9, PRG-04 32.5 kg × 8, PRG-06 +2.5 kg and the
10% reset, PRG-08 calibration and its state machine, the EB baseline example 120.3 kg, deload
92.5%, the heavy warm-up ramp, PRs, timers, guardrails, readiness z-scores and proposals, return
from break, summary, past sessions, the view and remaining time),
`packages/domain/test/session/properties.test.ts` (fast-check, 150 runs each in CI, 2,000 once:
determinism, cursor validity and persistence, undo restores the previous state and its timer, no
e1RM PR without entered effort, timers never negative after a recovery at any clock offset,
technique credits match the registry table), `packages/application/test/m3a.test.ts` (start,
one active session, log and undo, a crash before the commit, a simulated process kill, finish
with derived rebuild, backdated logging and PR recompute in date order, the PR preview, edit and
delete, readiness, remembered rest, substitution, the live view, restore clears derived),
`apps/web/src/infrastructure/db/db.test.ts` (close and reopen with an active session and its
timer, M2-era sessions read with defaults, derived replace/invalidate/clear), formats tests (v2
fixture, v1 migration to the session core, hostile keys in the new records, the new reference
checks).

### Open items

- **For M3b:** the session screens and their lazy loader (`import('@powr/application/session')`,
  one lint disable like `usePlanning`); the effect runner wiring `timer.arm`/`disarm` to M3t's
  `restAlerts.arm(timer, texts, options)` and `disarm(id)` and M3t's `pre-alert`/`end` events
  back to `TIMER_FIRED`; the stale-session prompt; the PR celebration; English texts for
  rejections, hints and announcements (the "Why?" texts exist); the docs pass.
- **M4:** `dWeekly`, `dStreak` and the PR history screen (dPrs is ready); the personal curve fit
  and the correction factor (TD-26); move rebuilds and plan generation to the engine worker
  (TD-32); per-lift reactive-deload signals from `dSessionE1rm`.
- Baselines do not transfer to variants (unchanged from M2c); no cross-exercise starting loads
  (WKT-08 "Could").
- PRG-07 "switch to rep/RPE progression when planned increases outrun the observed e1RM
  trend" is not built (the slope is available in the trend state).
- RDY-03 high-stress weeks ("+24 h spacing") is a planning concern; not proposed in the session.
- The APRE-6 session structure (preset only; loaded like RPE mode).
- Developer devices with an M2-era version-2 database: clear the site data once (same version
  number, new stores).

### Doc amendments for the docs pass

- **Technical concept §5.4:** add the row `session` (reducer, events, effects, suggestions,
  calibration, PRs, readiness, guardrails, timers, past sessions, views; WKT, TMR, PRG-03…13,
  RDY-01…03, MOT-01) and note that `prs` and `readiness` are built inside it.
- **§5.5:** ports `ReadinessRepo`, `DerivedRepo` (`exerciseStates`, `replaceExercise`,
  `prsBySession`, `prsByExercise`, `pointsByExercise`, `invalidate`, `clear`), `SetRepo.put/
  delete/byExercise`, `SessionRepo.delete/byIds`, `BodyweightRepo.list`; live queries
  `activeSessionData`, `sessionPrs`; `TableName` includes the derived tables.
- **§5.6:** replace the `Session`, `LoggedSet` and `TimerState` sketches with the built types
  (above), add `SessionExercise`, `PlannedSet`, `ReadinessEntry`, `SessionChange`, `UndoEntry`;
  `technique` is `{ kind, units? }`.
- **§6.2:** the use case is `dispatch(CONFIRM_SET)`; the reducer is in `@powr/domain/session`;
  derived tables are written at finish, in-session PRs are computed; the result carries
  `prs`, `next`, `timer`, `undoToken`, `hints`.
- **§6.9:** the recompute is a per-exercise rebuild in the session chunk until the engine worker
  exists; `previewPastEdit` is `prs.previewEffect`.
- **§8.2.2:** M3a state of version 2 (amended): `sessions.plannedSessionId`, `readiness`,
  `dExerciseState`, `dSessionE1rm`, `dPrs` with the indexes above; `dWeekly`, `dStreak` M4.
- **§8.2.4:** all writes are strict (derived included); the session tables of one event.
- **§8.2.8:** the derived-state key and the invalidate-on-M0-finish rule; import clears derived.
- **§8.3:** the v2 fixture `m3-active-session.zip`; the new reference checks.
- **§8.5:** reducer location, state shape, the event and effect tables above, the ID pool, the
  undo semantics, the property list.
- **§8.7.5:** the calibration state machine and `reliableSetWeight`; baseline seeding.
- **§8.7.7 E-1 / MOT-01:** the rep-PR definition (n-rep max), `load.pr.minSetWeight`.
- **§8.8.1:** the contract with `softMinMs` and `slotKey`; no `warmupRest` kind.
- **TD-27:** closed for PR detection and the calibration state machine; readiness and return
  from break built in the session. **TD-32:** extend to the derived-data rebuild.
  **TD-26:** unchanged (fit and correction factor).
- **PRD:** MOT-01 rep PR wording ("more load than ever for at least that many reps"); RDY-01
  item scales; WKT-08 alternatives may leave the competition lift for the session; WKT-03
  plausibility numbers (3× e1RM, 100 reps) as product constants.

## M3t timers and alerts

Written 2026-11-24 by the M3t work (part of roadmap A.4 "M3 Workout session", in parallel with M3a,
the session core): the timer and alert subsystem of technical concept §8.8, without a session
screen (M3b wires it). Status: `pnpm verify` green (numbers under "Evidence").

### What landed

| Area                      | PRD / concept                                                      | Where                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timer contract            | §8.8.1                                                             | `src/infrastructure/alerts/timer.ts`: a local `TimerState`, structurally identical to M3a's `@powr/domain` type (a comment names the contract); `computeDisplay`, `timerEndsAt`, `alertKey`                                                                                                                                |
| Display engine            | TMR-04, TMR-07, TMR-09, TMR-11, TMR-12, NFR-PERF-02/10, NFR-REL-05 | `alerts/engine.ts` (monotonic anchor, wall-clock frame after a resume, clock-jump report), `alerts/ticker.ts` (4 Hz on a 250 ms grid, each tick on an animation frame, nothing while hidden or unsubscribed, recompute at once on `visibilitychange`, `pageshow`, `resume`), `alerts/lifecycle.ts`; hook `useTimerDisplay` |
| Alerts while visible      | TMR-05, PWA-07, SET-03, NFR-A11Y-06/09                             | `platform/audio.ts` (Web Audio cues `restEnd`, `preAlert`, `countdown`, `gentle`, `pr`; `unlock()`; volume as gain; `suspend()`), `alerts/patterns.ts` (vibration), `alerts/scheduler.ts` (pre-alert at 10 s, 3-2-1, end), `ui/announcer.tsx` (the polite live region, mounted in the shell)                               |
| Wake lock policy          | PWA-06, SET-10, R-15                                               | `alerts/wake-lock-policy.ts` (reference-counted holds, re-acquired on visible, released with the last holder or when the setting goes off, the refusal reason kept), hook `useScreenWakeLock`                                                                                                                              |
| Alerts while hidden       | TMR-06, PWA-08, NG-13                                              | `alerts/scheduler.ts` (page one-shot timeout, `ARM_REST` service-worker timer, silent "Resting – ends at …", "Rest over" with `renotify`, `fired:<key>` dedupe, the return report), `sw/sw.ts`, `runtime-db` (`pruneFiredFlags`), `platform/notifications.ts`                                                              |
| Honest status             | TMR-06, SET-04, PWA-13, V-01                                       | `alerts/status.ts`, `alerts/browser.ts`, `alerts/capability-matrix.json` (empty: S-1 has not run), `tools/capability-matrix` (`pnpm capability-matrix`)                                                                                                                                                                    |
| Settings → Alerts         | SET-03, SET-04, SET-10, PWA-06, PWA-08                             | `features/settings/AlertsSection.tsx` (mounted in `SettingsScreen` with one line), `hooks/use-alert-settings.ts`; the settings record's new `alerts` field (`packages/formats/src/records/v2.ts`)                                                                                                                          |
| Labs audio keep-alive (E) | OQ-T3 = B                                                          | `alerts/labs.ts` (device-local runtime flag, off, no user-facing toggle), the scheduler option `keepAlive`, harness variant E and its "Labs" checkbox on `/debug/alerts`                                                                                                                                                   |
| S-1 harness               | V-01, §8.8.5                                                       | `features/debug/AlertsHarness.tsx`, `alert-harness.ts`: rebuilt on the production scheduler, timer engine and wake-lock policy; export `harnessVersion` 2                                                                                                                                                                  |
| Composition               | §5.3                                                               | `app/container.ts`: `platform.timers` (`TimerKit`: engine, ticker, `restAlerts`, `screenWake`, `labs`, `displayStore`, `alertStatus`, `browser`); the scheduler and the status are lazy chunks (2.0 and 0.9 kB gzip)                                                                                                       |
| Diagnostics               | §8.17                                                              | Codes `timer.clockJump` (`deltaMs`, `visibility`), `wakeLock.state` (`state`, `reason`), `alerts.end` (`path`, `delayMs`, `kind`, `hidden`), `alerts.error` (`name`)                                                                                                                                                       |

Tests: `src/infrastructure/alerts/{engine,ticker,scheduler,status,wake-lock-policy}.test.ts` (a
fake clock with wall, monotonic and deep-sleep time in `test-support.ts`),
`src/infrastructure/runtime-db/runtime-db.test.ts`, `src/ui/announcer.test.ts`,
`tools/capability-matrix/test/compile.test.ts`, `packages/formats/test/migrations.test.ts` (alert
settings at v2; the backup round-trip arbitraries now generate them), `apps/web/test/alerts.test.tsx`
(component tests), `apps/web/e2e/alerts.spec.ts`, `apps/web/e2e/diagnostics.spec.ts` (export v2).

### API for M3b

```tsx
import { announce } from '#ui/announcer'; // the shell already mounts <LiveAnnouncer />

import { usePlatform } from '../../hooks/use-app';
import {
  useScreenWakeLock,
  useTimerAlerts,
  useTimerDisplay,
  useUnlockAudio,
  type TimerState, // the local contract type; @powr/domain's after the merge
} from '../../hooks/use-timers';
import { formatClock } from '../../i18n/format';

// "Start session" tap: creates and resumes the AudioContext inside the gesture (autoplay policy).
const unlockAudio = useUnlockAudio();
<Button
  onClick={() => {
    void unlockAudio();
    startSession();
  }}
/>;

// Display (session screen, ring, mini timer TMR-12, the session clock TMR-11 as a count-up):
const display = useTimerDisplay(session.timer); // remainingMs, elapsedMs, overMs, phase, done, progress
display.done
  ? `Rest over · +${formatClock(display.overMs, 'down')}`
  : formatClock(display.remainingMs);

// Alerts: mount ONCE while a session runs (a shell-level session provider or the mini timer).
const { endedWhileHidden } = useTimerAlerts(session.timer); // arms, re-arms on a new end, disarms on null
useScreenWakeLock(sessionActive); // in the session screen and the mini timer (reference-counted)

// Finish or discard: disarm everything, suspend the audio context, prune old fired flags.
usePlatform().timers.restAlerts.stopAll();
```

- **`useTimerDisplay(timer, now?)`** returns a `TimerDisplay`: `phase` is `idle`, `running`,
  `ending` (the last 10 s of a countdown, for emphasis) or `done` (countdown end, count-up soft
  minimum); a count-up keeps counting in `elapsedMs` and `overMs`. About 4 updates a second while
  visible, none while hidden, one at once on return. `now` freezes it (summaries, tests).
- **`useTimerAlerts(timer, { url })`** reads the alert settings (and the Labs flag), builds the
  translated notification texts, arms `platform.timers.restAlerts` and announces politely: "Rest
  started, 2 minutes, 30 seconds", "… left" after an adjust, "10 seconds left" (pre-alert on),
  "Rest over", "Rest over, 42 seconds ago" on return; never the 3-2-1 or seconds. Set and
  transition timers have their own words ("Time is up", "Next exercise"). `endedWhileHidden` is
  true after a return to an ended timer: show "Rest over · +0:42" (TMR-04).
- **Visual done state:** `display.done` (`phase === 'done'`) drives the ring's done state and a
  static screen-edge highlight; nothing may flash above 3 Hz, and motion follows reduced motion
  (NFR-A11Y-08/09). The ring is M3b's.
- **Imperative API** (if M3b runs M3a's effects directly): `const { restAlerts } =
  usePlatform().timers;` `restAlerts.arm(timer, texts, options)`, `disarm(timerId)`, `stopAll()`,
  `subscribe(listener)` with the events `armed`, `pre-alert`, `countdown`, `end` (`path`:
  `visible`, `page-timeout`, `sw-timer`, `on-return`; `delayMs`; `hidden`), `hidden`, `visible`
  (`endedWhileHidden`, `overMs`), `keep-alive`, `disarmed`. `arm` is idempotent for the same end
  (options and texts update in place).
- **Other sounds:** `usePlatform().audio.play('pr', volume)` with `haptics.vibrate([30, 40, 60])`
  for the PR celebration (MOT-02); `'countdown'` for a 3-2-1 lead-in before a timed set (TMR-09).
- **Announcer:** `announce(text)` from `#ui/announcer` for any other polite status (at most one per
  second, the latest of a burst, a repeat of the text still shown dropped).

**Wiring M3a's timer effects:**

| M3a effect (carries a whole `TimerState`)          | M3t                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| arm (rest after a set, set timer, transition)      | Render `useTimerAlerts(session.timer)` with the persisted timer, or call `restAlerts.arm(timer, texts, options)`                                  |
| re-arm after an adjust (same `id`, new `adjustMs`) | The same call: a new end is a new alert key, the old service-worker timer is disarmed, and a rest extended after it ended alerts again            |
| disarm by `id` (skip, next set confirmed)          | The timer becomes null, or `restAlerts.disarm(id)`                                                                                                |
| session finished or discarded                      | `restAlerts.stopAll()` and `useScreenWakeLock(false)`                                                                                             |
| `fired.preAlert` / `fired.end` in the record       | Subscribe to `pre-alert` / `end` and dispatch M3a's command, so a reload does not alert again; the scheduler skips what the record marks as fired |

At the merge: replace the interface in `src/infrastructure/alerts/timer.ts` with
`export type { TimerState } from '@powr/domain';` (nothing else changes).

**Settings fields (merge with M3a's settings changes):** `SettingsRecord.alerts`, an optional
strict object whose fields are all required: `sound`, `volume` (0–1), `vibration`, `preAlert`,
`countdown`, `restingNotice`, `keepScreenOn`. Absent means the defaults in
`hooks/use-alert-settings.ts` (sound on, 80%, vibration on, pre-alert on, 3-2-1 off, resting notice
on, keep screen on). `useSetAlertSettings` writes it through `deps.uow` like the theme; a
`setAlertSettings` use case in `@powr/application` would be the cleaner home (M3a owns packages).

### Decisions and deviations

| Concept / brief says                                                       | What I did                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clock jump > 2 s: "re-anchor and log a `clock-jump` diagnostic" (§8.8.1)   | While the page stays visible the display keeps its monotonic time (a clock change does not move a timer, NFR-REL-05); the jump is logged once (`timer.clockJump`) and the comparison baseline moves. On `visible`, `pageshow` and `resume` the anchor is rebuilt from the wall clock: Android's monotonic clock stops in deep sleep, so the wall clock is the truth after a hide, as after a reload |
| Dedupe by `fired[timerId]` (§8.8.4)                                        | By `fired:<timerId>@<end>`: an adjust gives a new key, so a rest extended after it ended alerts again, and the page and the service worker dedupe on exactly the end they were armed for                                                                                                                                                                                                            |
| The service worker claims the flag, then checks the permission (M0)        | It claims only when it can show a notification; without permission it no longer silences the page path (a beep)                                                                                                                                                                                                                                                                                     |
| `ARM_REST` only for rests ending within 5 min                              | Unchanged in the service worker; for a longer rest the page arms it 5 minutes before the end, if the page still runs then                                                                                                                                                                                                                                                                           |
| Hidden-state alerts for rest timers                                        | For every timer kind (rest, set, transition; a count-up at its soft minimum with the gentle cue), with the caller's texts                                                                                                                                                                                                                                                                           |
| "A non-intrusive alert" when the rest ended while hidden (TMR-04)          | The `gentle` two-note cue (and a short vibration) on return, also after a reload into an ended rest                                                                                                                                                                                                                                                                                                 |
| The silent "Resting" notification (M0 adapter)                             | **Bug fixed:** the M0 adapter passed `vibrate: []` with `silent: true`, which Chromium rejects ("Silent notifications must not specify vibration patterns"), so variant D never showed its notice; `show()` now resolves false instead of throwing                                                                                                                                                  |
| `capability-matrix.json` shipped; records in `docs/device-tests/` (§8.8.5) | The matrix is `apps/web/src/infrastructure/alerts/capability-matrix.json`, bundled into the lazy status chunk (hashed, precached); the records (harness exports) go to `tools/capability-matrix/records/` because `docs/` is off limits here. `pnpm test` fails when the matrix is stale                                                                                                            |
| The matrix is keyed by browser family and version range                    | Also by platform, display mode, condition (locked, switched), battery saver and variant. A cell holds for its major version + 2 (about two months). Battery saver cannot be detected, so the worse result counts. C and D stand for each other, E only for itself. "Supported" needs ≥ 3 runs                                                                                                       |
| Labs keep-alive opt-in "only if S-1 shows it works"                        | Runtime flag `powr.labs.audioKeepAlive` (localStorage, per device), off; only the harness can switch it on; no user-facing toggle                                                                                                                                                                                                                                                                   |
| Notification permission requested contextually (ONB-11)                    | Settings → Alerts only (the explanation, then the button); onboarding's system step stays TD-34                                                                                                                                                                                                                                                                                                     |
| `unlock()` on the start tap                                                | Waits at most 500 ms for `resume()`: without user activation it stays pending until the next gesture                                                                                                                                                                                                                                                                                                |
| A polite live region                                                       | `<div aria-live="polite" aria-atomic="true">` in the shell, not an `<output>`: queries for the screens' own status outputs (`getByRole('status')`) must not find it                                                                                                                                                                                                                                 |
| Settings write path                                                        | A hook through `deps.uow` (no use case: `packages/**` is M3a's)                                                                                                                                                                                                                                                                                                                                     |
| Test alert                                                                 | Immediate (sound at the set volume, vibration, the announcement, the done badge); no locked-screen test button                                                                                                                                                                                                                                                                                      |
| E2E                                                                        | `e2e/alerts.spec.ts` runs in full Chromium (`test.use({ channel: 'chromium' })`, new headless): the default headless shell reports the notification permission "denied" even after `grantPermissions`. M0's variant B test moved there; with the claim fix it needs a real permission                                                                                                               |
| `apps/web/tsconfig.app.json`                                               | `include` lists the matrix JSON (a composite project must list every imported JSON file)                                                                                                                                                                                                                                                                                                            |
| Entry JS ≤ 186 kB                                                          | 178.08 → 181.76 kB gzip: about 2.95 kB for the engine, ticker, wake-lock policy, scheduler facade, cues and announcer, about 0.7 kB because Rolldown now splits shared modules into 14 first-wave scripts (5 before) once the new hooks are shared by two lazy routes (still 0 with Zod)                                                                                                            |

### S-1 device test protocol (for the product owner)

**Set-up, once per browser.** Serve the build as in section 1 ("Testing on the Galaxy S22":
`pnpm build && pnpm docker:build && pnpm docker:run`, `adb reverse tcp:8080 tcp:8080`), or the beta
server once S-7 exists. On the S22 open `http://localhost:8080/?debug=1` in **Chrome**, pass the
legal gate ("Just let me log") and wait for "Ready for offline use". Write down the One UI, Android,
Chrome (`chrome://version`) and Samsung Internet (Settings → About) versions. On the phone:
notifications for the browser allowed, Do Not Disturb off, media volume up, vibration on. Open
Settings → Developer tools → "Timer alert harness (S-1)", enter the label (for example "Galaxy S22
SM-S901B, One UI 7, Android 15, Chrome 142, PWA") and tap "Allow notifications". For the
**installed PWA** runs install the app (menu → Install app) and start it from the home screen; for
the **tab** runs use the browser itself. Then repeat everything in **Samsung Internet**.

**Cells, in priority order** (3 repetitions each; rests of 60 s, 3 min and 5 min unless noted):

1. Variant D (the production default), Screen locked, battery saver off.
2. Variant D, Screen locked, battery saver **on** (Settings → Battery → Power saving).
3. Variant D, App switched (home button), battery saver off.
4. Variant E (Labs keep-alive), Screen locked, battery saver off and on: the OQ-T3 go/no-go. Also
   one 60-minute battery run for C and for E (for example 12 × 3 min with the screen locked).
5. Variants A and B, Screen locked, battery saver off (which path carries the alert).
6. 8 min, variants C and E, Screen locked (freezing; not counted for the status).
7. Once with the notification permission denied (D, locked): Settings → Alerts must say "Not
   supported" with the reason.

**Each run.** Choose condition, battery saver, variant and rest length (keep "Hold the screen wake
lock" on). Tap **Start run**, then at once lock the screen (power button) or press home. Wait until
about 30 s after the planned end and note what the harness cannot see: sound heard, vibration felt,
the notification on the lock screen or as a heads-up, and for E how the media notification looks.
Unlock or return: the harness records the first path that alerted (`page-timeout`, `sw-timer`, or
`on-return` = missed) and its delay, the wake-lock events and the battery level at start and end,
and classifies the run (`on-time` within 2 s, `late`, `missed`). Check once per browser that a
2:30 rest returned to after about 60 s shows 1:30 ± 1 s at once (TMR-04). A row "interrupted" means
the page was killed; "Export results" fills in what the service worker did.

**Records → matrix.** Tap **Export results** (a `.txt` with JSON, `harnessVersion` 2) after each
browser and mode, then "Clear results". Copy the files off the phone (Downloads; `adb pull`) into
`tools/capability-matrix/records/` as `<date>-<device>-<browser>-<mode>.txt`, run
`pnpm capability-matrix` (it prints the entries per status) and commit the records together with
`apps/web/src/infrastructure/alerts/capability-matrix.json`. Write the human record (the sheet
above, battery numbers, screenshots of the notifications, the E go/no-go) as
`docs/device-tests/<date>-s22.md` in the docs pass. A record with `"placeholder": true` compiles
into rows that the app ignores (to try the pipeline). Settings → Alerts then says "Supported" only
where the locked D or C cells of both battery-saver states for that browser, version range and mode
are supported (≥ 3 runs, ≥ 95% on time within 2 s, rests of at most 5 min).

### Evidence

`pnpm verify` green on 2026-11-24 (exit 0): lint (0 errors, 0 warnings), format, token gate
(unchanged: lowest text 4.56, on fills 5.41, UI 3.88; 239 colour utilities in 137 files), knip,
catalog check (884 messages), typecheck, 715 tests in 70 files (baseline 651 in 61), build, licence
gate (33 distributed, 841 build-only, passed), size (entry JS **181.76 kB** gzip of 186 kB, was
178.08; CSS 5.87 kB; service worker 7.88 kB, was 7.70; precache 90 files + sw.js, 486.7 kB; startup
path 14 scripts, 0 with Zod) and 45 E2E tests (39 before): `e2e/alerts.spec.ts` (7) covers QS-03
with the Playwright clock (a 2:30 rest hidden for 60 s shows 1:29–1:31 within 500 ms), a device
clock change while visible (`setSystemTime` +1 h: the timer does not move, `timer.clockJump` is
logged), the service-worker path (variant B), the notification path with a real permission
(variant D: "Resting" on hide, exactly one "Rest over", both closed on return, one `fired` event),
the permission asked only after the explanation (0 requests on `/`, `/session`, `/plan`,
`/settings`, 1 after the tap), axe (WCAG 2.2 A/AA) in light and dark on Settings → Alerts and on the
harness (idle and running) and reflow at 320 px and 200% text. The unit tests cover anchoring, the
clock jump, deep sleep and resume, clamps, the 4 Hz grid and silence while hidden, arm, disarm,
dedupe in both orders, re-arm on an adjust, a missed rest, the 5-minute service-worker rule, the
keep-alive lifecycle, the wake-lock states, the status rule and the matrix compiler.

### Open items

- **S-1 on the S22 (V-01, mandatory):** the matrix is empty, so every browser shows "Limited (best
  effort)" (or "Not supported" without notifications). The E go/no-go and the Labs toggle wait for
  it.
- **M3b:** the session screen, the mini timer (TMR-12) and the session clock (TMR-11) on these
  hooks; persisting `fired.preAlert` and `fired.end` through M3a's reducer; `stopAll()` on finish
  and discard; the 3-2-1 lead-in of timed sets (TMR-09); tempo cues (TMR-10, not built); the PR
  sound (MOT-02, cue ready). A `setAlertSettings` use case could replace the hook's direct write.
- **Not E2E-testable:** a tap on a notification (`notificationclick` focuses the app, preferring a
  window already at the notification's URL, or opens `/session`): check it in S-1 or S-2.
- **SET-03 "pre-alert timing":** a switch at 10 s; a choice of seconds is a small change if wanted.
  SET-04 voice cues (Could) are not built.
- **Settings shows the wake-lock outcome of the last request** ("Used during workouts" until a
  session asks); there is no probe button.
- **`CheckRow` (M2b design system)** puts its description into the accessible name; an
  `aria-describedby` would be shorter for TalkBack (visible in the Alerts section's rows).
- **Size:** 4.24 kB of entry headroom are left; M3a and M3b additions to the startup path should
  stay lazy.
- **Manual TalkBack pass (S22):** the announcements during a real rest (once each, no flooding),
  the volume slider's spoken value, the status badge.

### Doc amendments for the docs pass

- **§8.8.1:** the clock-jump behaviour above (monotonic while visible, logged once; the wall clock
  on resume); 4 Hz on a 250 ms grid of timeouts, each on an animation frame; `useTimerDisplay`.
- **§8.8.2:** the cues `restEnd`, `preAlert`, `countdown`, `gentle`, `pr`; `unlock()` waits at most
  500 ms; the shell's live region (`#ui/announcer`) and the announcement texts; the pre-alert as a
  switch at 10 s.
- **§8.8.3:** the policy (reference-counted holds; the states off, held, released, denied,
  unsupported; the Settings lines "Not supported on this browser" and "Not available right now"
  with the reason).
- **§8.8.4 and §6.2:** the alert key `timerId@end`; the service worker claims only with permission;
  a rest longer than 5 min arms the service worker 5 min before its end; all timer kinds; the
  gentle cue on return; silent notifications carry no vibration pattern.
- **§8.8.5:** the matrix location and format, the records in `tools/capability-matrix/records/` (or
  move them to `docs/device-tests/` and point the tool there), the compiler rule (≥ 3 runs, version
  grace 2, the worse battery-saver result, C/D fallback), the status reasons, the harness export
  `harnessVersion` 2 (condition, battery saver, browser, display mode, placeholder, alert key).
- **§8.2.2 / settings record:** the optional `alerts` object (SET-03, SET-04, SET-10).
- **§5.3 tree:** `src/infrastructure/alerts/`, `src/hooks/use-timers.ts`,
  `src/hooks/use-alert-settings.ts`, `src/ui/announcer.tsx`, `tools/capability-matrix/`.
- **§8.17:** the four new diagnostic codes. **§8.22:** the Labs runtime flag (device-local, no UI).
- **§8.20:** `e2e/alerts.spec.ts` in full Chromium (`channel: 'chromium'`) for notifications; QS-03
  automated with the Playwright clock (§10.2).
- **§8.19:** entry JS 181.8 kB gzip (lazy chunks `scheduler` 2.0 kB and `status` 0.9 kB).
- **ADR-0019:** the implementation landed; the matrix stays empty until S-1; follow-up unchanged.
- **IMPLEMENTATION_NOTES section 1** ("Testing on the Galaxy S22", the `/debug/alerts` bullet):
  point to the protocol above (condition, battery saver, export v2, `pnpm capability-matrix`).

## M3b session screens

Written 2026-11-25 by the M3b work (roadmap A.4 "M3 Workout session", the screens on top of M3a's
session core and M3t's timers and alerts), plus the docs pass for M3 as a whole (technical concept
v0.7, ADR amendments, `docs/device-tests/S-1-protocol.md`). Started by an earlier M3b run that was
stopped mid-way; this run reviewed, fixed and finished its work. Status: `pnpm verify` green
(numbers under "Evidence").

### What landed

| Area                   | Where                                                                                                                                                                                                                                                                                                                                                                                                                          | PRD                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Routes                 | `/session` (start, check-in, proposals and logging as views inside the route, each with its own `h1`, so `Screen` moves focus and scroll), `/session/summary/$sessionId`, `/session/past`, `/session/past/new`, `/session/past/$sessionId`; M0's `LogSetScreen` and `routes/session.tsx` removed; `?start=today` added to the `/session` search validator                                                                      | WKT-01…16                                 |
| Start                  | `features/session/StartScreen.tsx`: today's planned session (primary), later this week, an empty freestyle workout, a repeat of one of the last three workouts (60 days), deload / return-from-break / calibration notes on planned cards, "Past sessions"; Home's next-session card gets "Start today's session" (one tap: `/session?start=today` starts it once and drops the parameter)                                     | WKT-01, PRG-11/13                         |
| Check-in and proposals | `CheckIn.tsx`: `ReadinessCheckIn` (sleep hours stepper, 1–5 chips, PRS 0–10, every item optional, "Skip check-in"), `Proposals` (each change a checkbox with its "Why?", "Apply the selected changes", "Keep the plan as it is", "Do the lighter session today" → discard + `swapSessions` + start)                                                                                                                            | RDY-01…03, PRG-13                         |
| Logging                | `LoggingView.tsx` (clock line, PR card, resume banner, the current set card, hints, `ExerciseList`, `SessionActions`), `ui/dock.tsx` (the fixed control dock above the bottom navigation), `ui/stepper.tsx`, the RIR chips, `RestPanel.tsx`, `SetDetailsSheet.tsx`, `loads.tsx` (equipment steps and the plate calculator), `ExerciseList.tsx` (set rows, options, swap, rest, notes, edit set, add exercise, finish, discard) | WKT-02…12, 16, TMR-01…13                  |
| Session runtime        | `SessionRuntime.tsx` (lazy, mounted by `AppShell` while M0's `activeSession` live query has a session): `useTimerAlerts` for the persisted timer, `TIMER_FIRED` from M3t's `pre-alert`/`end` events, `RESUME` once per page (WKT-14) and the global mini timer (TMR-12)                                                                                                                                                        | WKT-14, TMR-04…06, TMR-12                 |
| Effect runner          | `commands.ts`: `runPlatformEffects` and `useSessionCommands` (`dispatch`, `start`, `finish`, `discard`)                                                                                                                                                                                                                                                                                                                        | §8.5, MOT-02, PWA-07                      |
| Summary                | `SummaryScreen.tsx`: duration and times, sets against the plan, skipped, partial, streak badge, PR card (Web Animations scale-in ≤ 600 ms, static under reduced motion), first-time exercises, e1RM before → after with the trend label and "Why?", sets per muscle, accepted changes, note, the reactive-deload offer after a finish (PRG-12, `lowReadinessDays` passed), "Edit this workout"                                 | WKT-13, MOT-01/02, PRG-12                 |
| Past sessions          | `features/session/past/`: list (365 days, newest first), the backdated form (date, time, exercises, sets, note; errors summarised and named at each field), the editor (edit, add and delete sets, remove an exercise, note, delete the workout) with the PR preview sheet ("This will remove a PR" / "This will add a PR") before anything is written; entry points: Progress tab (until M4), the start screen, the summary   | WKT-15                                    |
| Settings               | `features/settings/WorkoutSection.tsx` (new "Workout" card: rest auto-start, countdown or count-up rest, check-in, each hint, rounding direction; through `updateSessionPreferences`), `AlertsSection.tsx` (pre-alert timing 5/10/15 s, shown while the pre-alert is on)                                                                                                                                                       | SET-03, SET-05, TMR-01/07, RDY-01, WKT-16 |
| Lazy timer kit         | `app/container.ts` (`platform.timers` is a `TimerKitLoader`: `current()`, `load()`), `hooks/use-timer-kit.ts` (`use(load())`, never conditional), `infrastructure/alerts/index.ts` (the kit now owns the Web Audio cues); `platform.audio` removed                                                                                                                                                                             | decision 2                                |
| Startup chunk          | `vite.config.ts`: `build.rolldownOptions.output.codeSplitting.groups = [{ name: 'startup', tags: ['$initial'] }]`                                                                                                                                                                                                                                                                                                              | §8.19                                     |
| Application additions  | `@powr/application/session`: `listPastSessions`, `pastSessionDetail`, `loadImplements` (the implement and rounding mode per exercise for the stepper and the plates)                                                                                                                                                                                                                                                           | WKT-07, WKT-15                            |
| Settings record        | `alerts.preAlertSeconds` (5, 10 or 15; required inside the strict `alerts` object of the unreleased v2 record; schema, arbitraries and tests)                                                                                                                                                                                                                                                                                  | SET-03                                    |

Smaller parts: `ui/timer-ring.tsx` (decorative SVG ring, done = full ring in the success colour,
never colour alone, no animation), `hooks/use-workout.ts` (the one sanctioned `import()` of
`@powr/application/session` and a shared live view per container), `session-ui.ts` (Zustand store
for ephemeral UI state), `preferences.ts`, `words.ts` (set types, techniques, rejections, hints,
PRs and announcements in words; `useLoadUnit`, `massFromKg`), the `pr-pop` keyframes and the
`pb-shell` utility in `app.css`, `BottomNav` publishing `--bottom-nav-height`.

### Product-owner decisions (2026-11-24) and what they became

1. **PRs as M3a built them.** Unchanged in the core. The screens show every PR type in words
   ("New rep PR on Barbell bench press: 100 kg for 5", "New estimated 1-rep max … 54.6 kg", "New
   volume record … 720 kg"); Set details says that a set without an effort rating "still counts for
   reps, weight and volume, but not for your estimated 1-rep max".
2. **Alert code lazy.** The timer kit (engine, ticker, wake-lock policy, scheduler facade, Web Audio
   cues) is a lazy chunk (3.3 kB gzip; the scheduler 2.1 kB and the status 0.9 kB stay separate
   chunks). It loads when `/session` renders (the start tap must unlock audio synchronously, so the
   kit has to be there before the tap), when Settings → Alerts or the debug harness opens, or at
   boot when the shell finds an active session (`SessionRuntime`, so alerts are re-armed right after
   a reload). The live region stays in the shell. **Entry JS 182.73 → 177.34 kB gzip** (target
   ≤ about 179, budget 186 unchanged). **First wave 15 → 1 script:** the growth came from Rolldown
   putting every module the entry shared with a lazy route into its own small common chunk; a
   `codeSplitting` group over the `$initial` modules keeps the entry's static graph in one chunk
   (lazy chunks import from it as before). Still 0 scripts with Zod.
3. **Alert defaults.** As decided (pre-alert on, 3-2-1 off, "Resting" notice on, 80%, keep screen
   on, gentle cue on return, every timer kind). The pre-alert time is selectable in Settings →
   Alerts (5, 10, 15 s; default 10 s): `alerts.preAlertSeconds` in the v2 settings record (no v3),
   `AlertOptions.preAlertMs` in the scheduler, the announcement says the chosen time ("15 seconds
   left").
4. **Development databases stay at version 2.** No migration. A device that ran an M2 build (or an
   M3 build before this one) clears the site data once (Chrome: Site settings → Delete data).
5. **Accepted as built.** No change; the UI follows the core (one-level undo for 30 s, a
   mesocycle-wide swap says "This cannot be undone", plausibility prompt "Log it anyway", …).
6. **Device-test records.** Machine records stay in `tools/capability-matrix/records/`; the human
   protocol and results template are `docs/device-tests/S-1-protocol.md`; no Labs toggle.

### The effect runner and the timer wiring (§8.5, §8.8.7)

| M3a effect              | M3b                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timer.arm`             | Nothing imperative: the shell's `SessionRuntime` renders `useTimerAlerts(session.timer, { url: '/session' })` with the persisted timer (texts, settings, re-arm on a new end; `arm` is idempotent) |
| `timer.disarm`          | `restAlerts.disarm(id)` at once (a skipped rest must not pre-alert while the live query catches up)                                                                                                |
| `wakeLock`              | Nothing: `useScreenWakeLock(true)` on the session screen (from the check-in on) and in the mini timer; finish and discard unmount both                                                             |
| `celebrate`             | The PR card (`useSessionUi.celebration`), vibration `[30, 40, 60]`, the `pr` cue at the alert volume; one celebration per set (MOT-02)                                                             |
| `cue`                   | Haptic tick (`[20]` confirm, `[10, 30, 10]` skip and undo), if vibration is on                                                                                                                     |
| `announce`              | One polite announcement per event, the parts joined (the announcer keeps the latest of a burst); `restStarted` and `transition` are left to the alert hook ("Rest started, 2 minutes")             |
| M3t `pre-alert` / `end` | `dispatch(TIMER_FIRED { timerId, which })`, so a reload never alerts twice                                                                                                                         |
| finish / discard        | `restAlerts.stopAll()`, `resetSessionUi()`, update check (§6.3); finish then runs `checkReactiveDeload` with `lowReadinessDays`                                                                    |

### PRD coverage (requirement → screen or element)

| ID              | Where                                                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WKT-01          | Home "Start today's session" (one tap); start screen: today's / later planned sessions, freestyle, repeat; one active session (the start screen only shows without one; a refused start explains)                                                                                      |
| WKT-02          | Logging view: current set card (exercise, "Set n of m", prescription in words, "Why?", last time with its note, "How to do it" cues), exercise list with progress, rest timer and session clock; primary controls in the dock (lower 60%); values at 24 px bold (1.5× body)            |
| WKT-03          | Dock: weight stepper (next achievable load of the equipment), reps stepper (or left/right), RIR chips 0–4 and 5+ (a half step such as the suggested 1.5 is named in the chips' legend; half steps entered in Set details), one-tap "Confirm set"; plausibility sheet ("Log it anyway") |
| WKT-04          | Set details: set type (working, top, back-off, AMRAP), technique with drops / mini-sets / partial blocks (credit labelled heuristic), failure, failed rep, pain, set note                                                                                                              |
| WKT-05, TMR-13  | Options → "Superset with …" / "Remove from the superset"; superset badges; the transition shows "Next: <exercise>" in the dock                                                                                                                                                         |
| WKT-06          | Warm-ups at start where a working load is known (M3a); Options → "Add warm-up sets"; rows "Warm-up n"                                                                                                                                                                                  |
| WKT-07          | Plates sheet (per side, the nearest loadable loads below and above, "What is on the bar?" reverse calculator); stepper steps; Settings → Workout rounding                                                                                                                              |
| WKT-08          | Options → "Swap exercise": ranked alternatives, "Best match", the reason per option, scope "This session only" / "For the rest of this block"                                                                                                                                          |
| WKT-09          | Options: add a set, remove the last open set, skip the exercise, remove it (nothing logged), move up / down, rest time; "Skip this set" on the card; "Add exercise" (search); all buttons, no drag                                                                                     |
| WKT-10          | "Workout note", Options → "Note on this exercise", Set details → "Note on this set"; last time's note on the card                                                                                                                                                                      |
| WKT-11          | Options → "Log left and right separately" (unilateral exercises); "Assistance (kg)" for assisted exercises (stored negative); no weight stepper for pure bodyweight; "Added weight" label                                                                                              |
| WKT-12          | "Undo" next to the timer in the dock (or "Changed by mistake? Undo" without a timer), 30 s, `UNDO`                                                                                                                                                                                     |
| WKT-13          | Finish sheet (finish, finish as partial, keep training), discard sheet with confirmation, the summary                                                                                                                                                                                  |
| WKT-14          | `SessionRuntime` resumes once, re-arms alerts; "Workout resumed" banner (cleared by the next confirmed set); after 6 h "Finish at the last logged set"                                                                                                                                 |
| WKT-15          | `/session/past`, `/session/past/new`, `/session/past/$sessionId` with the PR preview                                                                                                                                                                                                   |
| WKT-16          | Hint callouts after a set: "Dismiss", "Don't show this hint again"; Settings → Workout per hint                                                                                                                                                                                        |
| TMR-01, 02, 08  | Auto-start (M3a) with the Settings switch; defaults and actual rest from the core                                                                                                                                                                                                      |
| TMR-03          | −15 / +15 / restart / skip in the dock; "Remember m:ss rest for <exercise>"; Options → "Rest time"                                                                                                                                                                                     |
| TMR-04          | "Rest over · +0:42" (and the done frame); correct after reload (E2E with the Playwright clock)                                                                                                                                                                                         |
| TMR-05, 06      | M3t's alerts through `useTimerAlerts` in the shell runtime                                                                                                                                                                                                                             |
| TMR-07          | Settings → Workout "Count up"; the dock shows "Resting, at least 1:30", then "Ready when you are"                                                                                                                                                                                      |
| TMR-09          | "Start set timer" (countdown to the target, else a stopwatch), "Stop" hands the time to the set                                                                                                                                                                                        |
| TMR-10          | Not built (TD-39)                                                                                                                                                                                                                                                                      |
| TMR-11          | "Workout time" and "About … left" under the heading; duration and times in the summary                                                                                                                                                                                                 |
| TMR-12          | Mini timer above the bottom navigation on every screen but `/session` and onboarding: ring and time of the running timer, else the session clock; one tap back                                                                                                                         |
| PRG-03          | Pre-filled weight, reps and RIR in the dock; overrides are just edits                                                                                                                                                                                                                  |
| PRG-09          | "Why?" on the current set, proposals, e1RM changes, the deload offer; hints show their reason                                                                                                                                                                                          |
| PRG-12          | Summary: "Consider bringing your lighter week forward" with "Why?"                                                                                                                                                                                                                     |
| RDY-01…03       | Check-in screen, proposals screen, the lighter-session swap                                                                                                                                                                                                                            |
| MOT-01, 02      | PR card at the top of the logging view (dismissable, never over the controls, static under reduced motion), PR badge on set rows, PRs in the summary                                                                                                                                   |
| PWA-06…08       | Wake lock from the check-in to the last set and in the mini timer; haptics and cues; notifications (M3t)                                                                                                                                                                               |
| SET-03, 05      | Pre-alert timing; rest auto-start and count-up; check-in, hints, rounding                                                                                                                                                                                                              |
| NFR-A11Y-02, 03 | E2E: every dock control ≥ 48 × 48 px and ≥ 8 px apart, inside the lower 60% at 360 × 780, also after scrolling to the end                                                                                                                                                              |
| NFR-A11Y-04     | Reorder, swap, skip and delete are buttons; no swipe or drag anywhere                                                                                                                                                                                                                  |
| NFR-A11Y-06, 09 | One polite live region; alerts multimodal; the done state is text, a full ring and a static frame                                                                                                                                                                                      |
| NFR-A11Y-08     | PR animations are ≤ 600 ms scale-ins, zeroed under reduced motion                                                                                                                                                                                                                      |
| NFR-USE-01      | 1 tap: "Confirm set"; change weight or reps by a step and confirm: 2 taps                                                                                                                                                                                                              |

**Not built (and why):** TMR-10 tempo metronome (TD-39, not in the M3 slice; tempo still feeds the
rep-speed hint); TMR-09's optional 3-2-1 lead-in and the automatic stop at the target (the end alert
fires; TD-48); SET-03 per-context rest defaults, superset transition time, warm-up rest and "reset to
evidence defaults", SET-05 RIR input style and warm-up generation switch, TMR-01's per-exercise
auto-start switch, PRG-03 manual mode and PRG-09 "keep as last time" (the core supports manual mode
and per-exercise preferences; no screen yet; TD-49); WKT-13's mini heat map and the streak count
(the summary lists sets per muscle and says whether the workout counts; `dWeekly`/`dStreak` are M4,
TD-43); the pre-session "Update first" offer (TD-14).

### Mock-up vs accessibility

The mock-up's "Workout log" phone puts weight and reps side by side inside the exercise card. At
360 px two steppers with 48 px buttons cannot hold 24 px values ("102.5") and 48 px fields side by
side, and the card scrolls away, so: the primary controls live in a fixed **dock** above the bottom
navigation (it falls back into the page flow when it would take more than 70% of the viewport, e.g.
at 320 px and 200% text), **one stepper per row** with the label beside it, six RIR chips in one
row, and "Confirm set" full width at the bottom. The PR card and the resume banner sit above the
dock in the page, never over controls. Undo is a button in the dock, not a toast.

### Decisions and deviations

| Concept / brief says                                      | What I did                                                                                                                                                                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load the kit on "session start or resume"                 | It loads when `/session` renders: `unlock()` must run synchronously in the start tap, so the kit must already be there; Settings → Alerts, the harness and the boot path with an active session load it too                                     |
| Effect runner runs `timer.arm` / `wakeLock`               | Declarative: the persisted timer drives `useTimerAlerts`, the mounted screens drive `useScreenWakeLock` (one source of truth after a reload)                                                                                                    |
| `sessionUi` store (§8.5)                                  | Zustand `useSessionUi` (`session-ui.ts`): resume banner, runtime guard, ended-while-hidden flag, PR celebration, proposals, hints, the focus-after-confirm flag, the deload check; reset on start, finish and discard; lost on reload by design |
| Undo snackbar                                             | A button in the dock while the token is valid (30 s), so it is one-handed and never times out from under a screen-reader user before the core's limit                                                                                           |
| RIR half-step chips                                       | Six chips; a half step (the core's suggested "1.5") is named in the legend, half steps are entered in Set details (a seventh chip would wrap and push the dock above the lower 60%)                                                             |
| Mini timer "while a rest timer runs" (TMR-12)             | During the whole session: the running timer, else the session clock (one way back from anywhere)                                                                                                                                                |
| Focus after "Confirm set"                                 | The next set's dock re-mounts; focus goes to its "Confirm set" (or its first field), WCAG 2.4.3                                                                                                                                                 |
| Session preferences written by a hook (like M3t's alerts) | Through the existing use case `updateSessionPreferences`; the alert settings keep M3t's hook (TD-42 unchanged)                                                                                                                                  |
| One startup chunk                                         | `codeSplitting.groups` with `$initial` (Rolldown 1.x); `chunkSizeWarningLimit` 700 kB minified (the gate is the gzip budget)                                                                                                                    |
| `NumberField` (Base UI) for steppers                      | Own `Stepper`: one step is the next achievable load of the equipment, not a fixed step; typed decimals with a comma; M0's `ui/number-field.tsx` and `hooks/use-content.ts` were unused after `LogSetScreen` and are removed                     |

**Bugs fixed in M3a/M3t code (found by the screens):**

- **`PrematureCommitError` when finishing a planned session** (real IndexedDB only; M3a's
  application tests run on in-memory fakes). `createUnitOfWork` passed a plain arrow to
  `db.transaction`; Dexie keeps its transaction zone across native `await`s only for a scope
  function it recognises as `async`. After `persist` the `plan.complete` effect's
  `plannedSessions.get` ran outside the transaction, which committed early. Fix: `async` scope
  functions in `infrastructure/db/unit-of-work.ts`; regression test in `test/session.test.tsx`
  (component test on real IndexedDB).
- **Conditional `use()`** in the first `useTimerKit`: React warned "called use() to suspend … but
  did not call use() when it finished". Now `use(load())` always; the loader marks its promise
  `status: 'fulfilled'` so later renders read it without suspending.
- **Races in `test/alerts.test.tsx`** (M3t): UI assertions and second clicks right after a settings
  write, before the live query re-rendered; they now wait for the re-render. The announcement range
  accepts a slower first scheduler load.

### Evidence

`pnpm verify` green on 2026-11-25 (exit 0): lint (0 errors, 0 warnings), format, token gate (lowest
text 4.56, on fills 5.41, UI 3.88; 332 colour utilities in 163 files), knip, catalog check, typecheck,
**788 unit and component tests in 76 files**, build, licence gate (33 distributed, 841 build-only,
passed), size (**entry JS 177.34 kB gzip** of 186, was 182.73 at the M3a/M3t merge; CSS 6.3 kB;
service worker 8.07 kB; precache 104 files + sw.js, 575.6 kB; **startup path 1 script, 0 with Zod**)
and **55 E2E tests** (45 before).

- **Component tests** (Vitest browser mode, real IndexedDB): `test/session.test.tsx` (the effect
  runner with sound and vibration on and off; the stepper: 48 px targets, comma decimals, clamp at
  0; the timer ring; the logging card and dock: calibration prompt, chips, one confirm, the rest
  starting, focus back on "Confirm set", axe; the mini timer on another screen with the session
  clock and with a rest, axe; finishing a planned session on real IndexedDB), `test/summary.test.tsx`
  (PRs in words, e1RM change, sets, streak, axe), `test/past-sessions.test.tsx` (list, editor, PR
  preview before saving, backdated form with errors), `test/pseudo-locale.test.tsx` (+30% strings:
  start, check-in and logging with the dock fit 360 px), `test/alerts.test.tsx` (pre-alert timing),
  `alerts/scheduler.test.ts` (5 and 15 s pre-alerts), `session/search.test.ts` (`start=today`).
- **E2E** (`e2e/session.spec.ts`, `e2e/past-sessions.spec.ts`, helpers in `e2e/session.ts`): the
  planned session from Home in one tap → check-in → mini timer back to the workout → one-tap
  confirm → rest starts → PR card → "Rest over · +m:ss" (Playwright clock) → finish → summary with
  the PR; freestyle with set details (drop set) and the plate calculator; repeat of a 10-day-old
  workout with the return-from-break proposal; Settings → Workout (no check-in, count-up rest)
  reaching the session; substitution with ranked reasons; undo restoring set and timer; a superset
  with its transition; a reload mid-rest showing the right remaining time (±1 s) and the resume
  banner; the lower-60% and target-size assertion at 360 × 780; a backdated workout edited with
  the PR preview. axe (WCAG 2.2 A/AA, light and dark) on every new screen and sheet; reflow at
  320 px and 200% text on start, check-in, proposals, logging, summary, past sessions, the
  backdated form, the editor and Settings → Workout.
- **Existing specs moved to the new screen** (intent kept): `fixtures.ts` (`skipOnboarding` ends on
  "Start a workout"), `persistence`, `backup` (export/restore with an active workout, the edited
  backup rejected, offline export), `offline` (logging offline with the lazy chunks precached),
  `update-gate` (the gate holds during a workout and releases at finish), `shell`.

**Screenshots** (360 × 780, light and dark, `M2B_SCREENS=<dir>`; viewport shots while the dock is
fixed, whole page otherwise; `*-320px-200pct.png` for reflow): `session-start`, `session-check-in`,
`session-proposals`, `session-logging`, `session-resting-pr`, `session-rest-over`,
`session-resumed`, `session-mini-timer`, `session-empty`, `session-add-exercise`,
`session-set-details`, `session-exercise-options`, `session-swap`, `session-superset-transition`,
`session-summary`, `settings-workout`, `past-sessions-empty`, `past-sessions`, `log-past-workout`,
`past-session-editor`, `past-session-pr-preview`, `home` ("Start today's session"), `settings` (the
Workout card), `settings-alerts` (the pre-alert timing).

### Open items

- **S-1 on the S22** (TD-38, V-01) and a **manual TalkBack pass** of the session screens: the dock's
  reading order, the RIR legend with a half step, the announcements during a real rest (once each),
  focus after "Confirm set", the PR card.
- TD-39 (TMR-10 metronome), TD-48 (TMR-09 lead-in and auto-stop), TD-49 (the preference screens
  above), TD-14 ("Update first" before a session), TD-42 (alert settings use case), TD-43 (heat map,
  streak count, PR history), TD-13 (200 randomized kills).
- The add-exercise search and the planned-session names use the English content strings directly
  (content is English-only; the labels hook covers the rest).
- The proposals screen says "Based on your check-in and your recent training" also when the
  check-in was skipped and only return-from-break proposals exist.
- A developer device with an older version-2 database: clear the site data once (decision 4).

### Proposed PRD wording (not edited)

- **TMR-12:** "While a session runs, a compact timer stays visible on every screen of the app: the
  running rest or set timer, otherwise the session clock, with a one-tap return to the session."
- **WKT-03:** "RIR uses chips (0, 1, 2, 3, 4, 5+). A half-step value (for example a suggested 1.5)
  is shown with the chips' label; half steps are entered in the set details."
- **SET-03:** "pre-alert timing (5, 10 or 15 s; default 10 s)".
- From M3a, still open: MOT-01 rep PR ("more load than ever for at least that many reps"), RDY-01
  item scales, WKT-08 alternatives may leave the competition lift for the session, WKT-03
  plausibility numbers (3× e1RM, 100 reps) as product constants.

**Product-owner answers after M3b (2026-11-25):** the session screen is accepted as built (one
stepper per row with the label beside it, Undo as a dock button, the mini timer for the whole
session, the timer kit loading with the Train tab); TD-39 (metronome) and TD-48 (timed-set lead-in
and auto-stop) go to M4, TD-49 (the preference screens) to M5; PRD v0.6 carries the proposed
TMR-12, WKT-03 and SET-03 wording.

## M4a analytics core

Written 2026-11-25 by the M4a work (roadmap A.4 "M4 Insight and motivation", the part without UI:
the analytics core under the M4b screens; M4v builds the charts, the body map and the timer extras
in parallel). Status: `pnpm verify` green (numbers under "Evidence").

### What landed

| Area                             | Where                                                                                                                                                                                                                                                                                                                                                                                                                       | PRD (data and logic)                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Derived weeks and streak         | `@powr/domain/analytics` `buildWeek` (`dWeekly`), `@powr/domain/streaks` `computeStreak`, `countsForStreak`, `canMarkBreak`, `breakDaysIn`, `streakChange`; `@powr/application/insights` `ensureInsights`, `rebuildInsights` (fingerprint-and-rebuild like M3a; finish, past log/edit/delete schedule a rebuild of their week after their own commit)                                                                       | TD-43, MOT-03, MOT-04, ANL-03            |
| Volume against targets, heat map | `@powr/domain/analytics` `volumeRows` (per display group: fractional/direct, evidence band, target band and status, heat step 0–5, regions per view, sub-regions, contributors, planned remainder), `averageWeeks`, `muscleSeries`, `plannedRemainder`; insights `weeklyVolume`, `observeWeeklyVolume`, `volumeHistory`                                                                                                     | ANL-03, MAP-04, MAP-06 data, MAP-07 data |
| Trends                           | `@powr/domain/analytics` `e1rmSeries` (raw points, Kalman band, "likely real" labels per session with the rep-range flag, PR markers, weekly maxima beyond a year, summary), `compareSeries`, `chartAnnotations`, `performanceSeries`, `repsAtLoad`, `commonLoads`; `@powr/domain/trend` `repRangeShift`, `pointFromBand`, `median`, `labelChange(…, at)`; insights `exerciseTrend`, `compareTrends`, `exercisePerformance` | ANL-02, PRG-02, TD-26 (rep-range flag)   |
| PRG-07 switch                    | `@powr/domain/progression` `progressionPace`; the session engine (`suggestSet`) loads an outrun linear slot from the e1RM (or adds reps first without an RIR target), with the "Why?"; insights `progressionAdvice`                                                                                                                                                                                                         | PRG-07, TD-44                            |
| History                          | `@powr/domain/analytics` `repMaxTable`, `prHistory`, `calendarDays`, `filterSessions`; insights `exerciseHistory`, `prHistory`, `trainingCalendar`, `sessionHistory`                                                                                                                                                                                                                                                        | ANL-04, ANL-05, ANL-06                   |
| Scores                           | `@powr/domain/analytics` `scoreBoard` (current and best per formula, per lift, points history, version IDs, registry provenance); insights `scores`                                                                                                                                                                                                                                                                         | ANL-07                                   |
| Bodyweight and measurements      | `@powr/domain/bodyweight` `firstReadingPerDay`, `rateBand`, `measurementSeries`; insights `logBodyweight`, `editBodyweight`, `deleteBodyweight`, `bodyweightOverview`, `observeBodyweight`, `logMeasurement`, `editMeasurement`, `deleteMeasurement`, `measurementsOverview`                                                                                                                                                | BOD-01, BOD-02, BOD-03                   |
| Home                             | insights `observeHome` (one live query), `homeView`                                                                                                                                                                                                                                                                                                                                                                         | ANL-01, MOT-03                           |
| Motivation                       | streak and fairness (above); insights `streakView`, `markWeekAsBreak`, `updateInsightPreferences`, `sessionStreakChange` (celebration data); PR kinds unchanged (M3a)                                                                                                                                                                                                                                                       | MOT-01…04, MOT-10                        |
| Library                          | `@powr/domain/library` `searchLibrary`, `exerciseInfo`, `buildCustomExercise`, `customDraftFrom`, `fold`; `@powr/application/library` (below)                                                                                                                                                                                                                                                                               | EXL-02…05, EXL-07…09                     |
| Body map ranking and actions     | `@powr/domain/analytics` `muscleRanking` (Effectiveness = M2a MAP-03 composite, Focus), `regionsOf`; library `muscleExercises`, `bodyMapRegions`, `addExerciseToToday`, `planPlacements`                                                                                                                                                                                                                                    | MAP-02, MAP-03, MAP-05                   |
| Custom exercises in the catalog  | `@powr/content` `customizableCatalog`, `isCustomizable`; root `loadCustomExercises` (boot), restore re-syncs                                                                                                                                                                                                                                                                                                                | EXL-04                                   |
| Rules                            | registry 1.4.0 → **1.5.0**, 133 → **143** parameters, 34 → **38** `verified: false`; new table `motivation.yaml`; 8 new `RuleId`s with English `why.*` messages                                                                                                                                                                                                                                                             | PRG-18, PRG-09                           |
| Records                          | `records/v2.ts` amended (unreleased version 2): `customExercises`, `exerciseUserData`, `measurements`; `profile.hiddenExercises?`; `settings.insights?`; reference checks; fixture `v2/m4-insights.zip`                                                                                                                                                                                                                     | DAT-05…07, NFR-SEC-02                    |
| Persistence                      | Dexie version 2 amended: stores `customExercises 'id, status'`, `exerciseUserData 'exerciseId'`, `measurements 'id, [site+localDate], localDate, measuredAt.epochMs'`, `dWeekly 'weekStart'`, `dStreak 'id'`, index `dSessionE1rm.localDate`; repositories; `LiveQueries.observe(tables, read)`                                                                                                                             | §8.2.2                                   |
| Lint                             | `LAZY_INSIGHTS` in `oxlint.config.ts`: `@powr/application/insights` and `/library` are `import()`-only in the app                                                                                                                                                                                                                                                                                                           | §8.19                                    |

Engine version 0.0.0 → **0.1.0** (`ENGINE_VERSION`): the PRG-07 switch changes suggestions, and the
derived exercise state gained `recent` (the last 12 exposures: session e1RM, weight, top load,
median reps) and each `dSessionE1rm` point a `change` (the strength trend's PRG-02 label at that
session, with the rep-range flag). The version is part of every derivation key, so stored states
rebuild on first use.

### Application API for M4b

All take the container's `deps`; expected failures are `Result`s; `observe*` are live queries built
on `LiveQueries.observe` (a Dexie `liveQuery` over one read transaction), emitting in order. Both
entries are lazy (`LAZY_INSIGHTS`): M4b's loaders carry the one disable comment each, like
`usePlanning`/`useWorkout`.

**`@powr/application/insights`**

| Use case                                                                                                             | Returns                                          | Notes                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `observeHome(deps)`, `homeView(deps)`                                                                                | `HomeView`                                       | ANL-01; `refreshing: true` while stale weeks or the streak rebuild in the background (the next emission is fresh)                  |
| `weeklyVolume(deps, { mode?: 'week' \| 'lastWeek' \| 'avg4', date? })`, `observeWeeklyVolume`                        | `WeeklyVolumeView`                               | ANL-03 table, MAP-04 heat map and list (MAP-06), MAP-07 sub-regions; rebuilds stale weeks first                                    |
| `volumeHistory(deps, { from, to?, muscles? })`                                                                       | `{ weeks, series: { muscle, points }[] }`        | ANL-03 chart: `MuscleSeriesPoint { weekStart, fractional, direct, target }`                                                        |
| `exerciseTrend(deps, { exerciseId, range?: '4w' \| '12w' \| '6m' \| '1y' \| 'all', source?: 'strength' \| 'all' })`  | `ExerciseTrendView`                              | ANL-02 chart data, annotations, PRG-07 pace                                                                                        |
| `compareTrends(deps, { exerciseIds (≤ 3), range?, source? })`                                                        | `{ exerciseId, points: { localDate, pct }[] }[]` | ANL-02 comparison (% change from the first point in range)                                                                         |
| `exercisePerformance(deps, { exerciseId, range?, loadKg? })`                                                         | `PerformanceView`                                | best set, volume load, reps at a load (default: the most used load), `loads` to choose from                                        |
| `progressionAdvice(deps)`                                                                                            | `ProgressionAdvice[]`                            | TD-44: linear slots of the current mesocycle whose planned increases outrun the trend (for the plan editor)                        |
| `exerciseHistory(deps, exerciseId)`                                                                                  | `ExerciseHistoryView \| null`                    | ANL-04: sessions newest first with sets, `repMax` (12 rows), bests, e1RM (strength/all, band), calibration, training max, PRs      |
| `prHistory(deps, { types?, exerciseIds?, from?, to? })`                                                              | `PrRecord[]` newest first                        | ANL-05; each PR names `sessionId` and `setId`                                                                                      |
| `trainingCalendar(deps, { month: 'YYYY-MM' } \| { from, to })`                                                       | `CalendarDay[]`                                  | ANL-06: `states` ⊆ completed, partial, missed, planned, deload, break; sessions and planned sessions per day                       |
| `sessionHistory(deps, { query?, exerciseIds?, statuses?, origins?, from?, to?, withPrs? })`                          | `SessionListItem[]` newest first                 | ANL-06 list; the query matches exercise names and notes, accents ignored                                                           |
| `streakView(deps, { weeks? })`                                                                                       | `StreakView`                                     | MOT-03/04: current, best, this week, the last weeks with "Why?", `markableWeeks`, preferences                                      |
| `markWeekAsBreak(deps, { weekStart, reason, note? })`                                                                | `Result<TrainingBreak, MarkBreakError>`          | MOT-04 (≤ 4 weeks back; `tooFarBack`, `future`, `alreadyBreak`); pauses the week's open planned sessions                           |
| `updateInsightPreferences(deps, { streakGrace?, weeklySessionTarget?, measurementSites?, scoreSource?, division? })` | `Result<void, …>`                                | settings `insights`                                                                                                                |
| `sessionStreakChange(deps, sessionId)`                                                                               | `StreakChange \| null`                           | MOT-02/03 celebration data for the summary: `{ kept, current, best, newBest }`, independent of whether the post-finish rebuild ran |
| `scores(deps, { source?, division? })`                                                                               | `ScoreBoardView`                                 | ANL-07 (below)                                                                                                                     |
| `logBodyweight`, `editBodyweight`, `deleteBodyweight`                                                                | `Result<BodyweightEntry \| void, …>`             | BOD-01 (20–400 kg plausible, not in the future)                                                                                    |
| `bodyweightOverview(deps, { from? })`, `observeBodyweight`                                                           | `BodyweightView`                                 | BOD-02: entries, trend points, latest, `rate`, `band` (with "Why?")                                                                |
| `logMeasurement`, `editMeasurement`, `deleteMeasurement`, `measurementsOverview`                                     | …, `MeasurementsView`                            | BOD-03: skinfolds in mm, circumferences in cm or in                                                                                |
| `ensureInsights(deps, range?)`, `rebuildInsights(deps)`                                                              | `InsightsReport`                                 | "Verify data" and tests; runs serialized per container                                                                             |

**`@powr/application/library`**

| Use case                                                                                                                                      | Returns                                     | Notes                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `searchExercises(deps, LibraryQuery)`                                                                                                         | `LibraryItem[]`                             | EXL-02: `text`, `muscles` (+`minCredit`), `equipment`, `patterns`, `mechanics`, `availableOnly`, `favouritesOnly`, `customOnly`, `includeHidden`             |
| `exerciseDetail(deps, exerciseId)`                                                                                                            | `ExerciseDetailView \| null`                | EXL-03: `info` (muscles with role, evidence, convention flag; equipment with what is missing; lift, variants, substitutes; marks), rest, history, PRs, setup |
| `muscleExercises(deps, { muscle, mode?: 'effectiveness' \| 'focus', includeUnavailable? })`                                                   | `RankedExercise[]`                          | MAP-02/03 (shape below)                                                                                                                                      |
| `bodyMapRegions(deps)`                                                                                                                        | `{ front, back: { muscle, region }[] }`     | MAP-01, MAP-06                                                                                                                                               |
| `addExerciseToToday(deps, exerciseId)`                                                                                                        | `Result<AddToTodayOutcome, …>`              | MAP-05: `addedToSession` (active session, `ADD_EXERCISE`), `addedToPlanned` (today's planned session), `noSessionToday` (offer a freestyle start)            |
| `planPlacements(deps, { exerciseId, muscle? })`                                                                                               | `{ planId, days: PlanPlacement[] } \| null` | MAP-05 → PLN-09: per day `swaps[].edit` and `add` are `PlanEdit`s for the planning entry's `previewPlanEdit`/`savePlanEdit`                                  |
| `customExerciseDraft(deps, from?)`, `saveCustomExercise(deps, { id?, exercise, copiedFrom? })`, `deleteCustomExercise`, `listCustomExercises` | …                                           | EXL-04: `invalid` lists every `CustomExerciseIssue`; delete retires (`deprecated`) one with history or in a plan                                             |
| `setFavourite`, `setHidden`, `setAvoided` (exercise or pattern)                                                                               | `Result<Profile, …>`                        | EXL-08 (profile, as M2)                                                                                                                                      |
| `exerciseUserData`, `exerciseUserDataFor`, `saveExerciseUserData(deps, { exerciseId, setup, note?, trainingMax? })`                           | `ExerciseUserData \| null`                  | EXL-09 setup memory (fields `seat`, `backrest`, `pin`, `handle`, `grip`, `stance`, `rack`, `safeties`, `other` with a label), ANL-04 training max            |
| `observeSessionSetups(deps)` (also re-exported by `@powr/application/session`)                                                                | `Map<ExerciseId, ExerciseUserData>`         | EXL-09 "shown whenever the exercise appears in a session"                                                                                                    |

**Data shapes the charts and the body map need** (M4v components, M4b screens):

```ts
// e1RM chart (ANL-02): ExerciseTrendView.series
interface E1rmSeries {
  exerciseId; source: 'strength' | 'all';
  points: E1rmSeriesPoint[];          // sessions, or weekly maxima when `aggregated`
  aggregated: boolean;                // range > 365 days (§8.10)
  latest: Explained<ChangeLabel> | null;   // the current label with its "Why?"
  summary: { fromDate, toDate, fromKg, toKg, deltaPct, weeks, label, direction }; // the aria sentence
}
interface E1rmSeriesPoint {
  sessionId; localDate;
  rawKg: number | null; weight: number | null;           // scatter points
  trend: { e1rmKg; lowKg; highKg } | null;               // line + 95% band (stacked area pair)
  change: { label: 'insufficientData'|'none'|'likely'|'veryLikely'; direction: 'up'|'down'|null;
            deltaPct; referenceDate; repRange: boolean } | null;  // "likely real" marks
  prs: ('rep'|'load'|'e1rm'|'volume')[];                 // PR symbols
}
annotations: { kind: 'mesocycle'|'deload'|'break'; from; to; index }[]   // markAreas
// Performance: { points: { sessionId, localDate, bestSet: { loadKg, reps, rir, e1rmKg } | null,
//   volumeKg, topLoadKg, workingSets }[], loads: number[], repsAtLoad: { loadKg, points: { sessionId, localDate, reps }[] } | null }

// Volume and the body map (ANL-03, MAP-04/06/07): WeeklyVolumeView
interface WeeklyVolumeView {
  mode; weekStart; weeks: LocalDate[];
  rows: MuscleWeekRow[];                          // one per display group, taxonomy order (19)
  regions: { front: { muscle, region }[]; back: { muscle, region }[] };
  lifts: { lift; heavySets; sets; tonnageKg; target: number | null }[];
  sessions: { finished; partial; counting; minutes; ids } | null; targets;
}
interface MuscleWeekRow {
  muscle: MuscleId;                               // 'mu.chest' (content IDs)
  regions: { front?: 'front.chest'; back?: string };   // body-map region per view
  fractional; direct;
  band: 'belowFloor'|'low'|'default'|'high'|'softWarning'|'hardWarning';   // evidence band
  heat: 0|1|2|3|4|5;                              // --heat-0…5: none, below floor, below target,
  heatLabel: 'none'|'belowFloor'|'belowTarget'|'inTarget'|'high'|'veryHigh'; //   in target, high, very high
  status: 'under'|'in'|'over'; target: { low; high; sets: number | null; source };
  targeted: boolean;                              // the plan has a target for it
  remaining: { fractional; direct };              // planned remainder (dashed outline overlay)
  subRegions: { muscle; fractional; direct; regions; contributors }[];  // MAP-07
  contributors: { exerciseId; sets; credit; fractional }[];             // "contributing exercises"
  why: Explanation;                               // 'volume.target'
}

// Muscle → exercises (MAP-02/03): RankedExercise
{ exerciseId; rank; credit; role: 'primary'|'secondary'|'minor'; evidence: 'H'|'EMG'|'C'|null;
  effectiveness: Explained<number>  /* children: ranking.factor.* */; focus: Explained<number>;
  available; missing: { allOf: EquipmentId[]; anyOf: EquipmentId[][] } | null;
  favourite; custom; last: ExposureSummary | null }

// Scores (ANL-07): ScoreBoardView
{ available; missing: ('sex'|'bodyweight'|'lifts')[]; source: 'e1rm'|'tested'; division;
  bodyweightKg; totalKg; lifts: { lift; exerciseId; kg }[]; rulesVersion;
  formulas: { formula; version /* 'ipf-gl-2020', 'dots-2019', 'ipf-points-2019', 'wilks-original',
              'wilks-2020', 'allometric-0.67' */; legacy; total; best: { value, localDate, totalKg,
              bodyweightKg } | null; lifts: { lift, value, informal }[]; sources; verified; params; why }[];
  history: { localDate; totalKg; bodyweightKg; scores: Record<formula, number | null> }[] }

// Home (ANL-01): HomeView
{ today; weekStart; activeSession; next: { plannedSessionId, name, localDate, kind, adjustments,
  isToday } | null; restDay; lastSession: { sessionId, localDate, status, durationMs, doneSets,
  exerciseIds, prs } | null; week: { progress: StreakWeek | null /* "2 of 4" */, volume:
  MuscleWeekRow[] /* mini heat map */, minutes }; streak: { current, best } | null; recentPrs;
  trendChanges: { exerciseId, localDate, sessionId, change, e1rmKg }[]; bodyweight: { latestKg,
  trendKg, latestDate, sparkline: { localDate, trendKg }[], rate, band } | null; meet: { date,
  daysUntil } | null; scores: ScoreBoard | null; lastBackupAt; refreshing }
```

### The derived tables (TD-43) as built

- **`dWeekly`** holds one record per user week (SET-11 week start) that has a finished or partial
  session or a planned session. A session belongs to the week of its own day (a session past
  midnight stays whole), so the week's volume is exactly the sum of its sessions' (property
  test). The record: muscles (groups and sub-regions, fractional and direct), exercises (credited
  sets, working sets, volume load), lifts (PLN-03 heavy sets, sets, tonnage; close variants
  included, EXL-07), sessions (finished, partial, counting, minutes, IDs), planned sessions by
  status and the deload flag, break days, and the plan targets in force. Its `key` fingerprints
  the engine, analytics, rules and content versions (custom exercises included), the overrides,
  the week start, the targets, the break days and every raw record of the week (session and
  planned-session IDs, statuses and revisions; every edit bumps a revision).
- **`dStreak`** holds the streak plus each recorded week's contribution, so a changed week
  updates it without reading the others; its key adds the current week, the grace, the weekly
  target and the breaks. Without a stored streak (restore, cleared tables) `ensureInsights`
  rebuilds the whole history.
- **Triggers:** finish (`dispatch(FINISH)`), `logPastSession`, `editPastSession` and
  `deletePastSession` schedule a rebuild of their week after their own commit and do not wait for
  it (logging never blocks); a restore clears the derived tables; Home and every insight query
  check the fingerprints of the weeks they show and rebuild what is stale (Home: this and last
  week plus the streak, in the background, `refreshing: true`); M0's quick-log finish is caught
  the same way. Rebuilds run one at a time per container.
- **Property (fast-check):** after any sequence of backdated logging, quick-log finishes, edits,
  deletes, clock moves, retroactive breaks, partial ensures and backup round trips, the derived
  tables equal a full rebuild.

### Streak rules as built (MOT-03/04)

| Case                                                    | Rule                                                                                                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kept                                                    | counting sessions ≥ the week's target; sessions on unscheduled days count; a partial session counts at ≥ 50% of its planned working sets (`motivation.streak.partialMinShare`)               |
| Target                                                  | the plan's sessions that week (planned, done or skipped; not merged, not paused by a break); without plan sessions the freestyle weekly target, else **1** (`defaultWeeklyTarget`)           |
| Deload weeks                                            | count with their planned sessions                                                                                                                                                            |
| Grace (A-07, off by default)                            | one session short still keeps a week (`graced`), never a week without a session                                                                                                              |
| Breaks (PLN-12; illness, vacation/travel, injury, life) | a week fully inside a break, or whose plan sessions were all paused, is `paused`: it neither keeps nor breaks the streak                                                                     |
| Partial weeks                                           | plan weeks ask only for the sessions outside the break; freestyle weeks ask for ⌊target × free days / 7⌋ (0 → paused); the first week asks for its share from the first activity, at least 1 |
| Missed                                                  | resets the current streak to 0; the best stays                                                                                                                                               |
| Current week                                            | `pending` until kept: it can only add to the streak                                                                                                                                          |
| Retroactive breaks (MOT-04)                             | `markWeekAsBreak`, at most 4 weeks back (`retroactiveBreakWeeks`); edits and backdating recompute                                                                                            |
| Properties                                              | best ≥ current; more sessions never lower it; a break on a missed or pending week never lowers it; the grace never lowers it; the current week is never `missed`; input order irrelevant     |

### Decisions and deviations

| Concept / brief says                                                                    | What I did                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Never claim a change that is within the noise"                                         | `labelChange` now requires \|Δ\| > 1 TE for any claim: "very likely" (2.8 TE, or the 95% interval excluding 0) only upgrades a change already beyond 1 TE. Before, the interval alone could label a change below 1 TE "very likely". Property-tested over random series                                                                                                                                                                                                                       |
| Rep-range artefact flag (PRG-02, TD-26)                                                 | `load.trend.repRangeShift` (3 reps, `verified: false`): a likely/very likely change is flagged when the median reps of the latest two sessions differ from those of the up to three sessions at the reference by ≥ 3. The personal curve fit and the correction factor stay open (TD-26)                                                                                                                                                                                                      |
| PRG-07 "switch to rep/RPE progression when planned increases outrun the observed trend" | `progressionPace` [INF]: over 4 weeks (≥ 4 exposures spanning half of it), the planned weekly increase (novice increment × sessions a week relative to the load; intermediate %/week; advanced: none) must exceed the one-sided 95% upper bound of the weighted log-linear e1RM slope AND the gap over the window must exceed one TE. Then a linear slot loads from the e1RM at its reps and RIR (RPE), or keeps the load and adds a rep without an RIR target. The "Why?" names both numbers |
| Heavy sets (PLN-03 "≥ 80% 1RM, 1–6 reps")                                               | `volume.strength.heavySet` {80, 6}: a hard set of ≤ 6 reps whose reps + RIR imply ≥ 80% on the exercise's curve (unknown effort: the prior RIR 2). The plan's heavy sets (M2a) remain the plan-time count                                                                                                                                                                                                                                                                                     |
| Target band for status and heat (MAP-04 "relative to the user's target band")           | low = the plan's weekly target of the muscle (else 10), high = max(20, target); `status` under/in/over against it; heat 1 below the floor (4), 2 below the band, 3 in it, 4 up to 30, 5 above. A muscle the plan has no target for shows `targeted: false` against the default band                                                                                                                                                                                                           |
| BOD-01 "the morning/first value is used for the trend"                                  | `firstReadingPerDay` before the EMA, in the insights and in the session engine's bodyweight trend (M1 averaged a day's readings). The derivation key now fingerprints every entry, since entries can be edited                                                                                                                                                                                                                                                                                |
| BOD-02 "the weekly rate with its band"                                                  | `bodyweight.rate.bulk` (by level, EB), `.cut` (EB), `.maintain` ±0.25 %/week (`verified: false`); `fastLoss`/`fastGain` only when sustained (2 / 3 weekly rates), never from one day                                                                                                                                                                                                                                                                                                          |
| ANL-07 "tested 1RMs"                                                                    | the heaviest load lifted for at least one rep (the rep-max table's first row); the history from load PRs. e1RM source: the strength trend's current value, the best of a lift's competition exercises (conventional or sumo)                                                                                                                                                                                                                                                                  |
| "Show the source and version of each formula"                                           | a version ID per formula (`ipf-gl-2020`, …) plus the registry rows' sources and `verified` flags and the rules version; no new rows (the M1 coefficients)                                                                                                                                                                                                                                                                                                                                     |
| EXL-04 custom exercises "behave like built-in ones"                                     | `customizableCatalog` merges them into `deps.content`; its version gains `+cx.<fnv8>` while any exist, so derived data and resolved rules follow edits; the boot loads them before the first screen, a restore re-syncs. Credits are `C` with `src.powr-user-defined`; MAP-03 treats them as unrated unless `userRated` (then stretch, overload and sub-region count)                                                                                                                         |
| `exerciseUserData` (§8.2.2: flags, setup notes, rest override, last note)               | holds the setup memory and the training max only; favourites, hidden and avoided stay in the profile (as M2 decided; `profile.hiddenExercises` added); the rest override stays a parameter override (M3a)                                                                                                                                                                                                                                                                                     |
| `@powr/domain/charts` (§8.10), `planning.rankExercises` (§8.11)                         | the chart data preparation and the body-map ranking live in `@powr/domain/analytics` (`e1rmSeries`, `muscleRanking`, reusing `effectiveness`)                                                                                                                                                                                                                                                                                                                                                 |
| Day arithmetic (Temporal)                                                               | `addDays`, `daysBetween`, `weekStartOf` use integer arithmetic (days-from-civil) with the same results (property test against Temporal over 1900–2199); the five-year rebuild calls them ~10⁶ times                                                                                                                                                                                                                                                                                           |
| The session summary's "counts for the streak"                                           | reads `motivation.streak.partialMinShare` (same 50%)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| No `features/**`                                                                        | Only `features/why/{messages,args}.ts` and the catalogs: the 8 new rules need English messages for the PRG-09 coverage test (as M3a did); no screen changed                                                                                                                                                                                                                                                                                                                                   |
| Composition root                                                                        | `app/container.ts` wraps the content in `customizableCatalog`; `app/boot.tsx` calls `loadCustomExercises` after the runtime-flag reconcile                                                                                                                                                                                                                                                                                                                                                    |
| Application test fakes                                                                  | writes of the in-memory unit of work run one after another (the scheduled insight rebuild runs concurrently with the next use case; IndexedDB queues such transactions too)                                                                                                                                                                                                                                                                                                                   |

### Evidence for the new parameters (rules 1.4.0 → 1.5.0: 133 → 143 parameters, 34 → 38 `verified: false`)

| Parameter                                 | Value                                                                    | Evidence and sources                                                                       | Verified | Why                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `bodyweight.rate.bulk`                    | novice and intermediate 0.25–0.5, advanced 0.1–0.25 %/week; 3 weeks      | [NARR, RCT-T, INF] `src.iraki2019` (new), `src.powr-eb-nutrition`                          | true     | EB §Nutrition › Bulking (Iraki 2019; warn above the band for ≥ 3 weeks)                             |
| `bodyweight.rate.cut`                     | target 0.5–0.7, allowed 0.25–1.0 %/week; hard warning > 1.0% for 2 weeks | [NARR, RCT] `src.helms2014` (new), `src.garthe2011` (new), `src.powr-eb-nutrition`         | true     | EB §Nutrition › Cutting, §Defaults › Nutrition                                                      |
| `bodyweight.rate.maintain`                | −0.25 to +0.25 %/week                                                    | [INF] `src.powr-eb-nutrition`                                                              | false    | POWR design value: the EB has no maintenance band                                                   |
| `motivation.streak.partialMinShare`       | 0.5                                                                      | [INF] `src.powr-prd`                                                                       | true     | PRD MOT-03                                                                                          |
| `motivation.streak.graceSessions`         | 1                                                                        | [INF] `src.powr-prd`                                                                       | true     | PRD MOT-03, A-07                                                                                    |
| `motivation.streak.retroactiveBreakWeeks` | 4                                                                        | [INF] `src.powr-prd`                                                                       | true     | PRD MOT-04                                                                                          |
| `motivation.streak.defaultWeeklyTarget`   | 1                                                                        | [INF] `src.powr-prd`                                                                       | false    | POWR design value for weeks without plan sessions before the user sets a target                     |
| `progression.pace.window`                 | 4 weeks, ≥ 4 exposures                                                   | [INF] `src.hopkins2000`, `src.grgic2020`, `src.mcmaster2013`, `src.powr-technical-concept` | false    | PRD PRG-07; the 1-TE gap ties it to PRG-02's "likely real" threshold; the window is a design value  |
| `load.trend.repRangeShift`                | 3 reps                                                                   | [OBS, INF] `src.braith1993`, `src.mayhew2008`, `src.powr-eb-load`                          | false    | EB §Load › e1RM drift: flag jumps that coincide with a rep-range change; the size is a design value |
| `volume.strength.heavySet`                | ≥ 80% 1RM, ≤ 6 reps                                                      | [MA, POS] `src.acsm2026`, `src.androulakiskorakakis2021`, `src.powr-prd`                   | true     | PRD PLN-03, EB §Defaults › Volume                                                                   |

New sources: `src.iraki2019`, `src.helms2014`, `src.garthe2011` (`data/sources/bodyweight.yaml`)
and `src.powr-user-defined` (`exercise-mapping.yaml`, the source of custom credits). New
`RuleId`s: `streak.week`, `streak.current`, `volume.target`, `trend.change.repRange`,
`progression.pace.switch`, `progression.pace.ok`, `bodyweight.rate.band`, `ranking.focus` (with a
plain-language variant).

### Evidence

`pnpm verify` green on 2026-11-25 (exit 0): lint (0 errors, 0 warnings), format, token gate,
knip, catalog check, typecheck, **888 unit and component tests in 82 files** (788 in 76 before;
100 new: domain 59, formats 16, application 22, web 3), build, licence gate (33 distributed, 841
build-only, passed), size (**entry JS 178.44 kB gzip** of 186, was 177.34: the Dexie stores and
repositories of the new tables, `LiveQueries.observe`, the custom-exercise catalog and its boot
load; the insight and library use cases are lazy entries no screen imports yet; CSS 6.3 kB;
service worker 8.08 kB; precache 104 files + sw.js, 584.6 kB; **startup path 1 script, 0 with
Zod**) and **55 E2E tests** (unchanged; the screens are M4b).

- **Domain** (`packages/domain/test/analytics/`): `streaks.test.ts` (every MOT-03/04 rule, then
  fast-check: best ≥ current and the current streak counts the kept weeks since the last miss,
  more sessions never lower it, a break never lowers it, the grace never lowers it, the current
  week never breaks it, input order irrelevant), `weekly.test.ts` (the EB worked example 5 curls +
  5 rows = 7.5 fractional / 5 direct biceps sets, a drop set with 2 drops = 2 sets, PLN-03 heavy
  sets: 5 @ RIR 2 is heavy (Wathan 80.6%), 6 without effort is not (78.3%), tonnage with a close
  variant, sessions and minutes, planned statuses, break days; fast-check: the week equals the sum
  of its sets' credits; heat steps, target bands, sub-regions, contributors, the planned
  remainder; the day arithmetic equals Temporal over 1900–2199), `insights.test.ts` (no change
  claimed for a flat series, a sustained rise "likely real" beyond 3.3% and a step "very likely"
  beyond 2.8 × 3.3%; fast-check: every claim is beyond one TE; the rep-range flag; chart data,
  weekly maxima, comparison, annotations, performance; PRG-07 switch and no switch; the rep-max
  table (100 kg × 5 @ RIR 2 → 124.0 kg e1RM); PR filters; calendar states; accent-insensitive
  search; the EB scoring table: male 83 kg / 700 kg → Wilks 467.25, Wilks2020 561.15, DOTS 472.56,
  GL 96.90, allometric 36.25; female 63 kg / 400 kg → 429.58, 511.45, 430.21, 87.51), `library.test.ts`
  (search relevance and filters, detail, the MAP-02 example "biceps with dumbbells and a bench:
  curls above rows", Focus, custom exercises unrated unless rated, custom-exercise validation,
  BOD-02 bands and sustained warnings, first reading per day, measurement units).
- **Application** (`test/m4a.test.ts`): the week after a finished planned workout equals the
  session summary's volume (one calculation); edits, deletes, backdating and the quick log;
  **fast-check: the derived tables equal a full rebuild after any sequence of operations**; Home
  (next, last, week, streak, bodyweight band, scores) and its live updates; volume rows with
  regions and targets; the live weekly volume and the volume series; library search, marks,
  detail with setup memory, the MAP-02 ranking on the real content, custom exercises through a
  restore and their retirement, "add to today" in all three cases, plan placements the plan editor
  accepts, live setup memory; the streak with a retroactive break and the celebration data;
  trends, comparison, performance, history, calendar and session list; scores from e1RMs and from
  tested loads; bodyweight and measurements.
- **Formats:** hostile keys in the new tables and in `settings.insights` are rejected; `cx.` IDs
  resolve only through the backup's own custom exercises; strict schemas (a skinfold in cm, an
  unknown site or setup field, a non-custom or `ex.` custom record); the new fixture
  `v2/m4-insights.zip` round-trips; the v1 and M3a v2 fixtures still import (their new tables empty).
- **Web** (`db.test.ts`): the new stores, the day-range queries of points and PRs, `dWeekly` and
  `dStreak` (cleared by a restore), and `LiveQueries.observe` re-running after a write.

**Five-year history** (`packages/application/test/perf.test.ts`; 260 weeks × 4 sessions × 6
exercises × 6 sets = 1,040 sessions, **37,440 sets**, the concept's reference size; dev machine,
Node 26; `POWR_PERF=1` prints them):

| Step (one-off full rebuild unless noted)                                       | Time     |
| ------------------------------------------------------------------------------ | -------- |
| Pure engine: `dExerciseState` + `dSessionE1rm` + `dPrs`, all 22 exercises      | 1,063 ms |
| Pure engine: `dWeekly`, 260 weeks                                              | 37 ms    |
| Pure engine: `dStreak`                                                         | 1 ms     |
| Pure engine: e1RM series of the most trained lift, all history (weekly maxima) | 4 ms     |
| Pure engine: volume rows of one week (19 groups)                               | 1 ms     |
| Application (fake): `ensureDerived`, all exercises                             | 1,362 ms |
| Application (fake): `ensureInsights`, full history                             | 1,361 ms |
| Application (fake): `ensureInsights` when everything is fresh                  | 531 ms   |
| Application (fake): Home view                                                  | 183 ms   |
| Application (fake): weekly volume                                              | 963 ms   |
| Application (fake): squat trend, all history                                   | 528 ms   |

The application timings run on the in-memory fake, which copies the whole database (all 37,440
sets) on every read and write, so they overstate IndexedDB's cost for the small indexed reads
Home makes (this and last week's records, the streak record, the last session, 28 days of PRs and
e1RM points, the bodyweight log). The S22 measurement belongs to the device tests (S-4 for the
charts; NFR-PERF-01/06).

### Open items

- **For M4b:** the screens and their two loaders (one disable comment each); English texts for
  week states, heat labels, statuses, formula versions and measurement sites (the "Why?" texts
  exist); "Verify data" can call `rebuildInsights`; run `ensureInsights()` once in idle time after
  start (it catches planned-session changes older than the four weeks Home checks); the session
  screen shows `observeSessionSetups`; the summary can show `sessionStreakChange`.
- **For M4v:** the body map consumes `MuscleWeekRow.heat` (0–5), `heatLabel`, `remaining`
  (outline overlay) and the `regions` per view; the charts consume `E1rmSeries`, the annotations,
  `PerformanceView` and `muscleSeries`.
- **Product owner:** (1) a _skipped_ planned session still counts as asked for in the streak
  (merging it keeps the week; grace covers one); (2) the four new `verified: false` values above;
  (3) the strength trend seemed slow (intermediate process noise 1%/week); **corrected by the
  calibration below:** a steady +3% a week already read "likely real" at about 4.6 weeks (the
  "8 weeks" was the fixture length); the real gap was slow gains (+0.5%/week never labelled); (4) whether a
  custom exercise may be a competition lift's variant for the heavy-set count (now: yes, through
  `variantOf`).
- **Later:** the personal curve fit and correction factor (TD-26); rebuilds in the engine worker
  (TD-32); per-lift reactive-deload signals from `dSessionE1rm` (TD-43 remainder); RDY-03
  high-stress spacing (TD-45); baselines to variants (TD-47); ANL-08 percentiles (v1.1).

### Doc amendments for the docs pass

- **§5.4:** rows `analytics` (`@powr/domain/analytics`: derived week, volume rows and heat steps,
  trends, history, scores, body-map ranking; ANL-01…07, MAP-02…04/07, TD-43), `streaks` (built:
  MOT-03/04), `library` (`@powr/domain/library`: EXL-02/03/04); `trend` gains the rep-range flag;
  `progression` gains the PRG-07 pace check.
- **§5.5:** ports `CustomExerciseRepo`, `ExerciseUserDataRepo`, `MeasurementRepo`, `InsightsRepo`
  (`weeks`, `putWeeks`, `deleteWeeks`, `streak`, `putStreak`), `PlanRepo.list`,
  `BodyweightRepo.get/delete`, `DerivedRepo.prsInRange/pointsInRange`, `LiveQueries.observe`;
  `TableName` includes `dWeekly`, `dStreak`; `ContentCatalog` merged through
  `customizableCatalog` (version `+cx.<hash>`).
- **§8.2.2:** M4a state of version 2 (amended): the three raw tables, the two derived tables, the
  `dSessionE1rm.localDate` index, `profile.hiddenExercises`, `settings.insights`; `dWeekly` keyed by
  `weekStart`, `dStreak` by `'me'` (as planned); the `exerciseUserData` contents as built.
- **§8.2.8:** the `dWeekly`/`dStreak` fingerprints and triggers above; Home's background rebuild.
- **§8.3:** fixture `v2/m4-insights.zip`; custom `cx.` IDs resolve through the backup's own
  `customExercises`.
- **§8.7.5:** the change-label rule (1 TE for any claim) and the rep-range flag;
  `ExerciseState.recent`, the per-point `change`.
- **§8.7 (new §8.7.12 "Insight as built in M4a"):** PRG-07 pace, heavy sets, the target band and
  heat steps, the streak table, ENGINE_VERSION 0.1.0, rules 1.5.0.
- **§8.10:** data preparation is `@powr/domain/analytics` (`e1rmSeries`, `weeklyMaxima`,
  `compareSeries`, `chartAnnotations`, `performanceSeries`); the summary sentence's data.
- **§8.11:** heat steps 0–5 against the target band (definition above); ranking is
  `muscleRanking` (Effectiveness and Focus) in `@powr/domain/analytics`.
- **§11.2:** TD-43 closed for `dWeekly`, `dStreak` and the PR history data (per-lift
  reactive-deload signals remain); TD-44 closed; TD-26 narrowed (rep-range flag built).
- **PRD:** MOT-03 "without a plan or a weekly target, one session keeps the week"; MOT-04 "a
  skipped planned session counts as missed; merging keeps the week"; BOD-01 first reading
  (already the PRD's rule; the engine now follows it); BOD-02 maintenance band ±0.25 %/week;
  ANL-04 training max is a per-exercise user value; ANL-07 "tested" = heaviest load for ≥ 1 rep.

## M4v charts, body map and timer extras

Written 2026-11-25 by the M4v work (roadmap A.4 "M4 Insight and motivation", the visual building
blocks; spikes S-4 and S-5; TD-39 and TD-48), in parallel with M4a (the analytics core). The
charts and the body map take plain props and appear only on two debug demo routes so far; M4b
connects them to M4a's data. Status: `pnpm verify` green (numbers under "Evidence").

### What landed

| Area                           | Where                                                                                                                                                                                                                                                                                                                 | PRD / concept                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| ECharts, modular and lazy      | `src/ui/charts/echarts-runtime.ts`, the only runtime import of ECharts (line, scatter and bar charts, `GridSimpleComponent`, the inside data zoom, mark line and mark area, the canvas renderer), loaded with `import()` by `echart.tsx`: its own chunk, precached                                                    | §8.10, TC-08                 |
| Chart wrapper                  | `src/ui/charts/echart.tsx` (`EChart`: init, `ResizeObserver`, `setOption` with a merged overlay for the window and the selection, dispose, a tap → the x value, a pinch or pan → the window, performance measures)                                                                                                    | §8.10, §8.19                 |
| Shared chart frame             | `time-chart.tsx` (`TimeChart`, `timeOption`), `parts.tsx` (legend swatches, `DataTable`), `range.ts` (presets, Earlier/Later), `theme.ts` (`useChartTheme`: the tokens resolved at runtime in both themes, the root font size, reduced motion)                                                                        | ANL-11, NFR-A11Y-05/06/08/10 |
| e1RM trend                     | `trend-chart.tsx` (`TrendChart`: session points, trend line, 95% band with dashed edges, PR stars, likely and very likely real diamonds with the newest one labelled, shaded annotations, up to 3 compared series)                                                                                                    | ANL-02, PRG-02, MOT-01       |
| Volume against target          | `volume-chart.tsx` (`VolumeChart`: weekly bars in the heat-map band colours, hatched below the floor and cross-hatched when very high, direct sets as a dash, the target band)                                                                                                                                        | ANL-03, MAP-04               |
| Bodyweight                     | `bodyweight-chart.tsx` (`BodyweightChart`: the trend prominent, weigh-ins small and hollow)                                                                                                                                                                                                                           | BOD-02                       |
| Training calendar              | `training-calendar.tsx` (`TrainingCalendar`: an own month grid, no ECharts)                                                                                                                                                                                                                                           | ANL-06, SET-11               |
| Chart tokens and gate          | `--chart-1…3` in `src/ui/tokens.css` (Tailwind names in `app.css`); a `series` role in `tools/tokens-check`: ≥ 3:1 on every surface and every pair ΔE00 ≥ 10 for normal vision and simulated protanopia, deuteranopia and tritanopia                                                                                  | §8.9.3, NFR-A11Y-10          |
| Date helpers                   | `src/i18n/format.ts`: `formatLocalDateWithYear`, `formatAxisDate`, `formatMonth`, `formatSpan`                                                                                                                                                                                                                        | NFR-L10N-01                  |
| Chart demo, S-4 bench          | `/debug/charts` (`features/debug/ChartsDemo.tsx`, `chart-demo-data.ts`: five seeded years), behind the debug gating, linked from Developer tools                                                                                                                                                                      | S-4                          |
| Body-map artwork               | `tools/body-map/art/body-map.svg`: original own work, front and back, one closed region per display group with exactly the `muscles.yaml` region IDs, sub-region shapes nested for MAP-07; `assets-inventory.yaml` entry `powr-body-map-artwork` (LicenseRef-Own-Work, the artwork awaits the product owner's review) | MAP-01, MAP-08, OQ-08        |
| Body-map pipeline              | `tools/body-map` (`pnpm body-map`, `--check`): a strict parser of the SVG subset, the taxonomy checks, geometry (reading order, arrow-key neighbours, drawing order, tap targets, the `small` flag), writes `src/ui/body-map/artwork.gen.ts`; registered in the architecture test's dependency matrix                 | §8.11                        |
| Body-map components            | `src/ui/body-map/`: `BodyMap`, `HeatLegend`, `BodyMapList` (MAP-06), `heat.tsx` (bands, patterns, swatches, names)                                                                                                                                                                                                    | MAP-01, 04, 06               |
| Body-map demo                  | `/debug/body-map` (`features/debug/BodyMapDemo.tsx`), behind the debug gating                                                                                                                                                                                                                                         | S-5                          |
| Tempo metronome                | `infrastructure/alerts/metronome.ts` on the lazy timer kit, cues in `platform/audio.ts`, `hooks/use-timed-set.ts`, `features/session/timed-set.tsx` (`TempoCues`)                                                                                                                                                     | TMR-10, TD-39                |
| Lead-in and stop at the target | `infrastructure/alerts/lead-in.ts`, `timed-set.tsx` (`SetTimerButton`, `SetTimerPanel`), minimal edits in `LoggingView.tsx`, `RestPanel.tsx`, `session-ui.ts`                                                                                                                                                         | TMR-09, TD-48                |
| Settings                       | `alerts.setTimerLeadIn`, `alerts.setTimerAutoStop`, `alerts.tempoCues` (optional booleans, absent = off) in the unreleased v2 settings record (`packages/formats`, the one `packages/` edit, with arbitraries and schema tests); Settings → Workout "Timed sets and tempo"                                            | SET-03, SET-05               |

### S-4 charts: numbers and go/no-go

- **Chunk:** the modular ECharts chunk is **515.6 kB minified, 174.0 kB gzip** (Vite's report;
  171.9 kB with `gzip -6`), inside the 150–250 kB estimate of §8.10. It loads on the first chart
  only: the E2E test checks that the start screen never fetched it. The chart components and the
  demo data are a 13.8 kB route chunk. Entry JS 177.34 → **177.62 kB** gzip (the new date helpers
  and the timer settings defaults); **1 first-wave script**, 0 with Zod; precache 575.6 → 787.6 kB.
- **One startup script kept:** with `GridComponent` the chunk was 180 kB and needed Rolldown's
  `__export` helper (the axis pointer's `graphic[type]` lookup keeps a namespace object), which
  moved Rolldown's runtime out of the startup chunk into a second first-wave script. The charts
  draw their own selection marker, so `GridSimpleComponent` (no axis pointer) is enough.
- **Timings** (`CHART_BENCH=1 pnpm e2e charts`: production build, Playwright's mobile profile
  360 × 780 at DPR 3, Trusted Types on, two runs each, which agreed within a few percent; CPU
  slowdown through `Emulation.setCPUThrottlingRate`, pinches through
  `Input.synthesizePinchGesture`, timings are the charts' own `powr-chart-*` measures from the
  start mark to the first rendered frame):

|                                                                                          | 1×        | 4×                   | 6×                   |
| ---------------------------------------------------------------------------------------- | --------- | -------------------- | -------------------- |
| First render, squat e1RM, full five years (1,275 sessions, trend, band, 45 shaded spans) | 88–95 ms  | 316–330 ms           | 472–486 ms           |
| First render, bodyweight (1,791 weigh-ins and the trend)                                 | 42–45 ms  | 127–135 ms           | 189–202 ms           |
| First render, volume (261 weekly bars with patterns)                                     | 25–28 ms  | 102–104 ms           | 151–158 ms           |
| First render, 3 compared trends (1,275 + 765 + 765 days)                                 | 9 ms      | 35–38 ms             | 53–55 ms             |
| Range chip to the first frame (12 weeks … all)                                           | 10–32 ms  | 65–134 ms            | 98–220 ms            |
| Pinch, squat chart (all sessions in view)                                                | 3–30 ms   | 41–49 ms, one 182 ms | 59–83 ms, one 278 ms |
| Pinch, 3 compared trends                                                                 | 1–13 ms   | 3–34 ms              | 4–62 ms              |
| Navigation to four charts ready (route, chunk, demo data, four inits)                    | 1.3–1.4 s | 5.3–5.4 s            | 7.9–8.0 s            |

- **Go.** ECharts stays (ADR-0007): the chunk is within the estimate and lazy, everything works
  under the production CSP with Trusted Types (one host shim, below), and the budgets of §8.10 and
  §8.19 (render ≤ 500 ms, interaction ≤ 100 ms) hold unthrottled and, for the render, at 4× and
  6×. Interactions on the whole five-year history pass at 1× and exceed 100 ms at 4× (range
  chips up to 134 ms, one zoom-out pinch 182 ms). Conditions: (1) the weekly aggregation of
  ranges over one year that §8.10 already plans (`@powr/domain/charts`, M4a/M4b: about 260
  points instead of 1,300), and (2) the device measurement on the S22 that §8.19 requires (a
  4× slowdown of this machine is a conservative stand-in for it). Recharts 3 stays the
  documented fallback if the S22 run fails.

### Trusted Types and the CSP (TD-03)

- **The tooltip is not used.** ECharts' HTML tooltip (`TooltipHTMLContent`) writes its content
  with `innerHTML` and would need a policy. The charts show the selected point in an HTML readout
  above the canvas (it also scales with the text size), so the tooltip component is not
  registered.
- **zrender still needs one fix.** Its canvas painter empties the host with `innerHTML = ''` on
  init and dispose, and Trusted Types throw for the empty string too (checked in Chromium: "This
  document requires 'TrustedHTML' assignment"). A policy cannot help (third-party code assigns a
  string; only a document-wide `default` policy would). `createChart` gives the chart's own host
  element an `innerHTML` setter that accepts only `''` and clears it with `replaceChildren()`;
  anything else still throws. **No new policy:** the allow-list stays `powr-sw`. Negative check:
  without the shim, every chart fails with `require-trusted-types-for` violations in the ECharts
  chunk and shows its fallback text; with it, the E2E suite has no violation. ECharts sets its
  inline styles through the CSSOM, which `style-src 'self'` allows.
- **For TD-03:** with this setup ECharts is compatible with Trusted Types in production.

### S-5 body map: outcome and the small-region list

- **Reference size:** the figure fills the content column (max 20 rem): **320 × 725 CSS px** at a
  360 × 780 viewport. A region's tap target is the region plus its invisible hit area (a 12-unit
  stroke clipped to the gaps between regions, so a visible region always takes its own taps;
  smaller regions drawn later win a shared gap). The pipeline's computed targets and the
  browser's own hit testing agree within 1 px for all 21 regions (component test).
- **Small regions** (largest square target under 46 px, that is 44 px plus a 2 px raster
  margin), repeated as buttons below the figure (MAP-01 fallback):

| Region              | Browser | Pipeline |
| ------------------- | ------- | -------- |
| `front.front-delts` | 29 px   | 28.5 px  |
| `front.side-delts`  | 33 px   | 33.1 px  |
| `front.adductors`   | 34 px   | 34.0 px  |
| `front.tibialis`    | 43 px   | 43.2 px  |
| `back.rear-delts`   | 31 px   | 30.3 px  |
| `back.side-delts`   | 32 px   | 32.2 px  |

- **The other 15:** front chest 92, biceps 56, obliques 47, abs 62, forearms 51, quads 62 px; back
  upper traps 58, mid back 49, triceps 54, lats 57, lower back 56, forearms 51, glutes 73,
  hamstrings 70, calves 72 px.
- **Size trade-off:** a figure that fits the screen height (255 × 576) left 14 of 21 regions
  under 44 px, so the figure takes the column width and the legs scroll slightly below the fold.
  M4b must give `BodyMap` the whole content column (not a padded card: in a card the figure is
  296 px and every target about 7% smaller); at 320 px width it is 288 px.
- **Still open:** TalkBack on the S22 with SVG buttons (explore by touch over the hit areas,
  double-tap) is a device test.

### Component APIs for M4b

All take plain data (`src/ui` imports no `@powr/*`); every string they show is a Lingui message
or comes from the caller. Memoize array props: a new array redraws every series.

```tsx
import { TrendChart } from '#ui/charts/trend-chart';
import { BodyweightChart } from '#ui/charts/bodyweight-chart';
import { VolumeChart } from '#ui/charts/volume-chart';
import { TrainingCalendar } from '#ui/charts/training-calendar';
import { BodyMap } from '#ui/body-map/body-map';
import { BodyMapList } from '#ui/body-map/body-map-list';
import { HeatLegend } from '#ui/body-map/heat-legend';

// ANL-02: one lift, or up to 3 normalised to % change (unit '%'); dates are 'YYYY-MM-DD'.
<TrendChart
  title="Squat e1RM"
  summary="Squat e1RM rose 4% over 12 weeks." // the domain's one sentence for the range
  series={[{ name, points: [{ date, value }], trend: [{ date, value, low?, high? }],
             markers: [{ date, kind: 'pr' | 'likely' | 'veryLikely', label }] }]}
  unit="kg"
  formatValue={(v) => formatMass(v, 'kg')}
  annotations={[{ from, to, label: 'Deload' }]}
  endDate={today} defaultRange="12w" // '4w' | '12w' | '6m' | '1y' | 'all'
  onRangeChange={(preset, window) => …} // preset null after a pinch or Earlier/Later
  onOpen={(date) => openSetsSheet(date)} openLabel="Show the sets"
  headingLevel={2} emptyText="…" />

// BOD-02: the same frame; summary carries the weekly rate.
<BodyweightChart title summary entries={[{ date, value }]} trend={[{ date, value }]} unit="kg" … />

// ANL-03: one muscle, weekly; `bands` is the same list BodyMap and HeatLegend take.
<VolumeChart title summary weeks={[{ week, sets, direct?, step? }]} target={{ low: 10, high: 20 }}
  bands={[{ step: 0…5, label: '10–20 sets, in target' }]} onOpen={(week) => …} … />

// ANL-06: month grid; days with a status are buttons when onDaySelect is given.
<TrainingCalendar title summary month="2026-11" weekStart={1} today="2026-11-20"
  days={[{ date, status: 'completed' | 'partial' | 'missed' | 'planned' | 'deload' | 'break',
           label? }]} onDaySelect={(date) => …} onMonthChange={(month) => …} />

// MAP-01/04/06: keyed by display-group muscle ID, so one entry colours both views.
<BodyMap muscles={{ 'mu.chest': { name: 'Chest', step: 3, valueText: '14 sets this week' } }}
  bands={bands} selected={id} onSelect={(muscleId) => openPanel(muscleId)}
  view? defaultView="front" onViewChange? />
<HeatLegend title="Hard sets this week" bands={bands} />
<BodyMapList muscles={…} bands={bands} selected={id} onSelect={…} headingLevel={3} />
```

- **Time charts** (`TimeChart` frame): title (h2 or h3) and the summary; range chips (4 wks,
  12 wks, 6 mths, 1 yr, all; the default 12 weeks follows new data); the canvas (vertical swipes
  scroll the page, horizontal drags pan, pinches zoom); a tap shows the nearest point in the
  readout (with the `openLabel` button); a visually hidden point slider (`input type=range`, its
  focus ring drawn around the chart) for the keyboard (arrows, Home, End, Page Up/Down, Enter
  opens, Escape clears) and screen readers (the value text is the readout; TalkBack swipes up and
  down); Earlier/Later buttons (the tap alternative to panning); the legend in words; "View as
  table" (caption, the visible range, newest first, 30 rows a page). The canvas is
  `aria-hidden`: summary, slider and table carry everything (NFR-A11Y-06). Animations are off
  under reduced motion. If the chart chunk cannot load, a text says the table has every value.
- **Colour:** series 1–3 are `--chart-1…3` in that order, also told apart by dash (solid, dashed,
  dotted) and symbol (circle, square, triangle); points are hollow; PRs are `--pr-accent` stars;
  changes are `--fg` diamonds (hollow: likely, filled: very likely). Volume bars use
  `--heat-0…5` with the body map's patterns; the legend uses the body map's `HeatSwatch`.
- **BodyMap:** a one-tap Front/Back switch; every region a `role=button` with `aria-pressed`,
  named "Chest, 14 sets this week, 10–20 sets, in target" (name, value, band); one tab stop
  with arrow keys along the precomputed neighbours, Home/End, Enter/Space; a focus ring of its
  own; selection is a thick double outline plus dots; band 1 hatched, band 5 cross-hatched;
  the small regions repeated as buttons below the figure; nothing animates. `BodyMapList` shows
  the same names, values, bands and selection, grouped Front and Back (side delts and forearms in
  both). M4b puts the list one tap away from the map (MAP-06).
- **Lazy loading:** the body-map module is about 12.8 kB gzip (artwork) plus 7.7 kB
  (components), the chart components about 10 kB, ECharts 174 kB. Only lazy routes may import
  them; the Home mini heat map (ANL-01) must load the body map with `import()` or the entry grows.
- **Timer extras:** `useLeadIn()` → `{ count, start(onDone), cancel }`; `useMetronome()` →
  `{ state, start(tempo, name), stop }` (both suspend on the lazy kit); the kit's `metronome` and
  `leadIn`; `audio.schedule(cue, volume, delayMs)` returns a canceller; cues `tempoLower`,
  `tempoPause`, `tempoLift`, `tempoTick`.

### Timer extras (TD-39 metronome, TD-48 lead-in and stop at the target)

- **Settings:** `alerts.setTimerLeadIn`, `alerts.setTimerAutoStop`, `alerts.tempoCues`, optional
  booleans in the unreleased v2 record (absent = off, so no development database needs a reset);
  written through `useSetAlertSettings` only once changed (`STORED_DEFAULTS` in
  `hooks/use-alert-settings.ts`), because the session preferences' use case lives in
  `@powr/application`. UI: Settings → Workout, "Timed sets and tempo", three switches with a
  one-line description each.
- **Metronome** (TMR-10): `tempoRep` turns a tempo (eccentric–bottom–concentric–top, "X" = 1 s)
  into beats: a cue at each phase start (low for lowering, high for lifting, short for a pause)
  and a soft tick on each further second; scheduled 450 ms ahead on the audio clock (the first
  beat 600 ms after the tap), vibration at phase starts only, both following the alert sound,
  volume and vibration switches. It stops when the page is hidden, after 5 minutes, on stop,
  confirm, skip or a set change, and runs nothing while stopped. On the session screen, with the
  switch on and an exercise tempo (not for timed sets): one toggle "Tempo cues 2-0-X-0"
  (`aria-pressed`, ≥ 48 px) in the current-set card and an `aria-hidden` "Rep N · Lower / Pause /
  Lift" label that changes at phase starts only, with no animation; one polite announcement on
  start and one on stop.
- **Lead-in** (TMR-09): with the switch on, "Start set timer" counts 3-2-1 (the `countdown` cue
  and a short vibration each second, a large number, Cancel ≥ 48 px, one announcement "Set timer
  starts in 3 seconds"), then sends the same `TIMER_START`; focus goes Start → Cancel → Stop. Page
  state only: a reload during the count loses it before anything started.
- **Stop at the target** (TMR-09): with the switch on, a countdown set timer stops itself once
  its display is done and the end alert has fired (`timer.fired.end`), so "Time is up" always
  sounds first; the set gets `min(elapsed, target + adjust)`, also after a return to a hidden
  page; one announcement "Time is up, set timer stopped at N seconds". Count-up set timers never
  stop by themselves. Stop (manual or automatic) moves focus to "Confirm set" when it had focus.

### Decisions and deviations

| Concept / brief says                                                                                | What I did                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role="img"` with the summary as `aria-label` on the chart (§8.10)                                  | The canvas is `aria-hidden`; the summary is visible text under the title, and a visually hidden range input ("Points of Squat e1RM") is the keyboard and screen-reader way through the points (its value text is the readout). A focusable `role=img` with key handlers fails three jsx-a11y rules and gives TalkBack nothing to adjust |
| Tooltip on tap (`triggerOn: 'click'`, §8.10)                                                        | An HTML readout above the canvas (no `innerHTML`, scales with the text size, holds the "Show the sets" button) plus a ring and a dashed line on the selected point; the ECharts tooltip is not registered                                                                                                                               |
| `dataZoom` inside plus a slider (§8.10)                                                             | Inside only (pinch, horizontal pan, the wheel on desktop) with `touch-action: pan-y`, so vertical swipes still scroll the page; range chips and Earlier/Later are the tap alternatives (NFR-A11Y-04)                                                                                                                                    |
| `GridComponent`, `TooltipComponent`, `LegendComponent`, `AriaComponent`, `DatasetComponent` (§8.10) | `GridSimpleComponent` (see the startup script above); legend, title, summary and table in HTML; no aria decals (the patterns are drawn per bar)                                                                                                                                                                                         |
| ECharts theme object registered at runtime (§8.10)                                                  | Colours resolved from the tokens on each theme change and put straight into the option; re-rendered on `data-theme`, OS scheme, root font size and reduced motion changes                                                                                                                                                               |
| `--chart-1…8` (§8.9.3)                                                                              | `--chart-1…3`: ANL-02 compares at most three series, and three colours pass the all-pairs colour-vision check; more would need folding or small multiples                                                                                                                                                                               |
| Range presets 4 w / 12 w / 6 m / 1 y / all                                                          | As listed, shown as locale short units ("4 wks", "6 mths", "1 yr") so the visible text is the accessible name                                                                                                                                                                                                                           |
| Calendar or heat strip in ECharts (ANL-06)                                                          | An own month grid: an HTML table with day buttons (icon and words per status), so it is its own table view                                                                                                                                                                                                                              |
| Body-map pipeline in `packages/content/scripts/bodymap.ts` with SVGO (§8.11)                        | `tools/body-map`, writing into `src/ui/body-map/` (packages are M4a's, and `src/ui` may not import them); a strict own parser, no new dependency                                                                                                                                                                                        |
| Body map props keyed by region ID (brief)                                                           | Keyed by display-group muscle ID (`mu.side-delts`), so one entry colours both views                                                                                                                                                                                                                                                     |
| `smallRegion: true` in content (§8.11)                                                              | The `small` flag is computed into the generated module from the geometry and checked against the browser                                                                                                                                                                                                                                |
| Hit path: the outline with a 12–16-unit stroke (§8.11)                                              | A 12-unit stroke clipped to the gaps (a stroke over a neighbour stole its taps); the regions are in reading order in the DOM, the hit areas a separate hidden layer                                                                                                                                                                     |
| Metronome "Start/Stop tempo cues" labels                                                            | One name with `aria-pressed` (a changing name plus a pressed state is announced twice)                                                                                                                                                                                                                                                  |
| Timed-set and tempo settings in `settings.session`                                                  | In `settings.alerts` (the session preferences go through `@powr/application`)                                                                                                                                                                                                                                                           |

**Fixed on the way:** a race in the lead-in component test (the count was read before the click's
state update landed under a full parallel run).

### Evidence

`pnpm verify` green on 2026-11-25 (exit 0): lint (0 errors, 0 warnings), format, token gate (27 colours; lowest text 4.56, on fills 5.41, UI 3.88, heat map 3.13, chart series 4.10; heat-map steps ΔE00 ≥ 10.7, chart series all pairs ΔE00 ≥ 10.2), knip, catalog check, typecheck, **844 unit and component tests in 81 files** (788 before), build, licence gate (37 distributed: ECharts 6.1.0 Apache-2.0 with its NOTICE in the attributions, zrender 6.1.0 BSD-3-Clause, tslib 2.3.0 0BSD; 841 build-only; passed), size (**entry JS 177.62 kB gzip** of 186, was 177.34; CSS 7.0 kB, was 6.3; service worker 8.22 kB; precache 114 files + sw.js, 787.6 kB; **startup path 1 script, 0 with Zod**; ECharts chunk 515.6 kB, 174.0 kB gzip) and **57 E2E tests** (55 before; 3 opt-in S-4 measurements skipped).

- **Component tests:** `test/charts.test.tsx` (12: range windows; the trend chart's summary,
  legend, table with paging and the lazy canvas; the point slider with real key presses, Enter
  and the open button, Home moving the window; range chips, Earlier/Later and a real tap on the
  canvas; three compared series; the empty state; the volume chart's bands in legend, readout and
  table; the bodyweight legend and table; the calendar's day names, today, month change, legend
  and week start; axe in light and dark with the tables open; +30% strings at 360 px),
  `test/body-map.test.tsx` (11), `test/timer-extras.test.tsx` (9); unit tests
  `alerts/metronome.test.ts`, `tools/body-map/test` (10), `tools/tokens-check` (+2 for the series
  role), the formats schema tests for the new fields.
- **E2E:** `e2e/charts.spec.ts` (the demo route under the production CSP with Trusted Types: the
  ECharts chunk not fetched before, four canvases, a touch tap, the slider, chips, Earlier/Later,
  the table, the calendar, axe in both themes, reflow at 320 px and 200% text; plus the opt-in
  S-4 measurements), `e2e/body-map.spec.ts` (both views, keyboard and tap selection, chips, list,
  axe in both themes, reflow).
- **Screenshots** (360 × 780, light and dark) were handed to the coordinator outside the
  repository: every chart (e1RM, the selected point, the table, compare, volume, bodyweight,
  calendar, the demo viewport) and the body map (front and back with heat, viewport and full
  page).

### Open items

- **Device (S22):** chart render and interaction timings with the reference dataset (§8.19);
  TalkBack with the SVG body-map buttons and the chart point slider; metronome timing in Chrome
  and Samsung Internet, whether its vibrations can be told apart, the first-beat delay.
- **M4b:** wire the charts and the body map to M4a (summaries per range, the weekly aggregation
  over one year, the "Show the sets" sheet, `bands` from the one volume calculation); the list
  alternative one tap from the map; the body map in the full content column; lazy imports only.
- **Not built:** MAP-07 drill-down (the sub-region paths are in the artwork and the module but not
  drawn); MAP-04's planned-remainder overlay; a fourth or more chart series.
- **Product owner:** review and approve the body-map artwork (assets inventory); whether the
  metronome needs its own sound and vibration choice or a rep count.
- **Size:** 8.4 kB of entry headroom remain; M4b's Home additions must stay lazy.

### Doc amendments for the docs pass

- **§8.10:** the modular set as built (`GridSimpleComponent` and why, no tooltip, legend, title,
  aria or slider zoom), the chunk number (515.6 kB, 174.0 kB gzip), the wrapper with its overlay
  and `powr-chart-*` measures, the theme from tokens without `registerTheme`, the HTML readout
  instead of the tooltip, the hidden point slider instead of `role="img"`, the inside zoom with
  `touch-action: pan-y` and the Earlier/Later buttons, the 30-row table pages, `--chart-1…3`, the
  host `innerHTML` shim, the S-4 table above and the go with its two conditions.
- **§8.9.3:** tokens `--chart-1…3` (light `#2a6fc9`, `#c2410c`, `#0f7d5c`; dark `#5486e6`,
  `#dd6e32`, `#1fa577`) and the gate's `series` role (all pairs, ≥ 10 ΔE00, lowest 10.2).
- **§8.11:** pipeline location and output, the reference size 320 × 725, gap-clipped hit areas,
  the 46 px threshold and the small-region list, keying by muscle ID, the list grouping; §8.11's
  `role="img"`-free group semantics as built.
- **§7.3 / §8.18 / §11.2 TD-03:** ECharts is Trusted-Types-compatible as used (no tooltip; the host
  shim for zrender's `innerHTML = ''`); the allow-list stays `powr-sw`.
- **§8.8.2, §8.8.7, §8.9.9:** the tempo cues and `schedule`, the metronome, the lead-in and the
  stop at the target as built; "Not built" no longer lists TMR-10.
- **§8.2.2:** the three optional `alerts` fields of the unreleased v2 settings record.
- **§8.19:** entry JS 177.62 kB, 1 first-wave script, precache 787.6 kB; the S-4 numbers.
- **§8.20:** the new component and E2E tests and the opt-in `CHART_BENCH` measurements.
- **§11.2:** TD-39 and TD-48 closed; TD-03 narrowed (ECharts confirmed).
- **Appendix A.3:** S-4 and S-5 rows with their outcomes; **Appendix B:** ECharts 6.1.0 (Apache-2.0,
  NOTICE in the attributions), zrender 6.1.0 (BSD-3-Clause), tslib 2.3.0 (0BSD).
- **PRD (proposed, not edited):** ANL-11 "a range slider" → "pinch-zoom with range chips and
  Earlier/Later buttons"; MAP-01 "or a list fallback" → "or a button for it below the figure".

**Product-owner answers after M4a and M4v (2026-11-25):**

- The body-map artwork (`tools/body-map/art/body-map.svg`) is approved as own work
  (`assets-inventory.yaml`).
- The strength-trend process noise (`load.trend.processSdPerWeek`, 1 %/week) gets an evidence
  review and tuning now, in parallel with M4b (a steady +3 %/week read "likely real" only after
  about 8 weeks).
- Accepted as built: ECharts (S-4 go, with weekly aggregation of ranges over one year and an S22
  timing run as conditions), the accessible chart pattern (visible summary, point slider, readout
  instead of ECharts tooltips, range chips plus Earlier/Later), up to 3 chart colours, and the large
  body-map figure with chips for the 6 small regions. The PRD gets M4v's proposed ANL-11 and
  MAP-01 wording in the M4b docs pass.
- Accepted as built: the streak rules (a skipped planned session still counts as asked for; merge
  or the grace keeps the week; a missed week resets only the current streak), a custom variant of
  a competition lift counting toward its heavy sets, the metronome following the Alerts sound and
  vibration settings without counting reps, all three new timed-set and tempo switches off by
  default, and the four new `verified: false` design values.
- Merge fix: `apps/web/test/timer-extras.test.tsx` waits up to 2.5 s for the lead-in count (it is
  on screen for 3 s); under the full parallel run the first render took longer than the default
  1 s.

## M4b insight screens

Written 2026-11-25 by the M4b work (roadmap A.4 "M4 Insight and motivation", the screens on top of
M4a's analytics core and M4v's charts and body map), plus the docs pass for M4 as a whole
(technical concept v0.8, PRD v0.7, ADR-0007/0014/0019 amendments). Status: `pnpm verify` green
(numbers under "Evidence").

### What landed

| Area                  | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | PRD                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Loaders and live data | `src/hooks/use-insights.ts` (`useInsights`, `useInsight`, `useLiveInsight`, `useInsightsWarmup`) and `src/hooks/use-library.ts` (`useLibrary`, `useLibraryQuery`): the two `import()` loaders, one `LAZY_INSIGHTS` disable comment each; `src/hooks/use-load.ts` (`useLoad`, `useLazyLive`: keyed loads that keep the last value, `stale`, while the next loads; `reload()` after writes)                                                                               | §8.19                  |
| Idle warm-up          | `useInsightsWarmup` in `AppShell`: `ensureInsights()` once per app run, 5 s after the first screen and then in idle time (`requestIdleCallback`, 10 s timeout), never while a workout is active                                                                                                                                                                                                                                                                         | M4a open item          |
| Routes                | `src/routes/explore/` (`index`, `exercises/{index,$exerciseId,new,edit.$exerciseId}`, `body-map/{index,$muscleId}`), `src/routes/progress/` (`index`, `exercise.$exerciseId`, `compare`, `volume`, `prs`, `calendar`, `scores`, `streak`), `src/routes/body/` (`index`, `log`); search params validated by plain functions (`features/{library,bodymap,progress,body}/search.ts`); the old `/explore` and `/progress` placeholders and `features/placeholder/` are gone | §8.9.1                 |
| Home                  | `features/home/HomeScreen.tsx` (today or "Rest day" with the next session, this week with the streak and the mini heat map, last workout, recent PRs and "likely real" changes, bodyweight with the sparkline, meet and points, backup indicator), `Sparkline.tsx`                                                                                                                                                                                                      | ANL-01, MOT-03         |
| Mini heat map         | `ui/body-map/body-map-mini.tsx` (`BodyMapMini`: both views, static, `aria-hidden`), `features/insights/MiniHeatMap.tsx` (lazy via `React.lazy`), `useHeatSentence` (the same in words)                                                                                                                                                                                                                                                                                  | ANL-01, WKT-13, MAP-04 |
| Shared words          | `features/insights/words.ts` (heat bands, volume statuses and bands, sets, the body map's `muscles` record, streak states and counts)                                                                                                                                                                                                                                                                                                                                   | MOT-10                 |
| Body map              | `features/bodymap/` (`BodyMapScreen`, `MuscleScreen`, `RankedExercises`, `PlaceInPlan`, `words`, `search`)                                                                                                                                                                                                                                                                                                                                                              | MAP-01…07              |
| Explore and library   | `features/library/` (`ExploreScreen`, `LibraryScreen`, `ExerciseDetailScreen`, `detail-parts`, `CustomExerciseScreen`, `words`, `search`)                                                                                                                                                                                                                                                                                                                               | EXL-02…05, 07…09       |
| Progress              | `features/progress/` (`ProgressScreen`, `ExerciseProgressScreen`, `CompareScreen`, `VolumeScreen`, `PrHistoryScreen`, `CalendarScreen`, `ScoresScreen`, `parts`, `words`, `search`)                                                                                                                                                                                                                                                                                     | ANL-02…07, ANL-11      |
| Bodyweight            | `features/body/` (`BodyScreen` at `/body`, `LogBodyScreen` at `/body/log` and `?what=measurements`, `words`, `search`)                                                                                                                                                                                                                                                                                                                                                  | BOD-01…03              |
| Streak                | `features/motivation/StreakScreen.tsx` at `/progress/streak` (current and best, this week, the rules in words, recent weeks with "Why?", mark a week as a break)                                                                                                                                                                                                                                                                                                        | MOT-03, MOT-04         |
| Summary               | `features/session/SummaryScreen.tsx`: "Your week so far" (the session's week from `dWeekly`, mini heat map and sentence), the streak change card (`sessionStreakChange`, new best with the PR scale-in), the PR card with a count and a link to the PR history                                                                                                                                                                                                          | WKT-13, TD-43, MOT-02  |
| PR celebrations       | Summary and session PR cards both use the CSS `pr-pop` scale-in (≤ 600 ms, zeroed under reduced motion by `app.css`); the session card counts several PRs ("New personal records: 2") and uses the PR accent                                                                                                                                                                                                                                                            | MOT-02                 |
| Settings              | `features/settings/InsightsSection.tsx` (`#insights`): streak grace, weekly session goal without a plan, measurement sites, points source and division, through `updateInsightPreferences`                                                                                                                                                                                                                                                                              | MOT-03, BOD-03, ANL-07 |
| Data                  | `features/data/DataScreen.tsx` "Verify data" → `rebuildInsights` with the result in a polite `<output>`                                                                                                                                                                                                                                                                                                                                                                 | §8.2.8                 |

### PRD coverage (requirement → screen or element)

| ID            | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ANL-01        | Home: "Today" with "Start today's session" (one tap) or "Rest day" with the next session and "Rest is part of training"; this week "2 of 3 sessions · In progress", time trained, streak and best; mini heat map with its key and the same in words, "Open the body map"; last workout with its summary; recent PRs (3) and "likely real" changes with the rep-range note; bodyweight trend, rate, band with "Why?", sparkline, "Log bodyweight"; meet countdown and the current total with IPF GL points; backup indicator (no backup or older than 14 days); `refreshing` shown as "Updating your weekly numbers…"                                                                                      |
| ANL-02        | `/progress/exercise/$id`: `TrendChart` (points, trend and 95 % band, PR stars, likely / very likely markers where a label starts or changes, mesocycle / deload / break annotations also listed in words), "Heavy sets" / "All sets" (`?source`), the chart's range chips (a year of sessions loaded, "All" loads the whole history so M4a's weekly maxima apply beyond a year), the summary sentence for the visible window (a change is called real only when PRG-02 says so), "Why?" on the latest label, the PRG-07 pace note, "Show the sets" sheet with a link to the workout; performance chart (heaviest set, volume load, reps at a chosen weight); `/progress/compare?ids=` up to 3 as % change |
| ANL-03        | `/progress/volume`: this week / last week / 4-week average (`?mode`), the table of all muscles (hard and direct sets, target band, status icon and words, heat band) equal to `weeklyVolume` (test), a muscle's detail with target source, "Why?", planned sets still to come, contributors, sub-regions and its weekly `VolumeChart`; a chart week opens its contributors; competition-lift heavy sets and tonnage                                                                                                                                                                                                                                                                                       |
| ANL-04        | Same screen: current e1RM with its 95 % range and source, calibration note, training max (set on the exercise detail), heaviest weight and best volume, rep-max table 1…12+ (load, set, effort, date, estimate), all sessions with their sets (paged), PRs                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ANL-05        | `/progress/prs`: type (rep, heaviest weight, estimated 1-rep max labelled an estimate, volume) and exercise filters, newest first, 30 a page; each opens its workout summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ANL-06        | `/progress/calendar`: `TrainingCalendar` with the locale week start (a day opens its workout or a sheet of several), the workout list with accent-insensitive search on names and notes, status / origin / with-PR filters, the last 12 months plus "Include older workouts"                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ANL-07        | `/progress/scores`: source ("Current estimates" / "Heaviest lifted") and division saved to the preferences, missing inputs with links, total, lifts and bodyweight trend, per formula value, best, version ID, sources, "Preliminary coefficients" when unverified, "Legacy" and "informal", "Why?", the points history, the rules version                                                                                                                                                                                                                                                                                                                                                                |
| ANL-11        | Every chart through M4v's frame (summary, range chips, Earlier/Later, readout, point slider, legend in words, "View as table"); the measurement trends on `/body` too                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| MAP-01        | `/explore/body-map`: `BodyMap` in the full content column (E2E checks 320 px), Front/Back one tap (`?view`), the selected muscle kept when coming back, the six small regions as buttons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| MAP-02, 03    | Muscle panel `/explore/body-map/$muscleId`: ranked list (`?sort=focus`), role and credit, rating with "Why?" (factors), evidence tag, last performance, "Custom, unrated"; "Include unavailable" with "Not available" and "Needs: …" in words                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| MAP-04        | Heat from `observeWeeklyVolume` with the legend and the week / last week / 4-week toggle (`?mode`); the panel: fractional and direct sets, target band and source, status, "Why?", contributors, the planned remainder in words ("6 more planned")                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| MAP-05        | "Add to today" (added to the workout, to today's planned session, or "Start a workout with it", which starts a freestyle workout like the start screen); "Place in the plan" sheet (a day: add or replace; the new or changed plan checks; save from the next session or the next block); exercise details; history                                                                                                                                                                                                                                                                                                                                                                                       |
| MAP-06        | "Show as a list" (`?show=list`): `BodyMapList` grouped Front/Back with the same names, values and bands; a row opens the panel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| MAP-07        | The panel lists the muscle's sub-regions with their sets; each opens its own panel with its own volume, contributors and ranking (shapes not drawn: TD-52)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| EXL-02        | `/explore/exercises`: search on every keystroke, Filters sheet (muscle incl. sub-regions, equipment, movement, mechanics, available only, favourites, custom, include hidden), AND logic, a chip per active filter clearable in one tap and "Clear all", a polite result count; query and filters in the URL                                                                                                                                                                                                                                                                                                                                                                                              |
| EXL-03        | Detail: cues, muscles with role and evidence explained on tap (`<details>`), the body map with primary cross-hatched, secondary hatched, minor plain and a legend, equipment and what is missing, defaults with rest "Why?", history summary with "Trend and full history"                                                                                                                                                                                                                                                                                                                                                                                                                                |
| EXL-04        | `/explore/exercises/new` (`?from=` copy) and `/explore/exercises/edit/$id`: every PRD field plus tempo, close variant of a competition lift, cues and the optional rating ("Use my rating in the rankings"); errors at the field and in a focused summary; `ActionBar`; delete confirmed, retired when it has history or is in a plan                                                                                                                                                                                                                                                                                                                                                                     |
| EXL-05        | Credits and evidence in words, 0.25 labelled "Unvalidated convention"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| EXL-07        | Detail: competition-lift badge, variant of, close variants, substitutes (unavailable ones say so)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| EXL-08        | Detail: favourite, hide from lists, avoid the exercise, avoid its movement pattern (checkboxes), badges in results                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| EXL-09        | Detail "Your setup": up to 12 settings (seat, backrest, pin, handle, grip, stance, rack, safeties, other with a name), a note and the training max in the load unit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| BOD-01        | Home "Log bodyweight" → the value → Save (3 taps); date and time default to now ("When" opens for a past time); note; guidance on weighing; edit and delete in a sheet on `/body` (delete confirmed); several per day allowed                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| BOD-02        | `/body`: trend (first reading per day), weekly rate (kg or lb and %), the band with "Why?", the rate's "Why?", `BodyweightChart` (trend prominent, weigh-ins de-emphasised), no single-day alert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| BOD-03        | `/body/log?what=measurements`: the configured sites (Settings → Insights; circumferences by default, skinfolds opt-in) in cm/in (mm for skinfolds) with the measuring protocol; `/body` lists each site with its latest value, 4-week or since-first change and its trend chart                                                                                                                                                                                                                                                                                                                                                                                                                           |
| MOT-01, 02    | PRs in words on Home, the summary and the PR history; the session and summary PR cards with the short scale-in (static under reduced motion); a new best streak celebrated the same way                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| MOT-03        | Home (current, best, "2 of 3 sessions"), `/progress/streak`, the summary's streak card                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| MOT-04        | `/progress/streak`: the rules in words (breaks pause, a miss resets only the current streak, the best stays), "Mark a week as a break" for the current week and up to four back (errors in words), every week's "Why?"; grace in Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| MOT-10        | Every new text: facts and next steps ("Below your target", "Not kept", "Rest is part of training", "Life happens"-style break offer), no blame, no BMI, no praise for fast loss                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| WKT-13        | Summary: "Your week so far" mini heat map with the week's words, the streak change, plus the existing sets per muscle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| DAT-08 (part) | Home backup indicator; cadence, dismissal and reminders after a session are M5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

**Not built (and why):** the Progress hub's strength list shows no current e1RM or change per exercise (no bulk use case; one query per row is too costly, TD-55); the dashed planned-remainder overlay and the sub-region shapes on the figure (TD-51, TD-52: said in words, drill-down as a list); the library's filters are single choice per dimension and the custom form cannot create new "one of" equipment groups or pick a substitution group (TD-56); the backup reminder's cadence and dismissal (DAT-08, M5); a profile editor for the scoring reference set (M5; the link goes to the plan set-up).

### Product-owner decisions (2026-11-25) and what they became

1. Body-map artwork approved: used as built (`BodyMap`, `BodyMapList`, the new static `BodyMapMini`).
2. ECharts and the accessible chart pattern, 3 colours, the large figure with chips: every chart uses M4v's frame; ranges over a year use M4a's `aggregated` weekly maxima (the trend screen loads "all" when the "All" chip is chosen); `BodyMap` gets the whole column on the map screen and the exercise detail.
3. PRD v0.7 carries M4v's ANL-11 and MAP-01 wording and M4a's MOT-03, MOT-04, BOD-02, ANL-04 and ANL-07 wording, with the changelog row "approved by the product owner on 2026-11-25"; nothing else changed.
4. Accepted as built: the screens explain the streak rules in words; the grace switch is off by default in Settings → Insights.
5. The strength-trend noise review runs in parallel: no screen hard-codes a label, a week count or the noise value; the chart summary repeats the domain's label only.

### Decisions and deviations

| Concept / brief says                                                     | What I did                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAP-02 "tapping a region opens a panel"                                  | The panel is a route (`/explore/body-map/$muscleId`) with its own h1, Back and deep link: its "Why?" and plan-placement sheets would otherwise stack on a sheet. Back keeps the map's view, list and mode                       |
| §8.10 "Home sparklines (bodyweight trend, mini volume bars)"             | The bodyweight sparkline only (`Sparkline.tsx`, `aria-hidden`, the words beside it); the week's volume is the mini heat map                                                                                                     |
| ANL-01 mini heat map "through `import()`"                                | A static two-view figure (`BodyMapMini`, new in `ui/body-map/`), `aria-hidden` with the counts per band in words next to it and a link to the interactive map; lazy via `React.lazy`, so the artwork stays off the startup path |
| WKT-13 "volume by muscle (mini heat map)"                                | The week of the session with it included, from `dWeekly` (one calculation with the body map); per-session heat would need a different scale. The sets per muscle of the session stay as the list                                |
| Bodyweight route (§8.9.1 `/body`, `/body/log`)                           | As planned, reached from Home's card and the Progress hub; `?what=measurements` for measurements on the same log screen                                                                                                         |
| Units before the profile loads                                           | `/body` and `/body/log` wait for the profile, so nothing shows or saves in a default unit (found by the E2E test: en-US defaults to lb)                                                                                         |
| PR card animation (M3b: Web Animations on the summary, a fade from 60 %) | The CSS `pr-pop` on both cards, scale only at full opacity, so `app.css`'s reduced-motion rule makes both static and text contrast never dips                                                                                   |
| EXL-03 mini body map                                                     | The full-size `BodyMap` on the detail (a smaller interactive figure would push small regions under 24 px); tapping a muscle opens its panel                                                                                     |
| Exercise trend "best set"                                                | Charted as the heaviest set per session; the best-e1RM set would repeat the e1RM chart                                                                                                                                          |
| Search params as state                                                   | Library filters, the map's view/list/mode/sort, the trend source, the volume mode and muscle, the PR filters, the calendar month and the compare IDs live in the URL (Back restores them)                                       |
| Library filters                                                          | One value per dimension (the domain takes several)                                                                                                                                                                              |
| "Verify data"                                                            | `rebuildInsights` (derived weeks and the streak); the exercise-derived tables keep their own fingerprints                                                                                                                       |
| Screenshot names                                                         | The map screen's shots are `explore-body-map*`, because M4v's demo spec writes `body-map-*`                                                                                                                                     |

**Bugs found and fixed on the way:**

- `/body` flashed values in kg, and the log form could save in kg, before the profile (with lb on
  en-US devices) had loaded; both screens now wait for the profile (found by the E2E test).
- The PR scale-in (`pr-pop`, M3b) started at 60 % opacity, so the card's text was briefly below
  4.5:1 (axe caught it on the summary under load); it now scales at full opacity, for the
  session card, the summary's PR card and a new best streak.
- A sticky `ActionBar` on the short log forms could cover the note field once the error summary
  pushed the form down (axe `target-size`); the log forms keep Save and Cancel in the flow.
- The streak screen's visually hidden heading was clipped under +30 % strings; it is visible now.
- The idle warm-up first ran right after every mount of the shell, so a derived-data rebuild could
  compete with the start of a workout (and loaded every component test); it now waits 5 s, runs
  once per app run and never while a workout is active.

### Evidence

`pnpm verify` green on 2026-11-25 (exit 0): lint (0 errors, 0 warnings), format, token gate (27
colours; lowest text 4.56, on fills 5.41, UI 3.88, heat map 3.13, chart series 4.10; 636 colour
utilities in 236 files), knip, catalog check, typecheck, **971 unit and component tests in 93
files** (944 before; 27 new), build, licence gate (37 distributed, 841 build-only, passed), size
(**entry JS 182.21 kB gzip** of 186, was 178.71: the 17 new route definitions with their plain
search validators and the idle warm-up hook; no screen, chart or body-map code in the startup
chunk; CSS 7.11 kB; service worker 8.96 kB; precache 171 files + sw.js, 951.9 kB; **startup path
1 script, 0 with Zod**) and **65 E2E tests** (57 before; the 3 opt-in S-4 measurements skipped).

- **Component tests** (Vitest browser mode, real IndexedDB, axe zero serious or critical in each):
  `test/home.test.tsx` (Home after two workouts: next session, week progress, streak, PRs, the
  heat sentence and the lazy mini map, backup indicator; Home without a plan; the streak screen
  with its rules, weeks and a week marked as a break; the summary's week heat map; Settings →
  Insights saving grace and a site; "Verify data"), `test/body.test.tsx` (the log with its error
  summary, an implausible value, a decimal comma; the trend, rate and chart table; edit and
  delete; measurements), `test/library.test.tsx` (4: search, AND filters, chips and Clear all;
  the detail with marks, setup and training max; the custom form's errors, save and search;
  copying from bench press), `test/body-map-screen.test.tsx` (5: the panel, the MAP-07
  drill-down, add to today, the list alternative, the mode toggle), `test/progress.test.tsx` (6:
  hub; trend with table view, rep maxes and sessions; the volume table equal to `weeklyVolume`
  and the drill-down; PR filter; calendar search; scores), `test/pseudo-locale-m4.test.tsx` (21
  routes at +30 % strings and 360 px: no sideways scrolling, nothing clipped or off-screen).
- **E2E** (production build, CSP with Trusted Types; axe in light and dark and reflow at 320 px
  and 200 % text on every new screen): `e2e/home.spec.ts` (Home after backdated workouts with
  the next session, streak, PRs and the mini heat map, then the streak screen; bodyweight logged
  from Home in three taps, a week of weigh-ins, the trend and its table, measurements; the
  summary's week heat map and streak change, Settings → Insights, "Verify data"),
  `e2e/library.spec.ts` (hub, filters, detail, form errors, a custom exercise used in a freestyle
  workout), `e2e/body-map-screen.spec.ts` (tap → ranked list → add to today → the workout has it,
  also from a small-region chip and with no workout today; place in the plan, then the plan
  editor shows it), `e2e/progress.spec.ts` (four backdated workouts, range chips change the
  window, the table lists the sessions, compare; volume, PRs, calendar and scores).

**Screenshots** (360 × 780, light and dark, `M2B_SCREENS=<dir>`; `*-320px-200pct.png` for
reflow), handed to the coordinator outside the repository: `home`, `streak`, `body-log`, `body`,
`body-measurements-log`, `session-summary-week`, `settings-insights`, `data-verify`, `explore`,
`library`, `library-filtered`, `exercise-detail`, `custom-exercise-form`,
`custom-exercise-errors`, `explore-body-map`, `explore-body-map-back`, `explore-body-map-list`,
`muscle-panel`, `muscle-panel-focus`, `muscle-place-in-plan`, `progress`, `exercise-progress`,
`exercise-progress-table`, `compare`, `volume`, `volume-muscle`, `prs`, `calendar`, `scores`.

### Open items

- **Device (S22, TD-50):** TalkBack on the new screens (the muscle panel and the place-in-plan
  sheet, the evidence `<details>`, the native date, time and select inputs, the calendar), chart
  timings with real data.
- **TD-55…58** (technical concept §11.2): the hub's per-exercise e1RM and label (bulk use case);
  library multi-select filters and the custom form's equipment groups and substitution group;
  the backup indicator's cadence and dismissal (DAT-08, M5); the component tests' fixed browser
  port.
- "Include unavailable" has no component test (with the commercial-gym preset no chest exercise
  is unavailable); unknown IDs in `/progress/compare?ids=` are ignored silently.
- The library has 74 active exercises (PRD A-05 expects 150+ by MVP): a content task.
- Running the full suite while other agents load the machine, two M4v component tests can time
  out (`test/body-map.test.tsx` "measures every tap target…", 15 s; `test/timer-extras.test.tsx`
  the lead-in count); both pass in isolation.In one full run under load,
  these two and `test/charts.test.tsx` ("moves through the points with the keyboard", 15 s)
  timed out; the next full run passed all three unchanged (assertions not weakened).
- Two worktrees running `pnpm test` at once collide on Vitest's browser port 23315 (the app's
  Vite config makes it strict); locally `--api.port N --browser.api.port M` works (TD-58).

### Doc changes (docs pass for M4)

- **`docs/technical-concept.md` v0.8:** every amendment listed under "M4a analytics core" and
  "M4v charts, body map and timer extras" folded in (§0, §4, §5.1, §5.3–§5.5, §7.3, §8.2.2,
  §8.2.8, §8.3.4, §8.7.5, new §8.7.12, §8.8.2, §8.8.7, §8.9.1 routes as built in M4, §8.9.3,
  §8.9.9, new §8.9.10 insight screens, §8.10 and §8.11 as built with S-4 and S-5, §8.18, §8.19,
  §8.20, §9, §11.1, §11.2, A.3, A.4, Appendix B); TD-39, TD-43 (remainder → TD-54), TD-44 and
  TD-48 closed, TD-03 and TD-26 narrowed, TD-32 extended, TD-50…58 added; the product-owner
  decisions of 2026-11-25; changelog row 0.8.
- **`docs/PRD.md` v0.7:** ANL-11 and MAP-01 (M4v), MOT-03, MOT-04, BOD-02, ANL-04, ANL-07 (M4a),
  changelog row approved by the product owner on 2026-11-25; nothing else.
- **ADRs:** amendments (v0.8) in ADR-0007 (charts: S-4 go, the modular set, no tooltip, the
  Trusted Types shim, Recharts stays the fallback), ADR-0014 (routes as built in M4) and
  ADR-0019 (timer extras); the ADR index's status cells.

## M4 trend-label calibration (rules 1.6.0)

Written 2026-11-25 by the trend-noise evidence review the product owner asked for after M4a.
Result: the process noise per level (`load.trend.processSdPerWeek` novice 2, intermediate 1,
advanced 0.5 %/week) is supported by the literature and kept (re-sourced); the slow labels came
from the label rule, which is fixed (technical concept §8.7.5, "v0.8 trend-label calibration").

**Evidence (summary; sources added to `packages/rules/data/sources/load.yaml`):**

- Realistic gains: novice about 1–2 %/week, 3–4 % in the first weeks of a lift (Swinton 2022
  [MA], quartiles from the preprint, unverified against the published version; Ahtiainen 2003
  [OBS]; Mattocks 2017 [RCT-U]); trained about 0.2–1 %/week in 8–12-week trials, about
  0.1–0.3 % long-run (Androulakis-Korakakis 2020 [MA]; Rhea 2003 [MA]); advanced about
  0.02–0.1 %/week long-run (Solberg 2019 [OBS]; Häkkinen 1988 [OBS]; Latella 2020/2024).
- Day-to-day noise: tested 1RM 2–3.5 % in trained lifters (Grgic 2020 [SR]), 2–10 % untrained
  (Levinger 2009 [OBS]); e1RM about 4–5 % for heavy sets near failure (Refalo 2024; Hughes
  2019), about 7–10 % for typical logged sets (Zourdos 2021; Steele 2017; Nuzzo 2024 [MA]). The
  registry's 4 % and 9 % are supported.
- State-space practice: fix observation noise from reliability data, estimate process noise by
  maximum likelihood when data allow (Durbin & Koopman 2012; Muth 1960); per-person process noise
  is poorly identifiable and pooled priors predict better with scarce data (Kolossa 2017;
  Marchal 2025); level-specific priors individualised over time (Hecksteden 2017; Sottas 2007).

**Changes (rules 1.6.0):** `load.trend.reference` weeks by level (novice 4, intermediate 8,
advanced 8; sessions 3); the first 3 points are never the reference;
`load.trend.changeThresholds` gains `likelyZ` 1.5 (any claim also beyond 1.5 SD of Δ's own
uncertainty; first drafted at 1, set to 1.5 by the product owner on 2026-11-25, amended in place
without a version bump because 1.6.0 was unreleased) and `sustainSessions` 3; the rep-range flag
falls back to the oldest kept exposures. All POWR design values, `verified: false`.

**Simulation (300 seeded runs, 2 sessions/week; weeks to the first upward claim, median; rules
1.5.0 → 1.6.0 with `likelyZ` 1 → 1.6.0 with `likelyZ` 1.5, as shipped):** novice typical +2 %/wk
7.0 → 10.0 → 12.6, +3 % 5.0 → 8.0 → 9.6; intermediate typical +0.5 % never → 19.0 → never, +1 %
10.0 → 11.6 → 15.0, +3 % 4.6 → 6.0 → 7.0; intermediate heavy +0.5 % 13.0 → 11.0 → 12.0; advanced
heavy +0.5 % never → 13.0 → 13.6. False claims on flat series within 12 weeks, jitter at the
typical error: typical sets 10–13 % → 0 % → 0 %; intermediate heavy 17.3 % → 8.7 % → 3.7 %;
advanced heavy 11.3 % → 4.7 % → 2.7 %. Under stress noise (jitter = the filter's 9 %, closer to
real logged sets): about 82–87 % → 30–33 % → 6–9 % of flat typical-set series get a claim within
12 weeks (`likelyZ` 1.28 would have given about 14–16 %). Follow-ups: TD-59…TD-62.

`likelyZ` 1 → 1.5 in full (`trend-calibration.test.ts` snapshot; median weeks to the first upward
claim, "–" when most runs have none within 26 weeks, with the share claimed by 12 and 26 weeks):

| Level, sets          | Gain/week | `likelyZ` 1         | `likelyZ` 1.5       |
| -------------------- | --------- | ------------------- | ------------------- |
| novice typical       | +1 %      | 17.6 (23 % / 75 %)  | – (1 % / 12 %)      |
| novice typical       | +2 %      | 10.0 (96 % / 100 %) | 12.6 (48 % / 100 %) |
| novice typical       | +3 %      | 8.0 (100 % / 100 %) | 9.6 (99 % / 100 %)  |
| novice heavy         | +1 %      | 9.6 (76 % / 100 %)  | 10.0 (73 % / 100 %) |
| novice heavy         | +2 %      | 6.6 (100 % / 100 %) | 7.0 (100 % / 100 %) |
| novice heavy         | +3 %      | 5.0 (100 % / 100 %) | 5.6 (100 % / 100 %) |
| intermediate typical | +0.5 %    | 19.0 (6 % / 90 %)   | – (0 % / 6 %)       |
| intermediate typical | +1 %      | 11.6 (74 % / 100 %) | 15.0 (10 % / 100 %) |
| intermediate typical | +3 %      | 6.0 (100 % / 100 %) | 7.0 (100 % / 100 %) |
| intermediate heavy   | +0.5 %    | 11.0 (60 % / 100 %) | 12.0 (51 % / 100 %) |
| intermediate heavy   | +1 %      | 7.6 (100 % / 100 %) | 8.3 (100 % / 100 %) |
| intermediate heavy   | +3 %      | 4.6 (100 % / 100 %) | 4.6 (100 % / 100 %) |
| advanced typical     | +0.25 %   | – (0 % / 1 %)       | – (0 % / 0 %)       |
| advanced typical     | +0.5 %    | – (4 % / 44 %)      | – (0 % / 5 %)       |
| advanced heavy       | +0.25 %   | – (11 % / 45 %)     | – (9 % / 44 %)      |
| advanced heavy       | +0.5 %    | 13.0 (43 % / 100 %) | 13.6 (39 % / 100 %) |

False claims on flat series, within 12 / 26 weeks:

| Level, sets          | Jitter at the TE, `likelyZ` 1 | `likelyZ` 1.5   | Stress, `likelyZ` 1 | `likelyZ` 1.5   |
| -------------------- | ----------------------------- | --------------- | ------------------- | --------------- |
| novice typical       | 0 % / 0 %                     | 0 % / 0 %       | 31.0 % / 43.0 %     | 6.3 % / 11.7 %  |
| novice heavy         | 16.0 % / 65.0 %               | 11.3 % / 63.7 % | 15.7 % / 25.0 %     | 12.0 % / 22.3 % |
| intermediate typical | 0 % / 0 %                     | 0 % / 0 %       | 33.3 % / 55.0 %     | 9.0 % / 15.0 %  |
| intermediate heavy   | 8.7 % / 11.7 %                | 3.7 % / 6.0 %   | 20.7 % / 32.0 %     | 11.0 % / 21.3 % |
| advanced typical     | 0 % / 0 %                     | 0 % / 0 %       | 30.3 % / 39.7 %     | 7.0 % / 10.3 %  |
| advanced heavy       | 4.7 % / 5.0 %                 | 2.7 % / 3.0 %   | 11.0 % / 13.7 %     | 7.7 % / 10.3 %  |

What 1.5 costs: intermediate +0.5 %/week on typical sets is no longer labelled within 26 weeks,
even without noise (at 2 sessions a week 1.5 SD of the change is about 5.3 %, more than the
8-week gain of 4 %); heavy sets still show it within about 12 weeks. On a steady rise "likely"
(1.5 to 1.96 SD) is a narrow band, so a fast gain often goes from no label straight to "very
likely" (the +3 %/week test fixture does, at week 7.5). Novice heavy sets still over-claim under
jitter at their TE (64 % by week 26): TD-59.

The test's bounds follow: false claims under stress ≤ 12 % (typical sets) and ≤ 15 % (heavy) within
12 weeks, ≤ 20 % and ≤ 25 % within 26; jitter at the TE ≤ 5 % / 8 % for trained heavy sets and
≤ 15 % within 12 weeks for novice heavy sets; the speed bounds that moved sit just above the new
medians (novice typical +2 % ≤ 13 weeks and +3 % ≤ 10, novice heavy +3 % ≤ 6, intermediate
+1 % ≤ 16 typical and ≤ 9 heavy); intermediate +0.5 %/week is asserted on heavy sets (by 26
weeks in every run) instead of typical sets.

**Product-owner answers after M4b (2026-11-25):**

- The change-label gate is strict ("honesty first"): `likelyZ` 1.5 (rules 1.6.0 amended in
  place). Under realistic noise it claims a change in about 6–9 % of flat 12-week series of
  typical sets instead of 30–33 %; slower recognition is accepted (intermediate +1 %/week at
  about 15 weeks, novice +2 %/week at about 12.6).
- The startup budget stays 186 KB. M5 moves route search validation into the lazy route chunks
  to recover headroom (entry JS 182.2 KB now; TD-63).
- Accepted as built: the muscle panel as a full screen with a deep link, the summary heat map
  showing the whole week so far, and "Heaviest lifted" as the points-source label.
- Scheduled for M5: the content pass (library 74 → 150+ exercises, PRD A-05, TD-23; alternative
  templates, TD-37); TD-55 (per-exercise e1RM on the Progress list), TD-56 (multi-select library
  filters), TD-57 (backup reminder cadence); the trend follow-ups TD-59, TD-60 and TD-62.

**Test infrastructure after M4 (coordinator, 2026-11-25).** The browser component tests flaked
under load: in each full run a different real-time test timed out or raced (the body-map pixel
scan, the chart keyboard slider, the timed-set lead-in, the custom-exercise form). Three changes,
no assertion weakened:

- `pnpm test` runs the unit projects first (`pnpm test:unit`), then the browser project
  (`pnpm test:components`), so the 16 unit workers no longer compete with Chromium;
- the browser project runs one test file at a time (`fileParallelism: false`) with a 30 s test
  limit (`apps/web/vitest.components.config.ts`); it takes about 63 s instead of about 25 s and
  passed 4 of 4 consecutive runs (before: 1 failure in about every second run);
- the body-map pixel scan keeps its own 60 s limit (about 464,000 hit tests).

## M5d data, calendar and PWA

Written 2026-11-25 by the M5d work (roadmap A.4 "M5 Data, calendar, settings, legal, PWA polish",
the data, calendar and PWA part; M5s and M5p ran in parallel), plus TD-14 (in part), TD-55, TD-56
and TD-57. Status: see "Evidence".

### What landed

| Area              | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | PRD                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Data and backups  | `features/data/DataScreen.tsx`: "Storage protected: Yes/No" with the risk and how the browser decides, an explained "Protect my data" with its outcome, use and quota (or "not reported"); export with busy, saved, not-saved and failed states (with a storage-full hint); restore with checking, restoring and failed states; the backup reminder cadence; safety copies (save, delete with a confirmation sheet); "Verify data"; a link to Device support; "Delete all data"                                                                                                                                                             | DAT-01…08, DAT-13         |
| Backup reminders  | `@powr/application/data` (`reminder.ts`: `BACKUP_REMINDER`, `backupReminderState`, `observeBackupReminder`, `readBackupReminder`, `snoozeBackupReminder`, `setBackupReminderDays`), `hooks/use-backup-reminder.ts`, `features/data/BackupReminder.tsx` on Home (replaces M4b's fixed 14-day card) and on the workout summary; settings `backup.reminderDays`                                                                                                                                                                                                                                                                                | DAT-08, TD-57             |
| Safety copies     | `SafetySnapshots` port gains `list`, `read`, `delete`; `infrastructure/db/safety-db.ts`; `@powr/application/data` (`listSafetyCopies`, `saveSafetyCopy`, `deleteSafetyCopy`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                | §8.2.1, TD-14             |
| Delete all data   | `infrastructure/platform/wipe.ts` (lazy; deletes `powr`, `powr-safety`, `powr-diag` and `powr-runtime` through their own instances so nothing reopens them, clears `localStorage` and `sessionStorage`, closes notifications, reports what is left), `platform.deleteAllData` (stops the rest alerts first), `features/data/DataDeletedScreen.tsx` (replaces the whole app from the first step; "Start again" reloads into the first run), the `App.tsx` switch on `useAppUi.wipe`                                                                                                                                                          | DAT-13                    |
| Data update guard | `infrastructure/db/stored-version.ts` (`pendingUpgrade` from `indexedDB.databases()`, nothing opened), `infrastructure/db/raw-read.ts` (every store at the stored version; never creates or upgrades), `app/upgrade.tsx` (lazy: "Updating your data…", the safety snapshot before Dexie migrates, the recovery screen), `features/shell/RecoveryScreen.tsx`; `@powr/formats/backup` `encodeRawSnapshot` (a backup of any `dataVersion` from raw records, never refusing data); `@powr/application/backup` `snapshotBeforeUpgrade`, `saveRescueCopy` (`UpgradeEnv`); boot: snapshot → open → recovery on failure; the `versionchange` banner | DAT-14, §6.7 step 3, §6.8 |
| `.ics` encoder    | `@powr/formats/ics` (`encodeIcs`, `icsUid`, `escapeIcsText`, `foldIcsLine`, `ICS_MIME`): pure; CRLF; folding at 75 octets on whole UTF-8 characters; escaping; UTC `DTSTART` with `DURATION`, or all-day `VALUE=DATE` with an exclusive `DTEND`; `SEQUENCE`; `STATUS`; `VALARM` (never on a cancelled event); input checks that throw                                                                                                                                                                                                                                                                                                       | CAL-01…04                 |
| Calendar use case | `@powr/application/planning` `calendar.ts`: `previewCalendarExport`, `exportCalendar`, `recordCalendarExport`, `calendarExportStatus`; ranges rest of week, block, next N weeks, until the meet; the plan's start time per weekday with a fallback, a fixed time, or all-day; PLN-14 minutes (`dayMinutes`, rounded up to 5); main exercises and working sets in the description; reminders 0/15/30/60/120 min; re-export bookkeeping in `meta.calendarExport`                                                                                                                                                                              | CAL-01…05                 |
| Calendar screen   | `features/calendar/CalendarExportScreen.tsx` at `/plan/calendar` (Plan → "Add to calendar"), `ReexportNotice.tsx` on the Plan screen, `hooks/use-calendar.ts`, `app/public-origin.ts` (`VITE_PUBLIC_ORIGIN`, default `https://powr.invalid`)                                                                                                                                                                                                                                                                                                                                                                                                | CAL-01…05                 |
| Install promotion | `infrastructure/pwa/install.ts` (captures `beforeinstallprompt` at boot; first visit and dismissal in `localStorage`), `hooks/use-device.ts` (`useInstall`), `features/shell/InstallPromotion.tsx` on Home and the summary                                                                                                                                                                                                                                                                                                                                                                                                                  | PWA-02                    |
| Shortcuts         | manifest `shortcuts`: "Start today's session" (`/session?start=today&source=shortcut`) and "Log bodyweight" (`/body/log?source=shortcut`); `app/launch.ts` puts Home beneath a shortcut or a standalone deep-link launch                                                                                                                                                                                                                                                                                                                                                                                                                    | PWA-05, PWA-12            |
| Back gesture      | `ui/back-dismiss.tsx`: an open `Sheet` owns one same-URL history entry (TanStack Router `navigate` with `resetScroll: false`); Back closes it; closing it any other way takes the entry off; a sheet opening at once takes the entry over; stale entries are skipped (`watchSheetHistory`, loaded lazily by `AppShell`)                                                                                                                                                                                                                                                                                                                     | PWA-12                    |
| Device support    | `features/shell/DeviceSupportScreen.tsx` at `/settings/device-support` (also "What works on this phone" in Data and backups): 11 capabilities from runtime detection plus the timer alerts with the S-1 matrix, each with its status in words, what POWR does instead and the device-test state; the protocols named; the harness links in beta builds                                                                                                                                                                                                                                                                                      | PWA-13                    |
| Web Share         | `infrastructure/platform/share.ts` (lazy, `platform.share()`): the `.ics` file goes to the share sheet only where `navigator.canShare` accepts it; the download stays the default                                                                                                                                                                                                                                                                                                                                                                                                                                                           | PWA-09, CAL-05            |
| TD-14             | `features/shell/UpdateFirstOffer.tsx` on the start screen ("Update before you start?"); the `versionchange` banner ("POWR was updated in another window. Reload."); the safety-copy UI above                                                                                                                                                                                                                                                                                                                                                                                                                                                | TD-14                     |
| TD-55             | `@powr/application/insights` `exerciseSummaries` (bulk: two range reads, one `ensureDerived`, one `exerciseStates`, one points read for any number of rows); the Progress hub rows show the current e1RM and the change label in words with an icon                                                                                                                                                                                                                                                                                                                                                                                         | ANL-02, TD-55             |
| TD-56             | `features/library/search.ts` (arrays per dimension; old single-value links still work), `LibraryScreen.tsx` (checkbox groups with the OR-within, AND-across rule in words, a chip per value, "Clear all")                                                                                                                                                                                                                                                                                                                                                                                                                                   | EXL-02, TD-56             |
| Docs              | `docs/device-tests/S-2-protocol.md`, `docs/device-tests/S-6-protocol.md` (new; no other doc edited)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | V-07, V-02                |

### Product-owner decisions (2026-11-25) and what they became

1. **One config value for calendar UIDs and public URLs, default `powr.invalid`.** `app/public-origin.ts`: `VITE_PUBLIC_ORIGIN` (an http(s) origin, read by Vite at build time, so the deploy pipeline sets it per build) gives the origin, default `https://powr.invalid` (reserved TLD, RFC 2606); anything that is not an http(s) origin falls back to the default. The UIDs use its host. No `vite.config.ts` `define` and no lint allow-list change were needed. The origin constant stays module-private until a public URL uses it (knip); M5s can export it.
2. **Stable UIDs from the plan's IDs:** `UID:<plannedSessionId>@<host>` (`icsUid`). Planned-session IDs are UUIDv7 and never change for a session (moves, swaps and restores keep them; a backup restored on a new phone keeps them, so a re-export there updates the same events). The plan ID is not repeated in the UID: it would add about 37 characters (a folded `UID` line) and no uniqueness. Re-planning creates new sessions with new IDs; their predecessors are cancelled by the next export.

### Decisions and deviations

| Concept / brief says                                                                                 | What I did                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DTSTART` "with `TZID` or floating local time as the concept decides"                                | The concept (§6.6 step 3) decides UTC: each event's local wall-clock start is converted with Temporal in the device zone (`instantAt`) and written as `…Z`, so no `VTIMEZONE` is needed and DST is right per event (tests for both Zurich changes, unit and application level)                                                                                                                             |
| `UID` = `powr-<plannedSessionId>@<app-domain>` (§6.6)                                                | `<plannedSessionId>@<host>` (the product-owner wording); see decision 2                                                                                                                                                                                                                                                                                                                                    |
| `SEQUENCE` = the planned session's revision (§6.6)                                                   | The revision for a first export; afterwards the last exported sequence, plus 1 whenever the written event changes (time, length, texts, alarm) even without a new revision, so an export with another time or alarm also updates. A cancellation is the last sequence plus 1                                                                                                                               |
| "Re-export may add `STATUS:CANCELLED` events for removed sessions" (§8.13)                           | Built: an exported, upcoming session that was deleted, skipped, merged, put on a break or replaced by re-planning is written once as `CANCELLED` (same UID, its last summary and start), then never again. Exported sessions that moved or changed outside the chosen range are updated too, so a smaller range never leaves a stale time behind. Past and done sessions are left alone                    |
| Ranges "rest of week, mesocycle, next N weeks, until the meet" (CAL-01)                              | "Rest of this week", "This training block" (the current mesocycle), "Next 2/4/8 weeks", "Until your meet" ("No meet date is set" without one)                                                                                                                                                                                                                                                              |
| Start time "a default time the user picks at export" (CAL-02)                                        | "Your planned start times" (only if the plan has any) with a time for days without one, "The same time for every session", or "All-day events"                                                                                                                                                                                                                                                             |
| Event texts                                                                                          | Made in the app with Lingui (`CalendarTexts`); the use case is language-free. Title "POWR · Upper A (Week 3)", in a deload week "(Week 4, lighter week)"; description: the exercises with their working sets, then "About 70 minutes. Planned in POWR; open the app to train."; reminder text "Soon: <title>". No personal data                                                                            |
| "Re-export is offered when the plan changes" (CAL-04)                                                | `calendarExportStatus` compares the exported upcoming sessions with the live ones (revision, day, status); the Plan screen shows "N sessions changed since you added the plan to your calendar" with "Update your calendar", and the export screen says the same                                                                                                                                           |
| A safety snapshot "ZIP into `powr-safety`" before the upgrade (§6.7)                                 | As specified, as a regular backup file of the **stored** `dataVersion` (`encodeRawSnapshot`), so the normal restore migrates it later; the update does not run if the snapshot cannot be written (the recovery screen says so). No snapshot when the old database holds no user records                                                                                                                    |
| DB open failure: "retry, export what can be read, restore from backup, export diagnostics" (§6.8)    | "Try again", "Save a copy of your data" (every store at the stored version, read without Dexie, as a backup file) and "Export diagnostics". Restore from a backup is not offered there: it needs the database open at the current version, which is what failed. Nothing is ever deleted                                                                                                                   |
| Detecting a pending upgrade                                                                          | `indexedDB.databases()` before opening (Chromium 71+; the Chromium 130 baseline has it). Without it the upgrade still runs atomically, only without the snapshot                                                                                                                                                                                                                                           |
| Safety copies "auto-pruned after 30 days or after a newer regular backup" (§8.2.1)                   | Not built: only the existing rotation (the latest two) deletes a copy; silently deleting old data is the riskier side. Open decision                                                                                                                                                                                                                                                                       |
| "Delete all data" removes "caches of user data" (DAT-13)                                             | The four databases and both web storages. Cache Storage holds only app files (the precache and `version.json`), so it stays and POWR still opens offline for the first run. `indexedDB.databases()` lists nothing afterwards (E2E)                                                                                                                                                                         |
| Delete all "returns to first-run onboarding"                                                         | A deletion screen replaces the app ("All data deleted", focused heading); "Start again" reloads into the welcome screen. Reloading at once would open (and so create) an empty `powr` before anyone could check, and the screen confirms what happened                                                                                                                                                     |
| Install-prompt state "in `meta`" (§8.2.2)                                                            | In `localStorage` (`powr.install`): the first visit and a dismissal belong to the browser, not to the training data a backup moves to another phone                                                                                                                                                                                                                                                        |
| "Never on first visit" (PWA-02)                                                                      | The first page load on a browser never shows the card; later page loads do (Home after onboarding, the summary of a finished workout); never during a workout; not again for 14 days after "Not now" or a dismissed browser dialog                                                                                                                                                                         |
| Samsung Internet "illustrated instructions" (PWA-02)                                                 | Steps in words with the menu icon, hedged ("Menus differ between versions"); to be confirmed by S-2 cell 1                                                                                                                                                                                                                                                                                                 |
| Shortcuts: "Start today's workout", "Log bodyweight", "Quick timer", "Last workout summary" (PWA-05) | The first two (the brief's scope; there is no quick timer yet, TMR-15). Both use the 192 px app icon (no shortcut artwork yet); M0's "Log a set" shortcut is replaced                                                                                                                                                                                                                                      |
| Back gesture: "every screen has a parent" (§8.9.1)                                                   | A shortcut or a standalone deep link opened as the first entry of a window gets Home beneath it (`seedLaunchHistory`, with a `history.flush()` between the replace and the push, because TanStack batches the history writes of one task). Prompts before discarding unsaved edits (`useBlocker`) in the plan and equipment editors are not built (not in M5d's files)                                     |
| Device support "summarized in Settings → About → Device support" (PWA-13)                            | Route `/settings/device-support`, Back goes to Settings. M5s owns the Settings screen, so the entry for now is "What works on this phone" in Data and backups. The protocols are named as repository paths (they are not shipped); the S-1 and S-2 harness links show in beta builds only                                                                                                                  |
| Device support levels                                                                                | "Works here", "Limited", "Not available here", "Downloaded instead" (a deliberate fallback, info tone, not an error), "Cannot be checked from the app"; every row says "Device test S-2 has not run yet" until S-2 has results (there is no S-2 matrix)                                                                                                                                                    |
| Backup reminder snooze                                                                               | "Remind me later" hides a due reminder for 3 days (`meta.backupReminder.snoozedUntil`); a backup resets the reminder; a design value                                                                                                                                                                                                                                                                       |
| "After N new sessions (default 8)" (DAT-08)                                                          | 8, a constant: finished and partial workouts that ended after the last backup, counted only while that backup is under 30 days old (older is due for every cadence anyway, so the read stays small)                                                                                                                                                                                                        |
| The cadence setting                                                                                  | Settings `backup: { reminderDays: 7 \| 14 \| 30 \| null }`; absent = "Automatic" (14 days, 7 while storage is not protected); off turns both triggers off                                                                                                                                                                                                                                                  |
| New use cases as lazy entries                                                                        | Calendar in the existing lazy `@powr/application/planning` (it needs the rules and `dayMinutes`); reminders and safety copies in a new entry `@powr/application/data`, imported statically only by lazy screens, so no new `LAZY_*` lint pattern. The backup codec stays in `@powr/application/backup`; the data-update guard (`app/upgrade.tsx`) has its own sanctioned `import()` with a disable comment |
| Entry JS (shared by three parallel agents)                                                           | The new screens, the encoder, the wipe, the share adapter, the guard and the back-gesture code are lazy; on the startup path are only the install-prompt capture, the stored-version check, the launch seeding, two route definitions, the `versionchange` banner and the container's small additions                                                                                                      |
| A type cycle                                                                                         | `DataScreen` and `DeviceSupportScreen` link to each other; TypeScript then inferred the route tree through the components and dropped `/settings/device-support`. An explicit `ReactElement` return type on `DeviceSupportScreen` breaks the cycle                                                                                                                                                         |

**Bugs and gaps found on the way:**

- TanStack Router's browser history batches every `push`/`replace` of one task into a single native history write, so two writes in a row lose the first; `seedLaunchHistory` flushes between them.
- The `Sheet` component had no back-gesture handling: on Android, Back left the screen behind an open sheet. Now Back closes the sheet first.
- Dexie closes a database on `versionchange` with auto-open still on, so a later write recreates a deleted database; the wipe deletes through each Dexie instance (auto-open off) and turns diagnostics logging off.
- The calendar screen's time field first had the same label as its fieldset ("Start time"), which made both ambiguous for screen readers (the component test found it); the field is "Time for every session" now.

- A sheet whose page keeps its state in the URL (the library's Filters sheet replaces the URL on every change) first closed itself on the first change, because the replaced entry looked like Back (found by the library E2E). Now only a step back closes a sheet, and the URL the page set while the sheet was open is kept after Back.

### PRD coverage (requirement → screen or element)

| ID             | Where                                                                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DAT-01, DAT-02 | Unchanged (local only; strict durability); "Delete all data" and the guard write nothing outside the origin                                                                                                                                                                                                                  |
| DAT-03         | Data and backups: "Storage protected: Yes/No" with an icon, the risk in one sentence, how the browser decides, "Protect my data" and its outcome; the reminder default drops to 7 days and shows prominently (border, shield icon, a sentence) while unprotected; device support lists it                                    |
| DAT-04         | "Using 5.5 MB of the 10.7 GB this browser allows", or "Storage use: not reported by this browser"; a failed export says to free space                                                                                                                                                                                        |
| DAT-05         | One tap "Export backup" with busy, "Saved to Downloads as …", "Not saved" and failure states; "Export a backup first" in the delete sheet                                                                                                                                                                                    |
| DAT-06         | Restore with "Checking the file…", "Restoring…", and "The restore did not complete. Nothing was changed."; the safety copy before a restore is listed                                                                                                                                                                        |
| DAT-07         | Old raw data becomes a backup of its own `dataVersion` (`encodeRawSnapshot`), imported through the existing migration chain (formats test with the v1 fixture)                                                                                                                                                               |
| DAT-08         | Reminders on Home and the workout summary: no backup with training data, older than the cadence (7/14/30 days or off; 14 by default, 7 unprotected), or 8 workouts since; "Remind me later" (3 days); the cadence in Data and backups                                                                                        |
| DAT-13         | "Delete all data…": an "Export a backup first" offer, typed DELETE in a sheet (two steps), every database and both storages deleted, "All data deleted", "Start again" into the first run                                                                                                                                    |
| DAT-14         | Safety snapshot before the update; a failing update is rolled back by IndexedDB; the recovery screen with "Save a copy of your data", "Export diagnostics", "Try again"; a fixed version updates the same data (E2E with a simulated failing migration); migrations never run during a workout (the install gate, unchanged) |
| CAL-01         | Plan → "Add to calendar" (`/plan/calendar`): rest of the week, this block, next 2/4/8 weeks, until the meet; RFC 5545 output (unit tests, E2E checks the file); Samsung and Google import is S-6                                                                                                                             |
| CAL-02         | Title "POWR · Upper A (Week 3)", the planned start time per weekday, a chosen time or all-day, the PLN-14 duration, the exercises with their sets, reminders none/15/30/60/120 min; no personal data                                                                                                                         |
| CAL-03         | UTC per event from the local wall-clock time; both Zurich DST changes tested                                                                                                                                                                                                                                                 |
| CAL-04         | `<plannedSessionId>@<host>` UIDs, `SEQUENCE` up on every change, `STATUS:CANCELLED` for sessions that are gone; "Your plan changed" on the Plan and export screens; the duplicates note with the removal hint                                                                                                                |
| CAL-05         | Download by default; "Share with a calendar app" only where `canShare` accepts the `.ics`; the import guide (Samsung Calendar, Google Calendar) focused after the export; works offline (precached chunks)                                                                                                                   |
| PWA-01         | Manifest unchanged except the shortcuts (icons, standalone, no orientation lock)                                                                                                                                                                                                                                             |
| PWA-02         | Install card on Home and the summary from the second page load, never during a workout, "Not now" for 14 days; Chrome's own dialog, Samsung Internet's menu steps                                                                                                                                                            |
| PWA-03         | Every new screen and chunk is precached (185 files); the calendar export and the device-support screen work offline                                                                                                                                                                                                          |
| PWA-04, TD-14  | "Update before you start?" on the start screen (never during a workout); "POWR was updated in another window. Reload."                                                                                                                                                                                                       |
| PWA-05         | Two manifest shortcuts, opened offline, Home beneath them                                                                                                                                                                                                                                                                    |
| PWA-09         | `.ics` sharing only where allowed; backups always download (P-04); diagnostics download                                                                                                                                                                                                                                      |
| PWA-12         | Back closes sheets first, then leaves the screen; leaving `/session` keeps the workout (E2E); stable deep links; a shortcut's Back goes to Home                                                                                                                                                                              |
| PWA-13         | `/settings/device-support`: 11 capabilities plus the alerts row with the S-1 matrix, statuses in words with icons, the fallback per row, the device-test state; S-1/S-2 protocols named                                                                                                                                      |
| PWA-14         | Unchanged; the new screens use `pt-safe` and the shell's safe areas                                                                                                                                                                                                                                                          |
| ANL-02 (TD-55) | Progress hub rows: current e1RM ("still calibrating" where so) and the change label in words with an icon                                                                                                                                                                                                                    |
| EXL-02 (TD-56) | Multi-select filters per dimension, chips per value, "Clear all"                                                                                                                                                                                                                                                             |

**Not built (and why):** PWA-05's "Quick timer" (TMR-15 does not exist yet) and "Last workout summary"; PWA-09 sharing of session summaries and PR cards as images (MOT-09, v1.2); PWA-10 share target (v1.x); the save picker for backups (TD-15, waits for S-2); safety copies' 30-day auto-prune (decision); unsaved-edit prompts in the editors (`useBlocker`; not M5d's files); CAL-06 milestone events (v1.x); an S-2 capability matrix compiled like S-1's (open decision); per-category storage estimates (photos, safety copies) from DAT-04 (photos are v1.2). TD-63 (route validators into the lazy chunks) was not in this brief.

### Evidence

`pnpm verify` green on 2026-11-25 (exit 0): lint (0 errors, 0 warnings), format, token gate, knip, catalog check, typecheck, 986 unit and 107 component tests, build, licence gate, size and 73 E2E tests (3 opt-in skipped). Four earlier runs stopped only at the component step, because another worktree's Vitest held the fixed browser port 23315 (TD-58); everything before it was green each time. In detail:

- **Unit and property tests:** 986 tests in 82 files (882 before). New: `packages/formats/test/ics.test.ts` (74: golden calendar, CRLF, folding of ASCII, umlauts, CJK and emoji at 75 octets, escaping, UTC and both Zurich DST changes, durations, triggers, UID rules, cancellations, input checks, fast-check fold/unfold, escape and structure properties), `packages/formats/test/snapshot.test.ts` (3: a v1 database as a v1 backup the import migrates; a record import would reject is kept; invalid versions), settings `backup` schema and hostile-key cases, `packages/application/test/m5d.test.ts` (13: reminder rules, inputs and the strict settings record, safety copies, upgrade snapshot and rescue copy, calendar export UIDs/times/durations/alarms, a move raising `SEQUENCE` and the "plan changed" status, `STATUS:CANCELLED`, DST, all-day and errors), `packages/application/test/summaries.test.ts` (TD-55, 4), `apps/web/src/features/library/search.test.ts` (TD-56, 3), `apps/web/src/infrastructure/db/upgrade-guard.test.ts` (5, fake-indexeddb: pending update without opening, raw read without upgrading or creating, **a simulated failing migration: snapshot, rollback, rescue copy, then a fixed update of the same data**, delete all with nothing reopened, the public origin).
- **Component tests** (browser mode, real IndexedDB, axe in each): 107 in 19 files (98 before). New `test/m5d.test.tsx` (8: Data and backups with storage, cadence and a safety copy deleted after its sheet; delete all with the exact typed word; the Home reminder and "Remind me later" with focus; the calendar export with the field error, the download, the stored export and the focused guide; device support; the install card on a later visit and none during a workout; the recovery screen; "Update first"); `progress.test.tsx` (TD-55) and `library.test.tsx` (TD-56) extended; `home.test.tsx` waits for the reminder.
- **E2E:** 73 passed, 3 opt-in skipped (65 before). New `e2e/m5d.spec.ts` (8): delete all → every IndexedDB database and both storages gone → "Start again" → welcome; the backup reminder after a workout, "Remind me later", the cadence saved; **the failing data update** (a v1 database seeded from the v1 fixture, `put`/`update` patched to throw in the version change): the recovery screen (axe, reflow), still IndexedDB version 10, "Save a copy of your data" downloads a v1 backup with every session and set, the diagnostics name `db.upgrade` and `db.recovery`, a page without the patch updates to version 20 with the same counts and lists the safety copy; the `.ics` download (file name, CRLF, ≤ 75 octets per line, one `VEVENT` and one 30-minute alarm per session, UIDs `@powr.invalid`, 18:30 Zurich = 17:30Z, the same UIDs on a second export); Back closes a sheet before the screen, a closed sheet leaves no entry, during a workout Back closes the sheet, then goes Home with the workout running, Forward returns with the set; a shortcut window opened on `/body/log?source=shortcut` goes Back to Home; the install card never on the first visit nor during a workout, once on the summary, then not again; device support with 11 rows, honest statuses and the install row. axe in light and dark and reflow at 320 px and 200% text on every new screen. `e2e/library.spec.ts` (TD-56) gets a 90 s limit (its filter sheet adds two axe scans and a reflow; 18 → about 30 s under load); `e2e/progress.spec.ts` extended (TD-55).
- **Size:** entry JS **183.56 kB** gzip of 186 (182.21 before: the install capture, the stored-version check, the launch seeding, two route definitions, the stale-window banner, the container's additions; about 0.1 kB are TD-56's validators); CSS 7.22 kB; service worker 9.16 kB; precache 185 files + sw.js, 991.6 kB; **startup path 1 script, 0 with Zod**. Licence gate passed.
- **Lint** 0 warnings, format, token gate, knip, catalog check, typecheck: clean.

**Screenshots** (360 × 780, light and dark; `*-320px-200pct.png` for reflow; handed over outside the repository): `data`, `data-delete-all`, `data-deleted`, `data-safety-copies`, `data-verify`, `home`, `home-backup-reminder`, `session-summary`, `install-promotion`, `calendar-export`, `plan-week`, `device-support`, `recovery-upgrade`, `progress` (TD-55), `library`, `library-filtered`, `library-filters` (TD-56).

### Open items

- **Device tests:** S-2 (`docs/device-tests/S-2-protocol.md`) and S-6 (`docs/device-tests/S-6-protocol.md`) on the S22; their results change the Device support texts, the Samsung Internet install steps, the import guide and the duplicates note. A manual TalkBack pass of the new screens (the delete sheet, the cadence radio cards, the recovery screen, the device-support rows, the install card's focus after "Not now").
- **Merge:** the startup budget is shared by three agents; M5d adds about 1.2 kB. TD-63 (route search validation into the lazy route chunks) would win back roughly 1 kB if the merge needs it.
- `VITE_PUBLIC_ORIGIN` must be set by the deploy pipeline (`deploy/`, CI) before the first beta with calendar exports; until then UIDs end in `@powr.invalid`, which calendar apps accept.
- Settings should link Device support (M5s's screen); until then the link is in Data and backups.
- The calendar export runs the PLN-14 estimate per session; a plan with very long ranges (52 weeks) is untested on the S22 for speed.
- Unsaved-edit prompts on Back in the plan and equipment editors (PWA-12's "asks before discarding unsaved edits").

### Doc amendments for the docs pass

- **Technical concept §6.6:** UID `<plannedSessionId>@<host>` from the one public-origin value (`VITE_PUBLIC_ORIGIN`, default `powr.invalid`); `SEQUENCE` = revision for a first export, then up by one on every change of the written event; cancellations and out-of-range updates as built; the range and time choices; the event texts; `meta.calendarExport`.
- **§6.7 step 3, §6.8:** the guard as built (`indexedDB.databases()`, the raw read, the snapshot as a backup of the stored `dataVersion`, no update without it, the recovery screen's three actions, no restore there); the `versionchange` banner.
- **§8.2.1:** "Delete all data" as built (the four databases through their own instances, both storages, notifications; Cache Storage kept as app files only; the deletion screen and "Start again"); safety copies listed with save and delete, no auto-prune (pending decision); the `SafetySnapshots` port's `list`, `read`, `delete`.
- **§8.2.2:** the install-prompt state lives in `localStorage`, not `meta`; `meta` gains `backupReminder` and `calendarExport`; settings gain `backup.reminderDays` (unreleased version 2 amended again).
- **§8.2.5, DAT-08:** the reminder rule as built (cadence, 8 workouts, 3-day snooze, the unprotected default).
- **§8.3.4:** `encodeRawSnapshot` (older `dataVersion` files from raw records).
- **§8.4:** the manifest shortcuts as built; the deep-link launch puts Home beneath.
- **§8.9.1:** Back and sheets as built (`ui/back-dismiss.tsx`); `/plan/calendar` and `/settings/device-support`; TanStack's batched history writes.
- **§8.13:** `@powr/formats/ics` as built (all-day `DTEND`, no `VALARM` on cancelled events, input checks, no `node-ical`: a test-local RFC 5545 reader).
- **§8.23:** the Device support screen as built (levels, the S-1 matrix for alerts, "Device test S-2 has not run yet").
- **§11.2:** TD-14 narrowed (the "Update first" offer, the safety-copy UI and the other-window handling are built; the one-tap start from Home skips the offer); TD-55, TD-56, TD-57 closed; new items: the S-2 matrix, the safety-copy auto-prune decision, unsaved-edit prompts.
- **PRD (proposals, not edited):** PWA-05 lists the two shortcuts built; DAT-08 states the 3-day "Remind me later"; CAL-02 "a time chosen at export" includes "All-day events"; DAT-13 says that a confirmation screen precedes the first run.

## M5s settings, legal and explainability

Written 2026-11-25 by the M5s work (roadmap A.4 "M5 Data, calendar, settings, legal, PWA
polish", the settings, legal and explainability part; M5p and M5d ran in parallel). Status:
`pnpm verify` green (numbers under "Evidence"). Nothing committed; the product owner commits.

### What landed

| Area                 | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | PRD                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Settings, organised  | `features/settings/SettingsScreen.tsx`: one page in ten sections (profile and plan, units, training, workout, alerts, insights, appearance, data, legal, about), each a region named by its h2 with an anchor (`parts.tsx`, `scroll-mt-16`), an "On this page" list of in-page links at the top                                                                                                                                                                                                                                                                                                                    | SET-01…11                      |
| Profile and plan     | `ProfileSection.tsx`: every onboarding answer in words with "Change", equipment ("Manage equipment"), "Set up a (new) plan"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | SET-06, SET-08                 |
| One answer changed   | `ProfileAnswerScreen.tsx` at `/settings/profile/$answer` (goal, experience, schedule, body, priorities, baselines): the onboarding question prefilled, "Save" → `previewProfileChange`; no plan change → stored at once; a plan change → "Your plan would change" with the changes in words and the whole new plan (`PlanPreviewView` with its "Why?"), then "Update my plan from <date>" / "Keep my current plan" (or "…and days" for a schedule) / "Back to the question"                                                                                                                                        | SET-08                         |
| Units                | `UnitsSection.tsx` (weights, body weight, lengths) → `setUnits`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | SET-02                         |
| Training             | `TrainingSection.tsx`: effort as RIR or RPE, effort entry by one tap per value or half steps, warm-up sets on/off, first day of the week (moved here), "Choices per exercise"; `TrainingAdvanced.tsx` (collapsible): main-lift and assistance progression, e1RM formula, lighter-week interval, each with its evidence default and "Use the evidence default"                                                                                                                                                                                                                                                      | SET-05, SET-11                 |
| Per-exercise choices | `ExerciseChoicesScreen.tsx` at `/settings/exercises`: the plan's, recent and chosen exercises with "Keep as last time" (manual mode) and the rest timer "As set for all / Starts by itself / When I tap it"; remembered rests with "Forget"                                                                                                                                                                                                                                                                                                                                                                        | TMR-01, PRG-03, PRG-09, TMR-03 |
| Rest times           | `RestTimesScreen.tsx` at `/settings/rest` (linked from Workout): seven rest contexts with steppers (±15 s, typed values saved after a pause), the evidence default for the user's style and level (strength: "squat and deadlift 4:00"), evidence label, "Your setting", the out-of-range note, per-row "Use the evidence default", "Reset all rest times" (optionally the per-exercise ones too)                                                                                                                                                                                                                  | SET-03, TMR-02                 |
| Workout display      | `WorkoutSection.tsx` "Workout display": larger controls (`features/settings/display.ts`, `[data-large-controls] [data-dock]` in `app.css`: 56 px targets, larger text), celebration animations on/off (session and summary PR cards, best streak)                                                                                                                                                                                                                                                                                                                                                                  | SET-10                         |
| Effort words         | `features/settings/effort.ts` (`useEffortWords`): "RIR 2" / "RPE 8", targets "1–2 reps in reserve" / "RPE 8–9"; used by the dock (chips read 10…6 and "≤5" with RPE; a half-step stepper with decimal entry), the exercise list, past sets, the plan's prescriptions, the "Why?" set list, the library history and the progress rep-max table                                                                                                                                                                                                                                                                      | SET-05                         |
| Legal texts          | `features/legal/texts/` (`Disclaimer.tsx`, `Privacy.tsx`, `Imprint.tsx`, `parts.tsx`) rendered as React elements at `/legal/$page` (`disclaimer`, `privacy`, `imprint`, `how-powr-decides`, `attributions`; one route replaces `/legal/privacy` and `/legal/disclaimer`); `LegalScreens.tsx` (titles, versions, the "Draft" marker)                                                                                                                                                                                                                                                                                | LEG-01, LEG-02, LEG-09         |
| Publisher details    | `features/legal/publisher.ts`: the one module with every publisher and legal detail (person, trading name, country, `tools@sz-development.com`, hosting, the postal address and the legal-review date as explicit placeholders); no imports, so plain Node loads it                                                                                                                                                                                                                                                                                                                                                | LEG-09                         |
| Release gate         | `pnpm release:check` (`apps/web/scripts/release-check.ts`): fails while a placeholder remains; step "Legal release check" in the production job of `.github/workflows/deploy.yml`, before the image is promoted; not in `pnpm verify` or `ci.yml`                                                                                                                                                                                                                                                                                                                                                                  | product-owner decision         |
| Attributions         | `/legal/attributions` (`texts/Attributions.tsx`, `attributions-data.ts`): the build's `attributions.json` (precached), software with licence, copyright, the full NOTICE (ECharts) and the licence text behind "Licence text", then POWR's own work; `tools/licence` now writes the distributed assets of `assets-inventory.yaml` into `attributions.json` (`kind: 'asset'`)                                                                                                                                                                                                                                       | LEG-06, LEG-08                 |
| How POWR decides     | `/legal/how-powr-decides` (`texts/HowPowrDecides.tsx`): suggests-never-decides, where numbers come from, the five evidence labels and their study types, preliminary values (with the count), the registry, content and engine versions, then 13 areas (e1RM and trends, volume, progression, lighter weeks, rest, warm-ups, session details, planning, readiness, body weight, points, streaks, rankings), each in plain words with "The values behind it": every registry value with its label, evidence, "Preliminary value" and sources, and the area's full citations; each value has an anchor `#param-<id>` | LEG-05, PRG-09                 |
| "Why?" sheet         | `features/why/WhySheet.tsx`: each parameter by its label, with "How POWR decides" (to its anchor; works with or without a router); a "Sources" list with full citations (authors, year, details, DOI and source links that open in a new tab); `evidence.ts` (labels), `citations.tsx`, `param-labels.ts`                                                                                                                                                                                                                                                                                                          | TD-33, PRG-09                  |
| Citations            | `packages/rules/scripts/citations.ts` (`@powr/rules/citations/node`: `parseCitation`, `compileCitations`, `loadCitations`) reads `data/sources/*.yaml`; `apps/web/scripts/citations-plugin.ts` serves it as `virtual:powr-citations`, generated on every build and dev start through Vite's module runner, imported with `import()` (12.8 kB gzip lazy chunk)                                                                                                                                                                                                                                                      | TD-33                          |
| Parameter labels     | `features/why/params/labels.ts`: 143 `params.<id>` messages, typed `satisfies Record<ParamId, MessageDescriptor>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | TD-33                          |
| Lazy catalogs        | `lingui.config.ts`: two more catalogs, `legal` (`features/legal/texts`, 6.2 kB gzip) and `params` (`features/why/params`, 3.2 kB); `i18n/index.ts` `loadCatalog(name)` merges one on first use; `scripts/i18n-check.ts` checks every catalog                                                                                                                                                                                                                                                                                                                                                                       | §8.19                          |
| Use cases            | New lazy entry `@powr/application/settings` (`setAlertSettings` (TD-42), `restTimes`, `setRestTime`, `resetRestTimes`, `resetExerciseRest`, `exerciseChoices`, `setExerciseChoice`, `setTrainingPreferences`, `setDisplayPreferences`, `setUnits`, `trainingParameters`, `setTrainingParameter`); planning entry: `profileAnswers`, `previewProfileChange`, `saveProfileChange` (`planning/profile.ts`); root: `ALERT_DEFAULTS`, `TRAINING_DEFAULTS`, `DISPLAY_DEFAULTS`; `startWorkout` reads the warm-up switch                                                                                                  | TD-42, SET-08                  |
| Settings record      | Unreleased v2 amended: `training` (`effortScale` 'rir'/'rpe', `rirInput` 'chips'/'decimal', `warmups`) and `display` (`largeControls`, `celebrations`), both strict and optional; arbitraries and a strictness test                                                                                                                                                                                                                                                                                                                                                                                                | SET-05, SET-10                 |

### Product-owner decisions (2026-11-25) and what they became

1. **Publisher:** "Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland", e-mail
   `tools@sz-development.com`, in `LEGAL_DETAILS` (privacy notice, imprint, About, both notices'
   contact lines).
2. **Postal address a placeholder, in one config module:** `postalAddress` is a `Placeholder`
   ("the postal address of the publisher (LEG-09)"); the texts say "Postal address: to be added
   before the public release." The legal-review date is a second placeholder (V-05/V-06), so the
   gate also holds the drafts back.
3. **Release gate:** `pnpm release:check` fails today with both placeholders (exit 1, the list in
   the message); `deploy.yml` runs it first in the production job (pnpm and Node set up, no
   install); `pnpm verify` and `ci.yml` do not run it. The "Draft" marker (an outlined warning
   callout naming what is missing) shows on the health notice, privacy notice and imprint while
   any placeholder remains; since production cannot deploy with one, only dev and beta builds
   show it.
4. **Domain:** no domain anywhere; the texts need no public URL. If a later text needs the
   website's address it takes M5d's public-URL setting (default `powr.invalid`).

### PRD coverage (requirement → screen or element)

| ID                     | Where                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SET-01                 | Appearance: System / Light / Dark, applied without a reload (unchanged behaviour, own section)                                                                                                                                                                                                                                          |
| SET-02                 | Units: weights, body weight, lengths (`setUnits`; display only, no drift)                                                                                                                                                                                                                                                               |
| SET-03                 | `/settings/rest`: rest per context, superset transition, warm-up rests, reset to evidence defaults (also the per-exercise rests); auto-start and count-up in Workout; pre-alert timing in Alerts                                                                                                                                        |
| SET-04                 | Alerts (M3t; now through `setAlertSettings`)                                                                                                                                                                                                                                                                                            |
| SET-05                 | Training: RIR or RPE, chips or half steps, warm-ups, week start; advanced: main-lift and assistance progression, e1RM formula, lighter-week interval; rounding, check-in and hints stay in Workout                                                                                                                                      |
| SET-06                 | Profile and plan → "Manage equipment" (`/settings/equipment`)                                                                                                                                                                                                                                                                           |
| SET-08                 | "Change" per answer → one question → no re-plan when the plan stays the same, else the preview and "Update my plan from <next week>" / "Keep my current plan" (the next block or the next plan uses it)                                                                                                                                 |
| SET-09                 | Legal (health notice, privacy notice, publisher and imprint, How POWR decides, licences and attributions) and About (version and build, rules registry and content versions, publisher, "Questions or feedback" by e-mail)                                                                                                              |
| SET-10                 | Keep screen on and vibration (Alerts, M3t); Workout display: larger controls, celebration animations (reduced motion still applies)                                                                                                                                                                                                     |
| SET-11                 | Training → first day of the week                                                                                                                                                                                                                                                                                                        |
| TMR-01, PRG-03, PRG-09 | `/settings/exercises`: per-exercise auto-start; "Keep as last time" (manual mode)                                                                                                                                                                                                                                                       |
| LEG-01                 | `/legal/disclaimer`: §8.1 in full (not medical advice, see a doctor first, stop and get help with 112, lifting safely, pain and readiness as self-tracking, nutrition limits incl. under 18, your decisions), version, re-acknowledged on a new version (versions bumped to 2026-11-25)                                                 |
| LEG-02                 | `/legal/privacy`: §8.2 in full (in short, responsible publisher, what is stored where and why incl. health data, what we do not do, hosting with Hetzner in Germany and no access logs, permissions, backups unencrypted, data loss, deleting, rights under revFADP and the GDPR incl. the FDPIC, legal framework, changes and contact) |
| LEG-03                 | Unchanged (onboarding confirmation); the notices name the under-18 limits                                                                                                                                                                                                                                                               |
| LEG-05                 | `/legal/how-powr-decides`, linked from Settings and from every parameter in a "Why?" sheet                                                                                                                                                                                                                                              |
| LEG-06, LEG-08         | `/legal/attributions` from the build's `attributions.json`: every distributed package and asset, the ECharts NOTICE; E2E: the screen lists exactly the distributed entries of `licence-inventory.json`                                                                                                                                  |
| LEG-07                 | All new copy: no diagnosis, no prediction, "suggests; you decide"                                                                                                                                                                                                                                                                       |
| LEG-09                 | `/legal/imprint` and the privacy notice's responsible party, offline                                                                                                                                                                                                                                                                    |
| TD-33                  | Full citations and labels in the "Why?" sheet and "How POWR decides"                                                                                                                                                                                                                                                                    |
| TD-42                  | `setAlertSettings` in `@powr/application/settings`; the hook calls it                                                                                                                                                                                                                                                                   |
| TD-49                  | All of it (see SET-03, SET-05, TMR-01, PRG-03, PRG-09)                                                                                                                                                                                                                                                                                  |

**Not built (and why):** SET-07 advanced science settings (Could, v1.x); SET-09's changelog
(NFR-MNT-07: `tools/release-notes` and `changelog.json` do not exist yet) and "Device support"
(PWA-13, M5d's area); LEG-04 pre-participation self-screening (Should; wording and licensing to
check, §8.4); voice cues (SET-04 Could); a website copy of the legal texts as static HTML
(`legal/*` in the image, technical concept §7.1; the texts live in the app only so far).

### Decisions and deviations

| Brief or concept says                                                         | What I did                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings in "clear sections"                                                  | One page with ten sections and an "On this page" list (the E2E and component tests address sections by region); deeper editors are routes: `/settings/profile/$answer`, `/settings/rest`, `/settings/exercises`                                                                                                                                                                                                                                                                                                                     |
| Legal routes `/legal/privacy`, `/legal/disclaimer`                            | One route `/legal/$page` (five pages), so the startup route tree grows by one route, not three; the URLs stay the same                                                                                                                                                                                                                                                                                                                                                                                                              |
| Legal, attribution and citation data lazy                                     | Texts and parameter labels in their own Lingui catalogs, citations a virtual module, attributions fetched from the precached `attributions.json`; the boot catalog grew only by the new settings strings (50.7 → 52.7 kB gzip)                                                                                                                                                                                                                                                                                                      |
| Citations "generated at build time" by a generator in the rules build scripts | `packages/rules/scripts/citations.ts` plus a Vite plugin in the app, so the chunk never goes stale when the registry changes (no committed copy to regenerate at merge); plain Node cannot load the rules scripts (extensionless imports), so the plugin uses `runnerImport` like `tools/content-build`                                                                                                                                                                                                                             |
| "Why?" sheet links each parameter to its entry                                | A plain same-origin link that navigates in-app through the router when there is one (component previews render the sheet without a router)                                                                                                                                                                                                                                                                                                                                                                                          |
| SET-08 "regenerate from next week or next mesocycle, or only future plans"    | "Update my plan from <start of next week>" (this week's sessions stay; the old plan ends then); "Keep my current plan": the answer is stored and the next block's proposal reads experience, priorities, avoid and the reference set from the profile anyway, so "next mesocycle" needs no extra step; style and training days belong to the plan and apply to the next plan the user sets up. A schedule change that does not change the plan (start times, a session length that still fits) updates the plan's schedule in place |
| "Re-plan only when needed"                                                    | `previewProfileChange` generates the plan for the old and the new answers with the same options (template if the style stays, block length, variety, seed, week start) and compares template, block, days, targets and level; equal → no re-plan                                                                                                                                                                                                                                                                                    |
| SET-05 advanced values                                                        | Registry overrides (§8.6.3) through `setTrainingParameter` with short choice keys; a main-lift model applies to every level; APRE and the RTS chart are not offered                                                                                                                                                                                                                                                                                                                                                                 |
| Rest overrides                                                                | A value equal to the evidence default removes the override (so a registry update still reaches the user); a global strength rest also replaces the squat/deadlift variant, which the row says                                                                                                                                                                                                                                                                                                                                       |
| Effort as RPE                                                                 | Display and entry only; records and the engine keep RIR. Onboarding still asks in RIR (before the preference exists)                                                                                                                                                                                                                                                                                                                                                                                                                |
| Publisher module location                                                     | `features/legal/publisher.ts` with a file-level `lingui/no-unlocalized-strings` disable (names and addresses are data), as `ui/body-map/artwork.gen.ts` does                                                                                                                                                                                                                                                                                                                                                                        |

**Found on the way:** axe flagged an invalid `<dl>` (dt/dd inside nested divs) in my first
profile summary (now a list); the rest stepper snapped back to the stored value when cleared before
typing (now an empty field is a draft of its own).

### Evidence

`pnpm verify` green on 2026-11-25 (exit 0), run in this worktree (the component tests waited for
another worktree to free Vitest's browser port, TD-58): lint (0 errors, 0 warnings), format, token
gate, knip, catalog check (three catalogs), typecheck, **907 unit tests in 80 files and 113 component tests in 21 files** (882 and 98 before),
build, licence gate (37 distributed, 841 build-only, passed), size (**entry JS 182.72 kB gzip** of
186, was 182.21: one net route more, the settings defaults in the root entry, the settings hooks;
startup path 1 script, 0 with Zod), **70 E2E tests** (65 before; the 3 opt-in S-4 measurements skipped); precache 189 files + sw.js, 1016.1 kB.

- **Unit:** `packages/application/test/m5s.test.ts` (alert settings, rest times and their reset,
  the session resolving a user's rest, training and display preferences, warm-ups off at the
  start, per-exercise choices, units, the advanced choices, SET-08: no re-plan, re-plan from next
  week with this week kept, keep the plan, schedule-only change, invalid answers, stale preview,
  no plan, reference set); `packages/formats/test/backup.test.ts` (the new settings objects are
  strict); `packages/rules/scripts/citations.test.ts` (every active source, no excluded one, every
  cited source has a citation, parsing never loses text); `apps/web/scripts/release-check.test.ts`
  (fails with the placeholders, passes when filled, the CLI exits 1);
  `apps/web/src/features/why/params.test.ts` (a label for every registry parameter in the shipped
  catalog); `tools/licence/test/gate.test.ts` (distributed assets in the attributions).
- **Component** (real IndexedDB, axe in light and dark): `test/settings-m5.test.tsx` (the ten
  sections in order with their anchors, units, training and display preferences, the advanced
  choices with reset, rest times with the out-of-range note and reset, per-exercise choices),
  `test/profile-edit.test.tsx` (an answer without a re-plan, a schedule change with its preview
  and update, keeping the plan for a priority, an incomplete answer pointed out),
  `test/legal.test.tsx` (privacy notice in full with the draft marker and mail links, health
  notice, imprint, attributions with the real ECharts NOTICE and own work, the missing-file
  message, How POWR decides opening the linked value, the "Why?" sheet with labels and full
  citations).
- **E2E** (`e2e/settings-legal.spec.ts`, production build with Trusted Types): a strength rest of
  200 s reaches a squat set (3:20 instead of 4:00) and the reset brings 4:00 back; a schedule
  change in Settings shows the re-plan preview and updates the plan; the legal screens before
  onboarding with the lazy texts, the draft marker and the versions; a "Why?" sheet in a workout
  links to its value in How POWR decides (focused and in view); the attributions screen equals
  `attributions.json` and the distributed entries of `licence-inventory.json`, with the ECharts
  NOTICE byte for byte. axe in light and dark and reflow at 320 px and 200% text on each.

**Screenshots** (360 × 780, light and dark; `*-320px-200pct.png` for reflow), in the coordinator's
scratchpad `m5s-screens/`: `settings`, `settings-rest-times`, `settings-profile-edit`,
`settings-replan-preview`, `why-sheet-citations`, `legal-privacy`, `legal-disclaimer`,
`legal-imprint`, `legal-how-powr-decides`, `legal-attributions`.

### Open items

- **Legal review (M6, V-05/V-06):** both texts and the imprint are drafts; fill `postalAddress`
  and `legalReview` in `publisher.ts`, bump `versions.ts` if the wording changes, then
  `pnpm release:check` passes. To confirm there: GDPR applicability, the FDPIC/EU authority
  wording, 112 as the emergency number, the imprint content for Switzerland and the EU, whether
  the hosting sentence about transient connection data is enough.
- **Merge with M5p:** a new registry parameter needs its label in
  `features/why/params/labels.ts` (the type and `params.test.ts` fail until it has one), then
  `pnpm i18n:extract`; new sources need nothing (the citations are generated).
- **Merge with M5d:** `routeTree.gen.ts` and the catalogs regenerate; the data link in Settings
  points at `/data`; if M5d adds settings fields to the v2 record they sit next to `training` and
  `display`.
- **TalkBack on the S22:** the "On this page" links, the profile rows' "Change" names, the rest
  steppers with their hint, the re-plan preview's reading order, the RPE chips' names, the long
  attributions list.
- TD-58 (the component tests' fixed port) made `pnpm verify` wait for another worktree.

### Proposed PRD wording (not edited)

- **SET-05:** "RPE or RIR display and entry (RPE = 10 − RIR; records keep RIR); RIR entry by one
  tap per value (0–4, 5+) or in half steps."
- **SET-08:** "… choose whether to update the current plan from the start of next week (this week
  stays as planned) or keep it; experience, priorities, exercises to avoid and the reference set
  then reach the next block's proposal, style and training days the next plan. Only an answer
  that changes the plan asks; the new plan is shown before anything is stored."
- **SET-09:** "… and a contact route by e-mail (`tools@sz-development.com`)."
- **LEG-09:** "… a postal contact address (a release check blocks production until it is
  provided) and e-mail."

### Doc amendments for the docs pass

- Technical concept §8.9.1 (routes: `/legal/$page`, `/settings/rest`, `/settings/exercises`,
  `/settings/profile/$answer`), §8.12/§8.21 (attributions include the distributed assets;
  `pnpm release:check` in the production deploy), §8.6.4 (How POWR decides as built: generated
  from the resolved registry and the citations chunk), §8.9.8 (the "Why?" sheet as built: labels
  and full citations; TD-33 closed), §8.8.7 (TD-42 closed), §8.2.2 (settings `training` and
  `display`), §8.15 and §8.19 (lazy `legal` and `params` catalogs, the citations chunk), §11.2
  (TD-33, TD-42, TD-49 closed).

## M5p content and engine follow-ups

Written 2026-11-25 by the M5p work (the M5 content pass and the trend follow-ups, in parallel with
M5d and M5s): TD-23 / PRD A-05 (library 74 → 190 exercises), TD-37 (alternative templates), TD-59,
TD-60 and TD-62. Content 0.2.0 → **0.3.0**, rules 1.6.0 → **1.7.0** (`1.7.0+127ea5b9a286`),
`ENGINE_VERSION` 0.1.0 → **0.2.0**. Status: every `pnpm verify` stage green; see "Evidence" for the runs.

### What landed

| Task                   | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-23 / A-05 library   | 116 new exercises in `packages/content/data/exercises/*.yaml` (each file's header names the EB rows the new entries follow); `packages/content/package.json` 0.3.0; `content.json`, `ids.lock.json` (+124 IDs: 116 exercises, 5 substitution groups, 3 templates) and the `powr-content-*` inventory entries rebuilt by `pnpm content:build`                                                                                                                                                                                                          |
| TD-37 alternatives     | `templates/bb-full-body-5day.yaml` (PRD-named "Full body ×5"), `bb-full-body-4day.yaml` ("Full body ×4"), `bb-upper-lower-6day.yaml` ("Upper/lower ×3"), all `default: false`                                                                                                                                                                                                                                                                                                                                                                         |
| TD-59 TE floor         | `trendObservation` (`packages/domain/src/trend/index.ts`): σ = max(σ_set, TE[level]); `ObservationRules` gains `load.trend.typicalErrorCv`                                                                                                                                                                                                                                                                                                                                                                                                            |
| TD-60 memory, 12 weeks | `MAX_POINTS` 30 → 60 and `MAX_RECENT` 12 → 60 (`packages/domain/src/session/history.ts`); `load.trend.reference` advanced 8 → 12 weeks (`packages/rules/data/load.yaml`, rules 1.7.0)                                                                                                                                                                                                                                                                                                                                                                 |
| TD-62 "no label" text  | `labelChange` passes `reason: 'noise' \| 'unconfirmed'` with `trend.change.none`; `why.trend.change.none` selects on it (`apps/web/src/features/why/{messages,args}.ts`, `en/messages.po`)                                                                                                                                                                                                                                                                                                                                                            |
| Tests                  | `tools/content-build/test/coverage.test.ts` (A-05 size, the six preset gaps closed, PRD-named alternatives), `packages/domain/test/reference/trend.test.ts` (TE floor, 12-week window, TD-62 reason), `session/reference.test.ts` (60 points and exposures, the 12-week reference), `trend-calibration.test.ts` (snapshot and bounds), `packages/application/test/m2c.test.ts` (the override lists and generates the alternatives), plan-matrix snapshot, `planning.test.ts` (rules 1.7.0), `apps/web/e2e/m2c.spec.ts` (two plans now need four days) |

**Why 60 and 60 (TD-60 asked for at least 40 / 30).** The change label needs a point
`load.trend.reference` weeks back (now 12 for advanced lifters) that is not one of the kept series'
first 3 points, and the rep-range flag needs the exposures on or before that date. At 4 sessions
a week of one lift that is 12 × 4 + 4 = 52 points; 40 would cover 3 sessions a week only. Both
lists hold a few numbers per entry, so 60 costs little in `dExerciseState`. Stored states rebuild
on first use: the rules stamp, the content version and `ENGINE_VERSION` are all part of the
derivation key, and the engine version had to move anyway because TD-59 changes outputs for the
same inputs (§7.8).

**TD-62 as built.** "No label" now has two texts. Within one typical error: "That's within normal
day-to-day variation (about 3.3%), so there's no real change yet." (unchanged). Beyond one typical
error but not yet beyond `likelyZ` SD of its own uncertainty, or not for 3 sessions in a row:
"That's more than normal day-to-day variation (about 3.3%), but it isn't a confirmed change yet.
POWR calls it real once the trend is clear enough and the change holds over a few sessions in a
row." No new rule ID was needed (`RuleId` is unchanged); the arg is the domain's, the text the
"Why?" catalog's.

### Content stats (0.2.0 → 0.3.0)

- **Exercises:** 74 → **190** active (isolation 98, compound 92; unilateral 7 → 36). By pattern:
  horizontal push 7 → 19, core 5 → 15, hinge 6 → 14, elbow flexion 5 → 14, squat 5 → 12, vertical
  push 4 → 12, elbow extension 4 → 11, hip extension 3 → 10, horizontal pull 5 → 9, vertical pull
  4 → 8, lunge 2 → 8, knee flexion 3 → 8, shoulder abduction 3 → 7, calf 4 → 7, horizontal
  adduction 2 → 7, horizontal abduction 4 → 7, shrug 2 → 5, hip abduction 1 → 4, hip adduction
  1 → 4, knee extension 2 → 3, wrist flexion 1 → 3, wrist extension 1 → 3; carry 0 (see open items).
- **By load type:** machine/cable 19 → 49, bodyweight + added 16 → 39, barbell 16 → 38, dumbbell
  19 → 38, band 3 → 24, bodyweight-assisted 1 → 2. Curve class: pooled 146, equation 34 (every
  competition lift and close variant, the bench-like presses and push-ups), leg-press-like 10.
- **By equipment** (exercises that use an item of the category): free weights 86, bars 39, benches
  35, cables 28, accessories (bands, landmine) 28, machines 25, racks 20, bodyweight stations 12,
  no equipment at all 24.
- **Per display group** (exercises crediting it ≥ 0.5 / = 1.0): chest 31/28, front delts 30/12,
  side delts 15/7, elbow flexors 29/14, forearms 10/6, abs 12/8, obliques 15/6, quads 29/23,
  adductors 34/5, tibialis 0/0, upper traps 8/5, mid back 16/9, lats 17/17, rear delts 16/16,
  triceps 42/16, lower back 14/6, glutes 49/27, hamstrings 24/14, calves 7/7.
- **Per preset** (available exercises): commercial gym 74 → 190, home barbell gym 54 → 128,
  dumbbells and bench 29 → 63, bodyweight and bands 19 → 60, hotel gym 37 → 91, "Custom (empty)"
  10 → 24. Every display group except the optional tibialis has ≥ 2 exercises crediting it ≥ 0.5
  under every preset with equipment (EXL-01): the six M1 gaps are closed (bodyweight and bands ×
  calves, forearms, lower back, upper traps; dumbbells and bench × upper traps; hotel × upper
  traps), and `KNOWN_PRESET_GAPS` is empty.
- **Credits:** 217 → 526 (H 42 → 74, EMG 4 → 9, C 171 → 443). H and EMG tags only where the EB row
  names the exercise or the same loaded movement (loaded curls Mannarino 2021, rows Mannarino 2021,
  pulldowns Gentil 2015, flat-bench variants PubMed 24265879, incline presses PubMed 34644424 (EMG),
  hip thrusts Plotkin 2023, straight-knee calf raises Kassiano 2023, good morning Bourne 2017 as in
  the RDL row, triceps extensions Maeo 2023); band versions, kickbacks, Smith-machine and other
  extrapolations are C, as M1 did. No new source was needed.
- **Competition variants (EXL-07):** squat: paused, **tempo**, **pin**; bench: long-pause,
  close-grip, **Spoto**, **pin**, **Larsen**; deadlift: deficit, **block pull**, **paused**. All
  have `fixedRom`, rest class `strength`, strength reps within 1–6 and the equation curve class.
- **Substitution groups:** 29 → 34 (new: `sg.lat-isolation`, `sg.upright-row`, `sg.pull-through`,
  `sg.back-extension`, `sg.trunk-rotation`); no single-member group is left (M1 had seven).
- **Judgement calls:** the floor back extension sits in `core` (no spinal-extension pattern); the
  diamond push-up credits the pec 0.5 (hands closer than the close-grip bench); the handstand
  push-up rates overload suitability 0 (it cannot be made lighter, so the pike push-up stays the
  first bodyweight press); incline and low-to-high flies credit the clavicular head but do not rank
  it, so a plain chest-fly slot keeps the pec deck or flat fly. Exercise names that carry a
  person's name (Arnold, Spoto, Larsen press; "Bayesian curl" as a search synonym) are the common
  names of the movements; all cues are written for POWR.

### TD-37: the alternative templates

| Cell            | Default (unchanged)          | New alternative                   | Levels                         | Why                                                                 |
| --------------- | ---------------------------- | --------------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| Bodybuilding ×5 | Upper/lower + push/pull/legs | **Full body ×5** (`fullBody`)     | intermediate, advanced         | Named by PLN-02 ("Upper/Lower + PPL hybrid or Full body ×5")        |
| Bodybuilding ×4 | Upper/lower ×2               | **Full body ×4** (`fullBody`)     | novice, intermediate, advanced | POWR addition: shorter whole-body sessions; each muscle 2–3× a week |
| Bodybuilding ×6 | Push/pull/legs ×2            | **Upper/lower ×3** (`upperLower`) | intermediate, advanced         | POWR addition: shorter sessions than PPL; each muscle 2–3× a week   |

Each alternative serves only levels its cell's default serves, differs from it in split, and gives
every major muscle slots on at least two days (PLN-04). The override sheet (M2c `TemplateChooser`)
lists them without UI changes: `templateChoices` returns every template of the style, and an
alternative for the user's days and level shows "Fits your training days and your level." below
the recommended plan; choosing it generates with `plan.template.chosen` and its split text. The
coverage test now asserts the PRD-named alternative and that every alternative has a default in
its cell, and `m2c.test.ts` checks the override end to end: for five bodybuilding days the sheet's
fitting choices are the upper/lower + PPL default (recommended) and Full body ×5, which then
generates with `plan.template.chosen`; four and six days list their alternative; a novice is
refused Upper/lower ×3 with `plan.template.levelMismatch`. Powerlifting and powerbuilding
cells have no alternative (the PRD names none).

### Plan matrix (PLN-01) and the snapshot diff

18 templates × 6 presets × 3 levels × 6 budgets = **1,944 combinations** (was 1,620): **996 plans**
(was 744), 552 expected `plan.lift.unavailable` (unchanged) and 396 expected
`plan.template.levelMismatch` (was 324: Full body ×5 and Upper/lower ×3 are not offered to
novices). Every plan and every next block has no avoidable violation, only available exercises and
every over-budget day flagged, at all six budgets; generation stays below 1 s.

First-plan snapshot (60 minutes), against the 0.2.0 content:

- 270 → 324 lines: +54 for the three alternatives (18 lines each; 6 of them per 5- and 6-day
  alternative are novice `levelMismatch` lines).
- Of the 270 existing lines, **62 changed** and 208 are identical. **No powerlifting line
  changed** (the lift slots take the competition lifts as before: the new close variants tie with
  them on score and sort after `ex.barbell-*`). Changed lines by template: BB 2-day 12, 3-day 13,
  4-day 13, 5-day 8, 6-day 8; PB 2-, 4-, 5- and 6-day 2 each. By preset: home barbell gym 17,
  custom 13, bodyweight and bands 12, dumbbells and bench 11, commercial gym 7, hotel gym 2.
- Exercises per plan in the changed lines: −1 in 6, equal in 27, +1 in 14, +2 in 7, +3 in 4,
  +4 in 2, +5 in 2 (bodyweight and bands PPL ×2: 24 → 29 exercises, its forearm and upper-trap
  slots now have candidates). Sets: −2 to +9 (mostly +1).
- Violations in the 270 lines 559 → 560, all with an input cause: `slotLimit` 117 → 100 (slots
  that had no candidate of their pattern now have one), `timeBudget` 268 → 283 (the extra sets meet
  the 60-minute budget), `template` 66 → 67, `sessionCap` 6 → 8, `equipment` 102 → 102;
  `volume.belowFloor` 139 → 137, `volume.low` 341 → 342, `frequency.muscle` 79 → 81 (side delts
  on one day only at 60 minutes in the bodyweight-and-bands upper/lower ×2 plans for intermediate
  and advanced lifters, cause `timeBudget`).
- Examples: `bb-ppl-6day | bodyweight-bands | intermediate` 24 ex, 95 sets, 6 violations → 29 ex,
  104 sets, 3 (forearms and upper traps no longer below the floor, hamstrings no longer low);
  `bb-full-body-2day | commercial-gym | intermediate` 14 ex, 38 sets → 15 ex, 37 sets.

Next-block snapshot (PLN-13 at 60 minutes): 124 → 166 lines (+42 for the alternatives' plans);
**96 of 124 changed**, because the next block rotates one or two exercises per muscle and now has
more candidates to rotate to (and more of them at the slot's top score). Violations 559 → 578
(`timeBudget` 281 → 308, `template` 165 → 157, `slotLimit` 110 → 108, `sessionCap` 3 → 5), all
with a cause; no powerbuilding or powerlifting guarantee changed.

Sample plans (commercial gym, intermediate, no budget) read as before: back squat, dumbbell bench,
seated cable row and RDL stay the full-body anchors (so the M2c baselines step asks for the same
lifts); new picks appear where they now score highest or win the ID tie-break among equal scores
(behind-the-body cable curl, EZ-bar overhead triceps extension, leg-press calf raise, cable
rear-delt fly, barbell split squat).

### Trend calibration (TD-59, TD-60), rules 1.6.0 → 1.7.0

`trend-calibration.test.ts` (300 seeded runs, 2 sessions a week; median weeks to the first upward
claim, "–" when most runs have none within 26 weeks, then the share claimed by 12 / 26 weeks).
`likelyZ` stays 1.5. Only the rows below moved: the TE floor binds only for novices (5.5% > 4%;
trained 3.3% < 4%), the 12-week window only for advanced lifters. Intermediate and novice-typical
rows are unchanged.

| Level, sets      | Gain/week | 1.6.0               | 1.7.0                                       | Cause |
| ---------------- | --------- | ------------------- | ------------------------------------------- | ----- |
| novice heavy     | +1 %      | 10.0 (73 % / 100 %) | 12.0 (54 % / 95 %)                          | TD-59 |
| novice heavy     | +2 %      | 7.0 (100 % / 100 %) | 7.0 (99 % / 100 %)                          | TD-59 |
| novice heavy     | +3 %      | 5.6 (100 % / 100 %) | 5.6 (100 % / 100 %)                         | —     |
| advanced typical | +0.25 %   | – (0 % / 0 %)       | – (0 % / 0.3 %)                             | TD-60 |
| advanced typical | +0.5 %    | – (0 % / 5 %)       | **24.0** (0 % / **70 %**)                   | TD-60 |
| advanced heavy   | +0.25 %   | – (9 % / 44 %)      | **19.8** (11 % / **78 %**)                  | TD-60 |
| advanced heavy   | +0.5 %    | 13.6 (39 % / 100 %) | 13.6 (40 % / 100 %); noise-free 17.0 → 13.6 | TD-60 |

False claims on flat series, within 12 / 26 weeks:

| Level, sets      | Jitter at the TE, 1.6.0 | 1.7.0              | Stress, 1.6.0   | 1.7.0           |
| ---------------- | ----------------------- | ------------------ | --------------- | --------------- |
| novice heavy     | 11.3 % / **63.7 %**     | 5.7 % / **14.7 %** | 12.0 % / 22.3 % | 11.0 % / 19.7 % |
| advanced typical | 0 % / 0 %               | 0 % / 0 %          | 7.0 % / 10.3 %  | 6.7 % / 14.3 %  |
| advanced heavy   | 2.7 % / 3.0 %           | 3.7 % / 5.0 %      | 7.7 % / 10.3 %  | 7.3 % / 14.7 %  |

TD-59 removes the novice heavy-set over-claim (63.7% of flat series claimed by week 26 → 14.7%)
at the cost of a later label for +1% a week on heavy sets (10 → 12 weeks). TD-60 lets advanced
lifters' good-block gains show (+0.25% a week on heavy sets: 44% → 78% of runs by week 26; +0.5%
on typical sets: 5% → 70%); the longer window raises their 26-week false-claim rates under stress
to about 14–15%, within the existing bounds (≤ 20% typical, ≤ 25% heavy). Bounds changed
deliberately: novice heavy sets at the TE now ≤ 8% within 12 weeks and ≤ 18% within 26 (was
≤ 15% within 12, 26 weeks unbounded); new: advanced heavy +0.25% a week ≤ 21 weeks and ≥ 70% by
26, advanced typical +0.5% a week ≥ 60% by 26. The describe title says rules 1.7.0.

Evidence for the registry change (rules 1.7.0: 143 parameters, unchanged count; 38 `verified:
false`, unchanged): `load.trend.reference` advanced 8 → 12 weeks keeps its sources and its
`verified: false` (a POWR design value at the EB's upper end, "slope over the last 8–12 weeks",
EB §Progression › Classification); the note says why 12 is now possible. `load.trend.typicalErrorCv`
gained a note that it is also the observation-noise floor (value unchanged). `pnpm --filter
@powr/rules build -- --diff <1.6.0 rules.json>` lists the one value change.

### Decisions and deviations

| Brief says                                            | What I did                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cover every movement pattern                          | Every pattern except `carry`: a carry has no honest rep range, and `ExerciseDefaults` requires one (duration or distance defaults are a domain-model change outside M5p). Tibialis has no pattern either                                                                                                                                                             |
| Raise `MAX_POINTS` / `MAX_RECENT` to at least 40 / 30 | 60 / 60, so 12 weeks fit at up to 4 sessions a week of one lift (above)                                                                                                                                                                                                                                                                                              |
| TD-62: a separate message or args                     | An arg (`reason`) on the existing rule: no `RuleId` change in `@powr/domain/explain`                                                                                                                                                                                                                                                                                 |
| TD-37: alternatives "as the PRD table names them"     | The one PRD-named alternative (Full body ×5) plus two POWR additions for the other bodybuilding cells with a common second split (4 and 6 days); listed for the product owner below                                                                                                                                                                                  |
| Owned files                                           | Also `packages/domain/src/version.ts` (`ENGINE_VERSION` 0.2.0, §7.8: outputs changed), `packages/application/test/planning.test.ts` (the rules-version pin) and one assertion of `apps/web/e2e/m2c.spec.ts`: the template sheet now shows "Needs 4 training days a week." twice (Upper/lower ×2 and Full body ×4), so the test expects two and the Full body ×4 card |

### Evidence

`pnpm verify` on 2026-11-25, every stage green: lint (0 errors, 0 warnings), format, token gate,
knip, catalog check, typecheck, **907 unit tests** in 76 files (882 before: +25 in coverage,
trend, session, calibration and M2c tests), **98 component tests**, build, licence gate, size and
**65 E2E tests** (3 skipped, as before). The last full runs shared the machine with the other M5
agents (load average 20–25) and did not finish in one pass: twice the component run could not
start (port 23315 taken by another agent's Vitest browser server), once the legal-gate focus test
flaked (see open items), and twice `e2e/library.spec.ts` hit its 30 s limit inside the parallel
E2E run (27.1 s in the baseline run; 12.5 s alone under the same load). Run 6 and run 7 passed
everything through `pnpm size`; the E2E suite then passed in full on its own against the same
build (65 passed). Size: entry JS **182.21 kB** gzip (unchanged; the content is a lazy chunk), the
content chunk `built-in-*.js` 150.9 → **282.8 kB** raw, 17.5 → **30.6 kB** gzip, precache
953.2 → **966.4 kB** gzip of 2,000 kB. `pnpm content:check` is clean with no preset coverage gap;
the plan-matrix test (1,944 combinations, plans and next blocks) takes about 10 s.

### Open items

- **Product owner:** (1) keep the two POWR-added alternatives (Full body ×4, Upper/lower ×3) or
  ship only the PRD-named Full body ×5; and whether powerlifting or powerbuilding cells should get
  alternatives (none named in PLN-02); (2) carries and a tibialis exercise need a contract change
  (duration/distance defaults, a dorsiflexion pattern), so TD-23 keeps that remainder; (3) among
  exercises with equal MAP-03 scores the generator picks by ID, which now decides some defaults
  (Arnold press over the dumbbell shoulder press in the hotel gym, the behind-the-body cable curl
  over the incline dumbbell curl); a "standard choice" tie-break (or favouring fewer pieces of
  equipment) would be a ranking decision; (4) the content judgement calls listed above (diamond
  push-up pec 0.5, handstand push-up overload 0, flies that credit but do not rank the clavicular
  head, the floor back extension in `core`).
- **For the M5 merge:** the past-session list's trend label (`apps/web/src/features/session/past/parts.tsx`,
  "Within normal day-to-day variation") has the same inaccuracy TD-62 fixed in the "Why?" text; it
  can read `ChangeLabel.deltaPct` against `typicalError` (or the explanation's `reason`) in the
  owner's pass. `en/messages.po` changed in one entry (`why.trend.change.none`); a parallel catalog
  change merges by re-running `pnpm i18n:extract`.
- **Flaky component tests (a latent focus race, more frequent with the larger library):** two
  browser tests fail now and then: the legal gate's focus check (`onboarding.test.tsx`) and the
  custom-exercise error summary (`library.test.tsx`: focus never reaches the summary within
  10 s, although the summary is on screen). Both screens focus the summary in a
  `requestAnimationFrame` right after `setState` (`OnboardingFlow.tsx` line 169,
  `CustomExerciseScreen.tsx` line 311); the frame can come before React commits the summary, and
  then nothing is focused. Observed while the other M5 agents loaded the machine (load average
  5–9): with the 0.3.0 content the library test failed in 4 of about 10 full component runs and
  the legal-gate test in 2; with the 0.2.0 `content.json` swapped back in, the legal-gate test
  failed 1 of 3 runs and the library test none. The fix is to focus in an effect after the
  summary renders (a counter state set with the issues, and `useEffect(() => { if (count > 0)
  summaryRef.current?.focus() }, [count])`); it is UI code outside M5p's files and was not made
  here. A re-run passes.
- **Later:** per-user process noise (TD-61, unchanged); the personal curve fit (TD-26).

### Doc amendments for the docs pass

- **PRD:** A-05 met (190 exercises); EXL-01 coverage met for every preset (tibialis optional);
  §7.1 "carry" still has no exercise; PLN-02 table: bodybuilding 4 days "Upper/Lower ×2 or Full
  body ×4", 6 days "Push/Pull/Legs ×2 or Upper/Lower ×3" if the product owner keeps them.
- **Technical concept §8.7.5:** σ is floored at the level's typical error (TD-59); the reference
  window is novice 4, intermediate 8, advanced 12 weeks (rules 1.7.0); the session engine keeps 60
  strength-trend points and 60 recent exposures; "no label" explains `noise` vs `unconfirmed`
  (TD-62); the calibration numbers above.
- **§8.12 / M1 status line:** content set 190 exercises (526 credits: 74 H, 9 EMG, 443 C),
  34 substitution groups, 15 default and 3 alternative templates; content 0.3.0.
- **§7.8:** `ENGINE_VERSION` 0.2.0, rules 1.7.0.
- **§11.2:** TD-23 closed except carries and tibialis (needs a contract change); TD-37 closed for
  bodybuilding (PL and PB pending a product decision); TD-59, TD-60 and TD-62 closed.

## M5z bundle trim, fixes and docs

Written 2026-11-25 by the M5z work, the last step of M5 after M5d, M5s and M5p were merged: the
entry-JS trim (TD-63), the product-owner decisions after M5, the past-session wording, the
component-test port (TD-58) and the docs pass for M5 (technical concept v0.9, eight ADR
amendments). Status: `pnpm verify` green (numbers under "Evidence"). Nothing committed; the
product owner commits.

**Product-owner answers after M5 (2026-11-25):**

- **Focus race: fix it.** The custom-exercise form and onboarding focused their error summary in a
  `requestAnimationFrame` right after `setState`, sometimes before React had drawn it, so a
  keyboard or screen-reader user could miss the summary. Fixed by focusing after the summary
  rendered; the tests' assertions stay.
- **Content:** keep the two extra bodybuilding templates (Full body ×4, Upper/lower ×3); no
  powerlifting or powerbuilding alternatives for now; add a "standard variant first" tie-break to
  the exercise ranking and the generator's selection, as an explicit, documented content field or
  ranking rule (no ID renames), and update the plan-matrix snapshot deliberately.
- **Public origin:** one origin, the production one, shared by beta and production; wired into the
  CI image build from a repository variable, so it stays `powr.invalid` while unset; the product
  owner sets it once the domain is chosen.
- **Accepted as built:** Settings as one long page with "On this page"; "Update my plan from next
  week" keeps this week's sessions under the ended plan; the legal-review date as a second
  release-gate placeholder; RPE chips 10…6 and ≤5; no APRE or RTS option and no in-session "keep as
  last time" button; the calendar defaults (current block, 30-minute alarm, 18:00); the backup
  "Remind me later" after 3 days; the install and dismissal state on the device.

### What landed

| Area                     | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-63 bundle trim        | `app/route-search.ts` (`deferredSearch`, `RawSearch`), the 15 route files with search params, `features/{search,body/search,bodymap/search,library/search,progress/search,session/search}.ts` (named search types), `LibraryScreen.tsx` (validates its own search), `hooks/insights-loader.ts`, `hooks/use-insights-warmup.ts`, `hooks/use-insights.ts`, `app/container.ts` (lazy capability probe), `app/boot.tsx` (lazy service-worker registration), `vite.config.ts` (`modulePreload.polyfill: false`), `ui/button-class.ts` with the alias `#ui/button-class` in `apps/web/package.json`, `ui/button.tsx`, `features/shell/RouteError.tsx` and `UpdateBanner.tsx` (native buttons) |
| Focus fix                | `hooks/use-focus-request.ts` (`useFocusRequest`: a ref and a `request()`; focus in a layout effect after the commit), used by `CustomExerciseScreen.tsx`, `OnboardingFlow.tsx` and, with the same race, `ProfileAnswerScreen.tsx` and `LogPastSessionScreen.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Past-session wording     | `@powr/domain/trend` `ChangeLabel.reason` (`NoLabelReason`), carried by `PointChange` (`session/history.ts`) and the series summary (`analytics/trends.ts`); `features/session/past/parts.tsx` `trend()`; callers in `HomeScreen.tsx`, `ExerciseProgressScreen.tsx`, `progress/words.ts`                                                                                                                                                                                                                                                                                                                                                                                                |
| TD-58 test port          | `apps/web/vitest.components.config.ts` (`POWR_TEST_BROWSER_PORT`, default `defaultBrowserPort` 23315; `server.strictPort: false`, `test.api: { port, strictPort: false }`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Standard-variant ranking | `ExerciseRanking.standard` (`packages/domain/src/model/exercise.ts`), `compareStandard` (`planning/rank.ts`) in `rankCandidates` (`planning/select.ts`) and `muscleRanking` (`analytics/bodymap.ts`); content schema `ranking.standard: z.literal(true)`; 86 exercises marked in `packages/content/data/exercises/*.yaml`; `content.json` rebuilt (0.3.0, new hash)                                                                                                                                                                                                                                                                                                                     |
| Public origin            | `.github/workflows/ci.yml` (workflow `env`: `VITE_PUBLIC_ORIGIN: ${{ vars.PUBLIC_ORIGIN }}`), `deploy.yml` header, `deploy/runbook.md` §2 (the repository variable), `e2e/m5d.spec.ts` (expects the UID host of the build's origin)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Device support link      | `features/settings/SettingsScreen.tsx`: Settings → About → "Device support: what works on this phone" (PWA-13; M5d's open item)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Tests                    | `packages/domain/test/planning/generate.test.ts` (the tie-break in both rankings), `test/fixtures/planning.ts` (`standard`), `reference/trend.test.ts` (the value's `reason`), `tools/content-build/test/coverage.test.ts` (a standard exercise in every substitution group, none among close variants), `packages/application/test/plan-matrix.test.ts` (new exercise-picks snapshot), `apps/web/test/past-sessions.test.tsx` (the three "no label" texts), `progress.test.tsx` (the new text allowed), `settings-m5.test.tsx` (the About link)                                                                                                                                        |
| Docs                     | `docs/technical-concept.md` v0.9; ADR-0003, 0006, 0008, 0010, 0011, 0014, 0016, 0020 amendments and `docs/adr/README.md`; this section. `docs/PRD.md` not edited (proposals below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### TD-63: what moved out of the entry chunk

Measured on the built entry (`gzip -9` of `dist/assets/index-*.js`; `pnpm size` reports
size-limit's number):

| Step                                                                                                 | Entry gzip              | Change  |
| ---------------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| Baseline (M5 merged)                                                                                 | 183.79 kB (size 184.08) |         |
| The 15 route search validators into their route chunks (`deferredSearch`)                            | 182.79 kB               | −1.0 kB |
| The insight hooks, the capability probe, the service-worker registration, the modulepreload polyfill | 180.72 kB               | −2.1 kB |
| Base UI's button stack (native buttons in the route error boundary and the update banners)           | 177.70 kB (size 177.97) | −3.0 kB |

- **Route search validation (the product owner's TD-63).** TanStack Router evaluates
  `validateSearch` from the route definition before it loads the route's chunk. The definitions
  now take `deferredSearch<T>()`: typed for links and `navigate` through TanStack's
  `SearchSchemaInput` (so `<Link search={{ mode: 'week' }}>` is still checked), a pass-through at
  runtime, and `Route.useSearch()` returns `RawSearch<T>` (every key `unknown`, any other key
  allowed), so a component cannot use a value before it validated it. Each route's component, which
  the router plugin splits, calls the route's own validator; the library list validates in
  `LibraryScreen`, also inside its functional `navigate` update. The session route's validator still
  throws on an invalid `start` or `source`, now inside the route's error boundary instead of the
  router's search step (the same `RouteError` screen).
- **Whole modules in the entry because one export was needed.** `use-insights.ts` (and through it
  `use-load.ts`) sat in the entry only because the shell's warm-up lived in it; the warm-up and the
  chunk loader are now `use-insights-warmup.ts` and `insights-loader.ts` (still the one sanctioned
  `import('@powr/application/insights')`).
- **Not needed for the first paint.** The capability probe (`probe()` is async anyway; diagnostics,
  Device support and the harnesses ask), the service-worker registration (imported when `start()`
  runs after the first render; it took its Trusted Types policy module along) and Vite's
  modulepreload polyfill (every supported Chromium has `modulepreload`).
- **Base UI's button stack** (`Button`, `useButton`, `mergeProps`, `useRenderElement`,
  `useMergedRefs`, `useFocusableWhenDisabled`, …) was pulled in only by the root route's error
  boundary and the update banner. Both now render a native `<button type="button">` with the
  design system's classes (`buttonClass` from the new `#ui/button-class`; `#ui/button` re-exports
  it), as `StartupError` already did: the same element and behaviour for these buttons (the "Update"
  button is natively disabled during a workout, as before).
- **Tried and dropped:** a lazy update banner (−0.1 kB, not worth a Suspense boundary).
- **Larger levers left:** the Temporal ponyfill (about 30 kB gzip; native from Chrome 144 and Samsung
  Internet 31, so a conditional load would work on the S22 but changes the time code's runtime,
  ADR-0015) and tailwind-merge (about 7 kB, `cn` everywhere). Not needed now.

Result: **entry JS 184.08 → 177.97 kB** gzip of 186 (target about 180), **startup path 1 script, 0
with Zod**; CSS 7.33 kB; service worker 9.39 → 9.51 kB (its precache list has 10 more chunks);
precache 203 → 213 files + `sw.js`, 1069.2 → 1072.4 kB.

### Focus fix

`useFocusRequest()` returns a ref for the summary and `request()`; each request bumps a counter, and
a layout effect keyed to it focuses the element after React committed it (before paint). A frame
callback scheduled right after `setState` could run first when the render was scheduled (a
`setState` after an `await`, as in the custom-exercise form) or when the test resumed before the
frame (the legal gate asserts `document.activeElement` right after `findByRole('alert')`). The same
pattern was in `ProfileAnswerScreen` and `LogPastSessionScreen`; all four use the hook now. No test
assertion changed.

Evidence, consecutive runs of each file on its own (`npx vitest run --project components <file>`):
`test/library.test.tsx` 5 of 5 (4 tests each), `test/onboarding.test.tsx` 5 of 5 (5 tests each);
`test/profile-edit.test.tsx` and `test/past-sessions.test.tsx` passed too, and the full component
project passed in every run since.

### Past-session wording (TD-62's follow-up)

The short label said "Within normal day-to-day variation" for every change without a claim. The
domain's label value now carries the reason the "Why?" text already used (`ChangeLabel.reason`:
`noise` within one typical error, `unconfirmed` beyond it but not yet confirmed), and so do the
derived points (`PointChange.reason`) and the series summary. `trend()` in
`features/session/past/parts.tsx` (Home, Progress, the summary, the past sessions) says "Within
normal day-to-day variation" or "More than normal day-to-day variation, not confirmed yet"; a point
derived before the field existed says "No confirmed change yet", which is true either way.
`ENGINE_VERSION` stays 0.2.0 (unreleased; the field extends its output); derived points rebuild on the
next derivation-key change.

### TD-58: the component-test port

The browser project merged the app's Vite config, whose dev server is strict about its port, so a
second checkout's `pnpm test` failed with "port already in use" on Vitest's browser port 23315.
`vitest.components.config.ts` sets `server.strictPort: false` and `test.api: { port, strictPort:
false }` with `port = POWR_TEST_BROWSER_PORT || 23315` (`defaultBrowserPort`): a busy port moves on to
the next free one, and `POWR_TEST_BROWSER_PORT=24123 pnpm test:components` picks a port explicitly.
Checked by holding 23315 with another process: before, "port already in use" and no tests; after, the
run passes on the next port. (Vitest 5 moved `browser.api` to `test.api`.)

### "Standard variant first": the rule

- **Field:** `ranking.standard: true` on an exercise (domain `ExerciseRanking.standard?: true`;
  content schema `z.literal(true).exactOptional()`; never set on custom exercises, whose backup
  schema stays strict without it). **Meaning:** the standard variant of its movement, the form
  programs prescribe by default, as opposed to a specialised variant (a technique, setup, angle or
  implement chosen for a purpose). Several exercises of one movement may be standard (pull-up and
  chin-up; barbell and dumbbell forms).
- **Ranking rule:** only a tie-break, never part of a score. `rankCandidates`: favourite
  (`preferred`) → MAP-03 score → standard → ID; that covers the generator, the next block's
  rotation, the equipment editor's substitutes and the session's alternatives. The body map's muscle
  ranking: available → (focus: credit) → score → favourite → last done → standard → ID. IDs are
  unchanged.
- **Content rule (coverage test):** every substitution group has at least one standard exercise;
  no close variant of a competition lift (`variantOf`) is standard; the two examples of the decision
  are asserted.
- **Marked (86):** calf: standing, seated, dumbbell calf raise · core: crunch, cable crunch, hanging
  leg raise, dumbbell side bend, cable Pallof press · elbow extension: cable pressdown, overhead cable
  and dumbbell overhead extension, EZ-bar skull crusher, dumbbell kickback · elbow flexion: barbell,
  dumbbell, hammer, incline dumbbell, EZ-bar preacher and cable curl · hinge: deadlift, barbell and
  dumbbell RDL, good morning, kettlebell swing, cable pull-through · hip abduction and adduction
  machines · hip extension: barbell and dumbbell hip thrust, glute bridge, 45° back extension ·
  horizontal pull: barbell bent-over, chest-supported dumbbell, one-arm dumbbell, seated cable,
  inverted and T-bar row · horizontal push: barbell and dumbbell bench, incline barbell and dumbbell
  press, machine chest press, push-up · leg extension · lying, seated and Nordic curl · lunge:
  bodyweight split squat, Bulgarian split squat, walking lunge, reverse lunge, step-up · lateral
  raises (dumbbell, cable, band), dumbbell and cable upright row · rear delts: reverse pec deck,
  dumbbell rear-delt fly, cable and band face pull, band pull-apart · flies: pec deck, cable and
  dumbbell fly · barbell and dumbbell shrug · squat: back, front, goblet, leg press, hack squat,
  bodyweight squat · vertical pull: lat pulldown, pull-up, chin-up, straight-arm pulldown · vertical
  push: barbell overhead press, dumbbell shoulder press, machine shoulder press, dip, pike push-up ·
  barbell and dumbbell wrist curls and reverse wrist curls.
- **Before:** among equal scores the ID decided, and content 0.3.0's 116 new exercises made
  specialised variants win by ID: 60 tie groups at the top of a slot or a muscle's list (for
  example `arnold-press` = `dumbbell-shoulder-press`, `behind-the-body-cable-curl` =
  `incline-dumbbell-curl`, `bicycle-crunch` = `crunch` = …, `ez-bar-overhead-triceps-extension` =
  `overhead-cable-triceps-extension`, `leg-press-calf-raise` = `standing-calf-raise`,
  `incline-push-up` = `push-up`, `cable-side-bend` = `dumbbell-side-bend`).

### Plan matrix: the snapshot diff (deliberate)

Content with the flag against the same content without it (the old ID tie-break), every template,
preset and level at 60 minutes: **104 of 166 first plans** and **133 of 166 next blocks** pick at
least one other exercise. Per exercise in the first plans: +incline dumbbell curl 43
(−behind-the-body cable curl 35, −dumbbell preacher curl 8), +dumbbell shoulder press 34 (−Arnold
press 34), +overhead cable triceps extension 32 (−EZ-bar overhead extension 32), +standing calf raise
28 (−leg-press calf raise 28), +crunch 24 (−bicycle crunch 24), +push-up 20 (−incline push-up 20),
+dumbbell side bend 4 (−cable side bend 4); a few plans fit one more or one fewer exercise in the
60-minute budget because the picks' time estimates differ. **No competition-lift slot changed.** The
next block's rotation now goes from the standard to the variant (the Arnold press after the dumbbell
shoulder press, the straight-arm pulldown after the lat pulldown).

`packages/application/test/__snapshots__/plan-matrix.test.ts.snap`, updated deliberately:

- **First-plan summary:** 324 lines, **38 changed**, all bodybuilding templates (2-day 4, 3-day 6,
  4-day 2, Full body ×5 6, PPL ×2 2, Upper/lower ×2 4, Upper/lower ×3 6, Upper/lower + PPL 8); by
  preset custom 10, dumbbells and bench 10, commercial gym 8, hotel gym 6, bodyweight and bands 4.
  No powerlifting or powerbuilding line changed (their picks changed only where set counts and
  violations stayed equal). In the changed lines: exercises 824 → 822, sets 2,912 → 2,950,
  violations 198 → 194 (`volume.low[timeBudget]` 94 → 90, `volume.belowFloor[timeBudget]` 2 → 0,
  `volume.low[slotLimit]` 10 → 12), all with a cause.
- **Next-block summary:** 166 lines, **73 changed** (bodybuilding and the powerbuilding 5- and 6-day
  templates); exercises 1,652 → 1,642, sets 5,898 → 5,928, violations 290 → 286, all with a cause.
- **New third part:** the exercise picks of every intermediate plan at 60 minutes, day by day (66
  lines). The summaries show only counts, so a changed pick (from content or ranking) now shows in
  review.

The matrix guarantees hold unchanged (1,944 combinations: no avoidable violation, only available
exercises, every over-budget day flagged, determinism, < 1 s per plan).

### Public origin in CI

`ci.yml` sets `VITE_PUBLIC_ORIGIN: ${{ vars.PUBLIC_ORIGIN }}` in the workflow's `env`, so the build
job's `pnpm build` (the `dist` that becomes the image) and the E2E job (which tests that `dist` and
the image) see the same value; an unset repository variable expands to an empty string, which
`publicOrigin()` turns into `https://powr.invalid`. A workflow-level variable rather than an
environment one, because beta and production run the **same** image. The E2E calendar test no longer
hard-codes `@powr.invalid`: it expects the host the app derives from the same variable. The Dockerfile
needs nothing (it copies the built `dist`). Documented in `deploy/runbook.md` §2 and the
`deploy.yml` header; the product owner sets `PUBLIC_ORIGIN` (Settings → Secrets and variables →
Actions → Variables) once the production domain is chosen, and never changes it afterwards.

### Decisions and deviations

| Brief says                                                             | What I did                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fix the focus race in two screens                                      | The same `requestAnimationFrame` after `setState` was in `ProfileAnswerScreen` and `LogPastSessionScreen`; all four use `useFocusRequest` (a layout effect, so the focus lands in the commit, before any test or assistive technology can look)                                |
| "An effect keyed to the errors, or a ref callback"                     | A request counter keyed effect: it focuses on every request, also when the same summary was already on screen (a ref callback runs only when the element mounts)                                                                                                               |
| Move route search validation into the lazy chunks                      | A typed pass-through in the definition and validation in the split component; the types (`RawSearch<T>`) make an unvalidated read a compile error. TanStack Router has no lazy `validateSearch`                                                                                |
| "Anything else not needed for the first paint"                         | The insight hooks, the capability probe, the service-worker registration, the modulepreload polyfill and Base UI's button stack; the Temporal ponyfill and tailwind-merge stay (larger changes, not needed for the target)                                                     |
| Tie-break "with an explicit, documented content field or ranking rule" | Both: the field `ranking.standard` and the rule `compareStandard` after the score and before the ID, in both rankings; documented in the domain type, the concept (§8.7.6, §8.12) and ADR-0020                                                                                 |
| Which exercises are standard                                           | A curated list (86) by the rule above, checked against every tie group of the generator and the body map; a content test keeps a standard member in every substitution group (so the lat-isolation and upright-row groups got the straight-arm pulldown and both upright rows) |
| Content version                                                        | 0.3.0 amended in place (unreleased); its hash part changed (`0.3.0+sha.…`)                                                                                                                                                                                                     |
| Wire `VITE_PUBLIC_ORIGIN` into the CI image build                      | Workflow-level `env` in `ci.yml` (build and E2E jobs see the same value); the E2E UID check follows it                                                                                                                                                                         |
| Not in the brief                                                       | Settings → About → "Device support: what works on this phone" (M5d's open item, PWA-13's "Settings → About → Device support")                                                                                                                                                  |

### Evidence

`pnpm verify` green on 2026-11-25 (exit 0): lint (0 errors, 0 warnings), format, token gate, knip,
catalog check, typecheck, **1,039 unit tests in 86 files** (1,036 before) and **123 component tests in
22 files** (122 before), build, licence gate, size (**entry JS 177.97 kB** gzip of 186, 1 first-wave
script, 0 with Zod) and **78 E2E tests** (3 opt-in skipped; unchanged). The baseline run before any
change: 1,036 + 122 tests, 78 E2E, entry 184.08 kB. One earlier full run of the final state stopped at
the last stage: `e2e/alerts.spec.ts` "variant B: the service-worker timer fires while the page is
hidden" saw no "Rest over" notification within 6 s of a 2 s rest under the parallel E2E load (every
stage before it was green). That path posts to the worker through `navigator.serviceWorker
.getRegistration()` and does not depend on the page's (now lazy) registration call; the spec then
passed 3 of 3 runs on its own, and the next full `pnpm verify` passed everything. Worth watching in
M6 (a timing margin under load, not seen before).

### Open items and decisions for the product owner

- **Product decisions:** safety copies' auto-prune (TD-67: keep the rotation of two only, or prune
  after 30 days or a newer backup with a notice); whether to compile S-2's results into a matrix
  like S-1's (TD-66); whether Home's one-tap start should also offer a waiting update (TD-64); the
  M5p content judgement calls (the diamond push-up's pec credit 0.5, the handstand push-up's overload
  0, incline and low-to-high flies that credit but do not rank the clavicular head, the floor back
  extension in `core`); a review of the 86 standard exercises (for example the dumbbell over the cable
  side bend, the straight-arm pulldown as the lat-isolation standard).
- **PRD:** the proposed wording below.
- **M6:** S-1, S-2, S-6 and the TalkBack and timing checks on the S22 (TD-38, TD-50); the legal
  review (fill `postalAddress` and `legalReview` in `features/legal/publisher.ts`, then
  `pnpm release:check` passes); the production domain (`PUBLIC_ORIGIN`); TD-22's format
  documentation; TD-64…TD-72.

### Proposed PRD wording (collected from the M5 notes; `docs/PRD.md` not edited)

- **A-05 / EXL-01 (M5p):** met: 190 exercises; every display group except the optional tibialis has
  at least 2 exercises crediting it ≥ 0.5 under every preset with equipment; §7.1 "carry" still has
  no exercise (TD-65).
- **PLN-02 table (M5p, kept by the product owner on 2026-11-25):** bodybuilding 4 days "Upper/Lower
  ×2 or Full body ×4", 6 days "Push/Pull/Legs ×2 or Upper/Lower ×3" (5 days unchanged: "Upper/Lower +
  PPL hybrid or Full body ×5"); powerlifting and powerbuilding without alternatives for now.
- **PLN-05 / MAP-03 (M5z):** "Among exercises with equal scores, the standard variant of a movement
  ranks first (for example the dumbbell shoulder press before the Arnold press)."
- **PWA-05 (M5d):** the two shortcuts built: "Start today's workout" and "Log bodyweight" ("Quick
  timer" with TMR-15, "Last workout summary" later).
- **DAT-08 (M5d):** "… 'Remind me later' hides a due reminder for 3 days."
- **DAT-13 (M5d):** "… a confirmation screen ('All data deleted') precedes the first run."
- **CAL-02 (M5d):** "a time chosen at export" includes "All-day events".
- **SET-05 (M5s):** "RPE or RIR display and entry (RPE = 10 − RIR; records keep RIR); RIR entry by
  one tap per value (0–4, 5+) or in half steps."
- **SET-08 (M5s):** "… choose whether to update the current plan from the start of next week (this
  week stays as planned) or keep it; experience, priorities, exercises to avoid and the reference set
  then reach the next block's proposal, style and training days the next plan. Only an answer that
  changes the plan asks; the new plan is shown before anything is stored."
- **SET-09 (M5s):** "… and a contact route by e-mail (`tools@sz-development.com`)."
- **LEG-09 (M5s):** "… a postal contact address (a release check blocks production until it is
  provided) and e-mail."

### Doc changes (docs pass for M5)

- **`docs/technical-concept.md` v0.9:** the amendments listed under "M5d", "M5s" and "M5p" and the
  M5z work folded in: §0 (version, status, sources), §0.3 (row 0.9), §6.3, §6.4, §6.6 (the calendar
  as built, the public-origin decision), §6.7, §6.8, §7.5 (release gate, `PUBLIC_ORIGIN`), §7.8 (one
  public origin; rules, content and engine versions), §8.2.1, §8.2.2 (M5 state of version 2),
  §8.2.5, §8.2.6, §8.3.4 (`encodeRawSnapshot`), §8.4, §8.6.4 (How POWR decides), §8.7.5 (TE floor,
  windows, 60/60, the `reason`), §8.7.6 (the tie-break, the alternative templates, the matrix and
  its picks snapshot), §8.8.7 (TD-42, TD-49), §8.9.1 (M5 routes, deferred search validation, Back and
  sheets), §8.9.2 (native buttons on the startup path), new §8.9.11 (screens as built in M5), §8.12
  (content 0.3.0, `ranking.standard`), §8.13, §8.14 (the focus fix), §8.15 (lazy catalogs), §8.19
  (entry JS in M5 and what moved), §8.20 (M5 tests, the test port), §8.21, §8.23, §9, §11.2 (TD-14,
  TD-23, TD-33, TD-37, TD-42, TD-49, TD-55…TD-60, TD-62, TD-63 closed; TD-15, TD-20, TD-22, TD-32,
  TD-50 updated; TD-64…TD-72 added), Appendix A.4 (M5 row and status).
- **ADRs (v0.9 amendments):** 0003, 0006, 0008, 0010, 0011, 0014, 0016, 0020; the index's v0.9
  paragraph and status cells.
- **`deploy/runbook.md` §2:** the repository variable `PUBLIC_ORIGIN`.
- **`docs/PRD.md`:** not edited.

## M6a quality audits

Written 2026-11-25 by the M6a work (the code side of M6: the accessibility sweep, the performance
audit with the reference dataset, the copy and tone review, TD-64, TD-67 and the E2E flakes; M6b
wrote the release-readiness docs in parallel). Status: `pnpm verify` green (numbers under
"Evidence"). Nothing committed; the product owner commits. `docs/**` not edited (M6b's); the doc
amendments are listed at the end.

### What landed

| Area                 | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility sweep  | `apps/web/e2e/a11y.spec.ts` (every route with realistic data, both themes) and `apps/web/e2e/a11y.ts` (target sizes after WCAG 2.5.8 with its spacing and inline exceptions, the 48 px / 8 px check of NFR-A11Y-02, names from Chromium's accessibility tree, the page title); fixes in `PlanScreen.tsx`, `RestPanel.tsx`, `ui/screen.tsx` (`context`), `OnboardingFlow.tsx`, `ProfileAnswerScreen.tsx`                                                     |
| Reference dataset    | `@powr/application/reference` (`referenceHistory`, `addReferenceHistory`): M4a's generator moved out of `test/perf.test.ts`, extended to A-11 (weigh-ins, breaks, a lighter week every fifth, exercise slots like logged workouts) and shared by the M4a engine test, the browser and the S22; `/debug/perf` (`features/debug/PerfTools.tsx`, debug builds only) loads it into the real IndexedDB and lists this page load's paint timings and POWR's marks |
| Performance audit    | `apps/web/e2e/perf.spec.ts` (opt-in, `POWR_PERF=1 pnpm e2e perf`); marks `powr-home-interactive` (`HomeScreen.tsx`), `powr-set-commit` (`session/commands.ts`), `powr-insights-warmup` (`hooks/use-insights-warmup.ts`); fixes in `insights/summaries.ts`, `insights/trends.ts`, `insights/history.ts`, `ui/charts/echart.tsx` (`preloadCharts`), `ProgressScreen.tsx`                                                                                      |
| Copy and tone review | 152 messages in the source and the three catalogs (54 boot, 80 "Why?", 8 legal, 10 parameter labels); the tests that name them                                                                                                                                                                                                                                                                                                                              |
| TD-64                | `features/shell/UpdateFirstOffer.tsx` (`useUpdateFirst`, `level`, `startWithout`, `onDecline`), `HomeScreen.tsx` (the offer in the start card), `StartScreen.tsx` (the shortcut's start waits for the choice), `app/ui-store.ts` (`updateDeferred`), `hooks/use-app.ts` (`deferUpdate`); `test/m6a.test.tsx`                                                                                                                                                |
| TD-67                | `@powr/application/data` (`SAFETY_COPIES`, `safetyCopiesToPrune`, `pruneSafetyCopies`; `listSafetyCopies` prunes first), `usecases/backup.ts` (prunes after each new copy), `infrastructure/db/safety-db.ts` (no rotation of its own), the sentence in Data and backups; `packages/application/test/m6a.test.ts`, `infrastructure/db/safety-db.test.ts`                                                                                                     |
| Flakes               | `e2e/session.spec.ts`, `e2e/body-map-screen.spec.ts` (90 s limits for two heavy tests); the sweep's own data comes from `/debug/perf` instead of slow UI logging                                                                                                                                                                                                                                                                                            |

### Accessibility sweep (NFR-A11Y-01…07, WCAG 2.2 AA)

**What the spec does.** `e2e/a11y.spec.ts` builds realistic data the way a user has it: onboarded
with a plan that has a session today (the clock is a Sunday morning, the first day of the week of
the en-US profile, so a new plan starts that day), six weeks of history from `/debug/perf` (about
20 workouts with slots, PRs and trend points, 42 daily weigh-ins, a two-week break), a workout
finished today and a custom exercise. Then it visits **every route**: the first run (welcome, the
five legal pages before onboarding, every onboarding step, the preview, a not-found URL); Home;
`/plan`, `/plan/edit`, `/plan/next`, `/plan/calendar`, `/plan/setup/$step`; `/session` (start
screen, check-in, the logging view, the logging view while resting, the summary), `/session/past`,
`/session/past/new`, `/session/past/$sessionId`; the eight Progress routes; Explore, the library,
an exercise, the custom-exercise form, a custom exercise and its edit form, the body map and a
muscle; `/body`, `/body/log`, `/data`, Settings, device support, equipment and an equipment
profile, per-exercise choices, rest times, the six `/settings/profile/$answer` pages and the five
legal pages. On each screen, in its loaded state:

- axe (WCAG 2.0/2.1/2.2 A and AA tags) in light and dark: no serious or critical violation;
- a name on every control (buttons, links, fields, choices, sliders, tabs, options, dialogs, radio
  groups) from Chromium's accessibility tree (CDP `Accessibility.getFullAXTree`);
- WCAG 2.5.8 target size: every target ≥ 24 × 24 CSS px, or a 24 px circle on it touches no other
  target, or a link inside a sentence; a visually hidden input counts by its label;
- the page title "<screen> · POWR" (2.4.2), and in one more test **no title shared by two routes**;
- reflow at 320 CSS px with 200% text (1.4.4, 1.4.10): nothing wider than the viewport, no
  horizontal scrolling.

In the workout, the dock ("Log this set") is checked against NFR-A11Y-02 twice, logging and while
resting: every control ≥ 48 × 48 CSS px and ≥ 8 px from the next. A first test checks the checks
on a synthetic page (two touching 16 px buttons fail, a link in a sentence and a lone small button
pass, an empty button has no name, the 48 px and 8 px rules), so a check that silently passes
everything would fail. The debug routes (developer harnesses, not in release builds) are not swept.

**Findings and fixes:**

| Where                                                                     | Finding                                                                                                                                                                                                                             | Fix                                                                                                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan (`/plan`)                                                            | WCAG 1.4.10: the week navigation (previous, "This week", next) ran off the screen at 320 px with 200% text (the 48 px targets are 3 rem, so 96 px each); the page then scrolled sideways. No earlier test checked reflow on `/plan` | The row wraps (`flex-wrap`)                                                                                                                        |
| Workout, resting                                                          | WCAG 1.4.10: the four rest controls (−15, +15, restart, skip) in one row ran off the screen at 320 px with 200% text                                                                                                                | The row wraps into two rows of large targets                                                                                                       |
| New plan (`/plan/setup/$step`) and Settings (`/settings/profile/$answer`) | WCAG 2.4.2 (the brief's "a unique page title per route"): "Your goal · POWR", "Your experience · POWR" and so on were the titles of three different routes (first run, a new plan, one answer in Settings)                          | `Screen` takes an optional `context` for the page title only: "Your goal · Set up a plan · POWR", "Your goal · Settings · POWR"; the headings stay |
| Everything else                                                           | No serious or critical axe issue in either theme, no unnamed control, no target under 24 px, the dock at 48 px and 8 px apart in both states, no other overflow                                                                     | —                                                                                                                                                  |

**For the manual TalkBack pass on the S22 (what the automated checks cannot judge):**

- Focus and reading order on every route: the h1 takes focus after navigation and TalkBack reads
  it; the bottom navigation comes last; sheets trap focus, Back closes them and focus returns.
- Live announcements: the rest timer (polite, not flooding; "Rest over"), "Set N logged", "Workout
  resumed", the PR celebration, the copy/export status lines, the error summaries that take focus
  (onboarding, custom exercise, one answer in Settings, past workout).
- Group labels that read as the start of a sentence with their choice: "Show the sets of" (body
  map, muscle) and "Points history of" (Scores); whether "Show the sets of, This week" sounds
  right or needs a full label.
- Buttons whose visible text is short and whose name is longer ("Remove", "Show", "Repeat",
  "Edit", "Delete…" with the item in the name, 2.5.3 label in name): that voice access and TalkBack
  match them.
- The body map: regions by swipe with their names and statuses, the list alternative, the small
  regions' chips (QS-10).
- The charts: the point slider with TalkBack's swipe up and down (aria-valuetext), the table view.
- The dock: the steppers with their hints, the RIR/RPE chips' names, the numeric keypad, the
  "larger controls" setting (56 px) with real fingers.
- Home's start card with an update waiting (TD-64): the offer is an h3 inside "Today"; that the
  order "Update first", then "Start without updating" is clear.
- Android font size at maximum plus display size large (the CSS check scales only the root font);
  the safe areas and the keyboard over fields.
- Contrast in gym light, reduced motion (celebrations), the notifications on the lock screen.

### Performance audit (NFR-PERF-01…08, §8.19, QS-02, QS-09, QS-16)

**Reference dataset.** The concept's `tools/dataset` (a ZIP for import) was not built; M4a's
generator went into the package `@powr/application/reference` instead, so the engine test, the
browser and the S22 use the same records. Defaults are PRD A-11: 270 weeks with five two-week
breaks, five workouts a week (push, pull, legs, upper, lower; six exercises with 31 working sets),
a lighter week every fifth training week, loads rising about 25 % over five years, 1,800 daily
weigh-ins with a yearly bulk and cut, every workout with its exercise slots and planned sets like a
logged one. Up to yesterday, so today stays free: **1,297 workouts, 40,207 sets, 1,800 weigh-ins,
5 breaks**. `addReferenceHistory` reads every raw table and writes them back with the history
through the restore's replace-all transaction (the profile, plan and settings stay; derived tables
are rebuilt on use; a second load replaces the first). `/debug/perf` (debug builds: dev, beta, E2E)
has "Add the reference history" (1.7 s on the dev machine) and "Add a short history" (six weeks,
for the sweep), and lists this page load's paint timings and `powr-*` marks, for the S22.

**How measured.** `POWR_PERF=1 pnpm e2e perf` (after `pnpm build`): Chromium headless on
Playwright's Pixel 7 profile (360 × 780, DPR 3, touch), the production build with its service
worker and the production CSP, the real IndexedDB, CPU throttled 4× through CDP
(`POWR_PERF_CPU`). An onboarded user (bodybuilding, three days) gets the reference history; Home is
opened once (the weekly numbers are rebuilt) and Progress once (every exercise derived). Then seven
runs, each in a new page of the same browser context (installed app files, a "warm browser, cold
app" start; the S22's cold process start is a device measurement): first contentful paint and
`powr-home-interactive` (the first Home with its data), then Progress, an exercise with its chart
(the squat, five years), Explore, the body map, the library and a search, each from the tap inside
the page to the first frame with the data (a `MutationObserver`, no Playwright round trip). Then the
squat's eight sets in a workout (from the tap to the next frame, to `powr-set-commit` and to the
logged row), "Verify data" three times and a backup export. Medians and p75 (nearest rank). The
machine is a 16-core desktop that ran other worktrees' tests at the same time, so the numbers carry
noise of about ±10 %; the S22 numbers are the device pass (TD-50).

**Results (ms, median / p75, CPU 4×):**

| Measure                                                     | Budget                          | Before         | After         |
| ----------------------------------------------------------- | ------------------------------- | -------------- | ------------- |
| Cold start: first contentful paint                          | ≤ 1,000 (NFR-PERF-01)           | 328 / 364      | 324 / 388     |
| Cold start: Home interactive (`powr-home-interactive`)      | ≤ 2,000 (NFR-PERF-01)           | 620 / 694      | 648 / 726     |
| Progress hub (the list with every e1RM and label)           | navigation ≤ 300 (NFR-PERF-04)¹ | 944 / 961      | **619 / 633** |
| An exercise with its chart (squat, five years)              | chart ≤ 500 (NFR-PERF-05)¹      | 1,494 / 1,531  | **711 / 730** |
| Explore                                                     | ≤ 300                           | 160 / 178      | 175 / 203     |
| Body map with this week                                     | ≤ 300                           | 251 / 291      | 255 / 278     |
| Library list                                                | ≤ 300                           | 188 / 233      | 189 / 200     |
| Library search ("row")                                      | ≤ 100 interaction               | 127 / 128      | 125 / 129     |
| Set confirm: tap to the next frame (visual feedback)        | ≤ 100 (NFR-PERF-03)             | 11 / 14        | 6 / 8         |
| Set confirm: tap to the durable commit (`powr-set-commit`)  | ≤ 500 (NFR-PERF-03)             | 118 / 119      | 114 / 115     |
| Set confirm: tap to the logged row                          | —                               | 254 / 255      | 252 / 258     |
| "Verify data" (a full rebuild of 270 weeks)                 | —²                              | 3,033 / 3,191  | 3,182 / 3,255 |
| Backup export (reference dataset)                           | ≤ 10,000 (NFR-PERF-08)          | 5,092          | 5,315         |
| Idle check of the derived weeks 5 s after start             | —                               | (not measured) | 382           |
| Once after loading the dataset (1×): Home's weekly numbers  | —                               | 3,961          | 2,389³        |
| Once after loading the dataset (1×): every exercise derived | ≤ 2,000 per edit (NFR-PERF-06)² | 4,191          | 3,476³        |

¹ The screen itself (its h1, links and "Loading…") is there at once; the number is the time to the
data. ² NFR-PERF-06 is for one edit (QS-13, rebuilt per exercise); these rebuild everything, once
after a restore or on request, without blocking. ³ One run each, unchanged code: noise. No click
on the workout screen took 16 ms or more in the Event Timing API (Chromium reports from 16 ms).

**Hot spots found and fixed:**

1. **The Progress hub read a year of sets** (about 8,000) only to list which exercises were trained
   (TD-55's bulk summaries). A logged workout lists its exercises (the session core, past workouts
   and their edits add a slot for every exercise with sets), so the hub now reads the sessions and
   only the sets of sessions without slots (M0 quick logs, old imports) or with a swapped slot (sets
   logged before a swap name the earlier exercise). Same results (a new test with a swapped slot and
   a quick log), 944 → 619 ms.
2. **One exercise's screen read its whole history three times.** History, trend and performance
   each loaded the context (profile, plan, settings, 1,800 weigh-ins) and every set, session, point
   and PR of the exercise. Views of the same exercise that start in the same task now share one load
   (`exerciseData`): no write can commit inside a task, so the shared load is what each would have
   read, and a finished load is never reused (test: three views, one read; the next view reads
   again).
3. **The chart chunk (ECharts, 174 kB gzip) loaded on the first chart.** The Progress hub asks for
   it in idle time (`preloadCharts`, `requestIdleCallback` with a 3 s timeout), so the tap on an
   exercise does not wait for it. 2 and 3 together: 1,494 → 711 ms. Startup is unchanged (the start
   screen still never fetches ECharts, the S-4 E2E check).

**Measured and left (within budget), with the lever for each:**

- Every set confirm runs `prepare()` twice (the dispatch and the live session view), and each reads
  all weigh-ins (1,800) and recomputes the bodyweight trend and its fingerprint. Durable commit
  114 ms, the logged row 252 ms at 4× (budget 500). Lever: keep the weigh-ins and their trend in
  memory, invalidated by Dexie's `storagemutated` event.
- The Progress hub reads every e1RM point (`dSessionE1rm`, about 7,800) for the latest change label
  of each exercise. Lever: read a window of the last weeks and fall back to the whole series only
  when the label's reference is outside it (a domain helper next to `deltaAt`).
- The idle warm-up (`useInsightsWarmup`) checks every week of the history 5 s after each start
  (all sessions and `dWeekly` records): 382 ms of idle time at 4×. Lever: check the recent weeks and
  those of changed planned sessions only.
- "Verify data" reads the sets of each session with its own request (1,297 requests). Lever: one
  ranged read per batch of weeks.

### Copy and tone review (MOT-10, LEG-07, NFR-USE-03, NFR-USE-07)

Every English message was read: `messages.po` (2,487 messages, of which 233 are "Why?" texts),
`legal.po` (131) and `params.po` (143), plus the notification and timer-alert texts (they are
catalog messages in `hooks/use-timers.ts`, `hooks/use-timed-set.ts` and
`hooks/use-alert-settings.ts`), the manifest's name, description and shortcuts and
`index.html`'s description. **Changed: 152 messages** (54 in the boot catalog, 80 "Why?" texts,
8 in `legal.po`, 10 in `params.po`). No text was found that shames, diagnoses, predicts injury,
promises results or nags about missed sessions; the changes are about consistency, grammar and a
few absolute claims.

**Spelling: British, with -ise.** Counted in the catalogs before the review: favourite 5,
licence 5, metre 1, programme 1, prioritise 2, practise 3, travelling 1, "any more" 7 against no
American forms except "toward" (11 against 2 "towards"), "Vacation" (1, next to "Going on
holiday") and "rate of perceived exertion". "Winsorized" is only an ICU argument name, not
shown. Full forms, not contractions: the UI used 78 full forms against 5 contractions and the
legal texts none; only the "Why?" texts used contractions (about 90).

**Glossary (one word per concept):**

| Concept                     | Term                                                                                                      | Not                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| What the user does and logs | workout (start, finish, log, edit, past workouts)                                                         | session                             |
| A day in the plan           | session (planned session, today's session, missed session); also the unit of per-session statistics       | workout                             |
| The lighter week of a block | lighter week; "(deload)" after it where the technical term helps                                          | deload week, deload alone           |
| A group of training weeks   | block                                                                                                     | mesocycle (only in technical texts) |
| Effort                      | reps in reserve (RIR), RPE (rating of perceived exertion); "reps left in the tank" in the simple texts    | rate of perceived exertion          |
| Estimated max               | estimated 1-rep max (e1RM)                                                                                | —                                   |
| The body's weight           | bodyweight (one word, also as an adjective: bodyweight trend)                                             | body weight, body-weight            |
| One reading                 | weigh-in                                                                                                  | —                                   |
| Training level              | novice, intermediate, advanced (the level labels)                                                         | beginners                           |
| The app as the actor        | POWR ("POWR picked …"); "we" only for the publisher in the legal texts and the onboarding privacy summary | we                                  |
| The device                  | this phone (the UI); the legal texts keep "this device" (legal review)                                    | —                                   |
| Points formula              | IPF GL Points, IPF Points (proper names)                                                                  | IPF GL points                       |
| Examples                    | for example                                                                                               | e.g.                                |
| Quotes                      | straight quotes and apostrophes (the catalog's majority: 30 against 5)                                    | “ ” ’                               |

**Changes in the boot catalog (`messages.po`, 54):**

| Message                                                                                                                                                                                                         | Problem                                                      | Fix                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| "Restored. {sets} sets imported." (`DataScreen`)                                                                                                                                                                | "Restored. 1 sets imported." (an E2E test expected it)       | Plural: "Restored. 1 set imported."                         |
| "Drop {sets} back-off set(s)" (`CheckIn`)                                                                                                                                                                       | "set(s)"                                                     | Plural: "Drop 1 back-off set" / "Drop 2 back-off sets"      |
| "{pending} planned sets are not done. …" (`ExerciseList`)                                                                                                                                                       | "1 planned sets are not done"                                | Plural ("1 planned set is not done")                        |
| "{sets} back-off set fewer", "Top sets {rir} rep easier", "Compound lifts {rir} rep easier" (`past/parts`)                                                                                                      | "2 back-off set fewer", "2 rep easier"                       | Plurals                                                     |
| "{0} days selected" (onboarding), "{0} items" (equipment list)                                                                                                                                                  | "1 days selected", "1 items"                                 | Plurals                                                     |
| "{from} reps in reserve" (`effort.ts`: the dock, the plan, past sets), "{value} reps left" (novice prescriptions), "{low} reps" (library, set targets), "{reps} reps" (body map's last time)                    | "1 reps in reserve", "1 reps left", "1 reps"                 | Plurals for a single value; ranges keep "1–2 reps"          |
| "Are you trying to change your body weight?", "Body-weight goal (optional)", "Body weight" (field and units), "Check your birth year and body weight.", "Enter your body weight as …", "… body-weight trends …" | Two spellings of one term (27 "bodyweight" elsewhere)        | "bodyweight"                                                |
| "… counts toward …", "… count toward …", "… does not count toward …" (6)                                                                                                                                        | American "toward"                                            | "towards"                                                   |
| "e.g." in the equipment editor (6) and the birth-year error                                                                                                                                                     | Abbreviation; the catalog says "for example" elsewhere       | "for example"                                               |
| "“POWR”", "“Add page to”", "“Home screen”", "“Install app”", "today’s" (calendar, install card, device support)                                                                                                 | Typographic quotes in 5 messages, straight ones in 30        | Straight quotes and apostrophe                              |
| "… the date can't be in the future … if you're not sure.", "A plan that doesn't fit …", "I'm back: end the break", "Don't show this hint again"                                                                 | Contractions (the UI uses full forms)                        | "cannot", "you are", "does not", "I am back", "Do not show" |
| "Past sessions" (title, Progress and Start links), "Back to past sessions"                                                                                                                                      | The list of logged workouts called sessions                  | "Past workouts", "Back to past workouts"                    |
| "Vacation" (break reason)                                                                                                                                                                                       | American word; the Plan screen says "Going on holiday"       | "Holiday"                                                   |
| "Heaviest lifts done" (Settings → Insights)                                                                                                                                                                     | The same option is "Heaviest lifted" on the Scores screen    | "Heaviest lifted" (the accepted label)                      |
| "IPF GL points {0}" (Home)                                                                                                                                                                                      | Proper name written two ways ("IPF Points")                  | "IPF GL Points"                                             |
| "the deload check" ("Why?" button on the Plan screen)                                                                                                                                                           | Jargon alone                                                 | "the lighter-week check"                                    |
| "… lighter work on bad days." (check-in, Settings → Workout)                                                                                                                                                    | "Bad" judges the day; How POWR decides says "a low day"      | "low days"                                                  |
| "Lighter (deload) weeks count …: rest is training."                                                                                                                                                             | Overstated; Home says "Rest is part of training"             | "rest is part of training."                                 |
| "RPE (rate of perceived exertion)"                                                                                                                                                                              | Wrong expansion                                              | "rating of perceived exertion"                              |
| "Alerts while screen is locked:"                                                                                                                                                                                | Missing article (Device support says "while the screen …")   | "Alerts while the screen is locked:"                        |
| "Storage use: not reported by this browser."                                                                                                                                                                    | Status value in lower case (others: "Storage protected: No") | "Storage use: Not reported by this browser."                |
| "Not set. Set it in the exercise details"                                                                                                                                                                       | Second sentence without a full stop                          | Full stop                                                   |
| "Answer it in the plan set-up"                                                                                                                                                                                  | "set-up"; the noun is "setup" elsewhere                      | "plan setup"                                                |

**Changes in the "Why?" texts (80):**

| Message                                                                                                                                                                                                                                                                                          | Problem                                                                                                                                 | Fix                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| About 70 texts with "can't", "doesn't", "don't", "isn't", "it's", "that's", "there's", "you're", "you've", "they'd"                                                                                                                                                                              | Contractions; the rest of the app uses full forms                                                                                       | Full forms                                                                                               |
| `why.loading.round.simple`, `why.deload.reactive.propose.simple`, `why.progression.double.noHistory.simple`, `why.plan.schedule.weekdays.simple`, `why.plan.template.default.simple`, `why.plan.volume.sets.simple`, `why.progression.level.trainingAge.simple`, `why.plan.template.none.simple` | "we picked", "we suggest", "we'll build", "We arranged", "We spread", "We set", "We don't have": the app speaks as POWR everywhere else | "POWR picked", "POWR suggests", "POWR builds", "POWR arranged", "POWR spread", "POWR set", "POWR has no" |
| `why.deload.week` ("deloads are part of training"), `why.streak.current` ("deload weeks"), `why.streak.week` ("A deload week"), `why.validate.deload.missing` ("Add the deload week")                                                                                                            | The technical term alone                                                                                                                | "lighter weeks", "lighter (deload) weeks", "A lighter (deload) week", "Add the lighter week"             |
| `why.session.fixed`, `why.volume.notHardSet` (both), `why.volume.setCredit`, `why.plan.volume.target`, `why.plan.volume.budget`                                                                                                                                                                  | "toward"                                                                                                                                | "towards"                                                                                                |
| `why.guardrail.failure`: "… and gives no extra strength."                                                                                                                                                                                                                                        | Absolute claim                                                                                                                          | "… and usually adds no extra strength."                                                                  |
| `why.guardrail.slowReps`: "Reps slower than {limit} seconds build no more muscle"                                                                                                                                                                                                                | Absolute claim                                                                                                                          | "… do not seem to build more muscle"                                                                     |
| `why.readiness.assessment`: "You have slept short for # nights in a row."                                                                                                                                                                                                                        | Unidiomatic                                                                                                                             | "Your sleep has been short for # nights in a row."                                                       |
| `why.scoring.ipfGl`: "IPF GL points"                                                                                                                                                                                                                                                             | Proper name                                                                                                                             | "IPF GL Points"                                                                                          |

**Changes in `legal.po` (8, spelling and terms only, no change in substance):** "Nutrition and
body weight", "Body-weight goals …" (2), "Body-weight trend", "… across body weights", "body
weight and body measurements you log" → "bodyweight"; "beginners" (2, How POWR decides) →
"novices". The legal versions (`features/legal/versions.ts`) stay: spelling is not a change in
substance, so nobody is asked to acknowledge again.

**Changes in `params.po` (10):** "Body-weight …" and "body weight" (8) → "Bodyweight",
"bodyweight"; "for beginners" (3) → "for novices"; "IPF GL points" → "IPF GL Points".

**Tests updated for the new texts:** `e2e/backup.spec.ts` ("Restored. 1 set imported."),
`e2e/m2c.spec.ts` ("towards the minimum effective dose"), `e2e/past-sessions.spec.ts` ("Past
workouts"), `test/onboarding.test.tsx` and `test/profile-edit.test.tsx` ("Bodyweight"),
`test/alerts.test.tsx` ("Alerts while the screen is locked:"), `test/progress.test.tsx` and
`test/past-sessions.test.tsx` ("Past workouts"), `test/plan.test.tsx` (`/\d reps? left/`, so a
single "1 rep left" also counts). No assertion was loosened otherwise.

**Not reviewed:** the exercise content (`packages/content/data/**`: names, cues, muscle names;
content is its own review), the citations (bibliographic data), the debug pages (developer
tools, English only, not in production builds), and the content of the legal texts (the legal
review, M6b's packet).

**Open decisions for the product owner:**

- **Workout and session.** The rule above is applied where it was clearly broken ("Past
  sessions"). Everything else already follows it; the per-session statistics ("Volume load per
  session", "Each session's estimate") keep "session" as the unit.
- **"Novice" or "beginner".** The review follows the level labels ("novice"); "beginner" is
  plainer. Changing it means the level label, the "Why?" texts and the parameter labels together.
- **"This device" in the legal texts and the onboarding privacy summary,** "this phone"
  everywhere else: left to the legal review.
- **Straight or typographic quotes.** Straight quotes were the majority and stay; typographic
  quotes throughout would be one sweeping change.
- **"Welcome back!"** in three "Why?" texts (after a break) are the only exclamation marks in the
  app; kept as a greeting.

### TD-64: the update before the one-tap start

Home's start card offers a waiting update the way the start screen does (TD-14): with an update
waiting and no workout running, "Today" shows "Update before you start?" (an h3 in the card) with
"Update first" and, in place of the one-tap "Start today's session", the link "Start without
updating" (it starts today's session as before). Choosing it sets `updateDeferred` in the UI store
for this page, so the start screen does not ask again; the banner still offers the update and the
update gate still never applies one during a workout. The manifest shortcut and any
`/session?start=today` that arrives while an update is waiting no longer start at once: the start
screen shows the offer, and "Start without updating" starts today's session. Without an update the
one-tap start is unchanged. A shortcut launch whose waiting update is only found after the start
(the registration resolves after the first render) still starts at once; the update then waits for
the end of the workout (QS-04). Tests: `test/m6a.test.tsx` (Home's offer with axe, "Update first",
the deferred start with the check-in; the shortcut start waiting, then starting; no offer without an
update); `test/m5d.test.tsx` unchanged but for the store reset.

### TD-67: safety copies are pruned

Rule (`SAFETY_COPIES`): **the latest two copies are always kept, and so is every copy younger than
30 days; only a copy that is neither is deleted.** A copy taken before a restore therefore stays at
least 30 days, there are never fewer than two, and a copy whose time cannot be read is kept.
Pruning runs after each new copy (before a restore, before a data update) and when Data and
backups lists them; a failed prune only leaves a copy more. The store (`powr-safety`) no longer
rotates by itself; the rule lives in the application (`safetyCopiesToPrune`, pure). Data and
backups says it: "It keeps the latest two copies and any from the last 30 days, and deletes older
ones by itself." Before, the store kept exactly the latest two, so a second restore on the same day
deleted the copy from before the first. Not built: deleting a copy "after a newer regular backup"
(§8.2.1): POWR cannot know whether the user kept that file. Tests: the pure rule (the latest two at
any age, any number of young copies, the 30-day boundary kept, time before ID, unreadable times kept),
a restore pruning the old copies beyond the latest two, the list pruning by the clock, and the real
`powr-safety` store with the data-update guard (fake-indexeddb).

### E2E flakes

- **Before any change** the baseline `pnpm verify` stopped at the E2E stage with two timeouts of
  the default 30 s: `session.spec.ts` "planned session: one tap per set …" (37.8 s, inside an axe
  scan) and `body-map-screen.spec.ts` "tap a muscle → ranked list …" (35.3 s). Both run a workout
  and then 9 and 11 axe-and-reflow checks in two themes; under eight parallel workers they take
  25–38 s. Cause: genuinely heavy tests on the default limit (the machine also ran other worktrees'
  tests). Fix: 90 s for these two, like `library.spec.ts`; no assertion changed.
- The new sweep adds seven tests of 20–45 s to the parallel run; its data comes from `/debug/perf`
  in about 2 s instead of logging workouts through the UI, so it stays under the limits it sets
  (240–300 s per group, generous for the heaviest).
- `alerts.spec.ts` variant B (M5z's note: no "Rest over" within 6 s once): passed in the baseline
  run and in both full runs after the changes; nothing to fix without a failure to study.

### Decisions and deviations

| Brief or concept says                                                  | What I did                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The reference dataset from `tools/dataset` as a backup ZIP (§8.19)     | A package entry (`@powr/application/reference`) and a debug page that writes it into the real database: the same records for the engine test, the E2E spec and the S22, no file to keep in step. A ZIP for the S22 is one "Export backup" after loading it |
| "Reuse M4a's perf generator"                                           | Moved, not copied: `test/perf.test.ts` calls it with M4a's shape (260 weeks, four days, six sets, no weigh-ins or breaks) and asserts the same counts                                                                                                      |
| Cold start "on the S22, installed, in airplane mode"                   | A new page in the warm browser context with the app files cached by the service worker; the process start of an installed app is the device pass                                                                                                           |
| A unique page title per route                                          | A `context` for the page title of the two flows that repeat the first run's headings; the visible h1 stays the same everywhere                                                                                                                             |
| TD-67 "keep the latest two plus any younger than 30 days, or per §8.2" | The brief's rule; §8.2.1's "after a newer regular backup" is not built (POWR cannot know that the file was kept)                                                                                                                                           |
| TD-64 "Home's one-tap start also offers a waiting update"              | On Home and, for the shortcut, on the start screen; "Start without updating" holds for the page                                                                                                                                                            |
| Fix every flake properly                                               | Two heavy tests got 90 s (their own work, not a race); the sweep seeds its data through `/debug/perf` so that it does not add slow UI setup to the parallel run                                                                                            |
| Copy: legal texts only typo and consistency fixes                      | Spelling and terms only (bodyweight, novices); `features/legal/versions.ts` unchanged, so nobody is asked to acknowledge again                                                                                                                             |

### Evidence

`pnpm verify` green on 2026-11-25 (exit 0): lint (0 errors, 0 warnings), format, token gate, knip,
catalog check, typecheck, **1,051 unit tests in 88 files** (1,039 before) and **126 component
tests in 23 files** (123 before), build, licence gate, size (**entry JS 178.13 kB** gzip of 186,
was 177.98: the update flag and its setter, the warm-up's measure and the page-title context;
**1 first-wave script, 0 with Zod**; CSS 7.33 kB; service worker 9.56 kB; precache 217 files +
`sw.js`, 1,078.1 kB) and **85 E2E tests** (78 before; 4 opt-in skipped: the three S-4
measurements and the perf spec). The baseline `pnpm verify` before any change: everything green
but two E2E timeouts (see "E2E flakes").

- **Unit:** `packages/application/test/m6a.test.ts` (9: the pruning rule, a restore and the list
  pruning, the reference dataset's size, determinism and breaks, adding and replacing it),
  `summaries.test.ts` (+2: the exercises of quick logs and of sets logged before a swap; one shared
  load for the views of one exercise), `apps/web/src/infrastructure/db/safety-db.test.ts` (1: the
  real `powr-safety` store with the guard and the list); `perf.test.ts` uses the shared generator.
- **Component:** `test/m6a.test.tsx` (3: Home's offer with axe, "Update first", the deferred
  start; the shortcut's start waiting for the choice; no offer without an update).
- **E2E:** `e2e/a11y.spec.ts` (7: the check of the checks, the first run, Home/plan/workout with
  the dock at 48 px, Progress, Explore, body/data/settings/legal, the page titles of every route);
  `e2e/perf.spec.ts` (opt-in); the two 90 s limits. A second full `pnpm e2e` right after: 85 passed, 4 skipped, no flake
  (alerts variant B included; it passed both runs).
- **Perf runs:** before and after as in the table, logs in the coordinator's scratchpad
  (`m6a-perf-before.log`, `m6a-perf-after.log`).

### Open items and decisions for the product owner

- **Copy:** "workout" for what the user does and logs, "session" for a planned day (applied where
  broken); "novice" or the plainer "beginner"; "this device" in the legal texts (legal review);
  straight quotes; "Welcome back!" (see the copy review above).
- **TD-67:** the rule as built keeps every copy of the last 30 days, so several restores in a month
  keep several full copies (each the size of a backup). Accept, or cap the number (for example at
  five) with the oldest young copy going first.
- **Performance:** the four levers above (weigh-ins per set confirm, the hub's full points read,
  the idle warm-up, "Verify data"'s per-session reads) are within budget on this machine; decide
  after the S22 numbers (TD-50) whether any is needed for the MVP.
- **S22 pass:** cold start, set confirm, Progress and the chart with the reference dataset
  (`/debug/perf` in a beta build, then remote DevTools or the page's own list); the TalkBack list
  above.

### Doc amendments for M6b or the coordinator (`docs/**` not edited)

- **Technical concept §8.2.1:** `powr-safety` row and the v0.9 paragraph: safety copies are pruned
  by the rule "the latest two, plus every copy younger than 30 days" after each new copy and when
  Data and backups lists them (`pruneSafetyCopies`, `@powr/application/data`); the store does not
  rotate; no deletion after a newer regular backup. TD-67 closed.
- **§6.3 rule 2 (v0.9 paragraph), §8.9.11:** Home's start card offers the waiting update
  ("Update first" / "Start without updating"), the shortcut's start waits for the choice; the
  choice holds for the page (`updateDeferred`). TD-64 closed.
- **§8.14:** the M6a sweep (`e2e/a11y.spec.ts`: every route, both themes, axe, names from the
  accessibility tree, WCAG 2.5.8 targets with the spacing exception, the dock at 48 px and 8 px,
  unique page titles, reflow); `Screen`'s `context` for page titles; the TalkBack list.
- **§8.19:** the reference dataset as built (`@powr/application/reference`, `/debug/perf`; no
  `tools/dataset`), the marks `powr-home-interactive`, `powr-set-commit`, `powr-insights-warmup`,
  the opt-in perf spec and the M6a numbers; the chart chunk preloaded on the Progress hub; entry
  JS 178.13 KB (1 first-wave script, 0 with Zod).
- **§8.20:** the sweep in `pnpm verify`, the perf spec opt-in (`POWR_PERF=1`), the 90 s limits.
- **§11.2:** TD-64 and TD-67 closed; new items for the four measured levers (weigh-ins per set
  confirm, the hub's points read, the idle warm-up, "Verify data"); TD-50 (S22 timings) now has the
  dataset and the page to run them.
- **PRD (proposals, not edited):** NFR-USE-03/MOT-10: the glossary of the copy review as the content
  style guide's term list (MOT-10 names the style guide as a design deliverable); DAT-06/§8.2.1
  wording for the safety-copy rule.

## M6b release readiness docs

Written 2026-11-25 by the M6b work: the release-readiness documents before the MVP release
(documentation only; no app code changed). The agent-side hardening M6a ran in parallel and owns
`apps/**` and `packages/**`. Nothing committed; the product owner commits.

### What landed

| Document                                        | What it is                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PRD.md` v0.8                              | The M5 wording approved by the product owner on 2026-11-25 (below); version, status and a changelog row; nothing else changed                                                                                                                                                 |
| `docs/release/checklist.md`                     | The MVP release checklist: one row per PRD §10.3 exit criterion (evidence, owner, status), the known Must gaps and Should deferrals, the deploy and launch steps, the technical-concept items due before release, status counts and sign-off                                  |
| `docs/release/legal-review-packet.md`           | V-05/V-06: every legal text with its route and source file, who sees what, the data flows (device, files, network, hosting chain), 18 statements to check, the placeholders, the trademark check, 26 questions, and the current wording verbatim (Appendix A). No conclusions |
| `docs/release/licence-review.md`                | V-04: how the gate works, the inventory (878 components: 37 distributed = 31 npm + 6 own-work assets, 841 build-only), every shipped package with its licence and copyright, the NOTICE texts (ECharts, Dexie), the Sentry block and argparse exclusion, four findings        |
| `docs/release/content-review.md`                | One table of every content judgement call (J-01…J-12), the full 86-exercise standard-variant list by pattern (SV-01…SV-22, notable choices in bold) and the open gaps (G-01…G-03: carry, tibialis, timed exercises)                                                           |
| `docs/release/usability-test-plan.md`           | M1–M4 and M13: success criteria, participants (n ≥ 8, both styles and sexes), setting, ten tasks, the script, the observation template, the analysis                                                                                                                          |
| `docs/device-tests/TalkBack-protocol.md`        | The TalkBack items of the M2b, M2c, M3t, M3b, M4v, M4b, M5d, M5s notes, S-2 and §8.14 as one ordered checklist in 23 screens, with a results template                                                                                                                         |
| `docs/device-tests/S22-performance-protocol.md` | Cold start, set confirmation, charts, body map and the other NFR-PERF budgets on the S22 with the reference dataset; generic where M6a's perf spec is not merged yet                                                                                                          |
| `docs/device-tests/README.md`                   | Index of the device protocols (S-1, S-2, S-6, TalkBack, performance, S-8, offline), the order to run them, the S-8 steps, the M9 offline checklist and how results feed back                                                                                                  |
| `docs/technical-concept.md` v0.10               | §0 version and status, a changelog row, the M6 status paragraph in Appendix A.4 and TD-66 "after S-2"; no section that M6a may report on was touched                                                                                                                          |

**PRD v0.8 (product-owner decisions of 2026-11-25):** A-05 and EXL-01 met with 190 exercises
(EXL-01 status bullet, §7.1, the A-05 row); PLN-02 table: bodybuilding 4 days "Upper/Lower ×2 or
Full body ×4", 6 days "Push/Pull/Legs ×2 or Upper/Lower ×3", plus a bullet that the second split is
an alternative and powerlifting and powerbuilding have none for now; PLN-05 and MAP-03: the standard
variant ranks first among equal scores; PWA-05: the two shortcuts built; DAT-08: "Remind me later"
for 3 days; DAT-13: the "All data deleted" screen before the first run; CAL-02: the start-time
choice at export includes all-day events; SET-05: RPE or RIR display and entry (records keep RIR),
one tap per value or half steps; SET-08: update from next week or keep, only plan-changing answers
ask, the new plan shown first; SET-09: contact by e-mail (`tools@sz-development.com`); LEG-09: a
release check blocks production until the postal address is provided.

### Found while writing (no code changed)

- **Attributions copyright lines (licence review L-1):** `tools/licence/src/packages.ts` keeps every
  licence-text line that starts with "Copyright" or "(c)", so the attributions screen shows Apache
  licence boilerplate and template lines ("Copyright {yyyy} {name of copyright owner}") as the
  copyright of class-variance-authority, dexie and echarts, and one licence-text line each for
  @floating-ui/utils and lucide-react. The NOTICE and licence texts are complete. Release checklist
  row EC-17.
- **Server-side components** (Coolify, Traefik, nginx, Alpine) are not in `licence-inventory.json`,
  although technical concept Appendix B says they are recorded as `distributed: false` (L-2).
- **LEG-06 "credits data sources":** the scoring and study sources are cited in "How POWR decides"
  and the "Why?" sheets, not on the attributions screen (L-3). `Python-2.0` is allowed but unused
  (L-4).
- **Must gaps listed in the checklist:** PWA-12 unsaved-edit prompts (TD-68), the changelog and
  release notes (TD-20), the static website copy of the legal texts (TD-71), the backup format
  document (TD-22), no `pnpm audit --prod` step (NFR-SEC-01), the 200 randomized kills (TD-13), the
  LEG-07 copy review.
- **Not built, promised by the concept:** the reference-dataset generator `tools/dataset` (§8.19;
  the performance protocol waits for a dataset file), the `home-interactive` mark (§8.19), the
  "Verify it yourself" page and the release checksums (§8.18), the "POWR has moved" beta banner
  (§7.8; only needed if beta testers keep data).
- **PRD §8.6** still says "A postal contact address and e-mail are to be provided", although the
  e-mail is now decided; left unchanged ("change nothing else"), for the next PRD pass.
- **The baseline `pnpm verify` run** (before any M6b file existed beyond the PRD) stopped at the
  E2E step with two 30 s timeouts (`body-map-screen.spec.ts` "tap a muscle → … add to today",
  `session.spec.ts` "planned session: one tap per set …") while the machine's load average was
  about 32 (parallel agents); everything before E2E was green. See "Evidence" for the final run.

### Release checklist status (2026-11-25)

52 rows: **3 done**, **14 pending a device test**, **23 pending the product owner**, **12 pending an
agent**. Of the 18 exit-criterion rows: 2 done, 7 device, 7 product owner, 2 agent.

### Open questions for the product owner

1. The content decisions in `docs/release/content-review.md` (J-01…J-12, SV-01…SV-22, G-01…G-03).
2. The Should deferrals S-01 (LEG-04 until after the legal review) and S-02 (image sharing with
   MOT-09 in v1.2).
3. Licence findings L-2 (add the server components to the inventory, or amend the concept), L-3
   (citations enough for LEG-06?) and L-4 (keep `Python-2.0`?).
4. T-10: build the "Verify it yourself" page and the release checksums for the MVP, or defer them.
5. D-11: is the "POWR has moved" banner needed for the beta testers?
6. D-03: confirm the data-processing agreement with Hetzner.

### Evidence

- `pnpm format:check` passes (`docs/**` is excluded from oxfmt; this section is formatted).
- `pnpm verify` on the final state, 2026-11-25: **exit 0** (load average about 2): lint, format,
  token gate, knip, catalog check, typecheck, 1,039 unit and 123 component tests, build, licence gate
  (37 distributed, 841 build-only), size (entry JS 177.98 kB gzip of 186; precache 213 files +
  `sw.js`, 1,072.5 kB) and 78 E2E tests (3 opt-in skipped). The two E2E tests that timed out in the
  baseline run under load passed.
- Every relative link and anchor in the new documents resolves (checked with a script).

### Suggested commit (no attribution)

One commit, or two:

1. `docs: PRD v0.8 with the M5 wording approved on 2026-11-25` — `docs/PRD.md`.
2. `docs: M6b release-readiness documents and technical concept v0.10` — `docs/release/*`,
   `docs/device-tests/TalkBack-protocol.md`, `docs/device-tests/S22-performance-protocol.md`,
   `docs/device-tests/README.md`, `docs/technical-concept.md`, `IMPLEMENTATION_NOTES.md`.
