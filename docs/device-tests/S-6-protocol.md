# S-6 device test: `.ics` import into Samsung Calendar and Google Calendar (protocol and results template)

| Field | Value |
|---|---|
| Spike | S-6 (technical concept §6.6, §8.13, §8.3.7, Appendix A.3) |
| Validates | PRD V-02 (before MVP release), CAL-01…05, P-04, P-05, R-04 |
| Device | Samsung Galaxy S22, plus a computer for Google Calendar on the web |
| Calendar apps | Samsung Calendar (preinstalled), Google Calendar for Android, Google Calendar on the web (calendar.google.com, the import path Google documents) |
| Browsers | Chrome stable and Samsung Internet stable, each as **installed PWA** and as a **browser tab** |
| Export screen | Plan → "Add to calendar" (route `/plan/calendar`); the file is `powr-plan-<date>.ics` |
| Human results | `docs/device-tests/<date>-s22-ics.md`, one file per test day, copied from the template at the end of this document |
| Version | 1.0, 2026-11-25 (M5 calendar work) |

## 1. Purpose

POWR exports planned sessions as an iCalendar file (RFC 5545). It is one-way: no account, no calendar API, no subscription (CAL-07). How calendar apps on Android handle such a file is not documented well enough to promise anything (PRD P-05). S-6 measures it on the real phone. The results decide:

- the import guide shown after an export (CAL-05): which app, which steps, which warnings;
- what the export screen says about re-exporting (CAL-04): whether an updated file **updates** existing events or **adds duplicates**, and how to remove old events;
- whether cancelled sessions stay in the file as `STATUS:CANCELLED` events, or are dropped (technical concept §8.13);
- whether "Share" can be offered for `.ics` in Samsung Internet (Chrome does not allow sharing `.ics` files, P-04; the app offers Share only when `navigator.canShare` says yes).

Nothing in this document is a result. Every cell is **to be measured**.

## 2. What the file contains

So the tester knows what to look for. The technical concept §6.6 and §8.13 hold the details.

- One `VEVENT` per planned session in the chosen range. Title like "POWR · Upper A (Week 3)", the estimated duration, and a description with the main exercises and set counts. No personal data beyond training content (CAL-02).
- Start times: the start time set for that weekday in the plan, or the time chosen at export, or all-day events. Timed events are written in UTC (`DTSTART:20261124T170000Z`); each one is converted from the local wall-clock time in the phone's time zone, so a session at 18:00 stays at 18:00 across a DST change (CAL-03).
- An optional reminder (`VALARM`, display): none, 15 min, 30 min, 1 h or 2 h before.
- A stable `UID` per planned session: `<planned-session ID>@<host>`. The host comes from the deployment's public origin; until the deploy sets it, it is `powr.invalid` (a reserved name that is never a real domain). A build with another host gives every event a new UID, so **never change the build between two exports of the same cell**.
- `SEQUENCE` grows when a session changes; a session that left the plan may be written as `STATUS:CANCELLED` with a higher `SEQUENCE` (CAL-04).
- `METHOD:PUBLISH`, `CRLF` line endings, lines folded at 75 octets.

## 3. Set-up (once)

1. **Serve the build** on the phone with the production headers, as for S-1 (`IMPLEMENTATION_NOTES.md` section 1, "Testing on the Galaxy S22"):

   ```sh
   pnpm build && pnpm docker:build && pnpm docker:run
   adb reverse tcp:8080 tcp:8080
   ```

   Once the beta server exists (S-7), use it instead.
2. **Write down the versions:** One UI, Android, Chrome, Samsung Internet, Samsung Calendar (Settings → Apps → Calendar → App info), Google Calendar (Play Store page or App info), the app build (Settings → About), and the UID host (open an exported file in a text viewer and read the part after `@` in a `UID:` line).
3. **Use a test profile, not your real training.** Set up a plan with 3 or 4 training days and a start time on at least two weekdays (onboarding or Plan → set up again). Training content is not personal data, but a test plan keeps your calendar clean.
4. **Make separate calendars to import into**, so old test events can be removed in one step:
   - Samsung Calendar: Settings → Manage calendars → add a local calendar "POWR test" (if the app offers it); otherwise note which calendar the import uses.
   - Google Calendar on the web: Settings → Add calendar → Create new calendar "POWR test". Imports go into it.
5. Check that the phone's time zone is **Europe/Zurich** (Settings → General management → Date and time) for the DST cell, or note the zone used.
6. Notifications allowed for Samsung Calendar and Google Calendar, Do Not Disturb off (for the alarm cells).

## 4. Cells, in priority order

Run the cells in this order, so that the most important results exist even if the day ends early. "Open" means: tap the download notification, or open the file from My Files → Downloads, and pick the calendar app if Android asks.

| # | Browser, mode | Calendar app | Export settings | Steps | Purpose |
|---|---|---|---|---|---|
| 1 | Chrome, PWA | Samsung Calendar | "This training block", "Your planned start times", "30 minutes before" | Export, open from the download notification | First import of a multi-event file (CAL-01, CAL-02) |
| 2 | Chrome, PWA | Google Calendar (Android) | Same file as cell 1 | Open from My Files → Downloads, choose Google Calendar | Does the Android app import at all, all events or one? (P-05) |
| 3 | — | Google Calendar (web) | Same file as cell 1, copied to the computer | Settings → Import & export → Import → file → calendar "POWR test" | The documented path (P-05) |
| 4 | Samsung Internet, tab | Samsung Calendar | "Rest of this week", "The same time for every session", "No reminder" | Export, open from the download notification | Second browser; is "Share" offered? |
| 5 | Samsung Internet, PWA | (share sheet) | Same as cell 4 | Tap "Share with a calendar app" if the export screen offers it; pick Samsung Calendar or Google Calendar in the sheet | Share path (P-04, PWA-09); "not offered" is a valid result |
| 6 | Chrome, tab | Samsung Calendar | "Next 4 weeks", **"All-day events"** | Export, open | All-day events (CAL-02) |
| 7 | Chrome, PWA | Samsung Calendar and Google Calendar (Android) | Rest of this week; for today's or tomorrow's session choose a time about 20 min from now; alarms 15 min, then repeat with 1 h and 2 h on later sessions | Export, open, keep the phone locked until the reminder time | Alarms fire, with sound or vibration as the calendar app is set (CAL-02) |
| 8 | Chrome, PWA | Samsung Calendar, Google Calendar (Android and web) | Same settings as cell 1 | Export again **without changing the plan**, import again | Identical re-import: duplicates or not? |
| 9 | Chrome, PWA | Samsung Calendar, Google Calendar (Android and web) | Same settings as cell 1 | Change the plan: move one session to another day (Plan → week → session → Move) and pick a different export time for another weekday; export again, import again | Changed sessions: **updated in place** or **duplicated**? (CAL-04) |
| 10 | Chrome, PWA | Samsung Calendar, Google Calendar (Android and web) | Same settings as cell 1 | Remove a session from the range (skip a missed session, or end and re-plan the block); export again, import again | `STATUS:CANCELLED`: removed, marked cancelled, or left as it was? |
| 11 | Chrome, PWA | Samsung Calendar | A range that crosses a DST change (see section 5) | Export, open, compare times before and after the change | Same local wall-clock time across DST (CAL-03) |
| 12 | Chrome, PWA, **airplane mode** | Samsung Calendar | Rest of this week | Switch airplane mode on after the app has loaded once, export, open | Offline export (CAL-05, PWA-03) |
| 13 | — | Each app that imported something | — | Remove every POWR test event | The shortest removal steps for the guide (CAL-04) |

For every import, check:

- **Count:** the number of events in the calendar equals the number of sessions the export screen said it wrote (cancelled events excluded).
- **Title and description:** the title reads like "POWR · Upper A (Week 3)"; the description lists the exercises with set counts, with line breaks, commas and semicolons shown correctly (no `\,` or `\n` visible).
- **Time and length:** each event starts at the planned local time (or is all-day) and lasts the estimated duration.
- **Reminder:** the event's reminder shows the chosen offset, or none.
- **Errors:** any error message, partial import, or "unsupported file" dialog. Take a screenshot.

## 5. DST cell (cell 11)

CAL-03: an export that spans a DST change must show every session at the same local wall-clock time before and after it. The unit tests cover both changes of Europe/Zurich (25 October 2026 and 28 March 2027); this cell checks how the calendar apps display it.

- The next change after this protocol was written is **Sunday 28 March 2027** (clocks go forward). Choose a range that reaches the week of **29 March 2027**: "Next 8 weeks", or "Until your meet" with a meet date after 29 March 2027.
- If no range reaches it on the test day, write "not reachable" and repeat the cell when the test day is within reach of a change (for example in March 2027, or in October 2027 for the change on 31 October 2027).
- Pass: a session planned at 18:00 shows at 18:00 both in the week before and in the week after the change, in every calendar app.
- Optional: change the phone's time zone to another zone after the import and note what the calendar shows. Events are fixed instants, so a session at 18:00 in Zurich shows at the matching local time of the new zone. This is expected; note it only if an app does something else.

## 6. Each run

1. In POWR open Plan → **"Add to calendar"**. Choose the range, the start time option and the reminder as the cell says. Note the number of sessions the screen says it will export.
2. Tap **"Download the calendar file"** (or **"Share with a calendar app"** in cell 5). Note where the file went (download notification, Downloads folder, share sheet).
3. Open the file as the cell says. Note every dialog Android or the calendar app shows, with its wording (screenshot).
4. Check the imported events (section 4, "For every import").
5. For re-import cells (8–10): note for each changed or removed session whether the calendar shows **one updated event**, **the old and the new event**, or **only the old event**, and whether a cancelled session disappeared, is shown as cancelled, or stayed unchanged.
6. Keep the exported files (copy them off the phone, `adb pull /sdcard/Download/<file> .`) next to the results record, named `<cell>-<app>.ics`.

## 7. File check (once per test day)

1. Validate one exported file with an RFC 5545 validator on the computer (for example the icalendar.org validator). The file holds training content only; use the test plan.
2. Open the file in a text editor and check: `CRLF` line endings, folded lines start with one space, `UID` lines end with `@` and the expected host, `SEQUENCE` and `STATUS` are present, the `VALARM` blocks match the chosen reminder.
3. Note the validator's errors and warnings verbatim.

## 8. How the results feed back

1. **Import guide (CAL-05):** the steps that worked, per app, in the fewest taps. The export screen's guide text is finalized from them (technical concept §6.6, step 6). Apps or paths that failed are named as not supported, without blame.
2. **Re-export text (CAL-04):** if any app duplicates instead of updating, the screen keeps the sentence that some calendar apps add duplicates and gives the removal steps from cell 13. If every app updates in place, the sentence can be shortened (product-owner decision).
3. **Cancellations (§8.13):** if no app honours `STATUS:CANCELLED`, propose dropping cancelled events from the file and telling the user to delete removed sessions by hand.
4. **Share (P-04, PWA-09):** record whether `navigator.canShare` allowed `.ics` in Samsung Internet; the capability matrix and the device-support screen (PWA-13) reflect it.
5. **PRD P-05 and V-02:** mark V-02 done with the date and the record file; amend P-05 with the measured behaviour in the next docs pass.
6. Write the human record from the template below as `docs/device-tests/<date>-s22-ics.md`, with the screenshots and the exported files next to it, and commit them together.

## 9. What a tester has to note by hand

POWR cannot see what happens after the file leaves the app. Record for every run:

- which apps Android offered to open the file with, and which one was used;
- every dialog and its wording (screenshots);
- the number of events imported, and any that are missing or doubled;
- whether reminders fired (sound, vibration, notification text) and when;
- anything unexpected (an app crashed, the file opened as text, the import went into an unexpected calendar).

---

## Results template

Copy everything below this line into `docs/device-tests/<date>-s22-ics.md` and fill it in.

```markdown
# S-6 results: <date>, Galaxy S22

## Device and versions

| Field | Value |
|---|---|
| Date | |
| Tester | |
| Device model | Galaxy S22 SM-S901_ |
| One UI / Android | |
| Chrome version | |
| Samsung Internet version | |
| Samsung Calendar version | |
| Google Calendar (Android) version | |
| Google Calendar web: browser and computer | |
| App build (Settings → About) | |
| UID host in the exported files | powr.invalid / … |
| Served from | `adb reverse` + Docker image / beta server |
| Phone time zone | Europe/Zurich / … |
| Test plan | days, start times set on which weekdays |

## Imports

| Cell | Browser, mode | Delivery (download / share) | Opened from | Calendar app | Sessions exported | Events imported | Titles and descriptions correct? | Times and lengths correct? | Reminder shown | Dialogs / errors | Screenshot |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Chrome, PWA | | | Samsung Calendar | | | | | | | |
| 2 | Chrome, PWA | | | Google Calendar (Android) | | | | | | | |
| 3 | — | — | computer | Google Calendar (web) | | | | | | | |
| 4 | Samsung Internet, tab | | | Samsung Calendar | | | | | | | |
| 5 | Samsung Internet, PWA | share offered? yes / no | share sheet | | | | | | | | |
| 6 | Chrome, tab | | | Samsung Calendar (all-day) | | | | | | | |
| 11 | Chrome, PWA | | | Samsung Calendar (DST) | | | | before: … / after: … | | | |
| 12 | Chrome, PWA, airplane mode | | | Samsung Calendar | | | | | | | |

## Share offered for `.ics` (`navigator.canShare`)

| Browser | Mode | "Share with a calendar app" shown on the export screen? | Apps in the share sheet | Import from the share sheet worked? |
|---|---|---|---|---|
| Chrome | PWA | | | |
| Chrome | tab | | | |
| Samsung Internet | PWA | | | |
| Samsung Internet | tab | | | |

## Alarms (cell 7)

| Calendar app | Reminder | Event time | Fired at | Sound / vibration / notification text | Pass |
|---|---|---|---|---|---|
| Samsung Calendar | 15 min | | | | |
| Samsung Calendar | 1 h | | | | |
| Samsung Calendar | 2 h | | | | |
| Samsung Calendar | none | | n/a (no reminder expected) | | |
| Google Calendar (Android) | 15 min | | | | |
| Google Calendar (Android) | 1 h | | | | |
| Google Calendar (Android) | 2 h | | | | |

## Re-import (cells 8–10)

For each changed session: "updated" (one event, new values), "duplicated" (old and new event), "unchanged" (only the old event). For a removed session: "removed", "shown as cancelled", "unchanged".

| Cell | Change | Samsung Calendar | Google Calendar (Android) | Google Calendar (web) | Notes |
|---|---|---|---|---|---|
| 8 | identical file again | | | | |
| 9 | session moved to another day | | | | |
| 9 | export time changed for a weekday | | | | |
| 10 | session removed (`STATUS:CANCELLED`) | | | | |

## Removing old events (cell 13)

| Calendar app | Steps that removed every POWR test event | Taps | Notes |
|---|---|---|---|
| Samsung Calendar | | | |
| Google Calendar (Android) | | | |
| Google Calendar (web) | | | |

## File check

- Validator used and its result (errors and warnings verbatim):
- CRLF, folding, UID host, SEQUENCE, STATUS, VALARM as expected? yes / no, details:

## Proposed wording

- Import guide, Samsung Calendar:
- Import guide, Google Calendar:
- Re-export note (duplicates and how to remove them):
- Keep `STATUS:CANCELLED` events? yes / no, because:

## Files stored next to this record

- [ ] screenshots (`docs/device-tests/<date>-s22-ics/`)
- [ ] the exported `.ics` files, named `<cell>-<app>.ics`

## Observations and open questions

-
```
