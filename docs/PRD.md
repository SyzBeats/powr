# POWR: Product Requirements Document

> Training planner & tracker PWA for bodybuilders and powerlifters: evidence-based, offline, no account.

## 0. Document information

| Field | Value |
|---|---|
| Title | POWR (working title): Product Requirements Document |
| Version | 0.8 |
| Date | 2026-11-25 |
| Status | Draft v0.8. All open questions resolved on 2026-11-23 (§11.1). Only validation tasks remain (§11.2). Baseline for the technical concept. |
| Owner / publisher | Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland (product owner and publisher). Drafted by the requirements agent. |
| Audience | Product owner, the technical-concept author, designers, testers |
| Sources | (1) User braindump `app.requirements.md`. (2) User answers to clarification questions (2026-11-23); these are authoritative and override the braindump where it is ambiguous. (3) Evidence base `reports/Strength and hypertrophy evidence base.md` (consolidated report, "EB"), backed by the six files in `research_notes/Strength and hypertrophy evidence base/`. (4) Platform documentation checked on 2026-11-23 (Appendix C). (5) User decisions on all open questions and publisher details, 2026-11-23 (§11.1). |
| Reference convention | `EB §<Section> › <Subsection>` points into the consolidated report, for example `EB §Load › e1RM algorithm`. `EB §Defaults › <table>` points to the consolidated default-parameter tables. `EB §Gaps #n` points to row *n* of the report's evidence-gap table. Appendix B maps every code to the exact report heading and the underlying research-note file. |
| Conventions | Requirement IDs are `<DOMAIN>-<nn>`. Priority uses MoSCoW: **Must / Should / Could / Won't**. Release tags are **MVP** (v1.0), **v1.x** (v1.1–v1.3, see §10) and **Later**. Items marked "Assumption" are defaults the requirements agent chose where the inputs say nothing. The high-impact ones were put to the user as open questions and are now decided (§11.1). |

### 0.1 Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-23 | First complete draft from braindump, clarification answers and evidence base |
| 0.2 | 2026-11-23 | All open questions OQ-01…OQ-10 resolved by the user (§11.1): pure-PWA timer-alert baseline; MVP cut confirmed; web-only distribution; **free, closed source** (new licence policy LEG-08, reworked attributions screen LEG-06, no AGPL code, scoring reimplemented from official sources); no telemetry; Chrome + Samsung Internet; percentile data and media sources re-evaluated for closed source; composite effectiveness ranking; minimum age 16; publisher Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland (revFADP/nDSG primary, GDPR to be confirmed in legal review; new LEG-09, §8.6). Affected requirements, constraints (C-09…C-15), non-goals (NG-14…NG-17), assumptions, risks (R-01 lowered; R-09 revised; R-17, R-18 new), TC-18, release plan and traceability (A.3) updated. Validation tasks listed in §11.2. |
| 0.3 | 2026-11-24 | §7.1 movement patterns extended by five joint actions already used by the content and engine (shoulder horizontal adduction/abduction, shrug, wrist flexion/extension); EXL-04 load-curve class "bench-like" renamed "equation (Wathan/RTS)" (TD-30, rename in code planned for M2b). Both approved by the product owner on 2026-11-24. |
| 0.4 | 2026-11-24 | PLN-14: time-budget rule (priority muscles keep their full target, the others fall back towards about 4 weekly sets; also for next-block proposals) with reason and fixes. EQP-02 and ONB-06: Custom (empty) opens the equipment checklist first; an empty list gives a bodyweight-only plan with the reason. Both approved by the product owner on 2026-11-24 (M2b). |
| 0.5 | 2026-11-24 | ONB-08: the main lifts are the competition lifts (powerlifting, powerbuilding) or the plan's primary compound lifts (bodybuilding), at most four, each showing its estimated 1RM. PLN-02: the override lists every template of the style and says whether it fits days and level. Both approved by the product owner on 2026-11-24 (M2c). |
| 0.6 | 2026-11-25 | TMR-12: the compact timer shows the rest or set timer, otherwise the session clock, for the whole session. WKT-03: half-step RIR is shown with the chips' label and entered in the set details. SET-03: pre-alert timing 5, 10 or 15 s, default 10 s. All approved by the product owner on 2026-11-25 (M3b). |
| 0.7 | 2026-11-25 | ANL-11: time axes support pinch-zoom with range chips and Earlier/Later buttons (instead of a range slider). MAP-01: a small region gets its own button below the figure (instead of a list fallback). MOT-03: without a plan or a weekly target, one session keeps the week. MOT-04: a skipped planned session still counts toward the week's target; merging it into another session keeps the week. BOD-02: the rate band for maintaining is ±0.25 %BW/week. ANL-04: the training max is a per-exercise value the user sets. ANL-07: a tested 1RM is the heaviest load lifted for at least one rep. Wording from the M4 implementation; all approved by the product owner on 2026-11-25 |
| 0.8 | 2026-11-25 | A-05 and EXL-01: met with 190 exercises; every display group except the optional tibialis has at least 2 exercises crediting it ≥ 0.5 under every preset with equipment; the §7.1 pattern "carry" has no exercise yet. PLN-02: bodybuilding 4 days "Upper/Lower ×2 or Full body ×4", 6 days "Push/Pull/Legs ×2 or Upper/Lower ×3"; powerlifting and powerbuilding without alternatives for now. PLN-05 and MAP-03: among exercises with equal scores, the standard variant of a movement ranks first. PWA-05: the two shortcuts built ("Start today's workout", "Log bodyweight"). DAT-08: "Remind me later" hides a due reminder for 3 days. DAT-13: a confirmation screen ("All data deleted") precedes the first run. CAL-02: the start-time choice at export includes all-day events. SET-05: RPE or RIR display and entry (records keep RIR), RIR entry by one tap per value or in half steps. SET-08: update the current plan from next week or keep it; only an answer that changes the plan asks; the new plan is shown before anything is stored. SET-09: contact by e-mail (`tools@sz-development.com`). LEG-09: a release check blocks production until the postal address is provided. Wording from the M5 implementation; all approved by the product owner on 2026-11-25 Also §8.6: the contact e-mail given by the product owner (tools@sz-development.com). |

---

## 1. Product vision and problem statement

### 1.1 Vision

POWR is a private, offline training coach for people who lift seriously. It plans the training, pre-fills every set, times rest and tempo, and tracks progress, using the best available strength and hypertrophy research. It adapts to the user's own logs and equipment. It never needs an account, a server or an internet connection, and all data stays on the phone.

### 1.2 Problem statement

Lifters who train for muscle (bodybuilding) or maximal strength (powerlifting) face three gaps:

1. **Planning gap.** Evidence-based programming means weekly volume per muscle, proximity to failure, load–rep relationships, deloads and tapers. That knowledge is scattered across papers and coaching heuristics. Most people either copy generic programs or pay a coach.
2. **Tracking gap.** Typical gym loggers record sets well, but they do little with them. They do not turn logs into next-session prescriptions, they do not separate real progress from noise, and they do not count volume per muscle correctly (for example, a set of rows also counts as half a set for the biceps).
3. **Trust and privacy gap.** Most tracking and coaching apps need an account and cloud storage, often by subscription. Their logic is usually a black box. Users who want ownership of their training and health data have few options.

### 1.3 Positioning

| Dimension | Typical gym logger | Typical subscription coaching app | **POWR** |
|---|---|---|---|
| Core value | Record sets | Generated program | Generated program **and** fast logging, linked by a transparent progression engine |
| Training logic | None or simple templates | Proprietary, rarely explained | Traceable to a documented evidence base. Every suggestion shows why it was made, and heuristics are labelled as heuristics. |
| Equipment awareness | Rare | Limited | Inventory-driven. Exercises needing equipment the user does not have are never suggested. |
| Volume per muscle | Usually counts direct sets only | Varies | Fractional sets (direct 1.0, synergist 0.5), shown on an interactive body map |
| Connectivity | Cloud account | Cloud account | Fully offline and local-first. No account. Manual backup file. |
| Privacy | Data on vendor servers | Data on vendor servers | No data leaves the device unless the user exports it |
| Audience | General | Usually one niche | Bodybuilders, powerlifters and hybrid lifters, novice to advanced, all sexes |

### 1.4 Product principles

1. **Suggest, you confirm.** The app proposes; the user always has the last word, and overriding is easy (user answer: coaching level).
2. **Evidence sets the priors, user data decides.** Population defaults come from the evidence base, and the user's own logs personalize them (`EB` title thesis).
3. **Show uncertainty and label heuristics.** Do not present practitioner conventions as facts (`EB §How to read the evidence tags`).
4. **Gym-first ergonomics.** One hand, sweaty fingers, bad gym Wi-Fi, a screen that might lock.
5. **Your data, your device.** Local-first. Export at any time. No lock-in.
6. **Motivating, never shaming.** Celebrate progress. Weekly consistency, not daily streaks, because rest days are training.

---

## 2. Goals, success metrics and non-goals

### 2.1 Goals

| ID | Goal |
|---|---|
| G1 | Give every user an evidence-based plan and per-set prescriptions that fit their goal, schedule, experience and equipment. |
| G2 | Make logging in the gym fast, one-handed and dependable, offline included. |
| G3 | Keep users consistent and motivated through visible progress, PRs, weekly adherence, achievements and progress photos. |
| G4 | Keep all data private and owned by the user: local-only, exportable, deletable. |
| G5 | Be trustworthy: transparent reasoning, evidence labels, conservative safety guardrails and clear disclaimers. |
| G6 | Feel like a native Android app by making deliberate use of PWA capabilities. |

### 2.2 Success metrics

There are no analytics or telemetry, not even opt-in (decided, OQ-05; NFR-PRIV-01). Metrics are therefore measured in one of three ways: **on-device** (computed locally and shown to the user, optionally included in a user-initiated diagnostics export), in **moderated usability tests**, or in **lab/QA tests**.

| ID | Goal | Metric | Target | How measured |
|---|---|---|---|---|
| M1 | G2 | Taps needed to log a working set performed as prescribed | 1 tap (median); ≤ 3 taps to change weight or reps | Usability test + UI spec review |
| M2 | G2 | Time from finishing a set to a confirmed log | ≤ 3 s median | Usability test (n ≥ 8) |
| M3 | G1 | Onboarding completion and duration | ≥ 90% complete; median ≤ 5 min (core path) | Moderated usability test |
| M4 | G1 | Time from install to first logged workout | ≤ 10 min | Usability test |
| M5 | G1, G5 | Suggestion quality: share of RPE/RIR-prescribed working sets whose logged RPE is within ±1 of target, from the user's fourth week onward (after calibration, PRG-08) | ≥ 70% | On-device statistic (shown in Insights; included in diagnostics export if the user chooses) |
| M6 | G1, G5 | Suggestion acceptance: share of suggested loads accepted unchanged or within one increment | ≥ 60% after 4 weeks | On-device statistic |
| M7 | G3 | Weekly adherence of active users over a mesocycle | ≥ 80% of planned sessions | On-device (user-facing); pilot cohort |
| M8 | G4 | Data safety: users with > 4 weeks of data who have a backup younger than 30 days | ≥ 70% in pilot cohort; 0 known data-loss defects at release | On-device indicator + pilot survey; QA |
| M9 | G6 | Installability and offline readiness | 100% of features in the offline checklist pass in airplane mode on the Galaxy S22 (Chrome and Samsung Internet) | QA test suite |
| M10 | G2 | Performance budgets (NFR-PERF) | All budgets met on the Galaxy S22 | Lab measurement |
| M11 | G5 | Calculation correctness | 100% of reference vectors pass (scoring, e1RM, warm-up, trend, plate math) | Automated tests (NFR-MNT-02) |
| M12 | G2, G5 | Accessibility | No open WCAG 2.2 AA failures in automated plus manual audit | Accessibility audit |
| M13 | G3 | Perceived usability and motivation | SUS ≥ 75; ≥ 70% "motivating" or "very motivating" | Post-test questionnaire (both sexes, BB and PL users represented) |

### 2.3 Non-goals (explicitly out of scope; all are "Won't")

| ID | Non-goal | Rationale |
|---|---|---|
| NG-01 | Cloud sync, user accounts, servers, multi-device live sync | User answer: backup file only. Local-first. |
| NG-02 | Food logging, food database, barcode scanning, meal plans | User answer: nutrition scope is bodyweight plus targets only |
| NG-03 | Direct writes to Samsung Calendar or Google Calendar (calendar APIs, OAuth) | User answer: one-way .ics export. No web API exists for the on-device calendar. |
| NG-04 | Android Health Connect, Samsung Health or Google Fit integration; wearables or heart-rate sensors | No web API for Health Connect or Samsung Health (§9.1) |
| NG-05 | iOS and desktop as targets | Target is Android (Galaxy S22 and other modern Android phones). The app may run elsewhere, but it is not designed or tested for it. |
| NG-06 | Camera-based velocity tracking (VBT) and automatic rep counting | No Android camera-VBT validation exists (`EB §Progression › VBT`, `EB §Gaps #12`). The counter is a timer, not a rep counter (user answer). |
| NG-07 | Social features: feeds, leaderboards, friends, public profiles | Privacy-first, no server |
| NG-08 | Coach–athlete or multi-user features; several profiles on one install | Single local profile (Assumption A-02) |
| NG-09 | Medical diagnosis, injury prediction, rehabilitation programs | Wellness scope only (§8.3). Injury risk cannot be predicted from logged load (`EB §Gaps #25`). |
| NG-10 | Languages other than English | User answer. Strings must still be externalizable (NFR-MNT-04). |
| NG-11 | Advertising, tracking, data monetization | Privacy principle |
| NG-12 | Programming for equipped powerlifting, Olympic weightlifting, CrossFit-style conditioning, or guidance on performance-enhancing drugs | Focus on raw/classic PL and BB. Equipped coefficient sets are still supported for scoring (ANL-07). |
| NG-13 | Server push, background sync and periodic background sync | No server. These are unreliable for local scheduling (§9.1). |
| NG-14 | A native wrapper or hybrid shell with native code, including one added to make lock-screen timer alerts reliable | Decided OQ-01: pure PWA (C-10) |
| NG-15 | Paid tiers, subscriptions, in-app purchases; publishing the source code | Decided OQ-04: free, closed source (C-09) |
| NG-16 | App-store distribution (Google Play, Galaxy Store) | Decided OQ-03: web URL only (C-11). A store listing would need a new decision. |
| NG-17 | Automatic telemetry, analytics or crash reporting, including opt-in variants | Decided OQ-05 (C-12). A user-initiated diagnostics export exists instead (DAT-16). |

---

## 3. Target users and personas

### 3.1 Segments

| Dimension | Covered range | Product implication |
|---|---|---|
| Training style | Bodybuilding (hypertrophy), powerlifting (squat/bench/deadlift strength), hybrid "powerbuilding" | Goal-specific templates, volume and effort defaults, PL meet features |
| Experience | Novice (< 6 months consistent training), intermediate (6 months to about 2–5 years), advanced (> 5 years or slow progression) | Progression model, increment size, amount of jargon shown, calibration period (`EB §Progression › Classification`) |
| Sex | Female and male (plus a user-chosen reference set for formulas when neither fits, see ONB-02) | Same relative progression targets. Sex-specific formula coefficients for scoring, body fat and RMR. Smaller absolute increments (`EB §Progression › Realistic progress`, `EB §Nutrition › Sex-specific`) |
| Age | 16+ (Assumption A-04), including masters lifters (40+) | Age-adjusted expectations and norms. Under-18 restrictions on nutrition and cut features (LEG-03). |
| Equipment | Commercial gym, home/garage gym, minimal (dumbbells, bands, bodyweight), travel/hotel gyms | Equipment inventory, presets and filtering |
| Device | Galaxy S22 (primary), other modern Android phones | §6.6 Compatibility |

### 3.2 Personas

**P1 · Marco, 27, bodybuilder (intermediate, male).** Three years of training in a well-equipped commercial gym, 5 days a week, about 75 minutes per session. He wants to know whether he is doing enough work for each muscle, especially his lagging side delts and calves. He alternates bulks and cuts. He takes progress photos but keeps them in his main gallery, which he dislikes. *Needs:* volume per muscle on a body map, exercise ideas ranked by effectiveness, double progression, rest timer, bodyweight trend, photo comparisons, PR celebrations.

**P2 · Lena, 31, powerlifter (intermediate–advanced, female).** Four years of training, competing in the 63 kg class (classic/raw). She trains in a garage gym with a rack, a 20 kg bar, plates including microplates, a flat bench, adjustable dumbbells up to 32 kg and bands, 4 days a week. She is used to RPE-based programming from a former coach. Her next meet is in 12 weeks and she is about 1.5 kg over the class limit. *Needs:* RPE/RIR prescriptions with e1RM-based loads, peaking and taper, attempt planning, a safe weight-class cut plan, IPF GL/DOTS points, plate calculator with microplates, heavy-set rest defaults.

**P3 · Jonas, 38, powerbuilder (advanced, male, masters-age context).** Ten years of training, with progress now measured in months. He has time for 3 sessions of 60 minutes plus an optional fourth. He travels monthly to hotel gyms with dumbbells and cables only. He has a history of knee pain and avoids deep lunges. *Needs:* strength work on the competition lifts plus hypertrophy volume, RIR-based sets, several equipment profiles, substitutions that respect equipment and an avoid list, time-budget fitting, plateau detection, honest progress trends that are not session-to-session noise.

**P4 · Aylin, 22, novice (female).** Two months of training at a university gym, 3 days a week, 45 minutes. She is unsure which exercises train which muscles and is put off by jargon. She wants to grow her glutes and get stronger. *Needs:* guided onboarding, a simple plan, a body map to discover exercises ("what trains glutes with what I have?"), plain-language RIR input ("how many more reps could you have done?"), warm-up generation, encouraging feedback, no shaming for missed sessions.

### 3.3 Jobs to be done / user stories

| ID | As a… | I want to… | So that… | Key requirements |
|---|---|---|---|---|
| US-01 | new user (any) | set up my goals, schedule and equipment in a few minutes without an account | I get a plan that fits my life and gym | ONB-01…12, EQP-01…04, PLN-01 |
| US-02 | lifter mid-workout | see exactly what to lift next and log it with one tap | I keep my rhythm and my log stays complete | WKT-02, WKT-03, PRG-03 |
| US-03 | lifter resting | get a rest timer that starts by itself with a sensible default and alerts me | I don't over- or under-rest, even when I look at another app | TMR-01…06, PWA-06 |
| US-04 | bodybuilder (P1) | tap a muscle on a body map and see the best exercises I can do with my equipment | I can fix lagging body parts | MAP-01…04, EXL-05 |
| US-05 | bodybuilder (P1) | see my weekly sets per muscle against evidence-based targets | I know whether I'm doing too little or too much | ANL-03, MAP-04, PLN-03 |
| US-06 | powerlifter (P2) | prescribe sets as reps @ RPE and have the load computed from my current e1RM | my loads auto-regulate to how strong I am today | PLN-07, PRG-01, PRG-05 |
| US-07 | powerlifter (P2) | generate a peaking block and attempts for my meet date | I arrive at the platform peaked, with sensible attempts | PLN-16, PLN-17, ONB-09 |
| US-08 | powerlifter (P2) | plan my weight-class cut safely | I make weight without hurting my performance | BOD-09, BOD-08 |
| US-09 | advanced lifter (P3) | see whether my strength trend is really changing, not just noise | I make decisions based on real signals | PRG-02, ANL-02 |
| US-10 | travelling lifter (P3) | switch my equipment profile and get valid substitutions | I can train anywhere without re-planning | EQP-06, WKT-08 |
| US-11 | novice (P4) | get warm-up sets, plate loading and plain-language guidance | I train safely and learn as I go | WKT-06, WKT-07, NFR-USE-03 |
| US-12 | any lifter | have PRs detected and celebrated, and keep a weekly consistency streak | I stay motivated | MOT-01…04 |
| US-13 | any lifter | answer a short readiness check before training and get a lighter session when I'm wrecked | I train productively on bad days | RDY-01…03 |
| US-14 | any lifter | get a deload when I need it and a sensible ramp-in after a break | I avoid stalling and come back safely | PRG-11…13 |
| US-15 | any lifter | put my planned sessions into my phone's calendar | my calendar reminds me to train | CAL-01…05 |
| US-16 | any lifter | back up everything to a file and restore it on a new phone | I never lose years of training data | DAT-05…08 |
| US-17 | physique-focused lifter | track bodyweight trend, measurements, and protein/calorie targets for my bulk or cut | I hit my body-composition goals | BOD-01…07 |
| US-18 | any lifter | compare progress photos side by side, stored privately | I see changes the scale doesn't show | MOT-07, MOT-08 |
| US-19 | any lifter | install the app and use it like a native app: icon, shortcuts, screen stays on, vibration | it feels part of my phone | PWA-01…14 |

---

## 4. Scope overview

The product has 17 functional domains (§5) built around one core loop:

```
Onboarding → Equipment & profile → Plan (mesocycle) → Workout session (log + timers)
      ↑                                                          ↓
      └──── Progression engine (e1RM, suggestions, deloads) ←────┘
                     ↓
      Analytics · Body map · Motivation · Bodyweight & nutrition · Calendar export
                     ↓
      Data management (local storage, backup/restore)  ·  Settings  ·  PWA integration
```

The requirement format used in §5 and §6 is:

> **ID · Title** · *Priority* · *Release*
> Description.
> - Acceptance criteria (Given/When/Then or checkable bullets)
> - *Ref:* evidence base or related requirements

"Configurable default" means the value ships as versioned data (PRG-18), can be overridden by the user where stated, and carries an evidence label.

---

## 5. Functional requirements

### 5.1 Onboarding and local profile (ONB)

**ONB-01 · Welcome and safety gate** · Must · MVP
On first launch the app explains what it is: offline, no account, data on the device. The user must acknowledge the health disclaimer and the privacy summary, and confirm the age requirement, before any training content is shown.
- Given first launch, when the user has not acknowledged the disclaimer (LEG-01) and confirmed age (LEG-03), then no plan generation or training screens are reachable.
- The privacy summary states in at most 3 sentences that data stays on the device and is only exported by the user. It links to the full notice (LEG-02).
- The acknowledgement is stored locally with a timestamp and the disclaimer version. If a later app version changes the disclaimer, the user acknowledges again.

**ONB-02 · Units and body data** · Must · MVP
The app captures: unit system (kg or lb for loads and bodyweight; cm or in for lengths), sex, birth year, height and current bodyweight.
- Sex options are "female", "male" and "prefer not to say". The last option asks which reference set (female or male coefficients) to use for scoring, body-fat and RMR formulas and for norms, or lets the user skip. Features that need a reference set show an inline prompt until one is chosen.
- Units can be changed later (SET-02) without data loss or rounding drift (NFR-REL-07).
- Bodyweight entered here becomes the first bodyweight log entry (BOD-01).
- *Ref:* `EB §Scoring`, `EB §Nutrition › Sex-specific`.

**ONB-03 · Goal and training style** · Must · MVP
The user picks a primary style: **Bodybuilding** (hypertrophy), **Powerlifting** (squat, bench and deadlift strength) or **Powerbuilding** (both). Optionally they pick a body-composition phase: bulk, cut, maintain or not tracking.
- The selection drives template choice (PLN-02), volume, rep, RIR and rest defaults (PLN-03, PLN-07, TMR-02) and dashboard emphasis.
- Each option shows a one-sentence description and an example week.

**ONB-04 · Experience and recent history** · Must · MVP
The app captures: consistent training age (< 6 months, 6–24 months, 2–5 years, > 5 years), time since the last regular training (≤ 1 week, 1–2 weeks, 2–4 weeks, 1–2 months, > 2 months), familiarity with RPE/RIR (none, some, experienced), and optionally current weekly sets per muscle group ("about how many hard sets per week for chest/back/legs…").
- Training age seeds the trainee level (PRG-10). Time off seeds the return-from-break ramp (PRG-13). RPE familiarity sets the default prescription mode and the RIR input style (SET-05).
- If current weekly volume is given, starting volume is the user's recent volume, capped at 1.2× (PLN-03).
- *Ref:* `EB §Progression › Classification`, `EB §Defaults › Volume` (starting volume).

**ONB-05 · Schedule and session budget** · Must · MVP
The app captures: training days per week (2–6), which weekdays, a preferred start time per training day (used for calendar export), and a session length budget (30, 45, 60, 75, 90 or 90+ minutes).
- The generated plan respects the chosen weekdays (PLN-11) and the time budget (PLN-14).
- The start time is optional. Without it, calendar export creates all-day events or uses a default time the user picks at export (CAL-02).

**ONB-06 · Equipment setup** · Must · MVP
The user picks a gym preset (EQP-02) and then refines a checklist of equipment (EQP-01), including load details such as bar weight, plate pairs, dumbbell range and stack increments (EQP-03).
- At least one preset can be confirmed without editing in ≤ 3 taps.
- After this step, every exercise the app suggests is executable with the selected equipment (EQP-04).
- With Custom (empty), the checklist comes first and the plan follows from it (EQP-02).

**ONB-07 · Priorities and exclusions** · Should · MVP
The user can mark up to 3 priority muscles and add exercises or movement patterns to avoid (injury or dislike, for example "deep knee flexion under load").
- Priority muscles receive volume in the upper part of their target band and are placed earlier in sessions (PLN-03, PLN-06).
- Avoided exercises and patterns never appear in generated plans, substitutions or "best exercises" lists unless the user explicitly shows them (EXL-08).

**ONB-08 · Baseline strength and calibration fallback** · Must · MVP
Optionally, for the main lifts of the plan, the user enters a known 1RM or a recent set (weight × reps, plus RPE/RIR if known). The main lifts are the competition lifts for powerlifting and powerbuilding and the plan's primary compound lifts for bodybuilding, at most four. Each entry shows the estimated 1RM it gives. If they skip this, the app plans a calibration period instead.
- Given baselines are entered, the first-session loads derive from them (PRG-05).
- Given baselines are skipped, the first exposure to each exercise prescribes conservative effort (target RIR 3–4). The user picks a starting load with plate-calculator help. e1RM is established from the logged sets (PRG-08).
- Entering a 1RM older than 3 months shows a hint that it will be refined automatically.

**ONB-09 · Competition details (powerlifting)** · Should · MVP (captured) / v1.x (used)
For the Powerlifting and Powerbuilding styles, the user can optionally enter: next meet date, weigh-in type (2-hour or 24-hour), target weight class, division (classic/raw or equipped, for scoring) and federation name (free text).
- In MVP the data is stored, editable and shown as a countdown on the dashboard. In v1.x it drives peaking (PLN-16), attempts (PLN-17) and cut planning (BOD-09).
- A meet date less than 4 weeks away shows a notice that a full peaking block cannot be generated, with the option of a short taper.

**ONB-10 · Plan proposal and confirmation** · Must · MVP
Onboarding ends with a generated plan preview: split, weekly calendar, per-muscle weekly volume, session duration estimates and progression model. The user can accept, adjust key parameters (days, duration, style) and regenerate, or open the plan editor (PLN-09).
- The preview shows *why* each key choice was made, for example "Upper/Lower because you train 4 days and want both strength and size".
- Accepting creates the active mesocycle and schedules the sessions.

**ONB-11 · System setup step** · Must · MVP
A final optional step explains and offers: installing the app (PWA-02), allowing notifications for timer alerts (PWA-08), persistent storage (DAT-03), and how backups work (DAT-05, DAT-08).
- Each permission is requested only after an explanation and a user tap, never automatically on page load.
- Declining any of them leaves the app fully usable. The consequences are explained in one sentence each.

**ONB-12 · Resumable, skippable, revisitable** · Must · MVP
Onboarding progress is saved after each step and resumes after interruption. Optional steps can be skipped. A "Just let me log" path skips plan generation and goes to freestyle mode (PLN-15). Every answer can be changed later in Settings (SET-08).
- Killing the app mid-onboarding and reopening it resumes at the same step with the earlier answers kept.
- The core path (ONB-01…06, 10) can be completed in ≤ 5 minutes by a first-time user (M3).

**ONB-13 · Single local profile** · Must · MVP
The app holds one local profile per installation. No account, e-mail or sign-in exists anywhere in the product.
- No screen asks for e-mail, password, phone number or name. A display name is optional and stays local.
- *Assumption A-02:* single profile. Multiple profiles are out of scope (NG-08).

### 5.2 Equipment inventory (EQP)

**EQP-01 · Equipment catalog** · Must · MVP
The app provides a structured catalog of gym equipment that the user can check off. It covers at least:
- **Bars:** Olympic barbell, women's bar, technique bar, EZ bar, trap/hex bar, safety squat bar, swiss/multi-grip bar.
- **Racks and benches:** power rack or squat stand, flat bench, adjustable incline bench, decline bench, preacher bench.
- **Free weights:** plates, microplates/fractional plates, dumbbells (fixed set or adjustable), kettlebells.
- **Cables and machines:** cable station (single/dual), lat pulldown, seated row, leg press, hack squat, Smith machine, leg extension, seated leg curl, lying leg curl, chest press, pec deck/fly, shoulder press machine, hip thrust machine, standing and seated calf raise machines, hip abduction/adduction, glute-ham raise/45° back extension, reverse hyper.
- **Bodyweight and accessories:** pull-up bar, dip station, rings, landmine, resistance bands, weighted belt (dip belt), sled.
- **Cardio:** treadmill, bike, rower, elliptical (used only for later cardio features).
- Each item has an icon and a plain-language name. Searching finds items by name and common synonyms (for example "hex bar" finds trap bar).

**EQP-02 · Gym presets** · Must · MVP
Presets pre-select typical equipment: **Commercial gym (full)**, **Home/garage gym (barbell)**, **Dumbbells and bench**, **Bodyweight and bands**, **Hotel gym** and **Custom (empty)**.
- Choosing a preset and confirming takes ≤ 3 taps. Every preset can be refined.
- Choosing **Custom (empty)** opens the equipment checklist (EQP-01) before a plan is generated. If the list is saved empty, the plan uses bodyweight exercises only and says why. A strength style that needs a barbell gets no plan; the app gives the reason and offers to change the equipment or the style.

**EQP-03 · Load-relevant equipment details** · Must · MVP
Where the load matters, the inventory captures details used for prescriptions, rounding and the plate calculator:
- Bars: weight per bar type (defaults 20 kg / 45 lb Olympic, 15 kg / 35 lb women's, editable).
- Plates: denominations and number of pairs per denomination, in kg or lb, independent of the display unit. Collar weight (default 0, comp collars 2.5 kg each).
- Microplates: denominations (for example 0.25 / 0.5 / 1.25 kg).
- Dumbbells: a list of available weights, or an adjustable range with an increment.
- Kettlebells: a list of available weights.
- Cable and machine stacks: the stack increment and optional add-on weights, set per machine type with a default.
- Bands: labels with optional nominal resistance. They are used as "assisted" or "accommodating" resistance and are not used for e1RM.
- Given a plate inventory of 2×20, 2×10, 2×5, 2×2.5, 2×1.25 kg and a 20 kg bar, the largest loadable barbell weight is 97.5 kg, and the plate calculator never proposes a load that needs more plates than exist (WKT-07).

**EQP-04 · Availability filtering guarantee** · Must · MVP
Generated plans, suggested substitutions, "best exercises" lists (MAP-02) and auto-generated warm-ups only include exercises whose equipment requirements are fully met by the active equipment profile.
- Every built-in exercise lists its equipment requirements as "all of" and "any of" groups, for example "barbell + plates + (power rack or squat stand)".
- The exercise browser has an "available only" filter, on by default. When the user shows all exercises, unavailable ones are visibly marked with the missing item named.
- Automated test: for each gym preset, no generated plan contains an unavailable exercise. Validated for 100% of presets × styles × days/week combinations.

**EQP-05 · Equipment change impact** · Should · MVP
When equipment is removed or changed, the app lists affected exercises in the current plan and proposes equipment-valid substitutions (WKT-08). The user confirms each one, or all at once.

**EQP-06 · Multiple equipment profiles** · Should · v1.x
The user can keep several named equipment profiles (for example "Garage", "City gym", "Hotel"), choose a default, and pick the active profile when starting a session.
- Starting a session with a profile that lacks a planned exercise's equipment offers substitutions for that session only (WKT-08).

**EQP-07 · Custom equipment items** · Should · MVP
The user can add a custom equipment item (name, optional load details) and reference it in custom exercises (EXL-04).

### 5.3 Exercise library and muscle mapping (EXL)

**EXL-01 · Built-in exercise library** · Must · MVP
The app ships a curated library (content requirements in §7.1), with at least 150 exercises at MVP (Assumption A-05). Every major muscle group must be trainable with at least 2 exercises under every gym preset.
- Content validation test: every exercise has a muscle mapping, equipment requirements, movement pattern, mechanics (compound or isolation), load type and default rep-range class. The build fails otherwise.
- Coverage test: for each preset in EQP-02 and each body-map muscle group (§7.2), at least 2 available exercises credit that muscle ≥ 0.5.
- Status (content 0.3.0): met with 190 exercises. Every display group except the optional tibialis has at least 2 exercises crediting it ≥ 0.5 under every preset with equipment. The §7.1 movement pattern "carry" has no exercise yet (technical concept TD-65).

**EXL-02 · Browse, search and filter** · Must · MVP
The user can browse the library and filter by muscle, equipment, movement pattern, mechanics and "available only". They can also search by name and synonyms.
- Search results appear within 100 ms of typing (local data).
- Filters combine with AND logic. Active filters are visible and clearable in one tap.

**EXL-03 · Exercise detail** · Must · MVP
Each exercise has a detail view with: execution cues (3–6 short bullets including ROM guidance, see `EB §Session › ROM`), muscles worked with credits and evidence tags (EXL-05), required equipment, default rep range and rest class, the user's history, PRs and current e1RM, and variants or substitutes.
- Muscles are shown on a mini body map, with primary and secondary muscles in distinct styles that do not rely on color alone.
- The evidence tag is visible and explained on tap, for example "Squats don't count toward hamstrings (MRI evidence)".

**EXL-04 · Custom exercises** · Must · MVP
The user can create custom exercises from scratch or by copying a built-in one. Fields: name, equipment requirements, muscle credits (1.0 / 0.5 / 0.25 / 0), movement pattern, mechanics, load type (barbell, dumbbell per hand, machine/stack, bodyweight + added, bodyweight-assisted, band, time-based), unilateral flag, increment, default rep range and rest class, and load-curve class for e1RM (equation (Wathan/RTS) / leg-press-like / pooled).
- Custom exercises behave like built-in ones in plans, logging, e1RM, volume counting, the body map and backups.
- Custom exercises are marked "custom", so the evidence ranking (MAP-03) treats them as unrated unless the user rates them.
- *Ref:* `EB §Gaps #5` (exercise-class priors).

**EXL-05 · Muscle contribution model** · Must · MVP
Every exercise maps to muscles with a set credit: **1.0** primary/direct, **0.5** synergist/indirect, optionally **0.25** (labelled "unvalidated convention"), or 0. Each mapping carries an evidence tag (H = hypertrophy data, EMG = activation only, C = convention) and a source ID.
- Weekly volume is reported in two ways: **fractional sets** (Σ sets × credit; the default display) and **direct sets** (credit = 1.0 only).
- A set counts as a hard set only if it is a working set (not a warm-up) and its RIR is ≤ 4, or unknown. Sets of more than 20 reps count only if RIR ≤ 2. The thresholds are configurable defaults.
- Advanced-technique sets are credited per the technique credit table (WKT-04).
- Sub-regions (for example triceps long head vs lateral/medial head, or quads vasti vs rectus femoris) roll up to their parent muscle for display (§7.2).
- *Ref:* `EB §Volume › Fractional counting`, `EB §Session › Mapping`, `EB §Defaults › Volume`, `EB §Volume › Proximity to failure`, `EB §Gaps #6`.

**EXL-06 · Mapping overrides (advanced)** · Could · v1.x
Advanced users can override an exercise's muscle credits. Overrides are marked as user-defined, can be reset to default, and apply to past and future volume calculations.

**EXL-07 · Variants, substitution groups and competition lifts** · Must · MVP
Exercises are linked into substitution groups (same main muscles and pattern) and variant families. Squat, bench press and deadlift are flagged as **competition lifts**, and their close variants (paused, tempo, pin, deficit, block, close-grip…) are flagged "variant of".
- For powerlifting strength tracking, sets of the competition lift and its close variants count as direct strength volume for that lift. Other exercises count ≤ 0.5 (`EB §Volume › Fractional counting`).
- Competition lifts have fixed-ROM semantics (`EB §Session › ROM`).

**EXL-08 · Favorites, hidden and avoided exercises** · Should · MVP
The user can mark exercises as favorite (preferred by the generator and ranking), hidden (removed from lists), or avoided (never generated, never suggested, as in ONB-07).

**EXL-09 · Exercise setup memory** · Should · MVP
For each exercise the user can store setup notes (for example "seat 4, pin 3, wide grip"). They are shown automatically whenever the exercise appears in a session.

**EXL-10 · Exercise media** · Could · v1.x
Exercises may get illustrations or short animations in v1.x. Decided (OQ-08, re-evaluated for closed source): MVP ships original text cues plus muscle highlighting on the body map, with no exercise images.
- For v1.x, media are preferably commissioned with a written transfer or exclusive licence of rights covering distribution in the app.
- Third-party datasets are used only if permissively licensed (for example CC0, CC BY or public domain) and approved in licence review. Share-alike (for example CC BY-SA) or non-commercial content is excluded by default (LEG-08).

### 5.4 Interactive body map (MAP)

**MAP-01 · Interactive front and back body map** · Must · MVP
The app shows an anatomical figure with front and back views. The muscle groups of the taxonomy in §7.2 are individually tappable regions. Tapping a region selects it, highlights it and opens its exercise list (MAP-02).
- Front/back toggle is one tap. Tapped regions show a clear selected state. Each region's tap target is ≥ 44×44 CSS px, or a button for it is offered below the figure (small regions; the full list alternative is MAP-06).
- The figure follows the light/dark theme with contrast meeting NFR-A11Y-05.

**MAP-02 · Muscle → ranked exercise list** · Must · MVP
Selecting a muscle lists exercises that credit it, **filtered to the active equipment profile** (EQP-04) and excluding avoided/hidden exercises (EXL-08). The list is ordered by **Effectiveness** (default) or **Focus** (toggle).
- Each list item shows: name, credit for this muscle (primary/secondary), effectiveness rating with an explanation on tap, evidence tag, and the user's last performance if any.
- Given the user selects "Biceps" with the "Dumbbells and bench" preset, then all listed exercises are executable with dumbbells and/or a bench, and the curl variants rank above rows.
- An "include unavailable" toggle shows the other exercises, greyed out, each labelled with the missing equipment.

**MAP-03 · Transparent ranking model** · Must · MVP
Ranking uses documented, data-driven criteria. Decided (OQ-09 = A, 2026-11-23): a transparent composite score with an explanation on tap, plus a separate "Focus" sort.
- **Focus:** primary credit first, then the selected muscle's share of the exercise's total credit (more isolated = higher).
- **Effectiveness:** a composite of (a) credit for the muscle, (b) evidence strength of the mapping (H > EMG > C), (c) whether the exercise loads the muscle at long lengths (stretch emphasis, `EB §Session › ROM`, `EB §Session › Exercise selection`), (d) suitability for progressive overload (stable, loadable), and (e) sub-region coverage. Weights are configurable data (PRG-18). Ties are broken by the user's favorites and history. Among exercises still tied, the standard variant of a movement ranks first (for example the dumbbell shoulder press before the Arnold press).
- Tapping the rating shows the contributing factors in plain language, for example "Seated leg curl: primary for hamstrings; trains them in a stretched position (hypertrophy study evidence)".
- *Ref:* `EB §Session › Exercise selection`, `EB §Session › Mapping`, `EB §Session › ROM`.

**MAP-04 · Weekly volume heat map** · Must · MVP
A heat-map mode colors each muscle region by **fractional hard sets** for the selected week (default: current week to date, plus the planned remainder as a hatched or outlined overlay), relative to the user's target band.
- Bands follow `EB §Defaults › Volume`: below floor (< 4), below target, in target (default 10–20 or the user's custom band), high (20–30), very high (> 30). The legend explains each band. Colors come from a color-blind-safe sequential palette, and a pattern or label distinguishes "below floor" and "very high" (NFR-A11Y-10).
- Tapping a region in heat-map mode shows fractional and direct sets, the target, and the contributing exercises.
- A toggle switches between "this week", "last week" and "4-week average".

**MAP-05 · Actions from the map** · Should · MVP
From a muscle's exercise list the user can add an exercise to today's session, add it to a plan day (opens PLN-09), or open the exercise detail.

**MAP-06 · Accessible list alternative** · Must · MVP
Everything the body map offers is also available as an accessible list of muscles (grouped front/back), with the same counts and navigation. The map regions are focusable and labelled for screen readers.

**MAP-07 · Sub-region drill-down** · Should · v1.x
For muscles with evidence-supported sub-regions (§7.2), the user can drill down, for example from triceps to the long head, to see sub-region exercise rankings and volume.

**MAP-08 · Selectable body figure** · Could · v1.x
The user can choose a female, male or neutral figure. MVP ships one neutral figure (Assumption A-15). All figures are original or commissioned artwork with full rights (OQ-08, LEG-08).

**MAP-09 · Recovery, soreness and pain overlays** · Could · Later
Optional overlays show per-muscle soreness from check-ins (RDY-05) and pain-log regions (RDY-04). They are labelled "estimate" or "self-reported" (`EB §Monitoring › Recovery`, `EB §Gaps #10`).

### 5.5 Program and plan generation and editing (PLN)

**PLN-01 · Plan generation from the profile** · Must · MVP
From the onboarding data (style, experience, days and weekdays, time budget, equipment, priorities, exclusions, baselines, meet date) the app generates a mesocycle plan. Every generated plan must satisfy these constraints:
1. **Equipment:** only available, non-avoided exercises (EQP-04, EXL-08).
2. **Volume:** each trained muscle lands in its weekly target band (PLN-03).
3. **Frequency:** each trained muscle gets ≥ 2 sessions per week when days ≥ 3 (hypertrophy goals). Each competition lift, or a close variant, appears 2–3× per week when days ≥ 3 (strength goals) (PLN-04).
4. **Per-session cap:** soft cap of about 11 fractional sets per muscle per session. For strength, about 2–3 direct heavy sets per lift per session before adding frequency (PLN-04).
5. **Time:** the estimated duration of each session is within the user's budget, with ≤ 10% tolerance (PLN-14).
6. **Recovery spacing:** hard sessions for the same muscle or lift follow the spacing defaults where the weekday pattern allows, and violations are flagged (PLN-04).
7. **Exercise coverage and order** rules are applied (PLN-05, PLN-06).
8. **Prescriptions:** rep ranges, RIR/RPE targets and rest defaults suit the goal (PLN-07, TMR-02).
9. **Deload:** the mesocycle ends with a deload week (PLN-08).
- Generation is deterministic: the same inputs and content version always give the same plan.
- An automated test matrix (styles × experience levels × 2–6 days × time budgets × presets) checks all constraints. Soft-cap and spacing violations are allowed only when the inputs make them unavoidable, and they are then flagged.
- *Ref:* `EB §Defaults › Volume`, `EB §Defaults › Session`, `EB §Defaults › Monitoring` (spacing).

**PLN-02 · Goal-specific splits and templates** · Must · MVP
The generator picks a split appropriate to style and days per week, and the user can override it. Minimum set:

| Days/week | Bodybuilding | Powerlifting | Powerbuilding |
|---|---|---|---|
| 2 | Full body ×2 | Full body SBD ×2 | Full body ×2 |
| 3 | Full body ×3 | SBD ×3 (heavy/light/moderate) | Full body ×3 |
| 4 | Upper/Lower ×2 or Full body ×4 | SBD 4-day (each lift 2×+) | Upper/Lower (strength + hypertrophy days) |
| 5 | Upper/Lower + PPL hybrid or Full body ×5 | SBD 5-day | UL + PPL hybrid |
| 6 | Push/Pull/Legs ×2 or Upper/Lower ×3 | SBD 6-day (advanced) | PPL ×2 with strength days |

- Powerlifting templates use a block/phase structure with within-week undulation (heavy/moderate/light days) by default. Bodybuilding templates may use any model; the default is double progression (`EB §Progression › Periodization`).
- Novices get fewer exercises per session (≤ 5 working exercises) and the simplest progression (PRG-06 or PRG-04).
- The override lists every template of the user's style and says whether it fits the training days and level; a template for other days asks the user to change the days.
- Where a cell names two splits ("… or …"), the first is the default and the second an alternative in the override. Powerlifting and powerbuilding have no alternatives for now.

**PLN-03 · Weekly volume targets per muscle** · Must · MVP
Each muscle has a weekly target band in fractional hard sets.
- **Hypertrophy (BB, and PB accessory muscles):** default 10–20, floor 4, high band 20–30, soft warning above 30, hard warning above 40 (`EB §Defaults › Volume`).
- **Starting point:** if the user reported or logged recent volume, start at that volume, at most 1.2×. Otherwise novices start in the lower part of the band and intermediate/advanced users mid-band. Priority muscles go in the upper part and de-prioritized muscles at the floor or maintenance level (`EB §Volume › Individual response`, `EB §Gaps #8`).
- **Strength (PL competition lifts):** default 4–10 direct heavy sets per lift per week (≥ 80% 1RM, 1–6 reps), practical minimum 3–6. Accessories are counted toward muscle volume.
- If the app displays MEV/MAV/MRV, they are labelled "coaching heuristic (RP), not research-derived", compared against **direct** sets, and off by default (`EB §Volume › RP landmarks`, `EB §Gaps #7`).
- The user can edit targets per muscle (SET-07). Edits are flagged when they fall outside the evidence bands.

**PLN-04 · Frequency, spacing and per-session caps** · Must · MVP
The generator and the editor apply these rules:
- ≥ 2 sessions per muscle per week for hypertrophy.
- 2–3 sessions per competition lift per week for strength.
- About 11 fractional (about 8 direct) sets per muscle per session as the hypertrophy soft cap, and about 2–3 direct heavy sets per lift per session for strength.
- Hard sessions for the same muscle or lift are spaced at least 24–48 h apart for non-failure work, and 48–72 h after failure or high-volume work.
- Breaking a rule produces a soft, non-blocking warning worded as "low expected return per extra set" or "consider another day", never "junk volume" (`EB §Volume › Per-session returns`).
- *Ref:* `EB §Volume › Frequency`, `EB §Defaults › Volume`, `EB §Defaults › Monitoring`.

**PLN-05 · Exercise selection rules** · Must · MVP
The generator selects exercises by:
- **Equipment and avoid filters** (EQP-04, EXL-08).
- **Coverage rules for hypertrophy**, applied where equipment allows: quads get a squat/press pattern plus a knee extension; hamstrings get a hip hinge plus a knee-flexion curl (seated preferred), and squats are not counted for hamstrings; triceps get an overhead extension plus a pressdown or press; elbow flexors get at least one curl; glutes get a deep squat or hip thrust.
- **Stretch-position preference** among comparable options.
- **Competition lifts:** they stay in every block for strength styles, and variation goes into accessory slots.
- **Stability:** the exercise selection is fixed within a mesocycle, and 1–2 exercises per muscle are rotated between mesocycles (PLN-13). Random variation is only available as an opt-in "variety mode".
- **Ties:** among exercises with equal scores, the standard variant of a movement ranks first (for example the dumbbell shoulder press before the Arnold press).
- *Ref:* `EB §Session › Exercise selection`, `EB §Session › ROM`, `EB §Defaults › Session`.

**PLN-06 · Exercise ordering** · Must · MVP
Default order within a session: (1) priority and specificity lifts (competition lifts; exercises for user-flagged priority muscles), (2) multi-joint, heaviest and most technical first, (3) single-joint, (4) optional cardio last.
- The user can drag to reorder freely. A soft warning appears only if a tracked strength-goal lift is moved behind other work for the same muscle (`EB §Session › Order`).

**PLN-07 · Load prescription modes** · Must · MVP
Each exercise slot in a plan uses one of these modes:

| Mode | Example | Load source |
|---|---|---|
| Fixed | 3 × 10 @ 40 kg | Absolute |
| Percentage | 5 × 3 @ 82.5% | % of the current e1RM or of a user-set training max/tested 1RM (user choice per plan) |
| RPE/RIR | 4 × 5 @ RPE 8 (= RIR 2) | Computed from e1RM (PRG-05) |
| Rep range + RIR (double progression) | 3 × 8–12 @ RIR 1–2 | Last performance (PRG-04) |
| Top set + back-offs | 1 × 3 @ RPE 8, then 3 × 5 @ −10% or @ RPE 7 | Top set from e1RM; back-offs relative to the logged top set |
| AMRAP | 1 × AMRAP @ 75% (optionally "stop at RIR 1") | Percentage or fixed |
| Timed | 3 × 45 s hold | Time (TMR-09) |
| Technique slot | Drop set, myo-reps, rest-pause, cluster | Per technique (WKT-04) |

- RIR and RPE are interchangeable (RPE = 10 − RIR, half-points allowed). The display follows the user's preference (SET-05) (`EB §Load › RTS chart`).
- Default rep ranges and effort targets by goal: hypertrophy 6–15 reps for compounds and 8–20 for isolation at RIR 1–2, with RIR 0 allowed only on the last set of isolation or machine work. Strength main work is ≥ 80% 1RM (1–6 reps) at RPE 6–9, with no failure on competition lifts, and accessories at 6–12 reps (`EB §Defaults › Volume`).
- APRE presets (3RM/6RM/10RM) are optional · Could · v1.x (`EB §Progression › Progression rules`).

**PLN-08 · Mesocycle structure, periodization model and deload week** · Must · MVP
A plan consists of mesocycles of N accumulation weeks plus 1 deload week. The default is 4–6 accumulation weeks, and the user can choose 3–8. The periodization model (linear, daily/weekly undulating, block) can be selected per plan, with style-specific defaults (PLN-02).
- Deload week content follows PRG-11.
- The plan view shows week numbers, the current week, the deload week and (for PL) phase labels (accumulation, intensification, taper).
- *Ref:* `EB §Progression › Periodization`, `EB §Progression › Deloads`, `EB §Defaults › Deloads`.

**PLN-09 · Plan editor with live validation** · Must · MVP
The user can add, remove and reorder training days, exercises and sets; change prescriptions; swap exercises; and edit targets. While editing, a live panel shows:
- Weekly fractional and direct sets per muscle against the target band (also as a mini heat map).
- Per-session soft-cap and spacing warnings.
- Estimated duration per session against the budget.
- Validation never blocks saving. Warnings are dismissible and are not shown again for the same plan state.
- Editing the active plan asks whether changes apply from the next session or from the next mesocycle.

**PLN-10 · Template library and user templates** · Should · MVP
The app ships the templates from PLN-02. The user can save any plan as a personal template, duplicate plans, and start a new plan from a template, which is then adapted to the current equipment, with substitutions proposed.

**PLN-11 · Scheduling, rescheduling and missed sessions** · Must · MVP
Sessions are scheduled on the chosen weekdays (Assumption A-03). The user can move a session to another day, swap two sessions, or train a session early. When a planned session is missed, the app offers: do it today (shifting the rest of the week), skip it, or merge key work into the next session. It never silently drops planned work.
- Week boundaries follow the user's week-start setting (SET-11).
- Moving sessions updates spacing warnings (PLN-04) and the calendar export content (CAL-04).

**PLN-12 · Planned breaks** · Should · MVP
The user can declare a break (vacation, illness, life event) with a start and an optional end date. During a break, sessions are not counted as missed and the streak is paused (MOT-04). On return, the return-from-break ramp applies (PRG-13).

**PLN-13 · Next-mesocycle generation** · Should · MVP
At the end of a mesocycle the app proposes the next one. It carries over e1RMs, rotates 1–2 exercises per muscle (keeping competition lifts and user-locked exercises), adjusts volume targets in small steps based on the previous block (PRG-16, v1.x), and re-evaluates the trainee level (PRG-10). The user reviews and confirms.

**PLN-14 · Session duration estimate and time budget** · Must · MVP
Every planned and in-progress session shows an estimated duration. The estimate is the sum over sets of (reps × rep duration + rest after set), plus warm-up time and transitions per exercise. Once data exists, the user's logged rest times replace the defaults (`EB §Session › Duration & time-cap`).
- Plans exceeding the budget by > 10% are flagged with concrete fixes (fewer sets on lowest-priority slots, supersets, technique sets), see WKT-17.
- When the session budget cannot fit every muscle's weekly target, the user's priority muscles keep their full target and the other muscles fall back towards the evidence minimum of about 4 weekly sets per muscle (`EB §Volume › Minimum & maintenance`). Without priorities, the muscles the template emphasises keep theirs. The same rule applies to every next-block proposal (PLN-13). The plan states the reason (time budget) and offers concrete fixes: the session length that would fit, or another training day.

**PLN-15 · Freestyle mode** · Must · MVP
The user can log sessions without an active plan by choosing exercises ad hoc. Progression suggestions (PRG-03) still work from history, and volume, PRs and analytics work as usual.

**PLN-16 · Powerlifting peaking and taper generator** · Should · v1.x
Given a meet date of 8 weeks or more away, the app generates a meet-prep block. Default for 8–10 weeks:
- Accumulation (highest volume, about 70–82%), then intensification (volume falling about 20–30% per block, intensity rising to heavy triples, doubles and singles at 85–92%+).
- Last heavy singles (about 90–92.5%) 7–10 days out for squat and deadlift, and about 5–7 days out for bench.
- A 7–14-day taper with volume −40–60% and intensity maintained.
- Last session 2–4 days out. Avoid ≥ 5 days without bench and ≥ 7 days of total rest. Accessories removed about 2 weeks out. No deload stacked directly before the taper.
- For meets 4–7 weeks out, a shortened version is generated (intensification + taper). Under 4 weeks, only a taper.
- Every percentage is an editable preset labelled "based on surveyed elite practice, not trials".
- *Ref:* `EB §Progression › Tapering & attempts`, `EB §Defaults › Deloads`, `EB §Gaps #9`.

**PLN-17 · Meet attempt planner** · Should · v1.x
The planner computes the projected best per lift (current smoothed e1RM, adjusted for the taper by +0–3%) and proposes attempts: opener about 90–92% of the projected best (ideally a weight already hit for a triple or an easy single), second attempt +4–6%, third attempt +2–4% (up to about 100–102%).
- It warns about attempt jumps > 20 kg (men), or a proportionally scaled amount for lighter lifters.
- Attempts round to 2.5 kg (or the federation increment the user sets). Attempts and the projected total show IPF GL/DOTS points (ANL-07).
- On meet day the user can record outcomes (good/no lift, RPE) and adjust the next attempt (see PLN-20 for a full meet-day mode).
- *Ref:* `EB §Progression › Tapering & attempts`.

**PLN-18 · Minimum-dose and maintenance mode** · Could · v1.x
A mode for busy or maintenance phases. Hypertrophy: about 4–6 hard sets per muscle per week at 0–2 RIR. Powerlifting: 3–6 heavy sets per lift per week. Maintenance: about 1/3 of normal volume, ≥ 1 session per week, with load and effort kept (`EB §Volume › Minimum & maintenance`).

**PLN-19 · Cardio sessions and interference warnings** · Could · Later
The user can schedule and log cardio (modality, duration, intensity zone). The planner shows soft warnings for cardio within 6 h of lower-body lifting and for cardio placed before lifting in the same session. Stronger warnings apply only during peaking blocks (`EB §Session › Concurrent`, `EB §Gaps #24`).

**PLN-20 · Meet-day mode** · Could · Later
A dedicated meet-day screen with a warm-up schedule built backwards from the estimated flight start time, attempt cards, attempt-change decisions, and a results log.

### 5.6 Workout session (WKT)

**WKT-01 · Start a session** · Must · MVP
The user can start today's planned session (one tap from Home), any other planned session, an empty freestyle session, or a repeat of a past session.
- If a readiness check-in is enabled, it appears first and can be skipped (RDY-01).
- If more than 7 days have passed since a lift was last trained, the return-from-break adjustment is proposed (PRG-13).
- Only one session can be in progress at a time. Trying to start a second offers to resume or finish the first.

**WKT-02 · Session screen** · Must · MVP
The session screen shows the exercise list and progress, with the **current set** in focus. For the current set it shows the prescribed load, reps and RIR/RPE pre-filled (PRG-03), the "last time" performance, setup notes (EXL-09), the rest timer, and the session clock.
- Primary actions (confirm set, adjust weight/reps/RIR, start/skip rest) sit in the lower 60% of the screen (NFR-A11Y-03).
- Weights and reps render at ≥ 1.5× body text size.
- The screen works in portrait at 360–480 dp widths without horizontal scrolling.

**WKT-03 · Set logging** · Must · MVP
Logging a set records: load, reps, RIR or RPE (half-points allowed), set type (WKT-04), completion state, timestamp and, optionally, a note, a pain flag (RDY-04) and a "failed rep" marker.
- **One tap** confirms a set performed exactly as prescribed (M1).
- Changing the weight uses steppers sized to the exercise's increment (EQP-03), or a numeric keypad. Changing reps uses a stepper or keypad. RIR uses chips (0, 1, 2, 3, 4, 5+). A half-step value (for example a suggested 1.5) is shown with the chips' label; half steps are entered in the set details. Novice wording: "How many more reps could you have done?" (SET-05).
- After confirming, the rest timer starts (TMR-01), PRs are evaluated (MOT-01), the next set's suggestion updates if autoregulation applies (PRG-05), and the set is durably saved (NFR-REL-01).
- Reps and load cannot be negative. Implausible entries (for example > 3× the current e1RM, or > 100 reps) ask for confirmation.

**WKT-04 · Set types and advanced techniques** · Must · MVP (core) / Should · MVP (techniques)
- **Set types:** warm-up, working, top set, back-off, AMRAP, failure (flag), timed.
- **Techniques:** drop set (with drops), rest-pause (activation + mini-sets), myo-reps (activation + mini-sets), cluster (intra-set rest), lengthened partials (standalone, or appended after failure), superset/circuit membership (WKT-05).
- Volume credit follows the configurable technique credit table: warm-up 0; drop +0.5 per drop (cap 2.0); rest-pause +0.33–0.5 per mini-set (cap 2.0); myo +0.33 per mini-set (cap 2.5); cluster block 1.0; standalone partials 1.0; appended partials +0.25 (cap 1.25). These credits are labelled "heuristic" in the UI.
- Warm-up sets are excluded from volume, e1RM, PRs and progression metrics.
- Advanced techniques are not suggested to novices (< 3–6 months) by default, and drop sets are never suggested on competition lifts.
- *Ref:* `EB §Session › Techniques`, `EB §Defaults › Session`, `EB §Gaps #14`.

**WKT-05 · Supersets and circuits** · Should · MVP
The user can group 2 or more exercises into a superset or circuit. The session then alternates exercises, and rest follows TMR-13.
- The generator only proposes supersets in time-saver contexts (WKT-17). It avoids pairing two heavy strength-priority multi-joint lifts for powerlifters (`EB §Session › Techniques`).

**WKT-06 · Warm-up ramp generator** · Must · MVP
For each exercise the app proposes warm-up sets from the working weight, the target reps, whether this is the first exercise for the movement pattern, the bar weight and the plate inventory:
- **Heavy/strength work** (≤ 5 reps or ≥ about 80% e1RM): empty bar × 8–10 (if barbell), then 40% × 5, 60% × 3, 75% × 2 and 85% × 1. Add 92–95% × 1 when the working weight is ≥ about 90% e1RM.
- **Hypertrophy compounds** (6–15 reps): bar × 8–10 (if barbell), 40–50% × 6–8, 70% × 4, and optionally 85% × 2.
- **Isolation, or a muscle already warmed up:** 1 × 8–12 at about 50%, or skip. The second and later exercises on the same pattern get 1 feeder set × 3–5 at about 70%.
- Loads are rounded to achievable loads. Steps below bar weight, or within about 5% of the previous step, are dropped. Warm-up reps are never ≥ working reps at loads ≥ 70%.
- Warm-up sets are editable and skippable, have short default rests (30–60 s, then 1–2 min before the first working set), and are flagged as warm-ups (excluded from metrics).
- An optional general warm-up prompt (5–10 min easy cardio) can appear at session start. No static stretching is prompted by default.
- *Ref:* `EB §Session › Warm-up`, `EB §Defaults › Session`. Unit tests validate the ramp against these rules (NFR-MNT-02).

**WKT-07 · Plate calculator and load rounding** · Must · MVP
For barbell exercises the app shows the plates per side for the target load, using the actual bar, collars and plate inventory, loaded heaviest plates first. If the target cannot be loaded exactly, it offers the nearest loads below and above. Dumbbell, kettlebell and stack exercises round to the available weights.
- Given bar 20 kg, collars 0, one pair each of 20 / 10 / 5 / 2.5 / 1.25 kg plates (the EQP-03 example), and target 61 kg, then the app shows "61 kg not loadable" with the options **60 kg** (20 per side) and **62.5 kg** (20 + 1.25 per side).
- Given the same inventory and target 101 kg, then the app shows the maximum loadable weight of **97.5 kg** and says why.
- The calculator never shows a combination that needs more plates than the inventory holds.
- A reverse mode (tap the plates you've loaded, see the total) exists.
- All suggested loads anywhere in the app (PRG-03, WKT-06, PLN-17) go through the same rounding service. Rounding direction is "nearest, ties down" by default and configurable (SET-05).

**WKT-08 · Exercise substitution** · Must · MVP
During a session or in the plan, the user can swap an exercise for an equipment-valid alternative from the same substitution group or targeting the same primary muscles. Alternatives are ranked as in MAP-03.
- Scope choice: "this session only" or "for the rest of the mesocycle".
- When the new exercise has no history, its starting load comes from a related exercise's e1RM if a documented conversion exists (Could). Otherwise the calibration approach applies (PRG-08).
- Volume and targets are recalculated immediately.

**WKT-09 · Modify the session on the fly** · Must · MVP
During a session the user can skip a set or exercise, add sets or exercises, reorder exercises, and change prescriptions. Skipped work is recorded as skipped, not deleted, for adherence and analytics.

**WKT-10 · Notes** · Must · MVP
Notes can be attached to a session, an exercise-in-session or a set. The last session's exercise note is shown the next time the exercise appears.

**WKT-11 · Unilateral, bodyweight and assisted exercises** · Must · MVP
- **Unilateral exercises** log reps per side, either as one value for both sides or as separate left/right values (user choice per exercise). A set completed on both sides counts as one set for volume (Assumption A-18).
- **Bodyweight-loaded exercises** (pull-up, chin-up, dip) log added load. Their e1RM uses bodyweight + added load (the latest bodyweight trend value) when the exercise is flagged "bodyweight-loaded". **Assisted variants** log the assistance as negative load.
- Pure bodyweight exercises (for example push-ups) use rep-based progression and no e1RM (Assumption A-19).

**WKT-12 · Undo** · Must · MVP
After any set confirmation, deletion or skip, an undo option is available for ≥ 10 seconds and is reachable one-handed. Undo restores the exact prior state, including timers and PR states.

**WKT-13 · Finish session and summary** · Must · MVP
Finishing a session shows a summary: duration, sets completed versus planned, volume by muscle (mini heat map), PRs (MOT-02), e1RM changes, adherence impact on the weekly streak, and an optional session note. An unfinished session can be finished as "partial", or discarded with confirmation.
- Finishing releases the wake lock (PWA-06) and stops the timers.

**WKT-14 · Interruption recovery** · Must · MVP
An in-progress session survives app backgrounding, screen lock, process kill, device restart and browser updates. On reopening, the app restores the session at the current set, with the timers correct (TMR-04).
- Test: kill the app process after confirming set N, reopen, and verify that set N is present and the session resumes at set N+1.
- A session left open for more than 6 hours triggers a prompt on the next open: "Finish session at last logged set?"

**WKT-15 · Edit past sessions and backdated logging** · Must · MVP
The user can edit or delete any past session, exercise or set, and can log a session for a past date. All derived data (e1RM, PRs, volume, streaks, achievements) is recomputed consistently (NFR-REL-03).
- Editing a set that produced a PR shows the effect ("this will remove a PR") before saving.

**WKT-16 · In-session guardrails** · Should · MVP
The app shows non-blocking hints when:
- per-muscle fractional sets in this session exceed about 10–12;
- the user logs RIR 0 (failure) on a heavy free-weight compound (squat, deadlift, heavy bench): "failure adds 24–48 h recovery and gives no strength benefit";
- rest on a competition lift is < 2 min;
- a set's total rep duration exceeds 8–10 s (tempo work), suggesting the set is too slow.
- Hints can be turned off individually.
- *Ref:* `EB §Volume › Per-session returns`, `EB §Volume › Proximity to failure`, `EB §Session › Tempo`.

**WKT-17 · Time-cap mode** · Could · v1.x
When a session's estimate exceeds the time remaining (user-entered "I have 40 minutes" or the budget), the app proposes, in order:
1. Antagonist or non-competing supersets.
2. Final isolation sets converted to drop sets or myo-reps.
3. Warm-ups trimmed to the minimal rules.
4. Isolation rest shortened to 60–90 s, with a volume-load note.
- Rest on strength-priority competition lifts is never shortened below 2 min (`EB §Session › Duration & time-cap`).

**WKT-18 · Session RPE** · Could · v1.x
The app optionally asks for a session RPE (CR-10) about 15–30 minutes after the session; a late entry is flagged. It computes session load (sRPE × minutes) for the training-load analytics (ANL-09) (`EB §Monitoring › Load metrics`).

### 5.7 Timers: rest, set/tempo and session clock (TMR)

User answer: the "counter" is a set of timers, not a rep counter.

**TMR-01 · Auto-start rest timer** · Must · MVP
Confirming a working set starts the rest timer automatically, using the default for the exercise and context (TMR-02) or the user's per-exercise override (TMR-03). Auto-start can be switched off globally or per exercise.
- Warm-up sets start a short warm-up rest (TMR-02). The last set of the last exercise does not start a timer.

**TMR-02 · Evidence-based rest defaults** · Must · MVP
Default rest durations, as configurable data (`EB §Defaults › Session`, `EB §Session › Rest`):

| Context | Default | Allowed range |
|---|---|---|
| Strength sets (≤ 5 reps, ≥ about 80–85% 1RM), competition lifts and close variants | 3:00 (squat/deadlift 4:00) | 2:30–5:00 |
| Hypertrophy, multi-joint compound | 2:30 | 2:00–3:00 |
| Hypertrophy, single-joint/small muscle | 1:30 | 1:00–2:00 |
| Short-rest/time-saver mode | 1:00 | 0:45–1:15 |
| Superset between A and B | 0:15–0:30 | 0:00–1:00 |
| Novice (≤ 6 months) | 1:30 compound / 1:00 isolation | — |
| Warm-up steps | 0:30–1:00 light; 1:00–2:00 before first working set | — |

- The user can change any default (SET-03). Values outside the allowed range are accepted with a brief note.

**TMR-03 · Timer controls and per-exercise overrides** · Must · MVP
While resting, the user can add or remove 15 s, skip, or restart. A change can be saved as the new default for that exercise ("remember for this exercise").

**TMR-04 · Timestamp-based correctness** · Must · MVP
All timers derive their state from start timestamps and target durations, not from counting ticks. The displayed time is always correct after backgrounding, screen lock, app switching, process kill or reload.
- Given a 2:30 rest started at T, when the app is backgrounded or locked for 60 s and then brought back, then it shows 1:30 ± 1 s within 500 ms of becoming visible.
- Given the rest ended while the app was hidden, when the app becomes visible, then it shows "Rest over · +0:42" (time since the end) and a non-intrusive alert.
- Timer state survives process kill (persisted with the session, WKT-14).
- Device clock or time-zone changes during a session do not corrupt timers or session timestamps (NFR-REL-05).

**TMR-05 · Rest-end alerts while visible** · Must · MVP
When the app is visible and rest ends, the app alerts with a visual state change, a sound (if enabled) and vibration (if enabled and supported), within 1 s of the target time. An optional pre-alert can fire at 10 s and/or a 3-2-1 countdown.
- Sounds respect the in-app volume setting. Alerts are multimodal (NFR-A11Y-09).

**TMR-06 · Rest-end alerts while hidden or locked** · Must · MVP (baseline decided: OQ-01 = A)
When the screen is locked or the app is backgrounded, the user must still be alerted when rest ends, as reliably as the platform allows. **Decided baseline (OQ-01 = A, 2026-11-23):** the app stays a pure PWA with no native wrapper (C-10, NG-14). It keeps the screen awake during workouts, alerts with sound and vibration while visible, sends a best-effort notification while hidden, and shows an honest status note in settings. The technical concept implements and validates this baseline (§9.4 TC-03).
- **Baseline:** during an active workout the screen is kept on by default (PWA-06), so the visible-state alerts of TMR-05 apply most of the time.
- **When hidden:** the app attempts a system notification with vibration at rest end if notification permission is granted and the platform allows it (PWA-08).
- The app documents its actual behavior on the current browser in Settings → Alerts ("Alerts while screen is locked: Supported / Limited / Not supported"), based on capability detection and validated device tests. It must never imply reliable lock-screen alerts where they aren't.
- Acceptance is defined by a device test protocol on the Galaxy S22 (Chrome and Samsung Internet): screen locked, app backgrounded, battery saver on/off, 60 s / 3 min / 5 min rests. Results are recorded in the capability matrix (PWA-13). This test is a **mandatory validation item** before MVP release (§11.2 V-01).

**TMR-07 · Count-up ("ready when ready") mode** · Should · MVP
As an alternative to a countdown, the user can choose a count-up timer with a soft minimum (default 60 s isolation / 90 s compound), after which a gentle cue fires (`EB §Session › Rest`).

**TMR-08 · Actual rest logging** · Should · MVP
The actual rest before each set (from the previous set's confirmation to this set's confirmation, or from timer data) is stored with the set. It is used for duration estimates (PLN-14) and future personalization.

**TMR-09 · Set timer for timed sets** · Must · MVP
For timed sets (planks, isometric holds, loaded carries, paused reps practice), the user starts a set timer as a countdown to the target time or as a stopwatch, with an optional 3-2-1 lead-in. The achieved duration is logged as the set's result.
- Start and stop are large controls (≥ 48 CSS px). The timer can also stop automatically at the target with an alert.

**TMR-10 · Tempo cues** · Should · MVP
Exercises can carry a tempo prescription in the format eccentric–bottom pause–concentric–top pause. The default is "2-0-X-0" for hypertrophy work (X = maximal intent), and the strength default is "controlled down, explosive up". Optional paused-rep cues include, for example, a 2 s pause on the chest.
- When enabled, an audio and/or haptic metronome cues each phase.
- Tempo fields warn when the total rep duration is > 8–10 s.
- Time under tension is not a progression metric (`EB §Session › Tempo`).

**TMR-11 · Session clock** · Must · MVP
The session clock shows elapsed workout time from session start, plus the estimated remaining time (PLN-14). It is visible in the session header and in the session summary (WKT-13).

**TMR-12 · Global mini timer** · Must · MVP
While a session runs, a compact timer stays visible on every screen of the app (for example while browsing exercise history): the running rest or set timer, otherwise the session clock, with a one-tap return to the session.

**TMR-13 · Superset rest logic** · Should · MVP
Within a superset, a short transition timer runs between exercises A and B (default 0:15–0:30). The normal rest runs after the last exercise of the round.

**TMR-14 · Short-rest volume hint** · Could · v1.x
When rest is ≤ 60 s and reps on later sets fall by more than 20–25% compared with set 1, the app suggests "rest longer or add a set" (`EB §Session › Rest`).

**TMR-15 · Standalone quick timer** · Could · v1.x
A standalone interval/stopwatch timer is available outside sessions, for example from an app shortcut (PWA-05).

### 5.8 Progression and autoregulation engine (PRG)

User answer, coaching level: **"suggests, you confirm"**. The app generates the plan, pre-fills the next weights, reps and sets, and proposes deloads and tapers from the logs (e1RM, RIR/RPE). The user can always override.

**PRG-01 · e1RM per set** · Must · MVP
For every qualifying working set the engine computes an estimated 1RM: effective reps = reps + RIR (RIR = 10 − RPE), then a rep-max equation on the effective reps.
- The default equation is Wathan (equivalent to the RTS chart). Epley and Brzycki can be selected in advanced settings, and Lombardi, Lander and O'Conner are not exposed. A single at RIR 0 gives e1RM = load (`EB §Defaults › Load`, `EB §Gaps #4`).
- **Set weighting:** 1.0 if RPE ≥ 8 and effective reps ≤ 8; 0.5 if RPE 7–7.5 or effective reps 9–12; ≤ 0.1 or excluded if RPE ≤ 6 or effective reps > 12–15. Sets after the first working set are down-weighted. The session e1RM per exercise is the weighted top-set estimate (`EB §Load › e1RM algorithm`).
- **Sets without RIR/RPE** are handled by the configurable rule in `EB §Defaults › Load` ("assume 2–3 or mark non-informative"). The engine specification must settle the default (see §7.8 E-1).
- **Exercise-class load curves:** bench-like, leg-press/machine lower-body and pooled. They are replaced by the user's own fitted curve as data accrue (`EB §Load › Reps at %1RM`, `EB §Gaps #5`).
- Warm-ups, band-resisted sets, timed sets and pure bodyweight sets produce no e1RM.
- Tests reproduce the implied %1RM values for the supported equations at 1–20 reps (`EB §Load › Rep-max equations`) and the RTS table (`EB §Load › RTS chart`).

**PRG-02 · Current e1RM and noise-aware trend** · Must · MVP
Per exercise, the engine keeps a smoothed current e1RM using measurement noise of about 3–5% for heavy, low-rep, high-RPE sets and about 8–10% for typical sets. It labels changes as **"likely real"** when the change exceeds about 1 typical error and persists for ≥ 2–3 sessions, and as **"very likely real"** when it exceeds about 2.8 typical errors (about 6–9% for trained lifters, 11–15% for novices).
- The engine tracks a **strength e1RM** (preferring effective reps ≤ 6–8) separately from **rep PRs**.
- e1RM jumps that coincide with a change in typical rep range are flagged as possibly artifactual. Any RPE ≥ 9 single or triple refreshes the per-exercise correction factor.
- For the first 4–8 weeks of a novice's data, trends are shown with wider uncertainty bands.
- *Ref:* `EB §Load › Real change`, `EB §Load › e1RM drift`, `EB §Defaults › Load`.

**PRG-03 · Next-session suggestions ("suggest, you confirm")** · Must · MVP
Before and during each session, every set's load, reps and effort target is pre-filled according to its prescription mode (PLN-07) and progression rule (PRG-04…07). The user confirms or changes it. Overrides are recorded but never treated as errors.
- Suggestions are computed offline in ≤ 200 ms per session (NFR-PERF).
- An exercise can be put in "manual" mode, where the app pre-fills the last performance without progression.

**PRG-04 · Double progression** · Must · MVP
Default for accessories and hypertrophy work. Given a rep range (for example 8–12) and a target RIR, when all working sets reach the top of the range at or above the target RIR, then the next session adds the smallest available increment and resets to the bottom of the range. Otherwise the load stays and reps are targeted up.
- Example: 3 × 8–12 @ RIR 2 at 30 kg. Logged 12/12/12 at RIR 2–3, so the next session suggests 32.5 kg × 8 (with 2.5 kg increments).
- *Ref:* `EB §Progression › Progression rules`, `EB §Defaults › Progression`.

**PRG-05 · RPE/RIR-based load selection and in-session autoregulation** · Must · MVP
Default for main lifts (intermediate and above). Suggested load = current e1RM × %1RM for (target reps + target RIR), rounded through the load-rounding service (WKT-07).
- **In-session:** when a top set's logged RPE differs from target, the back-off loads (and, in RPE mode, the next set) adjust by the %1RM difference implied by the RPE gap. One RPE point is about 2.3–3.3% of 1RM (`EB §Load › RTS chart`). The adjustment is shown as a suggestion with its reason.
- Example: target 5 @ RPE 8 (effective reps 7) with e1RM 150 kg gives about 121 kg (Wathan 80.6%; 121.7 kg at the RTS chart's 81.1%), rounded per inventory, for example 120 kg with 2.5 kg total steps, or 121 kg with 0.25 kg microplates. If the top set is logged at RPE 9, the back-offs drop by about 2.5–3%.
- Leg press and machine lower-body lifts use their exercise-class curve or the user's fitted curve (PRG-01).
- *Ref:* `EB §Load › e1RM algorithm`, `EB §Defaults › Load`, `EB §Defaults › Progression`.

**PRG-06 · Percentage/linear progression with stall rule** · Must · MVP
Default for novices on main lifts, and available to anyone. Load rises by a fixed increment per session or week. After 2 failed sessions (prescribed reps not achieved), the load resets by 5–10% and rebuilds. The stall rule is labelled a practitioner convention (`EB §Defaults › Progression`).

**PRG-07 · Increment sizing and load rounding** · Must · MVP
Increments scale with trainee level and equipment:
- **Novice:** +2.5–5 kg lower body / +1–2.5 kg upper body per session.
- **Intermediate:** about +1–2.5% per week.
- **Advanced:** progress mainly through reps, sets and RPE, with load jumps every 2–4 weeks.
- Microplates are used when available. When planned increases exceed the user's observed e1RM trend, the engine switches to rep/RPE-based progression.
- Women and lighter lifters get the same relative progression and smaller absolute increments.
- *Ref:* `EB §Progression › Progression rules`, `EB §Progression › Realistic progress`.

**PRG-08 · Calibration for new users and new exercises** · Must · MVP
When no reliable e1RM exists for an exercise, the first 1–2 exposures prescribe a target RIR of 3–4. The user chooses a starting load with guidance ("pick a weight you could lift about 12 times"). An e1RM is established from those sets, and normal progression starts after calibration.
- Novices see a short explanation of RIR during calibration.

**PRG-09 · Explanations and overrides** · Must · MVP
Every suggestion (load, reps, deload, adjustment) has a "Why?" explanation in plain language that names the rule and the data used, for example "Last time 3 × 12 @ RIR 2 → top of range reached → +2.5 kg". Where relevant, it links to the evidence label (LEG-05).
- The user can accept, edit, or choose "keep as last time".
- Explanations exist for 100% of suggestion types (checked in the UI spec).

**PRG-10 · Trainee level classification** · Should · MVP
The engine classifies the user as novice, intermediate or advanced from training age. Once ≥ 8 weeks of data exist it adds the observed e1RM slope on the main lifts (≥ 1%/week novice-like; 0.25–1% intermediate; < 0.25% advanced), and optionally relative strength as a tiebreaker. The level determines the progression model and increments.
- The level is re-evaluated each mesocycle. The user can override it. Returning lifters showing novice-like rates are not demoted in volume tolerance (`EB §Progression › Classification`, `EB §Gaps #15`).

**PRG-11 · Planned deloads** · Must · MVP
A deload week is scheduled at the end of each mesocycle: every 4–6 weeks by default, user-adjustable from 3 to 8. Deload content: same exercises and frequency; sets −40–60%; target RIR +2–3; load held at 85–100% (or −10–20% for higher-rep work); accessories optionally dropped. Complete rest is not the default deload for strength users.
- The user can postpone a deload by 1 week (once per mesocycle), or skip it with a note.
- The deload week is labelled "based on practitioner surveys and expert consensus" (`EB §Progression › Deloads`, `EB §Defaults › Deloads`, `EB §Gaps #9`).

**PRG-12 · Reactive deload triggers** · Should · MVP
The engine proposes to bring the scheduled deload forward when any 2 signals occur:
- e1RM or reps at a fixed load declining for ≥ 2 consecutive sessions on a main lift;
- readiness in the "low" range for ≥ 3 days (RDY-02);
- pain flags on the same region (RDY-04, once available).
- The proposal explains the signals. The user can accept, postpone, or dismiss. No extra deload is added on top of a scheduled one. In meet prep the taper replaces the deload.

**PRG-13 · Return-from-break adjustment** · Should · MVP
Based on the days since a lift or muscle was last trained:

| Break | Adjustment |
|---|---|
| ≤ 7 days | Resume the plan; first top set autoregulated by RPE |
| 8–14 days | Session 1 at about 90–95% of previous working loads, +1 RIR; back to plan within 1–2 weeks |
| 15–28 days | Week 1 at about 85–90% load and 60–70% of usual sets; week 2 at 90–95%; re-estimate e1RM from the first sessions |
| 5–8 weeks | Ramp over 3–4 weeks from about 75–85% load and about 50% volume ("re-entry" mesocycle) |
| > 2–3 months | Rebuild e1RMs through submaximal calibration (PRG-08); expect fast regain (4–8 weeks) |

- The app warns about extra soreness for the first 1–2 sessions after > 10 days off. Percentages are editable presets labelled as inferences (`EB §Progression › Breaks`, `EB §Defaults › Deloads`).

**PRG-14 · Plateau and unusual-progress detection** · Should · v1.x
The engine flags a "plateau" when the smoothed e1RM slope on a lift is ≤ 0 over 8–12 weeks, and suggests options: variation, volume change, a deload, or rep-range change. It flags "faster than expected" when the slope exceeds about 2× the expectation band, which may mean a measurement artifact or technique change (`EB §Progression › Realistic progress`, `EB §Defaults › Expectations`).

**PRG-15 · RIR calibration loop** · Should · v1.x
The app occasionally (opt-in, at most once per exercise per mesocycle) prescribes a last-set AMRAP or a "call RIR, then continue to failure" set on suitable exercises (not heavy competition lifts near failure). It stores reported versus actual RIR per user and exercise class, and applies the running bias (with its uncertainty) to future e1RM estimates.
- Default correction: none for reported RIR ≤ 2 in trained users; +0.5–1 for reported RIR ≥ 3 until personal data replace it (`EB §Load › RIR accuracy`, `EB §Defaults › Load`).

**PRG-16 · Volume adaptation between mesocycles** · Should · v1.x
At the end of a mesocycle the engine proposes per-muscle volume changes in small steps, based on performance trends, readiness and soreness, and adherence. It never proposes increases above 1.2× the recent volume, and it judges outcomes over several weeks (`EB §Volume › Individual response`, `EB §Gaps #8`).

**PRG-17 · Load-change awareness** · Could · v1.x
A neutral "bigger jump than usual" note appears when weekly per-lift or per-muscle volume load or hard sets exceed the 4-week average by > 20–30%. It is never labelled as an injury-risk score, and no ACWR risk zones are shown (`EB §Defaults › Monitoring`, `EB §Gaps #11`, `EB §Gaps #25`).

**PRG-18 · Parameter tables as versioned data with evidence labels** · Must · MVP
All training-logic parameters live in versioned data tables, not in code. These include rest defaults, volume bands, RIR targets, technique credits, warm-up steps, deload/taper/return presets, increments, readiness thresholds, scoring coefficients, nutrition defaults and ranking weights. Each row carries an evidence tag, a source ID and a `verified` flag, per `EB §Defaults` and `EB §How to read the evidence tags`.
- Parameter-table versions are recorded with every generated plan and suggestion, so outcomes can be traced to the parameter version.
- Preprint-derived values (`EB §Gaps #1`) ship with `verified = false` until rechecked.
- The UI can show the evidence label of any parameter-driven default (LEG-05).

### 5.9 Readiness, recovery and pain (RDY)

**RDY-01 · Pre-session readiness check-in** · Should · MVP
An optional check-in of ≤ 30 s before a session. Items: sleep hours, sleep quality, energy/fatigue, general soreness (with optional per-muscle soreness), stress, motivation and Perceived Recovery Status (0–10). It uses large sliders or chips.
- It can be skipped per session and turned off globally. Skipping never blocks training.
- *Ref:* `EB §Monitoring › Readiness`, `EB §Monitoring › Sleep & stress`.

**RDY-02 · Personal-baseline scoring** · Should · MVP
Each item is converted to a z-score against the user's rolling 28-day baseline, sign-aligned so that higher is better. The composite is the mean z. No readiness flags are raised before 7–14 entries. Defaults: composite z ≤ −1.0 means "low readiness"; z ≤ −1.5, or PRS ≤ 3 on two consecutive days, means "consider modifying". Thresholds are adjustable and labelled heuristics (`EB §Defaults › Monitoring`, `EB §Gaps #10`).

**RDY-03 · Readiness-based session adjustments** · Should · MVP
On low readiness the app proposes one or more of:
- cap top-set RPE by −1 (+1 RIR);
- drop 1–2 back-off sets;
- swap the heavy day with a lighter day later in the week.
Sleep-specific rules: after < 6 h sleep before a PM session, keep intensity but trim volume or skip max singles. After ≥ 2 consecutive short nights, lower expectations on multi-joint lifts. In high-stress weeks, lengthen spacing between hard sessions for the same muscle by about 24 h.
- The app never auto-cancels a session. All adjustments need user confirmation (`EB §Monitoring › Readiness`, `EB §Monitoring › Sleep & stress`).

**RDY-04 · Pain and discomfort log with gentle alerts** · Should · v1.x
The user can log pain by body region (lumbopelvic, shoulder, hip, knee, elbow, wrist/hand, neck/thoracic), with a 0–10 rating, the lift or session where it started, and whether training was modified, reduced or stopped. This can be done during a set (WKT-03) or at any time.
- Alert rule: the same region rated ≥ 3/10 on ≥ 3 sessions within 14 days, or rising ratings, leads to a suggestion of exercise variation, load reduction and/or seeing a clinician.
- The tone normalizes logging and early modification. No diagnosis and no injury-risk score (`EB §Monitoring › Injury & pain`, `EB §Defaults › Monitoring`, LEG-07).

**RDY-05 · Per-muscle recovery estimate** · Could · Later
A heuristic per-muscle fatigue/recovery estimate from logged sets (scaled by proximity to failure, decaying over time) and soreness reports. It is shown as "estimate" on the body map (MAP-09) and never used to block training (`EB §Monitoring › Recovery`, `EB §Gaps #10`).

**RDY-06 · Menstrual cycle annotation** · Could · Later
Optional cycle logging, used only to annotate bodyweight-trend noise and readiness. It does not change training or nutrition targets (`EB §Nutrition › Sex-specific`, `EB §Gaps #22`).

### 5.10 Analytics and interactive charts (ANL)

**ANL-01 · Home dashboard** · Must · MVP
Home shows:
- today's session, or "Rest day" with the next session, as a one-tap start;
- this week's adherence and streak (MOT-03);
- this week's volume per muscle as a mini heat map (MAP-04);
- recent PRs;
- bodyweight trend sparkline;
- for powerlifters, the meet countdown and current total/points;
- a backup-status indicator when a backup is overdue (DAT-08).
- Home renders from local data within the performance budget (NFR-PERF-01).

**ANL-02 · e1RM and performance trends per exercise** · Must · MVP
An interactive chart per exercise shows the smoothed e1RM line with an uncertainty band, raw per-session e1RM points, PR markers, and mesocycle, deload and break annotations. Filters cover date range (4 weeks, 12 weeks, 6 months, 1 year, all) and rep-range source (strength e1RM vs all sets).
- Tapping a point shows the underlying sets.
- "Likely real" and "very likely real" changes are marked per PRG-02.
- Up to 3 exercises can be compared on one chart (normalized to % change).

**ANL-03 · Volume per muscle against targets** · Must · MVP
A weekly chart shows fractional and direct hard sets per muscle against the target band and evidence bands, per week over the selected range, with drill-down to contributing exercises. A table view lists all muscles for the current week.
- Values match the body-map heat map (MAP-04) and the plan editor (PLN-09) exactly. All three use one calculation.

**ANL-04 · Exercise history and rep-max table** · Must · MVP
Per exercise: all sessions with their sets; best sets; a rep-max table (best load for 1–12+ reps, with dates); and the current e1RM and training max (a per-exercise value the user sets).

**ANL-05 · PR history** · Must · MVP
A chronological, filterable list of all PRs by type (MOT-01) and exercise. Tapping a PR opens the session where it happened.

**ANL-06 · Training calendar and history** · Must · MVP
A month view marks completed, partial, missed, planned, deload and break days. It also offers a session list with search and filters. Tapping a day opens its session.

**ANL-07 · Powerlifting scores** · Should · MVP
For the best competition-lift total (from tested 1RMs, the heaviest load lifted for at least one rep, or current e1RMs, user choice) and for each lift, the app computes **IPF GL Points** (official IPF 2020+), **DOTS**, and Wilks and Wilks2020 (labelled "legacy"), plus an allometric index (kg / BW^0.67), using the current bodyweight trend.
- Coefficient sets are selected by sex reference × division (classic/equipped) × event (3-lift/bench-only). The app uses kg internally, applies the documented bodyweight clamps, and floors IPF and GL at 0. Single-lift Wilks/DOTS are labelled "informal".
- **Reference vectors** (± 0.01) are automated tests, for example: male 83 kg, total 700 kg, classic → Wilks 467.25, Wilks2020 561.15, DOTS 472.56, GL 96.90. Female 63 kg, total 400 kg → Wilks 429.58, Wilks2020 511.45, DOTS 430.21, GL 87.51. All test vectors in `EB §Scoring › Allometric & examples`, plus the official/OpenPowerlifting test values listed in `EB §Scoring` (for example Wilks M 100 kg / 1000 kg → 608.58907; IPF Points M classic 93 kg / 777.5 kg → 741.32; GL M equipped 92.04 kg / 1035 kg → 112.85), must pass (NFR-MNT-02).
- A points history chart follows the e1RM/bodyweight history.
- Where IPF and OPL coefficients differ, the official IPF document values are used (`EB §Gaps #17`).
- **Implementation source (closed source, OQ-04):** formulas are implemented from the official IPF documents (IPF Points, IPF GL) and published coefficient sets (Wilks, Wilks2020, DOTS). No OpenPowerlifting source code (AGPL) is ported, copied or adapted. OPL unit-test values are used only as reference test vectors (LEG-08). The bodyweight clamps are recorded as an app implementation choice in the parameter tables (PRG-18).

**ANL-08 · Strength percentiles and levels** · Should · v1.x
The app shows the user's percentile per lift and for the total, against competition norms for sex, age class and weight class. It is labelled "relative to competitive drug-tested lifters", with optional bands: < 10th "developing", 10–50th "competitive", 50–90th "advanced", > 90th "elite". A "typical first meet" benchmark is shown as well.
- **Data source (decided, OQ-07 = B/D, re-evaluated for closed source):**
  - Percentile tables are derived at build time, with the app's own processing code, from a competition dataset whose licence permits use in a free, closed-source app, without share-alike obligations on the derived tables or the app. The method is documented and validated against van den Hoek 2024 (`EB §Scoring › Strength standards`, `EB §Gaps #16`). A licence review is required first (§11.2 V-03).
  - Until that review clears, ANL-08 ships in fallback mode: no percentiles. Levels then use GL/DOTS points and bodyweight-multiple milestones (MOT-06).
  - The published van den Hoek tables may be used instead only with written permission from the authors or publisher.
  - Non-peer-reviewed web standards are not used.

**ANL-09 · Training-load metrics** · Should · v1.x
Per lift and muscle per week: volume load (Σ reps × kg), relative volume load (Σ reps × kg / e1RM), hard sets, sessions, time trained, and session sRPE load (WKT-18). Week-over-4-week-average change is shown as a neutral percentage (no risk zones). Volume load is not compared across different exercises (`EB §Monitoring › Load metrics`, `EB §Monitoring › ACWR & Banister`).

**ANL-10 · Mesocycle and weekly reports** · Should · v1.x
- **End-of-mesocycle report:** e1RM changes with reliability labels, volume adherence per muscle, PRs, readiness trend, deload compliance, and suggestions for the next block (PLN-13).
- **Weekly recap:** sessions, PRs, volume, bodyweight change, shown on the first app open of the new week.

**ANL-11 · Chart interaction and accessibility standard** · Must · MVP
All charts:
- support tap-for-tooltip, range presets, pinch-zoom with range chips and Earlier/Later buttons on time axes, and smooth transitions (respecting reduced motion);
- render correctly in light and dark themes with color-blind-safe palettes;
- never rely on color alone (also markers or labels);
- offer a "view as table" alternative and a one-sentence text summary for screen readers, for example "Squat e1RM rose 4% over 12 weeks".
- Interaction latency is ≤ 100 ms (NFR-PERF-05).

**ANL-12 · Expected-progress bands** · Could · Later
Optional shaded expectation bands on e1RM charts, based on trainee level: year 1 +10–30%, years 2–4 +5–10%/year, 5+ years +2–5%/year. Relative rates are the same for all sexes, and expectations are reduced with age rather than assuming decline (`EB §Defaults › Expectations`).

### 5.11 Motivation (MOT)

User answer: all of PR detection and celebrations, weekly-adherence streaks, achievements and levels, and progress photos.

**MOT-01 · Real-time PR detection** · Must · MVP
When a set is confirmed, the app checks:
- **rep PR:** best load at that rep count, for 1–12+ reps;
- **load PR:** heaviest load ever for the exercise;
- **e1RM PR:** only from qualifying sets per PRG-01 weighting;
- **volume PR:** best single-session volume load for the exercise;
- **first-time:** first log of an exercise (milestone only, not a PR).
- Warm-ups, assisted sets and band sets are excluded.
- Edits and deletions recompute PRs (WKT-15).
- PRs are computed per exercise and never across variants.
- e1RM PRs are labelled as estimates. Actual load × reps PRs are shown separately (`EB §Load › Real change`).

**MOT-02 · PR celebrations** · Must · MVP
A detected PR triggers an in-session celebration: an animation with haptics and an optional sound. It is brief (≤ 2 s), dismissable, and respects reduced motion (NFR-A11Y-08). The PR also appears in the session summary and the PR history.
- A celebration never blocks logging the next set. Multiple PRs in one set are combined into one celebration.

**MOT-03 · Weekly adherence streak** · Must · MVP
A streak counts consecutive "kept" training weeks. **No daily streaks.**
- A week (starting on the user's week-start day) is **kept** if completed sessions ≥ planned sessions for that week. The user can enable a grace of 1 missed session per week (Assumption A-07).
- Sessions done on unscheduled days count. Deload weeks count with their planned sessions. Partial sessions count if ≥ 50% of planned working sets were done.
- In freestyle mode, the user sets a weekly session target that is used instead of the plan. Without a plan or a weekly target, one session keeps the week.
- Home shows the current streak, best streak, and this week's progress (for example 2/4).

**MOT-04 · Streak fairness rules** · Must · MVP
Planned breaks and illness (PLN-12) **pause** the streak: they neither keep nor break it. A missed week resets the current streak to 0 but keeps the best streak. Editing or backdating sessions recomputes streaks.
- The user can retroactively mark a past week as a break, at most 4 weeks back.
- A skipped planned session still counts toward the week's target; merging it into another session keeps the week.

**MOT-05 · Achievements** · Should · v1.x
A catalog of achievements (§7.5) is unlocked from local data. It includes:
- strength milestones, such as plate milestones (1/2/3/4 plates per side) and bodyweight multiples (for example 2× BW squat), with sex-specific variants or percentile-based tiers for fairness;
- consistency milestones (sessions, kept weeks, completed mesocycles);
- engagement milestones (first deload taken, first meet completed, first backup made).
- Unlocks are celebrated (as in MOT-02) and listed in a trophy screen with progress toward locked items.
- No achievement rewards unsafe behavior: rapid weight loss, training to failure, consecutive training days, or skipping deloads.

**MOT-06 · Strength levels** · Should · v1.x
Per lift and overall, a level derived from the percentile bands (ANL-08) or, until percentile data is available, from scoring points. Level-ups are celebrated. *Assumption A-20:* "levels" means strength levels, not XP from app usage. This follows the user's example of "strength percentiles from competition data".

**MOT-07 · Progress photos: capture and storage** · Should · v1.x
The user can take photos with the camera or import them from the gallery, tagged with date, pose (front, side, back, custom), bodyweight trend value, phase (bulk/cut/maintain) and an optional note.
- Photos are stored only in app-local storage, never written to the device gallery by default.
- Location and camera metadata (EXIF) are stripped on capture or import (NFR-PRIV-05).
- Photos are compressed to a configurable quality, with a default of ≤ about 500 KB per photo (Assumption A-16).
- The photo grid can blur thumbnails until tapped (privacy option).

**MOT-08 · Photo comparison** · Should · v1.x
The user picks two photos (filtered by pose) and sees them side by side or with a slider/overlay comparison, with dates, bodyweight and the time between them. Quick presets: "first vs latest", "4 weeks ago vs now", "start vs end of phase".

**MOT-09 · Shareable cards** · Could · v1.x
The user can share an image card of a PR, session summary or mesocycle report through the system share sheet (PWA-09). Cards contain no data unless the user chooses to include it, and never photos unless explicitly added.

**MOT-10 · Motivational tone rules** · Must · MVP
All copy is encouraging and non-judgmental:
- Missed sessions are framed constructively ("Life happens. Here's how we'll adjust").
- No guilt mechanics, no daily nagging.
- Rest and deloads are framed as part of training.
- Body-composition messaging avoids shaming, never uses BMI labels for lifters (`EB §Nutrition › Body composition`), and never encourages extreme deficits.
- A content style guide is a deliverable of design. Copy review is part of the release checklist.

### 5.12 Bodyweight and nutrition targets (BOD)

User answer: nutrition covers bodyweight and targets. That means a smoothed weight trend, body measurements, a body-fat estimate, protein/calorie targets for bulk/cut/maintain, and weight-class cut planning for powerlifting. **There is no food logging and no food database.**

**BOD-01 · Bodyweight logging** · Must · MVP
The user can log bodyweight in ≤ 3 taps from Home or an app shortcut (PWA-05), with date and time (default now) and an optional note. Past entries can be edited and deleted. Entering several values on one day is allowed; the morning/first value is used for the trend by default.
- Guidance text recommends weighing in the morning, after voiding, before food and drink, on the same scale (`EB §Nutrition › Trend smoothing`).

**BOD-02 · Weight trend and rate** · Must · MVP
The app computes a smoothed trend with a daily exponential moving average (α 0.1 by default; 0.1–0.15 when cutting, 0.05–0.1 on slow bulks). Missed days are handled with α_eff = 1 − (1 − α)^Δdays. The trend starts from the mean of the first 3–7 weigh-ins. Single readings deviating more than 2–2.5% from the trend are winsorized.
- The weekly rate (kg/week and %BW/week) comes from a regression over the last 14–28 days. When maintaining, the rate band shown is ±0.25 %BW/week.
- The chart shows the trend line prominently, raw dots de-emphasized, and the weekly rate. There are no alerts based on a single day's weight.
- Unit tests cover the EMA with gaps and outliers (NFR-MNT-02).
- *Ref:* `EB §Nutrition › Trend smoothing`, `EB §Defaults › Nutrition`, `EB §Gaps #20`.

**BOD-03 · Body measurements** · Should · MVP
The user can log circumferences (neck, chest, waist, hips, upper arm L/R, thigh L/R, calf L/R; configurable list) and optionally skinfolds (sites used by BOD-04). The app shows trends per measurement and recommends a consistent measuring protocol.

**BOD-04 · Body-fat estimate and FFMI** · Should · v1.x
The app estimates body-fat % with the Navy circumference method or Jackson-Pollock skinfolds (3- or 7-site), with sex-specific equations. It shows ± 3–4 percentage points and a "trend only" label. It derives fat-free mass and FFMI/normalized FFMI.
- Only equations verified against primary sources ship. Unverified coefficients are blocked until verified (`EB §Gaps #18`).
- The FFMI normalization constant is documented (6.3 or 6.1, `EB §Gaps #19`). FFMI is not computed for users under 18. "About 25" is shown as an observation, not a limit, and there is no "natural limit" messaging for women.
- BMI is never used for lifter health messaging.
- *Ref:* `EB §Nutrition › Body composition`.

**BOD-05 · Phase goals and target rates** · Should · v1.x
The user sets a phase (bulk, cut, maintain) with a target rate, defaulting by level:
- **Bulk:** novice 0.5%, intermediate 0.25–0.5%, advanced 0.1–0.25% BW/week.
- **Cut:** 0.5–0.7% BW/week (allowed 0.25–1.0%).
- **Maintain:** ± 0.1%.
The dashboard compares the actual trend rate with the target. Sustained deviation (≥ 3 weeks on a bulk, ≥ 2 weeks on a cut) prompts an adjustment (BOD-06).
- *Ref:* `EB §Nutrition › Bulking`, `EB §Nutrition › Cutting`, `EB §Defaults › Nutrition`.

**BOD-06 · Calorie target and recalibration** · Should · v1.x
The app computes an initial daily calorie target:
- RMR from the documented equation hierarchy: FFM-based (mean of Tinsley and ten Haaf) if body fat is known; otherwise ten Haaf weight-based; Mifflin as the fallback.
- × an activity factor (seed only), ± the phase surplus/deficit (surplus capped at 20% of TDEE). Shown with a ± 10–15% uncertainty band.
- **Recalibration without food logs (Assumption A-17):** the app periodically asks "Did you roughly hit your calorie target over the last 2 weeks?" If yes and the trend rate deviates from the target rate, it proposes a new target from the observed rate difference × energy density of weight change (default 7,700 kcal/kg; lower in lean or gaining states). Windows with known water shifts are excluded or flagged (BOD-10).
- *Ref:* `EB §Nutrition › TDEE`, `EB §Defaults › Nutrition`, `EB §Gaps #20`.

**BOD-07 · Protein and macro targets** · Should · v1.x
- **Protein:** maintenance/bulk 1.6 g/kg BW (range 1.6–2.2). Cut 2.3–3.1 g/kg FFM when FFM is known, otherwise 1.8–2.7 g/kg BW. For users with high body fat, FFM or an adjusted weight is used.
- **Per-meal guide:** about 0.4 g/kg per meal across 3–6 meals; daily totals matter more than timing.
- **Optional fat and carbs:** fat floor max(0.5 g/kg, 15–20% kcal), default 20–30%; carbohydrate is the remainder, with a 3–5 g/kg (cut) or 4–7 g/kg (bulk) guide labelled "low certainty".
- *Ref:* `EB §Nutrition › Protein`, `EB §Defaults › Nutrition`.

**BOD-08 · Nutrition and weight safety guardrails** · Must · v1.x (cut-related guardrails in v1.1 with BOD-09; the rest in v1.2 with the nutrition targets)
The app shows warnings (not hard blocks, except where stated) for:
- trend loss > 1.0% BW/week for ≥ 2 weeks; a strong warning above 1.5%/week;
- a planned calorie target below the estimated RMR;
- fat < 0.5 g/kg or < 15% of kcal;
- energy availability < 30 kcal/kg FFM/day when computable (soft warning between 30 and 45 during cuts);
- RED-S screening prompts recommending a clinician for amenorrhea, recurrent bone-stress injury or disordered-eating cues.
- For users under 18, cut targets are limited to the conservative end of the range and the weight-cut planner (BOD-09) is disabled (LEG-03).
- *Ref:* `EB §Nutrition › Safety`, `EB §Defaults › Nutrition`, `EB §Gaps #21`.

**BOD-09 · Powerlifting weight-class cut planner** · Should · v1.x
Inputs: meet date, weigh-in type (2 h / 24 h), class limit, current trend weight. The planner computes the required loss % and splits it into a **chronic portion**: anything above about 3% (2-h weigh-in) or about 5% (24-h weigh-in), achieved by dieting at ≤ 0.5–1%/week. The rest is the **acute portion**, ≤ 2–3% for 2-h weigh-ins.
- Warnings: a planned acute cut > 3% BW triggers a warning; > 5% triggers a strong warning and the planner refuses to generate an acute plan. Saunas, diuretics, laxatives, vomiting and IV rehydration are never recommended and are always discouraged.
- A post-weigh-in checklist covers fluid about 1.5 × kg lost (starting with a 10 mL/kg bolus), a sodium-containing solution, carbohydrate about 1 g/kg/h, 20–25 g protein, and low fibre and fat.
- A class suggestion recommends the class where the off-season trend sits within about 2–3% above the limit, or below it.
- *Ref:* `EB §Nutrition › Weight cuts`, `EB §Defaults › Nutrition`.

**BOD-10 · Weight annotations** · Could · v1.x
The user can annotate periods (creatine start, diet break, refeed, water cut, illness, travel, menstrual phase). Annotated windows are excluded from or flagged in rate and recalibration calculations (`EB §Nutrition › TDEE`).

**BOD-11 · Food logging** · Won't
No food logging, food database or macro tracking per meal (NG-02).

### 5.13 Calendar export (CAL)

User answer: the user exports or shares an `.ics` file of planned sessions and imports it into Samsung/Google Calendar. It is one-way, needs no login, and the calendar app handles reminders.

**CAL-01 · Export planned sessions as iCalendar** · Should · MVP
The user can export planned sessions for a chosen range (rest of the current week, current mesocycle, next N weeks, or until the meet date) as a standards-compliant iCalendar file (RFC 5545, `.ics`).
- The file validates with an RFC 5545 validator (NFR-MNT-02). It imports into Samsung Calendar on the Galaxy S22 without errors (device test). Import into Google Calendar is verified on the documented supported path (§9.1 P-05).

**CAL-02 · Event content** · Should · MVP
Each event contains:
- a title, for example "POWR · Upper A (Week 3)";
- a start time chosen at export: the user's preferred time per weekday (with a time for days without one), the same time for every session, or all-day events;
- the estimated duration (PLN-14);
- a description listing the main exercises and set counts;
- an optional reminder alarm (VALARM: none, 15 min, 30 min, 1 h, 2 h before), which the calendar app will handle.
- No personal data beyond training content is included.

**CAL-03 · Time zones and DST** · Should · MVP (Must if CAL ships)
Event times are correct in the user's local time zone, including across DST transitions within the exported range. Test: an export spanning a DST change produces events at the same local wall-clock time before and after the change.

**CAL-04 · Stable identity and re-export** · Should · MVP
Each planned session has a stable event UID, so re-exporting after plan changes can update existing events where the calendar app supports it. The export screen states clearly that some calendar apps may duplicate events instead, and how to remove the old ones. Re-export is offered when the plan changes (PLN-09, PLN-11).
- Whether Samsung Calendar and Google Calendar honor updates or cancellations on re-import must be verified (§9.1 P-05).

**CAL-05 · Delivery and import guidance** · Should · MVP
The `.ics` file is delivered as a **file download** by default. The Web Share API in Chrome currently does not allow sharing `.ics` files (§9.1 P-04), so system sharing is offered only where capability detection confirms the file type can be shared. After export, a short guide shows how to import into Samsung Calendar and Google Calendar.
- The flow works offline.

**CAL-06 · Milestone events** · Could · v1.x
Optional events for the meet day, weigh-in, deload weeks, taper start and mesocycle end.

**CAL-07 · Direct calendar integration** · Won't
No calendar APIs, no OAuth, no subscription URL (a subscription would need a server) (NG-03).

### 5.14 Data management (DAT)

**DAT-01 · Local-only storage** · Must · MVP
All user data (profile, equipment, plans, sessions, sets, notes, bodyweight, measurements, check-ins, photos, settings, achievements) is stored on the device in browser storage controlled by the app. No user data is ever sent over the network (NFR-PRIV-01).

**DAT-02 · Durable writes** · Must · MVP
Every user-confirmed change (set, edit, entry) is committed to durable storage before, or within 500 ms of, the visual confirmation. Multi-record changes (finishing a session, import, migration) are atomic.
- Test: force-kill the browser process at random points during a scripted workout. No confirmed set is lost and no partially written state is visible after restart (NFR-REL-01).

**DAT-03 · Persistent storage** · Must · MVP
The app requests persistent storage so the browser does not evict data under storage pressure. It requests at a meaningful moment (after onboarding and/or after installation, and again after notification permission is granted), because Chromium grants persistence based on engagement, installation, bookmarking and notification permission (§9.1 P-03).
- Settings → Data shows "Storage protected: Yes/No". If No, it explains the risk in one sentence and backup reminders become more prominent (DAT-08).
- The app never claims data is safe from "Clear browsing data" or uninstall. The privacy notice and backup guide say that clearing browser or site data or uninstalling can delete everything.

**DAT-04 · Storage usage visibility** · Should · MVP
Settings → Data shows estimated storage used (total, and photos separately from v1.x) and the available quota where the platform reports it. A storage-full condition shows an actionable message and never fails silently (NFR-REL-04).

**DAT-05 · Backup export** · Must · MVP
One action exports a complete backup as a single file. The file contains all user data, a format version, the app version, the creation timestamp, record counts and an integrity checksum. The filename includes the date, for example `powr-backup-2026-11-23.<ext>`.
- **Round-trip test:** export → delete all data → import gives data identical to the original, entity by entity, with derived values recomputed identically (NFR-REL-06).
- Export works offline and takes ≤ 10 s for the reference dataset excluding photos (A-11, NFR-PERF-08).
- The file is delivered as a download, or through the system share sheet where capability detection confirms the file type is shareable (§9.1 P-04). Users are told where the file went and are advised to copy it off the phone (for example to cloud storage or a computer).
- The backup format is documented (§7.7, DAT-07), so the data stays usable without the app.

**DAT-06 · Backup import (restore)** · Must · MVP
The user selects a backup file. The app validates its format, version, checksum and schema, and shows a preview (date, counts, date range) before restoring. MVP restore mode is **replace all** (Assumption A-06): the app first makes an automatic safety export or snapshot of the current data and requires explicit confirmation.
- Invalid, corrupted or tampered files are rejected with a clear message and no partial import.
- Imported content is treated as untrusted input (NFR-SEC-02).
- Import from a newer format version than the app supports is rejected with "Update the app first".

**DAT-07 · Format versioning and compatibility** · Must · MVP
The backup format is versioned. Every app version imports all earlier backup format versions (migrating them) and rejects unknown newer major versions. A schema description is maintained with each format version.
- Automated migration tests run for every historical format version (NFR-MNT-03).

**DAT-08 · Backup reminders** · Must · MVP
The app tracks the date of the last successful export. It shows in-app reminders when the backup is older than the configured cadence (default 14 days, choices 7/14/30 days or off), or after N new sessions (default 8). Reminders appear on Home and after finishing a session, and are dismissible: "Remind me later" hides a due reminder for 3 days.
- Reminders are in-app, because scheduled local notifications are not reliably available to PWAs (§9.1 P-01).
- If persistent storage is not granted, the default cadence becomes 7 days.

**DAT-09 · Photos in backups** · Should · v1.x
The export offers "with photos" or "without photos" and shows the estimated file size. Restore handles both. Photo backups may be split into several files if size limits require it (decided in the technical concept).

**DAT-10 · Backup encryption** · Should · v1.x
Optionally, the user can protect a backup with a passphrase (strong, standard encryption). The app clearly warns that a lost passphrase cannot be recovered. Unencrypted export stays available.

**DAT-11 · CSV export** · Should · v1.x
The user can export the training log (one row per set) and the bodyweight log as CSV for spreadsheets or other apps. CSV is an allowed Web Share type in Chrome, so it can be shared directly (§9.1 P-04).

**DAT-12 · Import from other apps** · Could · Later
Import of training history from common logger CSV exports (formats to be selected). Imported history seeds e1RMs and starting volume (ONB-04, PLN-03).

**DAT-13 · Delete data** · Must · MVP
The user can delete individual records (sessions, entries, photos) and **delete all data**. Deleting everything needs typed or two-step confirmation, removes all app storage including caches of user data, and returns the app to first-run onboarding. A confirmation screen ("All data deleted") precedes the first run.
- Afterwards, inspecting the app's site storage shows no remaining user records.

**DAT-14 · Migration on app updates** · Must · MVP
When an app update changes the local data schema, the app migrates the data automatically, atomically and without loss. It takes a safety snapshot before migrating. A failed migration rolls back and leaves the previous data usable. Migrations never run during an active session (PWA-04).

**DAT-15 · Merge import** · Won't (Later candidate)
Merging two datasets (for example from two devices) is out of scope. Restore replaces all data (DAT-06).

**DAT-16 · User-initiated diagnostics export** · Should · v1.x (decided: OQ-05 = A)
The user can export a diagnostics file (app version, browser, capability matrix results, error log, performance timings and, only if ticked, anonymized aggregate statistics such as M5/M6) to attach to a bug report. Nothing is sent automatically. This is the only diagnostics mechanism; there is no telemetry (C-12, NG-17).

### 5.15 Settings (SET)

**SET-01 · Theme** · Must · MVP
Light, dark and system (default) themes. All screens, charts, the body map and celebration graphics support both themes with WCAG AA contrast. The theme switches without reload, and the system UI color (status bar/theme color) follows the active theme (PWA-14).

**SET-02 · Units** · Must · MVP
Load unit (kg/lb), bodyweight unit (kg/lb), length unit (cm/in), and plate inventory unit set per plate set. Switching units converts the display without changing stored values or introducing drift (NFR-REL-07).

**SET-03 · Timer defaults** · Must · MVP
The user can edit rest defaults per context (TMR-02), auto-start on/off, count-up mode, pre-alert timing (5, 10 or 15 s; default 10 s), superset transition time and warm-up rest, and reset everything to evidence defaults.

**SET-04 · Alerts and permissions** · Must · MVP
Settings for sound on/off and volume, vibration on/off, optional voice cues (Could), notification permission status and a request button, and the "alerts while screen is locked" capability status (TMR-06). The honest status note is required by the OQ-01 decision.

**SET-05 · Training preferences** · Must · MVP
- RPE or RIR display and entry (RPE = 10 − RIR; records keep RIR); RIR entry by one tap per value (0–4, 5+) or in half steps.
- Default prescription mode for main lifts and for accessories.
- e1RM equation (advanced; Wathan default).
- Deload frequency.
- Load rounding direction.
- Readiness check-in on/off.
- Warm-up generation on/off; in-session hints on/off (WKT-16).
- Week start day (SET-11).

**SET-06 · Equipment and plates** · Must · MVP
Entry point to the equipment profiles and inventories (EQP-01…07).

**SET-07 · Advanced science settings** · Could · v1.x
Per-muscle volume targets, muscle-mapping overrides (EXL-06), technique credit values, readiness thresholds, and an optional MEV/MAV/MRV overlay (labelled heuristic). Every advanced value shows its evidence default and can be reset.

**SET-08 · Profile and plan regeneration** · Must · MVP
The user can edit any onboarding answer and choose whether to update the current plan from the start of next week (this week stays as planned) or keep it; experience, priorities, exercises to avoid and the reference set then reach the next block's proposal, style and training days the next plan. Only an answer that changes the plan asks; the new plan is shown before anything is stored.

**SET-09 · Privacy, legal, about** · Must · MVP
In-app access to the privacy notice (LEG-02), health disclaimer (LEG-01), evidence and sources page (LEG-05), the "Open-source licences / attributions" screen (LEG-06), publisher identification (LEG-09), app version, changelog (NFR-MNT-07) and a contact and feedback route by e-mail (`tools@sz-development.com`).

**SET-10 · Workout display** · Must · MVP
- Keep screen on during workouts (default on, PWA-06).
- Haptics on/off.
- Large-controls mode (bigger logging controls).
- Celebration animations on/off; animations also follow the system reduced-motion setting automatically.

**SET-11 · Week start and locale formats** · Should · MVP
Week start day (default from the device locale). Date, time and number formats follow the device locale while UI text stays English (NFR-L10N-01).

### 5.16 PWA capabilities and system integration (PWA)

Braindump: "advanced use of PWA capabilities, well integrated into the system and the fitness app domain". Capabilities marked **[feasibility]** must be verified on the Galaxy S22 with both Chrome and Samsung Internet during the technical concept (PWA-13).

**PWA-01 · Installable app** · Must · MVP
The app meets Chromium installability criteria: web app manifest, service worker, HTTPS. It provides the name, short name, standalone display, start URL, scope, theme and background colors, regular icons and maskable icons, and a description and screenshots for the richer install UI.
- When installed, it launches standalone from the home screen and app drawer with an icon and splash screen, and appears in Android's recent-apps list as its own app.

**PWA-02 · Install promotion** · Should · MVP
The app offers a custom, non-intrusive install prompt at meaningful moments (after onboarding, after the first finished session), not on first page load. Browsers without a programmatic prompt (for example Samsung Internet **[feasibility]**) get short illustrated instructions. Dismissals are respected (no re-prompt for ≥ 14 days).

**PWA-03 · Full offline operation** · Must · MVP
After the first successful load, 100% of features work in airplane mode: onboarding, plan generation, logging, timers, analytics, body map, backup and restore, calendar export. The app makes no runtime requests to third-party origins (fonts, CDNs, analytics) (NFR-PRIV-02).
- Test: install, switch to airplane mode, run the complete offline test checklist (M9).

**PWA-04 · Update flow** · Must · MVP
When a new version is available, the app shows a non-blocking "Update available" notice with a short changelog. The update applies when the user accepts or on the next cold start, **never during an active workout session**. Data migrations follow DAT-14. A failed update leaves the previous version working.
- Test: deploy version N+1 while a session is in progress on N. The session continues on N, and the update applies after the session ends and the user accepts.

**PWA-05 · App shortcuts** · Should · MVP **[feasibility]**
Long-pressing the home-screen icon offers shortcuts. The MVP ships two: "Start today's workout" and "Log bodyweight". "Quick timer" follows with TMR-15, and "Last workout summary" later. Each shortcut opens directly to its screen, offline.

**PWA-06 · Screen Wake Lock during workouts** · Must · MVP **[feasibility]**
While a session is active and the workout screen is visible, the app keeps the screen on (default on, SET-10). It re-acquires the lock when returning to the app and releases it when the session ends, the user turns it off, or the app is hidden. If unsupported, the setting shows "Not supported on this browser".
- Battery note in settings: keeping the screen on uses more battery.

**PWA-07 · Haptics and audio cues** · Must · MVP **[feasibility]**
Vibration patterns for timer end, pre-alerts, PRs and tempo cues where the platform supports vibration. Audio cues for the same events with in-app volume control. Everything works offline and respects user settings. Where vibration is unsupported, the app falls back to audio and visual cues.

**PWA-08 · Notifications** · Should · MVP **[feasibility]**
With permission (requested contextually, ONB-11), the app uses system notifications for:
- rest-timer end while hidden (TMR-06, best effort);
- an ongoing "workout in progress" indicator with elapsed time, if feasible.
- Notifications must not depend on a server or on push messaging (NG-13). Behavior with the screen locked, battery saver on, and the app backgrounded for 1–5+ minutes must be measured (TC-03, V-01).
- Per the OQ-01 decision, notifications are best effort only. No native wrapper is added to make them reliable (NG-14).

**PWA-09 · Web Share** · Should · MVP
Users can share session summaries, PR cards (MOT-09) and CSV exports (DAT-11) through the system share sheet, as text and/or image files of permitted types. For `.ics` and backup files, sharing is offered only when capability detection confirms support. Otherwise the app falls back to download (§9.1 P-04).

**PWA-10 · Share target (receive files)** · Could · v1.x **[feasibility]**
When installed, the app appears as a share target for backup files, so a user can share a backup from a file manager or cloud-drive app into the app to start the restore flow (DAT-06).

**PWA-11 · Camera capture** · Should · v1.x
Progress photos (MOT-07) can be captured directly with the device camera or picked from the gallery. Camera permission is requested only when the user starts a capture, and the app works fully without it.

**PWA-12 · Navigation integration** · Must · MVP
The Android back gesture/button navigates within the app hierarchy, never exits or loses an in-progress session, and asks before discarding unsaved edits. Screens have stable deep links (URLs) so shortcuts and reloads restore the right screen and state.

**PWA-13 · Capability detection and graceful degradation** · Must · MVP
Every optional platform capability (wake lock, vibration, notifications, Web Share with files, share target, app shortcuts, persistent storage, storage estimate) is feature-detected at runtime. Missing capabilities degrade gracefully with a visible explanation where the user would expect the feature.
- A capability matrix for Chrome and Samsung Internet on the Galaxy S22 (plus at least one other Android device) is maintained as a release artifact and summarized in Settings → About → Device support.

**PWA-14 · Display and theming integration** · Must · MVP
The app is portrait-first, handles safe areas and display cutouts, uses the theme color for the system bars matching light/dark mode, and supports system font scaling (NFR-A11Y-07). No content is hidden behind system bars or the keyboard. Numeric inputs open the numeric keypad.

**PWA-15 · Server-dependent capabilities** · Won't
No push messaging, background sync, or periodic background sync. These either need a server or are unreliable for local scheduling (NG-13, §9.1 P-01).

### 5.17 In-app legal and trust (LEG)

**LEG-01 · Health disclaimer** · Must · MVP
A health and safety disclaimer (content in §8.1) must be acknowledged during onboarding (ONB-01) and is always available in Settings. It is shown again when its version changes.

**LEG-02 · Privacy notice** · Must · MVP
A privacy notice (content in §8.2) is available before onboarding completes and in Settings, written in plain language, ≤ 2 screens for the summary, with full text available.
- It names the publisher (LEG-09) as the responsible party.
- It is written against the Swiss Federal Act on Data Protection (revFADP / nDSG) as the primary framework. Whether the EU GDPR also applies is to be confirmed in legal review (§8.2, V-06).

**LEG-03 · Age requirement** · Must · MVP
The user confirms they meet the minimum age of 16 (decided, OQ-10; C-15). If the birth year shows the user is under 18, the app disables the weight-cut planner (BOD-09), limits cut-rate targets to the conservative range (BOD-08), hides FFMI (BOD-04), and shows age-appropriate guidance.

**LEG-04 · Pre-participation self-screening** · Should · MVP
Onboarding offers a short, optional health self-screening (for example "Has a doctor ever said you have a heart condition…") in the style of established pre-participation questionnaires. A "yes" answer recommends consulting a clinician before training. The licensing of any standardized questionnaire wording must be checked (§8.4).

**LEG-05 · Evidence transparency and sources** · Must · MVP
An in-app "How POWR decides" page explains the main logic in plain language (e1RM, volume counting, progression, deloads, timers, nutrition targets), each with evidence tags in user-friendly terms ("strong research", "limited research", "coaching convention", "app estimate") and the source references. Parameter-driven suggestions link to the relevant entry (PRG-09, PRG-18).

**LEG-06 · "Open-source licences / attributions" screen** · Must · MVP
Settings → About → "Open-source licences / attributions" lists every third-party component distributed with the app. For each it shows the name, version, licence, copyright notice, required attribution text, and the full licence text where the licence requires it. The screen also credits data sources (for example the scoring-coefficient sources and, if used, the percentile dataset) and any third-party artwork or media (§8.4).
- The screen is generated at build time from the licence inventory (LEG-08), so it always matches the shipped bundle. It works offline.
- Release check: every distributed inventory entry appears on the screen.

**LEG-07 · Wellness-scope claims guard** · Must · MVP
App copy and the website (and any future store listing) must not claim to diagnose, treat, prevent or predict injury or disease. Pain logging and readiness features are described as self-tracking and general guidance, with clinician referral where appropriate (§8.3). Copy review against this rule is part of the release checklist.

**LEG-08 · Licence policy and third-party inventory (closed source)** · Must · MVP
The app is free and closed source (decided, OQ-04; C-09). Every third-party component distributed with the app is recorded in a licence inventory: runtime dependencies including transitive ones, fonts, icons, sounds, artwork, media, data sets and text. Each entry records name, version, origin, licence, copyright holder, attribution text, review status and approver. Build-only tools are recorded too, but they are not distributed.
- **Allowed without review:** permissive licences, for example MIT, BSD-2-Clause/BSD-3-Clause, Apache-2.0, ISC, 0BSD, Zlib, public-domain dedications (CC0, Unlicense), SIL OFL for fonts, and CC BY for content (with attribution).
- **No copyleft dependencies:** GPL, AGPL and LGPL, and other copyleft licences such as MPL or EPL, are blocked by default. Any exception needs a documented licence review approving the specific use.
- **Content with share-alike (for example CC BY-SA) or non-commercial (for example CC BY-NC) terms** needs a licence review before use and is excluded by default. This applies to exercise or media datasets in particular (EXL-10).
- **OpenPowerlifting:** its AGPL source code is not ported, copied or adapted. Scoring is reimplemented from the official IPF documents and the published coefficients (ANL-07). OPL unit-test values are used only as reference test vectors. Any use of OPL competition data needs a licence review (OQ-07, V-03).
- The build fails if a distributed component has an unknown or unapproved licence (NFR-MNT-08).
- The inventory is a release artifact and is the source for the attributions screen (LEG-06).

**LEG-09 · Publisher identification (imprint)** · Must · MVP
The website that serves the app and the in-app About screen identify the publisher: **Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland**, with a postal contact address (a release check blocks production until it is provided) and e-mail. The privacy notice (LEG-02) names the same publisher as the responsible party.
- The exact content legally required is to be confirmed in legal review (§8.6, V-06). That covers Swiss requirements, and any EU requirements because the app is publicly available to EU users.
- The publisher information is available offline in the app.

---

## 6. Non-functional requirements

All performance budgets are measured on a Samsung Galaxy S22 with current stable Chrome and Samsung Internet, app installed, in airplane mode, with the reference dataset (Assumption A-11: about 5 years of training, 1,300 sessions, 40,000 sets, 1,800 bodyweight entries; photos excluded unless stated). Values are p75 over ≥ 10 runs unless stated otherwise. The technical concept may propose adjusted budgets, with a rationale.

### 6.1 Performance (NFR-PERF)

| ID | Requirement | Budget |
|---|---|---|
| NFR-PERF-01 | Cold start to an interactive Home screen | ≤ 2.0 s (first content ≤ 1.0 s) |
| NFR-PERF-02 | Warm resume (from background) to interactive, timers correct | ≤ 500 ms |
| NFR-PERF-03 | Set confirmation: visual feedback / durable commit | ≤ 100 ms / ≤ 500 ms |
| NFR-PERF-04 | Screen navigation; scrolling and animations | ≤ 300 ms; ≥ 55 fps sustained during list scroll |
| NFR-PERF-05 | Chart render (full history) / chart interaction response | ≤ 500 ms / ≤ 100 ms |
| NFR-PERF-06 | Recompute derived data after editing a past session | ≤ 2 s, non-blocking |
| NFR-PERF-07 | First-visit transfer for full offline install (excluding optional media) | ≤ 3 MB compressed (Assumption; confirm in TC) |
| NFR-PERF-08 | Backup export / import of the reference dataset without photos | ≤ 10 s each |
| NFR-PERF-09 | Plan generation (any onboarding input) | ≤ 1 s |
| NFR-PERF-10 | Idle energy use | No timers, polling or wake locks when no session is active and no timer runs |

### 6.2 Reliability and data integrity (NFR-REL)

| ID | Requirement |
|---|---|
| NFR-REL-01 | No confirmed user data is lost on process kill, crash, battery death, OS update or browser update (DAT-02, WKT-14). |
| NFR-REL-02 | Imports, migrations and "finish session" are atomic: all or nothing, with a pre-change safety snapshot for import and migration (DAT-06, DAT-14). |
| NFR-REL-03 | Raw logs are the single source of truth. All derived values (e1RM, PRs, volume, streaks, achievements, trends) can be recomputed deterministically from raw data, and a consistency check can be run on demand (Settings → Data → "Verify data"). |
| NFR-REL-04 | Storage errors (quota exceeded, write failure) are surfaced with actionable messages. Nothing fails silently. |
| NFR-REL-05 | Sessions store timestamps with time-zone offsets. Device clock or time-zone changes and DST shifts do not corrupt session order, timers or week boundaries. |
| NFR-REL-06 | Backup round-trip is lossless (DAT-05), verified by automated tests on every release. |
| NFR-REL-07 | Unit conversions do not drift: values are stored as entered (with their unit) or in a canonical representation with enough precision that kg↔lb round-trips reproduce the entered value exactly as displayed. Plate math uses the inventory's own unit. |
| NFR-REL-08 | The app keeps working after the browser evicts its caches (re-download when online), and user data is unaffected. |

### 6.3 Privacy (NFR-PRIV)

| ID | Requirement |
|---|---|
| NFR-PRIV-01 | No user data leaves the device except through an explicit user action (export, share). There is no telemetry, analytics or crash reporting, not even opt-in (decided, OQ-05; C-12). Diagnostics leave the device only through the user-initiated export (DAT-16). |
| NFR-PRIV-02 | There are zero runtime requests to third-party origins. All fonts, icons, scripts and content are self-hosted and cached. Verified by a network-log test. |
| NFR-PRIV-03 | No cookies or tracking identifiers. No fingerprinting. |
| NFR-PRIV-04 | Permissions (notifications, camera) are requested only in context, after explanation. All features except the one that needs a permission work without it. |
| NFR-PRIV-05 | Progress photos have EXIF and location metadata removed, are not written to the shared gallery by default, can be blurred in the grid, and are deleted completely when the user deletes them. |
| NFR-PRIV-06 | The hosting set-up minimizes server logs (no IP retention beyond what the host requires). Whatever the host does log is disclosed in the privacy notice (§8.2). |

### 6.4 Security (NFR-SEC)

| ID | Requirement |
|---|---|
| NFR-SEC-01 | HTTPS only. A strict Content Security Policy (no third-party script sources, no `eval`). Dependencies are audited for known vulnerabilities before each release. |
| NFR-SEC-02 | Imported files (backups, CSV, `.ics` if ever imported) are untrusted. They get schema validation, size limits, sanitized text rendering (no HTML injection) and never execute content. |
| NFR-SEC-03 | Data at rest relies on the device's OS-level encryption and screen lock. This is stated in the privacy notice. Optional backup encryption is covered by DAT-10. An app-level PIN or biometric lock is a Later candidate. |

### 6.5 Accessibility (NFR-A11Y)

| ID | Requirement |
|---|---|
| NFR-A11Y-01 | Conformance target is **WCAG 2.2 Level AA** for all screens and flows, including the body map, charts and timers. |
| NFR-A11Y-02 | Target sizes: primary workout controls (confirm set, steppers, timer controls, RIR chips) ≥ 48 × 48 CSS px with ≥ 8 px spacing. All other controls ≥ 24 × 24 CSS px (WCAG 2.5.8). |
| NFR-A11Y-03 | One-handed use: during a workout, all primary actions are reachable in the lower 60% of a 6.1" screen in portrait. |
| NFR-A11Y-04 | Sweaty-hands tolerance: no action requires a gesture only (swipe, long-press, drag) without a tap alternative. Destructive actions need confirmation or offer undo (WKT-12). There are no tiny precision targets on workout screens. |
| NFR-A11Y-05 | Readability in gym lighting: contrast ≥ 4.5:1 for text and ≥ 3:1 for UI components and graphical objects in both themes. Key numbers are large (WKT-02). Color is never the only carrier of meaning. |
| NFR-A11Y-06 | Screen readers (TalkBack): every control has an accessible name. Body-map regions are focusable and named. Charts have text summaries and table views (ANL-11). Timer state changes are announced politely without flooding. |
| NFR-A11Y-07 | Respects system font scaling up to 200% without loss of content or function. Layouts reflow at 320 CSS px width. |
| NFR-A11Y-08 | Respects reduced-motion preferences. Celebrations and transitions are reduced or replaced with static feedback. |
| NFR-A11Y-09 | Alerts are multimodal (visual + sound + vibration where available). Nothing flashes more than 3 times per second. |
| NFR-A11Y-10 | The heat map and charts use color-vision-deficiency-safe palettes, verified for protanopia, deuteranopia and tritanopia, plus non-color encodings for extremes. |
| NFR-A11Y-11 | An accessibility audit (automated + manual with TalkBack) is part of every major release (M12). |

### 6.6 Usability (NFR-USE)

| ID | Requirement |
|---|---|
| NFR-USE-01 | Logging efficiency: 1 tap for a set done as prescribed; ≤ 3 taps to change weight or reps (M1). |
| NFR-USE-02 | Onboarding core path ≤ 5 min median; with optional steps ≤ 8 min (M3). |
| NFR-USE-03 | Plain language first. Jargon (RIR, e1RM, deload, MEV…) is explained inline on tap and in the glossary. Novices see simplified wording (for example "reps left in the tank") with the technical term secondary. |
| NFR-USE-04 | Every suggestion has a "Why?" (PRG-09). Every warning states what the user can do about it. |
| NFR-USE-05 | Consistent input patterns: the same stepper/keypad/chip components everywhere, numeric keypad for numbers, and units always shown next to values. |
| NFR-USE-06 | Every list and chart has a helpful empty state and first-run guidance. |
| NFR-USE-07 | Tone follows MOT-10. |

### 6.7 Compatibility (NFR-COMP)

| ID | Requirement |
|---|---|
| NFR-COMP-01 | Primary target: Samsung Galaxy S22 with current stable Chrome for Android and current Samsung Internet. Both are fully supported for core flows and tested on the S22 (decided, OQ-06; C-14). Other Android browsers are best effort. |
| NFR-COMP-02 | Secondary: other modern Android phones on Android 10+ (Assumption A-10) with current Chrome, at CSS viewport widths 360–480 px, in portrait. Foldables and large phones remain usable (no broken layouts). |
| NFR-COMP-03 | iOS, iPadOS and desktop browsers are not targets (NG-05). The app should not deliberately block them, but no functionality or quality is committed there. |
| NFR-COMP-04 | The capability matrix (PWA-13) is updated for each release, covering at least the Galaxy S22 (Chrome, Samsung Internet) and one non-Samsung Android device (Chrome). |

### 6.8 Maintainability and testability (NFR-MNT)

| ID | Requirement |
|---|---|
| NFR-MNT-01 | Training logic is parameterized by versioned data tables with evidence tags and source IDs (PRG-18). Changing a default needs no code change. |
| NFR-MNT-02 | Calculation code is deterministic and covered by automated tests against reference values. Required suites: scoring formulas (implemented from official sources, LEG-08) against `EB §Scoring` test vectors and the cited official/OpenPowerlifting unit-test values, which serve as reference vectors only (100% pass); 1RM equations against the implied %1RM tables (`EB §Load › Rep-max equations`) and the RTS table (`EB §Load › RTS chart`); the warm-up generator (WKT-06); the plate calculator (WKT-07); EMA trend with gaps and outliers (BOD-02); volume crediting including techniques (EXL-05, WKT-04); deload, taper and return-from-break presets; `.ics` output against an RFC 5545 validator (CAL-01); backup round-trip (DAT-05). |
| NFR-MNT-03 | The backup format and the local schema are versioned and documented. Migration tests run for all historical versions. |
| NFR-MNT-04 | All user-facing strings are externalized, with no hard-coded UI text, so translation is possible later (NG-10). Units, numbers and dates go through central formatting. |
| NFR-MNT-05 | Automated end-to-end tests cover onboarding, a full workout, offline mode, the update flow (PWA-04) and interruption recovery (WKT-14). A manual device test protocol (TMR-06, PWA-13) runs before each release. |
| NFR-MNT-06 | Content (exercise library, mappings, templates, achievements, educational text) is maintained as validated data. A content linter enforces completeness (EXL-01) and coverage (EXL-01, EQP-04). |
| NFR-MNT-07 | An in-app changelog and versioned release notes exist for every release. |
| NFR-MNT-08 | The licence inventory (LEG-08) of all distributed dependencies and assets is maintained and checked in CI. The build fails on an unknown or unapproved licence, and on any copyleft licence without an approved review. The attributions screen (LEG-06) is generated from the inventory. |

### 6.9 Localization readiness (NFR-L10N)

| ID | Requirement |
|---|---|
| NFR-L10N-01 | UI language is English only. Number, date and time formats follow the device locale. Week start follows the locale unless overridden. |
| NFR-L10N-02 | Layouts tolerate about 30% longer strings (future translation) without truncating critical information. |

---

## 7. Content and data requirements

### 7.1 Exercise library content

| Field | Requirement |
|---|---|
| Identity | Stable ID, name, synonyms, variant family, substitution group(s) |
| Classification | Movement pattern (squat, hinge, horizontal/vertical push/pull, lunge, knee extension/flexion, elbow flexion/extension, shoulder abduction, hip extension/abduction/adduction, calf, core, carry, shoulder horizontal adduction (fly, pec deck), shoulder horizontal abduction (rear-delt fly), shrug, wrist flexion, wrist extension); mechanics (compound/isolation); competition-lift flag and "variant of" link |
| Equipment | Requirement expression ("all of" plus "any of" groups) referencing the EQP-01 catalog |
| Muscles | List of {muscle or sub-region, credit 1.0/0.5/0.25/0, evidence tag H/EMG/C, source ID} per `EB §Session › Mapping` |
| Load model | Load type (barbell, DB per hand, machine/stack, bodyweight + added, assisted, band, time); default increment; e1RM curve class (bench-like / leg-press-like / pooled); unilateral flag; bodyweight-loaded flag |
| Defaults | Rep range per goal, rest class (TMR-02), default tempo (TMR-10), fixed-ROM flag (competition lifts), "stretch emphasis" flag (MAP-03) |
| Guidance | 3–6 original execution cues, ROM cue, safety note where relevant; media reference (none in MVP; v1.x per OQ-08 decision and LEG-08) |
| Ranking inputs | Effectiveness factors per muscle (MAP-03), evidence-graded |

- **MVP size:** ≥ 150 exercises (Assumption A-05). Coverage: every body-map muscle group has ≥ 2 exercises crediting it ≥ 0.5 under every gym preset (EXL-01). Met with 190 exercises (content 0.3.0; see EXL-01).
- **Mapping defaults:** start from the evidence table in `EB §Session › Mapping`. Examples: squat does not credit hamstrings; rows credit elbow flexors 0.5; seated leg curl is preferred for hamstrings. Rows with "C" (convention) evidence are labelled in the UI.

### 7.2 Muscle taxonomy for the body map

| View | Display group (tappable) | Sub-regions (evidence-supported drill-down, MAP-07) |
|---|---|---|
| Front | Chest | Clavicular (upper), sternocostal (mid/lower) |
| Front | Front delts | — |
| Front + back | Side delts | — |
| Front | Biceps / elbow flexors | Biceps, brachialis |
| Front + back | Forearms | Flexors, extensors |
| Front | Abs | — |
| Front | Obliques | — |
| Front | Quadriceps | Vasti, rectus femoris |
| Front | Adductors | — |
| Front | Tibialis (optional, Could) | — |
| Back | Upper traps | — |
| Back | Mid back (mid/lower traps, rhomboids) | — |
| Back | Lats (incl. teres major) | — |
| Back | Rear delts | — |
| Back | Triceps | Long head, lateral/medial heads |
| Back | Lower back (spinal erectors) | — |
| Back | Glutes | Glute max, glute med/min (hip abductors) |
| Back | Hamstrings | Biarticular (BFLH, semitendinosus, semimembranosus), short head |
| Back | Calves | Gastrocnemius, soleus |

- Sub-regions roll up to their display group for volume (EXL-05). Body-map artwork must provide one hit region per display group in each view where the muscle is visible. The artwork is original, created for the app (decided, OQ-08).
- Pain-log regions (RDY-04) are a separate, joint-based region set: lumbopelvic, shoulder, hip, knee, elbow, wrist/hand, neck/thoracic.

### 7.3 Default parameter tables

All defaults ship as data (PRG-18). The source of truth is `EB §Defaults`. Owners must keep the evidence tags and `verified` flags in sync with `EB §Gaps`.

| Parameter set | Used by | Source |
|---|---|---|
| e1RM equation, effective reps, set weighting, RIR bias, load-for-target, smoothing noise, change thresholds | PRG-01, PRG-02, PRG-05, PRG-15 | `EB §Defaults › Load` |
| Volume bands, set counting, frequency, per-session caps, starting volume, maintenance, rep ranges, RIR/RPE targets | PLN-03, PLN-04, PLN-07, EXL-05, PLN-18 | `EB §Defaults › Volume` |
| Progression rules, increments, stall rule, periodization defaults | PRG-04…07, PLN-02, PLN-08 | `EB §Defaults › Progression` |
| Deload, taper, last heavy single, attempts, return from break | PRG-11…13, PLN-16, PLN-17 | `EB §Defaults › Deloads` |
| Expected gains, trainee classification | PRG-10, PRG-14, ANL-12 | `EB §Defaults › Expectations` |
| Rest, tempo, ROM, rotation, order, technique credits, warm-up ramp, stretching, concurrent training | TMR-02, TMR-10, PLN-05, PLN-06, WKT-04, WKT-06, PLN-19 | `EB §Defaults › Session` |
| Session RPE, readiness, spacing, sleep, ACWR display, load spike, pain alert, overreaching, scoring display | RDY-01…04, PLN-04, PRG-12, PRG-17, ANL-07, ANL-09 | `EB §Defaults › Monitoring` |
| Protein, bulk/cut rates, fat floor, carbs, RMR, energy density, adaptive TDEE, trend EMA, body-fat display, FFMI, meet cut, energy availability | BOD-02…09 | `EB §Defaults › Nutrition` |
| Scoring coefficients (Wilks, Wilks2020, DOTS, IPF Points, IPF GL) and clamps | ANL-07 | Official IPF documents and published coefficients (`EB §Scoring`). OPL test values are reference vectors only; no OPL code (LEG-08). |
| Ranking weights (effectiveness/focus) | MAP-03 | Composite score decided (OQ-09 = A); the weights are an app convention, labelled [INF] |

- **Excluded sources:** the retracted Barbalho trials and the related 2020 EJSS paper must not inform any parameter (`EB §How to read the evidence tags`, `EB §Gaps #23`).

### 7.4 Program templates

Templates per PLN-02 (style × days/week), each with: split, weekly structure, slot definitions (pattern, target muscles, prescription mode, rep range, effort target, rest class), progression model, mesocycle length, deload rules, and the meet-prep variant for PL. Templates are data, validated by the PLN-01 constraint tests.

### 7.5 Achievement definitions

Each achievement has: ID, name, description, category (strength, consistency, engagement, competition), criteria expression over local data, tier (bronze/silver/gold or numeric), normalization (absolute, bodyweight multiple with sex-specific thresholds, or percentile-based), icon, and an "unsafe-behavior check" sign-off (MOT-05). The initial catalog (≥ 30 achievements) is a design deliverable for v1.x. Examples:
- **Strength:** first 1/2/3/4 plates per side on squat/bench/deadlift; bodyweight multiples (for example bench 1× BW, squat 1.5×/2× BW, deadlift 2×/2.5× BW), with female and male thresholds aligned on comparable percentile positions in the norms (ANL-08); total milestones; GL/DOTS point milestones.
- **Consistency:** 4/12/26/52 kept weeks; 10/50/100/250/500 sessions; first complete mesocycle; first deload completed.
- **Competition:** first meet logged; 9/9 attempts; PR total at a meet.
- **Engagement:** first backup made; first custom exercise; first progress photo comparison.

### 7.6 Educational content

Short explainers (≤ 150 words each) linked from the UI: RIR/RPE, e1RM and why it fluctuates, fractional sets, volume bands, deloads, tapering and attempts, rest periods, warm-ups, readiness, bodyweight trend vs daily weight, protein targets, safe weight cuts. Each explainer cites the `EB` section it summarizes and carries the user-friendly evidence label (LEG-05).

### 7.7 Conceptual data entities (for the technical concept)

These are logical entities only; schema design is left to the technical concept:
- Profile, Settings
- EquipmentProfile, EquipmentItem, PlateSet, DumbbellSet
- Exercise, MuscleCredit, Muscle/SubRegion
- Plan, Mesocycle, PlannedWeek, PlannedSession, PlannedSlot (prescription)
- Session, SessionExercise, Set (type, load, reps, RIR/RPE, duration, rest, flags)
- ReadinessEntry, PainEntry
- BodyweightEntry, MeasurementEntry, PhaseGoal, Annotation, ProgressPhoto
- MeetInfo, AttemptPlan
- Derived: E1rmEstimate, PR, VolumeSummary, Streak, AchievementUnlock
- BackupMeta, ParameterTableVersion, ContentVersion

The backup format must cover all non-derived entities. Derived entities may be recomputed on import (NFR-REL-03).

### 7.8 Evidence items to resolve in the engine specification

These come from the evidence base and must be decided when the progression and nutrition logic is specified in detail. They are not user decisions.

| ID | Item | Source | Proposed handling |
|---|---|---|---|
| E-1 | Default for sets logged without RIR/RPE: assume 2–3 RIR, or mark non-informative. Assuming RIR > 0 raises e1RM, so this is not automatically "conservative". | `EB §Defaults › Load` | Mark non-informative for e1RM PRs. Use a prior for trend estimation with wide uncertainty. Decide in the engine spec. |
| E-2 | Preprint-derived volume tiers and per-session caps | `EB §Gaps #1` | Ship with `verified=false`. Recheck against the published papers. |
| E-3 | Exercise-class curves beyond bench/leg press | `EB §Gaps #5` | Three classes, then personal curves |
| E-4 | Unvalidated 0.25 credits and technique credits | `EB §Gaps #6`, `#14` | Label as heuristic. User-overridable. |
| E-5 | Unverified body-fat and RMR equations | `EB §Gaps #18` | Block the unverified ones until verified |
| E-6 | IPF vs OPL coefficient differences | `EB §Gaps #17` | Use IPF document values |
| E-7 | Volume progression within and between mesocycles | `EB §Gaps #8` | Small steps, ≤ 1.2× recent volume, judged over weeks |
| E-8 | RIR correction and VBT presets pending further reading | `EB §Gaps #26` | Verification pass before finalizing PRG-15 |

---

## 8. Legal and compliance (public release)

This section lists requirements and the topics for professional legal review. It is not legal advice.

### 8.1 Health and safety disclaimer (content requirements)

- The app provides general fitness information and training suggestions. It is **not medical advice** and does not replace a physician, physiotherapist, dietitian or qualified coach.
- Users should consult a physician before starting or changing a training or nutrition program, especially with known conditions, pregnancy, or prior injuries.
- Stop training and seek medical help on chest pain, dizziness, shortness of breath or acute pain.
- Lifting heavy weights carries injury risk. Use safe technique, spotters or safety equipment (rack safeties).
- Nutrition targets and weight-cut guidance are estimates for healthy adults. They are not suitable for people with eating disorders, during pregnancy, or for minors (cut planner disabled for under-18s).
- The user is responsible for decisions made with the app's suggestions ("suggests, you confirm").

### 8.2 Privacy notice (content requirements)

Even though no data leaves the device, a privacy notice is required. It must cover:
- What data the app stores (training, body metrics, photos, check-ins, settings), where (only on the device, in browser storage), and why.
- The responsible publisher: **Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland**, with contact details (LEG-09).
- That the publisher does **not** collect, receive or process this data. There is no account, analytics, telemetry or tracking (decided, OQ-05).
- Hosting: the website/app files are served by a static host that may log technical request data (for example IP address, user agent). Name the host and its retention policy (NFR-PRIV-06).
- Permissions used (notifications, camera) and their purpose.
- Backups: exported files are under the user's control. Sharing or storing them elsewhere (for example cloud drives) is subject to those services' terms. Optional encryption (DAT-10).
- Data loss risks: clearing browser data, uninstalling, or browser eviction can delete data. Recommend backups.
- How to delete all data (DAT-13).
- Legal framework, **to be confirmed in legal review** (V-06):
  - The Swiss Federal Act on Data Protection (revFADP / nDSG, in force since 1 September 2023) is the primary privacy framework, because the publisher is based in Switzerland.
  - The EU GDPR may also apply, because the app is publicly available to users in the EU.
  - The notice should be drafted so that it can meet the transparency requirements of both, if legal review confirms that both apply.

### 8.3 Regulatory positioning

- POWR is a general wellness and fitness product for healthy individuals. To stay outside medical-device regulation in major markets (relevant frameworks, for example the Swiss Medical Devices Ordinance and the EU MDR, to be confirmed in legal review), product claims must avoid diagnosis, treatment, mitigation or prevention of disease or injury (LEG-07). Pain logging is self-tracking with referral advice. No injury-risk scores (`EB §Gaps #25`).
- Health data processed only on the user's device is generally not processed by the publisher, and there is no telemetry (OQ-05). Remaining processing still needs checking: static-hosting logs, and diagnostics files or e-mails that users choose to send with feedback. Whether the revFADP and, for EU users, the GDPR apply to it is **to be confirmed in legal review** (V-06).
- Distribution is by web URL only (decided, OQ-03; NG-16). App-store policies (privacy-policy URL, data-safety forms, health-app and target-audience declarations) do not apply unless a store listing is decided later.

### 8.4 Third-party data and asset licensing

| Asset | Requirement / risk | Status |
|---|---|---|
| Strength percentile norms (van den Hoek 2024 or equivalent) | Decided route (OQ-07 = B/D, closed source): build-time derivation with the app's own code from a competition dataset whose licence permits closed-source use without share-alike obligations, or the published tables only with written permission. No percentiles until cleared. | Decided; licence review pending (V-03; `EB §Gaps #16`) |
| OpenPowerlifting-derived material | OPL source code is AGPL and must **not** be ported, copied or adapted into this closed-source app (LEG-08). Scoring formulas are reimplemented from the official IPF documents and the published coefficients. OPL unit-test values are used only as reference test vectors. Any use of OPL competition data needs a licence review. | Decided (OQ-04) |
| Software dependencies (runtime, distributed) | Permissive licences only. Copyleft (GPL, AGPL, LGPL and others) is blocked unless approved in a documented licence review (LEG-08, NFR-MNT-08). | Decided (OQ-04) |
| Scoring formula names (IPF GL, DOTS, Wilks) | Use the names descriptively. Do not use federation logos or imply endorsement. | Requirement |
| Body-map artwork | Original artwork created for the app, or commissioned with a written transfer or exclusive licence of rights. Third-party art only under permissive terms after licence review. Share-alike and non-commercial terms are excluded by default. | Decided (OQ-08) |
| Exercise media (images/animations) | None in MVP. In v1.x, preferably commissioned with full rights. Third-party datasets only if permissively licensed (CC0, CC BY, public domain) and approved in licence review. Share-alike (e.g. CC BY-SA) and non-commercial (e.g. CC BY-NC) content is excluded by default. | Decided (OQ-08) |
| Exercise names, cues and mappings | Write original text. Do not copy descriptions from other apps or sites. | Requirement |
| Pre-participation questionnaire wording (LEG-04) | Use original wording, or verify reuse terms of standardized questionnaires | To verify |
| Fonts, icons, sounds | Permissive licences or SIL OFL (fonts), with attribution. Recorded in the inventory (LEG-08) and shown on the attributions screen (LEG-06). | Requirement |
| Third-party trademarks in import guides (Samsung, Google) | Nominative use only, no logos | Requirement |
| Product name "POWR" (working title) | Trademark check in Switzerland and the EU before public launch. "POWR" stays the working title until it is cleared. | Decided (OQ-10); check pending (V-05) |

### 8.5 Age and audience

Minimum age is 16 (decided, OQ-10; C-15), confirmed at onboarding (LEG-03), with under-18 restrictions. Any future store age rating must match.

### 8.6 Publisher and imprint

- **Publisher:** Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland. The website and the app identify both the person and the trading name, as given here (LEG-09). Contact e-mail: tools@sz-development.com. The postal contact address is still to be provided; a release check blocks production until it is (LEG-09).
- **Imprint requirements** are to be confirmed in legal review (V-06). This covers Swiss requirements for identifying the provider of an online offer, and any EU member-state requirements because the app is publicly available to EU users.
- **Privacy framework** (§8.2): revFADP/nDSG as primary; GDPR applicability for EU users to be confirmed in legal review.

---

## 9. Constraints, assumptions and risks

### 9.1 Platform realities (verified 2026-11-23 unless marked "verify")

| ID | Reality | Consequence for requirements |
|---|---|---|
| P-01 | **No reliable future-scheduled local notifications for a serverless PWA.** The Notification Triggers API never shipped; Chrome's documentation states its development has ended. Push messaging needs a server (excluded). | Rest-end alerts while hidden are best effort (TMR-06). Backup reminders are in-app (DAT-08). Workout reminders are delegated to the calendar app via `.ics` alarms (CAL-02). |
| P-02 | **Background timer throttling.** In Chrome, timers on hidden pages are checked at most once per second. After 5 minutes hidden (with chained timers and ≥ 30 s silence), they are checked only once per minute ("intensive throttling"). Pages that play audio are exempt. Android may additionally freeze or kill backgrounded pages (verify on device). | Timers must be timestamp-based (TMR-04). Alerting while hidden is a key risk (R-01, TC-03). |
| P-03 | **Storage can be evicted.** Without persistent storage, browsers may evict site data under storage pressure (least recently used origin first). Chromium grants persistence silently, based on heuristics: site engagement, installation or bookmarking, and notification permission. Users can always clear site data. | DAT-03, DAT-05, DAT-08, privacy notice wording (§8.2). |
| P-04 | **Web Share file-type allowlist.** Chrome (including Android) only shares files of permitted types: images, audio, video, PDF, plain text, CSV, HTML and CSS. **`.ics`, `.json` and `.zip` are not permitted** (checked in Chromium source). Samsung Internet: verify. | `.ics` and backup delivery default to file download (CAL-05, DAT-05). Web Share is used for text, images and CSV (PWA-09, DAT-11). |
| P-05 | **Calendar import behavior varies.** Google documents `.ics` import through Google Calendar on the web (computer). Support for opening `.ics` files in the Google Calendar Android app depends on the app version. Samsung Calendar's import of multi-event files, and update/duplicate behavior on re-import, must be verified on the Galaxy S22. | CAL-01, CAL-04, CAL-05 acceptance depends on a device test. The import guide must match the verified behavior. |
| P-06 | **No web APIs** for Samsung Calendar or the Android calendar provider, Health Connect, Samsung Health or Google Fit. | NG-03, NG-04 |
| P-07 | Install UX differs between Chrome (programmatic install prompt available) and Samsung Internet (verify). | PWA-02 |
| P-08 | A Screen Wake Lock is released automatically when the page is hidden and must be re-acquired. Support in Samsung Internet: verify. | PWA-06 |
| P-09 | Vibration requires prior user interaction with the page and likely does not work while hidden (verify on device). | PWA-07, TMR-06 |
| P-10 | Opening files through OS file associations (File Handling) is not available on Android (verify). Files are opened with a file picker or received through a share target (verify). | DAT-06, PWA-10 |

### 9.2 Constraints

| ID | Constraint | Source |
|---|---|---|
| C-01 | Progressive Web App; no native app, no backend server; static hosting only | Braindump; user answers (sync, audience) |
| C-02 | No user account; local profile only | Braindump; user answer (sync) |
| C-03 | All data stored locally; transfer only by user-initiated backup file export/import | Braindump; user answer (sync) |
| C-04 | Android target: Galaxy S22 primary; other modern Android phones supported; iOS not a target | User answer (device) |
| C-05 | Public release: polished onboarding, disclaimer, privacy notice, accessibility | User answer (audience) |
| C-06 | English only, strings externalizable | User answer (language) |
| C-07 | Training logic grounded in and traceable to the evidence base | Task brief; `EB` |
| C-08 | This PRD fixes requirements, not architecture (no framework, database or host choices) | Task brief |
| C-09 | Free and closed source: no ads, no paid tiers, no copyleft dependencies, licence-reviewed third-party content (LEG-08) | User decision OQ-04 (2026-11-23) |
| C-10 | Pure PWA with no native wrapper. Timer-alert baseline: Screen Wake Lock during workouts, sound and vibration while visible, best-effort notification while hidden, honest status note in settings | User decision OQ-01 (2026-11-23) |
| C-11 | Distribution by web URL only; users install from the browser | User decision OQ-03 (2026-11-23) |
| C-12 | No telemetry, analytics or crash reporting (not even opt-in); user-initiated diagnostics export only | User decision OQ-05 (2026-11-23) |
| C-13 | Publisher: Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland. Privacy framework: revFADP/nDSG primary; GDPR applicability for EU users to be confirmed in legal review | User decision OQ-10 and publisher details (2026-11-23) |
| C-14 | Browsers: Chrome primary; Samsung Internet fully supported for core flows; both tested on the Galaxy S22 | User decision OQ-06 (2026-11-23) |
| C-15 | Minimum age 16, with under-18 restrictions on nutrition and cut features | User decision OQ-10 (2026-11-23) |

### 9.3 Assumptions

| ID | Assumption | Impact if wrong | Status |
|---|---|---|---|
| A-01 | Working product name "POWR" (from the project folder) | Branding, trademark | Confirmed (OQ-10); trademark check pending (V-05) |
| A-02 | One local profile per installation | Data model, UI | — |
| A-03 | Sessions are scheduled on fixed weekdays, with flexible rescheduling (not a pure rolling A/B/C sequence) | Scheduling, streak, calendar export | — |
| A-04 | Minimum age 16; under-18 restrictions on nutrition and cut features | Legal, onboarding | Resolved → C-15 |
| A-05 | MVP exercise library ≥ 150 exercises, text cues only | Content effort | Confirmed (OQ-08); met with 190 exercises (EXL-01) |
| A-06 | MVP restore is replace-all (no merge) | Import complexity | — |
| A-07 | A week is "kept" if completed ≥ planned sessions; optional grace of 1 session | Motivation mechanics | — |
| A-08 | Programming targets raw/classic lifters; equipped only for scoring | PL scope | — |
| A-09 | Chrome is the primary browser; Samsung Internet is supported for core flows | Test matrix | Resolved → C-14 |
| A-10 | Android 10+ | Compatibility testing | — |
| A-11 | Reference dataset for budgets: about 5 years, 1,300 sessions, 40,000 sets, 1,800 bodyweight entries | Performance design | — |
| A-12 | Default e1RM equation: Wathan on effective reps | Engine | — |
| A-13 | The app is free, without ads | Licensing, distribution | Resolved → C-09 (free, closed source) |
| A-14 | Small team; phased delivery per §10 | Scope | Confirmed (OQ-02) |
| A-15 | MVP body map uses one neutral figure | Artwork | Confirmed (OQ-08) |
| A-16 | Progress photos compressed to about 500 KB by default; photo backup optional | Storage, backup size | — |
| A-17 | Calorie recalibration relies on the user's self-reported adherence (no food log) | Nutrition accuracy | — |
| A-18 | A unilateral set counts once for volume when both sides are done | Volume calculation | — |
| A-19 | Bodyweight-loaded exercises compute e1RM from bodyweight + added load; pure bodyweight exercises use rep progression only | Engine | — |
| A-20 | "Levels" means strength levels from percentiles or points, not XP from app usage | Motivation design | — |
| A-21 | The readiness check-in is on by default and can be skipped with one tap | Friction vs autoregulation | — |
| A-22 | Default backup reminder: every 14 days or 8 sessions (7 days without persistent storage) | Data safety | — |

### 9.4 Questions the technical concept must resolve

| ID | Question | Related requirements |
|---|---|---|
| TC-01 | Storage approach for structured data and binary photos: transactional guarantees, quota handling, eviction detection, persistence request timing | DAT-01…04, NFR-REL-01/02 |
| TC-02 | Canonical representation and precision of loads and units (kg/lb, plate units) without drift | NFR-REL-07, SET-02 |
| TC-03 | **Timer and alert architecture** under throttling and freezing: timestamp model, what happens when hidden, notification feasibility, wake-lock policy. Implements the decided baseline (OQ-01 = A, C-10): no native wrapper. Includes a device spike on the Galaxy S22 (Chrome + Samsung Internet; screen locked; app switched; battery saver on/off; 1, 3, 5+ min rests) that is mandatory (V-01) and feeds the in-app status note. | TMR-04…06, PWA-06…08 |
| TC-04 | Service-worker caching and update strategy: never update during a session, atomic migrations, rollback | PWA-03, PWA-04, DAT-14 |
| TC-05 | Calculation engine design: deterministic, testable, driven by versioned parameter tables; recompute strategy for derived data | PRG-18, NFR-REL-03, NFR-MNT-01/02 |
| TC-06 | Backup format: container, schema, checksum, compression, photo handling and splitting, encryption, version policy | DAT-05…10, NFR-MNT-03 |
| TC-07 | `.ics` generation: time-zone strategy, UID scheme, alarms, re-import semantics; delivery mechanism given P-04 | CAL-01…05 |
| TC-08 | Chart rendering approach that meets performance, interaction and accessibility requirements in both themes | ANL-02…11, NFR-PERF-05, NFR-A11Y |
| TC-09 | Body-map artwork format, hit-testing, sub-region drill-down, accessibility semantics | MAP-01…07, §7.2 |
| TC-10 | Image pipeline: capture, EXIF stripping, compression, thumbnails, storage, deletion | MOT-07, NFR-PRIV-05 |
| TC-11 | Capability matrix and degradation strategy per browser (Chrome and Samsung Internet both supported, C-14) | PWA-13, NFR-COMP, V-07 |
| TC-12 | Hosting set-up: static, HTTPS, CSP, minimal logs, custom domain | NFR-SEC-01, NFR-PRIV-06 |
| TC-13 | Test strategy: unit (engine and content), end-to-end (offline, update, interruption), real-device protocol, accessibility audit | NFR-MNT-02/05, NFR-A11Y-11 |
| TC-14 | Performance strategy for large histories (indexing, aggregate caching) | NFR-PERF |
| TC-15 | Plan generator approach that meets the PLN-01 constraints deterministically | PLN-01…06 |
| TC-16 | String externalization and locale formatting approach | NFR-MNT-04, NFR-L10N |
| TC-17 | Closed: distribution is web URL only (OQ-03, C-11). Store packaging is only revisited if a store listing is decided later, and then without native code (C-10). | OQ-03 |
| TC-18 | Licence-compliance tooling: generating the licence inventory, a CI check that fails on unknown, unapproved or copyleft licences, and generating the attributions screen | LEG-06, LEG-08, NFR-MNT-08 |

### 9.5 Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Rest-end alerts arrive late or not at all when the user locks the phone or leaves the app despite the wake lock. This is a limitation accepted with the pure-PWA decision (OQ-01; P-01, P-02). Still tracked. | Medium | Medium | Wake lock on by default during workouts (PWA-06). Timestamp timers (TMR-04). Sound and vibration while visible (TMR-05). Best-effort notification while hidden (PWA-08). Honest status note in settings (TMR-06, SET-04). Mandatory S22 device test (V-01). Re-evaluate if V-01 shows that the wake lock itself is unreliable on a supported browser. |
| R-02 | Data loss through eviction, "clear browsing data", uninstall or a lost phone | Medium | Very high | Persistent storage request. Prominent backup reminders. Last-backup indicator. Clear warnings in onboarding and the privacy notice. Easy export. |
| R-03 | Users never back up, then switch phones | High | High | Reminders after N sessions. Backup in onboarding. "Moving to a new phone" guide. Share-target restore (PWA-10). |
| R-04 | `.ics` import behaves differently across calendar apps (duplicates, no updates, Google Android limits) | Medium | Medium | Device verification (P-05). Clear import guide. Stable UIDs. Re-export guidance. |
| R-05 | Samsung Internet lacks or differs in capabilities (install prompt, wake lock, share) | Medium | Medium | Capability detection and fallbacks. Both browsers are supported and tested (C-14, V-07). |
| R-06 | Evidence gaps: many defaults are heuristics or preprint-based and could give suboptimal suggestions | Medium | Medium | Versioned parameter tables. Labels. Conservative defaults. User override. Calibration loop. Planned re-verification (§7.8). |
| R-07 | e1RM noise causes false PRs or misleading trends | High | Medium | Set weighting, smoothing, reliability labels, separate rep PRs (PRG-01/02, MOT-01). |
| R-08 | Liability: injury or health harm attributed to suggestions (heavy loads, weight cuts) | Low | High | Disclaimers, guardrails (BOD-08/09), no failure on heavy compounds by default, under-18 restrictions, wellness-scope claims (LEG-07), legal review. |
| R-09 | Licence violations in a closed-source app: copyleft code (for example AGPL scoring code, GPL/LGPL libraries) or share-alike/non-commercial datasets, artwork or media slipping in | Medium | High | Licence policy and inventory (LEG-08). CI check that fails the build (NFR-MNT-08, TC-18). Scoring reimplemented from official sources. Original or commissioned content (OQ-08). Licence reviews before use (V-03, V-04). |
| R-10 | Scope too large for the team; MVP slips | High | High | Phased releases (§10). MVP cut confirmed by the user (OQ-02). Data-driven content to parallelize work. |
| R-11 | Photo storage grows large; backups become huge or fail | Medium | Medium | Compression, photo-optional backups, split files, storage display (DAT-04, DAT-09). |
| R-12 | No analytics, so usage problems and crashes go undetected | High | Medium | Pilot usability tests, user-initiated diagnostics export (DAT-16), feedback channel. No telemetry by decision (OQ-05, C-12), so these are the only sources. |
| R-13 | A schema migration bug on update corrupts local data | Low | Very high | Safety snapshots, atomic migrations, migration test suite, staged rollout via the update flow (PWA-04). |
| R-14 | Browser platform changes (APIs deprecated, new throttling) | Medium | Medium | Capability detection, release-time device tests, no reliance on unstable APIs. |
| R-15 | Battery drain from keeping the screen on | Medium | Low | Wake lock only during active sessions. User toggle. Dark theme on OLED. |
| R-16 | Users misreport RIR (bias), which degrades RPE-based loads | High | Medium | Bias defaults, calibration loop (PRG-15), novice-friendly RIR input, conservative calibration period. |
| R-17 | Closed source means users cannot inspect the code to verify the privacy claims, which weakens trust | Medium | Medium | No runtime network requests after load, verifiable in browser tools and airplane mode (NFR-PRIV-02). Strict CSP (NFR-SEC-01). No telemetry (C-12). Plain-language privacy notice (LEG-02). |
| R-18 | Legal obligations for a Swiss publisher of a public app used by EU users are not yet confirmed: revFADP, possible GDPR applicability, imprint, medical-device positioning | Medium | Medium | Legal review before public launch (V-06). Privacy notice drafted to meet both revFADP and GDPR transparency requirements. No telemetry keeps processing minimal. Wellness-scope claims only (LEG-07). |

---

## 10. Release plan

### 10.1 Releases

The release cut below was confirmed by the user on 2026-11-23 (OQ-02 = A).

| Release | Theme | Scope (requirement IDs) |
|---|---|---|
| **MVP (v1.0)** | *Train and track*: the full core loop for all personas | ONB-01…13; EQP-01…05, 07; EXL-01…05, 07…09; MAP-01…06; PLN-01…15; WKT-01…16; TMR-01…13; PRG-01…13, 18; RDY-01…03; ANL-01…07, 11; MOT-01…04, 10; BOD-01…03; CAL-01…05; DAT-01…08, 13, 14; SET-01…06, 08…11; PWA-01…09, 12…14; LEG-01…09; all NFRs |
| **v1.1** | *Meet prep*: powerlifting competition support | PLN-16, PLN-17; BOD-08 (cut-related part), BOD-09; ANL-08; MOT-06; CAL-06 |
| **v1.2** | *Physique*: body composition and motivation depth | BOD-04…08, BOD-10; MOT-05, 07, 08, 09; PWA-11; DAT-09; MAP-07, MAP-08 |
| **v1.3** | *Insight and safety* | RDY-04; PRG-14…17; ANL-09, ANL-10; EQP-06; EXL-06, EXL-10; DAT-10, DAT-11, DAT-16; PWA-10; WKT-17, WKT-18; TMR-14, TMR-15; PLN-18; SET-07 |
| **Later** | Candidates | DAT-12 (import from other apps); PLN-19 (cardio); PLN-20 (meet-day mode); RDY-05, RDY-06; MAP-09; ANL-12; manual velocity entry or Bluetooth VBT device import (`EB §Progression › VBT`); app-level lock; merge import; translations; iOS evaluation |

The order of v1.1–v1.3 can change. They are grouped by theme so each release is coherent.

### 10.2 Rationale

- **The MVP must close the core loop** (plan → log → progress → plan) for bodybuilders, powerlifters and hybrids, offline and with data safety. Without it, nothing else has value. Logging, timers, the progression engine, backup/restore and offline operation therefore form the MVP spine.
- **Braindump headline features are in the MVP:** body map, equipment filtering, custom exercises, timers with defaults, RIR-based planning, onboarding, light/dark mode, interactive charts, calendar connection, offline, and PWA integration.
- **Motivation from day 1 at low cost:** PR detection, celebrations and weekly streaks need no extra data or licences, so they ship in the MVP. Achievements and strength levels depend on percentile data licensing (OQ-07: licence review, with a fallback to points and milestones) and a content catalog. Progress photos add storage, privacy and backup-size complexity. Both are v1.x.
- **Powerlifting meet prep (v1.1)** builds on reliable e1RM trends and bodyweight trends from the MVP. In the MVP, meet details are already captured and the scoring calculator is available.
- **Nutrition targets (v1.2)** need a stable bodyweight trend (MVP) and verified equations (`EB §Gaps #18`). Shipping the guardrails (BOD-08) together with the first nutrition feature is mandatory.
- **v1.3 features** (plateau detection, RIR calibration, volume adaptation, pain logging) benefit from users having months of data, so they are naturally later.

### 10.3 MVP exit criteria

- All MVP Must requirements pass acceptance. Should requirements are either passing or explicitly deferred with a note.
- Success metrics M1, M3, M4, M9–M12 are met in testing.
- The device test protocol (TMR-06, PWA-13) is completed on the Galaxy S22 (Chrome, Samsung Internet) and one other Android device. This is mandatory under the OQ-01 decision (V-01). The `.ics` import is verified (V-02).
- Legal texts (§8) are reviewed (V-06). The trademark check is done (V-05).
- The licence inventory is complete with no unapproved or copyleft licences (LEG-08, V-04). The attributions screen is complete (LEG-06).
- Backup round-trip and migration tests are green.

---

## 11. Decisions on the open questions

The user answered all ten open questions from v0.1 on **2026-11-23**. **No open questions remain.** §11.2 lists the validation tasks still outstanding. They check decided items and are not open decisions.

### 11.1 Decision log (all resolved 2026-11-23)

**OQ-01 · Rest-timer alerts with the screen locked** · **Resolved 2026-11-23: option A**
- *Decision:* The app stays a **pure PWA with no native wrapper**. During workouts it keeps the screen awake (Screen Wake Lock). It plays sound and vibrates when the app is visible, sends a best-effort notification when the page is hidden, and shows an honest status note in settings about what works on the current browser.
- *Options not chosen:* (B) reliable lock-screen alerts through a native or hybrid shell; (C) alerts only while the app is visible.
- *Consequences:* TMR-06, PWA-08, SET-04 updated; C-10 and NG-14 added; R-01 lowered to Medium/Medium but still tracked; TC-03 implements the baseline. The Galaxy S22 device test is a mandatory validation item (V-01).

**OQ-02 · MVP cut** · **Resolved 2026-11-23: option A (as proposed)**
- *Decision:* The MVP is the core loop (§10.1). Then v1.1 meet prep, v1.2 physique, v1.3 insight and safety.
- *Options not chosen:* (B) meet prep in MVP; (C) physique features in MVP; (D) smaller MVP with the generator in v1.1.
- *Consequences:* §10 confirmed; A-14 confirmed; R-10 updated.

**OQ-03 · Distribution channel** · **Resolved 2026-11-23: option A (proposed default confirmed)**
- *Decision:* Web URL only. Users install from the browser. No app-store listing.
- *Options not chosen:* (B) web plus Google Play; (C) web plus Google Play and Galaxy Store. A future store listing would need a new decision and must not add native code (C-10).
- *Consequences:* C-11 and NG-16 added; §8.3 store obligations out of scope; TC-17 closed; PWA-02 is the only install path.

**OQ-04 · Business and licensing model** · **Resolved 2026-11-23: free, closed source** (differs from the proposed default, which was free and open source)
- *Decision:* The app is free and closed source. No ads, no paid tiers.
- *Consequences:*
  - **Code:** no copyleft dependencies. GPL, AGPL and LGPL (and other copyleft licences) are blocked unless a licence review approves a specific use (LEG-08, NFR-MNT-08, TC-18).
  - **Scoring:** OpenPowerlifting's AGPL source code is not ported. The scoring formulas are reimplemented from the official IPF documents and the published coefficients. OPL unit-test values serve only as reference test vectors (ANL-07, NFR-MNT-02, §8.4).
  - **Content:** third-party exercise or media datasets with share-alike or non-commercial terms need a licence review before use, and are excluded by default (EXL-10, LEG-08, §8.4).
  - **New and changed requirements:** LEG-08 (licence policy and third-party licence/attribution inventory) is new. LEG-06 is reworked into the in-app "Open-source licences / attributions" screen. C-09, NG-15, R-09 (revised), R-17 (new).
  - OQ-07 and OQ-08 were re-evaluated for closed source (below).

**OQ-05 · Diagnostics and analytics** · **Resolved 2026-11-23: option A (proposed default confirmed)**
- *Decision:* No telemetry, analytics or crash reporting, not even opt-in. The only diagnostics path is a file the user exports and chooses to share (DAT-16).
- *Options not chosen:* (B) opt-in reporting to a self-hosted endpoint; (C) opt-in third-party crash reporting.
- *Consequences:* NFR-PRIV-01, §2.2, §8.2, §8.3, R-12 updated; C-12 and NG-17 added.

**OQ-06 · Browser support scope** · **Resolved 2026-11-23: option A (proposed default confirmed)**
- *Decision:* Chrome is primary. Samsung Internet is fully supported for core flows. Both are tested on the Galaxy S22. Other Android browsers are best effort.
- *Options not chosen:* (B) Chrome only; (C) all major Android browsers.
- *Consequences:* NFR-COMP-01, R-05, TC-11 updated; C-14 added; A-09 resolved.

**OQ-07 · Source of strength-percentile data** · **Resolved 2026-11-23: options B/D, re-evaluated for closed source (proposed default confirmed)**
- *Decision:*
  - **B:** percentile tables are derived at build time, with the app's own processing code, from a competition dataset whose licence permits use in a free, closed-source app, without share-alike obligations on the derived tables or the app. The method is documented and validated against van den Hoek 2024.
  - **D:** until a licence review clears such a dataset, strength levels ship without percentiles and use GL/DOTS points and bodyweight-multiple milestones only.
  - The published van den Hoek tables (option A) may be used only with written permission from the authors or publisher.
  - Non-peer-reviewed web standards (option C) are not used. They are not peer-reviewed, and reusing them in a proprietary app is not licensed.
  - No AGPL code or tooling is copied to process the data.
- *Consequences:* ANL-08, MOT-06 and §8.4 updated; licence review V-03.

**OQ-08 · Exercise media and body-map artwork** · **Resolved 2026-11-23: option A, re-evaluated for closed source (proposed default confirmed)**
- *Decision:*
  - **MVP:** original body-map artwork created for the app, original text cues, and muscle highlighting. No exercise images.
  - **v1.x:** exercise media and any further artwork are preferably commissioned with a written transfer or exclusive licence of rights covering distribution in the app (option C).
  - Third-party datasets (option B) are used only if permissively licensed (for example CC0, CC BY or public domain) and approved in licence review. Content with share-alike (for example CC BY-SA) or non-commercial (for example CC BY-NC) terms is excluded by default.
- *Consequences:* EXL-10, MAP-08, §7.1, §7.2, §8.4 updated; A-05 and A-15 confirmed; licence reviews V-04.

**OQ-09 · Meaning of "effectiveness" in the body-map ranking** · **Resolved 2026-11-23: option A**
- *Decision:* A transparent composite score built from mapping credit, evidence strength, stretch-position loading, suitability for progressive overload, and sub-region coverage. Tapping it shows an explanation. A separate "Focus" sort is also offered.
- *Options not chosen:* (B) curated editorial ranking; (C) sort by credit only.
- *Consequences:* MAP-03 decided; §7.3 ranking-weights row updated.

**OQ-10 · Legal basics: publisher, jurisdiction, minimum age, product name** · **Resolved 2026-11-23: option A (proposed default confirmed) plus publisher details**
- *Decision:*
  - **Minimum age:** 16, with under-18 restrictions on nutrition and cut features (LEG-03, C-15).
  - **Publisher:** **Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland.** Both the person and the trading name are named, exactly as given.
  - **Privacy framework, to be confirmed in legal review:** the Swiss Federal Act on Data Protection (revFADP / nDSG, in force since 1 September 2023) is the primary framework. The EU GDPR may also apply, because the app is publicly available to EU users.
  - **Product name:** "POWR" stays the working title, pending a trademark check in Switzerland and the EU.
- *Options not chosen (age):* (B) 18+ only; (C) 13+.
- *Consequences:* LEG-02 and LEG-03 updated; LEG-09 (publisher identification/imprint) and §8.6 added; §8.2, §8.3, §8.5 updated; C-13 and C-15 added; A-01 and A-04 resolved; R-18 added; validation tasks V-05 and V-06.

### 11.2 Remaining validation tasks (no open decisions)

| ID | Validation task | Owner | Due before | Related |
|---|---|---|---|---|
| V-01 | **Galaxy S22 device test of the timer-alert baseline (mandatory).** Chrome and Samsung Internet; screen locked; app backgrounded; battery saver on/off; 60 s / 3 min / 5 min rests; wake lock, sound, vibration and notification behavior. Results go into the capability matrix and the in-app status note. | Technical concept / QA | Technical-concept sign-off (spike) and MVP release (final run) | TMR-06, PWA-06…08, PWA-13, TC-03, R-01 |
| V-02 | `.ics` import on the Galaxy S22: Samsung Calendar and Google Calendar (Android app and web). Covers multi-event import, alarms, and whether re-import updates events or duplicates them. | QA | MVP release | CAL-01…05, P-05, R-04 |
| V-03 | Licence review of the competition dataset for percentile derivation: closed-source use, share-alike effects on derived tables, attribution | Publisher / legal review | v1.1 (ANL-08) | OQ-07, ANL-08, LEG-08 |
| V-04 | Licence review of every third-party dependency, font, icon, sound, artwork or media item before it is included | Development | Each release | LEG-08, NFR-MNT-08 |
| V-05 | Trademark check for "POWR" in Switzerland and the EU | Publisher | Public launch | OQ-10, §8.4 |
| V-06 | Legal review of the privacy notice, health disclaimer and imprint. Covers revFADP/nDSG as the primary framework, GDPR applicability for EU users, imprint content, and medical-device positioning. | Publisher / legal review | Public launch | LEG-01, LEG-02, LEG-07, LEG-09, §8 |
| V-07 | Samsung Internet and Android capability checks marked "verify" in §9.1: install UX, wake lock, vibration, page freezing, share target, file handling | Technical concept | Technical-concept sign-off | P-02, P-07…P-10, TC-11 |
| V-08 | Evidence items E-1…E-8 resolved in the engine specification | Technical concept | MVP (E-1…E-4, E-6, E-7); v1.x (E-5, E-8) | §7.8 |

---

## 12. Glossary

| Term | Definition |
|---|---|
| 1RM | One-repetition maximum: the heaviest load lifted once with proper form |
| e1RM | Estimated 1RM, computed from a submaximal set (load, reps, RIR) with a rep-max equation |
| RIR | Reps in reserve: how many more reps could have been done before failure |
| RPE | Rating of perceived exertion. On the RIR-based scale, RPE = 10 − RIR (RPE 8 = 2 reps left) |
| Effective reps | Reps performed + RIR; the input for e1RM equations |
| %1RM | Load as a percentage of the (estimated) 1RM |
| Training max | A user-set reference max (often below the true 1RM) used for percentage programming |
| Wathan / Epley / Brzycki | Rep-max equations converting reps at a load to an estimated 1RM |
| RTS chart | Practitioner chart mapping reps and RPE to %1RM; essentially one-dimensional in effective reps |
| Typical error (TE) / MDC | Day-to-day measurement noise / the minimal change that is detectable beyond noise |
| Working set / warm-up set | A set that counts for training / a preparatory set excluded from metrics |
| Hard set | A working set close enough to failure to count as stimulus (default RIR ≤ 4; ≤ 2 for > 20 reps) |
| Direct / fractional sets | Sets credited 1.0 for primary muscles only / sum of set × credit including 0.5 for synergists |
| Volume load / RVL | Σ reps × load / Σ reps × load ÷ e1RM (relative volume load) |
| sRPE load | Session RPE (CR-10) × session minutes |
| MV / MEV / MAV / MRV | Maintenance / minimum effective / maximum adaptive / maximum recoverable volume. Coaching heuristics (RP), not research-derived |
| Frequency | Sessions per week that train a muscle or lift |
| Mesocycle / microcycle / macrocycle | Training block of several weeks / one week / the season or year |
| Deload | A planned lighter week (fewer sets, more RIR) to dissipate fatigue |
| Taper / peaking | Pre-competition reduction of volume with intensity maintained, to express maximal strength on meet day |
| Linear / DUP / WUP / block periodization | Load progression week to week / daily or weekly undulation of intensity and volume / sequential phases (accumulation, intensification, peak) |
| Double progression | Increase reps within a range, then increase load and reset reps |
| APRE | Autoregulatory progressive resistance exercise, using rep-max-based load adjustments |
| AMRAP | As many reps as possible |
| Top set / back-off sets | The heaviest set of the day / lighter sets after it |
| Drop set / rest-pause / myo-reps / cluster set | Advanced set techniques: load drops without rest / short intra-set rests / activation set + mini-sets / small rep blocks with short rests |
| Superset / circuit | Alternating two or more exercises with minimal rest between them |
| Lengthened partials | Partial reps in the stretched part of the range of motion |
| Tempo (e.g. 2-0-X-0) | Eccentric seconds – bottom pause – concentric (X = maximal intent) – top pause |
| Opener / 2nd / 3rd attempt | The three competition attempts per lift in powerlifting |
| Weigh-in (2 h / 24 h) | Time between official weigh-in and competition start; determines how much acute weight cutting is feasible |
| Wilks / Wilks2020 / DOTS / IPF Points / IPF GL | Bodyweight-adjusted powerlifting scores; IPF GL is the official IPF formula since 2020 |
| Allometric index | Strength ÷ bodyweight^b (e.g. b = 0.67) for bodyweight-fair comparison |
| Percentile (strength) | Share of a reference population lifting less, by sex, age and weight class |
| Readiness / PRS | Self-reported state before training / Perceived Recovery Status (0–10) |
| z-score | Deviation from the personal baseline in standard deviations |
| ACWR | Acute:chronic workload ratio. Not used as an injury predictor (shown only as neutral % change, if at all) |
| VBT / MVT / velocity loss | Velocity-based training / minimum velocity threshold near 1RM / % slowdown within a set |
| TDEE / RMR | Total daily energy expenditure / resting metabolic rate |
| EMA | Exponential moving average used to smooth bodyweight |
| FFM / FFMI | Fat-free mass / fat-free mass index (FFM ÷ height²), optionally height-normalized |
| Energy availability (EA) / RED-S | Energy intake minus exercise energy per kg FFM / Relative Energy Deficiency in Sport |
| PWA | Progressive Web App: a web app installable to the home screen that works offline |
| Service worker | Background script enabling offline caching and updates for a PWA |
| Screen Wake Lock | Web API that keeps the screen on while the page is visible |
| Web Share / Share target | Web APIs to send content to / receive content from the system share sheet |
| Persistent storage | Browser permission protecting site data from automatic eviction |
| iCalendar (.ics) | Standard calendar file format (RFC 5545) importable into calendar apps |
| MoSCoW | Must / Should / Could / Won't prioritization |
| Copyleft / share-alike | Licence terms requiring derived works to be distributed under the same licence (e.g. GPL, AGPL, LGPL for code; CC BY-SA for content). Blocked or review-only for this closed-source app (LEG-08). |
| Permissive licence | Licence allowing use in closed-source software with attribution (e.g. MIT, BSD, Apache-2.0; CC0/CC BY for content) |
| Non-commercial (NC) licence | Content licence forbidding commercial use (e.g. CC BY-NC); excluded by default (LEG-08) |
| revFADP / nDSG | Swiss Federal Act on Data Protection (revised), in force since 1 September 2023; primary privacy framework for the publisher (to be confirmed in legal review) |
| GDPR | EU General Data Protection Regulation; may apply because the app is available to EU users (to be confirmed in legal review) |
| Imprint | Legally required identification of the publisher of a website or online offer (content to be confirmed in legal review) |

---

## Appendix A. Traceability

### A.1 Braindump → requirements

| # | Braindump item (verbatim, abbreviated) | Requirement IDs |
|---|---|---|
| B-01 | "Progressive web app" | PWA-01…15; C-01; NFR-COMP |
| B-02 | "Runs on android" | NFR-COMP-01…04; C-04; PWA-13 |
| B-03 | "Should be a motivating application" | MOT-01…10; ANL-01, ANL-02, ANL-05, ANL-10; WKT-13; NFR-USE-07 |
| B-04 | "Maybe also connected to the samsung calendar or any calendar of choice" | CAL-01…07; NG-03; P-05, P-06 |
| B-05 | "Interactive Body-Map … click on 'biceps' … exercises, ordered by effectiveness or focus" | MAP-01…09; EXL-05; §7.2; OQ-09 (resolved) |
| B-06 | "Should store all Data locally on the phone" | DAT-01…04, DAT-13; NFR-PRIV-01…06; C-03 |
| B-07 | "Should not require a user account. Profile can be created locally" | ONB-13; NG-01; C-02 |
| B-08 | "The app should have a light and a dark mode" | SET-01; PWA-14; NFR-A11Y-05 |
| B-09 | "Modern looking charts that are interactive … track progress" | ANL-02…12; NFR-PERF-05 |
| B-10 | "List all the exercises that he has access to … Olympic bar and Plates … Rack … does not suggest exercises that the user has no access to. Custom exercises" | EQP-01…07; EXL-01…04, EXL-08; ONB-06; WKT-07, WKT-08 |
| B-11 | "Inbuilt counter with ideal default settings (may be modified)" | TMR-01…15; SET-03 |
| B-12 | "RIR based set planning is a good option as well" | PLN-07; PRG-01, PRG-05, PRG-15; SET-05; WKT-03 |
| B-13 | "Onboarding process … main paths … Goals, Gym equipment etc." | ONB-01…12 |
| B-14 | "Run without internet and if needed, sync up" | PWA-03; DAT-05…08; NG-01 |
| B-15 | "Advanced use of PWA capabilities … integrated into the system and fitness app domain" | PWA-01…14; TMR-06; CAL-05; DAT-05 |

### A.2 Clarification answers → requirements

| Answer | Requirement IDs |
|---|---|
| Sync = backup file export/import only; offline, no cloud, no account | DAT-05…08; NG-01; C-01…03 |
| Counter = rest timer (auto-start, research defaults, editable), set/tempo timer, workout duration clock; not a rep counter | TMR-01…15; NG-06 |
| Coaching = "suggests, you confirm"; RIR option alongside %1RM and fixed reps | PRG-03, PRG-09; PLN-07; PRG-11…13; PLN-16 |
| Nutrition = bodyweight + targets; no food logging | BOD-01…10; BOD-11; NG-02 |
| Calendar = `.ics` export, one-way | CAL-01…07 |
| Audience = public release | ONB-01; LEG-01…07; §8; NFR-A11Y |
| Language = English only, externalizable strings | NG-10; NFR-MNT-04; NFR-L10N |
| Motivation = PRs, weekly streaks, achievements and levels, progress photos | MOT-01…10; ANL-08 |
| Device = Galaxy S22, other modern Android; iOS not a target | NFR-COMP; NG-05 |

### A.3 Open-question decisions (2026-11-23) → requirements

| Decision | Requirement / section IDs |
|---|---|
| OQ-01 = A: pure PWA; wake lock, visible sound/vibration, best-effort notification, honest status note | TMR-05, TMR-06, PWA-06, PWA-07, PWA-08, SET-04; C-10; NG-14; R-01; TC-03; V-01 |
| OQ-02 = A: MVP cut as proposed | §10.1, §10.2, §10.3; A-14; R-10 |
| OQ-03 = A: web URL only | PWA-01, PWA-02; C-11; NG-16; §8.3; TC-17 |
| OQ-04: free, closed source | LEG-06, LEG-08; ANL-07; EXL-10; NFR-MNT-02, NFR-MNT-08; §7.3; §8.4; C-09; NG-15; R-09, R-17; TC-18; V-04 |
| OQ-05 = A: no telemetry, diagnostics export | NFR-PRIV-01; DAT-16; §2.2; §8.2; §8.3; C-12; NG-17; R-12 |
| OQ-06 = A: Chrome + Samsung Internet | NFR-COMP-01; PWA-13; C-14; A-09; R-05; TC-11; V-07 |
| OQ-07 = B/D (closed source) | ANL-08; MOT-06; §8.4; V-03 |
| OQ-08 = A (closed source) | EXL-10; MAP-08; §7.1; §7.2; §8.4; A-05; A-15; V-04 |
| OQ-09 = A: composite effectiveness + Focus sort | MAP-02, MAP-03; §7.3 |
| OQ-10 = A + publisher (Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland) | LEG-02, LEG-03, LEG-09; §8.2, §8.3, §8.5, §8.6; C-13, C-15; A-01, A-04; R-18; V-05, V-06 |

---

## Appendix B. Evidence-base reference key

`EB` = `reports/Strength and hypertrophy evidence base.md`. Underlying notes are in `research_notes/Strength and hypertrophy evidence base/`: LI = `load_intensity_1rm_rpe.md`, VF = `volume_frequency_failure.md`, PP = `progression_periodization_autoregulation.md`, SE = `session_exercise_design.md`, FM = `fatigue_monitoring_scoring.md`, NB = `nutrition_body_composition.md`.

| PRD reference | Report heading | Research note |
|---|---|---|
| `EB §How to read the evidence tags` | How to read the evidence tags | — |
| `EB §Load › Rep-max equations` | Nine rep-max equations agree below six reps and diverge above ten | LI Q1 |
| `EB §Load › Reps at %1RM` | Reps at a given %1RM vary by exercise far more than by sex or training status | LI Q2 |
| `EB §Load › RTS chart` | The RTS RPE chart is one-dimensional in reps + RIR and tracks Wathan | LI Q3 |
| `EB §Load › RIR accuracy` | Lifters under-call RIR by about one rep, and worse far from failure | LI Q3 |
| `EB §Load › e1RM algorithm` | The e1RM algorithm and its error budget | LI Q4 |
| `EB §Load › e1RM drift` | e1RM tracks group change but drifts when the rep range changes | LI Q5 |
| `EB §Load › Real change` | A real change must beat about 2.8 typical errors | LI Q6 |
| `EB §Volume › Weekly sets` | About 4 sets per week is detectable, 10–20 is the default… | VF §1 |
| `EB §Volume › Fractional counting` | Count synergist sets as half | VF §2 |
| `EB §Volume › Frequency` | Frequency matters for strength, not for growth | VF §3 |
| `EB §Volume › Per-session returns` | Per-session returns flatten near 11 fractional sets per muscle | VF §3, SE §10 |
| `EB §Volume › Minimum & maintenance` | Minimum and maintenance doses are small if intensity stays high | VF §4 |
| `EB §Volume › Load range` | Any load from about 30% to 85% 1RM builds muscle; strength needs ≥ 80% | VF §5 |
| `EB §Volume › Proximity to failure` | Proximity to failure improves growth, leaves strength flat… | VF §6 |
| `EB §Volume › RP landmarks` | RP volume landmarks are heuristics that sit inside the evidence bands | VF §7 |
| `EB §Volume › Individual response` | Individual response dwarfs program effects | VF §8 |
| `EB §Progression › Periodization` | Periodization adds a small strength edge and no hypertrophy edge | PP §1 |
| `EB §Progression › Progression rules` | Progression rules: double progression, RPE-based loading, APRE | PP §2 |
| `EB §Progression › VBT` | Velocity-based training works for daily loading, not 1RM prediction… | PP §3 |
| `EB §Progression › Deloads` | Deloads every ~5–6 weeks are common practice, not proven physiology | PP §4 |
| `EB §Progression › Tapering & attempts` | Tapering and attempt selection follow surveyed elite practice | PP §5 |
| `EB §Progression › Breaks` | Strength survives about three weeks off; return gradually | PP §6 |
| `EB §Progression › Realistic progress` | Realistic strength progress slows from 10–30% a year to 2–5% a year | PP §7 |
| `EB §Progression › Classification` | Classify trainees by observed progression rate, not labels | PP §8 |
| `EB §Session › Rest` | Rest: about 90 s is enough for growth; strength needs more than 2 minutes | SE §1 |
| `EB §Session › Tempo` | Tempo: controlled eccentric, maximal-intent concentric | SE §2 |
| `EB §Session › ROM` | Range of motion: full ROM with emphasis on the stretched position | SE §3 |
| `EB §Session › Exercise selection` | Exercise selection: vary systematically between mesocycles, not randomly | SE §4 |
| `EB §Session › Mapping` | Exercise-to-muscle mapping for volume attribution | SE §5 |
| `EB §Session › Order` | Exercise order: priority lifts first; hypertrophy is unaffected | SE §6 |
| `EB §Session › Techniques` | Advanced set techniques work about as well as straight sets… | SE §7 |
| `EB §Session › Warm-up` | Warm-up generator: ramp up to about 80% of working weight | SE §8 |
| `EB §Session › Concurrent` | Concurrent training: separate cardio from lower-body lifting | SE §9 |
| `EB §Session › Duration & time-cap` | Session duration and time-cap mode | SE §10 |
| `EB §Monitoring › Load metrics` | Training-load metrics worth computing | FM §1 |
| `EB §Monitoring › ACWR & Banister` | ACWR and Banister models: descriptive at most | FM §1 |
| `EB §Monitoring › Readiness` | Readiness check-ins: subjective ratings beat objective markers | FM §2 |
| `EB §Monitoring › Recovery` | Recovery takes 24–48 h after non-failure work and 48–72 h after failure | FM §3 |
| `EB §Monitoring › Sleep & stress` | Sleep and stress | FM §4 |
| `EB §Monitoring › Injury & pain` | Injury epidemiology: rare time-loss injury, common training pain | FM §7 |
| `EB §Scoring` | Scoring formulas reproduce their official test values exactly (incl. Wilks/Wilks2020/DOTS; IPF Points/GL) | FM §5 |
| `EB §Scoring › Allometric & examples` | Allometric alternatives and example outputs | FM §5.6–5.7 |
| `EB §Scoring › Strength standards` | Strength standards: one peer-reviewed set, the rest are labelled heuristics | FM §6 |
| `EB §Nutrition › Protein` | Protein: 1.6 g/kg covers most lifters; cutting raises the target | NB Q1 |
| `EB §Nutrition › Bulking` | Bulking: small surplus, slow gain | NB Q2 |
| `EB §Nutrition › Cutting` | Cutting: 0.5–1% per week, slower when lean | NB Q3 |
| `EB §Nutrition › TDEE` | Energy-expenditure equations and adaptive TDEE | NB Q4 |
| `EB §Nutrition › Trend smoothing` | Bodyweight trend smoothing | NB Q5 |
| `EB §Nutrition › Body composition` | Body composition: trend-only estimates and the FFMI benchmark | NB Q6 |
| `EB §Nutrition › Weight cuts` | Weight cuts for powerlifting meets | NB Q7 |
| `EB §Nutrition › Sex-specific` | Sex-specific considerations | NB Q10 |
| `EB §Nutrition › Safety` | Safety thresholds | NB Q11 |
| `EB §Defaults › Load / Volume / Progression / Deloads / Expectations / Session / Monitoring / Nutrition` | Consolidated default parameters for the planning agent (sub-tables) | — |
| `EB §Gaps #n` | Open evidence gaps and design decisions, row *n* | — |

---

## Appendix C. Platform references (checked 2026-11-23)

- Notification Triggers API: Chrome documentation states development has ended. <https://developer.chrome.com/docs/web-platform/notification-triggers>
- Timer throttling of hidden pages (1 s alignment; intensive throttling to 1 min after 5 min hidden; audio exemption): <https://developer.chrome.com/blog/timer-throttling-in-chrome-88>
- Persistent storage heuristics (engagement, installed/bookmarked, notification permission) and eviction behavior: <https://web.dev/articles/persistent-storage>
- Web Share permitted file types: Chromium `chrome/browser/webshare/share_service_impl.cc` and Android `components/browser_ui/webshare/android/.../ShareServiceImpl.java` (no `.ics`, `.json` or `.zip`): <https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/webshare/share_service_impl.cc>
- Web Share API overview and file sharing: <https://web.dev/articles/web-share>
- Google Calendar import (`.ics` import documented via computer/web): <https://support.google.com/calendar/answer/37118>

Items marked "verify" in §9.1 (Samsung Internet capabilities, Android page freezing, vibration while hidden, File Handling on Android, Samsung/Google Calendar import behavior) must be confirmed in the technical concept's device spike (TC-03, TC-11).
