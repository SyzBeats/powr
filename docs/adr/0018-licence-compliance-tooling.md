# ADR-0018: Licence compliance tooling: own inventory from the bundle graph + SPDX policy gate

- Status: Accepted
- Date: 2026-11-23
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
