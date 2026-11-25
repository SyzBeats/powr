# POWR legal review packet (V-05, V-06)

| Field | Value |
|---|---|
| Version | 1.0, 2026-11-25 (M6b) |
| Purpose | Everything a legal reviewer needs to review POWR's privacy notice, health and safety notice and imprint (PRD V-06), and to run the trademark check of the product name (V-05) |
| Publisher | Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland (PRD §8.6) |
| Text versions under review | Health and safety notice `2026-11-25`, privacy notice `2026-11-25` (`apps/web/src/features/legal/versions.ts`); imprint (no version) |
| Related | [PRD v0.8](../PRD.md) §8 (legal and compliance), LEG-01…LEG-09, R-08, R-18; [technical concept](../technical-concept.md) §7 (deployment, hosting, logging), §8.18 (security and privacy); [release checklist](checklist.md) rows EC-14, EC-15, D-02, D-03, D-09; [licence review](licence-review.md) |

> **This packet contains no legal conclusions.** It describes what the app does, where its texts are and which statements in them depend on facts that must be checked. It then asks questions. The answers come from the reviewer. The agent that wrote it is not a lawyer.

## 1. The product in brief

- **What it is:** a training planner and log for bodybuilders and powerlifters, delivered as a Progressive Web App (a website that can be installed on an Android phone). Free of charge, no advertising, no payments, no paid tiers. Closed source.
- **Distribution:** by web URL only; no app store (PRD OQ-03, C-11). Users in Switzerland and the EU can reach it.
- **Audience:** people aged 16 and over (PRD C-15). The age is self-declared in onboarding. Features for nutrition and weight cuts, which PRD LEG-03 limits for under-18s, are not part of the first release (they are planned for v1.1 and v1.2).
- **Language:** English only (PRD NG-10).
- **No account, no server-side data:** everything the user enters stays in the browser's storage on the phone. There is no sign-in, no analytics, no telemetry and no crash reporting, not even opt-in (PRD OQ-05, C-12).
- **Positioning:** general fitness information and training suggestions for healthy people. It does not diagnose, treat or prevent anything (PRD §8.3, LEG-07).
- **Publisher:** Simeon Zimmermann, trading as SZ WEB DEVELOPMENT, Switzerland; contact e-mail `tools@sz-development.com`. The postal address is still a placeholder (section 6).

## 2. The legal texts and where they are

All texts are rendered inside the app and work offline. In a development or beta build, open the route in the browser, for example `/legal/privacy`. The source files are authoritative; [Appendix A](#appendix-a-current-wording-2026-11-25) reproduces the current wording for convenience.

| Text | Where users see it | Source file | Version and re-acknowledgement |
|---|---|---|---|
| **Health and safety notice** (LEG-01, PRD §8.1) | `/legal/disclaimer`; linked from the first-run screen and Settings → Legal | `apps/web/src/features/legal/texts/Disclaimer.tsx` | `disclaimerVersion` `2026-11-25`. Acknowledged on the first-run screen; asked again when the version changes |
| **Privacy notice** (LEG-02, PRD §8.2) | `/legal/privacy`; linked from the first-run screen and Settings → Legal | `apps/web/src/features/legal/texts/Privacy.tsx` | `privacyVersion` `2026-11-25`. Same mechanism |
| **Publisher and imprint** (LEG-09, PRD §8.6) | `/legal/imprint`; Settings → Legal | `apps/web/src/features/legal/texts/Imprint.tsx` | No version |
| **First-run screen** ("Welcome to POWR"): short privacy and health summaries, two checkboxes ("I have read the health notice and the privacy summary." and "I am 16 or older.") | Before any other screen on first use, and as "We updated our notices" after a version change | `apps/web/src/features/onboarding/OnboardingFlow.tsx` (the legal gate) | Stores the acknowledged versions on the device |
| **About** (SET-09): publisher line and "Questions or feedback" e-mail | Settings → About | `apps/web/src/features/settings/SettingsScreen.tsx` | — |
| **How POWR decides** (LEG-05): how suggestions are made, evidence labels, sources | `/legal/how-powr-decides` | `apps/web/src/features/legal/texts/HowPowrDecides.tsx` (generated in part from the rules registry) | — |
| **Open-source licences and attributions** (LEG-06) | `/legal/attributions` | `apps/web/src/features/legal/texts/Attributions.tsx` with the build's `attributions.json` | Covered by the [licence review](licence-review.md) |
| **Publisher data** used by all of the above | — | `apps/web/src/features/legal/publisher.ts` (one module: person, trading name, country, e-mail, postal address, hosting provider and location, legal-review date) | — |
| **"Draft" marker**: a warning box on the health notice, privacy notice and imprint while a placeholder remains | The three legal screens in development and beta builds | `apps/web/src/features/legal/LegalScreens.tsx` | Disappears once `postalAddress` and `legalReview` are filled in |

**Not built yet:**

- A static website copy of the texts (`legal/*` as plain HTML pages served next to the app; technical concept §7.1, TD-71). Today the website *is* the app: anyone who opens the URL can read the texts before onboarding, but only with JavaScript.
- The optional pre-participation self-screening (LEG-04, Should; TD-72). It waits for this review (question Q-17).
- Terms of use or licence terms for the app itself. The PRD does not ask for them (question Q-19).

## 3. Who sees what, and when

1. A first-time user opens the URL. The app loads its files from the server (section 4). The first screen shows the two summaries, links to the full notices and the two checkboxes. Nothing else can be used before both are ticked; the full notices and the imprint can be read before that.
2. The acknowledged versions are stored on the device. When a text's version changes, the user sees "We updated our notices" and confirms again before the next training screen.
3. All legal texts stay available offline in Settings → Legal.

## 4. Data flows

### 4.1 On the device (the user's data)

| Data | Stored where | Leaves the device? |
|---|---|---|
| Training data: plans, workouts, sets, rest times, notes, per-set flags such as "Pain or discomfort" | IndexedDB database `powr` in the browser, for this website only | Only if the user exports a backup (4.2) |
| Profile answers: goal, experience, training days, optionally sex, birth year, height, body weight and known lifts | `powr` | Same |
| Body weight and body measurements | `powr` | Same |
| Readiness check-ins (sleep, energy, soreness) | `powr` | Same |
| Equipment, settings, choices | `powr`; the theme and the install-prompt state in `localStorage` | Same (the `localStorage` items never leave) |
| Safety copies made before a restore or a data update | IndexedDB `powr-safety` | Only if the user saves one as a file |
| Diagnostics log: technical events with an allowlist of fields per event (no free text, notes, names or body data; technical concept §8.17) | IndexedDB `powr-diag`, at most 1,000 entries | Only if the user taps "Export diagnostics" (developer tools or the recovery screen) and sends the file |
| Timer state during a workout | IndexedDB `powr-runtime` | Never |
| The app's own files | Cache Storage (service worker) | — (they come from the server) |

"Delete all data" (Settings → Data and backups) deletes the four databases and both web storages; the app files stay so the app still opens offline (PRD DAT-13).

### 4.2 Files the user creates

| File | Content | How it leaves the app |
|---|---|---|
| Backup (`powr-backup-YYYY-MM-DD-HHMM.zip`) | All user data as JSON, with checksums; **not encrypted** | Downloaded to the phone's Downloads folder; restored with a file picker. Where the user stores or sends it afterwards is their choice |
| Calendar file (`powr-plan-YYYY-MM-DD.ics`) | Planned sessions: a title such as "POWR · Upper A (Week 3)", time, duration, exercises with set counts, an optional reminder; no personal data beyond training content (CAL-02). Each event carries an ID of the form `<planned-session-id>@<host>`, where the host is the production domain (today the placeholder `powr.invalid`) | Downloaded, or handed to the Android share sheet where the browser allows `.ics` files |
| Diagnostics file (`.txt`, JSON) | The diagnostics log above, app version, browser and capability results | Downloaded; the user decides whether to send it, for example by e-mail |

### 4.3 Network traffic

- The app makes **same-origin GET requests only**: its static files (on first visit and on updates) and `version.json` (the update check). The Content Security Policy sent with every response allows connections to the app's own origin only (`connect-src 'self'`), so the browser refuses any other. An end-to-end test records all network traffic of the test suite and fails on any request to another origin or any non-GET request (technical concept §8.18).
- No cookies, no tracking identifiers, no fingerprinting, no third-party fonts, scripts or services.
- **Notifications** (rest-timer alerts) are created on the device by the service worker; there is no push server.

### 4.4 Hosting and the delivery chain

| Party | Role | Sees user data? |
|---|---|---|
| **Hetzner Online GmbH**, data centre in Nuremberg, Germany | Rents the virtual server (VPS) to the publisher. Technical concept §7.2 states that a data-processing agreement with Hetzner is concluded; the product owner confirms it (checklist D-03) | Network-level traffic only; TLS ends on the publisher's server |
| **The publisher's server**: Coolify (deployment platform), Traefik (reverse proxy, TLS), nginx (serves the files), all operated by the publisher | Serves the app files over HTTPS | Transient connection data (IP address, user agent) for the moment of each request. nginx is configured with `access_log off` and logs only critical server errors. Traefik writes no access log unless configured; this is **checked on the real server in spike S-7** (checklist D-02). Docker log rotation (10 MB × 3 files) is part of the same set-up |
| **Let's Encrypt** | Issues the TLS certificates | No |
| **GitHub** (private repository, GitHub Actions, GitHub Container Registry) | Source code, builds, the server image | No |
| **Uptime monitor** (a hosted free-tier service, preferably EU-based; not chosen yet, OQ-T9) | Checks the public `version.json` every 5 minutes and the certificate expiry | No |
| **E-mail provider of `tools@sz-development.com`** | Receives messages users choose to send (questions, feedback, possibly with a backup or diagnostics file attached) | Only what a user sends |

## 5. Statements in the texts that depend on facts

The reviewer may want to confirm that each statement is true and sufficient. The "basis" column says what the build does today; "to check" names what is not yet verified or what the review should look at.

| # | Statement (text) | Basis in the build | To check |
|---|---|---|---|
| C-01 | "We do not keep access logs." (privacy notice, Hosting) | nginx `access_log off` (`deploy/nginx.conf`, tested in CI) | Traefik and Coolify on the real server (S-7, checklist D-02). Error logs at level `crit` exist and may contain an IP address in rare cases |
| C-02 | "…the server has to handle technical connection data, such as your IP address and browser type, for the moment of the request." (Hosting) | Correct for any web server | Whether this is enough, or a legal basis and retention statement are needed (Q-06) |
| C-03 | "The app files are served from a server in Germany that we rent from Hetzner Online GmbH and operate ourselves." (Hosting; the imprint repeats provider and location) | Technical concept §7.1–§7.2; `publisher.ts` `hosting` | Server location confirmed at S-7 (Nuremberg planned, Falkenstein equivalent) |
| C-04 | "There is no account and no sign-in. We do not know who uses POWR." / "There is no analytics, no telemetry, no advertising and no tracking of any kind." | No such code; CSP; network-log test | — |
| C-05 | "The app loads nothing from other companies: no fonts, scripts or services from third parties." | Network-log test; CSP | The files come from a server rented from Hetzner; whether the sentence needs a qualification |
| C-06 | "We do not collect, receive, sell or share your training data. We never have a copy of it." | True for the app | Users may e-mail a backup or diagnostics file; whether the notice must cover that (Q-03) |
| C-07 | "Some of it, such as body data, pain notes and check-ins, can be health data. It never leaves your device unless you export it." | The data stays on the device | Classification and wording (Q-05) |
| C-08 | Permissions: notifications only for rest-timer alerts, created on the device; "POWR does not use your camera, microphone, contacts or location." | True for the MVP. The HTTP `Permissions-Policy` keeps the camera available to the app's own origin for the planned progress photos (v1.2) | The notice must change when photos ship |
| C-09 | "Backup files are not encrypted, so keep them somewhere safe." | Encryption is planned for v1.3 (DAT-10) | — |
| C-10 | "Uninstalling the app from your home screen may not delete the data on its own." | Browser behaviour; measured in S-2 cell 16 | — |
| C-11 | Rights "under the Swiss Federal Act on Data Protection (revFADP) and, where it applies, the EU General Data Protection Regulation (GDPR)": information, access, correction, deletion, restriction, objection, portability | Most are exercised by the user in the app | The list per framework (Q-08) |
| C-12 | "You can also complain to a data protection authority: in Switzerland the Federal Data Protection and Information Commissioner (FDPIC), in the EU the authority of your country." | — | The wording for each framework (Q-09) |
| C-13 | "Whether the GDPR also applies to users in the EU is being confirmed in a legal review; this notice is written to meet both." | Describes this review | Must change after the review (Q-10) |
| C-14 | "In an emergency, call your local emergency number (112 in Switzerland and the EU)." (health notice) | — | Whether to name 144 (Swiss ambulance number) as well (Q-15) |
| C-15 | "POWR is a training planner and log for healthy people aged 16 and over." / "For people under 18, POWR limits these features." (nutrition and body weight) | The age is self-declared. The nutrition and cut features are not in the MVP (v1.1, v1.2), so the limit is true by their absence today | Q-18 |
| C-16 | "POWR is not medical advice. It does not diagnose, treat or prevent any illness or injury…" (health notice); "It is a general fitness app, not a medical device" (imprint); "POWR does not diagnose anything and does not predict injuries." (How POWR decides) | Wellness positioning, LEG-07 | Q-16 |
| C-17 | "POWR is free to use." (imprint) | No payments, no ads | — |
| C-18 | "If this notice changes in substance, POWR shows the new version and asks you to confirm it before you continue." | Built (version check at start) | Q-13 |

## 6. Placeholders and open inputs

| Placeholder | Where | While it is open | Filled by |
|---|---|---|---|
| `postalAddress` | `apps/web/src/features/legal/publisher.ts` | The imprint and the privacy notice show "Postal address: to be added before the public release."; the "Draft" marker shows; `pnpm release:check` fails, so the production deploy stops | The product owner, after Q-20 and Q-21 |
| `legalReview` (the review date, `YYYY-MM-DD`) | `publisher.ts` | Same marker and release check | The product owner, with the date the reviewer approves the texts |
| Text versions `2026-11-25` | `apps/web/src/features/legal/versions.ts` | — | Bump each text whose wording changes after the review, so users confirm it again |
| `<business-domain>`, `<production-domain>` | `deploy/runbook.md`, technical concept §7 | Beta and production URLs unknown | The product owner (S-7; the production domain after V-05) |
| `PUBLIC_ORIGIN` repository variable (calendar event IDs, public URLs) | GitHub repository settings; read by `.github/workflows/ci.yml` | Builds use `https://powr.invalid` (a reserved name) | The product owner, once the production domain is chosen; never changed afterwards |
| Product name "POWR" | Everywhere ("working title" in the PRD and the technical concept) | — | Confirmed or replaced after V-05 |
| App icons | `assets-inventory.yaml` calls them "original placeholder artwork" | — | Branding after the trademark check (technical concept OQ-T7) |

After the review: edit the texts, bump `versions.ts` where the wording changed, fill both placeholders, run `pnpm release:check` (it must exit 0), and mark V-05 and V-06 done in the PRD and rows EC-14, EC-15 and D-09 in the [release checklist](checklist.md).

## 7. Trademark check of the product name (V-05)

- **Name to check:** "POWR" (working title since the PRD's first draft; decided to stay the working title until cleared, OQ-10).
- **Territories:** Switzerland and the EU (PRD §8.4, V-05).
- **Goods and services the app relates to:** downloadable or installable software (a web app), online fitness and training information, training planning and logging. Which classes the search must cover is for the reviewer (Q-23).
- **Why it matters early:** the production domain is chosen only after this check and is never changed afterwards, because each user's data is tied to the web origin (technical concept OQ-T1, risk T-01). The beta runs on a subdomain of the publisher's business domain until then.
- **Other names used in the app** (descriptive use, no logos; PRD §8.4): formula names IPF GL, DOTS, Wilks, Wilks2020, IPF Points; "Samsung Calendar", "Google Calendar", "Chrome", "Samsung Internet" in import guides and device notes; exercise names that carry a person's name (Arnold press, Spoto press, Larsen press; "Bayesian curl" as a search synonym). See Q-24.

## 8. Questions for the reviewer

**A. Which laws apply, and the publisher's role**

- **Q-01** Which data protection laws apply to POWR as built: the Swiss revFADP for a publisher based in Switzerland, and the EU GDPR for users in the EU?
- **Q-02** Is the publisher a controller (under the revFADP, the "controller" or responsible person) for data that stays on the user's device and never reaches the publisher? How should the notice describe the publisher's role? It currently says "The publisher of POWR is responsible for this app and this notice."
- **Q-03** Which personal data does the publisher process at all: the transient connection data at the server, and e-mails users send (possibly with a backup or diagnostics file attached)? Must the notice name a legal basis and a retention period for each, and say how e-mails and attachments are handled?
- **Q-04** If the GDPR applies: does the publisher need a representative in the EU, or does an exception apply?
- **Q-05** Body data, readiness check-ins and pain flags stay on the device. Is it right to say they "can be health data"? Does anything follow for the publisher from that classification?

**B. Privacy notice**

- **Q-06** Is the hosting paragraph sufficient (Hetzner in Germany, operated by the publisher, transient connection data, no access logs)? Does it need a legal basis, a retention statement or a mention of the data-processing agreement with Hetzner?
- **Q-07** Does hosting in Germany need a statement about disclosure abroad under the revFADP?
- **Q-08** Is the list of rights correct for each framework, and is it acceptable to say that users exercise most of them themselves in the app?
- **Q-09** Is the complaint sentence (FDPIC in Switzerland, the national authority in the EU) correct for each framework?
- **Q-10** What should replace the sentence that the GDPR's applicability "is being confirmed in a legal review"?
- **Q-11** Must the notice name the other services in the delivery chain (Let's Encrypt, GitHub, the uptime monitor) although none of them receives user data?
- **Q-12** Is an English-only privacy notice, health notice and imprint acceptable for users in Switzerland and the EU?
- **Q-13** Is "show the new version and ask the user to confirm it" the right way to handle changes? Does the notice need a "last changed" date besides the version?

**C. Health notice and medical-device positioning**

- **Q-14** Is the health notice adequate for a free training planner? Is anything missing or too strong (for example "Talk to a doctor before you start…", the list of conditions, "Stop training straight away…")?
- **Q-15** Should the emergency sentence name 144 (ambulance in Switzerland) in addition to 112?
- **Q-16** Does any claim in the app (health notice; the imprint's "not a medical device"; "How POWR decides"; readiness check-ins with lighter-session proposals; the per-set "Pain or discomfort" flag; deload proposals) risk a medical-device classification under the Swiss Medical Devices Ordinance or the EU MDR? Which wording should change?
- **Q-17** LEG-04 (not built): may POWR offer a short, optional pre-participation self-screening in the style of established questionnaires? Must the wording be original, or can a standardized questionnaire be licensed? Does recommending a clinician after a "yes" answer create obligations?
- **Q-18** Is a self-declared checkbox ("I am 16 or older.") enough for the minimum age of 16? Do any rules for minors apply even though the data stays on the device?
- **Q-19** The app has no terms of use. Does a free, closed-source app need them (licence to use the app, warranty and liability limits, governing law and jurisdiction)? If yes, where should users see and accept them?

**D. Imprint and publisher identification**

- **Q-20** Which details must the imprint contain for a free app and its website, offered from Switzerland to Swiss and EU users, without sales or advertising? Today: person, trading name, postal address (placeholder), country, e-mail, hosting provider and location.
- **Q-21** Is a postal address required, and does it have to be a street address?
- **Q-22** The website is the app itself: the texts can be read at the URL before onboarding, but only with JavaScript. Is that enough for the website's publisher identification, or is a static HTML page needed (TD-71)?

**E. Trademarks and names**

- **Q-23** Is "POWR" free to use in Switzerland and the EU for the goods and services in section 7, and which classes must the search cover?
- **Q-24** Is the descriptive use of third-party names in section 7 (formula and federation names, browser and calendar names, exercise names with a person's name) acceptable as it is?
- **Q-25** The scoring formulas are implemented from the official IPF documents and the published coefficients; OpenPowerlifting's test values serve only as test vectors, and none of its AGPL code is used (PRD §8.4, LEG-08). Is there any concern with this use?

**F. After the review**

- **Q-26** Which changes must be made before the release, and which can follow in an update? Which changes need users to confirm the texts again?

---

## Appendix A. Current wording (2026-11-25)

Copied from the source files listed in section 2 (Lingui messages; headings are the section titles). The publisher block reads from `publisher.ts`. If this appendix and the source files differ, the source files are right.

### A.1 Privacy notice (`/legal/privacy`, version 2026-11-25)

**In short**
Everything you enter is stored only on this device. We never receive it: there is no account, analytics or tracking. Only you can export it, as a backup file.

**Who is responsible**
The publisher of POWR is responsible for this app and this notice:
Simeon Zimmermann · SZ WEB DEVELOPMENT · Postal address: to be added before the public release. · Switzerland · E-mail: tools@sz-development.com

**What POWR stores, where and why**
POWR stores what you enter or create while you use it:
- your plans, workouts, sets, rest times and notes;
- profile answers, such as your goal, experience, training days, and optionally your sex, birth year, height and the lifts you know;
- body weight and body measurements you log;
- check-ins (sleep, energy, soreness) and pain notes;
- your equipment, settings and the choices you made in the app.

All of it stays in your browser's storage on this device, for this app only. POWR uses it for one purpose: to run the app for you, for example to plan your training, suggest weights and show your progress. Some of it, such as body data, pain notes and check-ins, can be health data. It never leaves your device unless you export it.

**What we do not do**
- There is no account and no sign-in. We do not know who uses POWR.
- There is no analytics, no telemetry, no advertising and no tracking of any kind.
- The app loads nothing from other companies: no fonts, scripts or services from third parties.
- We do not collect, receive, sell or share your training data. We never have a copy of it.

**Hosting**
The app files are served from a server in Germany that we rent from Hetzner Online GmbH and operate ourselves. To send the files when you open or update the app, the server has to handle technical connection data, such as your IP address and browser type, for the moment of the request. We do not keep access logs. Your training data never reaches this server.

**Permissions**
- Notifications: only for rest-timer alerts, and only after you allow them. They are created on your device; nothing is sent over the internet. You can turn them off in your browser's site settings at any time.
- Keeping the screen on during a workout and asking the browser to keep your data (persistent storage) need no personal data.
- POWR does not use your camera, microphone, contacts or location.

**Backups and exported files**
Backups, calendar files and other exports are created on your device and are under your control. If you store or share them elsewhere, for example in a cloud drive, by e-mail or in a messenger, that service's terms and privacy policy apply. Backup files are not encrypted, so keep them somewhere safe.

**Data loss**
Clearing your browser data, uninstalling the app or the browser freeing up space can delete your data. Because we never have a copy, we cannot restore it. Export a backup regularly.

**Deleting your data**
You can delete your data at any time: in POWR under Settings, Data and backups, or in your browser by deleting the site data of this app. Uninstalling the app from your home screen may not delete the data on its own.

**Your rights**
Under the Swiss Federal Act on Data Protection (revFADP) and, where it applies, the EU General Data Protection Regulation (GDPR), you have the right to information about and access to your personal data, to have it corrected or deleted, to restrict or object to its processing, and to receive it in a portable format.

Because your training data is only on your device, you exercise most of these rights yourself in the app: view it, correct it, export it as a backup or delete it. For anything else, for example a question about the hosting, write to us.

You can also complain to a data protection authority: in Switzerland the Federal Data Protection and Information Commissioner (FDPIC), in the EU the authority of your country.

**Legal framework**
The revFADP applies because the publisher is based in Switzerland. Whether the GDPR also applies to users in the EU is being confirmed in a legal review; this notice is written to meet both.

**Changes and contact**
If this notice changes in substance, POWR shows the new version and asks you to confirm it before you continue. The version is shown at the top of this page.

Questions about privacy: tools@sz-development.com

### A.2 Health and safety notice (`/legal/disclaimer`, version 2026-11-25)

**What POWR is, and what it is not**
POWR is a training planner and log for healthy people aged 16 and over. It gives general fitness information and training suggestions based on published research and on what you enter.

POWR is not medical advice. It does not diagnose, treat or prevent any illness or injury, and it does not replace a doctor, physiotherapist, dietitian or qualified coach.

**Before you start**
Talk to a doctor before you start or change a training or nutrition programme, especially if:
- you have a known health condition, for example of the heart, blood pressure, lungs or joints;
- you are pregnant or have recently given birth;
- you have had an injury or an operation, or you take regular medication;
- you have not been active for a long time.

**Stop and get help**
Stop training straight away and get medical help if you feel chest pain or pressure, dizziness or faintness, unusual shortness of breath, an irregular heartbeat, or sudden or sharp pain. In an emergency, call your local emergency number (112 in Switzerland and the EU).

**Lifting safely**
Lifting weights, and heavy weights in particular, carries a risk of injury. You can lower it:
- learn the technique of an exercise with light weights first;
- warm up before heavy sets;
- use a spotter or safety equipment such as rack safeties and collars, especially near your limit;
- stay within what you can lift with good form.

Suggested weights are estimates from what you logged. If a weight feels wrong on the day, use less: you can always change a suggestion.

**Pain, check-ins and readiness**
Pain notes and check-ins are for your own overview. They are not a diagnosis, and POWR does not predict injuries. If pain does not go away or gets worse, see a doctor or physiotherapist.

**Nutrition and body weight**
Body-weight goals and nutrition guidance are estimates for healthy adults. They are not suitable for people with an eating disorder or a history of one, during pregnancy or breastfeeding, or for anyone under 18. For people under 18, POWR limits these features.

**Your decisions**
POWR suggests; you decide. You are responsible for what you do with its suggestions. Change or skip anything that does not feel right for you on the day.

Questions about this notice: tools@sz-development.com

### A.3 Publisher and imprint (`/legal/imprint`)

**Publisher**
POWR is published and run by:
Simeon Zimmermann · SZ WEB DEVELOPMENT · Postal address: to be added before the public release. · Switzerland · E-mail: tools@sz-development.com

**About this app**
POWR is free to use. It is a general fitness app, not a medical device, and it stores your data only on your device.

The app files are hosted on a server in Germany, rented from Hetzner Online GmbH.

The fastest way to reach us is by e-mail.

### A.4 First-run screen ("Welcome to POWR"; "We updated our notices" after a version change)

Your training planner and log. It works offline, needs no account, and your data stays on this phone.

**Privacy in short**
Everything you enter is stored only on this device. We never receive it: there is no account, analytics or tracking. Only you can export it, as a backup file. *(Link: Read the full privacy notice)*

**Health and safety**
POWR gives general training suggestions, not medical advice. Check with a doctor before you start or change training, especially with a health condition, an injury or a pregnancy. Stop and get help if you feel chest pain, dizziness or sharp pain. You decide what you do with the suggestions. *(Link: Read the full health notice)*

- [ ] I have read the health notice and the privacy summary.
- [ ] I am 16 or older.

Buttons: "Set up my plan" and "Just let me log" (first use), or "Continue" (after a version change).

### A.5 Settings → About

Version … (build) · Rules registry … · Exercise library … · Device support: what works on this phone · Published by Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland. · Questions or feedback: tools@sz-development.com

### A.6 "Draft" marker (development and beta builds only)

**Draft** — This text is a draft until its legal review and may still change. Still to come: the publisher's postal address, the legal review.
