# ADR-0018: Licence compliance tooling: own inventory from the bundle graph + SPDX policy gate

- Status: Accepted (v0.3, 2026-11-24: own SPDX evaluator; licence exceptions approved; v0.4, 2026-11-24: content entries approved, see below)
- Date: 2026-11-23, amended 2026-11-24
- Related: technical concept §8.21, §8.12; PRD LEG-06, LEG-08, NFR-MNT-08, TC-18, V-04, R-09

## Context

The app is closed source. Every distributed component (runtime dependencies including transitive ones, plus fonts, icons, artwork, data sets and text) needs a recorded, permissive licence; copyleft is blocked unless reviewed; CI must fail on unknown or unapproved licences; the in-app attributions screen must be generated from the inventory and list exactly what ships. Build-only tools are recorded but not distributed.

Facts checked 2026-11-23: `rollup-plugin-license` 3.7.2 (MIT, peer `rollup ^1–4`; compatibility with Vite 8's Rolldown unconfirmed), `license-checker-rseidelsohn` 5.0.1 (BSD-3-Clause; scans installed packages, not the bundle), `spdx-expression-parse` 5.0.0 and `spdx-satisfies` 6.0.1 (MIT), `pnpm licenses list` (built-in).

## Options considered

| Criterion (weight) | Own Vite/Rolldown plugin + SPDX policy | `license-checker-rseidelsohn` over production deps | `rollup-plugin-license` | Commercial SCA service |
|---|---|---|---|---|
| Accuracy of the distributed set (3) | 5 (actual bundle modules) | 3 (over-approximates) | 5 | 4 |
| Generates attribution texts (3) | 5 | 4 | 4 | 4 |
| CI fail policy (2) | 5 | 4 | 4 | 5 |
| Non-npm assets (fonts, art, data) (2) | 5 | 1 | 1 | 3 |
| Maintenance effort (2) | 3 | 5 | 3 (Rolldown compatibility) | 3 |
| Cost (1) | 5 | 5 | 5 | 1 |
| **Total (max 65)** | **61** | 46 | 48 | 47 |

## Decision

`tools/licence` provides:

1. A Vite plugin that collects the module IDs of all emitted chunks (`generateBundle`) and maps them to `name@version`.
2. A checker that reads SPDX expressions, licence and NOTICE files, and copyright lines; evaluates them against `licence-policy.yaml` (allowlist, denylist, dev-only allowances, reviewed exceptions with reviewer and date); and **fails the build** on unknown, denied or unapproved licences.
3. A merge with `assets-inventory.yaml` for non-npm assets.
4. Outputs: `licence-inventory.json` (release artifact; includes build-only tools from `pnpm licenses list`, marked `distributed: false`) and `attributions.json` (distributed only, with full texts where required), rendered by the in-app attributions screen. An E2E test checks the screen against the inventory.

## Consequences

- Positive: the inventory reflects exactly what ships; one mechanism covers code, fonts, art and data; no external service.
- Negative: own code to maintain (about 300 lines + tests); covered by fixtures (a GPL fixture must fail, an `MIT OR GPL` fixture must pass as MIT).
- Runner-up: **rollup-plugin-license**, once Rolldown compatibility is confirmed, for the bundle part only.

## Amendment (v0.3, 2026-11-24)

- **Own SPDX evaluator.** The checker evaluates the `spdx-expression-parse` syntax tree itself; `spdx-satisfies` is not used. The evaluator must record which alternative of an `OR` expression was chosen and apply glob deny patterns such as `GPL-*`.
- **Plugin flow across two builds.** The app build writes its package list; the service-worker build runs last, merges both lists, writes `attributions.json` and fails the build on a disallowed licence, before Workbox builds the precache manifest, so `attributions.json` is precached.
- **Approved licence decisions** (recorded in `licence-policy.yaml` and `assets-inventory.yaml`):

  | Decision | Scope | Approval |
  |---|---|---|
  | `LicenseRef-Own-Work` on the allowlist for the project's own original assets (the generated app icons; also the M0 content stub) | Distributed | Approved by product owner Simeon Zimmermann, 2026-11-24 |
  | Exception for `spdx-exceptions@2.5.0` (CC-BY-3.0): SPDX exception-ID list read by the licence tool, data only | Build-only, never shipped | Approved by product owner Simeon Zimmermann, 2026-11-24 |

- **Approval is enforced.** Each exception entry carries `reviewer`, `approval`, `date`, `scope` and `rationale`. The gate ignores an exception without a recorded `approval`, so an unapproved entry fails the build like a missing one (policy unit test).

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.

## Amendment (v0.4, 2026-11-24)

- **Content entries.** The content build (`tools/content-build`) owns four entries of `assets-inventory.yaml`: `powr-content-exercises`, `powr-content-muscle-taxonomy`, `powr-content-equipment` and `powr-content-templates` (`LicenseRef-Own-Work`, version = content SemVer). They replaced the M0 content-stub entry.
- **Decision (product owner, 2026-11-24): the four content entries are approved as own work.** The entries' `approval` field records this; because the build writes these entries, the approval text belongs in the build's inventory template (`tools/content-build/src/inventory.ts`) so that `pnpm content:check` stays green.

Source: `IMPLEMENTATION_NOTES.md` (repository root): §3 rows marked "Docs amended in v0.4" and the sections "M1-B content" and "M1-A engine and rules".
