# Parameter verification: RIR bias, RTS chart, APRE-6, set-order decay, typical-set noise

Written 2026-11-25. Research only: no registry or code was changed. Tags: [MA] meta-analysis, [SR] systematic review, [RCT-T] trained, [OBS] observational/cross-sectional, [NARR] narrative/practical review, [PRACT] practitioner, [PREPRINT], [INF] my inference. "Read" says what I actually opened.

Rows checked (all `verified: false`): `load.rirBias`, `load.curve.rts`, `progression.apre.sixRm`, `load.e1rm.setOrderDecay`, `load.trend.noiseTypicalSd`.

| Parameter | Current value | Proposed verdict | Confidence |
|---|---|---|---|
| `load.rirBias` | +0 at RIR 0–2, +0.5 at RIR ≥ 3 (guard 0.5–1) | **Verify** (sign confirmed; +0.5 is the conservative half of a 0.5–1 evidence range) | Medium |
| `load.curve.rts` | 26-point decimal RTS lookup | **Verify values, correct provenance** (values match independent transcriptions; not the chart Tuchscherer published in 2008/2014) | Medium (transcription), low (validity) |
| `progression.apre.sixRm` | ≥ 13 reps → +5 to +10 kg (+7.5) | **Correct** ≥ 13 row to +5 to +7.5 kg (midpoint +6.25); other rows OK | High |
| `load.e1rm.setOrderDecay` | 0.85 per later working set | **Design value** (direction supported, no number exists) | High that no number exists |
| `load.trend.noiseTypicalSd` | 0.09 (0.08–0.10) | **Verify** 0.09; no peer-reviewed source can replace the preprint as the primary number; peer-reviewed components support 5–8% in the lab | Medium |

---

## 1. `load.rirBias`

### What the sources say

**Sign.** Every source defines the error the same way: lifters do more reps than they predicted, so true RIR > reported RIR. Adding to the reported RIR is the right direction.
- Halperin 2022: participants "tended to underpredict the number of repetitions to task failure by 0.95 repetitions (95% CI 0.17–1.73)", I² = 97.9%.
- Casanova 2025: "negative values represent an underestimation of participants' maximum ability"; all mean errors are negative.
- Martikainen 2025: "If the participant underestimated their RIR and could perform more repetitions than they perceived, a negative value was recorded"; baseline errors are negative.
- Refalo 2024: raw error −0.17 ± 1.00, "a minor tendency for underprediction".

**Russo et al. 2025 (EB Gaps #26)** [SR, 26 studies; read: abstract and first page only]. The University of Évora repository copy is a one-page PDF (abstract + start of the introduction); Taylor & Francis returned HTTP 403. Search: PubMed, Scopus, Web of Science, SPORTDiscus; 520 records, 26 included; quality by Newcastle-Ottawa Scale. Results, verbatim: "Greater accuracy was found in utilizing the RIR scale at greater proximity to muscle failure, particularly in exercises involving the upper limbs. The accuracy decreased as the number of repetitions increased and relative load (as a percentage of 1 repetition maximum) decreased." It is a qualitative synthesis: the abstract gives **no pooled error size**. It confirms the EB's direction (error grows with distance from failure, with reps per set and with lighter loads) and adds nothing that would set a number.

**Other 2023–2026 syntheses:**
- Bastos 2024 [scoping review, 31 studies, N = 855; abstract read]: "the RIR prediction should be made close to task failure to increase its accuracy". No pooled numbers.
- A completed three-level meta-analysis is registered on OSF (Zhao, Yin et al., registered 2026-07-02, DOI 10.17605/OSF.IO/V2JND): 35 studies, 253 effect rows, 14 studies in the signed-error model. **No results are public**; the registration only archives the protocol, search log and PRISMA reconstruction (read via the OSF API). Watch for its publication: it would be the first pooled signed error since Halperin 2022.
- Robinson 2024 (Sports Med, 55 studies) is about proximity to failure and outcomes, not RIR accuracy.

**Primary data at loads ≥ 70–80% 1RM, signed error (actual RIR − reported RIR):**

| Study | Population, lift, load | Called RIR 1 | Called RIR 3 | Read |
|---|---|---|---|---|
| Refalo 2024 [OBS] | 24 trained, barbell bench, 75% | pooled 1 + 3 RIR: +0.17 ± 1.00; 1 vs 3 RIR statistically equivalent (±1 rep) | (pooled) | Abstract |
| Casanova 2025 [OBS] | 34 adults, ≥ 6 months training; cable pushdown, cable row, lying leg curl; 75% | +0.50, +0.65, +0.09 (mean ≈ +0.4) | +1.59, +1.56, +0.47 (mean ≈ +1.2) | Full text |
| Casanova 2025, same | same, 50% | +2.44, +2.18, +1.32 | +4.68, +3.94, +3.44 | Full text |
| Martikainen 2025 [RCT-T, RIR accuracy as secondary outcome] | trained, barbell squat and bench, 80%, baseline | not given in text | squat +1.5 ± 1.7; bench +1.1 ± 1.8 (after 10 weeks of RIR 4→1 training: +0.6 and +0.1) | Full text (self-archived published version) |
| Zourdos 2021 [OBS] | 25 trained men, squat, 70% to failure (16 ± 4 reps) | 2.05 ± 1.73 (RPE 9) | 3.65 ± 2.46 (RPE 7) | Abstract |
| Ferrari 2026 [PREPRINT] (from EB, not re-read) | leg press, 80% / 60% | | 0.46–0.56 / 4.73–7.78 | EB only |

Halperin 2022 meta-regressions [MA, abstract read]: error smaller closer to failure (β −0.025), much larger above 12 reps (β 0.47 vs 0.06 per rep), trivially smaller in later sets (β −0.07), no effect of training status (β −0.006). Remmert 2023b [abstract]: in trained men the tendency to underestimate grew in later sessions and higher-rep sets (raw slope −0.077 per session).

### Assessment
- **Reported RIR 3 at loads ≥ 75%:** true RIR is higher by about **+1 rep on average (study means +0.2 to +1.6)**. Barbell data in trained lifters: +1.1 to +1.5 (Martikainen) and ≈ +0.2 (Refalo, pooled).
- **Reported RIR 1:** about **+0.1 to +0.65** (Casanova). So 0 at RIR ≤ 2 is slightly conservative, but within the error of the data.
- **Reported RIR ≥ 4, loads ≤ 60%, or sets > 12 reps:** errors of 2–5 reps. A fixed +0.5–1 does not fix these sets; the engine already gives them weight 0.1 (`load.e1rm.weightByRpe`) or excludes them above r_eff 15. That matches the EB policy.
- Accuracy improves with practice in some samples (Martikainen: RIR-3 error fell to +0.6 / +0.1; Wiedenmann 2026) but not in others (Remmert 2023b).

**Verdict: Verify.** The sign is right and +0.5 sits inside the evidence range. It is the conservative half: the evidence centre for reported RIR 3 is closer to +1. If POWR wants an unbiased prior instead of a conservative one, the supported alternative is **+1.0 at RIR ≥ 3** (still within the guard). Effect of +1 instead of +0.5 on a set of 100 kg × 5 at RIR 3: r_eff 9 instead of 8.5, RTS 76.2% instead of 77.4%, e1RM 131.2 instead of 129.2 kg (+1.6%). A finer fit would be a slope of about +0.4 rep per RIR above 1 (RIR 1 → 0, RIR 2 → +0.4, RIR 3 → +0.8) [INF], but the per-user learning planned for v1.3 makes that refinement low value. Confidence: medium.

---

## 2. `load.curve.rts`

### Provenance
- **The registry's 26 values match two independent transcriptions exactly:** FitnessVolt's chart (RPE 10–6.5 × reps 1–10; read) and an unattributed public Google Sheet (RPE 10–4 × reps 1–12; exported as CSV and read). Every r_eff from 1 to 13.5 agrees. The sheet extends the series to r_eff 14 → 62.6, 14.5 → 61.3, 15 → 59.9, 16 → 57.2, 17 → 54.4, 18 → 51.6; it has one internal typo (RPE 5.5 × 3 = 79.6 where the one-dimensional value is 79.9).
- **Neither cites a primary RTS publication.** I could not find this decimal chart on reactivetrainingsystems.com (the site is script-rendered and fetched empty) or in any peer-reviewed paper.
- **Tuchscherer's own published charts differ:**
  - *The Reactive Training Manual* (2008), chapter 2 (reprinted on EliteFTS; read): the chart itself is not reproduced online. Its text uses an older RPE scale ("8: … 2–4 reps left; 7: … 'speed weight'") and says "5 X 5 at 8–9 RPE … roughly correlates to 70–7 percent" (the reprint's typo, probably 70–75). The decimal chart gives 81.1–83.7% for that prescription. Tuchscherer: "It should only be used as a guide, not to attempt to derive a max … The closer you are to the upper right corner, the more accurate the chart is."
  - *Beginning RTS* (Tuchscherer, April 2014, © Reactive Training Systems; read in a pdfcoffee copy): an RIR-consistent chart (RPE 9 = one more rep possible) with RPE 10 row **100, 95, 90, 85, 80, 77, 74, 71, 68, 66, 64, 62** for 1–12 reps. It is one-dimensional in reps + RIR like the decimal chart, but **5–8 points lower** at r_eff 5–11. "Some will want to in turn estimate their 1 rep max using this chart. I strongly recommend you don't do that." It matches the 2008 text (5 @ RPE 8–9 = 74–77%).
  - So the decimal chart is a later, widely circulated RTS chart whose original publication I could not locate. **It should not be cited as Tuchscherer 2008.**
- **Helms, Cronin, Storey & Zourdos 2016 (SCJ 38(4):42–49)** [NARR; full text read, AUT repository] does **not** contain the RTS chart. Its Table 2 is a separate RIR-based chart built from Zourdos 2016's experienced squatters. Helms et al. say only the bold cells are data (1 rep @ RPE 10 = 100%, 1 rep @ RPE 8 = 91%, 8 reps @ RPE 7 = 70%); "values for percentage 1RM repetition combinations besides [these] are estimations". They add that it is based on the back squat and "should not be viewed as an absolute conversion tool". It also credits the RIR-type scale to the 2008 *Reactive Training Systems Manual*.

### Comparison by effective reps (all charts are exactly one-dimensional in r_eff; Helms and 2014 values derived by me)

| r_eff | Registry (decimal RTS) | Helms 2016 Table 2 | Δ | Beginning RTS 2014 | Δ |
|---|---|---|---|---|---|
| 1 | 100 | 100 | 0 | 100 | 0 |
| 1.5 | 97.8 | 97 | −0.8 | – | |
| 2 | 95.5 | 95 | −0.5 | 95 | −0.5 |
| 2.5 | 93.9 | 93 | −0.9 | – | |
| 3 | 92.2 | 91 | −1.2 | 90 | −2.2 |
| 3.5 | 90.7 | 89 | −1.7 | – | |
| 4 | 89.2 | 87 | −2.2 | 85 | −4.2 |
| 4.5 | 87.8 | 86 | −1.8 | – | |
| 5 | 86.3 | 85 | −1.3 | 80 | −6.3 |
| 5.5 | 85.0 | 84 | −1.0 | – | |
| 6 | 83.7 | 83 | −0.7 | 77 | −6.7 |
| 6.5 | 82.4 | 82 | −0.4 | – | |
| 7 | 81.1 | 81 | −0.1 | 74 | −7.1 |
| 7.5 | 79.9 | 80 | +0.1 | – | |
| 8 | 78.6 | 79 | +0.4 | 71 | −7.6 |
| 8.5 | 77.4 | 77.5 | +0.1 | – | |
| 9 | 76.2 | 76 | −0.2 | 68 | −8.2 |
| 9.5 | 75.1 | 74.5 | −0.6 | – | |
| 10 | 73.9 | 73 | −0.9 | 66 | −7.9 |
| 10.5 | 72.3 | 71.5 | −0.8 | – | |
| 11 | 70.7 | 70 | −0.7 | 64 | −6.7 |
| 12 | 68.0 | – | | 62 | −6.0 |
| 13 | 65.3 | – | | 60 | −5.3 |

### Validation
- **No peer-reviewed study validates the RTS chart's %1RM values**, i.e. compares chart-predicted %1RM with measured 1RM.
- **Partial checks:**
  - The decimal chart agrees with Helms/Zourdos's data anchors within 1.2 points (r_eff 3: 92.2 vs 91; r_eff 11: 70.7 vs 70).
  - Lovegrove 2022 [OBS, novices; abstract]: loads chosen for "1 RIR" at 3, 5 and 8 reps (nominal r_eff 4, 6, 9) were bench 93.0 / 87.3 / 79.6% and deadlift 88.2 / 84.3 / 79.2% 1RM. Chart: 89.2 / 83.7 / 76.2. Bench sits 3.4–3.8 points above the chart, consistent with novices under-calling RIR. Deadlift sits within −1.0 to +3.0.
  - EB: the chart tracks Wathan within 0.6 points at r_eff 2–10 and Nuzzo 2024 bench means within about 1.5% at 5 reps.

**Verdict: Verify the values, correct the provenance.** Keep the 26 values; they are a faithful transcription of the chart in common use and agree with the only peer-reviewed anchors. Record the source as "decimal RTS chart, widely reproduced (FitnessVolt; public sheet); primary RTS publication not located; differs from Tuchscherer 2008/2014". Add Helms 2016 Table 2 as the peer-reviewed comparator. Evidence tag stays [PRACT]. Confidence: medium that the transcription is right; low for validity, which rests on its closeness to Wathan and the Zourdos anchors.

---

## 3. `progression.apre.sixRm`

### Original table
**Mann 2011, PhD dissertation, University of Missouri** (MOspace, hdl 10355/15836; full text read). Same first author, football program and APRE protocol as Mann et al. 2010 (JSCR). The dissertation sample is larger (57 players, 2004 LP cohort vs 2005 APRE cohort) than the paper's (n = 23).

Appendix A, protocol: set 1 10 reps @ 50% 6RM; set 2 6 reps @ 75% 6RM; set 3 reps to failure @ 6RM; set 4 adjusted reps to failure.

Adjustment table (6RM column; the table prints no unit):

| Set-3 reps | Set-4 adjustment |
|---|---|
| 0–2 | Decrease 5–10 |
| 3–4 | Decrease 0–5 |
| 5–7 | Same |
| 8–12 | Increase 5–10 |
| 13+ | Increase 10–15 |

- 3RM column: 1–2 → −5–10; 3–4 → same; 5–6 → +5–10; 7+ → +10–15.
- 10RM column: 4–6 → −5–10; 7–8 → −0–5; 9–11 → same; 12–16 → +5–10; 17+ → +10–15.

**Units are pounds:**
- Mann's own practitioner article (Training & Conditioning, 3 Nov 2017; read twice, the second time asking for verbatim quotes) prints the same table with units: "– 5 to 10 lbs", "– 0 to 5 lbs", "+ 5 to 10 lbs", "+ 10 to 15 lbs". The text: "if an athlete does 13 repetitions in set four of the APRE 6 routine, they would increase the starting load 10 to 15 pounds". No kg appears anywhere on the page.
- The dissertation's worked example is in pounds (estimated 6RM 300 lb → 150 lb × 10, 225 lb × 6). Its account of Knight's DAPRE says "if the individual completed 15 repetitions, they would increase the following set by 10 pounds". It states that Siff (*Supertraining*, 2000) "retained Knight's adjustment charts" (Knight 1979 AJSM 7:336–337; Knight 1985 MSSE 17:646–650; neither was read).
- Next session: "the number of repetitions in set four determines the starting weight for the subsequent training session" (Mann 2017). The dissertation applies it to "the following week's training".

**Huang et al. 2023 (PeerJ 11:e15877, Table 2; full text read via Europe PMC):** 0–2 → "−2.5 to 5 kg"; 3–4 → "−0 to 2.5 kg"; 5–7 → keep; 8–12 → "+2.5 to 5 kg"; 13+ → "+5 to 10 kg". It cites Verkhoshansky & Siff 2009 and Mann 2011. It converts 5 lb → 2.5 kg and 10 lb → 5 kg, but turns 10–15 lb into 5–10 kg instead of 5–7.5 kg. **The registry inherits this error.**

### kg equivalents
1 lb = 0.4536 kg.

| Set-3 reps | Original (lb) | Exact kg | Plate-rounded kg (1 lb ≈ 0.5 kg) | Registry |
|---|---|---|---|---|
| 0–2 | −5 to −10 | −2.27 to −4.54 | −2.5 to −5 (mid −3.75) | −2.5 to −5 (−3.75) ✓ |
| 3–4 | 0 to −5 | 0 to −2.27 | 0 to −2.5 (mid −1.25) | 0 to −2.5 (−1.25) ✓ |
| 5–7 | 0 | 0 | 0 | 0 ✓ |
| 8–12 | +5 to +10 | +2.27 to +4.54 | +2.5 to +5 (mid +3.75) | +2.5 to +5 (+3.75) ✓ |
| ≥ 13 | +10 to +15 | +4.54 to +6.80 | **+5 to +7.5 (mid +6.25)** | +5 to +10 (+7.5) ✗ |

The registry's ≥ 13 row is not double the original. Its upper bound is about 1.5× (10 vs 6.8 kg) and its midpoint about 1.3× (7.5 vs 5.7 kg exact, or 6.25 plate-rounded). The other rows are the original rounded up about 10% (5 lb → 2.5 kg), which disappears in plate rounding.

**Verdict: Correct.** Set the ≥ 13 row to `rangeKg {min: 5, max: 7.5}`, `adjustKg 6.25`. Effect: a lifter who gets 13+ reps at the 6RM gets +6.25 kg (rounded to equipment, usually +5 or +7.5) instead of +7.5 kg (usually +7.5 or +10). Optional: store the table in lb and convert at runtime for lb users. Note in the registry that the original is in pounds (Mann 2011 Appendix A; Mann 2017), and replace `src.huang2023` as the table source with Mann 2011, keeping Huang as a reproduction. Confidence: high.

---

## 4. `load.e1rm.setOrderDecay`

### What the evidence says
**Reps at a fixed load fall across sets** [OBS, acute crossover studies; abstracts read unless noted]:
- Richmond & Godard 2004: bench, 75% 1RM, 2 sets to failure. Reps fell in set 2 at every rest period (1, 3 and 5 min); "subjects were unable to fully recover between the first and second sets … regardless of the rest period".
- Senna 2011: 5 sets at 10RM, bench, leg press, chest fly, leg extension. Rep declines began "with the second set for the 1-minute condition and the third set for the 3- and 5-minute conditions".
- Scudese 2015: bench, 5 sets with a 3RM load. Reductions from set 2 with 1-min rest; with 2, 3 or 5 min "not evident until the third and fourth sets".
- Senna 2017 (full text via Europe PMC): single-joint, 80% 1RM, 4 sets to failure. Effect sizes of the decline from set 1: set 2 ES 0.83 (3 min) and 0.95 (5 min); set 4 ES 1.21–1.55. Total reps 31.7 (3 min) vs 21.5 (1 min).
- Willardson & Burkett 2005 and 2006 (8RM squat/bench; 80% bench; 15RM): significant declines over sets; 3–5 min sustains reps best.
- de Salles 2009 [NARR review, 35 studies]: 3–5 min lets more reps be done over multiple sets at 50–90% 1RM. For repeated 1RM attempts, 1 min "might be sufficient". So **rep capacity drops across sets faster than 1RM does**, and an e1RM from a later set is biased low.
- Size [INF]: about 1–2 fewer reps by sets 2–4 at 75–80% with 2–3 min rest, at about 3% e1RM per rep, gives **≈ 3–6% lower e1RM**, less for sets ending at RIR 2–3.

**RIR accuracy does not get worse in later sets; it gets slightly better:**
- Halperin 2022: β −0.07 reps per set.
- Remmert 2023a: "more accurate … in later sets".
- Refalo 2024: set 1 vs set 2 equivalent.
- Hackett 2012, as summarised by Helms 2016: "with each subsequent set the participants were able to more accurately gauge the number of repetitions remaining".

So later sets are **biased low, not noisier**.

**No study** computes e1RM from each successive working set (reps + RIR) and compares it with a measured 1RM, and none gives a weight or correction per set. The preprint behind the EB (Marzagao 2026) states that no 1RM equation accounts for set order; it used only the first near-failure set per exercise per day.

**Verdict: Design value.** The direction (prefer the first or top working set) is supported; 0.85 per later set is not derivable from the literature. Because the error is a downward bias, a correction factor or a max-type aggregator (which already favours the freshest, highest set) fits the evidence better than a trust weight [INF]. What would settle it:
1. A within-session study in trained lifters with typical rest (2–5 min) that computes e1RM from each working set (reps + reported RIR) and compares it with a 1RM measured the same or next day.
2. POWR's own logs: the ratio of set-k to set-1 e1RM at matched load, reps and logged rest, per exercise class. Use the median ratio as a bias correction and its spread as the noise.

Confidence: high that no number exists.

---

## 5. `load.trend.noiseTypicalSd`

### Status
- Marzagao 2026 is still an arXiv preprint (single industry author, Fitbod). No journal version found as of 2026-11-25. It remains the **only** source that measures within-person e1RM spread from real logged near-failure sets: SD(log e1RM) about 0.085–0.10 in 14-day windows (EB).
- I found **no peer-reviewed study** of within-person spread of e1RM from submaximal logged sets.

### Peer-reviewed components [INF error budget]
- **RIR error**, at about 2.5–3% e1RM per rep for r_eff 6–12:
  - reported RIR 1: SD ≈ 0.7–1.0 rep, i.e. ≈ 2–3% (Casanova 2025 SDs 0.70–1.04 at 75%; Refalo 2024 raw SD 1.00 pooled);
  - reported RIR 3: SD ≈ 1.5–1.9 reps, i.e. ≈ 4–5.5% (Casanova SDs 1.49–2.12; Martikainen SDs 1.7–1.8 at 80%);
  - between-person SD of bias 1.45 reps (Halperin 2022).
- **True day-to-day 1RM variation:** CV 2.1% (Banyard 2017, trained squat, 3 days). Grgic 2020 [SR]: trained median CV 3.3% (0.5–7.8%), which includes measurement error.
- **Load chosen for a target reps + RIR**, novices: between-session CV 2.7–6.2% (Lovegrove 2022). This is the closest peer-reviewed analogue of "typical-set" noise.
- **Equation error:** Reynolds 2006 cross-validation SEE 1.8 kg at 5RM on chest press (about 3%), rising at 10RM and 20RM (EB).
- **Total:** in quadrature, about 5–6% for a set at RIR 1–2 and 6–8% for a set at RIR 3 with r_eff 9–12 (lab conditions). Real app data adds logging errors, uncontrolled rest and true change within 14 days, so the 8.5–10% preprint figure is plausible.

The sources the earlier review cited (Zourdos 2021, Steele 2017, Nuzzo 2024) give RIR/RTF prediction errors and between-person spread of reps at %1RM. They fit the order of magnitude but do not measure within-person e1RM spread, so none can be the primary citation.

**Verdict: Verify** 0.09 (range 0.08–0.10). Keep Marzagao 2026 as the primary empirical source, tagged [PREPRINT, INF], and add the peer-reviewed components above as supporting sources. A value of 0.07–0.08 would also be defensible for trained lifters who mostly log RIR ≤ 2. Confidence: medium.

---

## Bibliography

Read = what I opened in this pass. EB = taken from the existing evidence-base notes, not re-read.

1. Russo F, Marconcin P, Gomes D, Peralta M, Flôres F, Casanova N. 2025. Factors influencing the accuracy of the repetition in reserve scale in resistance training: a systematic review. *Physical Therapy Reviews* 31(1) (accepted 15 Sep 2025; pages not verified). doi:10.1080/10833196.2025.2564026. Repository copy (first page only): https://dspace.uevora.pt/rdpc/bitstream/10174/39438/1/ (handle http://hdl.handle.net/10174/39438). [SR] Read: abstract + first page.
2. Halperin I, Malleron T, Har-Nir I, Androulakis-Korakakis P, Wolf M, Fisher J, Steele J. 2022. Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. *Sports Med* 52:377–390. doi:10.1007/s40279-021-01559-x. https://pubmed.ncbi.nlm.nih.gov/34542869/ [MA] Read: abstract.
3. Refalo MC, Remmert JF, Pelland JC, Robinson ZP, Zourdos MC, Hamilton DL, Fyfe JJ, Helms ER. 2024. Accuracy of intraset repetitions-in-reserve predictions during the bench press exercise in resistance-trained male and female subjects. *J Strength Cond Res* 38(3):e78–e85. doi:10.1519/JSC.0000000000004653. https://pubmed.ncbi.nlm.nih.gov/37967832/ [OBS] Read: abstract.
4. Casanova N, Gomes D, Russo F, Mateus J, Vieira A, Malcata G, Tenfen P, Soares D, Flôres F. 2025. Accuracy in predicting repetitions in reserve during resistance training: differences across load intensities, distance from muscular failure, sexes, and exercises. *J Phys Educ Sport* 25(11):2373–2381. doi:10.7752/jpes.2025.11262. https://www.rdpc.uevora.pt/rdpc/bitstream/10174/39787/1/ [OBS] Read: full text.
5. Martikainen O, Niiranen H, Rytkönen T, Schoenfeld BJ, Ahtiainen JP, Hulmi JJ. 2025. Influence of varying proximity-to-failure on muscular adaptations and repetitions-in-reserve estimation accuracy in resistance-trained individuals. *J Sci Sport Exerc* (early online). doi:10.1007/s42978-025-00338-8. Self-archived: https://jyx.jyu.fi/bitstreams/9ec45e59-0deb-4196-b11a-d6cb21a2d44d/download [RCT-T] Read: full text.
6. Zourdos MC, Goldsmith JA, Helms ER, et al. 2021. Proximity to failure and total repetitions performed in a set influences accuracy of intraset repetitions in reserve-based rating of perceived exertion. *J Strength Cond Res* 35(2S):S158–S165. doi:10.1519/JSC.0000000000002995. https://pubmed.ncbi.nlm.nih.gov/30747900/ [OBS] Read: abstract.
7. Remmert JF, Robinson ZP, Pelland JC, et al. 2023. Changes in intraset repetitions in reserve prediction accuracy during six weeks of bench press training in trained men. *Percept Mot Skills* 130:2139–2160. doi:10.1177/00315125231189098. https://pubmed.ncbi.nlm.nih.gov/37436724/ [OBS] Read: abstract.
8. Remmert JF, Laurson KR, Zourdos MC. 2023. Accuracy of predicted intraset repetitions in reserve (RIR) in single- and multi-joint resistance exercises among trained and untrained men and women. *Percept Mot Skills* 130:1239–1254. doi:10.1177/00315125231169868. https://pubmed.ncbi.nlm.nih.gov/37036795/ [OBS] Read: abstract.
9. Hackett DA, Cobley SP, Davies TB, Michael SW, Halaki M. 2017. Accuracy in estimating repetitions to failure during resistance exercise. *J Strength Cond Res* 31(8):2162–2168. doi:10.1519/JSC.0000000000001683. https://pubmed.ncbi.nlm.nih.gov/27787474/ [OBS] Read: abstract.
10. Bastos V, Machado S, Teixeira DS. 2024. Feasibility and usefulness of repetitions-in-reserve scales for selecting exercise intensity: a scoping review. *Percept Mot Skills* 131:940–970. doi:10.1177/00315125241241785. https://pmc.ncbi.nlm.nih.gov/articles/PMC11127506/ [SR, scoping] Read: abstract.
11. Zhao P, Yin M, et al. 2026. The accuracy of subjective repetitions-in-reserve predictions in resistance training: a systematic review and three-level meta-analysis. OSF registration, doi:10.17605/OSF.IO/V2JND. https://osf.io/v2jnd/ [registration only, no results] Read: registration metadata and package files.
12. Paulsen G, Myrholt R, Mentzoni F, Solberg PA. 2025. Exercise type, training load, velocity loss threshold, and sets affect the relationship between lifting velocity and perceived repetitions in reserve in strength-trained individuals. *PeerJ* 13:e19797. doi:10.7717/peerj.19797. [OBS] Read: abstract.
13. Helms ER, Cronin J, Storey A, Zourdos MC. 2016. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. *Strength Cond J* 38(4):42–49. doi:10.1519/SSC.0000000000000218. https://openrepository.aut.ac.nz/items/92cefeac-7c32-44f1-bfbc-f48f4a5dd8cf [NARR] Read: full text (Table 2).
14. Zourdos MC, Klemp A, Dolan C, et al. 2016. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. *J Strength Cond Res* 30(1):267–275. doi:10.1519/JSC.0000000000001049. https://pubmed.ncbi.nlm.nih.gov/26049792/ [OBS] Read: abstract.
15. Tuchscherer M. 2008. *The Reactive Training Manual: Developing your own custom training program for powerlifting*, chapter 2 "The Rate of Perceived Exertion (RPE)", reprinted (originally Dec 2009) at https://elitefts.com/blogs/training/rate-of-perceived-exertion-rpe [PRACT] Read: chapter text (chart image not reproduced).
16. Tuchscherer M. 2014. *Beginning RTS* (April 2014), © Reactive Training Systems LLC. Copy: https://pdfcoffee.com/beginning-rts--pdf-free.html [PRACT] Read: full text including chart.
17. FitnessVolt (Miller T). 2026. Understanding the Tuchscherer RPE chart. https://fitnessvolt.com/rpe-training/guides/tuchscherer-chart-explained [PRACT, secondary] Read.
18. Unattributed public Google Sheet, "RPE chart" (decimal RTS values, RPE 10–4 × reps 1–12). https://docs.google.com/spreadsheets/d/18NxHXqVQcQw792gz0Ue5RZDMOffGuGNd/ [PRACT, secondary, author unknown] Read: CSV export.
19. Lovegrove S, Hughes LJ, Mansfield SK, Read PJ, Price P, Patterson SD. 2022. Repetitions in reserve is a reliable tool for prescribing resistance training load. *J Strength Cond Res* 36(10):2696–2700. doi:10.1519/JSC.0000000000003952. https://pubmed.ncbi.nlm.nih.gov/36135029/ [OBS] Read: abstract.
20. Mann JB, Thyfault JP, Ivey PA, Sayers SP. 2010. The effect of autoregulatory progressive resistance exercise vs. linear periodization on strength improvement in college athletes. *J Strength Cond Res* 24(7):1718–1723. doi:10.1519/JSC.0b013e3181def4a6. https://pubmed.ncbi.nlm.nih.gov/20543732/ [RCT-T] Read: abstract only (full text paywalled).
21. Mann JB. 2011. *A programming comparison: the APRE vs. linear periodization in short term periods.* PhD dissertation, University of Missouri-Columbia. https://hdl.handle.net/10355/15836 (MOspace) [OBS, dissertation] Read: full text (Appendix A).
22. Mann B. 2017. Understanding APRE, part 1. *Training & Conditioning*, 3 Nov 2017. https://training-conditioning.com/article/understanding-apre-part-1/ [PRACT, by the APRE trial author] Read (via fetch tool; direct download blocked).
23. Huang Z, Ji H, Chen L, Zhang M, He J, Zhang W, Chen X, Sun J, Song J, Li D. 2023. Comparing autoregulatory progressive resistance exercise and velocity-based resistance training on jump performance in college badminton athletes. *PeerJ* 11:e15877. doi:10.7717/peerj.15877. https://pmc.ncbi.nlm.nih.gov/articles/PMC10414022/ [RCT-T] Read: full text (Europe PMC XML).
24. Knight KL. 1979. Knee rehabilitation by the daily adjustable progressive resistive exercise technique. *Am J Sports Med* 7(6):336–337; Knight KL. 1985. Quadriceps strengthening with the DAPRE technique. *Med Sci Sports Exerc* 17(6):646–650. Not read: cited from Mann 2011.
25. Richmond SR, Godard MP. 2004. The effects of varied rest periods between sets to failure using the bench press in recreationally trained men. *J Strength Cond Res* 18(4):846–849. doi:10.1519/14833.1. https://pubmed.ncbi.nlm.nih.gov/15574093/ [OBS] Read: abstract.
26. Senna G, Willardson JM, de Salles BF, Scudese E, Carneiro F, Palma A, Simão R. 2011. The effect of rest interval length on multi and single-joint exercise performance and perceived exertion. *J Strength Cond Res* 25(11):3157–3162. doi:10.1519/JSC.0b013e318212e23b. https://pubmed.ncbi.nlm.nih.gov/21993029/ [OBS] Read: abstract.
27. Scudese E, Willardson JM, Simão R, Senna G, de Salles BF, Miranda H. 2015. The effect of rest interval length on repetition consistency and perceived exertion during near maximal loaded bench press sets. *J Strength Cond Res* 29(11):3079–3083. doi:10.1097/JSC.0000000000000214. https://pubmed.ncbi.nlm.nih.gov/24045632/ [OBS] Read: abstract.
28. Senna GW, Rodrigues BM, Sandy D, Scudese E, Bianco A, Dantas EHM. 2017. Heavy vs light load single-joint exercise performance with different rest intervals. *J Hum Kinet* 58:197–206. doi:10.1515/hukin-2017-0077. https://pmc.ncbi.nlm.nih.gov/articles/PMC5548167/ [OBS] Read: full text (Europe PMC XML).
29. Willardson JM, Burkett LN. 2005. A comparison of 3 different rest intervals on the exercise volume completed during a workout. *J Strength Cond Res* 19(1):23–26. doi:10.1519/R-13853.1. https://pubmed.ncbi.nlm.nih.gov/15705039/ [OBS] Read: abstract.
30. Willardson JM, Burkett LN. 2006. The effect of rest interval length on bench press performance with heavy vs. light loads. *J Strength Cond Res* 20(2):396–399. doi:10.1519/R-17735.1. https://pubmed.ncbi.nlm.nih.gov/16686570/ [OBS] Read: abstract.
31. Willardson JM, Burkett LN. 2006. The effect of rest interval length on the sustainability of squat and bench press repetitions. *J Strength Cond Res* 20(2):400–403. doi:10.1519/R-16314.1. https://pubmed.ncbi.nlm.nih.gov/16686571/ [OBS] Read: abstract.
32. de Salles BF, Simão R, Miranda F, Novaes JS, Lemos A, Willardson JM. 2009. Rest interval between sets in strength training. *Sports Med* 39(9):765–777. doi:10.2165/11315230-000000000-00000. https://pubmed.ncbi.nlm.nih.gov/19691365/ [NARR] Read: abstract.
33. Marzagao T. 2026. A weight-dependent 1RM prediction equation optimized on 303,494 near-failure sets across 388 exercises. arXiv:2603.17495. https://arxiv.org/abs/2603.17495 [PREPRINT] Not re-read; status checked (still preprint).
34. Grgic J, Lazinica B, Schoenfeld BJ, Pedisic Z. 2020. Test–retest reliability of the one-repetition maximum (1RM) strength assessment: a systematic review. *Sports Med Open* 6:31. doi:10.1186/s40798-020-00260-z. https://pmc.ncbi.nlm.nih.gov/articles/PMC7367986/ [SR] EB (metadata checked in Europe PMC).
35. Banyard HG, Nosaka K, Haff GG. 2017. Reliability and validity of the load-velocity relationship to predict the 1RM back squat. *J Strength Cond Res* 31(7):1897–1904. doi:10.1519/JSC.0000000000001657. https://pubmed.ncbi.nlm.nih.gov/27669192/ [OBS] Read: abstract.
36. Reynolds JM, Gordon TJ, Robergs RA. 2006. Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry. *J Strength Cond Res* 20(3):584–592. doi:10.1519/R-15304.1. https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf [OBS] EB (metadata checked in Europe PMC).
37. Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC. 2024. Exploring the dose–response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy: a series of meta-regressions. *Sports Med* 54(9):2209–2231. doi:10.1007/s40279-024-02069-2. News release: https://www.eurekalert.org/news-releases/1053119 [MA] Read: news release only (shows it is not an RIR-accuracy meta-analysis).
