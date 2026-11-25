# Device tests: index

POWR is tested automatically in emulated Chromium (unit, component and E2E tests, technical concept §8.20). What only a real phone can show is checked by hand with the protocols in this folder, on the **Samsung Galaxy S22** in **Chrome** and **Samsung Internet**, and in part on **one other Android phone with Chrome** (PRD NFR-COMP-04). Each protocol has a results template; a completed run is written up as a dated record file in this folder and committed together with any machine records.

These runs are the "pending device test" rows of the [release checklist](../release/checklist.md).

## 1. The protocols

| Protocol | File | Validates | Results file | Status (2026-11-25) |
|---|---|---|---|---|
| **S-1** Timer alerts with the screen locked or the app in the background (mandatory) | [S-1-protocol.md](S-1-protocol.md) | PRD V-01, TMR-04…06, PWA-06…08, PWA-13, SET-04; the Labs audio keep-alive go/no-go (OQ-T3) | `<date>-s22.md`, plus the harness exports in `tools/capability-matrix/records/` | Not run (TD-38) |
| **S-2** Samsung Internet and Android capabilities | [S-2-protocol.md](S-2-protocol.md) | PRD V-07, PWA-01, -02, -05…07, -09, -12…14, DAT-03…05, CAL-05 | `<date>-s22-s2.md`, plus the capability-probe reports | Not run |
| **S-6** `.ics` import into Samsung Calendar and Google Calendar | [S-6-protocol.md](S-6-protocol.md) | PRD V-02, CAL-01…05, P-04, P-05 | `<date>-s22-ics.md`, plus the exported files and screenshots | Not run |
| **TalkBack** audit, screen by screen | [TalkBack-protocol.md](TalkBack-protocol.md) | NFR-A11Y-06, NFR-A11Y-11, M12, QS-10; TD-41, TD-50 | `<date>-s22-talkback.md` | Not run |
| **Performance** with the reference dataset | [S22-performance-protocol.md](S22-performance-protocol.md) | M10, NFR-PERF-01…09, QS-02, QS-09, QS-13, QS-16; TD-50, TD-16 | `<date>-s22-perf.md`, plus traces and recordings | Not run; the reference dataset loads from `/debug/perf` in a beta build (M6a) |
| **S-8** Update gate on a real deploy | Section 3 below | PWA-04, DAT-14, QS-04 | `<date>-s22-s8.md` | Not run; needs the beta server (S-7) |
| **Offline checklist** | Section 4 below | M9, PWA-03, QS-14 | `<date>-s22-offline.md` | Not run |

For the other Android phone, replace `s22` in the file names with a short name of that phone.

## 2. Order of the runs

Use **one build** for S-1 and S-2: the capability matrix is keyed by browser version, and a changed build in between makes the records hard to compare. Note the build (Settings → About) in every record.

**Before the first run**

1. Serve the release candidate with the production headers: the beta server once S-7 is done, otherwise the Docker image over USB (`pnpm build && pnpm docker:build && pnpm docker:run`, then `adb reverse tcp:8080 tcp:8080`; `IMPLEMENTATION_NOTES.md` section 1, "Testing on the Galaxy S22").
2. Charge the phone; write down One UI, Android, Chrome and Samsung Internet versions.
3. For the performance run, use a beta build: the reference dataset loads from its debug page `/debug/perf`, which production builds do not have (performance protocol §3.1).

**Order on the S22**

| Step | Protocol | Why in this order |
|---|---|---|
| 1 | **S-1** | Mandatory (V-01) and the longest (about a day for both browsers, battery measurements included). Start with a full battery |
| 2 | **S-2**, same build | Shares the set-up with S-1; its results decide the Device support texts, TD-66 and TD-15 |
| 3 | **Offline checklist** (section 4) | Short; uses the app as S-2 left it |
| 4 | **S-6** | Needs a small test plan, not the reference dataset. Its DST cell (11) can only run when a time change is within the export range; repeat that cell later if needed |
| 5 | **TalkBack** | Starts from fresh site data (the first-run screen) and logs a few workouts on the way, which the chart and body-map checks then use |
| 6 | **Performance** | Last, because the reference dataset adds five years of history to that browser's copy of the app (and restoring its backup file replaces the data) |
| 7 | **S-8** | Whenever the beta server exists and a second deploy is due; it needs two versions on one origin |

**On the other Android phone (Chrome only):** S-1 cells 1–3 (locked and switched, variant D, battery saver off and on), the S-2 cells and summary table, and the offline checklist. That covers NFR-COMP-04 (release checklist row EC-12).

## 3. S-8: update gate on a real deploy

The E2E test `apps/web/e2e/update-gate.spec.ts` covers the flow in Chromium; this run checks it on the phone with a real deploy (technical concept §6.3, Appendix A.3).

**Needs:** the beta server (S-7) with automatic deploys from `main`, and a change to deploy (any commit that changes the build).

| # | Step | Expected (as built) | Chrome PWA | Samsung Internet PWA |
|---|---|---|---|---|
| 1 | Install the app from the beta URL; note the version in Settings → About | Installed; "Ready for offline use" | | |
| 2 | Start a workout and confirm one set | Workout running | | |
| 3 | Deploy a new version (merge to `main`, wait for the beta deploy) | — | | |
| 4 | Keep using the workout; reopen the app from recent apps; confirm more sets | The workout continues on the old version; no reload; an update notice may show, but "Update" stays disabled during the workout | | |
| 5 | Kill the app (recent apps → swipe away) and start it again from the icon, still during the workout | The old version starts; the workout resumes at the next set | | |
| 6 | Finish the workout | The update is offered | | |
| 7 | Accept the update | The app reloads into the new version (Settings → About); all data is there | | |
| 8 | Deploy once more; go to the start screen without starting a workout | "Update before you start?" is offered | | |
| 9 | With an update waiting, look at Home's start card | "Update before you start?" with "Update first" and "Start without updating" in place of the one-tap "Start today's session"; "Start without updating" starts today's session, and the start screen does not ask again on this page (TD-64, M6a) | | |
| 10 | Open the app in a browser tab and as the installed app at once, update one of them | The other shows "POWR was updated in another window. Reload." | | |
| 11 | Deploy once more; close the app; long-press the icon and use the shortcut "Start today's workout" | The start screen offers "Update before you start?" instead of starting at once; "Start without updating" starts today's session (TD-64, M6a). If the waiting update is only found after the start, the workout starts at once and the update waits for its end (QS-04) | | |

**Pass:** in both browsers, no update ever applies during a workout (QS-04), and no data is lost. A failure is a release blocker; the version-pinning fallback of technical concept §6.3 is the documented way out.

Record the table, the two version numbers and any screenshots as `docs/device-tests/<date>-s22-s8.md`.

## 4. Offline checklist (M9)

PRD M9 and PWA-03: after the first successful load, every feature works in airplane mode. Run it in both browsers as the installed app.

**Set-up:** open the app online once and wait for "Ready for offline use"; switch on **airplane mode**; force-stop the browser; start POWR from the home-screen icon. For item 1, start from "Delete all data" (Settings → Data and backups), which keeps the app files, so the first run works offline.

| # | Feature | Check | Chrome | Samsung Internet |
|---|---|---|---|---|
| 1 | Onboarding | Finish the first run to a plan | | |
| 2 | Plan generation and editing | Generate, change a day, edit the plan | | |
| 3 | Logging | Start today's session; log and confirm sets; finish with the summary | | |
| 4 | Timers | Rest timer starts by itself and alerts while the app is visible | | |
| 5 | Analytics | Progress: trend, volume, PRs, calendar | | |
| 6 | Body map | Map, heat-map mode, a muscle's ranked list | | |
| 7 | Library | Search, filters, exercise detail, a custom exercise | | |
| 8 | Body weight | Log an entry; the trend chart | | |
| 9 | Backup | Export a backup to Downloads | | |
| 10 | Restore | Restore the backup from item 9 | | |
| 11 | Calendar export | Plan → Add to calendar → download the file | | |
| 12 | Settings and legal | Settings, the legal screens, How POWR decides, the attributions | | |
| 13 | Device support | Opens; "Works offline: Works here" | | |
| 14 | Shortcuts | "Start today's workout" and "Log bodyweight" from the icon (S-2 cell 4) | | |

**Pass:** all 14 items work without an error message and without waiting for the network. Record it as `docs/device-tests/<date>-s22-offline.md` with the build and browser versions.

## 5. How results feed back

| Result | What changes | Where |
|---|---|---|
| S-1 records | `pnpm capability-matrix` compiles `apps/web/src/infrastructure/alerts/capability-matrix.json`, so Settings → Alerts shows the measured status; the Labs keep-alive gets a go or no-go | ADR-0019; technical concept §8.8.5, TD-38; PRD V-01 done |
| S-2 record | The Device support texts (by hand, or through an S-2 matrix: the product owner decides after S-2, TD-66); the Samsung Internet install steps; `.ics` sharing; the save picker (TD-15); any Back-gesture failure is a release blocker | Technical concept §8.23, §11.2; PRD V-07 done |
| S-1 and S-2 together | The capability matrix as a release artifact (NFR-COMP-04, PWA-13) | Device support screen; release checklist EC-10…EC-12 |
| S-6 record | The import guide and the re-export note on the export screen; keep or drop `STATUS:CANCELLED` events | Technical concept §6.6, §8.13; PRD V-02 done and P-05 amended in the next docs pass |
| TalkBack record | Defects become agent tasks; TD-41's fix | Release checklist EC-09, T-03 |
| Performance record | Pass or fail per budget; TD-16 and the chart fallback decided | Release checklist EC-07, T-08; technical concept §8.19, TD-50 |
| S-8 record | QS-04 confirmed on the phone, or the version-pinning fallback | Release checklist D-06; technical concept §6.3 |
| Offline record | M9 met | Release checklist EC-06 |

After each run, update the row in the [release checklist](../release/checklist.md) and add a short entry to `IMPLEMENTATION_NOTES.md`; the next docs pass folds the results into the PRD (§11.2 validation tasks, §9.1 platform realities) and the technical concept.
