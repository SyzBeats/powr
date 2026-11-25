# S-2 device test: Samsung Internet and Android capabilities on the Galaxy S22 (protocol and results template)

| Field | Value |
|---|---|
| Spike | S-2 (technical concept §8.8.5, §8.23, Appendix A.3) |
| Validates | PRD V-07, PWA-01, PWA-02, PWA-05, PWA-06, PWA-07, PWA-09, PWA-12, PWA-13, PWA-14, DAT-03, DAT-04, DAT-05 (delivery), CAL-05 (delivery); risks R-05, P-03, P-04, P-07, P-08 |
| Device | Samsung Galaxy S22 (plus one non-Samsung Android phone with Chrome, NFR-COMP-04) |
| Browsers | Chrome stable and Samsung Internet stable, each as **installed PWA** and as a **browser tab** |
| Harness | `/debug/capabilities` ("Capability probe (S-2)": detection results, tap-to-run checks, **Export report**) and the product screen **Settings → Device support** (`/settings/device-support`, M5d) |
| Machine records | The probe's report exports (`powr-capabilities-<stamp>.txt`), kept next to the human record |
| Human results | `docs/device-tests/<date>-s22-s2.md`, one file per test day, copied from the template at the end of this document |
| Version | 1.0, 2026-11-25 (M5d) |

## 1. Purpose

POWR uses optional platform features only after detecting them at runtime, and says what it does instead when one is missing (PWA-13). Detection says whether an API exists, not whether it works on this phone: Samsung Internet and One UI differ from Chrome (R-05), battery saver changes behaviour, and some features (app shortcuts, the install dialog, the share sheet for a file type) cannot be detected at all. S-2 checks on the real phone what actually works. The results decide:

- what **Settings → Device support** says for Chrome and Samsung Internet (today every row shows "Device test S-2 has not run yet", only the timer alerts row uses the S-1 matrix);
- the wording of the **install promotion** for Samsung Internet (the menu path in `InstallPromotion.tsx` is a draft, P-07);
- whether the **share sheet** may be offered for `.ics`, and whether the **save picker** replaces the download for backups (TD-15);
- whether the **back gesture** in standalone mode behaves as built (sheets first, Home beneath a shortcut).

S-1 (timer alerts) is a separate protocol (`docs/device-tests/S-1-protocol.md`); run S-2 on the same day with the same build if possible.

## 2. Set-up (once per browser)

1. **Serve the build** with the production headers, as for S-1 (`IMPLEMENTATION_NOTES.md` section 1, "Testing on the Galaxy S22"): `pnpm build && pnpm docker:build && pnpm docker:run`, then `adb reverse tcp:8080 tcp:8080`. Once S-7 exists, use the beta server. `localhost` is a secure context; a LAN address is not.
2. On the S22 open `http://localhost:8080/?debug=1` in the browser under test. Pass the legal gate ("Just let me log") and wait for "Ready for offline use" on Home.
3. **Write down the versions:** One UI, Android, Chrome (`chrome://version`), Samsung Internet (Settings → About). Note the device model.
4. Start the install checks (cells 1 and 2) with **no stored data for the site**: in the browser's site settings for `localhost:8080`, choose "Delete data" (or the browser's equivalent) before cell 1.
5. Open Settings → Developer tools → **"Capability probe (S-2)"**. Tap **Export report** once before any manual check (the baseline), and again at the end of each browser and mode.

## 3. Cells, in priority order

Run every cell in **Chrome** and in **Samsung Internet**; "PWA" cells after installing the app, "tab" cells in the browser. Mark each cell **pass**, **fail** or **n/a**, with a note of what was seen. Run the cells in this order, so that the most important results exist even if the day ends early.

| # | Area | Mode | What to do | Expected (as built) |
|---|---|---|---|---|
| 1 | Install (PWA-01, PWA-02, P-07) | tab | On a **second** visit (reload once after onboarding), finish a short workout. On the summary look for the "Install POWR on this phone" card. Chrome: tap **Install**; Samsung Internet: follow the steps on the card. | Never on the first visit and never during a workout. Chrome shows its own install dialog; Samsung Internet shows the menu steps. Record the real Samsung menu path and whether an install icon appears in the address bar. |
| 2 | Install, dismissal | tab | Tap **Not now** on the card, reload Home. | No card for 14 days. |
| 3 | Launch and display (PWA-01, PWA-14) | PWA | Start POWR from the home-screen icon and from the app drawer. Open the recent-apps view. Switch the theme (Settings) between light and dark. | Splash, standalone window, own entry in recent apps; the status bar colour follows the theme; nothing hidden behind the status bar, the gesture bar or a cutout. |
| 4 | App shortcuts (PWA-05) | PWA | Touch and hold the POWR icon on the One UI home screen. Try **"Start today's session"** and **"Log bodyweight"**, also in airplane mode. | Both shortcuts listed; each opens its screen offline. Back from the shortcut screen goes to Home, Back from Home leaves the app. |
| 5 | Back gesture (PWA-12) | PWA and tab | Open a sheet (Data and backups → "Delete all data…", or "Why?" anywhere), use the Android back gesture. Then during a workout open "Add exercise", Back, Back again. | Back closes the sheet and stays on the screen; the next Back goes to the previous screen; the workout keeps running ("Workout in progress" on Home). The app never closes while a sheet is open. |
| 6 | Persistent storage (DAT-03, P-03) | tab, then PWA | In Data and backups read "Storage protected". Tap **Protect my data**. Repeat after installing, and after allowing notifications (Settings → Alerts). | Record Yes/No each time; the probe's `storagePersisted`. The screen explains a "no" and backup reminders default to 7 days while unprotected. |
| 7 | Storage use (DAT-04) | tab | Read "Using … of …" in Data and backups and the probe's `storageUsageMb` / `storageQuotaMb`. | Values shown, or "not reported by this browser". |
| 8 | Keep the screen on (PWA-06, P-08) | PWA | Start a workout with the screen timeout at 30 s; wait 2 minutes. Repeat with **battery saver on**. Then switch apps and come back. | Screen stays on during the workout in both battery states; the lock is taken again after returning. Probe check "Wake lock" returns `held`. |
| 9 | Vibration and sound (PWA-07) | PWA | Probe checks "Vibrate" and "Beep"; Settings → Alerts → "Test alert". | Vibration felt, sound heard at the in-app volume. |
| 10 | Share sheet per file type (PWA-09, P-04) | tab and PWA | Read the probe's `canShareIcs`, `canShareCsv`, `canSharePng`, `canShareTxt`, `canShareZip`, `canShareJson`. In Plan → "Add to calendar" check whether **"Share with a calendar app"** appears; if it does, share to Samsung Calendar. | Chrome: `.ics`, `.zip` and `.json` false (P-04), so only "Download the calendar file". Record Samsung Internet's values; they decide whether `.ics` sharing is offered there. |
| 11 | Downloads (DAT-05, CAL-05) | tab and PWA | Export a backup (Data and backups) and a calendar file (Plan → Add to calendar). Open each from the download notification and from My Files → Downloads. | Both files arrive in Downloads with the names `powr-backup-YYYY-MM-DD-HHMM.zip` and `powr-plan-YYYY-MM-DD.ics`; the status line names the file. The `.ics` import itself is S-6. |
| 12 | Save picker (TD-15) | tab | Read the probe's `saveFilePicker`. If true, note which providers the system picker offers (Downloads, Google Drive, OneDrive, Samsung Cloud). | Not used by POWR yet (Device support says "Available, not used yet"). The result decides TD-15. |
| 13 | Notification tap (PWA-08) | PWA | With notifications allowed, start a 60 s rest, lock the screen, tap the "Rest over" notification. | POWR comes to the front at the workout. (Also an S-1 item; record it once.) |
| 14 | Page freezing | PWA and tab | Start a 3-minute rest, switch to another app for 6 minutes, come back. | The timer shows the right time at once; record whether the page reloaded (the resume banner shows "Workout resumed"). |
| 15 | Offline (PWA-03) | PWA | Airplane mode on, kill the app, start it from the icon; open Device support, Data and backups, Plan → Add to calendar and download the file. | Everything opens and works; "Works offline: Works here". |
| 16 | Delete all data (DAT-13) | PWA | Data and backups → Delete all data… → export first → type DELETE → Delete everything → Start again. Then check the site storage in the browser's site settings. | Welcome screen of the first run; the browser reports no stored data for the site except the app files. |
| 17 | Device support screen (PWA-13) | PWA and tab | Open Settings → Device support (or Data and backups → "What works on this phone"). Compare every row with what cells 1–16 showed. | No row claims more than the cells showed. Note every row whose words are wrong or unclear for this browser. |

## 4. Conditions

- **Battery saver:** cells 8 and 14 with battery saver off and on (Settings → Battery → Power saving). The worse result counts.
- **Display mode:** "PWA" = started from the home-screen icon after installing; "tab" = the browser itself. Samsung Internet's "Add page to → Home screen" may create a bookmark shortcut instead of an installed app; note which one it was (an installed app has its own entry in recent apps).
- **Text size:** run cell 17 once with the phone's font size at the largest setting (Settings → Display → Font size and style) and once with "Screen zoom" at the largest step; nothing may be cut off.
- **TalkBack:** run cells 1, 5 and 17 once with TalkBack on; note how the install card, the sheets and the device-support rows are read.

## 5. Records

1. After each browser and mode, tap **Export report** in the probe and copy the file off the phone (Downloads; `adb pull /sdcard/Download/<file> .`).
2. Fill in the human record from the template below as `docs/device-tests/<date>-s22-s2.md`, with the exported reports attached or pasted at the end, and screenshots of the install UI, the shortcuts menu and the share sheet where they appear.
3. Commit the record and the reports together.

## 6. How the results feed back

- **Device support texts (PWA-13):** every row that S-2 confirms or contradicts gets its words from the result ("Works on Galaxy S22 with Chrome 142" or a corrected fallback). A machine-readable S-2 matrix like S-1's (`tools/capability-matrix`) does not exist yet; until it does, the texts are edited by hand from the human record. Open decision for the product owner: build the S-2 matrix, or keep hand-edited texts.
- **Install promotion (PWA-02):** the Samsung Internet steps on the card and on the Device support row follow the recorded menu path.
- **Share sheet (PWA-09, CAL-05):** if Samsung Internet's `canShare` accepts `.ics` and sharing to Samsung Calendar works, the share button stays as built (it appears only where `canShare` is true); otherwise nothing changes, because it is never offered where the browser refuses the type.
- **Save picker (TD-15):** if it works with Downloads and a cloud-drive provider in Chrome 132+ (and Samsung Internet 29+), backups switch to it with the download as the fallback.
- **Back gesture (PWA-12):** any case where Back closes the app with a sheet open, or loses a workout, is a release blocker.
- **Capability matrix (NFR-COMP-04):** the summary table below is the S-2 part of the release artifact; repeat it on one non-Samsung Android phone with Chrome.

---

## Results template

Copy everything below this line into `docs/device-tests/<date>-s22-s2.md` and fill it in.

```markdown
# S-2 results: <date>, Galaxy S22

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
| Launcher | One UI Home <version> |
| Notification permission | granted / denied |

## Cells

One table per browser (Chrome, Samsung Internet). "PWA" and "tab" are separate columns.

### <Browser>

| # | Area | PWA: result (pass / fail / n/a) | PWA: what was seen | Tab: result | Tab: what was seen | Battery saver on (cells 8, 14) |
|---|---|---|---|---|---|---|
| 1 | Install | | | | | |
| 2 | Install, dismissal | | | | | |
| 3 | Launch and display | | | | | |
| 4 | App shortcuts | | | | | |
| 5 | Back gesture | | | | | |
| 6 | Persistent storage (before install / after install / after notifications) | | | | | |
| 7 | Storage use | | | | | |
| 8 | Keep the screen on | | | | | |
| 9 | Vibration and sound | | | | | |
| 10 | Share sheet per file type (`ics` / `csv` / `png` / `txt` / `zip` / `json`) | | | | | |
| 11 | Downloads (backup, calendar) | | | | | |
| 12 | Save picker (providers offered) | | | | | |
| 13 | Notification tap | | | | | |
| 14 | Page freezing (reloaded? time right?) | | | | | |
| 15 | Offline | | | | | |
| 16 | Delete all data | | | | | |
| 17 | Device support screen (rows that are wrong or unclear) | | | | | |

## Samsung Internet install path (P-07)

| Step | What the tester tapped | Screenshot |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| Installed app or bookmark shortcut? | | |

## Summary for the capability matrix (PWA-13)

| Capability | Chrome PWA | Chrome tab | Samsung Internet PWA | Samsung Internet tab | Device support text to change |
|---|---|---|---|---|---|
| Works offline | | | | | |
| Install | | | | | |
| Storage protection | | | | | |
| Storage use | | | | | |
| Keep the screen on | | | | | |
| Vibration | | | | | |
| Share the calendar file | | | | | |
| Share backup files | | | | | |
| Save to a folder you choose | | | | | |
| App shortcuts | | | | | |
| Back gesture | | | | | |

## Text size and TalkBack

| Check | Result | Notes |
|---|---|---|
| Largest font size: nothing cut off (cell 17) | | |
| Largest screen zoom: nothing cut off | | |
| TalkBack: install card read in order, buttons named | | |
| TalkBack: Back closes a sheet and focus returns to its button | | |
| TalkBack: device-support rows read as heading, status, explanation | | |

## Decisions and follow-ups

- Device support wording changes:
- Samsung Internet install steps:
- `.ics` share in Samsung Internet (keep / no change):
- Save picker (TD-15):
- Release blockers found:
```
