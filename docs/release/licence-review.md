# POWR licence review (V-04)

| Field | Value |
|---|---|
| Version | 1.0, 2026-11-25 (M6b) |
| Purpose | The human review behind PRD V-04 (licence review of every third-party component before release), LEG-06 (attributions screen) and LEG-08 (licence policy and inventory, closed source) |
| Build reviewed | The M6 baseline (M5z merged): `pnpm build && pnpm licence` on 2026-11-25. Content 0.3.0, rules 1.7.0 |
| Related | [PRD v0.8](../PRD.md) §8.4, LEG-06, LEG-08, NFR-MNT-08, R-09; [technical concept](../technical-concept.md) §8.21 and Appendix B; [ADR-0018](../adr/0018-licence-compliance-tooling.md); `licence-policy.yaml`, `assets-inventory.yaml`; [release checklist](checklist.md) rows EC-16, EC-17 |

> The licence gate is automatic and blocks the build. This document summarises what it checked and lists what a person should still confirm. It is not legal advice.

## 1. How the licence gate works

The gate is the project's own tool, `tools/licence` (ADR-0018). It runs inside every build and again as `pnpm licence` (part of `pnpm verify` and of CI).

1. **What ships.** A Vite/Rolldown plugin collects the modules of every emitted chunk of the app build and the service-worker build, and maps them to `package@version`. The result is the exact set of npm packages in the shipped files, not everything installed.
2. **What each package says.** For each package it reads the SPDX licence expression from `package.json`, the licence and NOTICE files, and the lines that look like copyright notices.
3. **The policy.** It evaluates each expression against `licence-policy.yaml` with an own evaluator (for `A OR B` it records which licence was chosen):
   - `allowed` (distributed components): MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, Zlib, CC0-1.0, Unlicense, OFL-1.1, CC-BY-4.0, BlueOak-1.0.0, Python-2.0, and `LicenseRef-Own-Work` for the publisher's own assets (approved by the product owner on 2026-11-24);
   - `denied`: `GPL-*`, `AGPL-*`, `LGPL-*`, `MPL-*`, `EPL-*`, `EUPL-*`, `CDDL-*`, `CC-BY-SA-*`, `CC-BY-NC-*`, `SSPL-*`, `BUSL-*`;
   - `devOnlyAllowed`: MPL-2.0, for build and test tools that never ship;
   - `deniedPackages`: a block list checked first, whatever the licence (section 4);
   - `exceptions`: reviewed exceptions, each with reviewer, approval, date, scope and rationale; an exception without a recorded approval is ignored.
4. **Assets.** It merges `assets-inventory.yaml` (non-npm assets: icons, artwork, content).
5. **Failure.** The build fails on a missing or unparseable licence, a denied licence, a licence that is neither allowed nor covered by an approved exception, or a blocked package.
6. **Outputs.**
   - `licence-inventory.json` at the repository root: every component, distributed and build-only (from `pnpm licenses list`), with its verdict. It is generated (gitignored) and kept as a CI artifact of each run; a release keeps the one of its build.
   - `apps/web/dist/attributions.json`: the distributed components only, with the full licence text, the NOTICE text and the copyright lines. It is precached and rendered by Settings → Legal → "Open-source licences and attributions" (`/legal/attributions`). An E2E test (`apps/web/e2e/settings-legal.spec.ts`) checks that the screen lists exactly the distributed inventory entries and shows the ECharts NOTICE byte for byte.

**Checks of the gate itself:** `tools/licence/test/policy.test.ts` and `gate.test.ts` (a GPL fixture fails, an `MIT OR GPL` fixture passes as MIT, a blocked package fails even with an allowed licence or an approved exception, an exception without approval is ignored, distributed assets reach `attributions.json`). `pnpm licence:demo-gpl` shows a failing run.

**Re-run it:** `pnpm build && pnpm licence`. The summary line reads `Licence inventory: <n> distributed, <m> build-only -> licence-inventory.json`, then `Licence gate passed.`

## 2. Inventory summary (2026-11-25)

| | Count |
|---|---|
| All components | 878, every verdict "allowed" |
| **Distributed** (ship to users) | **37**: 31 npm packages and 6 own-work assets |
| Build-only (never ship) | 841 |

### 2.1 Distributed npm packages (31)

Licences: MIT 25, Apache-2.0 3, ISC 1, BSD-3-Clause 1, 0BSD 1. No dual-licensed package ships.

| Package | Version | Licence | Copyright as shown on the attributions screen | NOTICE |
|---|---|---|---|---|
| @base-ui/react | 1.9.0 | MIT | Copyright (c) 2019 Material-UI SAS | — |
| @base-ui/utils | 0.5.0 | MIT | Copyright (c) 2019 Material-UI SAS | — |
| @floating-ui/utils | 0.2.12 | MIT | Copyright (c) 2021-present Floating UI contributors; plus a licence-text line (L-1) | — |
| @lingui/core | 6.12.0 | MIT | Copyright (c) 2017-2022 Tomáš Ehrlich, (c) 2022-2023 Crowdin. | — |
| @lingui/react | 6.12.0 | MIT | Same as @lingui/core | — |
| @tanstack/history | 1.162.5 | MIT | Copyright (c) 2021-present Tanner Linsley | — |
| @tanstack/react-router | 1.170.46 | MIT | Copyright (c) 2021-present Tanner Linsley | — |
| @tanstack/react-store | 0.11.2 | MIT | Copyright (c) 2021 Tanner Linsley | — |
| @tanstack/router-core | 1.171.39 | MIT | Copyright (c) 2021-present Tanner Linsley | — |
| @tanstack/store | 0.11.2 | MIT | Copyright (c) 2021 Tanner Linsley | — |
| class-variance-authority | 0.7.1 | Apache-2.0 | Copyright 2022 Joe Bell; plus three Apache licence-text lines (L-1) | none in the package |
| clsx | 2.1.1 | MIT | Copyright (c) Luke Edwards | — |
| dexie | 4.4.7 | Apache-2.0 | Only Apache licence-text lines and the template line "Copyright {yyyy} {name of copyright owner}" (L-1); the real notice is in its NOTICE | **Yes**: "Dexie.js / Copyright (c) 2014-2017 David Fahlander" with the Apache-2.0 header |
| echarts | 6.1.0 | Apache-2.0 | Only Apache licence-text lines and the template line "Copyright [yyyy] [name of copyright owner]" (L-1); the real notice is in its NOTICE | **Yes**: "Apache ECharts / Copyright 2017-2026 The Apache Software Foundation / This product includes software developed at The Apache Software Foundation (https://www.apache.org/)." |
| fflate | 0.8.3 | MIT | Copyright (c) 2026 Arjun Barrett | — |
| lucide-react | 1.78.0 | ISC | Copyright (c) 2026 Lucide Icons and Contributors; Copyright (c) 2013-present Cole Bemis; plus a licence-text line (L-1) | — |
| react | 19.3.1 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | — |
| react-dom | 19.3.1 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | — |
| scheduler | 0.28.0 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | — |
| tailwind-merge | 3.7.0 | MIT | Copyright (c) 2021 Dany Castillo | — |
| temporal-polyfill | 1.0.8 | MIT | Copyright (c) 2026 Adam Shaw | — |
| temporal-utils | 1.0.4 | MIT | Copyright (c) 2026 Adam Shaw | — |
| tslib | 2.3.0 | 0BSD | Copyright (c) Microsoft Corporation. | — |
| use-sync-external-store | 1.7.0 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | — |
| workbox-core | 7.4.1 | MIT | Copyright 2018 Google LLC | — |
| workbox-precaching | 7.4.1 | MIT | Copyright 2018 Google LLC | — |
| workbox-routing | 7.4.1 | MIT | Copyright 2018 Google LLC | — |
| workbox-strategies | 7.4.1 | MIT | Copyright 2018 Google LLC | — |
| zod | 4.6.7 | MIT | Copyright (c) 2025 Colin McDonnell | — |
| zrender | 6.1.0 | BSD-3-Clause | Copyright (c) 2017, Baidu Inc. | — |
| zustand | 5.1.0 | MIT | Copyright (c) 2019 Paul Henschel | — |

Every entry also shows its full licence text behind "Licence text".

Packages that Appendix B of the technical concept lists as runtime choices but that do **not** ship today (they are not in the bundle, so the gate does not list them): react-hook-form, @hookform/resolvers, canvas-confetti, @dnd-kit/core. If one of them is used later, the gate picks it up automatically.

### 2.2 NOTICE obligations

Apache-2.0 asks a distributor to pass on the attribution notices of a package's NOTICE file (its section 4(d)). Two shipped packages have one:

- **echarts 6.1.0** (with its dependencies zrender, BSD-3-Clause, and tslib, 0BSD): the NOTICE is shown in full on the attributions screen; the E2E test compares it byte for byte with the package's file.
- **dexie 4.4.7**: the NOTICE is shown in full on the attributions screen.

class-variance-authority (Apache-2.0) has no NOTICE file. MIT, ISC, BSD and 0BSD ask for the copyright notice and the licence text, which the screen shows (with finding L-1).

### 2.3 POWR's own work (6 distributed assets, `LicenseRef-Own-Work`)

| Asset | Version | What it is | Approval |
|---|---|---|---|
| powr-app-icons | 0.0.0 | App icons and favicon generated by `tools/icons` ("original placeholder artwork") | Product owner, 2026-11-24 |
| powr-body-map-artwork | 0.1.0 | The body-map figure, front and back, with the muscle regions (`tools/body-map/art/body-map.svg`), drawn for POWR | Product owner, 2026-11-25 (spike S-5) |
| powr-content-exercises | 0.3.0 | The exercise library: names, execution cues, muscle mappings and defaults (190 exercises) | Product owner, 2026-11-24 |
| powr-content-muscle-taxonomy | 0.3.0 | Muscle taxonomy, body-map region IDs and display names | Product owner, 2026-11-24 |
| powr-content-equipment | 0.3.0 | Equipment catalog and gym presets | Product owner, 2026-11-24 |
| powr-content-templates | 0.3.0 | Program templates | Product owner, 2026-11-24 |

The content build (`tools/content-build`) writes the four content entries, with the approval text, whenever the content version changes.

There are no fonts (system font stack, OQ-T7), no sound files (the alert cues are synthesised with Web Audio) and no exercise images or animations (PRD OQ-08) in the MVP.

### 2.4 Build-only components (841)

| Licence | Count | Notes |
|---|---|---|
| MIT | 698 | |
| ISC | 45 | |
| Apache-2.0 | 44 | |
| BSD-3-Clause | 17 | |
| BSD-2-Clause | 13 | |
| BlueOak-1.0.0 | 11 | glob, minimatch, lru-cache and their family |
| MPL-2.0 | 5 | Allowed as build-only (`devOnlyAllowed`): axe-core 4.14.0 and 4.14.1 and @axe-core/playwright (accessibility tests), lightningcss and lightningcss-linux-x64-gnu (the CSS minifier of Vite and Tailwind at build time) |
| (MIT OR CC0-1.0) | 3 | type-fest; MIT chosen |
| CC-BY-4.0 | 1 | caniuse-lite (browser-support data used by build tools) |
| CC-BY-3.0 | 1 | spdx-exceptions 2.5.0, the one approved exception (product owner, 2026-11-24): an SPDX data list read by the licence tool itself |
| CC0-1.0 | 1 | spdx-license-ids |
| Unlicense | 1 | isbot |
| 0BSD | 1 | tslib 2.9.1 |

## 3. What stays on the server (not distributed)

Coolify (Apache-2.0), Traefik (MIT), nginx (BSD-2-Clause) and the Alpine packages of the `nginx:1.30-alpine` image run on the publisher's server and are not distributed to users (technical concept Appendix B). See finding L-2.

## 4. Denied and excluded packages

- **No Sentry anywhere** (product-owner decision 2026-11-24). `deniedPackages` refuses `sentry`, `sentry-*`, `@sentry/*` and `@sentry-internal/*`, shipped or build-only, whatever their licence, and no exception can override it. Lighthouse CI (build-only) would pull in `@sentry/node` and through it the `sentry` CLI (FSL-1.1-Apache-2.0, source-available); a pnpm override in `pnpm-workspace.yaml` (`'lighthouse>@sentry/node': '-'`) keeps it out of the install. Lighthouse loads it only with `--enable-error-reporting`, which POWR's runner (`apps/web/scripts/lighthouse.ts`) does not pass.
- **argparse excluded** (product-owner decision 2026-11-24). `js-yaml` 5 (through `@lhci/utils`) depends on `argparse` 3.0.4 (PSF-2.0, not on the allowlist), used only by js-yaml's own command-line program. The override `'js-yaml@5>argparse': '-'` removes it; the product owner chose this over adding PSF-2.0 to the allowlist.
- Neither exclusion needed an exception or an allowlist change.

## 5. Approvals already recorded

| Decision | Scope | Approval |
|---|---|---|
| `LicenseRef-Own-Work` on the allowlist for the publisher's own assets | Distributed | Product owner, 2026-11-24 |
| Exception for spdx-exceptions 2.5.0 (CC-BY-3.0) | Build-only | Product owner, 2026-11-24 |
| Body-map artwork as own work | Distributed | Product owner, 2026-11-25 |
| The four content entries as own work | Distributed | Product owner, 2026-11-24 |
| No Sentry package; argparse excluded rather than PSF-2.0 allowed | Build-only | Product owner, 2026-11-24 |

## 6. Findings

| ID | Finding | Effect | Proposed handling |
|---|---|---|---|
| **L-1** | The copyright extraction (`tools/licence/src/packages.ts`) keeps every licence-text line that starts with "Copyright" or "(c)". For the three Apache-2.0 packages it shows three lines of the Apache licence text, and for dexie and echarts the licence template line ("Copyright {yyyy} {name of copyright owner}", "Copyright [yyyy] [name of copyright owner]"). For @floating-ui/utils and lucide-react it adds one line of the MIT or ISC licence text | The attributions screen shows wrong "copyright" lines for 5 of 31 packages. The real notices of dexie and echarts are on the screen in their NOTICE texts, and every full licence text is there | An agent fixes the extraction (skip licence boilerplate and template lines; take the notice from the NOTICE file where the licence file has none); the E2E check stays. Release checklist row EC-17 |
| **L-2** | The technical concept (Appendix B) says the server-side components are recorded in `licence-inventory.json` as `distributed: false`. They are not: the inventory covers the npm workspace and `assets-inventory.yaml` only | No effect on users (nothing is distributed); the inventory is less complete than the concept says | Either add them to `assets-inventory.yaml` as `distributed: false` entries, or amend the concept's sentence. Product-owner choice |
| **L-3** | LEG-06 says the attributions screen also credits data sources, "for example the scoring-coefficient sources". The scoring sources and every other study are cited in full in "How POWR decides" and the "Why?" sheets (generated from the rules registry's source list), not on the attributions screen | Depends on whether a citation counts as the credit LEG-06 asks for | The reviewer confirms that the citations suffice, or an agent adds a "Data sources" section to the attributions screen |
| **L-4** | `Python-2.0` is on the allowlist, but no component uses it. argparse (PSF-2.0) was excluded rather than allowed | None today | The reviewer confirms whether to keep it on the allowlist |

## 7. What the human reviewer should confirm

- [ ] The 31 shipped packages and their licences (section 2.1) are right, and none needs more than the screen shows (licence text, copyright, NOTICE).
- [ ] The two NOTICE texts (ECharts, Dexie) are shown in full and unchanged.
- [ ] Finding L-1 is fixed, or accepted with a note, before release.
- [ ] The six own-work assets are the publisher's own work, as approved (section 2.3); nothing in them was copied from another app, site or dataset (PRD §8.4: "Write original text").
- [ ] Exercise names that carry a person's name (Arnold press, Spoto press, Larsen press; "Bayesian curl" as a search synonym) are the common names of the movements and are used descriptively (also question Q-24 of the [legal review packet](legal-review-packet.md)).
- [ ] The build-only MPL-2.0 tools (axe-core, lightningcss) never reach the shipped files (the gate checks it on every build).
- [ ] The Sentry block list and the two pnpm overrides stay as decided (section 4).
- [ ] Findings L-2, L-3 and L-4 have a decision.
- [ ] No percentile dataset, OpenPowerlifting data or exercise media ships in the MVP (V-03 is due only in v1.1; PRD §8.4).

**Record the review:** add the date and the reviewer to this document (section 8), mark V-04 done for this release in the [release checklist](checklist.md) (row EC-16), and keep the release's `licence-inventory.json` with the release artifacts.

## 8. Review record

| Date | Reviewer | Build (version and commit) | Result | Notes |
|---|---|---|---|---|
| | | | | |
