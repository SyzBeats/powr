# Parameter verification: volume, frequency and effort parameters

Scope: the ten `volume.*` registry rows listed below. They are currently `verified: false` and mostly sourced from SportRxiv preprints. The question for each: does the published, peer-reviewed evidence (as of 25 Nov 2026) support the value, give a different value, or is there none? Research only: no registry or code changes were made.

Evidence tags: [MA] meta-analysis, [SR] systematic review, [RCT-T] trained participants, [RCT-U] untrained, [OBS], [NARR], [DELPHI/SURVEY], [PRACT], [INF] my inference, [PREPRINT], [MODEL] model-derived threshold, [POS] position stand.

## Method and access (read this first)

- **Pelland et al. 2026 (Sports Med 56(2):481–505)** is paywalled (Springer "preview of subscription content"; Europe PMC: not open access, no PMC copy). I read the **PubMed abstract** and the **Springer landing page** (abstract, reference list, dates). I did **not** read the published full text. An author-uploaded copy on ResearchGate returned HTTP 403. I did not use a third-party copy of the paywalled PDF. **So I cannot confirm whether the published text keeps the preprint's slopes, Bayes factors, tiers, SDES or PUOS wording.**
- To compensate, I opened the paper's **supplementary data on OSF (https://osf.io/6z3xu)**. The published article names it under "Availability of Data and Material". The OSF activity log shows that all analysis files (pairwise tables, R data, SDES plot, indirect-set plots) date from Sept–Oct 2024, i.e. the preprint. The only later change is a PICOS inclusion/exclusion PDF added on 17 Aug 2025, during peer review. The data and models behind the published article are therefore almost certainly those of the preprint [INF]. I parsed three pairwise-comparison tables (hypertrophy volume, strength volume, strength frequency), the extracted-data spreadsheet and three plots, and recomputed the thresholds myself (method in Appendix A).
- **SportRxiv** (preprints 460 and 537) returned HTTP 403 to every request, so I could not re-read either preprint today. Preprint numbers quoted below come from the registry and the project's earlier note (`research_notes/Strength and hypertrophy evidence base/volume_frequency_failure.md`), which was written from the preprints. Where the OSF data reproduce a number, I say so.
- **Robinson et al. 2024**: I read the full text of the **accepted author manuscript** (post-peer-review, not the version of record), deposited at Abertay University, plus the PubMed abstract.
- **ACSM 2026, Baz-Valle 2022, Androulakis-Korakakis 2021**: full text read (PMC open access).

## Summary

| # | Parameter | Registry value | Published evidence says | Verdict | Conf. |
|---|---|---|---|---|---|
| 1 | `volume.hypertrophy.weeklyBands` | floor 4 / 10 / 20 / soft >30 / hard >40 | 4 = MED (OSF data); ACSM: "≥10 sets/wk"; Baz-Valle: 12–20 "optimum standard"; ACSM paraphrase of Pelland: diminishing returns beyond "~18–20 weekly sets"; PUOS ≈31 (OSF); only 1 study >40 sets in the dataset | **Verify** all five numbers; **correct the >40 label** from "no data" to "almost no data" | med-high (4/10/20), med (30/40) |
| 2 | `volume.hypertrophy.tiers` | MED 4; 5–10 ~6; 11–18 ~8.5; 19–29 ~10.75; 30–42 ~12.5; 43+ unclear; SDES 2.05% | Published text not seen. OSF data reproduce MED 4 and SDES 2.05%, and give ~5.8 / ~8.1 / ~10.6 / ~13.1 extra sets per tier (my recomputation) | **Verify** (attribute to Pelland 2026 supplementary data and preprint Table 2A) | medium |
| 3 | `volume.strength.tiers` | MED 1; 2 ~0.75; 3–4 ~2.25; 5+ not detectable; SDES 3.96% | OSF data: MED 1 ✓, SDES 3.96% ✓, but **no detectable superiority from 3 sets up** (not 5). The 0.75 / 2.25 figures cannot be reproduced | **Correct**: "not detectable" boundary 5 → **3**; drop 0.75 / 2.25 (or mark them preprint-only) | medium (data), low (tier labels) |
| 4 | `volume.puos` | hyp ~31; str ~3 sets; str freq ~3 sessions | OSF data: hyp **31**, strength **3**, strength frequency **3** | **Verify** (add caveat: the hypertrophy PUOS is capped by the model's 45-set grid) | med-high |
| 5 | `volume.counting.default` | fractional (1.0 / 0.5) | Published abstract: "The relative evidence for the 'fractional' quantification method was strongest". OSF sensitivity plots: best indirect weight ≈0.38–0.40, with 0.5 within ~0.1% of optimal fit | **Verify** (preprint Bayes factors not checkable in the published text) | high (conclusion), low (exact BFs) |
| 6 | `volume.frequency.strengthPerLift` | 2–3 sessions | Published abstract: strength rises with frequency, with diminishing returns (posterior P = 100%). OSF: 1→2 sessions +4.07% (P>SDES 62%); 2→3 +2.02%; PUOS 3. ACSM: "≥2 sessions/wk" | **Verify** | med-high |
| 7 | `volume.hypertrophy.perSessionSoftCap` | 11 fractional / 8 direct / nudge 10–12 | **No peer-reviewed full paper.** Still a SportRxiv preprint. Two conference abstracts in MSSE 58(10S), Sept 2026 (text not accessible). Press release: "about 11 fractional sets per session" | **Design value** (keep; preprint-informed) | low-med |
| 8 | `volume.strength.perSessionHeavySets` | 2–3 direct | ACSM 2026: strength "Volume: 2–3 sets/session", "at least two sets per exercise"; preprint PUOS ≈2 direct; A-K 2021: 2–3 back-off sets | **Verify** | medium |
| 9 | `volume.strength.weeklyHeavySetsPerLift` | 4–10; guard 3–6; "plateau above about 5" | A-K 2021: "~3–6 working sets of 1–5 repetitions each week … 1–3 sessions per week per powerlift … >80% 1RM … RPE 7.5–9.5". METD users reported SQ 5.4, BP 7.6, DL 3.8 weekly sets. Pelland strength PUOS ≈3 | Guard 3–6 **Verify**; band 4–10 **Design value**; plateau label **Correct** "~5" → "~3 fractional sets/week (no detectable superiority above)"; **fix citation venue** (Front Sports Act Living, not Sports Med) | high / med / med |
| 10 | `volume.effort.hypertrophySlopePerRir` | −0.48 %/RIR (95% CI −0.78 to −0.179) | Accepted manuscript: β = −0.48 [95% CI −0.78, −0.179; 95% PI −9.811, 9.817]; strength null | **Verify** (identical) | high |

Accessory wording (Androulakis-Korakakis 2021): "1–3" means **accessory exercises per powerlift** (per week), **not sets**. See §11.

---

## 1. `volume.hypertrophy.weeklyBands` = {floor 4, defaultLow 10, defaultHigh 20, highHigh 30, hardWarnAbove 40}

**Published Pelland 2026 abstract** [MA] (PubMed 41343037, read): 67 studies, 2058 participants (79.1% male). "The posterior probability of the marginal slope exceeding zero for the effect of volume on both hypertrophy and strength was 100% … both best-fit models suggest diminishing returns, with the diminishing returns for strength being considerably more pronounced." The abstract gives no set thresholds.

**Pelland OSF supplementary data** [MA data / MODEL], hypertrophy, fractional weekly sets (pairwise table, opened):
- 3 vs 0 sets: +1.78% [1.07, 2.47], P(> SDES) 23.0%. **4 vs 0: +2.21% [1.32, 3.06], P(> SDES) 64.8%.** So 4 is the first set count with a >50% probability of exceeding the 2.05% SDES (floor 4 ✓).
- One-set increments: 0.74% (0→1), 0.56, 0.47, 0.42 … **0.24% at 12→13 sets**. This matches the preprint's +0.24%/set at the mean of 12.25 sets.
- **PUOS:** starting from 30 sets, going to 45 gives P(> SDES) 61.7%. Starting from **31**, the best comparison in the grid (45 vs 31) reaches only 46.9%. So the PUOS is **31** (soft warning above 30 ✓).
- Caveat [INF]: the model's comparison grid stops at 45 sets, and from ~30 sets a detectable step needs ~14–15 more sets. The 31-set PUOS therefore partly reflects where the grid ends, not a physiological ceiling. Better UI wording: "no detectable superiority in the available data", not "no benefit".

**Data density** (my count from the OSF "Extracted Data.xlsx", hypertrophy effects with fractional sets; 220 effects / 35 studies, matching the preprint):

| Fractional sets/week | Effects | Studies | Effects from trained participants |
|---|---|---|---|
| > 20 | 41 | 10 | 35 |
| > 25 | 20 | 7 | 17 |
| > 30 | 14 | 6 | 13 |
| > 35 | 4 | 2 | 4 |
| > 40 | 2 | 1 (Schoenfeld 2019, 45 sets) | 2 |
| > 45 | 0 | 0 | 0 |

So "no data above 40" is almost literally true for the meta-analytic dataset (a single study). Outside it, a few trials exist:
- **Enes et al. 2024** [RCT-T]: lower-limb sets progressed by +4 or +6 every 2 weeks from 22 weekly quadriceps sets, i.e. up to roughly 42–52 sets by the end [INF from the design as described in the abstracts]. No between-group differences in CSA or thickness (P = 0.067, 0.076), though the authors suggest a possible dose-response "with results appearing to plateau in the higher volume conditions". The 22-set baseline comes from the companion paper Enes et al. 2025 (J Hum Kinet) [abstracts only].
- **Räntilä & Ahtiainen 2026** [RCT-T, n = 27 trained male athletes]: after 10 weeks, the athletes were split into normal volume and 1.5× volume (target ~60 sets/week) for 7 weeks. No group difference in muscle size, and the deadlift favoured the lower-volume group (P = 0.043) [abstract only]. **Status flag:** a journal mirror page (journal.hep.com.cn) displays "This article has been retracted" boilerplate with no date or DOI. The Springer page and Crossref show no retraction. Unresolved; do not rely on this study.

**Other sources:**
- **ACSM 2026 position stand** [POS; overview of 137 SRs, search to Oct 2024], full text read:
  - Table 6, hypertrophy: "Volume: ≥10 sets/wk (dose-response)". Results: "higher volume (≥10 sets/muscle group/wk)".
  - Discussion: "A meta-regression ([187]) of the effect of volume (weekly) sets showed progression, but as expected, a dose-response that plateaued and showed diminishing returns beyond ~2–3 sets/exercise for strength and ~18–20 weekly sets for hypertrophy with varying loads". Ref 187 is Pelland et al., Sports Med 2025, online ahead of print, i.e. the published version. This is ACSM's paraphrase, not Pelland's wording. It does fit the preprint's tier boundary at 18/19 sets [INF].
- **Baz-Valle et al. 2022** [SR/MA, 7 studies, 6 pooled, ≥1 y trained, 18–35 y], full text read:
  - Moderate (12–20) vs high (>20) sets/week: quadriceps SMD −0.2 (CI −0.49, 0.10), p = 0.19; biceps −0.1 (−0.46, 0.26), p = 0.59; triceps −0.5, p = 0.01, favouring high. The paper prints the triceps CI as "−0.88, 0.11", apparently a sign typo given p = 0.01.
  - Conclusion: "a range of 12-20 weekly sets per muscle group may be an optimum standard recommendation for increasing muscle hypertrophy in young, trained men."
  - Note: multi-joint pressing was counted fully toward triceps volume (closer to "total" than "fractional" counting).

**Verdict: Verify** 4 / 10 / 20 / 30 / 40.
- Change the >40 label to something like "outside the studied range: one study in the dose-response dataset; trials up to ~50–60 sets show no added growth".
- Optionally move the soft threshold to 31 to match the PUOS exactly. 30 is a harmless rounding.
- Confidence: medium-high for 4, 10 and 20; medium for 30 and 40 (model-derived, grid-bound, sparse data).

## 2. `volume.hypertrophy.tiers`

- The published text was not seen, so I cannot say whether the tier table (preprint Table 2A) survived peer review.
- The OSF pairwise data reproduce the inputs:
  - SDES: the estimated difference at which P(> SDES) crosses 50% is 2.05% (e.g. 38 vs 25 sets: 2.05%, P = 50.57%). SDES = 2.05% ✓.
  - MED: 4 sets ✓ (see §1).
- My recomputation of "extra sets needed for a detectable gain", averaged over set counts in each tier (Appendix A), against the registry:

| Tier (fractional sets/week) | Registry | Recomputed from OSF data |
|---|---|---|
| 4 | MED | MED (4 vs 0: P 64.8%) |
| 5–10 | ~6 | ~5.8 |
| 11–18 | ~8.5 | ~8.1 |
| 19–29 | ~10.75 | ~10.6 |
| 30–42 | ~12.5 | ~13.1 |
| 43+ | unclear | grid ends at 45; 1 study > 40 |

- The averaging method is my reconstruction, so small differences are expected.

**Verdict: Verify.** Cite as "Pelland 2026, supplementary data (OSF 6z3xu); tier table from preprint v2". Do not claim it is in the published article text unless someone checks the PDF. Confidence: medium.

## 3. `volume.strength.tiers`

OSF strength-volume pairwise table (fractional weekly sets of the tested lift):
- 1 vs 0: **+7.59% [5.73, 9.40], P(> SDES) 99.99%**. MED = 1 ✓.
- One-set increments: 2.47 (1→2), 1.23, 0.73, 0.49, 0.35, 0.26, 0.20 (7→8), 0.16 … The preprint's +0.21%/set is consistent with a mean around 7–8 sets. The shape fits a reciprocal model [INF: increments follow 1/(x+1) ratios].
- SDES: 14 vs 2 sets gives +3.98%, P = 52.3%. SDES ≈ 3.96% ✓.
- **Detectability:**
  - From 1 set, a detectable step needs 3 more (4 vs 1: +4.49%, P 83.6%).
  - From 2 sets, it needs 12 more (14 vs 2: P 52.3%).
  - **From 3 sets upward, no higher volume up to 32 sets reaches P > 50%** (best: 32 vs 3, P 3.6%).
- So the "not detectable" boundary in the data is **3**, not 5. I could not reproduce "~0.75" (tier 2) or "~2.25" (tiers 3–4) with any reading of the table.

**Verdict: Correct.** Proposed tiers: {1: MED; 2: still higher (a detectable gain reachable only with ~12 more sets); ≥3: no detectable superiority (PUOS)}. Keep the SDES at 3.96%. Drop the 0.75 / 2.25 efficiency figures, or flag them as preprint-only until the published Table 2B is checked.
- Note: absolute gains continue past the PUOS. 10 vs 3 sets is +2.63% in the model. The point is that they stay below the 3.96% detectability threshold.
- Confidence: medium on the data, low on how the authors labelled the tiers.

## 4. `volume.puos`

Recomputed from the OSF pairwise tables (definition: the lowest set or session count from which no higher count in the grid has > 50% probability of exceeding the SDES):

| Outcome | Registry | OSF data | Note |
|---|---|---|---|
| Hypertrophy, fractional sets/week | ~31 | **31** (30→45: 61.7%; 31→45: 46.9%) | grid capped at 45 |
| Strength, fractional sets/week | ~3 | **3** (2→14: 52.3%; 3→32: 3.6%) | grid capped at 32 |
| Strength, fractional sessions/week | ~3 | **3** (2→5: 61.85%; 3→6: 0.0%) | grid capped at 6 |

- The OSF frequency table's caption says "(Fractional + Hypertrophy)", but its file name is `…frequency.fractional.str…` and its values (12.72% at 1 session, 17.32% at 2) are the preprint's strength-frequency values. The caption is a typo.
- The PUOS term itself is confirmed by the Remmert preprint and the FAU press release. The published Pelland reference list cites the Remmert preprint (ref 117, SportRxiv 537 version 689, accessed 26 Aug 2025).

**Verdict: Verify.** Confidence: medium-high. Add the grid-cap caveat for hypertrophy (§1).

## 5. `volume.counting.default` = fractional (direct 1.0, synergist 0.5)

- **Published abstract (verbatim):** "Weekly set volume/frequency for indirect sets was quantified as 1 for 'total,' 0.5 for 'fractional,' and 0 for 'direct.' … The relative evidence for the 'fractional' quantification method was strongest; therefore, this quantification method was used for the primary meta-regression models." Conclusion: "Distinguishing between direct and indirect sets appears essential for predicting adaptations …, such as using the 'fractional' quantification method."
- Exact Bayes factors (preprint: hypertrophy 9.48 vs total, 10.29 vs direct; strength 18.21 / 45.96) **could not be checked** in the published text.
- **OSF sensitivity plots** ("Optimal Indirect Set Value", AIC and BIC, read from the rendered figures, ± a few points):

| Model | Best indirect weight | Note |
|---|---|---|
| Weekly volume, hypertrophy | ≈38–40% | 0.5 lies within ~0.1% of maximum normalised model performance |
| Weekly volume, strength | ≈38–40% | 0.5 lies within ~0.05% |
| Frequency, strength | ≈35% | |
| Frequency, hypertrophy | ≈70% | curve nearly flat |

  So 0.5 is near-optimal. 0.4 would fit marginally better for volume, but the difference is negligible.

**Verdict: Verify.** Confidence: high for the conclusion, low for the exact Bayes factors. No change needed. If ever revisited, the data's optimum for the synergist weight is ~0.4, not 0.5.

## 6. `volume.frequency.strengthPerLift` = 2–3 sessions per lift per week

- **Published abstract:** "the posterior probability for strength was 100%, suggesting strength gains increase with increasing frequency, albeit with diminishing returns". For hypertrophy, it was below 100%, "indicating compatibility with negligible effects".
- **OSF strength-frequency pairwise:** 0→1 session +12.72% [10.57, 15.05]; 0→2 +17.32%; 0→3 +19.68%; 0→4 +21.12%. Steps: **1→2 +4.07% [3.41, 4.79], P(> SDES) 61.85%**; 2→3 +2.02% (P 0%); 3→4 +1.20%. PUOS = 3 sessions.
  - The preprint's +3.27%/session [2.74, 3.84] marginal slope is not checkable in the published text. The OSF step sizes are consistent with a reciprocal-type curve.
- **ACSM 2026** [POS]: strength enhanced by "≥2 sessions/wk". Also: "RT frequency was found to impact strength; however, there was insufficient evidence to conclude a dose-response relationship, and the impact is diminished when volume is equated".
- **Androulakis-Korakakis 2021** [DELPHI/SURVEY + small RCTs]: minimum dose spread "across 1–3 sessions per week per powerlift". Practice is a "~2-3-1" squat-bench-deadlift weekly frequency.
- Caveat: Pelland's frequency is "fractional" (sessions with only indirect work count 0.5). Mean volume in the frequency studies was low (preprint: 8.14 ± 6.23 sets).

**Verdict: Verify** 2–3. Confidence: medium-high.

## 7. `volume.hypertrophy.perSessionSoftCap` = {fractional 11, direct 8, nudge 10–12}

- **Publication status (searched 25 Nov 2026):**
  - PubMed (author searches Remmert JF, Pelland JC, Zourdos MC 2025–26; keyword search): no per-session meta-regression.
  - Crossref: only the SportRxiv preprint (DOI 10.51224/srxiv.537, posted 2 Apr 2025, no "is-preprint-of" relation).
  - The published Pelland 2026 still cites it as a preprint (accessed 26 Aug 2025).
- **Two conference abstracts by the same group** appeared in *Med Sci Sports Exerc* 58(10S), online 14 Sept 2026 (ACSM Annual Meeting):
  - Joachim JM et al., "Is There Too Much Of A Good Thing? Effects Of Per-session Volume On Muscle Hypertrophy" (abstract 336).
  - Dunsmore KA et al., "… On Strength Gain" (abstract 327).
  - I saw only Crossref metadata. The abstract text is behind the Ovid/LWW paywall. Conference abstracts are not full peer-reviewed papers.
- **FAU press release (10 June 2025):** "For muscle growth, benefits leveled off after about 11 fractional sets per session." "For strength, the threshold was even lower: just two direct sets per session".
- Preprint values (from the project's earlier note, not re-read today): hypertrophy PUOS ≈11 fractional / ≈8.2 direct / ≈13.8 total per muscle per session; strength ≈3.5 fractional / ≈2 direct / ≈5 total.
- **Data density** [INF; my calculation from the OSF spreadsheet, weekly fractional sets ÷ fractional frequency]:
  - Hypertrophy: 33 effects from 12 studies exceed 11 fractional sets per session; 10 effects from 6 studies exceed 15.
  - The cap sits in a data-thin zone.

**Verdict: Design value** (keep 11 / 8 / 10–12; preprint-informed, no published full paper). Confidence: low-medium. Re-check when the MSSE abstracts or a journal version can be read.

## 8. `volume.strength.perSessionHeavySets` = 2–3 direct heavy sets per lift per session

- **ACSM 2026** [POS]:
  - Table 6, strength: "Volume: 2–3 sets/session".
  - Abstract: strength "enhanced by lifting heavier loads (≥80% one-repetition maximum) … for 2–3 sets".
  - Discussion: "healthy adults are advised to complete at least two sets per exercise. Completing more than two sets per exercise may provide additional benefits, but we hypothesize that these benefits diminish with each subsequent set."
- **Remmert preprint** [PREPRINT]: strength PUOS ≈2 direct sets per session (confirmed by the press release).
- **Androulakis-Korakakis 2021:** "the addition of 2–3 back-off sets at ~80% of the single repetitions load, may produce greater gains" than a top single alone.
- Caveat: the ACSM evidence covers general healthy adults and is framed per exercise per session, not per competition lift in powerlifters.

**Verdict: Verify.** Confidence: medium.

## 9. `volume.strength.weeklyHeavySetsPerLift` = 4–10 per lift per week; guard minimum 3–6; "plateau above about 5"

- **Citation fix:** Androulakis-Korakakis et al. 2021 is in **Frontiers in Sports and Active Living 3:713655** (PMID 34527944, PMC8435792), not Sports Medicine. The Sports Med paper on minimum dose is Androulakis-Korakakis, Fisher & Steele 2020 (Sports Med 50(4):751–765), a different study.
- **A-K 2021**, full text read. Multi-method: interviews n = 28 and n = 137, two training interventions n = 25, survey n = 57.
  - Minimum dose, verbatim: "PL athletes looking to train with a METD approach can do so by performing ~3–6 working sets of 1–5 repetitions each week, with these sets spread across 1–3 sessions per week per powerlift, using loads above 80% 1RM at a Rate of Perceived Exertion (RPE) of 7.5–9.5 for 6–12 weeks and expect to gain strength."
  - Survey of the 21 national-level powerlifters who had used a minimum-dose approach (Table 12), weekly working sets per lift: **SQ 5.4 ± 1.6, BP 7.6 ± 3.2, DL 3.8 ± 1.3**, at ~80% 1RM, ~3.5–4 reps, RPE ~7.7–8.1.
  - The authors: "the weekly sets performed for each powerlift are not all on the 'low' side of weekly set volume." And "the METD for powerlifters may be slightly higher than the METD for recreationally trained individuals."
- **Pelland strength PUOS ≈3 fractional sets/week** (§3, §4). Most of that dataset is not powerlifters. The first sets' large effect may partly be test practice (preprint caveat).
- **ACSM's paraphrase of Pelland:** "diminishing returns beyond ~2–3 sets/exercise for strength".

**Verdicts:**
- Guard minimum 3–6: **Verify** (high).
- Band 4–10: **Design value** (medium). Above the minimum dose and inside reported practice, but no trial sets 10 as an upper bound.
- "Plateau above about 5": **Correct** to "no detectable superiority above ~3 fractional sets/week (Pelland PUOS)". The 5 comes from the preprint's tier label, which the OSF data do not support (§3). For powerlifters, sets beyond 3 are still justified by skill practice and hypertrophy, so the band can stay at 4–10.

## 10. `volume.effort.hypertrophySlopePerRir` = −0.48 % muscle size per extra RIR

**Robinson et al. 2024** [MA, exploratory], accepted author manuscript (post-peer-review), full text read. Effects were analysed as standardised mean change (SMC) and as exponentiated response ratio (RR, % change). All models were adjusted for load, method of volume equating, duration and training status.

| Analysis | Effects / studies | Best fit | Marginal slope per RIR |
|---|---|---|---|
| Hypertrophy, RR (primary) | 140 / 26 | linear | **β = −0.48 [95% CI −0.78, −0.179; 95% PI −9.811, 9.817]** (% change) |
| Hypertrophy, SMC | 140 / 26 | linear | β = −0.019 [−0.035, −0.004] |
| Hypertrophy, RR, sensitivity (RIR < 10) | 137 / 26 | linear | β = −0.544 [−0.929, −0.158] |
| Hypertrophy, SMC, sensitivity | 137 / 26 | linear | β = −0.023 [−0.042, −0.004] |
| Strength, SMC | 243 / 55 | linear-log | β = 0.003 [−0.012, 0.018] (null) |
| Strength, RR | 243 / 55 | linear | β = −0.059 [−0.304, 0.186] (null) |
| Strength, SMC, sensitivity | 232 / 54 | linear-log | β = 0.004 [−0.014, 0.022] |
| Strength, RR, sensitivity | 232 / 54 | linear | β = −0.011 [−0.411, 0.39] |

- Data context: hypertrophy mean estimated RIR 3.59 ± 3.40 (range 0–21); strength 4.03 ± 3.96 (0–22.83). Mean volume ~9.6 sets/week. RIR was *estimated* from study descriptions, and the authors call the analysis exploratory.
- Key Points (verbatim): "The dose-response relationship between proximity to failure and strength gain appears to differ from the relationship with muscle hypertrophy, with only the latter being meaningfully influenced by RIR."
- The PubMed abstract of the version of record matches the manuscript's qualitative results.
- ACSM 2026 cites Robinson (ref 190) for "a target of 2–3 repetitions in reserve (RIR)". It also states "there is insufficient evidence to quantify exact RIR and perceived exertion targets".

**Verdict: Verify** −0.48 (95% CI −0.78 to −0.179). The registry value is identical to the peer-reviewed accepted manuscript. Confidence: high. Possible residual difference from the typeset version of record: very unlikely to affect numbers. The registry could also store the RIR < 10 sensitivity value (−0.544) and the strength slope (null; e.g. 0).

## 11. Accessory-sets wording (Androulakis-Korakakis 2021)

- Abstract and conclusion (verbatim): "When utilizing accessory exercises in the context of METD, PL athletes typically utilize **1–3 accessory exercises per powerlift**, at an RPE in the range of 7–9 and utilize a repetition range of ~6–10 repetitions."
- Table 12 (survey, n = 21 METD users) reports exercises and sets separately (means ± SD):

| Lift | Accessory exercises per week | Weekly working sets for accessories | Reps per accessory set | Accessory RPE |
|---|---|---|---|---|
| SQ | 2.1 ± 1 | 4 ± 1.8 | 9.3 ± 2.2 | 7.6 ± 0.9 |
| BP | 2.6 ± 1.2 | 7.3 ± 6.6 | 9.2 ± 2.9 | 7.7 ± 0.7 |
| DL | 1.6 ± 1.1 | 4.2 ± 3.1 | 8.8 ± 2 | 7 ± 1.3 |

- **Answer: "1–3" is the number of accessory EXERCISES per powerlift (per week), not sets.** The implied volume is ~2–3 working sets per accessory exercise per week (4–7 accessory sets per lift per week in total).
- POWR's 3 working sets per accessory slot is consistent with this if a slot appears about once a week. With two appearances a week, it is somewhat above what METD users reported. This is fine for a non-minimum-dose program.
- Evidence level: [DELPHI/SURVEY], small self-report sample. Treat it as practice description, not a dose-response finding.

## 12. Other 2025–2026 evidence checked

- **PubMed search** (resistance training AND volume/sets AND hypertrophy/strength AND meta-analysis/SR, 2025–2026; 56 hits screened by title): no new meta-analysis on weekly-volume upper ranges or per-session volume in trained lifters. The only relevant peer-reviewed meta-analysis is Pelland 2026 itself.
- **Lyristakis et al. 2026** (Sports Med 56(8):2001–2015) [SR/MA, 157 RCTs]: strength dose-response in volume-load arbitrary units, plateau at ~773,000–887,000 au. Mostly relative strength in untrained people. Not translatable to sets; no change [abstract via Crossref only].
- **Enes et al. 2024; Räntilä & Ahtiainen 2026:** see §1. Both are consistent with no added hypertrophy at ~40–60 sets/week.
- **Preprints seen only as search-result titles (not opened, not used for verdicts):**
  - medRxiv 10.64898/2026.10.07.26365015, "Resistance Training Frequency and Muscle Hypertrophy: A Systematic Review and Meta-Analysis of Volume-Equated Trials" (Oct 2026).
  - SportRxiv 1100, "Weekly training volume, but not its division into sessions, is associated with resistance-training hypertrophy: a re-analysis of the weekly = per-session × frequency identity in a published dose-response dataset".
  - preprints.org 202610.1022 (HTTP 403).

None changes a value.

## Suggested registry edits (for the user to apply)

1. `volume.hypertrophy.weeklyBands`: set `verified: true`. Change the hard-warning text from "no data" to "beyond studied range (1 study >40 sets)". Optionally set highHigh to 31.
2. `volume.hypertrophy.tiers`: set `verified: true`, with source "Pelland 2026 + OSF 6z3xu supplementary pairwise data (preprint Table 2A)".
3. `volume.strength.tiers`: change "5+ not detectable" to "3+ no detectable superiority". Remove or flag 0.75 / 2.25. Keep MED 1 and SDES 3.96%.
4. `volume.puos`: set `verified: true`. Add the grid-cap caveat for 31.
5. `volume.counting.default`: set `verified: true` (source: the published abstract).
6. `volume.frequency.strengthPerLift`: set `verified: true`.
7. `volume.hypertrophy.perSessionSoftCap`: keep `verified: false`, labelled as a design value (preprint plus MSSE 2026 abstracts).
8. `volume.strength.perSessionHeavySets`: set `verified: true` (source: ACSM 2026 Table 6).
9. `volume.strength.weeklyHeavySetsPerLift`: fix the A-K 2021 venue. Guard 3–6 verified. Band 4–10 is a design value. The plateau label becomes ~3.
10. `volume.effort.hypertrophySlopePerRir`: set `verified: true` (source: Robinson 2024 accepted manuscript, identical value).

## Appendix A: how the OSF-derived numbers were computed

- **Files** (public OSF, project 6z3xu, folder "Primary Meta-Regressions -- Pairwise Comparison Tables", uploaded 4 Oct 2024):
  - `pairwise.comparisons.sets.week.fractional.hyp.doc`: 1035 rows, Low 0–44 vs High 1–45.
  - `pairwise.comparisons.sets.week.fractional.str.doc`: 528 rows, 0–32.
  - `pairwise.comparisons.frequency.fractional.str.doc`: 21 rows, 0–6.
  - Columns: High, Low, Estimate, Lower/Upper 95% CrI, p.null, p.sdes.
- **PUOS:** the smallest Low for which no High in the table has p.sdes > 50.
- **Extra sets per detectable gain:** for each set count H, the smallest gap H − L such that p.sdes(H vs L) > 50. These gaps were averaged over H within each tier range.
- **SDES check:** the Estimate at which p.sdes ≈ 50%.
- **Data density:** counts of rows in `Extracted Data.xlsx` (sheet "Data") by `outcome` and `sets.week.fractional`. Per-session value = `sets.week.fractional` ÷ `frequency.fractional` (my approximation, not necessarily the Remmert definition).
- **Indirect-weight optimum:** read by eye from `sets.week.indirect.set.analysis.pdf` and `frequency.indirect.set.analysis.pdf` (rendered to PNG).

## Bibliography

1. Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains. *Sports Med.* 2026;56(2):481–505. doi:10.1007/s40279-025-02344-w. PMID 41343037. Accepted 14 Oct 2025; online 4 Dec 2025. [MA]. **Abstract (PubMed) and Springer landing page read; full text paywalled, not read.** https://pubmed.ncbi.nlm.nih.gov/41343037/ ; https://link.springer.com/article/10.1007/s40279-025-02344-w
2. Pelland et al. OSF project "The Resistance Training Dose-Response …" (data, code, pairwise tables, plots), linked from item 1. https://osf.io/6z3xu. **Opened** (file listing, activity log, 3 pairwise tables, Extracted Data.xlsx, 2 indirect-set plots, SDES plot).
3. Pelland J, Remmert J, Robinson Z, Hinson S, Zourdos M. The Resistance Training Dose-Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gain. *SportRxiv* preprint 460, posted 4 Oct 2024. doi:10.51224/srxiv.460. https://sportrxiv.org/index.php/server/preprint/view/460 [PREPRINT]. **Not accessible today (HTTP 403); Crossref metadata seen.**
4. Remmert J, Pelland J, Robinson Z, Hinson S, Zourdos M. Is There Too Much of a Good Thing? Meta-Regressions of the Effect of Per-Session Volume on Hypertrophy and Strength. *SportRxiv* preprint 537, posted 2 Apr 2025. doi:10.51224/srxiv.537. https://sportrxiv.org/index.php/server/preprint/view/537 [PREPRINT]. **Not accessible today (HTTP 403); Crossref metadata seen.**
5. Joachim JM, Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC. Is There Too Much Of A Good Thing? Effects Of Per-session Volume On Muscle Hypertrophy (abstract 336). *Med Sci Sports Exerc.* 2026;58(10S). doi:10.1249/01.mss.0001259712.79343.1b. Conference abstract. **Crossref metadata only; text paywalled.**
6. Dunsmore KA, Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC. Is There Too Much Of A Good Thing? Effects Of Per-session Volume On Strength Gain (abstract 327). *Med Sci Sports Exerc.* 2026;58(10S). doi:10.1249/01.mss.0001259680.21951.ab. Conference abstract. **Crossref metadata only.**
7. Florida Atlantic University / EurekAlert. "Less is more: To build muscle and gain strength, train smarter – not longer." Press release, 10 Jun 2025. https://www.eurekalert.org/news-releases/1086804. **Opened** (press release, not evidence; used only to confirm preprint numbers).
8. Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC. Exploring the Dose-Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions. *Sports Med.* 2024;54(9):2209–2231. doi:10.1007/s40279-024-02069-2. PMID 38970765 (no PMC copy). [MA]. **PubMed abstract and full text of the accepted author manuscript read:** https://rke.abertay.ac.uk/ws/portalfiles/portal/82342882/Jukic_ExploringTheDose-ResponseRelationship_Accepted_2024.pdf
9. Currier BS, D'Souza AC, Singh MAF, Lowisz CV, Rawson ES, Schoenfeld BJ, Smith-Ryan AE, Steen JP, Thomas GA, Triplett NT, Washington TA, Werner TJ, Phillips SM. American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews. *Med Sci Sports Exerc.* 2026;58(4):851–872. doi:10.1249/MSS.0000000000003897. PMID 41843416, PMC12965823. [POS]. **Full text read.** https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/
10. Baz-Valle E, Balsalobre-Fernández C, Alix-Fages C, Santos-Concejero J. A Systematic Review of The Effects of Different Resistance Training Volumes on Muscle Hypertrophy. *J Hum Kinet.* 2022;81:199–210. doi:10.2478/hukin-2022-0017. PMID 35291645, PMC8884877. [SR/MA]. **Full text read.**
11. Androulakis-Korakakis P, Michalopoulos N, Fisher JP, Keogh J, Loenneke JP, Helms E, Wolf M, Nuckols G, Steele J. The Minimum Effective Training Dose Required for 1RM Strength in Powerlifters. *Front Sports Act Living.* 2021;3:713655. doi:10.3389/fspor.2021.713655. PMID 34527944, PMC8435792. [DELPHI/SURVEY + small RCT-T]. **Full text read.**
12. Schoenfeld BJ, Contreras B, Krieger J, Grgic J, Delcastillo K, Belliard R, Alto A. Resistance Training Volume Enhances Muscle Hypertrophy but Not Strength in Trained Men. *Med Sci Sports Exerc.* 2019;51(1):94–103. doi:10.1249/MSS.0000000000001764. PMID 30153194. [RCT-T]. **Abstract only.**
13. Enes A, De Souza EO, Souza-Junior TP. Effects of Different Weekly Set Progressions on Muscular Adaptations in Trained Males: Is There a Dose-Response Effect? *Med Sci Sports Exerc.* 2024;56(3):553–563. doi:10.1249/MSS.0000000000003317. PMID 37796222. [RCT-T]. **Abstract only.**
14. Enes A, Nass G, Alves RC, Adam EM, Piñero A, Oneda G, Leonel DF, Schoenfeld BJ, Souza-Junior TP. Exploring the Dose-Response Relationship between Resistance-Training Volume and Psychophysiological Responses in Trained Males. *J Hum Kinet.* 2025;103:303–318. doi:10.5114/jhk/209051. PMID 42713159. [RCT-T]. **Abstract only** (used only for the 22-set baseline).
15. Räntilä A, Ahtiainen JP. Exploring the Upper Limits of Resistance Training Volume for Muscle Hypertrophy and Strength in Trained Athletes. *J Sci Sport Exerc.* 2026 (online July 2026). doi:10.1007/s42978-026-00387-7. [RCT-T]. **Abstract only** (journal mirror https://journal.hep.com.cn/josisae/EN/10.1007/s42978-026-00387-7 and JYX record https://jyx.jyu.fi/jyx/Record/jyx_123456789_112971). **Retraction status unresolved** (see §1).
16. Lyristakis P, Wundersitz D, Cousins S, Huynh M, Zadow E, Gordon BA. The Influence of Individual Resistance Training Variables on Muscle Strength: A Systematic Review and Meta-analysis. *Sports Med.* 2026;56(8):2001–2015. doi:10.1007/s40279-026-02432-5. [SR/MA]. **Abstract via Crossref only.**
17. Project note (prior, preprint-based): `research_notes/Strength and hypertrophy evidence base/volume_frequency_failure.md`. Source of the preprint numbers that I could not re-read today.
