# POWR MVP release checklist

| Field | Value |
|---|---|
| Version | 1.0, 2026-11-25 (M6b, release-readiness documents; M6a's results folded in) |
| Status | Prepared before the release. The results of the agent-side hardening (M6a, `IMPLEMENTATION_NOTES.md` "M6a quality audits") are folded into the rows they affect (EC-01, EC-07, EC-09, G-05, G-07, T-02, T-04, T-05, T-08, T-12). Nothing here is a release decision: the product owner signs off (section 7). |
| Derived from | [PRD v0.8](../PRD.md) §10.3 (MVP exit criteria), §11.2 (validation tasks V-01…V-08), §8 (legal); [technical concept v0.10](../technical-concept.md) Appendix A.3 (spikes S-1…S-8), A.4 (M6 row), §7 (deployment), §10.2 (quality scenarios), §11.2 (technical debt) |
| Companion documents | [Legal review packet](legal-review-packet.md) · [Licence review](licence-review.md) · [Content review](content-review.md) · [Usability test plan](usability-test-plan.md) · [Device tests](../device-tests/README.md) · [Operations runbook](../../deploy/runbook.md) |

## 1. How to use this checklist

- Every row has an ID, the criterion, the evidence that shows it is met (a test, a document or a device-test record), an owner and a status. Update the status and link the evidence as results arrive.
- The MVP is ready to release when every row in sections 2–5 is **Done**, or the product owner has deferred it with a written note in the row.
- Device-test results are written up in `docs/device-tests/` with the templates of the protocols. A row that depends on them links the record file once it exists.

**Owners.** *Agent:* an implementation agent (changes stay uncommitted; the product owner reviews and commits). *Agent (M6a):* done by the M6a work (the agent-side hardening). *PO:* the product owner, Simeon Zimmermann. *Reviewer:* the external legal reviewer the product owner engages.

**Statuses.**

| Status | Meaning |
|---|---|
| Done | The evidence exists and passes today. |
| Pending device test | Needs a run on the Galaxy S22 (and, where stated, one other Android phone) with a protocol in [`docs/device-tests/`](../device-tests/README.md). |
| Pending product owner | Needs a decision, an input (postal address, domain) or an action only the product owner can take (server, GitHub settings, usability tests, legal review, trademark check). |
| Pending agent | Code or documentation work for an implementation agent. |

## 2. MVP exit criteria (PRD §10.3)

| ID | Exit criterion | Evidence | Owner | Status |
|---|---|---|---|---|
| EC-01 | All MVP **Must** requirements pass acceptance | `pnpm verify` (after M6a: 1,051 unit, 126 component and 85 E2E tests, 4 opt-in skipped: the three S-4 measurements and the perf spec); the "PRD coverage" tables in [`IMPLEMENTATION_NOTES.md`](../../IMPLEMENTATION_NOTES.md) (M2b, M3b, M4b, M5d, M5s). Open: the known Must gaps G-01…G-06 (section 3.1; G-07 is done); acceptance that needs the phone is in EC-06, EC-07 and EC-09…EC-13 | Agent; PO signs off | Pending agent |
| EC-02 | **Should** requirements pass, or are deferred with a note | The deferral notes in section 3.2, approved by the product owner | PO | Pending product owner |
| EC-03 | M1: 1 tap (median) to log a working set done as prescribed; ≤ 3 taps to change weight or reps | Built: one-tap "Confirm set" and the control dock (`apps/web/e2e/session.spec.ts`). Measured with users: [usability test](usability-test-plan.md) tasks T4 and T5 | PO | Pending product owner |
| EC-04 | M3: ≥ 90 % complete onboarding; median ≤ 5 min on the core path | [Usability test](usability-test-plan.md) task T2 | PO | Pending product owner |
| EC-05 | M4: ≤ 10 min from install to the first logged workout | [Usability test](usability-test-plan.md) tasks T1–T6 | PO | Pending product owner |
| EC-06 | M9: 100 % of the offline checklist passes in airplane mode on the S22 (Chrome and Samsung Internet) | Automated: `apps/web/e2e/offline.spec.ts` and the offline cases in `backup.spec.ts` and `m5d.spec.ts`. Device: the [offline checklist](../device-tests/README.md#4-offline-checklist-m9), S-2 cell 15, S-6 cell 12 | PO | Pending device test |
| EC-07 | M10: every performance budget (NFR-PERF) met on the S22 | [S22 performance protocol](../device-tests/S22-performance-protocol.md). Ready since M6a: the reference dataset (`@powr/application/reference`, loaded on the phone by `/debug/perf` in a beta build; `tools/dataset` was not built) and the `powr-home-interactive` mark (with `powr-set-commit` and `powr-insights-warmup`). Desktop signal: `POWR_PERF=1 pnpm e2e perf` (`apps/web/e2e/perf.spec.ts`, opt-in) on Chromium with 4× CPU throttling, median / p75 in ms: first contentful paint 324 / 388, Home interactive 648 / 726, set confirm to the next frame 6 / 8 and to the durable commit 114 / 115, the Progress hub's data 619 / 633, an exercise with its chart 711 / 730, backup export 5,315 (technical concept §8.19). Lighthouse CI as a guard. Open: the S22 numbers | PO | Pending device test |
| EC-08 | M11: 100 % of the reference vectors pass (scoring, e1RM, warm-up, trend, plate math) | `packages/domain/test/reference/` in `pnpm test` (technical concept §8.20) | Agent | Done |
| EC-09 | M12: no open WCAG 2.2 AA failure in the automated and the manual audit | Automated, done: axe (WCAG 2.2 A/AA) in light and dark in the component and E2E tests, and since M6a the every-route sweep `apps/web/e2e/a11y.spec.ts` in `pnpm verify`: every route with realistic data, in both themes, axe (WCAG 2.0/2.1/2.2 A and AA) with no serious or critical violation, a name on every control from Chromium's accessibility tree, WCAG 2.5.8 target sizes (the dock at 48 px and 8 px apart), a unique page title per route, reflow at 320 px with 200 % text; its three findings are fixed (technical concept §8.14). Manual, pending: the [TalkBack protocol](../device-tests/TalkBack-protocol.md) with real 200 % system font size | PO | Pending device test |
| EC-10 | Device test protocol for TMR-06 completed on the S22 in Chrome and Samsung Internet (V-01, mandatory) | [S-1 protocol](../device-tests/S-1-protocol.md) → records in `tools/capability-matrix/records/`, `capability-matrix.json`, `docs/device-tests/<date>-s22.md` (TD-38) | PO | Pending device test |
| EC-11 | Device test protocol for PWA-13 completed on the S22 in Chrome and Samsung Internet (V-07) | [S-2 protocol](../device-tests/S-2-protocol.md) → `docs/device-tests/<date>-s22-s2.md` | PO | Pending device test |
| EC-12 | The same protocols on one other Android phone with Chrome (NFR-COMP-04) | S-1 cells 1–3 and the S-2 summary table on that phone ([device tests README](../device-tests/README.md#2-order-of-the-runs)) | PO | Pending device test |
| EC-13 | `.ics` import verified in Samsung Calendar and Google Calendar (V-02) | [S-6 protocol](../device-tests/S-6-protocol.md) → `docs/device-tests/<date>-s22-ics.md` | PO | Pending device test |
| EC-14 | Legal texts (§8) reviewed (V-06) | [Legal review packet](legal-review-packet.md); afterwards the review date in `legalReview` (`apps/web/src/features/legal/publisher.ts`) | PO, Reviewer | Pending product owner |
| EC-15 | Trademark check of the product name done (V-05) | [Legal review packet](legal-review-packet.md#7-trademark-check-of-the-product-name-v-05) §7 | PO | Pending product owner |
| EC-16 | Licence inventory complete, with no unapproved or copyleft licence (LEG-08, V-04) | `pnpm licence` passes: 37 distributed components (31 npm packages, 6 own-work assets), 841 build-only, every verdict "allowed"; the human review in [licence review](licence-review.md) | PO | Pending product owner |
| EC-17 | Attributions screen complete (LEG-06) | `/legal/attributions` from the build's `attributions.json`; `apps/web/e2e/settings-legal.spec.ts` checks that the screen lists exactly the distributed inventory entries and the ECharts NOTICE byte for byte. Open: finding L-1 of the [licence review](licence-review.md#6-findings) (copyright lines taken from licence boilerplate) | Agent | Pending agent |
| EC-18 | Backup round-trip and migration tests are green | `packages/formats/test/` (round-trip properties, the v1 fixture, hostile files), `apps/web/src/infrastructure/db/upgrade-guard.test.ts` (failing migration, rollback, rescue copy), `apps/web/e2e/backup.spec.ts` and `m5d.spec.ts` (the failing data update) in `pnpm verify` | Agent | Done |

## 3. Known gaps against EC-01 and EC-02

### 3.1 Must requirements not yet met

| ID | Requirement | What is missing | Evidence when done | Owner | Status |
|---|---|---|---|---|---|
| G-01 | PWA-12 (Must): "asks before discarding unsaved edits" | No prompt on Back in the plan and equipment editors (TD-68) | A blocker prompt and its E2E test | Agent | Pending agent |
| G-02 | NFR-MNT-07, SET-09 (Must): in-app changelog and versioned release notes | `tools/release-notes` and `changelog.json` do not exist; the update notice has no release notes (TD-20) | The generator, `docs/release-notes/<version>.md`, the About entry | Agent | Pending agent |
| G-03 | LEG-09 (Must): the website that serves the app identifies the publisher | The legal texts exist only in the app; no static website copy (`legal/*`, TD-71) | Static HTML rendered from the same texts at build time | Agent | Pending agent |
| G-04 | DAT-05, DAT-07 (Must): the backup format is documented with a schema description | `docs/formats/backup-format.md` and the generated JSON Schemas are not written; no hostile-file fixture (TD-22) | The format document and the fixture | Agent | Pending agent |
| G-05 | NFR-SEC-01 (Must): dependencies audited for known vulnerabilities before each release | No `pnpm audit --prod` step in CI or in the release routine (technical concept §8.18); M6a did not add one | An audit report for the release commit | Agent | Pending agent |
| G-06 | NFR-REL-01, QS-01 (Must): no confirmed set lost on a process kill | A reload and an abrupt close are tested; the 200 randomized process kills (`SIGKILL`) are not (TD-13) | The kill test | Agent | Pending agent |
| G-07 | LEG-07 (Must) and MOT-10: copy review against the wellness-scope rule and the tone rules | Nothing for the review itself. The website copy of the legal texts (G-03) will be rendered from the same reviewed texts; the substance of the legal texts is the legal review's (EC-14). The product owner's open copy decisions: "workout" or "session" where not yet applied, "novice" or "beginner", "this device" in the legal texts, straight quotes, "Welcome back!" | Done 2026-11-25 by M6a (`IMPLEMENTATION_NOTES.md` "M6a quality audits", "Copy and tone review"): every English message read (the app, "Why?", legal and parameter catalogs, the notification and timer-alert texts, the manifest, `index.html`); nothing found that shames, diagnoses, predicts injury, promises results or nags about missed sessions; 152 messages changed for consistency, grammar and a few absolute claims; British spelling with -ise and full forms instead of contractions; a glossary of one term per concept; the legal texts changed in spelling and terms only, so `versions.ts` is unchanged | Agent (M6a); PO decides the open copy questions | Done |

### 3.2 Should requirements deferred (each needs the product owner's note)

| ID | Requirement | What is missing | Proposed note | Owner | Status |
|---|---|---|---|---|---|
| S-01 | LEG-04 (Should): pre-participation self-screening | Not built; the questionnaire wording and its licence must be checked first (TD-72) | Deferred until after the legal review (see the [legal review packet](legal-review-packet.md), question Q-17) | PO | Pending product owner |
| S-02 | PWA-09 (Should): sharing summaries and PR cards as images | Built: `.ics` sharing where the browser allows it. Not built: image sharing, which needs MOT-09 (v1.2) (TD-69) | Image sharing ships with MOT-09 in v1.2 | PO | Pending product owner |
| S-03 | PWA-02 (Should): illustrated install instructions for Samsung Internet | Steps in words, hedged; the real menu path is measured in S-2 cell 1 | Keep words; update them from the S-2 record | PO | Pending device test |
| S-04 | PWA-05 (Should): app shortcuts | Two shortcuts built; "Quick timer" and "Last workout summary" wait for their features | None needed: PRD v0.8 says the MVP ships two | PO | Done |

## 4. Deploy and launch steps

Do them in this order. The runbook ([`deploy/runbook.md`](../../deploy/runbook.md)) has the commands.

| ID | Step | Evidence | Owner | Status |
|---|---|---|---|---|
| D-01 | **S-7: set up Hetzner and Coolify** as in runbook §3: VPS in Nuremberg with the Hetzner Cloud Firewall, SSH keys only, unattended upgrades, Docker log rotation, Coolify with 2FA and telemetry off, DNS for `beta.` and `coolify.` with a CAA record, the GHCR read-only token, the beta application; fill in `<business-domain>`; create the GitHub environments and secrets (runbook §2) | Runbook §8 open items ticked; the beta URL serves the app | PO | Pending product owner |
| D-02 | **Check the reverse proxy's access logging against the privacy notice.** The privacy notice says "We do not keep access logs." nginx in the image has `access_log off` (`deploy/nginx.conf`; the CI image test, technical concept §7.4). On the server, inspect the Traefik configuration Coolify generates: no `accesslog` section. Also confirm Docker log rotation and that Coolify keeps no request logs of the app (technical concept §7.4) | A dated note in runbook §8 ("Verified: Traefik access log off …"); if any log exists, the privacy notice changes before the review ends | PO | Pending product owner |
| D-03 | Confirm the data-processing agreement with Hetzner (technical concept §7.2) | The agreement on file; named in the [legal review packet](legal-review-packet.md#4-data-flows) | PO | Pending product owner |
| D-04 | Choose and set up the uptime monitor (OQ-T9: hosted free tier, preferably EU-based) for `version.json` and certificate expiry | Runbook §8 | PO | Pending product owner |
| D-05 | Restore drill once before launch (runbook §6, QS-22: rebuild within 2 hours) | A dated note in runbook §8 | PO | Pending product owner |
| D-06 | **S-8: the update gate on a real deploy.** On the beta server, install the app in Chrome and Samsung Internet, start a workout, deploy a new version; the workout continues on the old version, "Update before you start?" and the update banner behave as built (technical concept §6.3, QS-04) | A short record in `docs/device-tests/<date>-s22-s8.md` (see the [device tests README](../device-tests/README.md#3-s-8-update-gate-on-a-real-deploy)) | PO | Pending device test |
| D-07 | **Commit the Lighthouse `ci` baseline** from the first `main` run (TD-12): download the `lighthouse` artifact, copy the `ci` entry of `baseline-candidate.json` into `apps/web/lighthouse-baseline.json`. Until then the CI job only reports | The committed baseline; the next `main` run compares against it | PO | Pending product owner |
| D-08 | Choose the production domain after the trademark check (V-05, OQ-T1), then **set the `PUBLIC_ORIGIN` repository variable** (GitHub → Settings → Secrets and variables → Actions → Variables) to the production origin. Set it once and never change it: calendar UIDs depend on it (runbook §2) | The variable is set; a CI build's `.ics` export shows UIDs `@<production host>` instead of `@powr.invalid` | PO | Pending product owner |
| D-09 | **Fill `postalAddress` and `legalReview`** in `apps/web/src/features/legal/publisher.ts` once the legal review is done; bump `versions.ts` if the review changed the wording (users acknowledge again); run `pnpm release:check` | `pnpm release:check` exits 0; the "Draft" marker is gone from the legal screens | PO | Pending product owner |
| D-10 | Production DNS, the Coolify `production` application and the `production` GitHub environment with required reviewers (runbook §1, §2) | The production URL answers `version.json` | PO | Pending product owner |
| D-11 | Decide whether beta testers need the "POWR has moved" banner and guided backup → restore (technical concept §7.8, risk T-01). It is not built; it matters only if testers keep real data on beta | A decision; if yes, a task for an agent | PO | Pending product owner |
| D-12 | **First production release:** CI green on the release commit; bump `apps/web/package.json`; release notes (G-02); tag `vX.Y.Z` on a commit already on beta; approve the `production` environment (the job runs `pnpm release:check` first); smoke test (runbook §4) | The tag, the deploy run, the smoke-test output | PO | Pending product owner |

## 5. Technical-concept items due before the release

| ID | Item | Evidence | Owner | Status |
|---|---|---|---|---|
| T-01 | TD-25: 38 of 143 registry parameters ship `verified: false` ("preliminary value"); the concept plans verification passes before release (Pelland 2026 and Remmert for E-2, Russo 2025 for the RIR bias, the primary Wilks, DOTS and GL documents, an RTS original, the APRE source tables) | A verification note per source; registry diff (`pnpm --filter @powr/rules build -- --diff`) | Agent; PO approves value changes | Pending agent |
| T-02 | TD-50: the M4 and M5 device checks (chart timings with the reference dataset, TalkBack with the SVG body map and the chart point slider, the metronome's timing, the calendar export for long ranges, the Samsung Internet install steps, the import guide) | The [performance](../device-tests/S22-performance-protocol.md) and [TalkBack](../device-tests/TalkBack-protocol.md) protocols, S-2, S-6. Since M6a the dataset loads on the phone from `/debug/perf`, and the TalkBack protocol carries M6a's items for the manual pass | PO | Pending device test |
| T-03 | TD-41: `CheckRow` puts its description into the accessible name, so TalkBack reads long names (Settings → Alerts) | TalkBack protocol item 16.6, then the `aria-describedby` fix | PO, then Agent | Pending device test |
| T-04 | TD-64: Home's one-tap start and the shortcut skipped "Update before you start?" | Done by M6a: with an update waiting, Home's start card offers "Update first" and "Start without updating", and the shortcut's start waits for the choice on the start screen (`apps/web/test/m6a.test.tsx`; technical concept §6.3, TD-64 closed). On the phone: [S-8](../device-tests/README.md#3-s-8-update-gate-on-a-real-deploy) steps 9 and 11, TalkBack item 21.4 | Agent (M6a) | Done |
| T-05 | TD-67: safety copies were pruned only by the rotation of two | Done by M6a: the latest two copies and every copy younger than 30 days are kept; older ones are pruned after each new copy and when Data and backups lists them, and the screen says so (`packages/application/test/m6a.test.ts`, `apps/web/src/infrastructure/db/safety-db.test.ts`; technical concept §8.2.1, TD-67 closed). Open for the product owner: accept several full copies after several restores in a month, or cap the number (for example at five) | Agent (M6a) | Done |
| T-06 | TD-66: compile S-2's results into a matrix like S-1's, or keep hand-edited Device support texts. Waits for the S-2 results | The decision after S-2, then the matrix or the edited texts | PO, then Agent | Pending device test |
| T-07 | TD-15: backups by the save picker instead of a download, if S-2 cell 12 shows it works | The S-2 record, then the change or "no change" | PO, then Agent | Pending device test |
| T-08 | TD-16: the backup codec runs on the main thread; the concept revisits it before the reference-dataset test of NFR-PERF-08 (≤ 10 s each way) | The export and import timings of the [performance protocol](../device-tests/S22-performance-protocol.md#46-backup-export-and-import) decide whether the codec moves into a worker (desktop, M6a: export 5.3 s at 4× CPU) | PO, then Agent | Pending device test |
| T-09 | TD-18: remove the `minimumReleaseAgeExclude` list from `pnpm-workspace.yaml` after 2026-12-01 | The list removed; `pnpm install --frozen-lockfile` still works | Agent | Pending agent |
| T-10 | Technical concept §8.18 promises two trust measures for a closed-source app (risk R-17): an in-app "Verify it yourself" help page and SHA-256 checksums of the deployed files in the release notes. Neither is built. Not a PRD exit criterion | Built, or deferred by the product owner with a note | PO decides; Agent builds | Pending product owner |
| T-11 | Usability metrics M2 (≤ 3 s from the end of a set to a confirmed log) and M13 (SUS ≥ 75; ≥ 70 % "motivating") from the M6 roadmap row; not PRD exit criteria | [Usability test plan](usability-test-plan.md) | PO | Pending product owner |
| T-12 | TD-73…TD-76: four performance levers M6a measured on the desktop at 4× CPU and left as they are (note: the Progress hub's data at 619 ms, the exercise chart at 711 ms and library search at 125 ms are above their §8.19 targets of 300, 500 and 100 ms, although each screen appears at once): each set confirm reads all weigh-ins twice; the Progress hub reads every e1RM point; the idle warm-up checks every week at each start; "Verify data" makes one request per session | The S22 numbers of the [performance protocol](../device-tests/S22-performance-protocol.md) (row EC-07), then the product owner keeps each or has an agent act on its lever (technical concept §11.2) | PO, then Agent | Pending device test |

## 6. Status counts

Counted over the 53 rows of sections 2–5 on 2026-11-25, after M6a's results were folded in. When a status changes, update this table too.

| Status | Count | Rows |
|---|---|---|
| Done | 6 | EC-08, EC-18, G-07, S-04, T-04, T-05 |
| Pending device test | 15 | EC-06, EC-07, EC-09, EC-10, EC-11, EC-12, EC-13, S-03, D-06, T-02, T-03, T-06, T-07, T-08, T-12 |
| Pending product owner | 22 | EC-02, EC-03, EC-04, EC-05, EC-14, EC-15, EC-16, S-01, S-02, D-01, D-02, D-03, D-04, D-05, D-07, D-08, D-09, D-10, D-11, D-12, T-10, T-11 |
| Pending agent | 10 | EC-01, EC-17, G-01, G-02, G-03, G-04, G-05, G-06, T-01, T-09 |

Of the 18 exit-criterion rows (section 2): 2 done, 7 pending a device test, 7 pending the product owner, 2 pending an agent.

## 7. Sign-off

| Role | Name | Date | Note |
|---|---|---|---|
| Product owner and publisher | Simeon Zimmermann | | |
