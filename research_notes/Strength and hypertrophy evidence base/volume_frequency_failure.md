# Dose–response of resistance-training volume, frequency, load and proximity to failure for hypertrophy and maximal strength

Scope: weekly and per-session set volume, how sets are counted, frequency, minimum and maintenance dose, load range, and proximity to failure (RIR). The target user is a trained bodybuilder or powerlifter. Out of scope here: rest intervals, tempo, exercise selection, range of motion, periodization models, deloads and nutrition.

Evidence labels used throughout:
- **[MA]**: peer-reviewed meta-analysis or meta-regression.
- **[RCT-T]**: randomized trial in resistance-trained people.
- **[RCT-U]**: randomized trial in untrained people.
- **[PREPRINT]**: not peer reviewed.
- **[PRACTITIONER]**: practitioner heuristic, not peer reviewed.

A consolidated table of app defaults is at the end, under the Inferences of the last section.

Measurement caveat that applies everywhere: most hypertrophy trials in trained lifters measure muscle thickness with B-mode ultrasound at one or a few sites, typically 48–72 h after the last session. Few use MRI. DXA lean mass and limb circumference are less sensitive. Pelland et al. used only direct, site-specific measures. They flag edema as a possible confounder at high volumes, with little data on it ([Pelland et al. SportRxiv preprint of Sports Med 2026 paper](https://sportrxiv.org/index.php/server/preprint/view/460)).

---

## 1. Volume: how many weekly sets per muscle, what the dose–response curve looks like, and where it flattens

### Takeaway
More weekly sets reliably produce more hypertrophy, with diminishing returns. The best current model (Pelland et al., Sports Med 2026; square-root fit) shows:
- a detectable effect from about 4 "fractional" sets per week;
- efficient gains up to roughly 10 sets;
- increasingly expensive gains from about 11–30 sets;
- no detectable further superiority beyond about 31 fractional sets per week.

The model shows no inverted U, but there are few data above about 25 sets. Strength has a much flatter curve (reciprocal fit). Most of the volume benefit comes in the first 1–5 sets per week for a lift, followed by a functional plateau.

### Cited Findings

**Primary 2026 meta-regression, Pelland et al. [MA]**
- Citation: Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains. *Sports Med* 2026;56(2):481–505. DOI 10.1007/s40279-025-02344-w. PMID 41343037.
  - 67 studies, 2,058 participants (79.1% male; mean age 25.16 ± 5.22 y).
  - Bayesian multilevel meta-regressions, adjusted for intervention duration and training status.
  - Posterior probability that the volume slope is above 0 was 100% for both hypertrophy and strength.
  - Both best-fit models show diminishing returns, "considerably more pronounced" for strength.
  - Source: [PubMed 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/).
- Details below come from the full-text SportRxiv preprint (last modified Sept 2024). The published abstract matches it, but final numbers may have been revised in peer review ([SportRxiv preprint 460](https://sportrxiv.org/index.php/server/preprint/view/460)). Verify against the Sports Med version before hard-coding.
- Hypertrophy model:
  - 35 studies, 220 effects, 1,032 participants.
  - Best fit: square-root model. R²marginal 22.3%, R²conditional 73.3%.
  - Marginal slope +0.24% muscle size per additional fractional weekly set (95% CrI 0.15–0.33%), evaluated at the mean of 12.25 sets.
  - Source: [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460).
- Strength model:
  - 66 studies, 490 effects, 2,020 participants.
  - Best fit: reciprocal model, described as "strong diminishing returns and a functional plateau".
  - Slope +0.21% per set (95% CrI 0.16–0.26%).
  - Source: [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460).
- Smallest detectable effect size (SDES), estimated from 124 strength and 69 hypertrophy studies with non-training control groups (Steele et al. data): 2.05% for hypertrophy and 3.96% for strength ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460)).

**Pelland "volume efficiency tiers" for hypertrophy (fractional weekly sets per muscle)** ([Pelland preprint, Table 2A](https://sportrxiv.org/index.php/server/preprint/view/460)):

| Fractional sets/week | Tier | Extra sets needed for one more detectable (≥2.05%) gain |
|---|---|---|
| 4 | Minimum effective dose | — |
| 5–10 | Higher efficiency | ~6 |
| 11–18 | Intermediate efficiency | ~8.5 |
| 19–29 | Lower efficiency | ~10.75 |
| 30–42 | Lowest efficiency | ~12.5 |
| 43+ | Unclear | Insufficient data, or potentially less hypertrophy |

**Pelland efficiency tiers for strength** ([Pelland preprint, Table 2B](https://sportrxiv.org/index.php/server/preprint/view/460)):

| Fractional sets/week | Tier |
|---|---|
| 1 | Minimum effective dose |
| 2 | Higher efficiency (~0.75 extra set per detectable gain) |
| 3–4 | Intermediate efficiency (~2.25 extra sets per detectable gain) |
| 5+ | Additional sets do not consistently add gains larger than the 3.96% SDES |

- **Point of undetectable outcome superiority (PUOS):** the companion per-session preprint reports that Pelland et al. found no detectable superiority beyond about 31 fractional sets per week for hypertrophy and about 3 fractional sets per week for strength ([Remmert et al. SportRxiv preprint 537](https://sportrxiv.org/index.php/server/preprint/view/537)).
- **Data density in Pelland:**
  - Hypertrophy effects: median 10.5 fractional sets per week, mean 13.00 ± 8.87.
  - Strength effects: median 6 sets per week.
  - 28 studies used untrained and 39 used trained participants.
  - Mean intervention length 10.42 ± 4.48 weeks.
  - "Few studies have explored ~25+ 'fractional' weekly sets."
  - The authors say the model remains compatible with a plateau or an inverted U at high volumes.
  - Source: [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460).
- **Strength caveat from Pelland:** the large effect of the first weekly set may partly reflect learning on a novel test. In well-trained powerlifters, 1–3 direct weekly sets were insufficient, while 3–9 were sufficient ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460), citing [Androulakis-Korakakis et al. 2021](https://pubmed.ncbi.nlm.nih.gov/34527944/)).

**Earlier meta-analyses**
- **Schoenfeld, Ogborn & Krieger 2017 [MA].** *J Sports Sci* 35(11):1073–1082. DOI 10.1080/02640414.2016.1210197.
  - 15 studies, 34 treatment groups.
  - Each additional weekly set: ES +0.023, about +0.37% muscle-size gain (p = 0.002).
  - Higher vs lower volume within studies: ES difference 0.241, about 3.9% more gain (p = 0.03).
  - Three-level categories (<5, 5–9, 10+ sets per muscle per week): only a trend (p = 0.074).
  - The analysis could not resolve volumes above about 10 sets.
  - Source: [PubMed 27433992](https://pubmed.ncbi.nlm.nih.gov/27433992/).
- **Ralston et al. 2017 [MA], strength.** *Sports Med* 47(12):2585–2601. DOI 10.1007/s40279-017-0762-7.
  - 9 studies, 61 treatment groups.
  - Categories were sets per exercise per week: low (LWS) ≤5, medium (MWS) 5–9, high (HWS) ≥10.
  - HWS vs LWS: ES 0.18 (95% CI 0.06–0.30).
  - MWS vs LWS: ES 0.15 (0.01–0.30).
  - Multi-joint exercises: 0.18. Isolation exercises: 0.23.
  - Exercise-specific 1RM: 0.14 (−0.01 to 0.29; p = 0.06).
  - Mostly novice and intermediate men. The authors suggest MWS or HWS is appropriate for well-trained lifters.
  - Source: [PubMed 28755103](https://pubmed.ncbi.nlm.nih.gov/28755103/), [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC5684266/).
- **Baz-Valle et al. 2022 [MA].** *J Hum Kinet* 81:199–210. DOI 10.2478/hukin-2022-0017.
  - Inclusion: at least 1 year of training, age 18–35, direct thickness or cross-sectional area measures.
  - 7 studies, 6 meta-analysed. Categories: low <12, moderate 12–20, high >20 sets per week.
  - >20 sets beat 12–20 sets for triceps only (SMD −0.50 [−0.88, −0.11]; p = 0.01).
  - No difference for biceps (SMD −0.10; p = 0.59) or quadriceps (SMD −0.20; p = 0.19). These SMD values are as quoted in the Pelland preprint.
  - Authors' recommendation: "12–20 weekly sets per muscle group may be an optimum standard recommendation."
  - Sources: [PubMed 35291645](https://pubmed.ncbi.nlm.nih.gov/35291645/), [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460).
- **Krieger 2010 [MA].** *J Strength Cond Res* 24(4):1150–1159.
  - Hypertrophy effect sizes: 0.24 for 1 set per exercise, 0.34 for 2–3 sets, 0.44 for 4–6 sets.
  - Multiple sets gave about 40% larger effects than single sets, in trained and untrained subjects.
  - Source: [PubMed 20300012](https://pubmed.ncbi.nlm.nih.gov/20300012/).
- **Currier et al. 2023 [MA, Bayesian network meta-analysis].** *Br J Sports Med* 57:1211–1220.
  - Strength network: 178 studies, n = 5,097. Hypertrophy network: 119 studies, n = 3,364.
  - All prescriptions comparably promoted hypertrophy.
  - Top-ranked for hypertrophy: higher-load, multi-set, twice weekly (SMD 0.66 [0.47–0.85] vs control).
  - Top-ranked for strength: higher-load, multi-set, three times weekly (SMD 1.60 [1.38–1.82]).
  - Source: [PubMed 37414459](https://pubmed.ncbi.nlm.nih.gov/37414459/).
- **ACSM 2026 Position Stand [umbrella review].** Currier BS, …, Phillips SM. *Med Sci Sports Exerc* 2026;58(4):851–872. DOI 10.1249/MSS.0000000000003897.
  - 137 systematic reviews, more than 30,000 participants.
  - Hypertrophy was enhanced by "higher volumes (≥10 sets/wk)" and eccentric overload.
  - Strength was enhanced by ≥80% 1RM, 2–3 sets, and ≥2 sessions per week.
  - Source: [PubMed 41843416](https://pubmed.ncbi.nlm.nih.gov/41843416/).
- **Lyristakis et al. 2026 [MA], strength.** *Sports Med* 56(8):2001–2015. DOI 10.1007/s40279-026-02432-5.
  - 157 articles. Non-linear dose–response, with no further benefit beyond a composite "dosage" of about 773,000–887,000 arbitrary units.
  - Mostly untrained participants. A clear relationship in trained populations could not be determined.
  - Source: [PubMed 41995957](https://pubmed.ncbi.nlm.nih.gov/41995957/).
- **Older adults, Radaelli et al. 2025 [MA].** 151 trials, n = 6,306. Low volume was the most effective for lean mass (SMD 0.25) and hypertrophy (SMD 0.40). This population is different from the app's target users ([PubMed 39405023](https://pubmed.ncbi.nlm.nih.gov/39405023/)).

**High-volume trials in trained lifters**
- **Schoenfeld et al. 2019 [RCT-T].** *Med Sci Sports Exerc* 51(1):94–103.
  - 34 trained men completed 8 weeks, 3 sessions per week, of 1, 3 or 5 sets per exercise.
  - That equals 6/9, 18/27 and 30/45 weekly sets per muscle (upper/lower body).
  - Ultrasound showed a hypertrophy dose–response favouring higher volume at the elbow flexors, mid-thigh and lateral thigh.
  - Squat and bench 1RM were similar across groups. The 1-set group used about 13-minute sessions.
  - Source: [PubMed 30153194](https://pubmed.ncbi.nlm.nih.gov/30153194/).
- **Brigatto et al. 2022 [RCT-T].** *J Strength Cond Res* 36(1):22–30.
  - 27 trained men, 8 weeks, 16 vs 24 vs 32 weekly sets per muscle (n = 9 each).
  - All groups improved.
  - 32 sets beat 16 sets for lower-body thickness and 1RM, and for triceps thickness.
  - Source: [PubMed 31868813](https://pubmed.ncbi.nlm.nih.gov/31868813/).
- **Aube et al. 2022 [RCT-T].** *J Strength Cond Res* 36(3):600–607.
  - 35 trained lifters (squat 2.09× bodyweight), 12 vs 18 vs 24 weekly lower-body sets, 8 weeks, 2 sessions per week.
  - No group differences in thigh thickness (sum: 7.7%, 6.7%, 6.1% for 12/18/24 sets) or DXA region-of-interest fat-free mass.
  - Squat 1RM trended toward favouring 18 sets (+16.2%) over 24 sets (+5.4%) (p = 0.052). The 12-set group gained 11.3%.
  - Source: [PubMed 32058362](https://pubmed.ncbi.nlm.nih.gov/32058362/).
- **Enes, De Souza & Souza-Junior 2024 [RCT-T].** *Med Sci Sports Exerc* 56(3):553–563.
  - 31 trained men (5.1 ± 2.2 years of training; squat 1.7× bodyweight), 12 weeks, 2 sessions per week.
  - Arms: constant 22 weekly quadriceps sets, or adding 4 or 6 sets every 2 weeks.
  - The +6 group gained more squat 1RM than the +4 group (p = 0.002) and the constant group.
  - Hypertrophy showed a "possible small benefit" for higher volume, with "limited certainty".
  - Source: [PubMed 37796222](https://pubmed.ncbi.nlm.nih.gov/37796222/).
  - The design (22 fixed sets; +4 or +6 per fortnight) is confirmed in the companion perceptual paper ([Enes et al. J Hum Kinet 2026, PMID 42713159](https://pubmed.ncbi.nlm.nih.gov/42713159/)). That paper also found progressive volume changed perceptual responses but these did not correlate with thickness changes.
- **Heaselgrave et al. 2019 [RCT-T].** *Int J Sports Physiol Perform* 14(3):360–368.
  - 49 trained men, 6 weeks, 9 vs 18 vs 27 weekly biceps sets.
  - Biceps thickness: +4.3%, +9.5%, +5.4% respectively.
  - 9 sets in 1 session was sufficient for hypertrophy. 18–27 sets over 2 sessions "may confer greater strength increases".
  - Source: [PubMed 30160627](https://pubmed.ncbi.nlm.nih.gov/30160627/).
- **Barsuhn et al. 2025 [RCT-T].** *J Appl Physiol* 138(1):259–269.
  - 29 trained men completed 8 weeks: previous weekly volume +30%, +60%, or maintained.
  - No group differences in muscle size.
  - The maintenance group had the greatest 1RM gain. Authors: "more is not always better".
  - Source: [PubMed 39665246](https://pubmed.ncbi.nlm.nih.gov/39665246/).

**Retracted evidence: exclude from any rule base**
- Barbalho et al. 2020 *IJSPP*, "Evidence of a ceiling effect for training volume… less is more?": retracted April 2020 ([PubMed 32804467](https://pubmed.ncbi.nlm.nih.gov/32804467/)).
- Barbalho et al. 2019 *MSSE*, "Evidence for an Upper Threshold for Resistance Training Volume in Trained Women": expression of concern in 2020, then retracted ([MSSE 2021;53(6):1318, PubMed 33986236](https://pubmed.ncbi.nlm.nih.gov/33986236/)).
- Retraction Watch reported data-integrity concerns across this group's papers ([Retraction Watch 2021](https://retractionwatch.com/2021/12/17/exercise-researcher-earns-more-retractions-as-investigations-mount/)).
- These two papers were the main empirical support for an "upper threshold" or inverted U at about 10–20 sets per session.

### Inferences
- **Weekly hypertrophy volume (fractional sets per muscle):**
  - Floor: 4 sets (minimum effective dose).
  - Default for trained lifters: 10–20 sets. This agrees with ACSM ≥10, Baz-Valle 12–20, and the higher-efficiency and intermediate tiers.
  - "Advanced or specialization" band: 20–30 sets.
  - Warn above about 30 sets ("no detectable superiority; lowest efficiency").
  - Hard warning above about 40 sets (no data).
  - The curve is concave, so the app can show diminishing marginal value per added set. A square-root curve shape, as in Pelland, is a defensible UI model.
- **Weekly strength volume per lift:** returns flatten after about 3–5 direct or fractional sets per week. For powerlifters, prescribe enough heavy practice (3–6+ heavy sets per lift per week; see Sections 4–5). Do not chase hypertrophy-style volume on the competition lifts purely for strength. Extra volume for powerlifters is justified mainly through hypertrophy, which supports long-term strength, and through technique practice.
- **Trained vs novice:** Pelland adjusted for training status rather than modelling it separately. The trained-only RCTs are mixed: Brigatto, Schoenfeld 2019 and Enes favour higher volume, while Aube, Heaselgrave and Barsuhn show no benefit beyond moderate volume. Treat 10–20 sets as the safe default and above 20 as an individual experiment, not a universal prescription.
- The high-volume RCTs were 6–12 weeks long. They say nothing about sustainability, injury, or adherence over months; Pelland notes this explicitly.

### Gaps
- The published Sports Med 2026 version of Pelland could not be accessed (paywalled). The efficiency tiers and slopes above come from the Sept 2024 preprint. The ~31-set and ~3-set PUOS values come from the companion preprint's citation of Pelland's OSF materials.
- The commonly quoted Schoenfeld 2017 category means (about 5.4%, 6.6% and 9.8% growth for <5, 5–9 and 10+ sets) were not verified in this pass. Only the abstract (trend p = 0.074) was checked.
- No meta-analysis models volume × training age interactions directly (e.g., whether the curve shifts right in advanced lifters). No long-term data (>6 months) exist on sustained high volume.
- No muscle-specific dose–response curves exist. Data come mostly from quadriceps, elbow flexors and triceps; there is little for delts, back, glutes, hamstrings or calves.

---

## 2. Set counting: direct vs indirect (fractional) sets, and attributing compound exercises to several muscles

### Takeaway
Count sets in which the muscle is the primary mover as 1.0 and sets in which it is a meaningful synergist as 0.5. Pelland et al. found strong to very strong Bayesian evidence that this "fractional" method predicts hypertrophy and strength better than counting all sets fully ("total") or ignoring indirect sets ("direct"). For strength on a specific lift, per-session analyses fit best when only sets of the tested exercise are counted. Treat other exercises as contributing less than half a set.

### Cited Findings
- **Definitions (Pelland [MA]).**
  - Hypertrophy, direct set: the measured muscle is likely the primary force generator.
  - Hypertrophy, indirect set: the muscle is meaningfully trained as a synergist.
  - The three counting methods: "total" (indirect counted as 1), "fractional" (indirect × 0.5 + direct), "direct" (indirect counted as 0).
  - Worked example: 5 sets of curls plus 5 sets of rows equals 10 / 7.5 / 5 biceps sets (total / fractional / direct), and a frequency of 2 / 1.5 / 1.
  - Strength, direct set: the exact tested exercise. Indirect set: any exercise meaningfully training the involved muscles.
  - Strength example: 5 squat + 5 squat + 5 leg press equals 15 / 12.5 / 10 squat sets.
  - Source: [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460).
- **Model comparison, as 2 × log(Bayes factor)** ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460)):

  | Outcome | Fractional vs total | Fractional vs direct |
  |---|---|---|
  | Hypertrophy, volume | 9.48 | 10.29 |
  | Strength, volume | 18.21 | 45.96 |
  | Hypertrophy, frequency | 9.96 | 10.82 |
  | Strength, frequency | 31.27 | 54.84 |

  The published abstract confirms that the relative evidence for the fractional method was strongest ([PubMed 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/)).
- **Pelland's direct/indirect coding, from Table 1A (muscles actually measured in studies)** ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460)):

  | Muscle | Direct | Indirect | Note |
  |---|---|---|---|
  | Quadriceps (vasti, lateral thigh) | Squats, leg press, lunges, split squats, hack squat, leg extension | — | |
  | Rectus femoris | Leg extension | Squat, Smith squat, leg press | Squats are only indirect for this muscle |
  | Hamstrings | Leg curl | None listed | Squats and leg press were not credited to hamstrings |
  | Pectoralis major | Bench press, flat dumbbell fly | — | |
  | Anterior deltoid | Barbell shoulder press, front raise | Bench press, chest press, close-grip bench | |
  | Triceps | Pushdowns, extensions, skullcrushers, close-grip bench, etc. | Flat/incline/decline bench, shoulder press, machine presses | |
  | Biceps | All curl variants | Pulldowns of any grip, seated row, machine rows, bent-over rows | |
  | Trapezius | — | Lat pulldown, seated row | |

- **Interpretation by the authors:** "the hypertrophic and strength stimulus of an indirect set is close to half the effect" of a direct set on average. The 0.5 weight is an assumption, and the coding "was not wholly objective" ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460)).
- **Per-session analysis (Remmert et al. 2025 [PREPRINT]):**
  - Fractional counting fit hypertrophy best; direct counting fit strength best.
  - The authors conclude indirect sets "do contribute to strength gain; however… likely <50% of the effect of direct sets."
  - About 25.8% of hypertrophy sets in the dataset were indirect.
  - Source: [Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537).
- **Renaissance Periodization's counting [PRACTITIONER]:** RP's landmark numbers assume indirect pressing volume is "already factored in" for triceps. For example, its 18-set triceps MRV counts direct triceps work only ([RP 2017 blog](https://rpstrength.com/training-volume-landmarks-muscle-growth/)).

### Inferences
- **Data model:** store an `exercise → muscle → coefficient` map with values 1.0 (primary), 0.5 (synergist) and 0 (negligible). Compute weekly fractional sets as Σ(sets × coefficient). Also compute and display "direct sets" because the RP heuristics and many trials use direct-only counts.
- **Suggested defaults, extrapolated from Pelland's coding (not validated per muscle):**
  - Bench / chest press: chest 1, triceps 0.5, front delts 0.5.
  - Overhead press: front delts 1, triceps 0.5.
  - Rows / pulldowns / pull-ups: lats or upper back 1, biceps 0.5, traps 0.5 (rear delts 0.5 is an inference).
  - Squat / leg press / lunge: quads 1, glutes 0.5 or 1 (no data in this source set), hamstrings 0 (per Pelland's coding).
  - Leg extension: quads 1, including rectus femoris.
  - Hip hinges (deadlift, RDL): hamstrings and glutes. Not covered by Pelland's table; flag as "expert estimate".
- **Strength tracking on a powerlift:** count only sets of that lift and close variants as direct. Count accessory work for the same muscles at ≤0.5 toward the lift's "strength volume". Use a separate per-muscle fractional count for hypertrophy.
- Let advanced users override the coefficients. The 0.5 value is a population-average modelling convenience, not a physiological constant.

### Gaps
- No trial directly validates the 0.5 weight, and no muscle-specific indirect coefficients exist (for example, whether squats contribute to glutes or adductors, or deadlifts to hamstrings, at 0.5 or 1).
- Pelland's table covers only muscles that were measured in studies. It has no entries for glutes, lats, rear or side delts, calves, or abdominals.

---

## 3. Frequency: does it matter apart from volume, and is there a per-session volume ceiling ("junk volume")?

### Takeaway
- **Hypertrophy:** when weekly volume is equated, frequency has little or no independent effect (Pelland 2026 slope about +0.3% per extra session, compatible with zero). Its practical value is that it lets you spread volume across sessions.
- **Strength:** frequency has a real, independent positive effect with diminishing returns (Pelland: about +3.3% per extra session at the mean). The gain from 1 to 2 sessions per week per lift is the largest step, and returns fade beyond about 3 sessions.
- **Per session:** hypertrophy returns flatten above about 11 fractional (about 8 direct) sets per muscle per session. Strength returns flatten above about 2 direct sets of the lift per session. Both figures are preprint estimates. They mark detectability thresholds, not proven harm ceilings, and no evidence shows that extra sets reduce growth.

### Cited Findings

**Hypertrophy**
- **Schoenfeld, Ogborn & Krieger 2016 [MA].** *Sports Med* 46(11):1689–1697.
  - 10 studies. Higher frequency produced larger effects than lower frequency (ES 0.49 ± 0.08 vs 0.30 ± 0.07; p = 0.002).
  - Conclusion: training twice weekly beats once weekly on a volume-equated basis. Whether 3 times beats 2 times was unresolved.
  - Source: [PubMed 27102172](https://pubmed.ncbi.nlm.nih.gov/27102172/).
- **Schoenfeld, Grgic & Krieger 2019 [MA].** *J Sports Sci* 37(11):1286–1295.
  - 25 studies.
  - No significant difference between frequencies when volume was equated, including in trained subjects and for direct size measures. Pelland quotes ES 0.07 for the volume-equated, direct-measure analysis.
  - In non-volume-equated studies, higher frequency had a modest advantage.
  - "Individuals can choose a weekly frequency per muscle group based on personal preference."
  - Sources: [PubMed 30558493](https://pubmed.ncbi.nlm.nih.gov/30558493/), [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460).
- **Pelland 2026 [MA], frequency and hypertrophy.**
  - 35 studies, 220 effects, 1,032 participants; reciprocal model best fit.
  - Slope +0.32% per session (95% CrI −0.14 to 0.82%); 91.3% probability the slope is above 0.
  - The authors describe any independent effect as "small and… not consistently identifiable".
  - Sources: [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460), [PubMed 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/).
- **Boutagy & McKean 2026 [PREPRINT, Oct 2026].**
  - 16 volume-equated trials, 380 participants.
  - Frequency effect g = −0.06 (95% CI −0.24 to 0.13; I² = 0%). For 1 vs 3 sessions, g = −0.23 (−0.57 to 0.10); negative values favour higher frequency.
  - Certainty rated low to very low with GRADE. Most trials measured muscle thickness only.
  - Source: [DOI 10.64898/2026.10.07.26365015](https://doi.org/10.64898/2026.10.07.26365015).
- **Trained RCTs favouring higher frequency at equal volume:**
  - Schoenfeld et al. 2015 [RCT-T]: 20 trained men, split routine (each muscle once a week) vs total-body three times a week. Forearm-flexor thickness grew more with total-body training; strength did not differ ([PubMed 25932981](https://pubmed.ncbi.nlm.nih.gov/25932981/)).
  - Zaroni et al. 2019 [RCT-T]: 18 trained men, each muscle once vs five times a week. The five-times group gained more elbow-flexor and vastus lateralis thickness; 1RM did not differ ([PubMed 31260419](https://pubmed.ncbi.nlm.nih.gov/31260419/)).
- **Lopez et al. 2021 [MA]:** among participants with some training background, undertaking more RT sessions was associated with greater hypertrophy ([PubMed 33433148](https://pubmed.ncbi.nlm.nih.gov/33433148/)).

**Strength**
- **Grgic et al. 2018 [MA].** *Sports Med* 48(5):1207–1220.
  - 22 studies. Effect sizes 0.74, 0.82, 0.93 and 1.08 for 1, 2, 3 and 4+ sessions per week (p = 0.003).
  - When volume was equated, frequency had no effect (p = 0.421).
  - Higher frequency helped for multi-joint, upper-body and female outcomes.
  - Mostly untrained participants. The authors conclude the effect is mainly volume-mediated.
  - Source: [PubMed 29470825](https://pubmed.ncbi.nlm.nih.gov/29470825/).
- **Pelland 2026 [MA], frequency and strength.**
  - 66 studies, 490 effects, 2,020 participants; reciprocal model.
  - Slope +3.27% per session (95% CrI 2.74–3.84%); 100% probability the slope is above 0.
  - Control-adjusted strength gain: 12.72% at 1 fractional session per week, 17.32% at 2 sessions; "beyond this point, accelerating diminishing returns occur".
  - Proposed mechanism: more practice exposures.
  - Caveat: the mean volume in these studies was low (8.14 ± 6.23 fractional sets).
  - Source: [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460).
  - The Remmert preprint cites Pelland as finding no detectable superiority beyond a fractional frequency of about 3 for strength ([Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537)).
- **Colquhoun et al. 2018 [RCT-T], powerlifting-style training.** 28 trained men, 6 weeks, 3 vs 6 sessions per week with volume and intensity equated ([PubMed 29324578](https://pubmed.ncbi.nlm.nih.gov/29324578/)):

  | Outcome | 3×/week | 6×/week |
  |---|---|---|
  | Squat 1RM | +16.8 kg | +16.7 kg |
  | Bench 1RM | +7.8 kg | +8.8 kg |
  | Deadlift 1RM | +19 kg | +21 kg |
  | Powerlifting total | +43.6 kg | +46.5 kg |

  No group differences.

**Per-session volume**
- **Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC.** "Is There Too Much of a Good Thing? Meta-Regressions of the Effect of Per-Session Volume on Hypertrophy and Strength." SportRxiv, March 2025 [PREPRINT; no peer-reviewed version found as of Nov 2026]. Source: [Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537).
  - Hypertrophy: 35 studies, 220 effects, 1,032 participants. Best fit linear-log. Slope +0.393% per fractional set per session (95% CrI 0.202–0.583%).
  - Strength: 66 studies, 490 effects, 2,020 participants. Best fit reciprocal. Slope +1.23% per direct set per session (0.941–1.52%).
  - PUOS:

    | Outcome | Total sets | Direct sets | Fractional sets |
    |---|---|---|---|
    | Hypertrophy (per muscle per session) | ≈13.8 | ≈8.2 | ≈11 (model value) |
    | Strength (per lift per session) | ≈5.0 | ≈2 (model value) | ≈3.5 |

  - The authors stress that these "are not upper limits." Above them, more sets still produce gains, but each added set no longer has a >50% probability of a cumulative difference exceeding the SDES.
  - There is insufficient data at very high per-session volumes, so it is unknown whether more sets would attenuate gains.
  - Mean per-session volume in the dataset: 5.95 ± 4.49 fractional sets.
  - Interacting moderators: rest-interval length and proximity to failure did not meaningfully change the per-session dose–response.
  - Practical synthesis by the authors: for strength, use "low per-session volume and an emphasis on frequency of approximately 2–3 sessions per week". For hypertrophy, about 3 sessions of about 10 sets could reach the ~31-set weekly PUOS, though the volume × frequency interaction is "unclear".
- **Earlier per-session evidence** (as cited in [Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537)):
  - Krieger's unpublished 2017 meta-regression (34 groups, 15 studies) qualitatively suggested a threshold of about 6–8 sets per muscle per session in studies with rest of ≥2 minutes.
  - Benito et al. 2020 found a small negative association between per-session volume and lean mass, using indirect measures.
  - Example in trained men: 10.5 fractional biceps sets per week split 3.5 × 3 sessions gave +6.5% thickness, vs a 4.5 + 6 split over 2 sessions giving +4.4% (Schoenfeld 2015 data, β = 1.41, p = 0.012).

### Inferences
- **Hypertrophy frequency:** default each muscle to ≥2 sessions per week. The rationale is distributing volume rather than any frequency effect.
- **Per-session soft cap:** about 8–10 direct, or about 11 fractional, sets per muscle per session. When a muscle's weekly target would exceed this in one session, have the planner suggest adding a session instead of more sets.
- **Strength frequency:** for each competition lift (or close variant), default to 2–3 sessions per week. Prefer adding a session over adding sets above about 2–4 heavy sets per session for strength-only goals.
- **Wording:** do not show "junk volume" as fact. Present the cap as "low expected return per extra set." No reviewed evidence shows harm from extra sets within a session at the volumes studied. The retracted Barbalho trials were the main source of harm claims.

### Gaps
- No trial independently manipulates per-session volume and frequency while holding weekly volume constant across more than two levels.
- Per-session figures are unreviewed preprint estimates that depend on an arbitrary SDES threshold.
- Frequency data above about 3 sessions per muscle per week are sparse in trained lifters (Zaroni is n = 18; Colquhoun n = 28).

---

## 4. Minimum effective dose and maintenance volume

### Takeaway
- **Hypertrophy:** about 4 fractional sets per muscle per week is enough for a detectable gain on average (Pelland; Iversen et al. likewise recommend ≥4 weekly sets).
- **Strength in trained men:** 1 hard set of 6–12 reps (about 70–85% 1RM) taken to failure 2–3 times a week raises squat and bench 1RM, but suboptimally.
- **Powerlifters:** about 3–6 working sets per lift per week of 1–5 reps at >80% 1RM and RPE 7.5–9.5 is a reasonable minimum.
- **Maintenance:** strength and size can be maintained for up to about 32 weeks with as little as 1 session per week and 1 set per exercise, if relative load (intensity) is kept. This applies to younger adults; older adults need more.

### Cited Findings
- **Androulakis-Korakakis, Fisher & Steele 2020 [MA].** *Sports Med* 50(4):751–765.
  - 6 studies in resistance-trained men. A single set performed 1–3 times per week was sufficient for significant 1RM gains.
  - Pooled gain (5 studies): overall 1RM +12.09 kg (95% CI 8.16–16.03), squat +17.48 kg (8.51–26.46), bench +8.25 kg (0.68–15.83).
  - Prescription: 1 set of 6–12 reps at about 70–85% 1RM, 2–3 times a week, at high effort (volitional or momentary failure), for 8–12 weeks. Gains are "suboptimal, yet significant".
  - Unclear for the deadlift, women, and highly trained strength athletes.
  - Source: [PubMed 31797219](https://pubmed.ncbi.nlm.nih.gov/31797219/).
- **Androulakis-Korakakis et al. 2021**, multi-experiment paper with powerlifters. *Front Sports Act Living* 3:713655. Includes interviews (n = 28 elite athletes and coaches; n = 137), two training interventions (n = 25 intermediate–advanced lifters) and a survey (n = 57).
  - Minimum effective training dose: "~3–6 working sets of 1–5 repetitions each week… spread across 1–3 sessions per week per powerlift, using loads above 80% 1RM at RPE 7.5–9.5 for 6–12 weeks."
  - Single top sets at RPE 9–9.5 alone: gains "less likely to be meaningful". Adding 2–3 back-off sets at about 80% of the single's load may help.
  - Accessories: 1–3 per lift at RPE 7–9, about 6–10 reps.
  - Source: [PubMed 34527944](https://pubmed.ncbi.nlm.nih.gov/34527944/).
- **Androulakis-Korakakis et al. 2018 [pilot, n = 10 powerlifters].** "Daily max" single at RPE 9–9.5 vs periodized higher volume, 10 weeks. Individual totals in the daily-max group ranged from +4.8% to −5%. Favourable for some beginner–intermediate lifters, but harmful for others ([PubMed 30158433](https://pubmed.ncbi.nlm.nih.gov/30158433/)).
- **Iversen et al. 2021 (narrative review).** *Sports Med* 51(10):2079–2095. Recommends "a minimum of 4 weekly sets per muscle group using a 6–15 RM loading range (15–40 repetitions can be used if training is performed to volitional failure)". Weekly volume matters more than frequency ([PubMed 34125411](https://pubmed.ncbi.nlm.nih.gov/34125411/)).
- **Pelland [MA]:** the minimum effective dose is 4 fractional sets per week for hypertrophy (>2.05% gain) and 1 set per week for strength (>3.96%) ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460)).
- **Single-set routines in trained lifters, Hermann et al. 2025 [RCT-T].** *Med Sci Sports Exerc* 57(9):2021–2031. 42 trained men and women did 1 set of each of 9 exercises, twice a week, for 8 weeks. Both the failure and 2-RIR groups gained in most outcomes, "even when transitioning from higher-volume programs" ([PubMed 40249908](https://pubmed.ncbi.nlm.nih.gov/40249908/)).
- **Schoenfeld et al. 2019 [RCT-T]:** 1 set per exercise, 3 times a week (about 13-minute sessions), gave strength gains similar to 3 or 5 sets ([PubMed 30153194](https://pubmed.ncbi.nlm.nih.gov/30153194/)).
- **Maintenance, Bickel, Cross & Bamman 2011 [RCT].** *Med Sci Sports Exerc* 43(7):1177–1187.
  - 70 adults trained 3 days per week for 16 weeks, then 32 weeks of detraining or of a maintenance dose of one-third or one-ninth of the training dose.
  - Both maintenance doses preserved hypertrophy in young adults (20–35 y) but not in older adults (60–75 y). The one-third dose even added myofiber hypertrophy in the young.
  - Strength was largely retained even with detraining.
  - Source: [PubMed 21131862](https://pubmed.ncbi.nlm.nih.gov/21131862/).
- **Maintenance, Spiering et al. 2021 (narrative review).** *J Strength Cond Res* 35(5):1449–1458.
  - In younger adults, strength and size can be maintained for up to 32 weeks with as little as 1 session per week and 1 set per exercise, if relative load is maintained.
  - Older adults may need up to 2 sessions per week and 2–3 sets per exercise.
  - "Exercise intensity seems to be the key variable." Data for athletes are insufficient.
  - Source: [PubMed 33629972](https://pubmed.ncbi.nlm.nih.gov/33629972/).
- **RP's maintenance volume [PRACTITIONER]:** "typically around 6 working sets per muscle group per week," trained at least twice a week ([RP 2017](https://rpstrength.com/training-volume-landmarks-muscle-growth/)).

### Inferences
- **"Minimum / time-crunch" mode:**
  - Hypertrophy: about 4–6 sets per muscle per week, taken close to failure (0–2 RIR).
  - Powerlifters: 3–6 heavy sets per lift per week (>80% 1RM, RPE 7.5–9.5) across 1–3 sessions.
  - Maintenance: about 1/3 of normal volume (for example 1–3 hard sets per muscle per week), keeping loads and effort high.
- The evidence supports keeping intensity (load and effort) and cutting volume and frequency during maintenance phases, not the reverse.

### Gaps
- Maintenance data in trained bodybuilders and powerlifters are absent; Bickel's participants were previously untrained.
- Maintenance of 1RM for competition lifts specifically is unstudied. Minimum dose data for the deadlift and for women are sparse.

---

## 5. Load range for hypertrophy vs strength

### Takeaway
- **Hypertrophy:** similar across a wide load range, from about 30% to about 85%+ 1RM (roughly 6–35 reps), provided sets are taken close to failure. Very light loads (about 20% 1RM) were inferior when volume load was matched.
- **Strength (1RM):** clearly favours heavy loads.
  - High (≤8RM) vs low (>15RM) load: SMD about 0.60.
  - Moderate (9–15RM) vs low load: SMD about 0.35.
  - >80% 1RM is the threshold named in the BJSM network meta-analysis and the ACSM 2026 position stand.
  - For powerlifting specificity, the minimum-dose literature uses >80% 1RM for 1–5 reps.

### Cited Findings
- **Schoenfeld, Grgic, Ogborn & Krieger 2017 [MA].** *J Strength Cond Res* 31(12):3508–3523.
  - 21 studies, all sets to failure, low load (≤60% 1RM) vs high load (>60% 1RM).
  - 1RM gains were significantly greater with high loads. Isometric strength did not differ, and hypertrophy was similar.
  - Source: [PubMed 28834797](https://pubmed.ncbi.nlm.nih.gov/28834797/).
- **Lopez et al. 2021 [MA, network meta-analysis].** *Med Sci Sports Exerc* 53(6):1206–1216. DOI 10.1249/MSS.0000000000002585.
  - 28 studies, 747 healthy adults, all sets to volitional failure. Loads: low (>15RM), moderate (9–15RM), high (≤8RM).
  - No hypertrophy differences overall (p = 0.113–0.469) or in high-quality subgroups.
  - Strength vs low load: high load SMD 0.60–0.63; moderate load SMD 0.34–0.35.
  - Untrained participants showed greater hypertrophy. Among those with training experience, more sessions gave more gains.
  - Source: [PubMed 33433148](https://pubmed.ncbi.nlm.nih.gov/33433148/).
- **Carvalho et al. 2022 [MA], volume-load matched.** *Appl Physiol Nutr Metab* 47(4):357–368.
  - Load categories: very low (>35RM), low (30–59% 1RM or 16–35RM), moderate (60–79% or 8–15RM), high (≥80% or ≤7RM).
  - 1RM: high > low, high > moderate, moderate > low. Low and very low differed little.
  - Hypertrophy: no difference between loads.
  - Source: [PubMed 35015560](https://pubmed.ncbi.nlm.nih.gov/35015560/).
- **Currier et al. 2023 [MA]:** higher-load prescriptions (>80% 1RM) maximised strength; all prescriptions comparably promoted hypertrophy ([PubMed 37414459](https://pubmed.ncbi.nlm.nih.gov/37414459/)).
- **ACSM 2026:** strength is enhanced by ≥80% 1RM and 2–3 sets ([PubMed 41843416](https://pubmed.ncbi.nlm.nih.gov/41843416/)).
- **Lower bound of the load range, Lasevicius et al. 2018 [within-subject RCT].** 30 men, 12 weeks, 20% vs 40% / 60% / 80% 1RM with volume matched to the 20% condition (3 sets to failure). Gains in cross-sectional area ([PubMed 29564973](https://pubmed.ncbi.nlm.nih.gov/29564973/)):

  | Load | Vastus lateralis CSA | Elbow flexor CSA |
  |---|---|---|
  | 20% 1RM | +8.9% | +11.4% |
  | 40% 1RM | +20.5% | +25.3% |
  | 60% 1RM | +20.4% | +25.1% |
  | 80% 1RM | +19.5% | +25% |

  20% 1RM was "suboptimal", and strength gains were greater at 60–80%.
- **Morton et al. 2016 [RCT-T].** *J Appl Physiol* 121(1):129–138. 49 trained men, 12 weeks, about 30–50% 1RM for 20–25 reps vs about 75–90% for 8–12 reps, all to failure.
  - Lean mass (DXA) and type I and II fiber cross-sectional area (biopsy) increased similarly in both groups.
  - 1RM gains were similar except bench press (+9 vs +14 kg, favouring heavier loads).
  - Source: [PubMed 27174923](https://pubmed.ncbi.nlm.nih.gov/27174923/).
- **Schoenfeld et al. 2015 [RCT-T].** 18 trained men, 25–35 reps vs 8–12 reps, 3 sets × 7 exercises, 3 times a week, 8 weeks ([PubMed 25853914](https://pubmed.ncbi.nlm.nih.gov/25853914/)):

  | Outcome | High load (8–12 reps) | Low load (25–35 reps) |
  |---|---|---|
  | Elbow flexor thickness | +5.3% | +8.6% |
  | Elbow extensor thickness | +6.0% | +5.2% |
  | Quadriceps thickness | +9.3% | +9.5% |
  | Squat 1RM | +19.6% | +8.8% |
  | Bench 1RM (trend) | +6.5% | +2.0% |

  Hypertrophy differences were not significant; squat 1RM favoured heavy loads significantly.
- **Schoenfeld et al. 2014 [RCT-T].** 3 × 10RM (bodybuilding style) vs 7 × 3RM (powerlifting style), volume-load equated, 8 weeks. Biceps thickness was similar; bench 1RM favoured the 3RM group, with a trend for the squat ([PubMed 24714538](https://pubmed.ncbi.nlm.nih.gov/24714538/)).
- **Mangine et al. 2015 [RCT-T].** 4 × 3–5 at about 90% 1RM vs 4 × 10–12 at about 70%, 8 weeks. The heavy group gained more bench 1RM (14.8% vs 6.9%) and lean arm mass (5.2% vs 2.2%) ([PubMed 26272733](https://pubmed.ncbi.nlm.nih.gov/26272733/)).
- **Schoenfeld et al. 2021 (narrative re-examination of the "repetition continuum").** Muscular adaptations "can be obtained, and in some cases optimized, across a wide spectrum of loading zones" ([PubMed 33671664](https://pubmed.ncbi.nlm.nih.gov/33671664/)).
- **Powerlifting specificity:**
  - Minimum dose: >80% 1RM, 1–5 reps, RPE 7.5–9.5 ([Androulakis-Korakakis 2021](https://pubmed.ncbi.nlm.nih.gov/34527944/)).
  - Per-session analysis cites meaningful strength gains from 1–2 sets per session at >80% 1RM and RPE ≥7.5 ([Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537)).

### Inferences
- **Hypertrophy rep range:**
  - Allow about 5–30 reps per set (about 30–85% 1RM).
  - Default 6–15 reps for compounds and 8–20 for isolation exercises.
  - Above about 20 reps, require low RIR (0–2) to count the set as "hard". Low-load sets far from failure are likely ineffective; this is inferred because all low-load meta-analyses required failure.
  - Flag loads below about 30% 1RM (about 35+ reps) as suboptimal.
- **Strength rep range:**
  - Main work at ≥80% 1RM (about 1–6 reps) for the target lift, with a meaningful share of sets at 85–95%+ as competition nears. Peaking specifics belong to the periodization researcher.
  - Moderate loads (about 70–80%) still build strength, but less per set.
- For powerlifters, use separate templates: heavy specific work for the lift, plus moderate-load hypertrophy accessories counted toward muscle volume.

### Gaps
- Exact pooled effect sizes for Schoenfeld 2017 (low vs high load) were not retrieved; only the abstract was checked.
- No dose–response curve of %1RM against 1RM gain exists for trained powerlifters. The ">80%" figure is a categorical threshold, not a modelled optimum.
- The "minimum %1RM for specificity" in elite powerlifters is not established in peer-reviewed trials.

---

## 6. Proximity to failure (RIR): hypertrophy vs strength, and fatigue cost

### Takeaway
- **Hypertrophy:** improves as sets end closer to failure. Robinson et al. 2024 estimated about −0.5 percentage points of muscle growth per additional repetition in reserve (RIR), from estimated RIR across 26 studies. Direct trials show 1–3 RIR gives hypertrophy similar or nearly similar to momentary failure, with small and inconsistent edges for failure.
- **Strength:** essentially flat across a wide RIR range. Failure gives no advantage, and non-failure is better when failure training adds volume.
- **Fatigue:** failure markedly increases acute fatigue and delays neuromuscular recovery by 24–48 h, especially on heavy compounds.
- **Practical ranges:**
  - Hypertrophy: about 0–3 RIR, mostly 1–2; failure is optional and best kept for the last set of low-risk exercises.
  - Strength: about 1–4 RIR (RPE 6–9) on the competition lifts.

### Cited Findings
- **Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC 2024 [MA].** "Exploring the Dose-Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions." *Sports Med* 54(9):2209–2231. DOI 10.1007/s40279-024-02069-2. Source: [PubMed 38970765](https://pubmed.ncbi.nlm.nih.gov/38970765/).
  - RIR was estimated from study descriptions, not measured. Only volume-equated studies were included.
  - Models were adjusted for load, method of volume equating, duration and training status.
  - Strength: slope negligible (confidence interval included 0).
  - Hypertrophy: negative slope, with the interval excluding 0. "Muscle hypertrophy improves as sets are terminated closer to failure."
  - Fit was modest, and the analysis is exploratory.
- **Numbers from the Robinson preprint version** (may differ slightly from the published paper) ([SportRxiv preprint 295](https://sportrxiv.org/index.php/server/preprint/view/295)):
  - 55 studies.
  - Strength: 243 effects. SMD slope β = 0.003 per RIR (95% CI −0.012 to 0.018). Response-ratio slope −0.059% per RIR (−0.304 to 0.186).
  - Hypertrophy: 140 effects from 26 studies. SMD slope β = −0.019 per RIR (−0.035 to −0.004). Response-ratio slope −0.48% muscle size per RIR (95% CI −0.78 to −0.179).
  - R²marginal was 19–29%.
  - Typical training in the strength effects: mean 9.58 ± 4.48 sets per week at 72% 1RM.
  - The authors warn that, because studies were volume-equated, failure's advantage "may change if participants could modify the number of sets… training with a greater number of RIR could allow for more weekly sets."
- **Refalo et al. 2023 [MA].** *Sports Med* 53(3):649–665. 15 studies.
  - Set failure (any definition) vs non-failure: trivial advantage (ES 0.19, 95% CI 0.00–0.37; p = 0.045).
  - Momentary failure vs non-failure: ES 0.12 (−0.13 to 0.37), not significant.
  - Higher (>25%) vs moderate (20–25%) velocity-loss thresholds: ES 0.08 (−0.16 to 0.32).
  - No moderation by volume load or relative load. Suggests a non-linear relationship.
  - Source: [PubMed 36334240](https://pubmed.ncbi.nlm.nih.gov/36334240/).
- **Grgic et al. 2022 [MA].** *J Sport Health Sci* 11(2):202–211. 15 studies, young adults.
  - Strength: ES −0.09 (−0.22 to 0.05). Hypertrophy: ES 0.22 (−0.11 to 0.55).
  - In non-volume-equated studies, non-failure was better for strength (ES −0.32, −0.57 to −0.07).
  - Resistance-trained subgroup: failure was better for hypertrophy (ES 0.15, 0.03–0.26).
  - Source: [PubMed 33497853](https://pubmed.ncbi.nlm.nih.gov/33497853/).
- **Vieira et al. 2021 [MA].** *J Strength Cond Res* 35(4):1165–1175. 13 studies.
  - Strength: SMD −0.08 (not significant). With unequal volumes, non-failure was better (SMD −0.34).
  - Hypertrophy: failure better overall (SMD 0.75; p = 0.005), but no difference when volume was equated.
  - Power: with unequal volumes, non-failure was better (SMD −0.61).
  - Source: [PubMed 33555822](https://pubmed.ncbi.nlm.nih.gov/33555822/).
- **Sampson & Groeller 2016.** 28 men, 12 weeks of elbow-flexor training at 85% 1RM: non-failure (about 4.2 reps per set) vs failure (about 6.1 reps). No group differences. Pooled gains: 1RM +30.5%, cross-sectional area +11.4%. "Repetition failure is not critical" ([PubMed 25809472](https://pubmed.ncbi.nlm.nih.gov/25809472/)).
- **Refalo et al. 2024 [RCT-T, within-subject].** *J Sports Sci* 42(1):85–101.
  - 18 trained (12 men, 6 women), 8 weeks, leg press and leg extension, failure vs 2 and 1 RIR respectively.
  - Average quadriceps thickness gain: +0.181 cm with failure vs +0.182 cm with RIR training.
  - Failure caused consistently greater velocity and repetition loss (fatigue).
  - Source: [PubMed 38393985](https://pubmed.ncbi.nlm.nih.gov/38393985/).
- **Hermann et al. 2025 [RCT-T].** 42 trained men and women, single sets, failure vs 2 RIR, 8 weeks.
  - Hypertrophy "tended to favor FAIL" with modest absolute differences.
  - Strength and local endurance were similar.
  - RIR estimation was more accurate for bench than squat and improved over the study.
  - Source: [PubMed 40249908](https://pubmed.ncbi.nlm.nih.gov/40249908/).
- **Vasconcelos et al. 2026 [RCT-T, within-subject].** *Muscles* 5(3):61. 19 trained adults, preacher curl at 70–80% 1RM, failure vs 1–3 RIR, 8 weeks.
  - Thickness difference 0.032 cm (95% HDI −0.044 to 0.113). 1RM difference 0.588 kg; both intervals span 0.
  - Conclusion: similar adaptations.
  - Source: [PubMed 42784046](https://pubmed.ncbi.nlm.nih.gov/42784046/).
- **Velocity loss, Jukic et al. 2023 [MA].** *Sports Med* 53(1):177–214. 19 longitudinal studies.
  - Velocity-loss threshold did not affect strength or endurance gains.
  - Higher velocity loss was associated with more hypertrophy (b = 0.006 per % velocity loss).
  - Higher velocity loss impaired jump (b = −0.040), sprint, and velocity against submaximal loads.
  - Source: [PubMed 36178597](https://pubmed.ncbi.nlm.nih.gov/36178597/).
- **Pareja-Blanco et al. 2017.** 22 men, 8 weeks of squats, stopping each set at 20% vs 40% velocity loss.
  - Squat strength gains were similar, even though the 20% group did 40% fewer reps; the 20% group improved jump height more (9.5% vs 3.5%).
  - The 40% group gained more vastus lateralis and intermedius hypertrophy (MRI) but lost type IIX myosin.
  - Source: [PubMed 27038416](https://pubmed.ncbi.nlm.nih.gov/27038416/).
- **Fatigue and recovery, Morán-Navarro et al. 2017.** 10 trained men, bench and squat: 3 × 10 to failure vs 6 × 5 or 3 × 5 with 10RM loads. Failure caused greater acute decline in jump height and bar velocity, and slowed recovery by 24–48 h (ammonia, growth hormone, creatine kinase) ([PubMed 28965198](https://pubmed.ncbi.nlm.nih.gov/28965198/)).
- **Fatigue, Cowley et al. 2026.** Crossover study, 18 participants, 6 sets of squat and prone row at 65% or 85% 1RM, to failure or with 1 or 3 RIR.
  - Neuromuscular and perceptual fatigue and metabolic stress rose as sets ended closer to failure.
  - Squats were more fatiguing than rows, and 65% more fatiguing than 85% 1RM.
  - Source: [PubMed 42458937](https://pubmed.ncbi.nlm.nih.gov/42458937/).
- **Refalo et al. 2022 (scoping review).** Failure "is likely not superior to non-failure RT for inducing muscle hypertrophy, but may exacerbate neuromuscular fatigue, muscle damage, and post-set perceived discomfort." There is no consensus definition of failure ([PubMed 35658845](https://pubmed.ncbi.nlm.nih.gov/35658845/)).
- **ACSM 2026:** "Training to momentary muscle fatigue… did not consistently impact training outcomes" ([PubMed 41843416](https://pubmed.ncbi.nlm.nih.gov/41843416/)).
- **RIR self-report accuracy, Halperin et al. 2022 [MA].** *Sports Med* 52(2):377–390. 12 studies, 414 participants.
  - People underpredict reps to failure by 0.95 reps on average (95% CI 0.17–1.73), with very high heterogeneity.
  - Accuracy is better closer to failure and for sets of ≤12 reps; sets of >12 reps were much less accurate (β 0.47 vs 0.06).
  - Accuracy improved slightly in later sets. Training status did not matter.
  - Source: [PubMed 34542869](https://pubmed.ncbi.nlm.nih.gov/34542869/).
- **Pelland et al. 2022 (methods review).** Percentage-based prescriptions produce a wide spread of per-set RIR between individuals. Self-reported RIR is individualized but subjective. The authors recommend velocity stops or self-reported RIR ([PubMed 35247203](https://pubmed.ncbi.nlm.nih.gov/35247203/)).

### Inferences
- **Hypertrophy default:** 1–2 RIR on most sets.
  - Allow 0 RIR (failure) on the last set of isolation or machine exercises.
  - Discourage failure on heavy free-weight compounds (squat, deadlift, heavy bench) because of the 24–48 h recovery cost and safety.
  - Sets ending at more than about 4 RIR should count as reduced-stimulus "warm-up / practice" sets for hypertrophy (inferred from Robinson's slope and from low-load studies requiring failure).
- **Strength default:** RPE 6–9 (1–4 RIR) for competition-lift work; occasional heavy singles at RPE 8–9.5. Failure provides no strength benefit and costs recovery.
- **Volume interaction:** a set to failure costs more fatigue than a 1–2 RIR set. If the app lets users trade effort for volume, encourage 1–2 RIR with more sets over failure with fewer sets, since volume has the stronger evidence base.
- **RIR logging UX:**
  - Users tend to under-call RIR by about 1 rep, so a reported "2 RIR" is likely about 3 real RIR on average.
  - Accuracy is worse on high-rep sets (>12 reps) and on squats.
  - Offer optional calibration (an occasional last-set AMRAP) and display a ±1–2 rep uncertainty.

### Gaps
- No trial in trained lifters directly compares several fixed RIR levels (for example 0 vs 2 vs 4 vs 6 RIR) with measured RIR.
- The Robinson slope relies on estimated RIR. Where the hypertrophy benefit plateaus (for example 0–2 vs 3–5 RIR) is unknown.
- No long-term data link chronic failure training to injury or overreaching in bodybuilders or powerlifters.

---

## 7. Practitioner frameworks: Israetel / RP volume landmarks (MV, MEV, MAV, MRV) vs the meta-analytic evidence

### Takeaway
RP's MV, MEV, MAV and MRV landmarks are **practitioner heuristics** with no cited data. Typical figures are:
- maintenance (MV) about 6 direct sets per muscle per week;
- minimum effective volume (MEV) about 6–10;
- maximum adaptive volume (MAV) about 10–22;
- maximum recoverable volume (MRV) about 16–26+.

Their middle ranges (MAV about 12–20) agree broadly with Baz-Valle's 12–20 and Pelland's efficient tiers. RP's MEV (about 8–10) is higher than the meta-analytic minimum (about 4 fractional sets). RP's MRV (about 20–26) sits below volumes some trained lifters tolerated and benefited from for 8–12 weeks in RCTs (30–52 sets), though other RCTs found no added benefit above about 12–18.

### Cited Findings
- **RP's own definitions (blog, 4 Jan 2017, no named author)** [PRACTITIONER] ([RP 2017](https://rpstrength.com/training-volume-landmarks-muscle-growth/)):
  - MV is "the minimum training needed to preserve your current muscle mass".
  - MEV is "the lowest amount of training that actually grows muscle".
  - MAV is "the range where you make your best gains".
  - MRV is the upper limit, beyond which "training… prevents adequate recovery".
  - MV is "typically around 6 working sets per muscle group per week" at ≥2 sessions per week. The triceps MRV example is 18 direct sets.
  - The page cites no studies and calls the numbers "starting points, not gospel".
- **Per-muscle table [PRACTITIONER, secondhand].** Weekly direct sets, as reproduced on a third-party repost of Israetel's per-muscle RP guides ([repost](https://davidroesener.blogspot.com/2020/05/rp-hypertrophy.html)):

  | Muscle | MV | MEV | MAV | MRV | Frequency/week |
  |---|---|---|---|---|---|
  | Chest | 8 | 10 | 12–20 | 22+ | 1.5–3 |
  | Back | 8 | 10 | 14–22 | 25+ | 2–4 |
  | Quads | 6 | 8 | 12–18 | 20+ | 1.5–3 |
  | Hamstrings | 4 | 6 | 10–16 | 20+ | 2–3 |
  | Glutes | 0 | 0 | 4–12 | 16+ | 2–3 |
  | Biceps | 5 | 8 | 14–20 | 26+ | 2–6 |
  | Triceps | 4 | 6 | 10–14 | 18+ | 2–4 |
  | Front delts | 0 | 0 | 6–8 | 12+ | 1–2 |
  | Side/rear delts | 0 | 8 | 16–22 | 26+ | 2–6 |
  | Traps | 0 | 0 | 12–20 | 26+ | 2–6 |
  | Calves | 6 | 8 | 12–16 | 20+ | 2–4 |
  | Abs | 0 | 0 | 16–20 | 25+ | 3–5 |

  Zeros mean the muscle receives enough indirect work from compound lifts. Other secondary copies give slightly different values, for example biceps MV 0–6 and a combined side/rear-delt MEV of 6–8 in a community spreadsheet ([Google Sheet copy](https://docs.google.com/spreadsheets/d/1Dc0oZnkxcFVZ6Cl8whOs2O1AiXNKSkhRCRJmJ103_QA/edit)).
- **RP progression logic [PRACTITIONER]:** start a mesocycle near MEV, add sets each week toward MRV, then deload. The MEV estimate is scored from pump, challenge and soreness. No validation is described ([RP 2017](https://rpstrength.com/training-volume-landmarks-muscle-growth/)).
- **Evidence comparison points:**
  - Minimum effective dose: 4 fractional sets ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460)); ≥4 sets ([Iversen 2021](https://pubmed.ncbi.nlm.nih.gov/34125411/)).
  - 12–20 sets "optimum standard" ([Baz-Valle 2022](https://pubmed.ncbi.nlm.nih.gov/35291645/)).
  - Detectable gains continue to about 31 fractional sets ([Remmert preprint citing Pelland](https://sportrxiv.org/index.php/server/preprint/view/537)).
  - Trained men benefited from 30–45 sets ([Schoenfeld 2019](https://pubmed.ncbi.nlm.nih.gov/30153194/)), 32 sets ([Brigatto 2022](https://pubmed.ncbi.nlm.nih.gov/31868813/)), and progression to about 42–52 quadriceps sets ([Enes 2024](https://pubmed.ncbi.nlm.nih.gov/37796222/)).
  - No benefit beyond 12 sets ([Aube 2022](https://pubmed.ncbi.nlm.nih.gov/32058362/)), 9 sets ([Heaselgrave 2019](https://pubmed.ncbi.nlm.nih.gov/30160627/)), or beyond previous volume ([Barsuhn 2025](https://pubmed.ncbi.nlm.nih.gov/39665246/)).

### Inferences
- If the app shows MEV, MAV and MRV, label them as "coaching heuristics (RP), not research-derived". Back the defaults with the meta-analytic bands: 4 = minimum, 10–20 = default, 20–30 = high, above 30 = uncertain.
- RP counts direct sets, while Pelland counts fractional sets. The app should compare like with like: RP numbers against direct sets, Pelland tiers against fractional sets.
- MRV is individual and situational (it also depends on exercise choice and effort). Treat it as a user-tuned parameter learned from performance and recovery data, not a fixed per-muscle constant. No peer-reviewed method for estimating it exists in the sources reviewed.

### Gaps
- RP's current official per-muscle values (for example in the 2021 book *Scientific Principles of Hypertrophy Training* or the RP app) were not retrieved. The table above comes from a 2020 repost and may be outdated.
- No peer-reviewed study tests the MEV→MRV mesocycle progression against fixed volume. Enes 2024 (progressive vs constant sets) is the closest analogue, and its hypertrophy evidence was uncertain.

---

## 8. Individual response variability and individualized volume

### Takeaway
Responses vary hugely between individuals:
- muscle size changes range from about −11% to +59%;
- 1RM changes range from 0% to +250%;
- one within-subject trial in trained men found between-subject variability about 40 times larger than the effect of changing training variables.

Some of the apparent "non-response" is measurement error. Within-subject trials suggest that a fraction of people (about 35–40% in Hammarström 2020) clearly benefit from more volume, while others do not. One small trial in trained lifters found that basing volume on the person's own recent volume (1.2× their logged weekly sets) beat a standard 22 sets. However, a 2025 trial found that raising previous volume by 30–60% gave no extra hypertrophy. Individualization anchored to recent training history is plausible, but not proven as a general algorithm.

### Cited Findings
- **Hubal et al. 2005.** 585 untrained men and women, 12 weeks of unilateral elbow-flexor training, MRI cross-sectional area. Size changes ranged from −2% to +59%; 1RM from 0 to +250%; isometric strength from −32% to +149% ([PubMed 15947721](https://pubmed.ncbi.nlm.nih.gov/15947721/)).
- **Ahtiainen et al. 2016.** Pooled data from untrained adults aged 19–78 (n = 287, including 72 non-training controls) ([PubMed 26767377](https://pubmed.ncbi.nlm.nih.gov/26767377/)):
  - Size +4.8 ± 6.1% (range −11 to +30%); strength +21.1 ± 11.5% (range −8 to +60%).
  - High responders (>1 SD above the mean): 14% for size, 12% for strength.
  - Low responders after accounting for control-group variation: 29% for size, 7% for strength.
  - Age and sex did not affect responses.
- **Dankel & Loenneke 2020.** Percentile, standard-deviation or cluster classifications produce "responders" even without any intervention. They propose classifying responders against the random error measured in a time-matched control group ([PubMed 31254258](https://pubmed.ncbi.nlm.nih.gov/31254258/)).
- **Damas et al. 2019 (J Appl Physiol) [RCT-T, within-subject].** 20 trained men, 8 weeks: one leg did standard progressive training, the other leg systematically varied load, volume, contraction type and rest.
  - Similar cross-sectional area gains, despite higher volume and myofibrillar protein synthesis in the varied leg.
  - "Between-subject variability was 40-fold greater than the variability promoted by extrinsic manipulation of RT variables."
  - Source: [PubMed 31268828](https://pubmed.ncbi.nlm.nih.gov/31268828/).
- **Damas et al. 2019 (J Strength Cond Res), within-subject frequency.** 20 subjects; one leg trained 5 times a week, the other 2–3 times.
  - 31.6% of individuals grew more with high frequency and 36.8% with low frequency.
  - For strength: 26.3% did better with high frequency and 15.8% with low.
  - Individual hypertrophy and strength responses did not necessarily agree.
  - Source: [PubMed 30289872](https://pubmed.ncbi.nlm.nih.gov/30289872/).
- **Hammarström et al. 2020 [within-subject, untrained].** *J Physiol* 598(3):543–565. 34 participants, 12 weeks, 1 vs 3 sets per exercise on contralateral legs.
  - Cross-sectional area +5.2% vs +3.7%, favouring 3 sets.
  - 13 of 34 showed clear hypertrophy benefit from the moderate volume; 16 of 34 showed clear strength benefit.
  - Benefit was linked to early total-RNA (ribosome) accumulation: each 1% difference raised the odds of benefit by 7.0% for size and 9.8% for strength.
  - Source: [PubMed 31813190](https://pubmed.ncbi.nlm.nih.gov/31813190/).
- **Scarpelli et al. 2022 [RCT-T, within-subject].** *J Strength Cond Res* 36(4):1153–1157. 16 trained subjects, 8 weeks; one leg did a standardized 22 weekly sets, the other an individualized 1.2× the weekly sets recorded in the person's training log.
  - The individualized leg gained more vastus lateralis cross-sectional area (ultrasound): mean difference 1.08 cm² (CI 0.04–2.11), ES 0.75.
  - More individuals exceeded the typical measurement error with the individualized protocol.
  - Source: [PubMed 32108724](https://pubmed.ncbi.nlm.nih.gov/32108724/).
- **Barsuhn et al. 2025 [RCT-T].** Increasing previous weekly volume by 30% or 60% did not improve hypertrophy over maintaining it; maintenance gave the best 1RM ([PubMed 39665246](https://pubmed.ncbi.nlm.nih.gov/39665246/)).
- **Robinson et al. 2024:** meta-analytic averages "may be inappropriate for some individuals; however, in the absence of robust individual-level evidence (e.g., N of 1 trials) average effects may be the best estimate" ([Robinson preprint](https://sportrxiv.org/index.php/server/preprint/view/295)).

### Inferences
- **Initialize from history:** set a user's starting volume from their logged recent volume where available, not a population default. A reasonable starting point is the recent average, or up to about 1.2× it; this follows Scarpelli and Barsuhn. Large jumps (+30–60%) are not supported.
- **Adaptive engine:** progress volume conservatively and adapt from performance trends (reps at a given load, estimated 1RM, user-reported recovery). Because individual responses differ widely and measurement noise is large, require several weeks of trend data before concluding that more volume "worked". Measurement noise is in the range of the SDES: about 2% for size and about 4% for strength (Pelland).
- **Wording:** avoid labelling users "non-responders". The evidence shows apparent non-response is often measurement error or a specific programme-by-person interaction.

#### Consolidated defaults for the app (synthesis of Sections 1–8; numbers trace to sources above)

| Parameter | Hypertrophy (bodybuilder) | Strength (powerlifter, competition lifts) | Evidence strength |
|---|---|---|---|
| Weekly volume floor | 4 fractional sets per muscle (Pelland); ~6 for maintenance (RP heuristic) | 1–3 direct sets per lift is the minimal detectable dose; 3–6 heavy sets is the practical minimum for trained powerlifters | Meta-analysis; powerlifter mixed-methods |
| Default weekly volume | 10–20 fractional sets per muscle | ~4–10 direct heavy sets per lift per week, plus accessories counted toward muscles | Meta-analysis + RCTs; strength curve plateaus early |
| High / advanced band | 20–30 (lower efficiency) | Above ~5 sets/week per lift gives undetectable extra strength per set (Pelland tiers) | Meta-analysis; sparse data |
| Warn | >30 fractional (no detectable superiority); >40 (no data) | — | Meta-analysis / preprint |
| Set counting | Primary mover 1.0, synergist 0.5 | Same lift = 1.0 (direct); other exercises ≤0.5 | Meta-analytic model comparison |
| Frequency | ≥2 sessions per muscle per week (to distribute volume) | 2–3 sessions per lift per week | Meta-analysis |
| Per-session soft cap | ~11 fractional (~8 direct) sets per muscle; beyond that, split across days | ~2–3 direct heavy sets per lift per session before adding frequency | Preprint |
| Load | ~30–85% 1RM (≈5–30 reps); default 6–15 reps compound, 8–20 isolation | ≥80% 1RM (≈1–6 reps) for main work; accessories at 6–12 reps | Meta-analysis |
| Proximity to failure | 0–3 RIR, default 1–2; failure only on isolation/machine last sets | RPE 6–9 (1–4 RIR); no failure on competition lifts | Meta-regression + RCTs |
| Low-rep / high-rep guards | Sets >20 reps count as "hard" only at ≤2 RIR; flag <30% 1RM | — | Inference from load meta-analyses |
| Maintenance | ~1/3 of normal volume, ≥1 session per week, keep load and effort | Keep heavy exposure ≥1×/week | RCT (Bickel) + narrative review (Spiering) |

### Gaps
- There are no validated algorithms for individualized volume progression in trained lifters, and no N-of-1 trial frameworks for app use.
- Within-subject individualization trials are small (n = 16–34) and short (8–12 weeks). Scarpelli and Barsuhn partly conflict.
- How much of the measured inter-individual variance is true response versus error is not settled for trained populations.
