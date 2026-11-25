# ADR-0016: Internationalisation: Lingui 6 + Intl

- Status: Accepted (v0.2, 2026-11-24: literal-string enforcement re-designed for oxlint; v0.3, 2026-11-24: configuration as implemented; v0.5, 2026-11-24: native macro transform, see below)
- Date: 2026-11-23, revised 2026-11-24
- Related: technical concept §8.15, §8.7.3; PRD NFR-MNT-04, NFR-L10N-01/02, NG-10, C-06, TC-16

## Context

The UI is English only, but all user-facing strings must be externalized so that translation is possible later. Numbers, dates and times follow the device locale while the UI stays English. Layouts must tolerate about 30% longer strings. The engine returns explanation message IDs with arguments, which the UI must render with plurals and units. Facts checked 2026-11-23: `@lingui/core` and `@lingui/react` 6.12.0 (MIT, core about 2.4 KB gzipped), `@lingui/vite-plugin` 6.12.0 (peer Vite ^6–^8 and `@rolldown/plugin-babel`), `eslint-plugin-lingui` 0.16.0 (MIT); `i18next` 27.2.6 + `react-i18next` 18.0.3 (MIT, i18next about 16 KB gzipped).

## Options considered

| Criterion (weight) | Lingui 6 | i18next + react-i18next | In-house typed catalog + Intl |
|---|---|---|---|
| Fit with React + TS (2) | 5 | 5 | 4 |
| Bundle size (2) | 5 | 3 | 5 |
| ICU MessageFormat (plurals, select) (2) | 5 | 3 (plugin) | 2 |
| Enforcement against literal strings (2) | 5 | 4 | 3 |
| Maintenance (2) | 4 | 5 | 3 |
| Solo productivity (2) | 4 | 4 | 3 |
| **Total (max 60)** | **56** | 48 | 40 |

## Decision

- **Lingui 6** with `t` / `<Trans>` macros, PO catalogs compiled at build time, and a pseudo-locale for expansion tests.
- **Explicit, stable message IDs** for everything the engine emits (explanations, warnings, evidence labels); source-text IDs for ordinary UI copy.
- **Enforcement (v0.2, after ESLint was replaced by oxlint, ADR-0017):**
  1. oxlint's native `react/jsx-no-literals` is **blocking** for literal text in JSX, with an allow-list for symbols and non-text props.
  2. Strings outside JSX must use the `t` macro; this is a code-review checklist item.
  3. `eslint-plugin-lingui`'s `no-unlocalized-strings` runs through oxlint's **alpha** JS plugins as a **non-blocking warning** and becomes blocking once JS plugins are stable (resolved 2026-11-24, OQ-T10: warn now, block later).
  4. CI fails if `lingui extract` changes the English catalog.
- A central `format.ts` wraps `Intl` formatters using the device locale; week start defaults from `Intl.Locale.getWeekInfo()`.
- Content texts use `LocalizedText { en }`.

## Consequences

- Positive: tiny runtime; ICU plurals; lint-enforced externalization; translation later means adding catalogs.
- Negative: the macro needs a Babel transform under Vite 8 / Rolldown (`@rolldown/plugin-babel`); verified in the M0 skeleton. Fallback: use `i18n._()` with explicit IDs and no macros (risk T-08).
- Negative (v0.2): literal strings outside JSX are not caught by a blocking rule (TD-08).
- Runner-up: **i18next**.

## Amendment (v0.3, 2026-11-24)

- **`react/jsx-no-literals` configuration.** `noStrings: false`, because in oxlint `noStrings: true` flags every attribute literal (`className`, `to`, …). `restrictedAttributes` covers the text-bearing attributes `aria-label`, `title`, `placeholder`, `alt` and `label`; `allowedStrings` lists symbols such as "·", "×" and "–"; `<Trans>` and `<Plural>` are allowed as elements. The developer harness pages (`src/features/debug`, English-only diagnostics for device spikes) are exempt from this rule and from `no-unlocalized-strings`.
- **`lingui/no-unlocalized-strings`** (warning) is scoped to `features`, `ui` and `routes`, with identifier-like strings (no spaces, no capitals) ignored.
- **Catalog check in the build.** `pnpm build` runs the `lingui extract` check before Vite: production macros drop the source messages, so a stale catalog would show message hashes in the UI, and `failOnMissing` does not catch messages that were never extracted.
- **Babel macro path verified** under Rolldown. Lingui 6.12 recommends its native `macroTransform` and prints a warning for the Babel path, which the build suppresses (`LINGUI_SUPPRESS_BABEL_WARNING`). Evaluating the native transform is TD-09.

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.

## Amendment (v0.5, 2026-11-24)

The decision stands. v0.5 folds in the M2 tooling (TD-09 native Lingui macro, TD-10 native React Compiler lint rules, TD-12 Lighthouse CI and Trusted Types in dev/E2E) and the Sentry package block list; for this ADR that is TD-09:

- **Native macro transform (TD-09 closed).** The `t` and `<Trans>` macros compile with Lingui's native transform: `lingui({ macroTransform: true })` from `@lingui/vite-plugin`, backed by `@lingui/native-tools` 0.2.0 (SWC-based, installed as a dependency of `@lingui/cli` and the Vite plugin). Babel (`@rolldown/plugin-babel`) now runs only the React Compiler. `linguiTransformerBabelPreset`, the warning suppression `LINGUI_SUPPRESS_BABEL_WARNING` and the app's `@lingui/babel-plugin-lingui-macro` devDependency are gone; the Lingui CLI's extractor still depends on that package itself.
- **Plugin order.** `lingui()` must come before the Babel plugin in `vite.config.ts`. Both are `enforce: 'pre'` and run in array order; with Babel first, the React Compiler saw the raw macros and skipped four components.
- **Evidence.** Compared with the Babel build chunk by chunk, 29 of 30 assets are identical; the session chunk differs only in the key order of one message's `values` object (the same object at runtime). In development the message descriptors (`id`, `message`, `values`) are identical. `pnpm i18n:extract` leaves the catalog unchanged, because extraction runs in the Lingui CLI and does not use the Vite transform; the catalog check passes.
- **Consequences.** The Babel dependency noted under Consequences now concerns only the React Compiler; the fallback for risk T-08 (`i18n._()` with explicit IDs) is unchanged. `eslint-plugin-lingui` stays the only alpha JS plugin in the lint setup (OQ-T10, ADR-0017).

Source: `IMPLEMENTATION_NOTES.md` (repository root), section "M2 tooling (TD-09, TD-10, TD-12)".

## Amendment (v0.6, 2026-11-24)

The decision stands. `lingui/no-unlocalized-strings` still reports a warning, but since M2c the lint gate denies warnings (`oxlint --type-aware --deny-warnings`, ADR-0017), so the rule blocks in practice; the code base has no unlocalized UI string left. The page title (`{title} · POWR`) and the evidence-source names in the "Why?" sheet became messages. The rule's `ignore` list also skips route patterns with `$params` and single camelCase tokens, because the plugin's type-aware option cannot run in oxlint.

Source: `IMPLEMENTATION_NOTES.md` (repository root), section "M2c planning gaps".

## Amendment (v0.9, 2026-11-25)

The decision stands. Two lazy catalogs joined the boot catalog (technical concept §8.15): `legal` (the legal texts, about 6.2 KB gzip) and `params` (the 143 parameter labels of the "Why?" sheet and "How POWR decides", about 3.2 KB gzip). `loadCatalog(name)` merges a catalog on first use, and the catalog check covers every catalog. The legal texts are React elements with `<Trans>`, so their markup and links stay in the code and their wording in the catalog.

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M5s settings, legal and explainability".
