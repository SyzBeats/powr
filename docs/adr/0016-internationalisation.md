# ADR-0016: Internationalisation: Lingui 6 + Intl

- Status: Accepted (v0.2, 2026-11-24: literal-string enforcement re-designed for oxlint)
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
