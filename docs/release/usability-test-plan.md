# POWR usability test plan (M1–M4, M13)

| Field | Value |
|---|---|
| Version | 1.0, 2026-11-25 (M6b) |
| Purpose | Moderated usability tests before the MVP release, for the success metrics that only real users can show |
| Metrics | PRD §2.2: **M1** (taps to log a set), **M2** (time from finishing a set to a confirmed log), **M3** (onboarding completion and duration), **M4** (install to first logged workout), **M13** (SUS and motivation). M1, M3 and M4 are MVP exit criteria (PRD §10.3); M2 and M13 are in the M6 roadmap row of the technical concept (Appendix A.4) |
| Build | The release candidate on the beta server (`https://beta.<business-domain>`, after S-7) |
| Moderator | The product owner, or a person the product owner chooses |
| Results | `docs/release/usability-results-<date>.md`: the observation sheets, the metrics table and the issue log (section 8) |
| Related | [Release checklist](checklist.md) rows EC-03, EC-04, EC-05, T-11; PRD NFR-USE-01, NFR-USE-02, NFR-A11Y-03, NFR-A11Y-04 |

## 1. Goals

1. Measure M1–M4 and M13 against their targets with real lifters on real phones.
2. Find what stops or slows a first-time user between opening the URL and finishing the first workout.
3. Collect observations on two open items that wait for these tests: prompts before discarding unsaved edits in the plan and equipment editors (TD-68), and whether the body map needs the planned remainder drawn on the figure (TD-51).

## 2. Success criteria

| Metric | Target (PRD §2.2) | Measured in | How |
|---|---|---|---|
| **M1** taps to log a set done as prescribed | 1 tap (median) | T4 | Taps counted from the screen recording ("Show taps" on), from the set being ready to its confirmation |
| **M1** taps to change weight or reps | ≤ 3 taps (median) | T5 | Same |
| **M2** time from finishing a set to a confirmed log | ≤ 3 s (median), n ≥ 8 | T4, T5 and every further set | From the moment the participant puts the weight down (moderator mark in the recording) to the frame where the set shows as logged |
| **M3** onboarding completion | ≥ 90 % complete without help | T2 | Unaided completion: no hint from the moderator |
| **M3** onboarding duration, core path | median ≤ 5 min (≤ 8 min with optional steps, NFR-USE-02) | T2 | From the first-run screen to the accepted plan |
| **M4** install to first logged workout | ≤ 10 min | T1–T6 | From opening the URL to the workout summary of the first finished workout with at least one logged working set |
| **M13** perceived usability | SUS ≥ 75 (mean) | Questionnaire (section 6) | Standard SUS scoring |
| **M13** motivation | ≥ 70 % answer "motivating" or "very motivating" | Questionnaire | One five-point question |

A task counts as **completed** only without the moderator's help. An assisted task counts as not completed for M3, and its time is excluded from M4's median.

## 3. Participants

- **Number:** at least **8** (M2 asks for n ≥ 8); 10 is better, in case one session fails. Run **one pilot session** first with a person outside the sample and fix the script.
- **Training style:** at least 3 who train mainly for muscle (bodybuilding) and at least 3 who train for the competition lifts (powerlifting or powerbuilding).
- **Sex:** both represented, at least 3 women and 3 men (M13 asks for both sexes and both styles).
- **Experience:** a spread from novice (under 6 months of consistent training) to advanced (over 5 years).
- **Age:** 18 or older, to keep consent simple, although the app allows 16 and over.
- **Phone:** an Android phone the participant uses daily, with Chrome or Samsung Internet; at least 2 participants on Samsung Internet. A participant without a suitable phone uses the test S22; note it, because the phone changes the times.
- **Not eligible:** anyone who has worked on POWR, seen its screens or tested its beta.
- **Screener questions:** training style and years; sessions per week; equipment where they train; phone model and browser; whether they use a training app now (which one).

## 4. Setting and materials

- **Place:** preferably a gym, so sets, rests and sweaty hands are real. A room with a bench and a pair of light dumbbells works too; then the participant does light sets of an exercise they know.
- **Time:** 45–60 minutes per participant.
- **Materials:** the beta URL as a QR code or short link; a consent form; the screen recorder on the phone with "Show taps" on (Settings → Developer options), or a camera filming the phone and hands only; the observation sheet (section 7); a timer; the questionnaire.
- **Data:** everything the participant enters stays on their phone. At the end the moderator shows how to delete it (Settings → Data and backups → Delete all data) or to uninstall; the participant chooses.
- **Consent:** written consent to take part and to record the screen; faces are not recorded; the participant may stop at any time without giving a reason. The product owner decides on any compensation.

## 5. Tasks

The moderator reads each prompt as written and does not show where to tap. If the participant asks, the moderator answers "What would you try?". After 2 minutes without progress, or when the participant gives up, the moderator may help; the task is then "assisted".

| Task | Prompt (read aloud) | Done when | Metrics | Observe |
|---|---|---|---|---|
| **T1** Install | "Here is the address of a training app. Open it on your phone and install it so you can start it from your home screen." | POWR is on the home screen and started from there | M4 start: opening the URL | Chrome's install dialog vs Samsung Internet's menu steps; whether the install card appears (it does not on the first visit, by design) |
| **T2** Set up | "Set up the app so that it gives you a plan that fits your training. Answer as you really train." | The plan is accepted | M3 | Hesitations on goal, experience, days, equipment; the legal screen; whether the optional baselines step is used; time per step |
| **T3** Start | "It's training day. Start today's workout." | The logging screen shows the first exercise | M4 (continues) | Whether "Start today's session" on Home is found; the readiness check-in |
| **T4** Log a set as planned | "Do your first set as the app suggests. When you have finished it, record it." Repeat for two more sets | Three sets logged | **M1** (1 tap), **M2** | Whether the one tap is found; where the thumb rests; reaction to the rest timer starting by itself |
| **T5** Log a different set | "Do the next set with a different weight or number of reps than suggested, and record what you really did." | The set is logged with the changed values | **M1** (≤ 3 taps), **M2** | The steppers, typing a value, the effort chips ("reps left in the tank") |
| **T6** Finish | "That's enough for today. Finish the workout." | The workout summary shows | **M4** stop | The finish confirmation; reading of the summary and any PR |
| **T7** Body map | "You want to train your hamstrings more. Find an exercise for them that you can do with your equipment, and add it to today." (A new short session may be needed; that is fine) | The exercise is added | — (M13, US-04) | The body map or the list; Effectiveness vs Focus; the "Why?" explanation |
| **T8** Weekly volume | "How much work did your chest get this week, and is that enough?" | The participant gives an answer from the app | — (US-05) | The heat map and its legend; whether the planned remainder in words is enough (TD-51) |
| **T9** Change the plan | "Move one of next week's sessions to another day. Then change your mind and go back without saving." | The participant has tried both | — | Whether leaving without saving loses edits without a warning (TD-68) |
| **T10** Backup | "Make sure your training data is safe if you lose your phone." | A backup file is exported | — (US-16) | Whether the backup is found; understanding where the file went |

Tasks T1–T6 are timed and required. T7–T10 run if time allows, in this order.

## 6. Script

**Welcome (read aloud, about 3 minutes)**

> "Thanks for helping. We are testing a training app, not you: if something is hard, that is what we need to find. Please think aloud: say what you look at, what you expect and what surprises you. I will mostly stay quiet and won't tell you where to tap, because I want to see how the app works without me. You can stop at any time. With your permission I'll record the phone's screen and your hands, not your face. Everything you type stays on your phone, and at the end I'll show you how to delete it. Any questions before we start?"

Then: signature of the consent form; the screener answers checked; "Show taps" and the screen recorder switched on.

**Warm-up question:** "How do you plan and record your training today?"

**Tasks T1–T10** as in section 5. Between tasks the moderator notes the time and says only "Thank you. Next…".

**Debrief questions (about 5 minutes)**

1. "What was the hardest part?"
2. "What would you change first?"
3. "Was anything unclear about the suggestions, for example the weights or the 'reps left in the tank'?"
4. "Would you use this app for your own training? Why or why not?"

**Questionnaire (on paper or a form, about 3 minutes)**

1. The ten statements of the **System Usability Scale (SUS)**, each from 1 (strongly disagree) to 5 (strongly agree), in the standard wording, with "this system" read as "POWR".
2. "How motivating did you find POWR?" Not at all motivating / slightly motivating / moderately motivating / motivating / very motivating.
3. Training style, years of training, sex (optional, for the M13 breakdown).

**Close:** show "Delete all data" and uninstalling; the participant decides; thank them.

## 7. Observation template

One sheet per participant. Copy it into the results file.

```markdown
### Participant P<n>

| Field | Value |
|---|---|
| Date, place | |
| Training style, years, sessions per week | |
| Sex (optional) | |
| Phone, Android version, browser | |
| Own phone or test S22 | |
| Moderator, observer | |

| Task | Start | End | Duration | Taps (T4, T5) | M2 per set (s) | Outcome (unaided / assisted / failed / skipped) | Errors and hesitations | Quotes |
|---|---|---|---|---|---|---|---|---|
| T1 Install | | | | — | — | | | |
| T2 Set up | | | | — | — | | | |
| T3 Start | | | | — | — | | | |
| T4 Log as planned (3 sets) | | | | | | | | |
| T5 Log a different set | | | | | | | | |
| T6 Finish | | | | — | — | | | |
| T7 Body map | | | | — | — | | | |
| T8 Weekly volume | | | | — | — | | | |
| T9 Change the plan | | | | — | — | | | |
| T10 Backup | | | | — | — | | | |

- M4 (T1 start → T6 end, if T1–T6 unaided): … min
- SUS score: …  Motivation answer: …
- Debrief notes:

| # | Issue seen | Task | Severity (1 cosmetic, 2 minor, 3 major, 4 blocks the task) |
|---|---|---|---|
| | | | |
```

## 8. Analysis and results

- **SUS:** for each participant, odd statements score (answer − 1), even statements (5 − answer); the sum × 2.5 gives 0–100. Report the mean and the range.
- **Metrics table:** for M1–M4 and M13 the median (M13: the mean SUS and the share "motivating" or "very motivating"), the range, n, and pass or fail against section 2. Show M13 also by training style and by sex.
- **Issue log:** merge the issues of all sheets: issue, tasks, number of participants, highest severity, proposed fix. Every severity 3 or 4 issue becomes an agent task or a product-owner decision before release.
- **Write-up:** `docs/release/usability-results-<date>.md` with the metrics table, the issue log and the anonymised observation sheets (participant numbers only). Update rows EC-03, EC-04, EC-05 and T-11 of the [release checklist](checklist.md), and record the TD-51 and TD-68 observations for the technical concept's next docs pass.
