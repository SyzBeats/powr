# S-1 device test: timer alerts on the Galaxy S22 (protocol and results template)

| Field | Value |
|---|---|
| Spike | S-1 (technical concept §8.8.5, Appendix A.3) |
| Validates | PRD V-01 (mandatory before MVP release), TMR-04, TMR-05, TMR-06, PWA-06…08, PWA-13, SET-04; OQ-T3 = B (variant E go/no-go) |
| Device | Samsung Galaxy S22 (plus one non-Samsung Android phone with Chrome, NFR-COMP-04) |
| Browsers | Chrome stable and Samsung Internet stable, each as **installed PWA** and as a **browser tab** |
| Harness | `/debug/alerts` ("Timer alert harness (S-1)"), built on the production alert scheduler, timer engine and wake-lock policy; export format `harnessVersion` 2 |
| Machine records | `tools/capability-matrix/records/` (harness exports), compiled by `pnpm capability-matrix` into `apps/web/src/infrastructure/alerts/capability-matrix.json` |
| Human results | `docs/device-tests/<date>-s22.md`, one file per test day, copied from the template at the end of this document |
| Version | 1.0, 2026-11-24 (from the M3t protocol in `IMPLEMENTATION_NOTES.md`, "M3t timers and alerts") |

## 1. Purpose

POWR is a pure PWA (OQ-01 = A). With the screen locked or the app in the background, a rest-end alert can come from three paths: a one-shot timeout in the page, a timer in the service worker, and a system notification. Android and the browsers may freeze or kill the page and the service worker, and battery saver may change that. S-1 measures, on the real phone, which path alerts, how late, and how reliably. The results decide:

- what Settings → Alerts says for each browser and mode ("Supported", "Limited (best effort)" or "Not supported"); until S-1 has run, the matrix is empty and every browser shows "Limited (best effort)";
- whether the audio keep-alive (variant E, a Labs experiment) clearly helps; only then may it get an opt-in Labs toggle (OQ-T3 = B, product-owner decision 2026-11-24);
- the final status texts of ADR-0019.

## 2. Variants

The harness chooses which hidden-state paths the production scheduler arms. The pre-alert and the 3-2-1 countdown are off in every run; only the rest-end alert is measured.

| Variant | Page timeout | Service-worker timer | "Resting – ends at" notice on hide | Audio keep-alive | Note |
|---|---|---|---|---|---|
| A | yes | no | no | no | Which path carries the alert |
| B | no | yes | no | no | Which path carries the alert |
| C | yes | yes | no | no | Production design without the notice |
| D | yes | yes | yes | no | **Production default** when notifications are allowed |
| E | yes | yes | no | yes | Labs experiment (OQ-T3 = B); gain adjustable |

The service-worker timer covers only rests that end within 5 minutes; for a longer rest the page arms it 5 minutes before the end, if the page still runs then. Chromium freezes background pages after about 5 minutes, so the 8-minute runs observe freezing and do not count for the status.

## 3. Set-up (once per browser)

1. **Serve the build** on the phone with the production headers. Until the beta server exists (S-7), use USB and `adb reverse` (`IMPLEMENTATION_NOTES.md` section 1, "Testing on the Galaxy S22"):

   ```sh
   pnpm build && pnpm docker:build && pnpm docker:run
   adb reverse tcp:8080 tcp:8080
   ```

   Once S-7 exists, use the beta server instead.
2. On the S22 open `http://localhost:8080/?debug=1` in **Chrome**. Pass the legal gate ("Just let me log") and wait until the app says "Ready for offline use".
3. **Write down the versions:** One UI, Android, Chrome (`chrome://version`), Samsung Internet (Settings → About). Note the device model (for example SM-S901B).
4. **Phone settings:** notifications allowed for the browser, Do Not Disturb off, media volume up, vibration on, battery saver as the cell requires (Settings → Battery → Power saving).
5. Open Settings → Developer tools → **"Timer alert harness (S-1)"**. Enter the **device and browser label** (for example "Galaxy S22 SM-S901B, One UI 7, Android 15, Chrome 142, PWA") and tap **"Allow notifications"**.
6. **Installed PWA runs:** install the app (browser menu → Install app) and start it from the home screen. **Tab runs:** use the browser itself.
7. Repeat everything in **Samsung Internet**.

## 4. Cells, in priority order

Three repetitions per cell. Rest lengths 60 s, 3 min and 5 min unless noted. Run the cells in this order, so that the most important results exist even if the day ends early.

| # | Variant | Condition | Battery saver | Rests | Purpose |
|---|---|---|---|---|---|
| 1 | D | Screen locked (power button) | off | 60 s, 3 min, 5 min | Production default |
| 2 | D | Screen locked | **on** | 60 s, 3 min, 5 min | Battery saver (the worse result counts) |
| 3 | D | App switched (home button) | off | 60 s, 3 min, 5 min | Backgrounded instead of locked |
| 4 | E | Screen locked | off and on | 60 s, 3 min, 5 min | OQ-T3 go/no-go |
| 4b | C and E | Screen locked | off | 12 × 3 min in one 60-minute run each | Battery use of the keep-alive |
| 5 | A and B | Screen locked | off | 60 s, 3 min, 5 min | Which path carries the alert |
| 6 | C and E | Screen locked | off | 8 min | Freezing (observation only, not counted for the status) |
| 7 | D | Screen locked, **notification permission denied** | off | 60 s | Settings → Alerts must say "Not supported" with the reason |

Once per browser, also run the **TMR-04 resume check**: start a 2:30 rest, lock the screen, come back after about 60 s; the timer must show 1:30 ± 1 s at once (within 500 ms).

Once per browser, check that **tapping the "Rest over" notification** focuses the app (a window already at the notification's URL, else `/session`). The E2E suite cannot test this.

## 5. Each run

1. In the harness choose the **condition**, tick **"Battery saver is on"** if it is, choose the **variant** and the **rest length**. Keep **"Hold the screen wake lock while visible"** on.
2. Tap **Start run**, then **at once** lock the screen (power button) or press home, as the condition says.
3. Wait until about **30 s after the planned end**. Note what the harness cannot see (section 7): sound heard, vibration felt, the notification on the lock screen or as a heads-up, and for E how the media notification looks.
4. Unlock or return to the app. The harness records the first path that alerted (`page-timeout`, `sw-timer`, or `on-return` = missed) and its delay, the wake-lock events and the battery level at start and end, and classifies the run: **on-time** (within 2 s of the target), **late**, or **missed**.
5. A row marked **"interrupted"** means the page was killed during the run; **Export results** later fills in what the service worker did.

## 6. Records → matrix

1. After each browser and mode, tap **Export results** (a `.txt` file with JSON, `harnessVersion` 2), then **Clear results**.
2. Copy the files off the phone (Downloads; `adb pull /sdcard/Download/<file> .`) into **`tools/capability-matrix/records/`**, named `<date>-<device>-<browser>-<mode>.txt` (for example `2026-12-03-s22-chrome-pwa.txt`).
3. Run `pnpm capability-matrix`. It compiles the records into `apps/web/src/infrastructure/alerts/capability-matrix.json` and prints the entries per status. `pnpm test` fails while the committed matrix is stale against the records.
4. Fill in the human record from the template below as `docs/device-tests/<date>-s22.md`, with battery numbers, screenshots of the notifications and the E go/no-go.
5. Commit the records, the compiled matrix and the human record together.

A record with `"placeholder": true` compiles into rows that the app ignores; use it only to try the pipeline.

## 7. Status rule (how the matrix decides)

- A matrix cell is keyed by browser family and version range, platform, display mode (installed PWA or tab), condition (locked or switched), battery saver and variant.
- A cell holds for its browser major version and the next 2 majors (about two months); after that the browser falls back to "Limited (best effort)" until a new run.
- Battery saver cannot be detected by the app, so the **worse** of the two battery-saver results counts.
- Variants C and D stand for each other; E counts only for itself.
- **Supported:** the locked D or C cells of both battery-saver states for that browser, version range and mode have ≥ 3 runs each and ≥ 95% of runs on time within 2 s, for rests of at most 5 minutes.
- **Limited (best effort):** some runs alerted, or alerts were late, or there is no matching cell.
- **Not supported:** no run alerted, or notifications are not allowed.

These rules were accepted by the product owner on 2026-11-24.

## 8. What the harness cannot see

The harness records what the page and the service worker did, with timestamps. It cannot know whether a human noticed the alert. Record these by hand for every run:

- whether a **sound** was heard (and roughly how loud);
- whether a **vibration** was felt;
- whether a **notification** showed on the lock screen or as a heads-up, and its text;
- for variant E, how the **media notification** looks and whether it is acceptable;
- anything unexpected (the screen woke up, the browser was killed, a system dialog appeared).

---

## Results template

Copy everything below this line into `docs/device-tests/<date>-s22.md` and fill it in.

```markdown
# S-1 results: <date>, Galaxy S22

## Device and versions

| Field | Value |
|---|---|
| Date | |
| Tester | |
| Device model | Galaxy S22 SM-S901_ |
| One UI / Android | |
| Chrome version (`chrome://version`) | |
| Samsung Internet version | |
| App build (Settings → About) | |
| Served from | `adb reverse` + Docker image / beta server |
| Harness label used | |
| Notification permission | granted / denied |
| Do Not Disturb | off |
| Media volume, vibration | |

## Runs

One table per browser × mode (Chrome PWA, Chrome tab, Samsung Internet PWA, Samsung Internet tab). Path and classification come from the harness export; the "heard / felt / shown" columns are observed by hand.

### <Browser>, <PWA or tab>

| Cell | Variant | Condition | Battery saver | Rest | Run | Sound heard | Vibration felt | Notification shown | First path (harness) | Delay (s) | Class (on-time / late / missed / interrupted) | Battery start → end (%) | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | D | locked | off | 60 s | 1 | | | | | | | | |
| 1 | D | locked | off | 60 s | 2 | | | | | | | | |
| 1 | D | locked | off | 60 s | 3 | | | | | | | | |
| 1 | D | locked | off | 3 min | 1 | | | | | | | | |
| 1 | D | locked | off | 3 min | 2 | | | | | | | | |
| 1 | D | locked | off | 3 min | 3 | | | | | | | | |
| 1 | D | locked | off | 5 min | 1 | | | | | | | | |
| 1 | D | locked | off | 5 min | 2 | | | | | | | | |
| 1 | D | locked | off | 5 min | 3 | | | | | | | | |
| 2 | D | locked | on | … | | | | | | | | | |
| 3 | D | switched | off | … | | | | | | | | | |
| 4 | E | locked | off | … | | | | | | | | | |
| 4 | E | locked | on | … | | | | | | | | | |
| 5 | A | locked | off | … | | | | | | | | | |
| 5 | B | locked | off | … | | | | | | | | | |
| 6 | C | locked | off | 8 min | | | | | | | | | observation only |
| 6 | E | locked | off | 8 min | | | | | | | | | observation only |
| 7 | D | locked (permission denied) | off | 60 s | | | | | | | | | Settings → Alerts text: |

### Summary per browser and mode

| Browser | Mode | Cells 1+2 (locked D, both battery states): runs, on time | Status by the rule (§7) | Status shown in Settings → Alerts after `pnpm capability-matrix` |
|---|---|---|---|---|
| Chrome | PWA | | | |
| Chrome | tab | | | |
| Samsung Internet | PWA | | | |
| Samsung Internet | tab | | | |

## TMR-04 resume check (2:30 rest, back after about 60 s)

| Browser | Mode | Shown on return | Within 500 ms? | Pass (1:30 ± 1 s) |
|---|---|---|---|---|
| Chrome | PWA | | | |
| Chrome | tab | | | |
| Samsung Internet | PWA | | | |
| Samsung Internet | tab | | | |

## Notification tap

| Browser | Mode | App focused? | Opened at | Notes |
|---|---|---|---|---|
| Chrome | PWA | | | |
| Samsung Internet | PWA | | | |

## Battery (cell 4b: 60 minutes, 12 × 3 min rests, screen locked)

| Browser | Variant | Battery start (%) | Battery end (%) | Used (%) | Media notification acceptable? | Notes |
|---|---|---|---|---|---|---|
| Chrome | C | | | | n/a | |
| Chrome | E | | | | | |
| Samsung Internet | C | | | | n/a | |
| Samsung Internet | E | | | | | |

## Variant E go/no-go (OQ-T3 = B)

- Does E meet the "Supported" rule (≥ 3 runs per cell, ≥ 95% on time within 2 s, rests ≤ 5 min, screen locked, both battery-saver states) where C/D does not? yes / no
- Extra battery use of E against C over 60 minutes: … %
- Media notification and lock-screen behaviour acceptable? yes / no
- **Decision proposed to the product owner:** go (opt-in Labs toggle, off by default) / no-go (the flag stays harness-only)

## Wake lock

| Browser | Mode | Battery saver | Held during the run? | Re-acquired on return? | Settings → Alerts "Keep screen on" text |
|---|---|---|---|---|---|
| | | | | | |

## Screenshots

List the files stored next to this record (for example `docs/device-tests/<date>-s22/`):

- [ ] "Resting – ends at …" notification (lock screen), Chrome
- [ ] "Rest over" notification (lock screen and heads-up), Chrome
- [ ] the same in Samsung Internet
- [ ] variant E media notification (both browsers)
- [ ] Settings → Alerts status per browser after the matrix update
- [ ] Settings → Alerts with notification permission denied

## Records committed

- [ ] `tools/capability-matrix/records/<date>-s22-chrome-pwa.txt`
- [ ] `tools/capability-matrix/records/<date>-s22-chrome-tab.txt`
- [ ] `tools/capability-matrix/records/<date>-s22-samsung-pwa.txt`
- [ ] `tools/capability-matrix/records/<date>-s22-samsung-tab.txt`
- [ ] `apps/web/src/infrastructure/alerts/capability-matrix.json` (from `pnpm capability-matrix`)
- [ ] ADR-0019 follow-up: the measured matrix and the final status texts

## Observations and open questions

-
```
