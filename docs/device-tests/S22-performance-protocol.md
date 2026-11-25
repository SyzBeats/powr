# Performance on the Galaxy S22 (protocol and results template)

| Field | Value |
|---|---|
| Validates | PRD M10 and NFR-PERF-01…09 (budgets on the Galaxy S22 with the reference dataset); technical concept §8.19, quality scenarios QS-02, QS-09, QS-13, QS-16; the S-4 condition "the S22 run" (§8.10); TD-50 (chart timings); TD-16 (backup codec); TD-73…TD-76 (the performance levers M6a measured and left) |
| Device | Samsung Galaxy S22, plus a desktop computer with Chrome for remote debugging |
| Browsers | Chrome stable and Samsung Internet stable, as **installed PWA** |
| Data | The reference dataset (PRD A-11) from `@powr/application/reference`: about 5 years, 1,297 workouts, 40,207 sets, 1,800 weigh-ins and 5 breaks, loaded on the phone with the debug page `/debug/perf` of a beta build (section 3.1) |
| Human results | `docs/device-tests/<date>-s22-perf.md`, from the template at the end |
| Version | 1.0, 2026-11-25 (M6b), with M6a's reference dataset, `/debug/perf`, marks and desktop perf spec folded in (`IMPLEMENTATION_NOTES.md` "M6a quality audits") |

## 1. Purpose

The CI pipeline guards performance only relatively: `size-limit` for the entry JavaScript, and Lighthouse CI against a stored baseline. The absolute budgets of PRD §6.1 are promises for the real phone with a realistic history. This protocol measures them on the S22. It covers the four flows that matter most in the gym and on the insight screens: **cold start**, **set confirmation**, **charts** and the **body map**, plus the remaining budgets in shorter form.

## 2. Budgets

All values are p75 over at least 10 runs, installed app, airplane mode, reference dataset (PRD §6, NFR-PERF intro).

| Budget | Target | Section |
|---|---|---|
| NFR-PERF-01 cold start | First content ≤ 1.0 s; interactive Home ≤ 2.0 s | 4.1 |
| NFR-PERF-03 set confirmation | Visual feedback ≤ 100 ms; durable commit ≤ 500 ms | 4.2 |
| NFR-PERF-05 charts | Render with the full history ≤ 500 ms; interaction response ≤ 100 ms | 4.3 |
| NFR-PERF-04, -05 body map | Response to a tap ≤ 100 ms; screen change ≤ 300 ms | 4.4 |
| NFR-PERF-04 navigation and scrolling | Screen change ≤ 300 ms; ≥ 55 fps while scrolling a list | 4.5 |
| NFR-PERF-08 backup | Export ≤ 10 s; import ≤ 10 s (without photos) | 4.6 |
| NFR-PERF-02 warm resume | Interactive with correct timers ≤ 500 ms | 4.7 |
| NFR-PERF-06 recompute after a past edit | ≤ 2 s, the UI stays responsive | 4.7 |
| NFR-PERF-09 plan generation | ≤ 1 s | 4.7 |

## 3. Set-up

### 3.1 The reference dataset

- PRD A-11 defines it. M6a built it as the package entry `@powr/application/reference` (technical concept §8.19; the `tools/dataset` generator the concept planned was not built), so the engine test, the desktop perf spec (section 5) and the phone use the same records. Defaults: 270 weeks with five two-week breaks, five workouts a week (push, pull, legs, upper, lower; six exercises with 31 working sets), a lighter week every fifth training week, loads rising about 25 % over five years, 1,800 daily weigh-ins with a yearly bulk and cut, every workout with its exercise slots and planned sets like a logged one. It runs up to yesterday, so today stays free: **1,297 workouts, 40,207 sets, 1,800 weigh-ins, 5 breaks** in M6a's run.
- **Load it with `/debug/perf`.** The page is behind the debug gate: it exists only in debug builds (dev, beta, E2E), not in production builds, so use a **beta build** for this protocol. In each browser:
  1. Finish the first run with a plan: **bodybuilding, three days**, like the desktop perf spec (section 5). The dataset is added next to the profile, plan and settings, which stay.
  2. Open the app once with `?debug=1` (for example `https://<beta-host>/?debug=1`) to turn on the developer tools, then Settings → Developer tools → **Performance (reference dataset)** (`/debug/perf`).
  3. Tap **Add the reference history** (1.7 s on the development machine). The status line says what was added ("Added … workouts, … sets, … weigh-ins and … breaks in … s."); copy it into the results. Adding it again replaces the earlier copy. ("Add a short history" is the six-week history for the accessibility sweep; not for this protocol.)
  4. Open **Home** once (the weekly numbers are rebuilt) and **Progress** once (every exercise is derived) and wait until both show their data, as the desktop perf spec does. Derived data is rebuilt on first use after loading; these one-off rebuilds are not the timings of section 4.
- **The backup file** for 4.6 is the export of this data (Settings → Data and backups → Export backup); record its name, size and SHA-256. Restoring that file in the other browser is an alternative to loading the dataset there (Settings → Data and backups → Restore; this replaces that copy's data). Use the same way for both browsers and note which.

### 3.2 Tools

- **Remote debugging (Chrome only).** Enable USB debugging on the phone; on the desktop open `chrome://inspect/#devices` and inspect the installed app's page. The **Performance** panel records traces with screenshots and an **Interactions** track (the latency of each tap); the **Console** reads the app's performance entries.
- **Screen recording (both browsers).** Settings → Developer options → **Show taps** on; record the screen with the phone's screen recorder or `adb shell screenrecord --bit-rate 20000000 /sdcard/run.mp4` and pull the file. Step through it frame by frame (at 60 fps one frame is about 16.7 ms). This is the only way to time Samsung Internet and the cold start.
- **Diagnostics export.** Open the app once with `?debug=1` (for example `https://<beta-host>/?debug=1`), then Settings → Developer tools → **Export diagnostics**. The file lists the app's diagnostic events with their timing fields (`set.logged` `commitMs`, `backup.exported` `ms`, `backup.imported` `ms`, `db.open` `ms`).
- **The app's own performance entries** (technical concept §8.19):

  | Entry | Kind | What it times |
  |---|---|---|
  | `powr-home-interactive` | mark | Home has first rendered with its data (the cold start's "interactive Home"); its time counts from the page's navigation start |
  | `powr-set-commit` | measure | From the confirm tap to the set's durable commit |
  | `powr-insights-warmup` | measure | The idle check of the derived weeks that runs 5 s after each start |
  | `powr-chart-render:<id>`, `powr-chart-update:<id>`, `powr-chart-zoom:<id>` | measures | A chart's render, update and zoom |

  Read them in either of two ways:

  - **On the phone, both browsers: `/debug/perf`.** Settings → Developer tools → Performance (reference dataset) lists this page load's paint timings (`first-paint`, `first-contentful-paint`) and every `powr-*` mark and measure since the app opened; **Refresh** updates the list. Open it by tapping through the app, not by reloading or typing the address, so the page load (and its entries) stays the same.
  - **Remote Console (Chrome):**

    ```js
    [...performance.getEntriesByType('paint'),
     ...performance.getEntriesByType('mark'),
     ...performance.getEntriesByType('measure')]
      .filter((e) => e.entryType === 'paint' || e.name.startsWith('powr-'))
      .map((e) => [e.name, Math.round(e.entryType === 'measure' ? e.duration : e.startTime)])
    ```

### 3.3 Conditions

- The app installed and started once online, so every chunk is cached; then **airplane mode** on.
- Battery above 50 %, **battery saver off** (one extra pass with it on for 4.1 and 4.2), phone at room temperature, other apps closed, screen brightness fixed.
- Close remote DevTools during timed runs that do not need it: an open inspector slows the page.
- Light theme for the timed runs.
- At least **10 runs** per measurement and browser; report the median and p75.

## 4. Measurements

### 4.1 Cold start (NFR-PERF-01, QS-16)

1. Force-stop the browser: Settings → Apps → Chrome (or Samsung Internet) → Force stop. This also ends the installed app's process.
2. Start screen recording. Tap the POWR icon on the home screen.
3. Stop the recording once Home shows its data (the next session card and the week's numbers).
4. In the recording, count from the frame where the tap dot appears to:
   - **first content:** the first frame that shows app content (not the splash screen);
   - **interactive Home:** the first frame with Home's data rendered and no loading placeholder left.
5. After each run, without reloading, open Settings → Developer tools → Performance (reference dataset) (`/debug/perf`) and note `first-contentful-paint` and `powr-home-interactive` from its list. Both count from the page's navigation start, so they leave out the browser's process start, which only the recording shows; note both kinds of numbers.
6. Repeat 10 times per browser.

### 4.2 Set confirmation (NFR-PERF-03, QS-02)

1. Start a planned workout with the reference dataset loaded. Make sure a rest does not cover the dock (skip it).
2. **Durable commit:** confirm at least 15 sets in a row with one tap each. Export diagnostics and read `commitMs` of the `set.logged` events: the time from the confirm handler's start until the set's transaction has committed. Report the median and p75 (budget ≤ 500 ms). In both browsers, `/debug/perf` also lists one `powr-set-commit` per set (from the tap to the durable commit; open it through Settings → Developer tools after the sets, the workout keeps running); note those numbers too. The time to the logged row in the list has no budget; the desktop perf spec measures it (section 5, TD-73).
3. **Visual feedback (Chrome):** record a Performance trace in remote DevTools while confirming 10 sets; the **Interactions** track gives each tap's latency until the next frame (budget ≤ 100 ms).
4. **Visual feedback (Samsung Internet):** screen recording with Show taps; count frames from the tap dot to the frame where the set shows as done.

### 4.3 Charts (NFR-PERF-05, QS-09, S-4 condition 2)

1. Open Progress → the squat (or another lift with five years of history) → the e1RM trend chart. Choose the **All** range chip.
2. **Render:** read `powr-chart-render:<id>` in the Console (Chrome). Repeat by leaving and reopening the screen 10 times (budget ≤ 500 ms). Ranges over one year use weekly maxima, as built in M4a.
3. **Interaction:** pinch to zoom, tap a point (the readout appears), tap a range chip, tap Earlier/Later. Read `powr-chart-zoom:<id>` and `powr-chart-update:<id>`, and the Interactions track for the taps (budget ≤ 100 ms each).
4. Repeat 2–3 on the volume chart and the bodyweight chart.
5. Samsung Internet: screen recording for the render (from the tap that opens the screen to the drawn chart, minus the screen change) and for the readout after a tap.
6. On the desktop, `CHART_BENCH=1 pnpm e2e charts` runs the opt-in S-4 measurements of `apps/web/e2e/charts.spec.ts` (technical concept §8.10); note them next to the S22 numbers for comparison.

**If a chart budget fails:** the technical concept names Recharts 3 as the documented fallback behind the same wrapper (ADR-0007). The decision is the product owner's.

### 4.4 Body map (NFR-PERF-04, NFR-PERF-05)

The body map writes no performance entries; use the Interactions track (Chrome) and screen recordings (both browsers).

1. Explore → Body map, with the reference dataset loaded (the heat map uses the current week).
2. Tap a muscle region: time to the selected state (≤ 100 ms) and to the muscle panel's screen (≤ 300 ms).
3. Switch front/back and switch to heat-map mode: time to the redrawn figure (≤ 100 ms).
4. In the muscle panel, switch the sort between Effectiveness and Focus (≤ 100 ms).
5. Repeat each step 10 times.

### 4.5 Navigation and scrolling (NFR-PERF-04)

1. Switch between the bottom-navigation tabs and open a few deep screens (exercise detail, a past session): time from tap to the new screen's content (≤ 300 ms), by screen recording or a Performance trace. Include the **Progress hub** (from the tap on Progress to the list with every exercise's e1RM and label) and the library search: on the desktop they were the slowest (section 5; the hub's data read is TD-74).
2. Scroll the past-session list and the exercise library quickly for 5 seconds with a Performance trace running (Chrome): check the frame rate (≥ 55 fps sustained).

### 4.6 Backup export and import

1. **Export:** Settings → Data and backups → Export backup with the reference dataset. Read `backup.exported` (`bytes`, `ms`) in the diagnostics export (≤ 10 s).
2. **Import:** restore the same file. Read `backup.imported` `ms` (≤ 10 s). The time from the confirm tap to "Restored" in a screen recording is the user's view; note both.
3. Three runs each are enough for a pass or fail decision; this decides TD-16 (whether the backup codec moves into a worker; release checklist row T-08).

### 4.7 Other budgets

- **Warm resume (NFR-PERF-02):** during a rest, switch to another app for 60 s, come back: time until the screen shows the correct remaining time (≤ 500 ms; screen recording). The S-1 protocol's TMR-04 check covers the same with the screen locked.
- **Recompute (NFR-PERF-06, QS-13):** edit a set 8 weeks back in past sessions and save; time until the trend and the PR list are updated (≤ 2 s); the screen must stay responsive meanwhile.
- **Plan generation (NFR-PERF-09):** in Settings, change one onboarding answer so that the plan changes; time from "Save" to the re-plan preview (≤ 1 s).
- **Calendar export for long ranges (TD-50):** Plan → Add to calendar → "Next 8 weeks" and, with a meet date far out, "Until your meet": time from the tap to the download (no budget; record it).
- **Idle warm-up (TD-75):** after a cold start, leave Home open for 10 s, then read `powr-insights-warmup` on `/debug/perf` (no budget; it runs in idle time; record it).
- **"Verify data" (TD-76):** Settings → Data and backups → Verify data with the reference dataset: time from the tap to the result, by screen recording (no budget; it runs on request without blocking; record it).

## 5. Desktop comparison: `POWR_PERF=1 pnpm e2e perf`

`apps/web/e2e/perf.spec.ts` (M6a) measures the same flows in emulated Chromium on the development machine. It is opt-in and not part of `pnpm verify`: run `pnpm build`, then `POWR_PERF=1 pnpm e2e perf`. It uses Chromium headless on Playwright's Pixel 7 profile (360 × 780, DPR 3, touch), the production build with its service worker and the production CSP, the real IndexedDB, and the CPU throttled 4× through CDP (`POWR_PERF_CPU` sets the factor). An onboarded user (bodybuilding, three days) gets the reference history; Home is opened once (the weekly numbers are rebuilt) and Progress once (every exercise derived). Then seven runs, each in a new page of the same browser context: installed app files, a "warm browser, cold app" start (the phone's cold process start is measured only in 4.1). Each screen is timed from the tap inside the page to the first frame with its data. It reports medians and p75 (nearest rank).

Run it before the device session and copy its numbers into the results template ("desktop reference"). Its numbers are a regression signal; the S22 numbers of this protocol are the release evidence (row EC-07 of the [release checklist](../release/checklist.md)). M6a's run after its fixes (2026-11-25; a 16-core desktop that ran other tests at the same time, so about ±10 % noise), in ms, median / p75:

| Measure | Budget | Desktop, CPU 4× |
|---|---|---|
| Cold start: first contentful paint | ≤ 1,000 (NFR-PERF-01) | 324 / 388 |
| Cold start: Home interactive (`powr-home-interactive`) | ≤ 2,000 (NFR-PERF-01) | 648 / 726 |
| Progress hub (the list with every e1RM and label) | navigation ≤ 300 (NFR-PERF-04)¹ | 619 / 633 |
| An exercise with its chart (squat, five years) | chart ≤ 500 (NFR-PERF-05)¹ | 711 / 730 |
| Explore | ≤ 300 | 175 / 203 |
| Body map with this week | ≤ 300 | 255 / 278 |
| Library list | ≤ 300 | 189 / 200 |
| Library search ("row") | ≤ 100 interaction | 125 / 129 |
| Set confirm: tap to the next frame (visual feedback) | ≤ 100 (NFR-PERF-03) | 6 / 8 |
| Set confirm: tap to the durable commit (`powr-set-commit`) | ≤ 500 (NFR-PERF-03) | 114 / 115 |
| Set confirm: tap to the logged row | — | 252 / 258 |
| "Verify data" (a full rebuild of 270 weeks) | — | 3,182 / 3,255 |
| Backup export (reference dataset) | ≤ 10,000 (NFR-PERF-08) | 5,315 |
| Idle check of the derived weeks 5 s after start (`powr-insights-warmup`) | — | 382 |

¹ The screen itself (its h1, links and "Loading…") is there at once; the number is the time to the data.

## 6. Pass rule and what follows

- A budget passes when its p75 over at least 10 runs (3 for 4.6) is within the target **in both browsers**.
- A failed budget is recorded with its numbers and the trace or recording file. The product owner decides between a fix (an agent task) and an adjusted budget with a rationale (the PRD allows the technical concept to propose one, PRD §6).
- Results feed: PRD M10 and row EC-07 of the release checklist; TD-50 (charts) and TD-16 (backup codec) in the technical concept §11.2; S-4's second condition (§8.10); and the product owner's decision on the four measured levers TD-73…TD-76 (set confirm in 4.2, the Progress hub in 4.5, the idle warm-up and "Verify data" in 4.7; release checklist row T-12).

---

## Results template

Copy everything below this line into `docs/device-tests/<date>-s22-perf.md` and fill it in.

```markdown
# Performance results: <date>, Galaxy S22

## Device, build and data

| Field | Value |
|---|---|
| Date | |
| Tester | |
| Device model | Galaxy S22 SM-S901_ |
| One UI / Android | |
| Chrome version | |
| Samsung Internet version | |
| App build (Settings → About) | |
| Served from | beta server / `adb reverse` + Docker image |
| Reference dataset: loaded with `/debug/perf`, or restored from a file (name, size, SHA-256) | |
| Record counts (the `/debug/perf` status line or the restore preview) | workouts … sets … weigh-ins … breaks … |
| Battery at start, battery saver | |
| Desktop reference (`POWR_PERF=1 pnpm e2e perf`, CPU 4×): date, machine, where the numbers are | |

## Results

All times in ms unless noted. p75 over n runs.

| # | Measurement | Budget | Chrome median | Chrome p75 | Samsung Internet median | Samsung Internet p75 | n | Method (marks, trace, recording, diagnostics) | Pass |
|---|---|---|---|---|---|---|---|---|---|
| 4.1 | Cold start: first content | ≤ 1,000 | | | | | | | |
| 4.1 | Cold start: interactive Home | ≤ 2,000 | | | | | | | |
| 4.1 | Cold start with battery saver on: interactive Home | ≤ 2,000 | | | | | | | |
| 4.1 | From navigation start (`/debug/perf`): `first-contentful-paint` | ≤ 1,000 | | | | | | | |
| 4.1 | From navigation start (`/debug/perf`): `powr-home-interactive` | ≤ 2,000 | | | | | | | |
| 4.2 | Set confirm: visual feedback | ≤ 100 | | | | | | | |
| 4.2 | Set confirm: durable commit (`commitMs`) | ≤ 500 | | | | | | | |
| 4.2 | Set confirm: durable commit (`powr-set-commit`) | ≤ 500 | | | | | | | |
| 4.3 | e1RM chart, All: render | ≤ 500 | | | | | | | |
| 4.3 | e1RM chart: zoom | ≤ 100 | | | | | | | |
| 4.3 | e1RM chart: tap readout, range chip | ≤ 100 | | | | | | | |
| 4.3 | Volume chart: render | ≤ 500 | | | | | | | |
| 4.3 | Bodyweight chart: render | ≤ 500 | | | | | | | |
| 4.4 | Body map: tap → selected | ≤ 100 | | | | | | | |
| 4.4 | Body map: tap → muscle panel | ≤ 300 | | | | | | | |
| 4.4 | Body map: front/back, heat-map mode | ≤ 100 | | | | | | | |
| 4.4 | Muscle panel: sort switch | ≤ 100 | | | | | | | |
| 4.5 | Screen change | ≤ 300 | | | | | | | |
| 4.5 | Progress hub: tap → list with its data | ≤ 300 | | | | | | | |
| 4.5 | Scrolling (fps) | ≥ 55 fps | | | | | | | |
| 4.6 | Backup export (s) | ≤ 10 s | | | | | | | |
| 4.6 | Backup import (s) | ≤ 10 s | | | | | | | |
| 4.7 | Warm resume | ≤ 500 | | | | | | | |
| 4.7 | Recompute after a past edit | ≤ 2,000 | | | | | | | |
| 4.7 | Plan generation | ≤ 1,000 | | | | | | | |
| 4.7 | Calendar export, 8 weeks / until the meet | — | | | | | | | |
| 4.7 | Idle warm-up (`powr-insights-warmup`) | — | | | | | | | |
| 4.7 | "Verify data" | — | | | | | | | |

## Files stored next to this record

- [ ] traces (`.json`) and screen recordings (`.mp4`), named `<section>-<browser>-<n>`
- [ ] the diagnostics exports

## Failed budgets and proposals

| Budget | Measured p75 | Proposal (fix / adjusted budget with rationale) |
|---|---|---|
| | | |

## Observations

-
```
