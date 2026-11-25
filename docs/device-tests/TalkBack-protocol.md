# TalkBack audit on the Galaxy S22 (protocol and results template)

| Field | Value |
|---|---|
| Validates | PRD NFR-A11Y-06 (screen readers), NFR-A11Y-11 (manual audit per major release), M12 (no open WCAG 2.2 AA failure), MAP-06; technical concept §8.14, QS-10; TD-41, TD-50, TD-64 (item 21.4) |
| Device | Samsung Galaxy S22 with TalkBack (Android Accessibility Suite) |
| Browsers | Chrome stable and Samsung Internet stable, as **installed PWA**. Repeat the items marked ★ in a browser tab |
| Build | The release candidate, served with the production headers (beta server, or Docker image with `adb reverse` as in the [S-1 protocol](S-1-protocol.md) §3) |
| Human results | `docs/device-tests/<date>-s22-talkback.md`, from the template at the end |
| Version | 1.0, 2026-11-25 (M6b): the TalkBack items of the M2b, M2c, M3t, M3b, M4v, M4b, M5d and M5s notes in `IMPLEMENTATION_NOTES.md`, the S-2 TalkBack checks and technical concept §8.14, in one ordered list; M6a's items for the manual pass (`IMPLEMENTATION_NOTES.md` "M6a quality audits") folded in, marked M6a |

## 1. Purpose

axe runs on every screen in light and dark in the component and E2E tests, and reflow is tested at 320 px and 200 % text. Since M6a an every-route sweep (`apps/web/e2e/a11y.spec.ts`) also checks a name on every control, WCAG 2.5.8 target sizes, the dock's 48 px targets and a unique page title per route. These checks cannot tell whether TalkBack reads a screen in a sensible order, announces changes once and not in a flood, or lets a user operate the SVG body map and the charts. This protocol checks that by hand on the real phone. A failed item is a WCAG 2.2 AA failure (M12) unless the notes say otherwise; it goes into the defects table and blocks row EC-09 of the [release checklist](../release/checklist.md) until it is fixed or deferred by the product owner.

## 2. Set-up

1. Install the app in **Chrome** (browser menu → Install app) and start it from the home screen. Later repeat in **Samsung Internet**.
2. Start with a fresh site: in the browser's site settings choose "Delete data" for the app's address, so the first-run screen appears.
3. Turn on TalkBack: Settings → Accessibility → TalkBack. Note the TalkBack version (TalkBack settings → About).
4. Gestures used below: **swipe right / left** = next / previous item; **double-tap** = activate; **explore by touch** = drag one finger over the screen; **reading controls** (swipe up then down, or the TalkBack menu) = move by headings, links or controls; **adjust** = swipe up or down on a slider (TalkBack's adjust gesture on recent versions; the volume keys also work).
5. Phone settings for the first pass: default font size, light theme. For section 23, the largest font size and the dark theme.
6. Have a second person or a notepad ready: write down what TalkBack *says*, not what the screen shows.

## 3. How to judge an item

An item passes when:

- every control has a name that says what it does ("More weight", "Skip rest"), and its role and state are read (button, checkbox "checked", toggle "pressed", "expanded");
- the reading order follows the visual order, top to bottom, and nothing important is skipped or read twice;
- a change that matters is announced **once** (no repeated or per-second announcements), politely, without moving focus unexpectedly;
- after an action, focus lands where the user expects (a new screen's heading, the next set's "Confirm set", the button that opened a sheet);
- nothing needs a gesture that TalkBack cannot do; every drag, swipe or pinch has a button (NFR-A11Y-04).

Write the browser in each note. Items marked ★ are also checked in a browser tab.

## 4. Checks, screen by screen

Run the screens in this order: it follows a new user's first days and needs no data set up by hand.

### Screen 1: first-run screen ("Welcome to POWR")

| # | Check | Pass when | Source |
|---|---|---|---|
| 1.1 ★ | Arrive on the first-run screen | Focus starts at the h1 "Welcome to POWR"; the two summary cards read in order with their h2 | §8.14 |
| 1.2 | Tap "Set up my plan" without ticking anything | The error summary is announced and receives focus; each error is read next to its checkbox | M5z focus fix |
| 1.3 | The two checkboxes | Read as checkboxes with their full label and state | M2b |
| 1.4 | The links "Read the full privacy notice" and "Read the full health notice" | Read as links; Back returns to this screen with focus on the link | M2b |

### Screen 2: legal screens (privacy, health notice, imprint, How POWR decides, attributions)

| # | Check | Pass when | Source |
|---|---|---|---|
| 2.1 | Privacy notice and health notice | The version line and the "Draft" box are read before the text; headings navigate by section | M5s |
| 2.2 | Imprint | The publisher block reads as one address in order; the e-mail is a link | M5s |
| 2.3 | How POWR decides: open it from a "Why?" link of a value | Focus lands on the linked value, not at the top | M5s |
| 2.4 | Attributions: the long list | Each entry's heading reads "<name> version <x>"; "Licence text" reads as a collapsed expandable control; moving by headings is practical over 37 entries | M5s |

### Screen 3: onboarding steps

| # | Check | Pass when | Source |
|---|---|---|---|
| 3.1 | Radio cards whose name includes a long description (goal, experience, presets) | Name first, then the description, then "selected" or "not selected"; not one long run-on name | M2b |
| 3.2 | Weekday and muscle chips | Read with their pressed state ("pressed" / "not pressed") | M2b |
| 3.3 | Native weekday `<select>`, date and time inputs | Each opens the system picker and reads its label and value | M2b, M2c |
| 3.4 | Baselines step: its regions and toggle groups | Each lift is a region named by the lift; the "recent set / known 1RM" toggle reads its state; the estimated 1RM is read after entry | M2c |
| 3.5 | Leave a required answer empty and continue | The error summary receives focus and is read once | M5z |
| 3.6 | `<details>` explanations ("Why?" in a step) | Read as collapsed or expanded; the content is reachable after expanding | M2b |

### Screen 4: plan preview and template choice

| # | Check | Pass when | Source |
|---|---|---|---|
| 4.1 | Reading order of the plan preview | Summary, then the days in order, then the actions; no element read twice | M2b |
| 4.2 | Open "Why?" | The sheet traps focus; its title is read; closing (button or Back) returns focus to the "Why?" button | M2b, S-2 |
| 4.3 | Template sheet: radio cards with long descriptions, "Fits your training days and your level." | As 3.1; the fit sentence is read with its card | M2c |
| 4.4 | Block-length control | Name, value and the change are read | M2c |

### Screen 5: plan, week and plan editor

| # | Check | Pass when | Source |
|---|---|---|---|
| 5.1 | Change a session's day in the week view | The schedule change is announced once | M2b |
| 5.2 | Plan editor: make a change that triggers a warning | The check summary is announced once, not on every keystroke | M2b |
| 5.3 | Reorder and move buttons | Every move has a named button ("Move up", "Move to Thursday"); no drag needed | M2b, NFR-A11Y-04 |
| 5.4 | Missed session: "Do it today", "Merge", "Skip" | Named buttons; the outcome is announced | M2b |

### Screen 6: equipment editor

| # | Check | Pass when | Source |
|---|---|---|---|
| 6.1 | Change an item and save | "Review plan changes" opens with its h1 focused and in view | M2b |
| 6.2 | The check summary | Announced once | M2b |

### Screen 7: Home

| # | Check | Pass when | Source |
|---|---|---|---|
| 7.1 ★ | Reading order | Next session, streak, mini heat map in words (the figure itself is hidden from TalkBack), body weight | M4b |
| 7.2 | Backup reminder: "Remind me later" | The reminder is read as a region with its text; after "Remind me later" focus moves to a sensible place (not lost at the top of the page) | M5d |
| 7.3 ★ | Install card (from the second visit), then "Not now" | The card reads in order with named buttons; after "Not now" focus does not get lost | M5d, S-2 |

### Screen 8: session start, check-in and proposals

| # | Check | Pass when | Source |
|---|---|---|---|
| 8.1 | Start screen: planned, freestyle, repeat | Each option is a named button with its description | M3b |
| 8.2 | Readiness check-in scales | Each scale is a group named by its question; each choice reads its value and state | M3b |
| 8.3 | Proposals | Each proposal reads its reason; "Accept" and "Keep as planned" are named | M3b |

### Screen 9: logging a workout (the control dock)

| # | Check | Pass when | Source |
|---|---|---|---|
| 9.1 | Reading order of the dock | Current exercise and set, weight stepper, reps stepper, effort chips, "Confirm set", in the visual order | M3b |
| 9.2 | Stepper buttons and fields | "Less weight", "More weight", the value with its unit; typing a value opens the numeric keypad | M3b |
| 9.3 | RIR chips | Read "0" to "4" and "5 or more" with their state | M3b |
| 9.4 | RPE chips (switch to RPE in Settings → Training first) | Read 10 to 6 and "5 or less" with their state | M5s |
| 9.5 | A suggested half-step effort (for example 1.5) | The legend that explains the half step is read with the chips | M3b |
| 9.6 | Double-tap "Confirm set" | "<exercise>, set N logged." is announced once; focus moves to the next set's "Confirm set" | M3b, §8.14 |
| 9.7 | Undo in the dock | "Undone." is announced once; focus stays usable | M3b |
| 9.8 | Set details sheet (set type, technique, flags such as "Pain or discomfort", note) | Sheet focus trap and return; checkboxes read with their state | M3b |
| 9.9 | Plate calculator and substitution sheets | Named controls; closing returns focus | M3b |
| 9.10 | Tempo cues toggle (with Settings → Workout → tempo cues on) | Read as a toggle with "pressed"; one announcement on start and one on stop; the changing phase label is not read | M4v |
| 9.11 | Timed set with the lead-in (Settings → Workout) | "Set timer starts in 3 seconds" once; Cancel is named; focus moves Start → Cancel → Stop | M4v |
| 9.12 | Settings → Workout → "Larger controls" on (56 px targets), then log a few sets with real fingers, with TalkBack off and on | Steppers, chips, "Confirm set" and the timer buttons are hit on the first try with a thumb; the names and the reading order of 9.1 are unchanged | M5s, M6a |
| 9.13 | Log a set that beats a previous best (for example more weight than last time) | The PR card appears at the top without covering the dock; the PR is announced once, in words; focus stays in the dock | M3b, M6a |

### Screen 10: rest timer and alerts during a workout

| # | Check | Pass when | Source |
|---|---|---|---|
| 10.1 | Let a real rest run to the end (at least 60 s) | The pre-alert and "Rest over" are announced **once each**; no per-second ticks | M3t, M3b |
| 10.2 | Timer buttons | "−15 seconds", "+15 seconds", "Skip rest", "Restart" | M3b |
| 10.3 | The mini timer on other screens | Named; double-tap returns to the session | M3b |
| 10.4 | Lock the screen during a rest, unlock | The resume banner and the right remaining time are read once | M3b |
| 10.5 | During a workout, close the app (recent apps → swipe away) and open it again | "Workout resumed" is read once with the workout's state; focus is not lost | M3b, M6a |
| 10.6 | Lock the screen during a rest and let it end | TalkBack reads the "Resting" and "Rest over" notifications on the lock screen with their text | M3t, M6a |

### Screen 11: workout summary

| # | Check | Pass when | Source |
|---|---|---|---|
| 11.1 | The PR card | The PR is read in words (exercise, kind, value); the animation adds nothing that must be read | M3b |
| 11.2 | The mini heat map and the streak change | The words beside the figure are read; the figure is hidden from TalkBack | M4b |

### Screen 12: past sessions

| # | Check | Pass when | Source |
|---|---|---|---|
| 12.1 | List of past sessions | Each entry reads date, name and the trend label in words | M3b, M5z |
| 12.2 | Backdated form: save with an error | The error summary receives focus and is read once | M5z |
| 12.3 | Editor with the PR preview | The preview is read before "Save" | M3b |

### Screen 13: Progress and charts

| # | Check | Pass when | Source |
|---|---|---|---|
| 13.1 | A trend chart: the summary | The visible summary under the title is read; the canvas itself is skipped | M4v |
| 13.2 | The point slider ("Points of …") | Reachable by swiping; the adjust gesture moves point by point and each value is read as the readout text | M4v, TD-50 |
| 13.3 | Range chips and "Earlier" / "Later" | Named buttons with their selected state | M4v |
| 13.4 | "View as table" | A table with caption and headers; rows read with their column names | M4v |
| 13.5 | Training calendar | Each day reads its date and state; month navigation is named | M4b |
| 13.6 | PRs, compare, scores | Filters and lists read in order | M4b |
| 13.7 | Scores: the group "Points history of" | The group label reads as the start of a sentence with the selected choice ("Points history of, <formula>"); record whether it sounds right or needs a full label | M6a |

### Screen 14: body map and muscle panel

| # | Check | Pass when | Source |
|---|---|---|---|
| 14.1 | Explore by touch over the figure | Each muscle region is read by name when the finger is over its hit area; double-tap selects it | M4v, TD-50 |
| 14.2 | The small regions as buttons below the figure | Reachable by swiping, named like the regions | M4v |
| 14.3 | QS-10: select "Hamstrings" | Its weekly sets and status are heard; then the ranked list opens and every entry is reachable by swiping | §10.2 QS-10 |
| 14.4 | The list alternative (MAP-06) | One tap from the map; the same muscles and counts | M4b |
| 14.5 | Heat-map mode and front/back switch | Named toggles with their state | M4v |
| 14.6 | Muscle panel: evidence `<details>`, "Place in plan" sheet | Expandable state read; sheet focus trap and return | M4b |
| 14.7 | Swipe right through the figure (not explore by touch), front and back | Every region is reached in reading order and read with its name and status ("Chest, 14 sets this week, In your target") and its pressed state | M4v, M6a |
| 14.8 | The group "Show the sets of" (body map and a muscle) | Reads as the start of a sentence with its choice ("Show the sets of, This week", "Last week", "4-week average"); record whether it sounds right or needs a full label | M6a |

### Screen 15: exercise library and custom exercises

| # | Check | Pass when | Source |
|---|---|---|---|
| 15.1 | Filters sheet: checkbox groups | Each group is named by its dimension; the "any of these" rule is read; checkboxes read their state | M5d |
| 15.2 | Active-filter chips and "Clear all" | Each chip names its value and that it removes it | M5d |
| 15.3 | Exercise detail | Muscles and credits are read in words; the figure is not required | M4b |
| 15.4 | Custom exercise: save with an error | The error summary receives focus and is read once | M5z |

### Screen 16: Settings

| # | Check | Pass when | Source |
|---|---|---|---|
| 16.1 | "On this page" links | Each link moves focus to its section heading | M5s |
| 16.2 | Profile rows' "Change" buttons | Each is named with its answer ("Change goal"), not a bare "Change" | M5s |
| 16.3 | One answer changed (`/settings/profile/…`): save with an error | The error summary receives focus | M5z |
| 16.4 | The re-plan preview | Reading order: "Your plan would change", the changes in words, the new plan, then "Update my plan from …", "Keep my current plan", "Back to the question" | M5s |
| 16.5 | Rest times (`/settings/rest`): steppers with their hint | Name, value and the hint ("evidence default …") are read; typed values are confirmed | M5s |
| 16.6 | Settings → Alerts: rows with descriptions (`CheckRow`), the status badge, the volume slider | **Known issue TD-41:** the description is part of the name, so names are long. Record how long and whether they are still usable. The status badge reads its words; the volume slider reads its value as a percentage when adjusted | M3t, TD-41 |
| 16.7 | Training: RIR or RPE, chips or half steps | Radio groups named; state read | M5s |
| 16.8 | Workout display: larger controls, celebrations | Switches named with their state | M5s |

### Screen 17: Data and backups

| # | Check | Pass when | Source |
|---|---|---|---|
| 17.1 | "Storage protected: Yes/No" and "Protect my data" | The status is text, not only an icon; the outcome is announced | M5d |
| 17.2 | Backup reminder cadence: radio cards | As 3.1 | M5d |
| 17.3 | Export a backup | The busy and "Saved to Downloads as …" states are announced once | M5d |
| 17.4 | Safety copies: delete one | The confirmation sheet traps focus; after deleting, focus goes to a sensible place | M5d |
| 17.5 | "Delete all data…" sheet | The typed-word field ("DELETE") has its instruction read; the two steps are clear | M5d |
| 17.6 | "All data deleted" screen | Its heading is focused and read; "Start again" is named | M5d |
| 17.7 | Safety copies: save one, then delete one | Each status line ("Saved to Downloads as …", "Safety copy deleted.") is read once | M5d, M6a |

### Screen 18: calendar export (Plan → Add to calendar)

| # | Check | Pass when | Source |
|---|---|---|---|
| 18.1 | Range, start-time and reminder choices | Groups named; the time field reads "Time for every session" (not the same name as its group) | M5d |
| 18.2 | Download the file | The result is announced and focus moves to the import guide | M5d |

### Screen 19: Device support and install

| # | Check | Pass when | Source |
|---|---|---|---|
| 19.1 ★ | Device support rows | Each row reads as heading, status in words, then the explanation | M5d, S-2 |
| 19.2 ★ | Samsung Internet only: the install steps on the card | Read in order as a list | M5d |

### Screen 20: body weight and measurements

| # | Check | Pass when | Source |
|---|---|---|---|
| 20.1 | Log form: native date and time inputs | Labels and values read; the unit is read with the value | M4b |
| 20.2 | The bodyweight chart | As 13.1–13.4 | M4b |

### Screen 21: update banners and recovery

| # | Check | Pass when | Source |
|---|---|---|---|
| 21.1 | "Update before you start?" on the start screen (needs a waiting update: run during S-8); also reached from the shortcut "Start today's workout" while an update waits (TD-64) | Read once; both choices named | M5d, M6a |
| 21.2 | "POWR was updated in another window. Reload." | Announced; the button is named | M5d |
| 21.3 | Recovery screen after a failed data update | Cannot be produced on the phone without a special build. Review the E2E screenshot `recovery-upgrade` and the component test instead; record "not run on device" | M5d |
| 21.4 | Home's start card with an update waiting and no workout running (during S-8) | "Today" reads "Update before you start?" as an h3 inside the card, then "Update first", then "Start without updating" (in place of "Start today's session"); record whether that order is clear | M6a (TD-64) |

### Screen 22: sheets and Back (everywhere)

| # | Check | Pass when | Source |
|---|---|---|---|
| 22.1 ★ | Open any sheet, then use the Android Back gesture | Back closes the sheet; focus returns to the control that opened it; the next Back leaves the screen | M5d, S-2 |
| 22.2 | Any route change | Focus moves to the new screen's h1 | §8.14 |
| 22.3 | Reading order on any screen with the bottom navigation | The bottom navigation comes last, after the screen's content and actions | M6a |
| 22.4 | Buttons with a short visible word and a longer name ("Remove", "Show", "Repeat", "Edit", "Delete…" with the item in the name) | TalkBack reads the full name, which starts with the visible word; Voice Access acts on the visible word (WCAG 2.5.3, label in name) | M6a |

### Screen 23: large text, dark theme, reduced motion, safe areas, gym light

| # | Check | Pass when | Source |
|---|---|---|---|
| 23.1 | Phone font size at its largest (Settings → Display → Font size and style) and screen zoom at its largest | Repeat 1.1, 9.1, 9.6, 16.4 and 17.5: nothing cut off, no overlapping controls, the dock still reachable | M2b (real 200 % system font scaling) |
| 23.2 | Dark theme | Repeat 7.1 and 14.1 | §8.14 |
| 23.3 | Remove animations on (Settings → Accessibility → Visibility enhancements) | PR card and transitions are static; nothing flashes | NFR-A11Y-08 |
| 23.4 | With 23.1's settings: the safe areas and the keyboard | Nothing sits under the status bar, the camera cut-out or the gesture bar; a field stays visible above the keyboard when it opens (a dock stepper, the bodyweight form, a custom exercise's name) | M6a |
| 23.5 | Gym light: bright overhead light or a window, the screen brightness as used in the gym, both themes | The dock, the rest timer and the charts' summaries stay readable | M6a |

## 5. How results feed back

- Every failed item becomes a row in the defects table of the record, with the browser and what TalkBack said. Blockers (a control without a name, a flow that cannot be completed, lost focus that strands the user) block row EC-09 of the release checklist.
- TD-41 (item 16.6) gets its fix decided from the record (checklist row T-03).
- Passed items close the TalkBack part of TD-50 and the M2b–M6a open items in `IMPLEMENTATION_NOTES.md`. Items 13.7 and 14.8 decide whether the two group labels need a full label; item 21.4 confirms the order of the TD-64 offer.

---

## Results template

Copy everything below this line into `docs/device-tests/<date>-s22-talkback.md` and fill it in.

```markdown
# TalkBack results: <date>, Galaxy S22

## Device and versions

| Field | Value |
|---|---|
| Date | |
| Tester | |
| Device model | Galaxy S22 SM-S901_ |
| One UI / Android | |
| TalkBack (Android Accessibility Suite) version | |
| Chrome version | |
| Samsung Internet version | |
| App build (Settings → About) | |
| Served from | beta server / `adb reverse` + Docker image |

## Summary per screen

| Screen | Items | Chrome PWA: pass / fail | Samsung Internet PWA: pass / fail | Tab (★ items): pass / fail | Notes |
|---|---|---|---|---|---|
| 1 First-run screen | 1.1–1.4 | | | | |
| 2 Legal screens | 2.1–2.4 | | | | |
| 3 Onboarding | 3.1–3.6 | | | | |
| 4 Plan preview | 4.1–4.4 | | | | |
| 5 Plan and editor | 5.1–5.4 | | | | |
| 6 Equipment editor | 6.1–6.2 | | | | |
| 7 Home | 7.1–7.3 | | | | |
| 8 Session start | 8.1–8.3 | | | | |
| 9 Logging (dock) | 9.1–9.13 | | | | |
| 10 Rest and alerts | 10.1–10.6 | | | | |
| 11 Summary | 11.1–11.2 | | | | |
| 12 Past sessions | 12.1–12.3 | | | | |
| 13 Progress and charts | 13.1–13.7 | | | | |
| 14 Body map | 14.1–14.8 | | | | |
| 15 Library | 15.1–15.4 | | | | |
| 16 Settings | 16.1–16.8 | | | | |
| 17 Data and backups | 17.1–17.7 | | | | |
| 18 Calendar export | 18.1–18.2 | | | | |
| 19 Device support, install | 19.1–19.2 | | | | |
| 20 Body weight | 20.1–20.2 | | | | |
| 21 Update and recovery | 21.1–21.4 | | | | |
| 22 Sheets and Back | 22.1–22.4 | | | | |
| 23 Large text, dark, motion, light | 23.1–23.5 | | | | |

## Defects

| # | Item | Browser and mode | What TalkBack said or did | Expected | Severity (blocker / major / minor) |
|---|---|---|---|---|---|
| 1 | | | | | |

## TD-41 (item 16.6)

- Longest name read in Settings → Alerts (verbatim):
- Usable as it is? yes / no. Proposed fix: `aria-describedby` for the description / keep.

## Observations

-
```
