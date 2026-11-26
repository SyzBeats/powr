# POWR evidence verification of the preliminary registry values (T-01, TD-25)

| Field | Value |
|---|---|
| Version | 1.1, 2026-11-25 (M6, release checklist item T-01): the product owner's decisions of 2026-11-25 applied, see [Applied (2026-11-25)](#applied-2026-11-25). 1.0 was the report as proposed |
| Status | **Applied in rules 1.8.0** (`ENGINE_VERSION` 0.3.0): 22 of 143 parameters stay `verified: false`. The sections below are the report as written for the decision; the applied block says what changed |
| Registry reviewed | Rules 1.7.0 (`packages/rules/generated/rules.json`): 143 parameters, **39** `verified: false`. The release checklist says 38; the compiled registry has 39 |
| Purpose | One evidence check per preliminary value, with a verdict and, where the evidence supports another value, an exact proposal. **Nothing is applied.** The product owner approves value changes first |
| Sources | `packages/rules/data/*.yaml` and `data/sources/*.yaml`; the [evidence base](../../reports/Strength%20and%20hypertrophy%20evidence%20base.md) (EB) and its research notes; [technical concept](../technical-concept.md) §8.6, §8.7 and TD-25; `IMPLEMENTATION_NOTES.md` (each parameter's introduction; "M4 trend-label calibration"); the [PRD](../PRD.md); new literature searches (PubMed, Europe PMC, Crossref, publishers and federations), see the bibliography |
| Research notes | `research_notes/Parameter verification/volume.md`, `scoring.md` and `load-rir-apre.md`. They hold the full quotes, the recomputed tables and every source with what was read |
| Related | [Release checklist](checklist.md) T-01; [content review](content-review.md) |

## Applied (2026-11-25)

The product owner approved every proposal on 2026-11-25, with the changes noted per decision. They are applied in rules **1.8.0** (`1.8.0+97874580e2f6`; registry diff `pnpm --filter @powr/rules build -- --diff` against 1.7.0) and `ENGINE_VERSION` **0.3.0**. Details, tests and the suggested commits: `IMPLEMENTATION_NOTES.md` "T-01 evidence verification applied".

**Decision 1: the five corrections. Applied.**

- **V-1** `progression.apre.sixRm`: the 13+ row is `rangeKg { min: 5, max: 7.5 }`, `adjustKg` 6.25, with `src.mann2011` and `src.mann2017` as the table sources and the note that the original is in pounds; `src.huang2023` stays as a reproduction, with a note on its 13+ row. The row is `verified: true`. Tests: `packages/domain/test/reference/progression.test.ts` (100 kg × 14 reps → 105 kg, was 107.5 kg) and the APRE golden test in `packages/rules/scripts/golden.test.ts` (against the compiled registry).
- **V-2** `volume.strength.tiers`: MED 1; 2 sets `lowerEfficiency`, about 12 extra sets per detectable gain; **not detectable from 3 sets**. Re-sourced to `src.pelland2026` (tags MA, INF: POWR's recomputation); stays `verified: false` until the published Table 2B is read.
- **V-3** `volume.strength.weeklyHeavySetsPerLift`: `guard.plateauAbove` **3**; `src.pelland2024` replaced by `src.pelland2026`; the band stays a design value (`verified: false`).
- **V-4** `volume.hypertrophy.weeklyBands`: `guard.hardText` "almost no data".
- **V-5** `scoring.ipfGl.minBodyweightKg`: a by-sex value `{ male: 40, female: 35 }` (schema `bySex(positive)`, type `BySex<number>`), read by sex in `@powr/domain/scoring`; tags OFFICIAL, sourced to the IPF document. Tests: `packages/domain/test/reference/scoring.test.ts` (men 37 and 39.9 kg score 0, men 40 kg and women 35 kg score) and the scoring golden test.

**Decision 2: the verification policy. Applied as proposed, with the Pelland tier rows held back.**

- **17 rows are now `verified: true`:** `load.rirBias`; `volume.hypertrophy.weeklyBands`, `volume.counting.default`, `volume.frequency.strengthPerLift`, `volume.strength.perSessionHeavySets`, `volume.effort.hypertrophySlopePerRir`; `planning.slot.sets`; `scoring.wilks.coefficients`, `scoring.wilks2020.coefficients`, `scoring.dots.coefficients`, `scoring.ipfGl.coefficients`; `monitoring.readiness.pmFromHour`; the PRD rows `planning.timeBudget.fallback`, `progression.calibration`, `bodyweight.rate.maintain`, `motivation.streak.defaultWeeklyTarget`; and the corrected `progression.apre.sixRm`. Sources and tags as in [Proposed verification flips](#proposed-verification-flips-without-a-value-change); the PRD rows keep the tag `INF`, so the UI keeps "App estimate".
- **Held back by the product owner:** `volume.hypertrophy.tiers` and `volume.puos` stay `verified: false` until the published Pelland 2026 full text is read. They now cite `src.pelland2026` next to the preprint (tags MA, PREPRINT) and say so in their notes.
- **12 new source entries**, exactly as proposed in [Proposed source-registry entries](#proposed-source-registry-entries-not-applied): `src.russo2025`, `src.casanova2025`, `src.martikainen2025`, `src.lovegrove2022`, `src.helms2016` (in `data/sources/load.yaml`), `src.mann2011`, `src.mann2017` (`progression.yaml`), `src.ipf2020`, `src.kopayev2020`, `src.wilks2008`, `src.pa2020`, `src.konertz2019` (`scoring.yaml`). The corrections to existing entries are applied too: `src.pelland2026` (DOI, OSF data, note), the completed citations of `src.androulakiskorakakis2021`, `src.bazvalle2022`, `src.acsm2026`, `src.acsm2009`, `src.braith1993`, `src.mayhew2008`, `src.craven2022` and `src.huang2023`, and the notes of `src.robinson2024`, `src.opl-goodlift`, `src.opl-dots` and `src.vcalc-ipf-gl` (no longer cited by the GL row).
- **`packages/rules/scripts/build.test.ts`:** the must-stay-unverified (E-2) list lost `volume.hypertrophy.weeklyBands` and `volume.effort.hypertrophySlopePerRir`; `volume.hypertrophy.tiers`, `volume.puos` (both still cite a preprint) and `volume.hypertrophy.perSessionSoftCap` stay. A new test pins the 17 verified rows and the four held-back Pelland-dependent rows.
- **The 22 rows that stay preliminary** keep their values as design values; each row note now carries this report's rationale (and, where proposed, the supporting sources: `src.helms2016` on `load.curve.rts`, `src.grgic2020`, `src.refalo2024a`, `src.casanova2025` and `src.lovegrove2022` with the tags PREPRINT, INF on `load.trend.noiseTypicalSd`, `src.grgic2020` on `load.trend.noviceWidening`, `src.nuzzo2024` on `load.trend.repRangeShift`).

**Decision 3: engine and display. Applied.**

1. **RTS chart:** values unchanged; labelled "RPE chart (common RTS version)" in the parameter label (`params.load.curve.rts`, shown in "Why?" and "How POWR decides") and in Settings' formula names; the `src.fitnessvolt-rts-chart` citation and note say it is the commonly circulated decimal chart and that Tuchscherer's own 2014 chart is 5–8 points lower at 5–11 effective reps; the row note says the same and cites `src.helms2016`. The row stays a design value.
2. **PRG-07 switch** (`packages/domain/src/progression/pace.ts`): the upper bound uses the Student t quantile for n − 2 degrees of freedom (exact, `studentTQuantile`), and `progression.pace.window.minExposures` is **6** (was 4). New test `packages/domain/test/reference/pace.test.ts`: on 2,000 seeded noise windows of a lifter who keeps up, the bound is missed in 5.95 % (6 exposures) and 4.95 % (8 exposures) of windows, against 9.2 % and 7.75 % with the normal quantile; the former 4-exposure normal check missed 12.45 % (t: 5.35 %). `ENGINE_VERSION` 0.2.0 → 0.3.0.
3. **Bodyweight rate:** `bodyweight.rate.windowDays.min` **21** (was 14; the report's 21–28 days, its lower end, still inside the EB's 14–28): the domain returns no rate ("not enough data yet") until the readings span 21 days and names the minimum in both explanations; the application's `BodyweightView` exposes `rateMinDays`; the Body screen says "Not enough data yet" and when the rate will show. Tests: domain `bodyweight.test.ts` (14 and 20 days: none; 21: a rate), the golden test, application `m4a.test.ts`, component `apps/web/test/body.test.tsx`.
4. **IPF GL rounding:** the coefficient is rounded to 6 decimals before multiplying and the points to 6 decimals, as the IPF document does: its examples give exactly 112.855365 and 96.783453. The EB/OpenPowerlifting vector 112.85 (unrounded coefficient) becomes **112.86** at 2 decimals; every other EB cross-check vector (96.9, 101.06, 87.51, 88.72 and 96.78) is unchanged.

**Decision 4: kept.** `load.rirBias` stays +0.5 for RIR ≥ 3 and `motivation.streak.defaultWeeklyTarget` stays 1; both row notes record that the product owner confirmed them on 2026-11-25.

**Effects.** The plan-matrix and trend-calibration snapshots are unchanged, as expected. Session prescriptions change only where the PRG-07 switch would have fired on 4 or 5 exposures or on noise; scores change only for IPF GL (at most in the 6th decimal of the coefficient, and men under 40 kg). "How POWR decides" now counts **22 of 143** preliminary values.

## How to read this report

**Verdicts**

- **Verify:** the evidence supports the value as it is. The row can become `verified: true` with the sources named.
- **Verify (PRD):** the value is an approved product requirement whose number is now in the PRD. Since M2a, the registry's convention has been that PRD numbers transcribed exactly ship `verified: true`; examples are `planning.novice.maxWorkingExercises` and the streak rows. Flipping such a row confirms the transcription, not research support. Its evidence tag stays `INF`, so the UI keeps the label "App estimate".
- **Correct:** the evidence supports a different value or range. The exact proposal, its sources and its expected effect are given.
- **Design value:** no adequate evidence exists. The row stays `verified: false` as a POWR design choice, with the rationale and what evidence would settle it.

**Confidence** is high, medium or low. It refers to the verdict, not to how important the value is.

**Evidence tags** are the EB's: `[MA]`, `[SR]`, `[RCT]`, `[RCT-T]` (trained), `[RCT-U]` (untrained), `[POS]`, `[OBS]`, `[DELPHI/SURVEY]`, `[NARR]`, `[PREPRINT]`, `[PRACT]`, `[OFFICIAL]`, `[MODEL]` and `[INF]`. "Full text", "abstract" or "metadata" says what was actually read. Three research agents read part of the literature in parallel. I spot-checked their key primary sources: the IPF GL document, the DOTS author page, the ACSM 2026 quotes, the APRE table in pounds, and every DOI by Crossref or PubMed. Their notes record what each of them opened.

**Effects** name the reviewed snapshots a change would move:

- the **plan-matrix snapshot** (`packages/application/test/__snapshots__/plan-matrix.test.ts.snap`);
- the **trend-calibration snapshot** (`packages/domain/test/reference/__snapshots__/trend-calibration.test.ts.snap`);
- **session prescriptions** (the loads and targets the session engine pre-fills).

## Results at a glance

| Verdict | Count | Parameters |
|---|---|---|
| Verify | **14** | `load.rirBias`; `volume.hypertrophy.weeklyBands`, `.tiers`, `volume.puos`, `volume.counting.default`, `volume.frequency.strengthPerLift`, `volume.strength.perSessionHeavySets`, `volume.effort.hypertrophySlopePerRir`; `planning.slot.sets`; the four scoring coefficient sets; `monitoring.readiness.pmFromHour` |
| Verify (PRD) | **4** | `planning.timeBudget.fallback`, `progression.calibration`, `bodyweight.rate.maintain`, `motivation.streak.defaultWeeklyTarget` |
| Correct | **3** | `progression.apre.sixRm`, `volume.strength.tiers`, `volume.strength.weeklyHeavySetsPerLift` (its guard) |
| Design value | **18** | `load.curve.rts`, `load.e1rm.setOrderDecay`, `load.trend.noiseTypicalSd`, `.processSdPerWeek`, `.noviceWidening`, `.changeThresholds`, `.reference`, `load.pr.minSetWeight`, `load.trend.repRangeShift`; `volume.hypertrophy.perSessionSoftCap`; `planning.strength.accessorySets`, `.volume.startPosition`, `.variety.pool`, `.missed.mergePriorities`; `progression.calibration.reliableSetWeight`, `.classification.trainingAgeMonths`, `.pace.window`; `ranking.effectiveness` |

If everything proposed here is applied, 19 rows become verified: the 18 verified rows plus the corrected APRE row. **20 stay preliminary.**

**What would change for users:**

- **Plans:** none of the proposed value changes is read by the plan generator, so the plan-matrix snapshot is unchanged.
- **Trend labels:** none touches the trend model, so the trend-calibration snapshot is unchanged.
- **Session prescriptions:** only the APRE correction changes a prescription, and APRE is not reachable in the MVP. The session engine runs `apre` slots as RPE slots (`session/suggest.ts`), and no shipped template uses APRE. The reference test `packages/domain/test/reference/progression.test.ts` would move: 14 reps on the AMRAP would give a next 6RM of 105 kg instead of 107.5 kg.
- **"How POWR decides":** the "preliminary value" label disappears from the flipped rows, and the preliminary count drops from 39 to 20.

**No current value is unsafe in the MVP.** The one value that is clearly wrong, the APRE 13+ jump, is not reachable yet. See [Values that matter for safety or plan quality](#values-that-matter-for-safety-or-plan-quality).

## Summary table

| # | Parameter | Current value | Verdict | Proposed value | Confidence | Key sources |
|---|---|---|---|---|---|---|
| 1 | `load.curve.rts` | RTS chart, r_eff 1 → 100 % … 13.5 → 64.0 % (26 points) | Design value | Values unchanged; correct the source note; add Helms 2016 as a comparison | Transcription high; validity low | FitnessVolt (in registry); Helms 2016; Tuchscherer 2008 and 2014 |
| 2 | `load.e1rm.setOrderDecay` | 0.85 per later working set | Design value | Unchanged | High that no number exists | Richmond & Godard 2004; Senna 2011, 2017; Willardson & Burkett 2005, 2006; de Salles 2009 |
| 3 | `load.rirBias` | +0 (reported RIR 0–2), +0.5 (RIR ≥ 3) | Verify | Unchanged (option: +1.0) | Medium | Halperin 2022 [MA]; Russo 2025 [SR]; Casanova 2025; Martikainen 2025; Refalo 2024 |
| 4 | `load.trend.noiseTypicalSd` | 0.09 | Design value | Unchanged; add peer-reviewed support | Medium | Marzagao 2026 [PREPRINT]; Grgic 2020; Casanova 2025; Lovegrove 2022 |
| 5 | `load.trend.processSdPerWeek` | 2 / 1 / 0.5 % per week | Design value | Unchanged (calibrated 2026-11-25) | Medium | Swinton 2022; Solberg 2019; Durbin & Koopman 2012 |
| 6 | `load.trend.noviceWidening` | 8 weeks, × 1.5 | Design value | Unchanged | Medium (order of magnitude), low (exact 1.5) | Grgic 2020; Steele 2017 |
| 7 | `load.trend.changeThresholds` | 1 TE, 1.5 SD, 3 sessions, 2.8 TE | Design value | Unchanged (calibrated 2026-11-25) | High (EB-derived parts) | Hopkins 2000; Grgic 2020 |
| 8 | `load.trend.reference` | 4 / 8 / 12 weeks, 3 sessions | Design value | Unchanged | Medium | Grgic 2020; EB |
| 9 | `load.pr.minSetWeight` | 0.5 | Design value | Unchanged | Medium | Halperin 2022; Zourdos 2021 |
| 10 | `load.trend.repRangeShift` | 3 reps | Design value | Unchanged | Medium | Nuzzo 2024; Braith 1993; Mayhew 2008 |
| 11 | `volume.hypertrophy.weeklyBands` | Floor 4, 10–20, high band to 30, hard warning above 40 | Verify | Unchanged; `hardText` "no data" → "almost no data" | Medium-high (4–20); medium (30, 40) | Pelland 2026 and its data; ACSM 2026; Baz-Valle 2022 |
| 12 | `volume.hypertrophy.tiers` | MED 4; extra sets per detectable gain about 6 / 8.5 / 10.75 / 12.5 | Verify | Unchanged | Medium-low | Pelland 2026 data |
| 13 | `volume.strength.tiers` | MED 1; 2 sets about 0.75; 3–4 sets about 2.25; 5+ not detectable | **Correct** | MED 1; 2 sets about 12; **3+ not detectable** | Low-medium | Pelland 2026 data |
| 14 | `volume.puos` | 31 sets; 3 sets; 3 sessions | Verify | Unchanged | Medium-high | Pelland 2026 data |
| 15 | `volume.counting.default` | Fractional | Verify | Unchanged | High | Pelland 2026 |
| 16 | `volume.frequency.strengthPerLift` | 2–3 sessions | Verify | Unchanged | Medium-high | Pelland 2026; ACSM 2026; Androulakis-Korakakis 2021 |
| 17 | `volume.hypertrophy.perSessionSoftCap` | 11 fractional or 8 direct; nudge at 10–12 | Design value | Unchanged | Low-medium | Remmert 2025 [PREPRINT] |
| 18 | `volume.strength.perSessionHeavySets` | 2–3 | Verify | Unchanged | Medium | ACSM 2026; Androulakis-Korakakis 2021 |
| 19 | `volume.strength.weeklyHeavySetsPerLift` | 4–10; minimum 3–6; plateau above 5 | **Correct** (guard) | `plateauAbove` **5 → 3**; band unchanged | Medium | Androulakis-Korakakis 2021; Pelland 2026 data |
| 20 | `volume.effort.hypertrophySlopePerRir` | −0.48 % per RIR | Verify | Unchanged | High | Robinson 2024 (accepted manuscript) |
| 21 | `planning.slot.sets` | 2–5 | Verify | Unchanged | Medium | ACSM 2026; ACSM 2009 |
| 22 | `planning.strength.accessorySets` | 3 | Design value | Unchanged | Medium-low | Androulakis-Korakakis 2021; ACSM 2026 |
| 23 | `planning.volume.startPosition` | 0.2 / 0.5 / 0.5 / 0.8 | Design value | Unchanged | Medium | ACSM 2026; Baz-Valle 2022; Scarpelli 2022 |
| 24 | `planning.variety.pool` | 3 | Design value | Unchanged | Low | Kassiano 2022; Baz-Valle 2019 |
| 25 | `planning.missed.mergePriorities` | `[primary]` | Design value | Unchanged | Medium | PRD PLN-11 |
| 26 | `planning.timeBudget.fallback` | Priorities, else the template's primary slots | Verify (PRD) | Unchanged | Medium | PRD PLN-14; Iversen 2021; Bickel 2011; Spiering 2021 |
| 27 | `progression.apre.sixRm` | 13+ reps → +5 to +10 kg (+7.5) | **Correct** | 13+ reps → **+5 to +7.5 kg (+6.25)** | High | Mann 2011; Mann 2017; Huang 2023 |
| 28 | `progression.calibration` | 1–2 exposures at RIR 3–4 | Verify (PRD) | Unchanged | High | PRD PRG-08; Halperin 2022 |
| 29 | `progression.calibration.reliableSetWeight` | 0.5 | Design value | Unchanged | Medium | Halperin 2022 |
| 30 | `progression.classification.trainingAgeMonths` | Intermediate from 6, advanced from 24 | Design value | Unchanged | Medium | ACSM 2009; EB |
| 31 | `progression.pace.window` | 4 weeks, at least 4 exposures | Design value | Unchanged (statistics question open) | Medium | — |
| 32 | `scoring.wilks.coefficients` | 2 × 6 coefficients | Verify | Unchanged | High (values) | Kopayev 2020; Wilks tables (2008 PDF) |
| 33 | `scoring.wilks2020.coefficients` | 2 × 6 coefficients | Verify | Unchanged | High | Powerlifting Australia 2020 |
| 34 | `scoring.dots.coefficients` | 2 × 5 coefficients | Verify | Unchanged | High | Konertz 2019 |
| 35 | `scoring.ipfGl.coefficients` | 8 × {a, b, c} | Verify | Unchanged | High | IPF 2020 |
| 36 | `bodyweight.rate.maintain` | ±0.25 % BW per week | Verify (PRD) | Unchanged; fix the note | High | PRD BOD-02; Stevens 2006; Turicchi 2020 |
| 37 | `monitoring.readiness.pmFromHour` | 12 | Verify | Unchanged | Medium-high | Craven 2022 |
| 38 | `motivation.streak.defaultWeeklyTarget` | 1 | Verify (PRD) | Unchanged | High | PRD MOT-03; WHO 2020 |
| 39 | `ranking.effectiveness` | Weights 0.4 / 0.15 / 0.15 / 0.2 / 0.1 | Design value | Unchanged | High that no evidence exists | — |

## Proposed value changes (for the product owner's approval)

**Applied 2026-11-25 in rules 1.8.0**, all five (V-2 and V-3 stay `verified: false` as proposed).

None of these changes plan generation (plan-matrix snapshot), the trend labels (calibration snapshot) or MVP session prescriptions.

| ID | Parameter | Change | Evidence | Expected effect |
|---|---|---|---|---|
| V-1 | `progression.apre.sixRm` | 13+ row: `rangeKg { min: 5, max: 10 }` → **`{ min: 5, max: 7.5 }`**, `adjustKg` 7.5 → **6.25**. Sources: add `src.mann2011` as the table source and `src.mann2017`; keep `src.huang2023` as a reproduction. Note: "the original table is in pounds (10–15 lb = 4.5–6.8 kg)". Then `verified: true` | Mann 2011 (dissertation, Appendix A) and Mann 2017 give 13+ reps → +10 to 15 lb. Huang 2023 converted 10–15 lb wrongly to 5–10 kg, and the registry copied it. The other four rows are correct after rounding to plates | **No MVP user effect**: APRE slots run as RPE and no template uses APRE. Once APRE ships (PLN-07, v1.x), a lifter with 13+ reps gets +6.25 kg, usually +5 or +7.5 kg after rounding, instead of +7.5 kg (+7.5 or +10). Reference test: 100 kg and 14 reps → 105 kg instead of 107.5 kg (2.5 kg steps, `nearestTiesDown`) |
| V-2 | `volume.strength.tiers` | `[{1,1,minimumEffectiveDose,null}, {2,2,higherEfficiency,0.75}, {3,4,intermediateEfficiency,2.25}, {5,null,notDetectable,null}]` → **`[{ minSets: 1, maxSets: 1, tier: minimumEffectiveDose, extraSetsPerDetectableGain: null }, { minSets: 2, maxSets: 2, tier: lowerEfficiency, extraSetsPerDetectableGain: 12 }, { minSets: 3, maxSets: null, tier: notDetectable, extraSetsPerDetectableGain: null }]`**. Stays `verified: false` until the published Table 2B is read | Pelland 2026's supplementary data: from 1 set, 3 more give a detectable gain (P 83.6 %); from 2 sets, 12 more (P 52.3 %); from 3 sets, no higher volume up to 32 sets does (best P 3.6 %). This agrees with the PUOS of 3. The preprint's 0.75 and 2.25 could not be reproduced | Display and education only ("How POWR decides"). No engine reads this row |
| V-3 | `volume.strength.weeklyHeavySetsPerLift` | `guard.plateauAbove` **5 → 3**. Note: "no detectable superiority above about 3 fractional sets a week (Pelland 2026 data); gains continue below the detection threshold". Replace `src.pelland2024` with `src.pelland2026`. Band 4–10 and minimum 3–6 unchanged; the row stays `verified: false` (the band is a design value) | As V-2. The 5 came from the preprint's tier label | Display only; no code reads `plateauAbove` |
| V-4 | `volume.hypertrophy.weeklyBands` | `guard.hardText` "no data" → **"almost no data"** (wording) | One study in Pelland's dataset tested more than 40 weekly sets (Schoenfeld 2019, 45 sets) | Display only; the user-facing warning copy (`why.validate.volume.veryHigh`) is unaffected |
| V-5 (verified row, side finding) | `scoring.ipfGl.minBodyweightKg` | 35 kg for both sexes → **men 40 kg, women 35 kg** (needs a sex-specific value, a schema change), or keep 35 with a note | The IPF GL document applies the formula for "Bwt ≥ 40 kg for men and Bwt ≥ 35 kg for women" (rendered page checked). 35 for everyone is OpenPowerlifting's choice | Men between 35 and 40 kg would get no GL score, as at IPF meets. Golden scoring tests are unaffected (their vectors are above 40 kg) |

**Options the evidence allows but this report does not propose:**

- `load.rirBias` +1.0 instead of +0.5 for reported RIR ≥ 3. This is the unbiased central estimate rather than the conservative half. It raises e1RMs from RIR ≥ 3 sets by about 1.5 % (100 kg × 5 at RIR 3: 131.2 kg instead of 129.2 kg) and lowers loads prescribed for RIR ≥ 3 targets by about the same. That would change session prescriptions, the baseline examples and possibly the golden tests.
- `load.trend.noiseTypicalSd` 0.08 for trained lifters who mostly log RIR ≤ 2. This would change the calibration snapshot.

## Proposed verification flips without a value change

Each flip needs the registry edits listed below. Rows that now cite a preprint must drop that source and the `PREPRINT` tag, because `packages/rules/scripts/build.test.ts` fails on any verified row that cites a preprint (E-2). The same test names five rows that must stay `verified: false`: `weeklyBands`, `hypertrophy.tiers`, `perSessionSoftCap`, `puos` and `hypertrophySlopePerRir`. Its list has to lose the four that flip; `perSessionSoftCap` stays.

| Parameter | Sources after the flip | Tags after the flip | Other edits |
|---|---|---|---|
| `load.rirBias` | `src.halperin2022`, `src.refalo2024a`, `src.russo2025`, `src.casanova2025`, `src.martikainen2025` | MA, SR, OBS, RCT-T | Note: "EB §Gaps #26 checked: Russo 2025 is qualitative and confirms the direction; study means +0.2 to +1.6 reps at a called RIR 3" |
| `volume.hypertrophy.weeklyBands` | `src.pelland2026`, `src.acsm2026`, `src.bazvalle2022`, `src.powr-eb-volume` | MA, POS | V-4 wording |
| `volume.hypertrophy.tiers` | `src.pelland2026` | MA | Note: "reproduced from the published paper's supplementary data (OSF); the tier table itself was read in the preprint" |
| `volume.puos` | `src.pelland2026` | MA | Note: the term comes from the Remmert preprint; the values were reproduced from Pelland's data; hypertrophy 31 is partly set by the end of the comparison grid (45 sets) |
| `volume.counting.default` | `src.pelland2026` | MA | Note: the published abstract keeps the conclusion |
| `volume.frequency.strengthPerLift` | `src.pelland2026`, `src.acsm2026`, `src.androulakiskorakakis2021` | MA, POS, DELPHI/SURVEY | — |
| `volume.strength.perSessionHeavySets` | `src.acsm2026`, `src.androulakiskorakakis2021` | POS, DELPHI/SURVEY | — |
| `volume.effort.hypertrophySlopePerRir` | `src.robinson2024` | MA | Note on `src.robinson2024`: "checked against the accepted manuscript: −0.48 % per RIR [−0.78, −0.179]" |
| `planning.slot.sets` | `src.powr-prd`, `src.powr-eb-volume`, `src.acsm2026`, `src.acsm2009` | POS, INF | — |
| `planning.timeBudget.fallback` | Add `src.bickel2011`, `src.spiering2021` | INF, RCT, NARR | Note: PRD PLN-14 |
| `progression.calibration` | Add `src.powr-prd` | INF | Note: PRD PRG-08 verbatim |
| `scoring.wilks.coefficients` | `src.kopayev2020`, `src.wilks2008`, `src.opl-wilks` | OFFICIAL | — |
| `scoring.wilks2020.coefficients` | `src.pa2020`, `src.kopayev2020`, `src.opl-wilks2020` | OFFICIAL | — |
| `scoring.dots.coefficients` | `src.konertz2019`, `src.kopayev2020`, `src.opl-dots` | OFFICIAL | Note: the author describes the derivation in words |
| `scoring.ipfGl.coefficients` | `src.ipf2020`, `src.kopayev2020`, `src.opl-goodlift` (drop `src.vcalc-ipf-gl`) | OFFICIAL | Update the `scoring.yaml` header and the `src.opl-goodlift` note, which still say the sets are unchecked |
| `bodyweight.rate.maintain` | Add `src.powr-prd` | INF | Correct the note (see the section) |
| `monitoring.readiness.pmFromHour` | Unchanged (`src.craven2022`) | MA, INF | Note: "Craven 2022 splits tasks into ante and post meridiem" |
| `motivation.streak.defaultWeeklyTarget` | Unchanged (`src.powr-prd`) | INF | Note and `ebRef`: PRD MOT-03 v0.7 |

**Other source-registry corrections found in passing:**

- `src.pelland2026`: add the DOI 10.1007/s40279-025-02344-w and the OSF data as `seeAlso`. Update the note: the fractional-counting conclusion is confirmed in the published abstract.
- `src.androulakiskorakakis2021`: complete the citation (*Front Sports Act Living* 3:713655).
- `src.bazvalle2022`: complete the citation (*J Hum Kinet* 81:199–210).
- `src.acsm2026`: complete the citation (Currier et al., *Med Sci Sports Exerc* 58(4):851–872).
- `src.acsm2009`, `src.braith1993`, `src.mayhew2008` and `src.craven2022`: complete the titles.
- `src.fitnessvolt-rts-chart`: replace its note, as described under `load.curve.rts`.
- `src.huang2023`: note that its 13+ row mis-converts 10–15 lb.

The full citations are in the bibliography.

**Docs to update after approval (not done):**

- The release checklist T-01 count (38 → 39 before the change).
- The technical concept TD-25 and §8.6.1 counts.
- The EB wording "accessories 1–3 per lift" means 1–3 accessory *exercises* per lift (see `planning.strength.accessorySets`).

## Values that matter for safety or plan quality

1. **`progression.apre.sixRm`, the 13+ row (wrong; not reachable in the MVP).** The upper bound of +10 kg is about 1.5 times the original +15 lb (6.8 kg), and the midpoint +7.5 kg is about 1.2 times the original midpoint (12.5 lb, 5.7 kg). After an AMRAP of 13 or more reps, the next 6RM would jump more than the protocol intends. The set-4 AMRAP and the user's confirmation limit the harm. It must be fixed before APRE ships (V-1).
2. **`load.curve.rts`, provenance (not a safety issue).** The decimal chart POWR ships is not the chart in Tuchscherer's own 2014 booklet, which is 5–8 points lower at 5–11 effective reps. A user who picks "RTS" expecting that chart gets loads about 5–8 % heavier than it implies. POWR's chart agrees with the default Wathan equation within 0.6 points and with the research-based chart of Helms 2016 within about 2 points, so the loads are not unusual. The label should not imply the original.
3. **Strength volume bands versus the published dose–response (plan quality, no change proposed).** Pelland 2026's data show no detectable strength gain above about 3 weekly sets of a lift, while POWR plans 4–10 direct heavy sets per competition lift. More sets still add strength below the detection threshold (10 vs 3 sets: +2.63 % in the model), surveyed powerlifters use 4–8, and the units differ: Pelland counts fractional sets of the tested lift, POWR counts direct sets at ≥ 80 % 1RM. So the band is defensible, but it is a design value, not a research number (V-3 fixes the "plateau" wording).
4. **`progression.pace.window`, statistics (quality, low risk).** With the minimum of 4 exposures, the normal quantile makes the "outrun" switch fire on noise in about 12 % of windows instead of 5 %. A false switch only moves the lift to RPE loading.
5. **`bodyweight.rate.maintain` with short windows (quality).** With 14 days of readings, the slope's standard error is about the width of the ±0.25 % band, so a maintaining user often sees a rate outside it.

## Open questions for the product owner

**Answered on 2026-11-25** (see [Applied (2026-11-25)](#applied-2026-11-25)): 1 yes; 2 flip counting, frequency and the weekly bands now, the tiers and the PUOS after the full text; 3 keep +0.5; 4 keep the values, relabel and re-source; 5 yes to both; 6 both the t quantile and 6 exposures; 7 yes, 21 days; 8 keep 1.

1. **PRD rows.** Flip the four "Verify (PRD)" rows to `verified: true` under the M2a convention (PRD numbers ship verified)? The UI would still label them "App estimate".
2. **Pelland 2026 full text.** The published full text is paywalled and was not read; the verdicts rest on the published abstract, the paper's own supplementary data (whose analysis files date from the preprint) and independent sources (ACSM 2026, Baz-Valle 2022). Flip the five Pelland rows now, or after someone with access reads the published Tables 2A/2B? The recommendation is to flip `counting.default`, `frequency.strengthPerLift` and `weeklyBands` now; their support does not depend on the tier tables. Wait for the full text for `hypertrophy.tiers`, `puos` and V-2.
3. **RIR bias.** Keep the conservative +0.5 for RIR ≥ 3 (recommended; the guard already allows 0.5–1), or move to the central estimate of +1.0?
4. **RTS mode.** Keep the common decimal chart, but call it "RPE chart (common RTS version)" and stop attributing it to Tuchscherer's original? Or switch to Tuchscherer's 2014 chart (5–8 points lower; it would make the RTS mode clearly more conservative than Wathan)? The recommendation is to keep the values and fix the label and source.
5. **IPF GL.** Make the minimum bodyweight sex-specific (V-5)? Should the display follow the IPF rule of rounding the coefficient to 6 decimals? That rule turns the EB's test value 112.85 into 112.86.
6. **Pace check.** Use the t quantile (or `minExposures` 6) in `progression/pace.ts`? This is an engine change, not a registry change.
7. **Bodyweight rate.** Show "not enough data yet" until the readings span 21–28 days, instead of a rate against the ±0.25 % band after 14 days?
8. **Streak default.** WHO 2020 recommends muscle-strengthening on 2 or more days a week. The PRD now fixes 1 session as the floor that keeps a week, which is defensible for a consistency streak. Confirm that 1 stays.

## Parameter analysis

### Load, e1RM and change detection (`load.yaml`)

#### load.curve.rts

- **Value and role:** the RTS chart as a one-dimensional lookup of %1RM by effective reps (r_eff 1 → 100 %, 5 → 86.3 %, 7 → 81.1 %, 10 → 73.9 %, 13.5 → 64.0 %; 26 points). It is used when the user selects the "RTS" equation for exercises of the equation class. The default is Wathan.
- **Claim and current evidence:** "the RTS chart … tracks Wathan within about 0.6 points for 2–10 effective reps" [PRACT]. Sources: FitnessVolt (a secondary transcription) and Zourdos 2016. The row note warns that the chart is a guide and assumes a fresh set.
- **Literature check:**
  - **Transcription.** All 26 values match FitnessVolt and an independent, unattributed public spreadsheet exactly. The research agent read both; see the note.
  - **Origin.** No primary publication of this decimal chart was found. Tuchscherer's *Reactive Training Manual* (2008), chapter 2 in the EliteFTS reprint, uses an older RPE scale and puts 5 × 5 at RPE 8–9 at roughly 70–75 %; the chart image is missing. His booklet *Beginning RTS* (2014; read from a third-party copy) prints an RPE-10 row of 100, 95, 90, 85, 80, 77, 74, 71, 68, 66, 64 and 62 % for 1–12 reps. That is 5–8 points below the registry at 5–11 effective reps. Tuchscherer warns against estimating a max from it.
  - **Peer-reviewed comparison.** Helms, Cronin, Storey & Zourdos 2016 [NARR, full text] does not contain the RTS chart. Its Table 2 is a chart built from Zourdos 2016 squat data with three measured cells (1 @ RPE 10 = 100 %, 1 @ RPE 8 = 91 %, 8 @ RPE 7 = 70 %). The registry lies within −2.2 to +0.4 points of that table and within 1.2 points of the measured cells.
  - **Novices.** Lovegrove 2022 [OBS, abstract]: the loads novices chose for 1 RIR at nominal r_eff 4, 6 and 9 were 93.0 / 87.3 / 79.6 % (bench) and 88.2 / 84.3 / 79.2 % (deadlift). The chart gives 89.2 / 83.7 / 76.2 %.
  - No study validates the chart against measured 1RMs.
- **Verdict:** **Design value** (keep the values and the `PRACT` tag; the row stays `verified: false`). TD-25 asked for a check against an RTS original. None exists in print for this chart, and the author's own later chart differs, so the row cannot be verified. The values are the widely circulated version and agree with Wathan and with Helms 2016.
- **Proposed edits:** replace the note of `src.fitnessvolt-rts-chart`: "the decimal chart as commonly circulated; Tuchscherer 2014 prints a different, lower chart". Add `src.helms2016` to the row as the peer-reviewed comparison. See open question 4.
- **What would settle it:** a validation of the chart against tested 1RMs in trained lifters, or an RTS-published source for the decimal values.
- **Confidence:** high for the transcription; low for validity.

#### load.e1rm.setOrderDecay

- **Value and role:** 0.85. The k-th working set after the first has its e1RM set weight multiplied by 0.85^k. This lowers its chance to be the session's top candidate and its weight in the trend filter (R = σ² / w).
- **Claim and current evidence:** the EB gives only the direction: "down-weight sets after the first working set". 0.85 is a POWR design value. [INF]: Marzagao 2026, the technical concept.
- **Literature check:**
  - **Reps fall across sets at a fixed load.** With 1 minute of rest they fall from set 2; with 3–5 minutes, from set 3 or earlier. Sources [OBS, mostly abstracts]: Richmond & Godard 2004 (bench at 75 %, reps fell in set 2 even with 5 min rest); Senna 2011; Scudese 2015; Willardson & Burkett 2005, 2006a, 2006b; Senna 2017 (full text; at 80 % 1RM, set 2 vs set 1 effect size 0.83–0.95 with 3–5 min rest).
  - **Maximal strength recovers fast.** The 1RM itself recovers within about 1–3 minutes (de Salles 2009 [NARR]). An e1RM from a later set near failure is therefore biased **low**, by an estimated 3–6 % by sets 2–4 (the research agent's inference).
  - **Later sets are not noisier.** RIR accuracy is slightly better in later sets (Halperin 2022: −0.07 reps per set; Refalo 2024: set 1 and set 2 equivalent).
  - No study compares the e1RM from successive sets with a measured 1RM, and none gives a per-set weight.
- **Verdict:** **Design value** (keep). The evidence describes a bias, not a loss of trust. Because the session e1RM takes the best weighted candidate, a later, lower set rarely wins anyway; the decay mainly matters when a later set is the best estimate. A bias correction would fit the evidence better than a trust weight; that is a model change for later.
- **What would settle it:** a within-session study in trained lifters (the e1RM of each set vs a measured 1RM at 2–5 min rest), or POWR's own logs (the ratio of set-k to set-1 e1RM at matched load and rest).
- **Confidence:** high that no evidence-based number exists.

#### load.rirBias

- **Value and role:** `[{ minRir: 0, add: 0 }, { minRir: 3, add: 0.5 }]`, guard 0.5–1 for RIR ≥ 3. It is added to the reported RIR before the effective reps are computed, and to the target RIR in load-for-target, so the two are exact inverses.
- **Claim and current evidence:** lifters under-call RIR by about one rep, more so far from failure. [MA, RCT]: Halperin 2022, Refalo 2024. "Preliminary until the verification pass of EB §Gaps #26 (Russo 2025)."
- **Literature check:**
  - **Sign.** Every source finds that lifters complete more reps than they predict, so the true RIR is above the reported one. Adding to the reported RIR is the right direction.
  - **Russo 2025** [SR, 26 studies; abstract and first page read; the publisher returned HTTP 403]: "Greater accuracy was found … at greater proximity to muscle failure, particularly in exercises involving the upper limbs. The accuracy decreased as the number of repetitions increased and relative load … decreased." The synthesis is qualitative, with no pooled error, so it confirms the direction but cannot set the number. Gap #26 can be closed.
  - **Halperin 2022** [MA]: under-prediction of 0.95 reps (95 % CI 0.17–1.73), with a between-person SD of 1.45 reps.
  - **Size at loads ≥ 75–80 % 1RM** (true minus reported RIR):
    - Casanova 2025 [OBS, full text; cable and leg-curl exercises]: at a called RIR 3, +1.59, +1.56 and +0.47 (about +1.2); at RIR 1, +0.50, +0.65 and +0.09.
    - Martikainen 2025 [RCT-T, full text; barbell, trained lifters, baseline]: at RIR 3, squat +1.5 ± 1.7 and bench +1.1 ± 1.8.
    - Refalo 2024 [OBS]: bench +0.17 ± 1.00 pooled over RIR 1 and 3, which were equivalent.
  - **Lighter loads and higher reps.** At 50 % 1RM or above 12 reps the error is 2–5 reps. The engine already weights those sets at 0.1 or excludes them.
  - **No newer pooled estimate.** Bastos 2024 [SR, scoping] gives no numbers. A three-level meta-analysis is registered on OSF (Zhao, Yin et al. 2026) without public results; it is worth watching.
- **Verdict:** **Verify.** +0.5 at RIR ≥ 3 is the conservative half of the evidence range (about +0.5 to +1; study means from +0.2 to +1.6). 0 at RIR ≤ 2 is slightly conservative (observed about +0.1 to +0.65). Both keep e1RMs from being inflated. The option of +1.0 is described under the proposed changes and in open question 3.
- **Confidence:** medium.

#### load.trend.noiseTypicalSd

- **Value and role:** 0.09 (range 0.08–0.10). The trend filter's observation noise for typical logged sets (not heavy, low-rep, RPE ≥ 9 sets).
- **Claim and current evidence:** an 8.5–10 % within-person spread of near-failure e1RMs in 14-day windows of app data. [PREPRINT]: Marzagao 2026. The trend review of 2026-11-25 kept 9 % (Zourdos 2021, Steele 2017 and Nuzzo 2024 fit the order of magnitude).
- **Literature check:**
  - Marzagao 2026 is still a preprint, and still the only direct measurement of the within-person e1RM spread from logged sets.
  - **Peer-reviewed error budget (lab conditions):**
    - RIR error at RIR 1: SD about 1 rep, about 2–3 % of e1RM (Refalo 2024; Casanova 2025).
    - RIR error at RIR 3: SD about 1.5–1.9 reps, about 4–5.5 % (Casanova 2025; Martikainen 2025).
    - Day-to-day 1RM: CV 2.1 % in trained squatters (Banyard 2017) and a median of 3.3 % in trained lifters (Grgic 2020 [SR]).
    - The load novices choose for a target RIR: CV 2.7–6.2 % (Lovegrove 2022).
  - Combined in quadrature these give about 5–8 % in the lab. Real logging adds entry errors, uncontrolled rest and true change, so 9 % is plausible.
- **Verdict:** **Design value** (keep 0.09; the row stays `verified: false` under E-2 because its only direct source is a preprint). Proposed: tag it `[PREPRINT, INF]` and add the peer-reviewed supporting sources (`src.grgic2020`, `src.refalo2024a`, `src.casanova2025`, `src.lovegrove2022`).
- **What would settle it:** the peer-reviewed publication of a within-person e1RM spread from logged sets.
- **Confidence:** medium.

#### load.trend.processSdPerWeek

- **Value and role:** `{ novice: 0.02, intermediate: 0.01, advanced: 0.005 }`, as a fraction of ln e1RM per week. The prior for how fast a lifter's true e1RM moves: the Kalman filter's process noise by level, which sets how fast the smoothed e1RM follows new sessions and how wide its band is.
- **Claim and current evidence:** about the top of each level's realistic weekly rate. [MA, OBS, MODEL, INF]: Swinton 2022, Androulakis-Korakakis 2020, Ahtiainen 2003, Solberg 2019, McMaster 2013, Kolossa 2017, Durbin & Koopman 2012, the EB and the technical concept.
- **Literature check (brief, as asked):**
  - This row was reviewed on 2026-11-25 against the literature and a seeded simulation ("M4 trend-label calibration", rules 1.6.0) and kept.
  - I re-read the published Swinton 2022 abstract (J Sports Sci 40(18):2047–2054). It confirms the method (Bayesian hierarchical meta-analyses of 643 studies and 6,574 effect sizes, with the 0.25, 0.5 and 0.75 quantiles as small, medium and large thresholds) but does not print the strength quantiles. The registry note already says those were read from the preprint.
  - Nothing published since changes the picture: about 1–2 %/week for novices, 0.2–1 %/week for trained lifters in 8–12-week trials, and well below 0.25 %/week long-run for advanced lifters (EB §Progression › Realistic progress).
- **Verdict:** **Design value** (keep). No study measures the week-to-week variance of a lifter's true strength. The values are priors chosen from rates of change and tuned in simulation.
- **What would settle it:** per-person maximum-likelihood estimates from POWR's own opt-in data, as the row note proposes.
- **Confidence:** medium.

#### load.trend.noviceWidening

- **Value and role:** `{ weeks: 8, factor: 1.5 }`. A novice's observation noise σ is multiplied by 1.5 while the exercise has at most 8 weeks of data (`trendObservation`). Since rules 1.7.0 the result is floored at the level's typical error (5.5 % for novices).
- **Claim and current evidence:** EB §Load › e1RM drift: "show wider bands for beginners in their first 4–8 weeks" [INF]; PRD PRG-02 says the same. The factor 1.5 is a POWR design value. Source: `src.powr-eb-load` only.
- **Literature check:**
  - The 1RM test–retest CV is 5.5 % in untrained and 3.3 % in trained people (ratio 1.67). It is 5.3 % without familiarisation and 3.8 % with it (ratio 1.39) (Grgic 2020 [SR], full text checked). The two ratios bracket the factor 1.5.
  - Novices predict reps to failure less accurately at first and improve with practice. Steele 2017 [OBS] reports an SEM of 4.15–5.13 reps in an orientation group vs 1.27–2.29 in experienced lifters (figures as quoted in the EB). In Wiedenmann 2026 [OBS] the error fell by up to 2.3 reps over 6 sessions. This supports a temporary widening, not its size.
  - No study measures how long the extra noise of a novice's logged-set e1RM lasts. 8 weeks is the EB's and the PRD's upper end.
- **Verdict:** **Design value** (keep). The factor lies inside the range the reliability ratios suggest (about 1.4–1.7). Since the TE floor of rules 1.7.0, the factor matters mainly for typical sets (9 % → 13.5 %); for heavy sets, 4 % × 1.5 = 6 % is just above the 5.5 % floor. Proposed: add `src.grgic2020` to the row's sources as the rationale.
- **What would settle it:** the within-person SD of novices' session e1RMs by week of training, from a cohort or from opt-in app data.
- **Confidence:** medium for the order of magnitude; low for exactly 1.5.

#### load.trend.changeThresholds

- **Value and role:** `{ likelyTe: 1, likelyZ: 1.5, sustainSessions: 3, veryLikelyTe: 2.8 }`. The gate for the trend labels "likely real" and "very likely real" (PRG-02).
- **Claim and current evidence:** a claim needs the smoothed change to exceed 1 TE and 1.5 SD of its own uncertainty, with the same sign for 3 sessions. "Very likely" needs 2.8 TE or 1.96 SD. [SR, MODEL, INF]: Hopkins 2000, Grgic 2020, Durbin & Koopman 2012, Stephens Hemingway 2020, the EB.
- **Literature check (brief):**
  - `likelyTe` 1 and `sustainSessions` 2–3 are the EB's rule.
  - `veryLikelyTe` 2.8 is the minimum detectable change between two single tests, 1.96 × √2 × TE ≈ 2.77 TE (Hopkins 2000; recomputed in the EB).
  - `likelyZ` 1.5 and `sustainSessions` 3 were set from the seeded simulation on 2026-11-25 (product owner: "strict, honesty first"). That calibration is documented and was not redone here.
  - No study validates labelling rules for smoothed e1RM series in lifters.
- **Verdict:** **Design value** (keep). Two of the four fields come from evidence and two are calibration choices, so the row as a whole stays preliminary.
- **What would settle it:** validating the labels against tested 1RM changes in a cohort that logs its training in POWR.
- **Confidence:** high that the evidence-derived fields are transcribed correctly. The design fields are the product owner's calibrated choice.

#### load.trend.reference

- **Value and role:** `{ weeks: { novice: 4, intermediate: 8, advanced: 12 }, sessions: 3 }`. The change label compares today's smoothed e1RM with the value this many weeks (or 3 sessions) earlier.
- **Claim and current evidence:** a gain of g per week can only pass 1 TE once g × weeks > TE; the EB classifies progress by the slope over 8–12 weeks. [MA, OBS, INF]: Swinton 2022, Ahtiainen 2003, Solberg 2019, Grgic 2020, the EB and the technical concept.
- **Literature check (brief):** the arithmetic follows from the verified TE values (3.3 % trained, 5.5 % novice; Grgic 2020) and realistic rates (novices 1–2 %/week; intermediates about 0.5 %/week; advanced lifters 0.25–0.5 %/week in a good block). The EB recommends judging progress over 8–12 weeks. The windows were re-checked in rules 1.7.0 (TD-60, advanced 12 weeks).
- **Verdict:** **Design value** (keep). The windows are derived, not measured.
- **What would settle it:** the same validation as for `changeThresholds`.
- **Confidence:** medium.

#### load.pr.minSetWeight

- **Value and role:** 0.5. An e1RM PR (MOT-01) counts only from a set with entered effort whose base weight reaches the 0.5 tier: RPE ≥ 7 and at most 12 effective reps.
- **Claim and current evidence:** PRD MOT-01 ("e1RM PR only from qualifying sets per PRG-01 weighting") and R-07 ("e1RM noise causes false PRs"); the EB set weights 1.0 / 0.5 / ≤ 0.1. [INF]: PRD, Halperin 2022, Grgic 2020.
- **Literature check:**
  - RIR prediction error grows sharply above 12 reps: Halperin 2022 [MA] reports 0.47 extra reps of error per rep above 12, against 0.06 at or below 12.
  - It also grows far from failure: Zourdos 2021 [OBS] reports an error of 2.05 reps at a called RPE 9, 3.65 at RPE 7 and 5.15 at RPE 5 (squat at 70 %).
  - Both findings support excluding sets beyond 12 effective reps and below RPE 7.
  - Where exactly to cut is not studied. A stricter cut (the 1.0 tier) would halve the modelled noise (4 % vs 9 %), but hypertrophy lifters, whose sets are mostly 8–12 reps at RIR 1–2, would rarely see an e1RM PR.
  - A max-based PR is prone to noise by design: for a lifter whose strength is flat, with 9 % session noise, a new best still appears by chance in about 1 of n sessions after n sessions. That is why PRs are shown apart from the trend label.
- **Verdict:** **Design value** (keep). The cut agrees with the evidence on where RIR self-reports fail; its exact place is a product trade-off.
- **Confidence:** medium.

#### load.trend.repRangeShift

- **Value and role:** 3 reps. A "likely real" change is flagged as "possibly a rep-range effect" when the median reps of the latest sessions differ from those at the reference by at least 3.
- **Claim and current evidence:** EB §Load › e1RM drift: "flag e1RM jumps that coincide with a change in typical rep range". [OBS, INF]: Braith 1993, Mayhew 2008, the EB. The size is a design value.
- **Literature check:**
  - **Between-person spread.** The artefact comes from individual load–rep curves that differ from the population curve. Nuzzo 2024 [MA, full text] estimates the between-person SD of reps to failure at 2.51 reps at 80 % 1RM (mean about 9.75 reps, so about 26 %) and 4.36 reps at 60 %.
  - **Training moves the curve.** In Braith 1993, the 7–10RM moved from 68.4 % to 79.1 % of 1RM. In Mayhew 2008, individual reps at a fixed %1RM changed by −15 to +17.
  - **Worked example with the Wathan curve [INF].** Take a lifter whose reps at any load are 25 % above the population curve (about 1 SD):
    - moving the typical set from 5 to 8 reps shifts the e1RM bias from +3.4 % to +4.8 %, an artefact of about 1.4 %;
    - from 3 to 6 reps, the artefact is 1.7 %;
    - from 3 to 10 reps, it is 3.3 %.
    - At 1.5 times the population reps (about 2 SD), a 3-rep shift gives 1.8–2.9 %.
  - So a 3-rep shift marks changes where the artefact can reach about half to one TE of a trained lifter (3.3 %). The flag only adds a caution to a label; a lower threshold would flag more often for smaller artefacts.
- **Verdict:** **Design value** (keep). The threshold is the right order of magnitude for the artefact it guards against, but no study gives the number. Proposed: add `src.nuzzo2024` to the row's sources.
- **What would settle it:** per-person load–rep curves (the personal curve fit, TD-26), which would let the engine compute the artefact instead of flagging by rep count.
- **Confidence:** medium.

### Volume, frequency and effort (`volume.yaml`)

**The common source.** Most volume rows rest on Pelland, Remmert, Robinson, Hinson & Zourdos (Sports Med 2026;56(2):481–505, DOI 10.1007/s40279-025-02344-w).

- **What I read:** the published abstract, on PubMed. It reports 67 studies and 2,058 participants. "The relative evidence for the 'fractional' quantification method was strongest". Volume raises hypertrophy and strength with 100 % posterior probability, with diminishing returns "considerably more pronounced" for strength. Frequency is "compatible with negligible effects" for hypertrophy and positive, with diminishing returns, for strength. The abstract gives no slopes, tiers, SDES or PUOS.
- **What could not be read:** the published full text, which is paywalled.
- **The supplementary data.** The paper names its supplementary data on OSF (osf.io/6z3xu), and the research agent opened them. All analysis files date from September–October 2024, the preprint. The only later addition is an inclusion-criteria PDF from August 2025, during peer review. The published models are therefore almost certainly the preprint's [INF].
- **Recomputation.** The agent recomputed the thresholds from the pairwise tables in `research_notes/Parameter verification/volume.md`, Appendix A. The SportRxiv preprints returned HTTP 403, so preprint-only numbers (the Bayes factors, the +3.27 % per session) could not be re-read.

#### volume.hypertrophy.weeklyBands

- **Value and role:** `{ floor: 4, defaultLow: 10, defaultHigh: 20, highHigh: 30, hardWarnAbove: 40 }` fractional sets per muscle per week. Guard: soft warning above 30 ("no detectable superiority"), hard warning above 40 ("no data"). It drives the plan targets, the validator warnings and the volume screen.
- **Claim and current evidence:** the EB policy (§Defaults › Volume). [MA, PREPRINT]: Pelland 2026, Pelland 2024 preprint, Baz-Valle 2022, ACSM 2026.
- **Literature check:**
  - **Floor 4.** In the published paper's data, 4 vs 0 sets gives +2.21 % [1.32, 3.06], with a 64.8 % probability of exceeding the 2.05 % SDES; at 3 sets it is 23 %. Iversen 2021 [NARR] also recommends at least 4 weekly sets.
  - **10 and 20.** ACSM 2026 [POS, full text; quotes checked by me]: "Volume: ≥10 sets/wk (dose-response)". In its discussion, ACSM paraphrases the published Pelland paper: diminishing returns beyond "~18–20 weekly sets for hypertrophy". Baz-Valle 2022 [MA/SR, full text]: "12-20 weekly sets per muscle group may be an optimum standard recommendation". More than 20 vs 12–20 sets made no difference for the quadriceps (p = 0.19) or biceps (p = 0.59); the triceps favoured more than 20 (p = 0.01).
  - **30.** The PUOS is 31: going from 30 to 45 sets has a 61.7 % probability of a detectable gain, from 31 to 45 only 46.9 %.
  - **40.** Only one study in Pelland's dataset goes above 40 sets (Schoenfeld 2019, two effects at 45 sets), and two go above 35. Enes 2024 [RCT-T, abstract], progressing towards roughly 42–52 sets, found no significant difference in growth and an apparent plateau.
- **Verdict:** **Verify**, with no number changed. Replace the preprint source with `src.pelland2026` (with the OSF data as `seeAlso`), and change `hardText` to "almost no data" (V-4).
- **Confidence:** medium-high for 4, 10 and 20; medium for 30 and 40.

#### volume.hypertrophy.tiers

- **Value and role:** MED 4; 5–10 sets about 6 extra sets per detectable gain; 11–18 about 8.5; 19–29 about 10.75; 30–42 about 12.5; 43+ unclear. Data only: shown on "How POWR decides", read by no engine.
- **Claim and current evidence:** the preprint's efficiency table (Table 2A); SDES 2.05 %. [PREPRINT].
- **Literature check:** the published paper's data reproduce MED 4 and the 2.05 % SDES. Recomputed, the extra sets per detectable gain are about 5.8, 8.1, 10.6 and 13.1, within the "about" precision of the registry. One-set increments fall from 0.74 % (0 → 1) to 0.24 % at 12 → 13 sets, matching the preprint's +0.24 % per set at the mean of 12.25 sets. Whether the published text still prints the tier table could not be seen.
- **Verdict:** **Verify** (re-source to `src.pelland2026`). See open question 2: waiting for the published Table 2A is reasonable.
- **Confidence:** medium-low.

#### volume.strength.tiers

- **Value and role:** MED 1; 2 sets about 0.75 extra sets per detectable gain; 3–4 sets about 2.25; 5+ not detectable. Data only.
- **Claim and current evidence:** the preprint's Table 2B; SDES 3.96 %. [PREPRINT].
- **Literature check (the published paper's data):**
  - 1 vs 0 sets gives +7.59 % [5.73, 9.40], with a 99.99 % probability of exceeding the 3.96 % SDES. The MED of 1 set holds.
  - One-set increments: 2.47 % (1 → 2), 1.23, 0.73, 0.49 … 0.20 % (7 → 8). This is the reciprocal shape the preprint describes.
  - From 1 set, 3 more give a detectable gain (4 vs 1: +4.49 %, P 83.6 %). From 2 sets it takes 12 more (14 vs 2: +3.98 %, P 52.3 %). **From 3 sets, no higher volume up to 32 sets reaches P > 50 %** (best: P 3.6 %).
  - The preprint's 0.75 and 2.25 could not be reproduced with any reading of the tables. The "not detectable from 5" boundary also contradicts the registry's own PUOS of 3.
  - Absolute gains continue past 3 sets but stay below the detection threshold: 10 vs 3 sets gives +2.63 % in the model.
- **Verdict:** **Correct** (V-2): MED 1; 2 sets with about 12 extra sets per detectable gain; 3+ not detectable. The row stays `verified: false` until the published Table 2B is read, because the corrected table is POWR's recomputation.
- **Confidence:** medium for the data; low for how the authors label the tiers.

#### volume.puos

- **Value and role:** `{ hypertrophyFractionalSets: 31, strengthFractionalSets: 3, strengthSessionsPerWeek: 3 }`, the point of undetectable outcome superiority. Data only.
- **Claim and current evidence:** the Remmert preprint citing Pelland. [PREPRINT].
- **Literature check:** recomputed from the published paper's data, defined as the lowest count from which no higher count in the comparison grid has more than a 50 % probability of exceeding the SDES:
  - hypertrophy **31** sets (30 → 45: 61.7 %; 31 → 45: 46.9 %; the grid ends at 45);
  - strength **3** sets (2 → 14: 52.3 %; 3 → 32: 3.6 %);
  - strength frequency **3** sessions (2 → 5: 61.85 %; 3 → 6: 0.0 %).
  - The authors stress that these are not upper limits.
- **Verdict:** **Verify** (re-source to `src.pelland2026`). Note that the hypertrophy value is partly set by where the grid ends.
- **Confidence:** medium-high.

#### volume.counting.default

- **Value and role:** `fractional` (direct 1.0, synergist 0.5), the default display of weekly volume. Both counts are always computed.
- **Claim and current evidence:** fractional counting fitted better than total or direct counting. Whether the published version kept this was unverified (E-2). [MA]: Pelland 2024, Pelland 2026.
- **Literature check:** the published abstract keeps it verbatim: "The relative evidence for the 'fractional' quantification method was strongest; therefore, this quantification method was used for the primary meta-regression models." The OSF sensitivity plots put the best synergist weight for weekly volume at about 0.38–0.40, and 0.5 fits within about 0.1 % of that optimum.
- **Verdict:** **Verify** (cite `src.pelland2026` only).
- **Confidence:** high for the conclusion; the exact Bayes factors could not be re-read.

#### volume.frequency.strengthPerLift

- **Value and role:** `{ min: 2, max: 3 }` sessions per competition lift per week, used by the plan validator (PLN-04).
- **Claim and current evidence:** frequency has an independent strength effect, with little detectable gain above about 3 sessions. [MA]: Pelland 2024 (preprint).
- **Literature check:**
  - **Published abstract.** The strength effect of frequency has a 100 % posterior probability, with diminishing returns.
  - **The paper's data.** 0 → 1 session gives +12.72 %, 1 → 2 sessions +4.07 % [3.41, 4.79] (62 % probability of a detectable gain), and 2 → 3 sessions +2.02 %. Nothing is detectable beyond 3.
  - **ACSM 2026** [POS]: "Frequency: ≥2 sessions/wk" for strength.
  - **Androulakis-Korakakis 2021** [DELPHI/SURVEY, full text]: minimum-dose sets "spread across 1–3 sessions per week per powerlift".
- **Verdict:** **Verify** (sources: `src.pelland2026`, `src.acsm2026`, `src.androulakiskorakakis2021`).
- **Confidence:** medium-high.

#### volume.hypertrophy.perSessionSoftCap

- **Value and role:** `{ fractionalSets: 11, directSets: 8, nudge: { min: 10, max: 12 } }` per muscle per session. The generator's per-session cap and the validator's "consider another day" nudge (PLN-04).
- **Claim and current evidence:** per-session returns flatten near 11 fractional sets. [PREPRINT]: Remmert 2025.
- **Literature check:**
  - **No peer-reviewed full paper.** There is nothing on PubMed, and Crossref lists only the SportRxiv preprint. The published Pelland 2026 still cites it as a preprint (version accessed 26 August 2025).
  - **Two conference abstracts by the same group** appeared in *Med Sci Sports Exerc* 58(10S) in September 2026: Joachim et al. #336 on hypertrophy and Dunsmore et al. #327 on strength. Only their metadata could be seen.
  - A university press release (FAU, June 2025) repeats "about 11 fractional sets per session". It is not evidence.
  - Few data lie above the cap: about 33 effects from 12 studies exceed 11 sets per session.
- **Verdict:** **Design value** (keep the values; `verified: false` under E-2).
- **What would settle it:** the peer-reviewed Remmert paper or the full conference abstracts.
- **Confidence:** low-medium.

#### volume.strength.perSessionHeavySets

- **Value and role:** `{ min: 2, max: 3 }` direct heavy sets per lift per session. The planner's strength per-session cap; above it, PLN-04 suggests another session.
- **Claim and current evidence:** per-session strength returns flatten at about 2 direct sets. [PREPRINT]: Remmert 2025.
- **Literature check:**
  - ACSM 2026 [POS, full text; quotes checked by me]: Table 6 gives "Volume: 2–3 sets/session" for strength, and the discussion says "healthy adults are advised to complete at least two sets per exercise. Completing more than two sets per exercise may provide additional benefits, but we hypothesize that these benefits diminish with each subsequent set."
  - Androulakis-Korakakis 2021: 2–3 back-off sets after a top single help.
  - ACSM's figure refers to sets per exercise and session in general strength training, not specifically to heavy sets of a competition lift, so the fit is close but not exact.
- **Verdict:** **Verify** (sources: `src.acsm2026`, `src.androulakiskorakakis2021`).
- **Confidence:** medium.

#### volume.strength.weeklyHeavySetsPerLift

- **Value and role:** `{ min: 4, max: 10 }` direct heavy sets per competition lift per week; guard `minimumDose { min: 3, max: 6 }`, `plateauAbove: 5`. The band drives the strength targets and validation (PLN-03).
- **Claim and current evidence:** [MA, DELPHI/SURVEY]: Androulakis-Korakakis 2021, Pelland 2024. "The plateau above about 5 sets comes from the Pelland preprint."
- **Literature check:**
  - **Minimum dose.** Androulakis-Korakakis 2021 (*Front Sports Act Living* 3:713655, full text; the registry citation lacks the journal): "~3–6 working sets of 1–5 repetitions each week, with these sets spread across 1–3 sessions per week per powerlift, using loads above 80% 1RM at … RPE … 7.5–9.5 for 6–12 weeks". This verifies `minimumDose` 3–6.
  - **What powerlifters do.** Powerlifters who had used a minimum-dose approach reported squat 5.4 ± 1.6, bench 7.6 ± 3.2 and deadlift 3.8 ± 1.3 weekly sets.
  - **Band 4–10.** No trial sets 10 as an upper bound, and Pelland counts fractional sets of the tested lift where POWR counts direct sets at ≥ 80 % 1RM. The band therefore remains a design value.
  - **Plateau.** The published data show no detectable superiority above about 3 sets, not 5 (see `volume.strength.tiers`).
- **Verdict:** **Correct** the guard (V-3: `plateauAbove` 5 → 3). The band stays a design value, so the row stays `verified: false`.
- **Confidence:** high for the minimum dose; medium for the plateau value.

#### volume.effort.hypertrophySlopePerRir

- **Value and role:** −0.48 % muscle size per extra RIR. Used in education texts only.
- **Claim and current evidence:** "Preprint numbers (SportRxiv 295); verify against the final paper." [MA, PREPRINT]: Robinson 2024.
- **Literature check:** the research agent read the peer-reviewed accepted manuscript (Abertay University repository; the version of record is paywalled).
  - Hypertrophy, % change: β = **−0.48 % per RIR [95 % CI −0.78, −0.179]**, linear model, 140 effects from 26 studies. The prediction interval is −9.8 to 9.8, so individual study effects vary widely.
  - Standardised hypertrophy effect: −0.019 [−0.035, −0.004].
  - Sensitivity analysis (RIR < 10): −0.544 % [−0.929, −0.158].
  - Strength: no effect (standardised 0.003 [−0.012, 0.018]; % change −0.059 [−0.304, 0.186]).
  - RIR was estimated from study descriptions (mean 3.59 ± 3.40, range 0–21).
- **Verdict:** **Verify**: the number is identical. Cite `src.robinson2024` only and drop the `PREPRINT` tag.
- **Confidence:** high.

### Planning (`planning.yaml`)

#### planning.slot.sets

- **Value and role:** `{ min: 2, max: 5 }` working sets per exercise slot per session. The generator allocates weekly volume to slots within this range; more volume comes from more slots.
- **Claim and current evidence:** POWR design value; the PRD PLN-07 examples are 3 × 10, 5 × 3, 4 × 5 and 3 × 8–12. [INF]: PRD, the EB (which sets volume per muscle, not per exercise).
- **Literature check:**
  - **ACSM 2026** [POS, full text]: "healthy adults are advised to complete at least two sets per exercise", with diminishing benefits from each further set.
  - **ACSM 2009** [POS, full text]: "one to three sets per exercise … by novice individuals initially" (evidence category A), and "three to six sets per exercise" for advanced hypertrophy training (category C). It also notes that "three to four sets per exercise produced the most substantial effect sizes" for strength in the meta-analyses it cites.
  - Per-session diminishing returns (see `perSessionSoftCap`) argue against piling many sets onto one exercise.
- **Verdict:** **Verify**. The minimum of 2 is ACSM 2026's advice, and the maximum of 5 lies inside ACSM 2009's 3–6 for advanced lifters. Add `src.acsm2026` and `src.acsm2009` as sources.
- **Confidence:** medium.

#### planning.strength.accessorySets

- **Value and role:** 3 working sets per powerlifting accessory slot. No muscle bands apply to these slots (PLN-03).
- **Claim and current evidence:** POWR design value. [DELPHI/SURVEY, INF]: Androulakis-Korakakis 2021 (the EB: "accessories 1–3 per lift at RPE 7–9 for 6–10 reps"), PRD.
- **Literature check:**
  - **The EB's "1–3" counts exercises, not sets.** Androulakis-Korakakis 2021 (full text) says "PL athletes typically utilize 1–3 accessory exercises per powerlift, at an RPE in the range of 7–9 and utilize a repetition range of ~6–10 repetitions".
  - **Sets per accessory.** Its Table 12 (21 respondents, self-report) gives accessory exercises and working sets per week: squat 2.1 and 4.0, bench 2.6 and 7.3, deadlift 1.6 and 4.2. That is about 2–3 sets per accessory exercise per week.
  - ACSM 2026 advises at least two sets per exercise.
  - POWR's 3 sets per slot matches if a slot occurs once a week. Twice a week gives 6 sets per exercise, more than the surveyed lifters reported, but nothing suggests harm.
- **Verdict:** **Design value** (keep). Fix the EB wording ("1–3 accessory exercises per lift") at the next EB revision.
- **Confidence:** medium-low.

#### planning.volume.startPosition

- **Value and role:** `{ novice: 0.2, intermediate: 0.5, advanced: 0.5, priority: 0.8 }`, the position within the default band where a plan starts when no recent volume is known. Hypertrophy: novice 12, intermediate and advanced 15, priority muscles 18 fractional sets. Strength: correspondingly within 4–10 heavy sets per lift.
- **Claim and current evidence:** PRD PLN-03: novices in the lower part, intermediate and advanced lifters mid-band, priority muscles in the upper part. The numbers are POWR's. [INF]: PRD, the EB.
- **Literature check:**
  - All three hypertrophy starting points lie inside the evidence bands: ACSM 2026 "≥ 10 sets/wk"; Baz-Valle 2022 "12–20 weekly sets"; the Pelland dose–response.
  - Starting lower for novices fits ACSM 2009 (1–3 sets per exercise for novices).
  - The starting point matters relative to the lifter's history: in Scarpelli 2022 [RCT-T], 1.2 times the logged volume beat a standard 22 sets, and in Barsuhn 2025 [RCT-T], +30 % or +60 % added nothing. When recent volume is known, the 1.2× rule (`volume.startingVolume.maxFactor`, verified) overrides this row.
  - No study sets the exact positions.
- **Verdict:** **Design value** (keep). The PRD fixes the direction; the numbers are a sensible reading of it.
- **Confidence:** medium.

#### planning.variety.pool

- **Value and role:** 3. In the opt-in variety mode, the generator picks among the best 3 candidates of a slot using the plan seed.
- **Claim and current evidence:** POWR design value. [INF]: Baz-Valle 2019, the technical concept.
- **Literature check:** Kassiano 2022 [SR] finds that "some degree of systematic variation" helps regional growth, while "excessive, random variation may compromise muscular gains". In Baz-Valle 2019 [RCT-T], exercises chosen at random by an app gave equal gains and higher motivation. Neither study gives a pool size. Because the pool holds only the top-ranked candidates for the slot, the pick stays close to the best one.
- **Verdict:** **Design value** (keep).
- **Confidence:** low that 3 beats 2 or 4; high that no evidence decides it.

#### planning.missed.mergePriorities

- **Value and role:** `[primary]`. When a missed session's key work is merged into the next session (PLN-11), the primary slots move, within the per-session caps.
- **Claim and current evidence:** PRD PLN-11 ("merge key work … never drop planned work silently"); reading "key work" as the primary slots is POWR's interpretation. [INF]: PRD.
- **Literature check:** no study addresses which work to move after a missed session. Two findings bear on it indirectly. For strength, the frequency of the lift has an effect of its own (Pelland 2026), which supports keeping the main lifts. For hypertrophy, weekly volume matters more than how it is distributed (Schoenfeld 2019b [MA]).
- **Verdict:** **Design value** (keep).
- **Confidence:** medium.

#### planning.timeBudget.fallback

- **Value and role:** `{ keepFull: [priorities, template], templateSlots: [primary] }`. When the session time budget cannot fit every weekly target, the user's priority muscles keep their full target; without priorities, the muscles of the template's primary slots do. The others fall back towards `volume.hypertrophy.minimumDose` (4 weekly sets).
- **Claim and current evidence:** the product owner decided this on 2026-11-24 (M2b: "Priority muscles (else the template's primary-slot muscles) keep their full target"), and it is now in PRD PLN-14: "the user's priority muscles keep their full target … Without priorities, the muscles the template emphasises keep theirs". [INF]: PRD, Iversen 2021.
- **Literature check:** the fallback dose is supported. Iversen 2021 [NARR] recommends at least 4 weekly sets per muscle at 6–15RM. Strength and size are maintained for months with one-third of the volume (Bickel 2011 [RCT]), or, in younger adults, with one session and one set per exercise a week if the relative load is kept (Spiering 2021 [NARR], abstract). Which muscles keep their full target is a product choice.
- **Verdict:** **Verify (PRD).** Add `src.bickel2011` and `src.spiering2021` as support for the fallback dose.
- **Confidence:** medium. The "primary slots" reading comes from the M2b decision record, not from the PRD text.

### Progression (`progression.yaml`)

#### progression.apre.sixRm

- **Value and role:** the APRE-6 preset. The ramp is 10 × 50 % and 6 × 75 % of the 6RM, then an AMRAP at the 6RM. The reps on that set adjust set 4 and the next 6RM:
  - 0–2 reps: −3.75 kg (range −2.5 to −5);
  - 3–4 reps: −1.25 kg (0 to −2.5);
  - 5–7 reps: no change;
  - 8–12 reps: +3.75 kg (+2.5 to +5);
  - 13+ reps: **+7.5 kg (+5 to +10)**.
- **Claim and current evidence:** [RCT-T, MA, PRACT]: Mann 2010, Huang 2023, Zhang 2021. "Secondary sources differ slightly and the original tables were not retrieved."
- **Literature check:**
  - **The original table is in pounds.** Mann 2011, the PhD dissertation of the APRE trial author at the University of Missouri (MOspace record checked by me; Appendix A read by the research agent), prints the 6RM adjustments: 0–2 decrease 5–10; 3–4 decrease 0–5; 5–7 same; 8–12 increase 5–10; 13+ increase 10–15. Its worked examples are in pounds (6RM 300 lb).
  - **Mann's own article.** "Understanding APRE, part 1" (Training & Conditioning, 2017; read by me) prints "+10 to 15 lbs" and says that 13 reps mean "increase the starting load 10 to 15 pounds".
  - **Where the error came from.** Huang 2023 (PeerJ, Table 2) converted 5–10 lb correctly to 2.5–5 kg but 10–15 lb to 5–10 kg. The registry inherited that.
  - **kg equivalents.** 10–15 lb is 4.5–6.8 kg; rounded to plates, +5 to +7.5 kg with a midpoint of 6.25. The other rows already match after rounding.
  - The Mann 2010 JSCR full text is paywalled (abstract read). The dissertation covers the same author, programme and protocol with a larger sample.
- **Verdict:** **Correct** (V-1), then `verified: true` with `src.mann2011` and `src.mann2017`. Optionally, store the table in pounds and convert for kg users, so that lb users get the original steps.
- **Confidence:** high.

#### progression.calibration

- **Value and role:** `{ exposures: { min: 1, max: 2 }, targetRir: { min: 3, max: 4 } }`. While an exercise has no reliable e1RM, its first 1–2 exposures prescribe RIR 3–4 (PRG-08). The user loads the first set ("pick a weight you could lift about 12 times").
- **Claim and current evidence:** "a POWR design rule for new users and exercises". [INF]: the technical concept, Halperin 2022.
- **Literature check:**
  - The numbers are PRD PRG-08 verbatim: "the first 1–2 exposures prescribe a target RIR of 3–4".
  - The evidence supports a conservative margin on an unknown load. Lifters under-predict reps to failure by about 1 rep, with a between-person SD of 1.45 reps (Halperin 2022). Errors are larger in novices and far from failure (Steele 2017; Zourdos 2021). Trained lifters call RIR 1–3 well at moderate loads (Refalo 2024: 0.65 ± 0.78 reps).
  - A target of RIR 3–4 keeps a typical misjudgement of 1–2 reps short of failure.
- **Verdict:** **Verify (PRD).** Add `src.powr-prd`; keep `src.halperin2022` as the rationale.
- **Confidence:** high for the transcription; medium that RIR 3–4 is the best margin.

#### progression.calibration.reliableSetWeight

- **Value and role:** 0.5. One exposure with entered effort calibrates an exercise when one of its sets reaches this e1RM set weight (the 0.5 tier: RPE ≥ 7 and at most 12 effective reps). Otherwise the second exposure does.
- **Claim and current evidence:** POWR design value (TD-27), accepted as built by the product owner on 2026-11-24. [INF]: the technical concept, Halperin 2022.
- **Literature check:** the tier's limits follow the RIR-accuracy evidence (Halperin 2022: the error rises sharply above 12 reps). Worth knowing: a set logged at the calibration target of RIR 4 (RPE 6) falls in the 0.1 tier and does not calibrate on its own; a set at RIR 3 (RPE 7) with at most 9 reps does. No study addresses when one calibration exposure suffices.
- **Verdict:** **Design value** (keep).
- **Confidence:** medium.

#### progression.classification.trainingAgeMonths

- **Value and role:** `{ intermediateFrom: 6, advancedFrom: 24 }` months. It sets the trainee level from training age until the observed e1RM slope takes over (≥ 8 weeks of data). The level selects the progression model, the increments, the volume start position and the trend parameters.
- **Claim and current evidence:** the EB lists four training-age bands (< 6 months, 6–24 months, 2–5 years, > 5 years) but maps none to the three levels; 2+ years = advanced is a POWR choice. [INF]: ACSM 2009, the EB.
- **Literature check:**
  - **ACSM 2009** [POS, full text]: novice = "untrained individuals with no RT experience or who have not trained for several years"; intermediate = "approximately 6 months of consistent RT experience"; advanced = "years of RT experience". `intermediateFrom: 6` is ACSM's number.
  - **Research usage.** Studies usually call participants "trained" from about 1 year of training. Santos Junior 2021 proposes a four-level score, but its cut-offs could not be read (HTTP 403).
  - **Consistency with the EB.** The EB's expectation band for years 2–4 is +5–10 % a year, about 0.1–0.2 % a week. That is below the slope classifier's advanced cut of 0.25 %/week. A 2-year lifter who progresses at the EB's typical rate therefore already looks advanced to the classifier, so `advancedFrom: 24` agrees with what it will conclude after 8 weeks. A cut at 60 months would make the seed and the slope disagree for typical lifters with 2–5 years of training.
- **Verdict:** **Design value** (keep). `intermediateFrom` is ACSM's number; `advancedFrom` is a reasoned reading of "years" that fits the EB's own expectation bands.
- **What would settle it:** a validated training-status classification with published cut-offs.
- **Confidence:** medium.

#### progression.pace.window

- **Value and role:** `{ weeks: 4, minExposures: 4 }`. PRG-07: linear progression switches to RPE loading when the planned weekly increase exceeds the one-sided 95 % upper bound of the session-e1RM slope over the last 4 weeks and the gap accumulated over the window exceeds one TE.
- **Claim and current evidence:** POWR design value. [INF]: Hopkins 2000, Grgic 2020, McMaster 2013, the technical concept.
- **Literature check:** no study defines when linear progression should give way to autoregulation. The EB only says the engine "should detect prescriptions that outrun the observed e1RM slope".
- **Statistical note [INF].** `progression/pace.ts` uses the residual-based standard error of the slope with the normal quantile 1.645. With the minimum of 4 exposures the residuals have 2 degrees of freedom, where the matching t quantile is 2.92. If the lifter is in fact keeping up, the upper bound therefore falls below the plan by chance in about 12 % of windows instead of 5 %. A false switch only moves the lift to RPE loading, so this is a quality issue, not a safety one.
- **Verdict:** **Design value** (keep the values). See open question 6.
- **Confidence:** medium.

### Scoring (`scoring.yaml`)

Detail, the cell-by-cell comparisons and the test-vector script are in `research_notes/Parameter verification/scoring.md`.

#### scoring.wilks.coefficients

- **Value and role:**
  - men `[-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8]`;
  - women `[594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 0.00004731582, -0.00000009054]`;
  - in ascending powers of coef = 500 / polynomial. The legacy Wilks score.
- **Claim and current evidence:** transcribed from OpenPowerlifting source code (`src.opl-wilks`) and "not yet checked against a primary Wilks publication". [OFFICIAL].
- **Literature check:**
  - **Rulebooks.** The IPF Technical Rules Book 2016 prints no Wilks coefficients, and the 2017–2018 editions could not be retrieved.
  - **The polynomial.** Kopayev, Onyshchenko & Stetsenko 2020, an evaluation report hosted by the IPF, prints it in Appendix 1. All 12 coefficients equal the registry.
  - **Wilks's own tables.** Robert Wilks's coefficient tables (0.1 kg steps; a 2008 PDF hosted by the European Powerlifting Federation) give no polynomial. The registry polynomial reproduces all 1,110 women's cells and 1,651 of the 1,660 men's cells exactly. The other 9 differ by 1 in the 4th decimal, where the exact value sits at a rounding half-point.
  - **Test vectors.** The EB's vectors reproduce: men 100 kg / 1000 kg → 608.58907; women 60 kg / 500 kg → 557.4434.
  - No publication by Wilks himself that prints the polynomial was found.
- **Verdict:** **Verify** (`src.kopayev2020`, `src.wilks2008`, `src.opl-wilks`).
- **Confidence:** high for the values; medium for how primary the sources are.

#### scoring.wilks2020.coefficients

- **Value and role:** the 12 Wilks2020 coefficients with numerator 600.
- **Claim and current evidence:** OpenPowerlifting source code (`src.opl-wilks2020`); the attribution to Robert Wilks is secondary. [OFFICIAL].
- **Literature check:**
  - Powerlifting Australia's announcement "Wilks Formula 2 Released" (28 February 2020) links its Wilks Formula page and World Powerlifting's "Official Wilks Formula" calculator. Both embed the formula with numerator 600 and all 12 coefficients, which equal the registry.
  - Their coefficient tables in 0.05 kg steps (5,440 cells) reproduce exactly. They run 40–200.95 kg for men and 40–150.95 kg for women, which are the registry's clamps.
  - All 12 EB coefficient vectors match to 4 decimals, and Kopayev 2020 prints the same values.
  - Neither page names an author.
- **Verdict:** **Verify** (`src.pa2020`, `src.kopayev2020`, `src.opl-wilks2020`).
- **Confidence:** high.

#### scoring.dots.coefficients

- **Value and role:**
  - men `[-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093]`;
  - women `[-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706]`;
  - in ascending powers of coef = 500 / polynomial. DOTS is one of the two primary scores shown.
- **Claim and current evidence:** OpenPowerlifting source code (`src.opl-dots`); "no official derivation of DOTS exists". [OFFICIAL].
- **Literature check:**
  - **The author's page.** The Kraftsport Colonia page "Die DOTS-Formeln – Die neuen Wilks" names Tim Konertz as the contact for the formula; the page metadata date it to 15 October 2019. Both I and the research agent opened it. It gives the formulas in spreadsheet form, and all 10 coefficients equal the registry (decimal commas aside).
  - **The clamp.** The page states a domain of 40–210 kg for men and 40–150 kg for women, with the boundary coefficient applied outside it. That is exactly the registry clamp `scoring.dots.bodyweightClampKg`, so the clamp is the author's rule and not only an OPL choice.
  - **Derivation.** The page describes how DOTS was derived, in words only.
  - **Federation adoption.** The BVDK adoption notice could not be opened (HTTP 404). Kopayev 2020 prints the same values.
- **Verdict:** **Verify** (`src.konertz2019`, `src.kopayev2020`, `src.opl-dots`). Update the note.
- **Confidence:** high.

#### scoring.ipfGl.coefficients

- **Value and role:** the eight IPF GL sets `{a, b, c}` (sex × classic or equipped × total or bench) of GL = result × 100 / (A − B·e^(−C·BW)). The primary score shown.
- **Claim and current evidence:** OpenPowerlifting source code and vCalc; "the official GL model document could not be opened; only men's classic is independently confirmed". [OFFICIAL].
- **Literature check:**
  - **The IPF document.** "The IPF GL Coefficients for Relative Scoring, actual from May 01, 2020 to Dec 31, 2023" (IPF, May 2020; opened and checked by me) prints all eight sets in Table 1. All 24 numbers equal the registry (`0.009210` = `0.00921`).
  - **Worked examples.** The document's examples reproduce: men's equipped, 92.04 kg / 1035 kg → 0.109039 × 1035 = 112.855365; women's classic bench, 70.50 kg / 122.5 kg → 0.790069 × 122.5 = 96.783453.
  - **Corroboration.** The IPF competition spreadsheet and Kopayev 2020 carry the same values.
  - **Validity window.** The document's window ended on 31 December 2023, but no newer coefficient set was found, and the IPF formula page still links the 2020 files.
- **Verdict:** **Verify** (`src.ipf2020`, `src.kopayev2020`, `src.opl-goodlift`; drop `src.vcalc-ipf-gl`).
- **Confidence:** high.
- **Side findings on verified rows** (not among the 39): the IPF applies GL from 40 kg for men and 35 kg for women (V-5), and it rounds the coefficient to 6 decimals, which shows the men's example as 112.86 (open question 5).

### Bodyweight, monitoring, motivation and ranking

#### bodyweight.rate.maintain

- **Value and role:** `{ min: -0.25, max: 0.25 }` % of bodyweight per week. In the maintain phase, a weekly rate inside this band reads as maintaining (BOD-02). The rate is the regression slope over the last 14–28 days.
- **Claim and current evidence:** "A POWR design value … below the slowest bulk band and half the slowest cut band"; the EB has no maintenance band. [INF]: `src.powr-eb-nutrition`.
- **Literature check:**
  - **The number is now in the PRD:** BOD-02 v0.7, approved 2026-11-25, says "When maintaining, the rate band shown is ±0.25 %BW/week."
  - **Long-term definition.** Research defines long-term weight maintenance as a change of less than 3 % of bodyweight (Stevens 2006 [NARR], abstract). That is a different time scale: ±0.25 % a week sustained for a year would be about ±13 %. No study defines a short-term maintaining rate.
  - **Noise.** The band must be wider than the noise of the slope. Normal within-week fluctuation is about 0.35 % (Orsama 2014 in the registry; Turicchi 2020 [OBS] found the same 0.35 % in 1,421 adults in a weight-loss-maintenance trial), and one-day changes rarely exceed about 1.5 % (Khosla & Billewicz 1964).
  - **Slope precision [INF].** Assume a day-to-day SD of about 0.5 % around the trend. The standard error of a least-squares slope from daily weigh-ins is then about 0.08 %/week over 28 days but about 0.23 %/week over 14 days. So the band is about ±3 SE once 28 days of data exist, but only about ±1 SE in the first weeks or with sparse weigh-ins.
  - **The row note is inaccurate.** The slowest bulk band is the advanced one, 0.1–0.25 %/week, which lies inside ±0.25. The engine is unaffected, because a band applies only to the selected phase.
- **Verdict:** **Verify (PRD).** Add `src.powr-prd` and correct the note. See open question 7.
- **Confidence:** high for the transcription; medium that the width suits short windows.

#### monitoring.readiness.pmFromHour

- **Value and role:** 12, the hour of day. Sessions starting at or after noon count as "PM sessions" for the sleep rule (RDY-03: after < 6 h of sleep before a PM session, keep intensity but trim volume or skip max singles).
- **Claim and current evidence:** "A POWR design value: sessions starting at or after noon count as PM sessions." [INF]: Craven 2022, the EB.
- **Literature check:**
  - Craven 2022 [MA] (Sports Med 52(11):2669–2690; full text read) grouped exercise tasks by "the timing of exercise following sleep loss (ante meridiem [AM] vs. post meridiem [PM])", which is before vs after noon. The negative effect of sleep loss was larger for PM tasks.
  - After deprivation or late restriction, performance fell by about 0.4 % for every hour awake before the task. The paper notes that few tasks were tested after 18:00.
  - The noon cut is therefore the split the source uses; the mechanism behind it is time awake.
- **Verdict:** **Verify** with `src.craven2022`, which the row already cites. A later refinement could use the hours since waking where the wake time is known.
- **Confidence:** medium-high.

#### motivation.streak.defaultWeeklyTarget

- **Value and role:** 1 session (range 1–7). Weeks without plan sessions and without a user target need one session to be kept (MOT-03).
- **Claim and current evidence:** "A POWR design value". [INF]: PRD.
- **Literature check:**
  - **The number is now in the PRD:** MOT-03 v0.7, approved 2026-11-25, says "Without a plan or a weekly target, one session keeps the week."
  - **Health guideline.** The WHO 2020 guidelines (Bull 2020 [POS], full text) recommend muscle-strengthening activities "on 2 or more days a week".
  - **Maintenance dose.** To maintain strength and size, one session a week with one set per exercise suffices in younger adults if the relative load is kept (Spiering 2021; Bickel 2011).
  - A streak rewards consistency, not dose, so the lower default is defensible. It is not a training recommendation.
- **Verdict:** **Verify (PRD)**: update the note and `ebRef`. See open question 8.
- **Confidence:** high for the transcription.

#### ranking.effectiveness

- **Value and role:** weights `{ credit: 0.4, evidence: 0.15, stretch: 0.15, overload: 0.2, subRegion: 0.1 }`; evidence scores `{ H: 1, EMG: 0.5, C: 0 }`. The MAP-03 composite that ranks exercises for plan slots and for the body map's "best exercises" list.
- **Claim and current evidence:** "POWR design values (PRD §7.3: the weights are an app convention, labelled [INF])". [INF]: PRD, the EB.
- **Literature check:** each factor has an evidence basis:
  - the credit and its evidence grade come from the EB mapping;
  - stretch emphasis rests on Maeo 2021, Maeo 2023, Kassiano 2023 and Wolf 2025b (all in the registry);
  - overload suitability rests on the principle of progressive overload (ACSM 2009).
  - No study weights such factors against each other, and none could: the composite is a product heuristic.
- **Verdict:** **Design value** (keep).
- **What would come closest to settling it:** a sensitivity run of the plan matrix (how many picks change when each weight moves by ±0.05), with the content review's expert judgement on the resulting picks.
- **Confidence:** high that no evidence exists; low that these exact weights are best.

## Bibliography

"Registry" means the source is already in `packages/rules/data/sources/` under the given ID. "New" means it is not, and is proposed for the registry when a row cites it (see the next section). "Read" says what was opened in this pass: by me, or by a research agent as recorded in its note. Sources marked "context" support the analysis but no row needs to cite them.

### Load, RIR and APRE

| Source | Tag | Read | Status | Link |
|---|---|---|---|---|
| Banyard HG, Nosaka K, Haff GG 2017. Reliability and validity of the load–velocity relationship to predict the 1RM back squat. *J Strength Cond Res* 31(7):1897–1904 | OBS | abstract | new (context) | https://doi.org/10.1519/JSC.0000000000001657 |
| Bastos V, Machado S, Teixeira DS 2024. Feasibility and usefulness of repetitions-in-reserve scales for selecting exercise intensity: a scoping review. *Percept Mot Skills* 131(3):940–970 | SR | abstract | new (context) | https://doi.org/10.1177/00315125241241785 |
| Braith RW, Graves JE, Leggett SH, Pollock ML 1993. Effect of training on the relationship between maximal and submaximal strength. *Med Sci Sports Exerc* 25(1):132–138 | OBS | metadata | registry `src.braith1993` (complete the title) | https://doi.org/10.1249/00005768-199301000-00018 |
| Casanova N, Gomes D, Russo F, Mateus J, Vieira A, Malcata G, Tenfen P, Soares D, Flôres F 2025. Accuracy in predicting repetitions in reserve during resistance training: differences across load intensities, distance from muscular failure, sexes, and exercises. *J Phys Educ Sport* 25(11):2373–2381 | OBS | full text | **new** `src.casanova2025` | https://doi.org/10.7752/jpes.2025.11262 |
| de Salles BF, Simão R, Miranda F, Novaes JS, Lemos A, Willardson JM 2009. Rest interval between sets in strength training. *Sports Med* 39(9):765–777 | NARR | abstract | new (context) | https://doi.org/10.2165/11315230-000000000-00000 |
| FitnessVolt. Understanding the Tuchscherer RPE chart (secondary transcription) | PRACT | read | registry `src.fitnessvolt-rts-chart` | https://fitnessvolt.com/rpe-training/guides/tuchscherer-chart-explained |
| Grgic J, Lazinica B, Schoenfeld BJ, Pedisic Z 2020. Test–retest reliability of the one-repetition maximum (1RM) strength assessment: a systematic review. *Sports Med Open* 6:31 | SR | full text | registry `src.grgic2020` | https://doi.org/10.1186/s40798-020-00260-z |
| Halperin I, Malleron T, Har-Nir I, Androulakis-Korakakis P, Wolf M, Fisher J, Steele J 2022. Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. *Sports Med* 52(2):377–390 | MA | abstract | registry `src.halperin2022` | https://doi.org/10.1007/s40279-021-01559-x |
| Helms ER, Cronin J, Storey A, Zourdos MC 2016. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. *Strength Cond J* 38(4):42–49 | NARR | full text | **new** `src.helms2016` | https://doi.org/10.1519/SSC.0000000000000218 |
| Hopkins WG 2000. Measures of reliability in sports medicine and science. *Sports Med* 30(1):1–15 | NARR | registry entry (EB) | registry `src.hopkins2000` | https://pubmed.ncbi.nlm.nih.gov/10907753/ |
| Huang Z, Ji H, Chen L, et al. 2023. Comparing autoregulatory progressive resistance exercise and velocity-based resistance training on jump performance in college badminton athletes. *PeerJ* 11:e15877 | RCT-T (registry: PRACT for the table) | full text | registry `src.huang2023` (add a note on the 13+ row) | https://doi.org/10.7717/peerj.15877 |
| Knight KL 1979. Knee rehabilitation by the daily adjustable progressive resistive exercise technique. *Am J Sports Med* 7(6):336–337; Knight KL 1985. Quadriceps strengthening with the DAPRE technique. *Med Sci Sports Exerc* 17(6):646–650 | RCT/NARR | not read (cited via Mann 2011) | new (context) | — |
| Lovegrove S, Hughes LJ, Mansfield SK, Read PJ, Price P, Patterson SD 2022. Repetitions in reserve is a reliable tool for prescribing resistance training load. *J Strength Cond Res* 36(10):2696–2700 | OBS | abstract | **new** `src.lovegrove2022` | https://doi.org/10.1519/JSC.0000000000003952 |
| Mann JB, Thyfault JP, Ivey PA, Sayers SP 2010. The effect of autoregulatory progressive resistance exercise vs. linear periodization on strength improvement in college athletes. *J Strength Cond Res* 24(7):1718–1723 | RCT-T | abstract (full text paywalled) | registry `src.mann2010` | https://doi.org/10.1519/JSC.0b013e3181def4a6 |
| Mann JB 2011. *A programming comparison: the APRE vs. linear periodization in short term periods.* PhD dissertation, University of Missouri-Columbia | OBS (dissertation) | full text (agent); record checked (me) | **new** `src.mann2011` | https://hdl.handle.net/10355/15836 |
| Mann B 2017. Understanding APRE, part 1. *Training & Conditioning*, 3 November 2017 | PRACT | read (me and agent) | **new** `src.mann2017` (today a `seeAlso` of `src.huang2023`) | https://training-conditioning.com/article/understanding-apre-part-1/ |
| Martikainen O, Niiranen H, Rytkönen T, Schoenfeld BJ, Ahtiainen JP, Hulmi JJ 2025. Influence of varying proximity-to-failure on muscular adaptations and repetitions-in-reserve estimation accuracy in resistance-trained individuals. *J Sci Sport Exerc* (online ahead of print) | RCT-T | full text (author copy) | **new** `src.martikainen2025` | https://doi.org/10.1007/s42978-025-00338-8 |
| Marzagao T 2026. A weight-dependent 1RM prediction equation optimized on 303,494 near-failure sets across 388 exercises. arXiv 2603.17495 | PREPRINT | arXiv metadata checked (still a preprint) | registry `src.marzagao2026` | https://arxiv.org/abs/2603.17495 |
| Mayhew JL, Johnson BD, Lamonte MJ, Lauber D, Kemmler W 2008. Accuracy of prediction equations for determining one repetition maximum bench press in women before and after resistance training. *J Strength Cond Res* 22(5):1570–1577 | OBS | metadata | registry `src.mayhew2008` (complete the title) | https://doi.org/10.1519/JSC.0b013e31817b02ad |
| Nuzzo JL, Pinto MD, Nosaka K, Steele J 2024. Maximal number of repetitions at percentages of the one repetition maximum: a meta-regression and moderator analysis of sex, age, training status, and exercise. *Sports Med* 54(2):303–321 | MA | full text | registry `src.nuzzo2024` | https://doi.org/10.1007/s40279-023-01937-7 |
| Refalo MC, Remmert JF, Pelland JC, Robinson ZP, Zourdos MC, Hamilton DL, Fyfe JJ, Helms ER 2024. Accuracy of intraset repetitions-in-reserve predictions during the bench press exercise in resistance-trained male and female subjects. *J Strength Cond Res* 38(3):e78–e85 | OBS | abstract | registry `src.refalo2024a` | https://doi.org/10.1519/JSC.0000000000004653 |
| Richmond SR, Godard MP 2004. The effects of varied rest periods between sets to failure using the bench press in recreationally trained men. *J Strength Cond Res* 18(4):846–849 | OBS | abstract | new (context) | https://doi.org/10.1519/14833.1 |
| Russo F, Marconcin P, Gomes D, Peralta M, Flôres F, Casanova N 2025. Factors influencing the accuracy of the repetition in reserve scale in resistance training: a systematic review. *Physical Therapy Reviews* 31(1):46–63 | SR | abstract and first page | **new** `src.russo2025` | https://doi.org/10.1080/10833196.2025.2564026 |
| Scudese E, Willardson JM, Simão R, Senna G, de Salles BF, Miranda H 2015. The effect of rest interval length on repetition consistency and perceived exertion during near maximal loaded bench press sets. *J Strength Cond Res* 29(11):3079–3083 | OBS | abstract | new (context) | https://doi.org/10.1097/JSC.0000000000000214 |
| Senna G, Willardson JM, de Salles BF, Scudese E, Carneiro F, Palma A, Simão R 2011. The effect of rest interval length on multi and single-joint exercise performance and perceived exertion. *J Strength Cond Res* 25(11):3157–3162 | OBS | abstract | new (context) | https://doi.org/10.1519/JSC.0b013e318212e23b |
| Senna GW, Rodrigues BM, Sandy D, Scudese E, Bianco A, Dantas EHM 2017. Heavy vs light load single-joint exercise performance with different rest intervals. *J Hum Kinet* 58:197–206 | OBS | full text | new (context) | https://doi.org/10.1515/hukin-2017-0077 |
| Steele J, Endres A, Fisher J, Gentil P, Giessing J 2017. Ability to predict repetitions to momentary failure is not perfectly accurate, though improves with resistance training experience. *PeerJ* 5:e4105 | OBS | metadata (figures via the EB) | new (context) | https://doi.org/10.7717/peerj.4105 |
| Swinton PA, Burgess K, Hall A, Greig L, Psyllas J, Aspe R, Maughan P, Murphy A 2022. Interpreting magnitude of change in strength and conditioning: effect size selection, threshold values and Bayesian updating. *J Sports Sci* 40(18):2047–2054 | MA | abstract | registry `src.swinton2022` | https://doi.org/10.1080/02640414.2022.2128548 |
| Tuchscherer M 2008. *The Reactive Training Manual*, chapter 2 "The Rate of Perceived Exertion (RPE)" (EliteFTS reprint) | PRACT | chapter text (chart image missing) | new (context) | https://elitefts.com/blogs/training/rate-of-perceived-exertion-rpe |
| Tuchscherer M 2014. *Beginning RTS*. Reactive Training Systems | PRACT | full text from a third-party copy, not an authorised source (URL in the research note) | new (context; not proposed for the registry) | — |
| Unattributed public spreadsheet, "RPE chart" (decimal RTS values) | PRACT | CSV export | new (context; not proposed) | https://docs.google.com/spreadsheets/d/18NxHXqVQcQw792gz0Ue5RZDMOffGuGNd/ |
| Wiedenmann T, Kunellis D, Rappelt L, Held S, Wicker P, Donath L 2026. Trainability of repetitions-in-reserve estimation in younger and older adults: a parallel-group repeated-measures study. *BMC Sports Sci Med Rehabil* 18:375 | OBS | metadata (figure via the EB) | new (context) | https://doi.org/10.1186/s13102-026-01997-y |
| Willardson JM, Burkett LN 2005. A comparison of 3 different rest intervals on the exercise volume completed during a workout. *J Strength Cond Res* 19(1):23–26 | OBS | abstract | new (context) | https://doi.org/10.1519/R-13853.1 |
| Willardson JM, Burkett LN 2006. The effect of rest interval length on bench press performance with heavy vs. light loads. *J Strength Cond Res* 20(2):396–399 | OBS | abstract | new (context) | https://doi.org/10.1519/R-17735.1 |
| Willardson JM, Burkett LN 2006. The effect of rest interval length on the sustainability of squat and bench press repetitions. *J Strength Cond Res* 20(2):400–403 | OBS | abstract | new (context) | https://doi.org/10.1519/R-16314.1 |
| Zhao P, Yin M, et al. 2026. The accuracy of subjective repetitions-in-reserve predictions in resistance training: a systematic review and three-level meta-analysis (OSF registration; no results) | — | registration | new (watch) | https://doi.org/10.17605/OSF.IO/V2JND |
| Zourdos MC, Klemp A, Dolan C, et al. 2016. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. *J Strength Cond Res* 30(1):267–275 | OBS | registry entry | registry `src.zourdos2016` | https://doi.org/10.1519/JSC.0000000000001049 |
| Zourdos MC, Goldsmith JA, Helms ER, Trepeck C, Halle JL, Mendez KM, Cooke DM, Haischer MH, Sousa CA, Klemp A, Byrnes RK 2021. Proximity to failure and total repetitions performed in a set influences accuracy of intraset repetitions in reserve-based rating of perceived exertion. *J Strength Cond Res* 35(Suppl 1):S158–S165 | OBS | metadata (figures via the EB) | new (context) | https://doi.org/10.1519/JSC.0000000000002995 |

### Volume and planning

| Source | Tag | Read | Status | Link |
|---|---|---|---|---|
| American College of Sports Medicine (Ratamess NA, Alvar BA, Evetoch TK, Housh TJ, Kibler WB, Kraemer WJ, Triplett NT) 2009. Progression models in resistance training for healthy adults. *Med Sci Sports Exerc* 41(3):687–708 | POS | full text (me) | registry `src.acsm2009` (complete the citation) | https://doi.org/10.1249/MSS.0b013e3181915670 |
| Currier BS, D'Souza AC, Singh MAF, Lowisz CV, Rawson ES, Schoenfeld BJ, Smith-Ryan AE, Steen JP, Thomas GA, Triplett NT, Washington TA, Werner TJ, Phillips SM 2026. American College of Sports Medicine position stand. Resistance training prescription for muscle function, hypertrophy, and physical performance in healthy adults: an overview of reviews. *Med Sci Sports Exerc* 58(4):851–872 | POS | full text (agent; quotes checked by me) | registry `src.acsm2026` (complete the citation) | https://doi.org/10.1249/MSS.0000000000003897 |
| Androulakis-Korakakis P, Michalopoulos N, Fisher J, Keogh J, Loenneke J, Helms E, Wolf M, et al. 2021. The minimum effective training dose required for 1RM strength in powerlifters. *Front Sports Act Living* 3:713655 | DELPHI/SURVEY | full text | registry `src.androulakiskorakakis2021` (complete the citation) | https://doi.org/10.3389/fspor.2021.713655 |
| Barsuhn A, Wadhi T, Murphy A, et al. 2025. Training volume increases or maintenance based on previous volume: the effects on muscular adaptations in trained males. *J Appl Physiol* 138(1):259–269 | RCT-T | metadata | registry `src.barsuhn2025` | https://doi.org/10.1152/japplphysiol.00476.2024 |
| Baz-Valle E, Schoenfeld BJ, Torres-Unda J, Santos-Concejero J, Balsalobre-Fernández C 2019. The effects of exercise variation in muscle thickness, maximal strength and motivation in resistance trained men. *PLoS One* 14(12):e0226989 | RCT-T | metadata | registry `src.bazvalle2019` | https://doi.org/10.1371/journal.pone.0226989 |
| Baz-Valle E, Balsalobre-Fernández C, Alix-Fages C, Santos-Concejero J 2022. A systematic review of the effects of different resistance training volumes on muscle hypertrophy. *J Hum Kinet* 81:199–210 | MA/SR | full text | registry `src.bazvalle2022` (complete the citation) | https://doi.org/10.2478/hukin-2022-0017 |
| Bickel CS, Cross JM, Bamman MM 2011. Exercise dosing to retain resistance training adaptations in young and older adults. *Med Sci Sports Exerc* 43(7):1177–1187 | RCT | metadata | registry `src.bickel2011` | https://doi.org/10.1249/MSS.0b013e318207c15d |
| Dunsmore KA, Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC 2026. Is there too much of a good thing? Effects of per-session volume on strength gain. *Med Sci Sports Exerc* 58(10S), abstract #327 | conference abstract | metadata | new (watch) | https://doi.org/10.1249/01.mss.0001259680.21951.ab |
| Enes A, De Souza EO, Souza-Junior TP 2024. Effects of different weekly set progressions on muscular adaptations in trained males: is there a dose–response effect? *Med Sci Sports Exerc* 56(3):553–563 | RCT-T | abstract | new (context) | https://doi.org/10.1249/MSS.0000000000003317 |
| Florida Atlantic University 2025. "Less is more: to build muscle and gain strength, train smarter – not longer" (press release, 10 June 2025) | — (not evidence) | read | not for the registry | https://www.eurekalert.org/news-releases/1086804 |
| Iversen VM, Norum M, Schoenfeld BJ, Fimland MS 2021. No time to lift? Designing time-efficient training programs for strength and hypertrophy: a narrative review. *Sports Med* 51(10):2079–2095 | NARR | metadata | registry `src.iversen2021` | https://doi.org/10.1007/s40279-021-01490-1 |
| Joachim JM, Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC 2026. Is there too much of a good thing? Effects of per-session volume on muscle hypertrophy. *Med Sci Sports Exerc* 58(10S), abstract #336 | conference abstract | metadata | new (watch) | https://doi.org/10.1249/01.mss.0001259712.79343.1b |
| Kassiano W, Nunes JP, Costa B, Ribeiro AS, Schoenfeld BJ, Cyrino ES 2022. Does varying resistance exercises promote superior muscle hypertrophy and strength gains? A systematic review. *J Strength Cond Res* 36(6):1753–1762 | SR | metadata | registry `src.kassiano2022` | https://doi.org/10.1519/JSC.0000000000004258 |
| Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC 2026. The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains. *Sports Med* 56(2):481–505 | MA | abstract and landing page (full text paywalled) | registry `src.pelland2026` (add the DOI and the OSF data) | https://doi.org/10.1007/s40279-025-02344-w |
| Pelland JC, et al. Supplementary data and code of the above (OSF project) | MA (supplement) | opened (agent) | `seeAlso` of `src.pelland2026` | https://osf.io/6z3xu |
| Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC 2024. Preprint of the above, SportRxiv 460 | PREPRINT | not accessible (HTTP 403) | registry `src.pelland2024` | https://doi.org/10.51224/SRXIV.460 |
| Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC 2025. Is there too much of a good thing? Meta-regressions of the effect of per-session volume on hypertrophy and strength. SportRxiv 537 | PREPRINT | not accessible (HTTP 403); metadata | registry `src.remmert2025` | https://doi.org/10.51224/SRXIV.537 |
| Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC 2024. Exploring the dose–response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy: a series of meta-regressions. *Sports Med* 54(9):2209–2231 | MA | accepted manuscript, full text | registry `src.robinson2024` | https://doi.org/10.1007/s40279-024-02069-2 (manuscript: https://rke.abertay.ac.uk/ws/portalfiles/portal/82342882/Jukic_ExploringTheDose-ResponseRelationship_Accepted_2024.pdf) |
| Scarpelli MC, Nóbrega SR, Santanielo N, Alvarez IF, Otoboni GB, Ugrinowitsch C, Libardi CA 2022. Muscle hypertrophy response is affected by previous resistance training volume in trained individuals. *J Strength Cond Res* 36(4):1153–1157 | RCT-T | metadata | registry `src.scarpelli2022` | https://doi.org/10.1519/JSC.0000000000003558 |
| Schoenfeld BJ, Contreras B, Krieger J, Grgic J, Delcastillo K, Belliard R, Alto A 2019. Resistance training volume enhances muscle hypertrophy but not strength in trained men. *Med Sci Sports Exerc* 51(1):94–103 | RCT-T | abstract | new (context) | https://doi.org/10.1249/MSS.0000000000001764 |
| Schoenfeld BJ, Grgic J, Krieger J 2019. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis of studies examining the effects of resistance training frequency. *J Sports Sci* 37(11):1286–1295 | MA | metadata | registry `src.schoenfeld2019b` | https://doi.org/10.1080/02640414.2018.1555906 |
| Spiering BA, Mujika I, Sharp MA, Foulis SA 2021. Maintaining physical performance: the minimal dose of exercise needed to preserve endurance and strength over time. *J Strength Cond Res* 35(5):1449–1458 | NARR | abstract | registry `src.spiering2021` | https://doi.org/10.1519/JSC.0000000000003964 |

### Scoring

| Source | Tag | Read | Status | Link |
|---|---|---|---|---|
| International Powerlifting Federation 2020. The IPF GL coefficients for relative scoring, actual from May 01, 2020 to Dec 31, 2023 | OFFICIAL | opened (me and agent) | **new** `src.ipf2020` | https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf |
| International Powerlifting Federation 2016. Technical Rules Book 2016 (prints no scoring coefficients) | OFFICIAL | opened (agent) | context | https://www.powerlifting.sport/fileadmin/ipf/data/rules/technical-rules/english/IPF_Technical_Rules_Book_2016.pdf |
| Kopayev O, Onyshchenko B, Stetsenko A 2020. Report: evaluation of Wilks, Wilks-2, DOTS, IPF and GoodLift formulas for calculating relative scores in IPF powerlifting competitions (March 2020). International Powerlifting Federation | OFFICIAL | opened (agent) | **new** `src.kopayev2020` | https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Models_Evaluation-I-2020_01.pdf |
| Konertz T 2019. Die DOTS-Formeln – Die neuen Wilks. Kraftsport Colonia | OFFICIAL | opened (me and agent) | **new** `src.konertz2019` | https://kraftsport-colonia.de/dots |
| Marksteiner J 2019. The IPF Formula | OFFICIAL | registry entry | registry `src.marksteiner2019` | https://www.britishpowerlifting.org/wp-content/uploads/2025/03/ipf_formula.pdf |
| OpenPowerlifting opl-data: `wilks.rs`, `wilks2020.rs`, `dots.rs`, `goodlift.rs` | OFFICIAL | registry entries | registry `src.opl-wilks`, `src.opl-wilks2020`, `src.opl-dots`, `src.opl-goodlift` | one file each, e.g. https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/goodlift.rs (links in `data/sources/scoring.yaml`) |
| Powerlifting Australia 2020. Wilks Formula 2 Released (28 February 2020) and the Wilks Formula page | OFFICIAL | opened (agent) | **new** `src.pa2020` | https://powerliftingaustralia.com/wilks-formula/ |
| vCalc. IPF GL formula points calculator | PRACT | registry entry | registry `src.vcalc-ipf-gl` (can be dropped from the GL row) | https://www.vcalc.com/wiki/ipf-gl-formula-points-calculator |
| Wilks R [2008 PDF]. Wilks formula for men and women (coefficient tables). European Powerlifting Federation | OFFICIAL | opened (agent) | **new** `src.wilks2008` | https://www.europowerlifting.org/fileadmin/data/wilks_formula/Wilksformula_01.pdf |
| World Powerlifting. Wilks Calculator 2020: Official Wilks Formula | OFFICIAL | opened (agent) | `seeAlso` of `src.pa2020` | https://worldpowerlifting.com/technical/wilks-formula-calculator/ |

### Bodyweight, monitoring, motivation and classification

| Source | Tag | Read | Status | Link |
|---|---|---|---|---|
| Bull FC, Al-Ansari SS, Biddle S, et al. 2020. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462 | POS | full text | new (context) | https://doi.org/10.1136/bjsports-2020-102955 |
| Craven J, McCartney D, Desbrow B, Sabapathy S, Bellinger P, Roberts L, Irwin C 2022. Effects of acute sleep loss on physical performance: a systematic and meta-analytical review. *Sports Med* 52(11):2669–2690 | MA | full text | registry `src.craven2022` (complete the title) | https://doi.org/10.1007/s40279-022-01706-y |
| Khosla T, Billewicz WZ 1964. Measurement of change in body weight. *Br J Nutr* | OBS | registry entry | registry `src.khosla1964` | (link in the registry) |
| Orsama AL, Mattila E, Ermes M, van Gils M, Wansink B, Korhonen I 2014. Weight rhythms: weight increases during weekends and decreases during weekdays. *Obes Facts* 7(1):36–47 | OBS | metadata | registry `src.orsama2014` | https://doi.org/10.1159/000356147 |
| Santos Junior ERT, de Salles BF, Dias I, Ribeiro AS, Simão R, Willardson JM 2021. Classification and determination model of resistance training status. *Strength Cond J* 43(5):77–86 | NARR | not accessible (HTTP 403) | context only | https://www.researchgate.net/profile/Evaldo-Junior-3/publication/349287497_Classification_and_Determination_Model_of_Resistance_Training_Status/links/6029329b299bf1cc26c4894e/Classification-and-Determination-Model-of-Resistance-Training-Status.pdf |
| Stevens J, Truesdale KP, McClain JE, Cai J 2006. The definition of weight maintenance. *Int J Obes* 30(3):391–399 | NARR | abstract | new (context) | https://doi.org/10.1038/sj.ijo.0803175 |
| Turicchi J, O'Driscoll R, Horgan G, Duarte C, Palmeira AL, Larsen SC, Heitmann BL, Stubbs J 2020. Weekly, seasonal and holiday body weight fluctuation patterns among individuals engaged in a European multi-centre behavioural weight loss maintenance intervention. *PLoS One* 15(4):e0232152 | OBS | abstract | new (context) | https://doi.org/10.1371/journal.pone.0232152 |

The trend rows' other registry sources were not re-read in this pass: Ahtiainen 2003, Androulakis-Korakakis 2020, Durbin & Koopman 2012, Kolossa 2017, McMaster 2013, Solberg 2019 and Stephens Hemingway 2020. Neither were the ranking rows' mapping sources (Maeo 2021, Maeo 2023, Kassiano 2023, Wolf 2025b). They stay as the registry gives them.

## Proposed source-registry entries (not applied)

These are new entries for sources that a row would cite after the proposals above, in the registry's YAML shape (`packages/rules/data/sources/README.md`). Each needs a home file: `load.yaml` (RIR and RTS), `progression.yaml` (APRE) or `scoring.yaml` (scoring). Before adding them, check that no ID already exists in any file. "Context" sources in the bibliography are not proposed, because no row would cite them.

```yaml
# data/sources/load.yaml
- id: src.russo2025
  citation: >-
    Russo F, Marconcin P, Gomes D, Peralta M, Flôres F & Casanova N 2025. Factors influencing the
    accuracy of the repetition in reserve scale in resistance training: a systematic review.
    Physical Therapy Reviews 31(1):46–63. DOI 10.1080/10833196.2025.2564026.
  url: https://doi.org/10.1080/10833196.2025.2564026
  seeAlso: [http://hdl.handle.net/10174/39438]
  tag: SR
  status: active
  note: >-
    26 studies; qualitative synthesis: accuracy better near failure (especially upper-limb
    exercises), worse with more reps and lighter loads. No pooled error size. Closes EB §Gaps #26
    for the direction of the RIR bias; abstract and first page read (T-01, 2026-11-25).

- id: src.casanova2025
  citation: >-
    Casanova N, Gomes D, Russo F, Mateus J, Vieira A, Malcata G, Tenfen P, Soares D & Flôres F
    2025. Accuracy in predicting repetitions in reserve during resistance training: differences
    across load intensities, distance from muscular failure, sexes, and exercises. J Phys Educ
    Sport 25(11):2373–2381. DOI 10.7752/jpes.2025.11262.
  url: https://doi.org/10.7752/jpes.2025.11262
  tag: OBS
  status: active
  note: >-
    At loads of about 80% 1RM, true minus reported RIR was about +1.2 reps at a called RIR 3 and
    +0.1 to +0.65 at RIR 1; errors of 2–5 reps at 50% 1RM.

- id: src.martikainen2025
  citation: >-
    Martikainen O, Niiranen H, Rytkönen T, Schoenfeld BJ, Ahtiainen JP & Hulmi JJ 2025. Influence
    of varying proximity-to-failure on muscular adaptations and repetitions-in-reserve estimation
    accuracy in resistance-trained individuals. J Sci Sport Exerc (online ahead of print).
    DOI 10.1007/s42978-025-00338-8.
  url: https://doi.org/10.1007/s42978-025-00338-8
  tag: RCT-T
  status: active
  note: 'Baseline RIR error at a called RIR 3: squat +1.5 ± 1.7, bench +1.1 ± 1.8 reps.'

- id: src.lovegrove2022
  citation: >-
    Lovegrove S, Hughes LJ, Mansfield SK, Read PJ, Price P & Patterson SD 2022. Repetitions in
    reserve is a reliable tool for prescribing resistance training load. J Strength Cond Res
    36(10):2696–2700. DOI 10.1519/JSC.0000000000003952.
  url: https://pubmed.ncbi.nlm.nih.gov/36135029/
  tag: OBS
  status: active
  note: >-
    Novices; loads chosen for 1 RIR at 3, 5 and 8 reps: bench 93.0 / 87.3 / 79.6% and deadlift
    88.2 / 84.3 / 79.2% 1RM; between-session CV of the chosen load 2.7–6.2%.

- id: src.helms2016
  citation: >-
    Helms ER, Cronin J, Storey A & Zourdos MC 2016. Application of the repetitions in
    reserve-based rating of perceived exertion scale for resistance training. Strength Cond J
    38(4):42–49. DOI 10.1519/SSC.0000000000000218.
  url: https://doi.org/10.1519/SSC.0000000000000218
  seeAlso: [https://openrepository.aut.ac.nz/items/92cefeac-7c32-44f1-bfbc-f48f4a5dd8cf]
  tag: NARR
  status: active
  note: >-
    Table 2 is a %1RM-by-reps-and-RPE chart built from Zourdos 2016 squat data (three measured
    cells, the rest estimated); it is not the RTS chart. Cited as the peer-reviewed comparison for
    load.curve.rts (within −2.2 to +0.4 points).

# data/sources/progression.yaml
- id: src.mann2011
  citation: >-
    Mann JB 2011. A programming comparison: the APRE vs. linear periodization in short term
    periods. PhD dissertation, University of Missouri-Columbia.
  url: https://hdl.handle.net/10355/15836
  tag: OBS
  status: active
  note: >-
    Appendix A prints the APRE 3RM, 6RM and 10RM adjustment tables; the units are pounds (worked
    examples in lb; Mann 2017). 6RM: 0–2 reps −5 to 10; 3–4 −0 to 5; 5–7 same; 8–12 +5 to 10;
    13+ +10 to 15.

- id: src.mann2017
  citation: >-
    Mann B 2017. Understanding APRE, part 1. Training & Conditioning, 3 November 2017.
  url: https://training-conditioning.com/article/understanding-apre-part-1/
  tag: PRACT
  status: active
  note: >-
    By the APRE trial author. Prints the APRE-6 table with units: "+ 10 to 15 lbs" for 13+ reps;
    "increase the starting load 10 to 15 pounds".

# data/sources/scoring.yaml
- id: src.ipf2020
  citation: >-
    International Powerlifting Federation 2020. The IPF GL Coefficients for Relative Scoring,
    actual from May 01, 2020 to Dec 31, 2023 (May 2020). IPF formula documents.
  url: https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf
  seeAlso:
    - https://www.powerlifting.sport/rules/codes/info/ipf-formula
    - https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Announcement_IPF_GL_Formula_2020_1_.pdf
  tag: OFFICIAL
  status: active
  note: >-
    Table 1 prints all eight A/B/C sets (= registry). The formula applies for Bwt ≥ 40 kg (men)
    and ≥ 35 kg (women); the coefficient is rounded to 6 decimals. Examples: 92.04 kg / 1035 kg →
    112.855365; 70.50 kg / 122.5 kg → 96.783453.

- id: src.kopayev2020
  citation: >-
    Kopayev O, Onyshchenko B & Stetsenko A 2020. Report: Evaluation of Wilks, Wilks-2, DOTS, IPF
    and GoodLift formulas for calculating relative scores in IPF powerlifting competitions
    (March 2020). International Powerlifting Federation.
  url: https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Models_Evaluation-I-2020_01.pdf
  tag: OFFICIAL
  status: active
  note: >-
    Appendix 1 prints the Wilks (500), Wilks-2 (600), DOTS, IPF Points and GL coefficients; the
    Wilks, Wilks2020, DOTS and GL values equal the registry. Secondary to the formula authors.

- id: src.wilks2008
  citation: >-
    Wilks R [undated; PDF 2008]. Wilks Formula for Men and Women by Robert Wilks, Australia
    (coefficient tables in 0.1 kg steps). European Powerlifting Federation.
  url: https://www.europowerlifting.org/fileadmin/data/wilks_formula/Wilksformula_01.pdf
  tag: OFFICIAL
  status: active
  note: >-
    The original Wilks tables (men 40.0–205.9 kg, women 40.0–150.9 kg); the registry polynomial
    reproduces 2,761 of 2,770 cells exactly (9 men's cells differ by 1 in the 4th decimal at
    rounding half-points). Prints no polynomial.

- id: src.pa2020
  citation: >-
    Powerlifting Australia 2020. Wilks Formula 2 Released (news, 28 February 2020) and the Wilks
    Formula page (calculator and coefficient tables in 0.05 kg steps).
  url: https://powerliftingaustralia.com/wilks-formula/
  seeAlso:
    - https://powerliftingaustralia.com/2020/02/28/wilks-formula-2-released/
    - https://worldpowerlifting.com/technical/wilks-formula-calculator/
  tag: OFFICIAL
  status: active
  note: >-
    The calculator's equation 600 / (a + b·x + … + f·x⁵) carries all 12 coefficients (= registry);
    tables for men 40–200.95 kg and women 40–150.95 kg reproduce exactly. The announcement names
    no author.

- id: src.konertz2019
  citation: >-
    Konertz T 2019. Die DOTS-Formeln – Die neuen Wilks. Kraftsport Colonia website.
  url: https://kraftsport-colonia.de/dots
  tag: OFFICIAL
  status: active
  note: >-
    The author's definition of DOTS (Tim Konertz is named as the contact for the formula; page
    metadata dated 15 October 2019); coefficients = registry. Domain men 40–210 kg, women
    40–150 kg, with the boundary coefficient applied outside (= registry clamps). The BVDK
    adoption notice could not be opened (HTTP 404).
```

**Changes to existing entries:**

```yaml
- id: src.pelland2026
  citation: >-
    Pelland JC, Remmert JF, Robinson ZP, Hinson SR & Zourdos MC 2026. The resistance training dose
    response: meta-regressions exploring the effects of weekly volume and frequency on muscle
    hypertrophy and strength gains. Sports Med 56(2):481–505. DOI 10.1007/s40279-025-02344-w.
  url: https://pubmed.ncbi.nlm.nih.gov/41343037/
  seeAlso:
    - https://osf.io/6z3xu
    - https://sponet.de/sponet/Record/4097139?lng=en
  tag: MA
  status: active
  note: >-
    The published abstract keeps fractional counting as the best-supported method. The
    supplementary data (OSF) reproduce the preprint's floor (4 sets), SDES (2.05% / 3.96%) and
    PUOS (31 sets; 3 sets; 3 sessions); the strength tiers differ (no detectable superiority from
    3 sets). Full text paywalled, not read (T-01, 2026-11-25).

- id: src.androulakiskorakakis2021
  citation: >-
    Androulakis-Korakakis P, Michalopoulos N, Fisher J, Keogh J, Loenneke J, Helms E, Wolf M,
    et al. 2021. The minimum effective training dose required for 1RM strength in powerlifters.
    Front Sports Act Living 3:713655. DOI 10.3389/fspor.2021.713655.
  # url, tag and status unchanged; note: "accessories: 1–3 accessory exercises per powerlift"
```

## Suggested commit breakdown (for the user)

1. `docs/release/evidence-verification.md`: "Add the T-01 evidence verification report (TD-25)".
2. `research_notes/Parameter verification/volume.md`, `scoring.md`, `load-rir-apre.md`: "Add the parameter verification research notes".

Registry changes follow only after the product owner's approval, as their own commits: the value changes V-1 to V-4, the flips with their source edits and the `build.test.ts` list, and the new source entries.
