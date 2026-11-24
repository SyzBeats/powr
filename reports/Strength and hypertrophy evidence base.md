# Let evidence set the priors and user data decide

The published evidence gives a lifting planner a small, defensible set of rules. Nearly every number in it is a population average, so the app has to personalise it per user.

- **Load logic:** convert every logged set into **effective reps (reps + reps in reserve, RIR)**, then apply the Wathan or Epley equation. The popular RTS RPE chart is almost identical to Wathan. Trust only sets at RPE ≥ 7–8 with ≤ 10–12 effective reps, because both the rep-max equations and lifters' RIR self-reports become unreliable beyond that.
- **Hypertrophy volume:** follows a square-root curve with diminishing returns when counted as **fractional sets** (direct = 1.0, synergist = 0.5). About **4 sets per muscle per week** is the minimum, **10–20** the default and 20–30 a high band. Above about **31** no further benefit has been detected.
- **Strength volume and frequency:** strength saturates after a few heavy sets per lift per week, but it gains independently from training each lift **2–3 times per week**.
- **Proximity to failure:** it matters for growth (about **−0.5 percentage points of muscle gain per extra RIR**) but barely for strength. Training to failure adds roughly 24–48 h of recovery time.
- **Progression and periodization:** RPE/RIR-based progression and double progression do at least as well as fixed percentages, and the choice of periodization model hardly matters. Deloads (every ~5–6 weeks), tapers (7–14 days, −40–60% volume) and meet attempts (opener ~91–92% of the day's best) rest on surveys and expert consensus, not trials.
- **Why personalisation is the core:** differences between people are about **40 times larger** than the effect of changing program variables. An e1RM estimated from logged sets carries about **8–10% within-person noise**, while advanced lifters gain only about 0.5–1% per month. The app's core should therefore be a per-user trend engine (smoothed e1RM, smoothed bodyweight, adaptive TDEE) rather than a fixed program.
- **Scoring and nutrition:** the powerlifting scoring formulas are fully specified and reproduce their official test values. The nutrition defaults are well bounded: protein 1.6–2.2 g/kg, or 2.3–3.1 g/kg of fat-free mass in a cut; bulks at 0.25–0.5% bodyweight per week; cuts at 0.5–1% per week; acute water cuts ≤ 2–3%.

Three warnings apply to everything below:

1. The retracted Barbalho volume trials are excluded.
2. The Pelland/Remmert dose–response figures come from preprints and must be verified before hard-coding.
3. No Android phone-camera velocity app, on the Galaxy S22 or any other device, has been validated.

## How to read the evidence tags

Every item below carries one evidence tag. "Inference" means a design rule derived by the research team or this synthesis from the cited evidence; it has not been tested. "Verify before hard-coding" marks numbers taken from preprints, secondary sources or unchecked transcriptions.

| Tag | Meaning | How the app should treat it |
|---|---|---|
| **[MA]** | Meta-analysis or meta-regression | Strongest basis for population defaults |
| **[SR]** | Systematic or scoping review without (or with exploratory) pooling | Directional support |
| **[RCT-T] / [RCT-U] / [RCT]** | Randomized trial in trained / untrained / mixed participants | Strong if trained and replicated; small samples are common |
| **[POS]** | Position stand or consensus (ACSM, ISSN, IOC) | Expert synthesis; good for safety rails |
| **[OBS]** | Observational, cross-sectional, competition-database or validation study | Descriptive; good for norms and expectations |
| **[DELPHI/SURVEY]** | Expert Delphi consensus or practitioner/athlete survey | What people do, not what is optimal |
| **[NARR]** | Narrative review | Expert opinion with references |
| **[PREPRINT]** | Not peer-reviewed | Verify before hard-coding |
| **[PRACT]** | Practitioner heuristic, textbook or coaching source | Label as heuristic in the UI |
| **[OFFICIAL]** | Federation document or reference source code | Normative for scoring |
| **[MODEL]** | Mathematical model or model validation | Use with the stated assumptions |
| **[INF]** | Inference or derived design rule | Configurable default, not a fact |

The rule base must exclude the following. Barbalho et al. 2020 (*IJSPP*, "ceiling effect for training volume") was retracted ([PubMed 32804467](https://pubmed.ncbi.nlm.nih.gov/32804467/)). Barbalho et al. 2019 (*MSSE*, "upper threshold … in trained women") received an expression of concern and was then retracted ([PubMed 33986236](https://pubmed.ncbi.nlm.nih.gov/33986236/)). Retraction Watch reported data-integrity concerns across this group's papers ([Retraction Watch 2021](https://retractionwatch.com/2021/12/17/exercise-researcher-earns-more-retractions-as-investigations-mount/)). These two trials were the main empirical support for an "inverted U" above roughly 10–20 sets.

The session-design notes also cite a third paper from the same group, Barbalho et al. 2020 *EJSS*, "single-joint exercises do not provide benefits" ([Solent record](https://pure.solent.ac.uk/en/publications/single-joint-exercises-do-not-provide-benefits-in-performance-and/)). The notes do not list it as retracted. Given the group-wide concerns, this synthesis does not rely on it. Its conclusion is independently supported by de França 2015 ([PubMed 26244600](https://pubmed.ncbi.nlm.nih.gov/26244600/)).

## Effective reps turn any logged set into an e1RM, good to about ±5%

The app has three jobs here: estimate a one-rep maximum (e1RM) from any logged set (load × reps, optionally with RPE/RIR); turn a target such as "5 @ RPE 8" or "75% 1RM" into a suggested load; and tell real e1RM change from noise. Notation: w = load lifted, r = reps completed, RIR = reps in reserve, RPE = 10 − RIR on the RIR-based scale, %1RM = 100·w/1RM, r_eff = r + RIR.

### Nine rep-max equations agree below six reps and diverge above ten

Most classic equations have **no published derivation**:
- Epley comes from a poundage chart; Brzycki is a practitioner article with no sample; Lombardi is a textbook formula with "no data, or evidence of data" ([Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf); [Marzagao 2026 preprint](https://arxiv.org/pdf/2603.17495)).
- Only the Mayhew, Reynolds, Kemmler and Macht equations were fitted to measured data.
- The validation studies all point the same way: equations correlate with measured 1RM at r > 0.9, but absolute accuracy holds only at **≤ 10 reps, ideally 3–6**.
- The linear equations (Brzycki, Lander) break down beyond about 12 reps.

| Equation | Formula (w and 1RM in the same unit) | Stated range / population | Tag |
|---|---|---|---|
| Epley 1985 | `1RM = w·(1 + r/30)` (also printed as `0.033·r·w + w`; Welday uses 0.0333) | < 10 reps; Univ. Nebraska chart | [PRACT] ([Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)) |
| Brzycki 1993 | `1RM = w / (1.0278 − 0.0278·r)` ≡ `w·36/(37 − r)` | < 10 reps; no sample reported | [PRACT] ([Marzagao 2026](https://arxiv.org/pdf/2603.17495)) |
| Lander 1985 | `%1RM = 101.3 − 2.67123·r` → `1RM = 100·w/(101.3 − 2.67123·r)` | unspecified | [PRACT] ([Mayhew 2008](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf)) |
| Lombardi 1989 | `1RM = w·r^0.10` (Mayhew 2008 prints 0.13, probably a typo; **verify**) | < 11 reps; textbook | [PRACT] ([Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)) |
| Mayhew 1992 | `%1RM = 52.2 + 41.9·e^(−0.055·r)` | < 15 reps; bench, ~435 college students | [OBS] ([Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)) |
| O'Conner 1989 | `1RM = w·(1 + 0.025·r)` | unspecified; textbook | [PRACT] ([Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)) |
| Wathan 1994 | `%1RM = 48.8 + 53.8·e^(−0.075·r)` | fitted to an NSCA textbook chart | [PRACT] ([Mayhew 2008](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf)) |
| Reynolds 2006, exponential | `1RM = w / (0.5551·e^(−0.0723·r) + 0.4847)` | — | [OBS] ([Mayhew 2008 Table 2](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf)) |
| Reynolds 2006, linear (kg) | Bench `1.1307·5RM + 0.6998`; leg press `1.09703·5RM + 14.2546`; 10RM chest `1.2321·10RM + 0.1752·FFM − 5.7443`; 10RM leg press `1.2091·10RM + 38.0908`; 20RM chest `1.5471·20RM + 3.834`; 20RM leg press `1.3870·20RM + 69.2494` | 70 adults 18–69 y; 5RM best | [OBS] ([Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)) |
| Kemmler 2006 | `1RM = w·(0.988 + 0.0104·r + 0.00190·r² − 0.0000584·r³)` | 3–20 reps to failure; trained women ~57 y, machines | [OBS] ([PubMed 17194251](https://pubmed.ncbi.nlm.nih.gov/17194251/)) |
| Tucker (kg) | `1RM = 1.139·w + 0.352·r + 0.243` | — | [OBS] ([Mayhew 2008](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf)) |
| Others (Mayhew 2008 list) | Adams `w/(1 − 0.02·r)`; Berger `w/(1.0261 − 0.00262·r)`; Brown `w·(0.0338·r + 0.9849)`; Cummings & Finn (kg) `1.175·w + 0.839·r − 4.29787`; Abadie & Wentworth (kg, college women, 5–10 reps) `7.24 + 1.05·w` | — | [OBS/PRACT] ([Mayhew 2008](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf); [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)) |
| Macht 2016 | `1RM(kg) = 1.20·w + 2.19·r − 0.56·biacromial(cm) + 9.6` (R = 0.99, SEE 3.5 kg) | 60 moderately trained men, bench | [OBS] ([PubMed 26913865](https://pubmed.ncbi.nlm.nih.gov/26913865/)) |
| Marzagao 2026 (Fitbod) | `1RM = w·(1 + (r − 1)^0.85 / max(0.5, −2.55 + 4.58·ln w))`, w in **kg** | 303,494 near-failure sets; fitted for internal consistency, **not** against measured 1RM | [PREPRINT] ([arXiv 2603.17495](https://arxiv.org/pdf/2603.17495)) |

**Do not use the regression equations with intercepts as general formulas** (Reynolds linear, Macht, Tucker, Abadie, Cummings & Finn). They are specific to kg, to the machine and to the study population **[INF]**.

The table below gives the %1RM each equation implies at a given rep count. I recomputed it during synthesis and it matches the notes to 0.1 point.

| reps | Epley | Brzycki | Lander | Lombardi | Mayhew | O'Conner | Wathan | Reynolds-exp | Kemmler | RTS @RPE10 | NSCA |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 96.8 | 100.0 | 98.6 | 100.0 | **91.9** | 97.6 | 98.7 | 100.1 | 100.0 | 100 | 100 |
| 2 | 93.8 | 97.2 | 96.0 | 93.3 | 89.7 | 95.2 | 95.1 | 96.5 | 98.4 | 95.5 | 95 |
| 3 | 90.9 | 94.4 | 93.3 | 89.6 | 87.7 | 93.0 | 91.8 | 93.2 | 96.6 | 92.2 | 93 |
| 5 | 85.7 | 88.9 | 87.9 | 85.1 | 84.0 | 88.9 | 85.8 | 87.1 | 92.6 | 86.3 | 87 |
| 8 | 78.9 | 80.5 | 79.9 | 81.2 | 79.2 | 83.3 | 78.3 | 79.6 | 86.0 | 78.6 | 80 |
| 10 | 75.0 | 75.0 | 74.6 | 79.4 | 76.4 | 80.0 | 74.2 | 75.4 | 81.7 | 73.9 | 75 |
| 12 | 71.4 | 69.4 | 69.2 | 78.0 | 73.9 | 76.9 | 70.7 | 71.8 | 77.8 | 68.0 | 67 |
| 15 | 66.7 | 61.1 | 61.2 | 76.3 | 70.6 | 72.7 | 66.3 | 67.2 | 72.8 | – | 65 |
| 20 | 60.0 | 47.2 | 47.9 | 74.1 | 66.1 | 66.7 | 60.8 | 61.5 | 67.2 | – | – |

**Edge cases the code must handle [INF]:**
- Mayhew treats a single as only 91.9% of 1RM, so it would turn a logged single into `e1RM = 1.088·w`. Epley gives `1.033·w`.
- Brzycki is undefined at r ≥ 37.
- Lombardi and O'Conner flatten at high reps.
- Fix: special-case r_eff = 1 (e1RM = w when RIR = 0) and cap or down-weight r_eff > 10–12.

Epley, Brzycki and Wathan differ by < 3% at 5 reps and by about 1% at 10. **The choice of formula matters much less than keeping r ≤ ~10, knowing how close the set was to failure, and allowing for exercise-specific bias [INF].**

#### Validation evidence

Each study below favours a different equation:

- **LeSuer 1997** [OBS, secondary only]: 67 untrained students. Every equation correlated at r > 0.95, but every equation **significantly underestimated the deadlift 1RM** ([Marzagao 2026 review](https://arxiv.org/pdf/2603.17495)). A widely repeated claim that "only Wathan predicted squat" and that deadlift was underestimated by 9–14% could not be checked against the original paper.
- **Reynolds 2006** [OBS]:
  - The load-versus-RM curve was **non-linear**.
  - Cross-validation SEE was 1.80 / 3.64 / 4.82 kg (chest press) and 13.51 / 23.79 / 33.08 kg (leg press) from the 5RM / 10RM / 20RM.
  - A ±5 kg error in the 5RM became a 19.7 kg (leg press) or 6.3 kg (chest press) error in predicted 1RM.
  - The authors concluded "no more than 10 repetitions should be used" ([Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)).
- **Mayhew 2008** [OBS validation inside a 12-week training study; 103 college women, bench, 14 equations]:
  - Over the full 2–30 RTF range, Brzycki was off by **+26.7 ± 101.7%** (ICC 0.24); Mayhew by +1.2 ± 9.0% (ICC 0.96).
  - With ≤ 10 RTF, every main equation fell within about ±2% on average: Mayhew +1.6 ± 9.4%, Wathen +0.7 ± 10.6%, Epley +0.1 ± 2.8 kg, Brzycki −2.0 ± 10.5% ([PubMed 18714230](https://pubmed.ncbi.nlm.nih.gov/18714230/); [full text](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf)).
- **Kemmler's** cubic predicted within **1.5–3.1%** mean absolute difference from 3–20 RTF in trained older women ([PubMed 17194251](https://pubmed.ncbi.nlm.nih.gov/17194251/)).
- **Division I footballers** [OBS, thesis]: Epley and Brzycki predicted back squat within about 2.7–3.1 kg ([DiStasio 2014, cited in Macarilla 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9465738)).
- **Braith 1993** (knee extension): `1RM = 1.554·(7–10RM) − 5.181` (R² 0.89, SEE 9.3 kg) ([PubMed 8423746](https://pubmed.ncbi.nlm.nih.gov/8423746/)).
- **Eston & Evans 2009** [OBS]: extrapolating Borg RPE from light sets to RPE 20 matched group means but gave individual errors of ±10–19% ([PMC3761544](https://pmc.ncbi.nlm.nih.gov/articles/PMC3761544)).
- **Marzagao 2026 preprint** (app data):
  - Brzycki, Epley and Wathen gave near-identical within-person consistency (SD of log 1RM 0.1021–0.1028); Mayhew was worse (0.1084).
  - The weight-dependent formula cut inconsistency by 17–22%, with the largest gains on light isolation lifts (+24–35% for dumbbell curls).
  - Its implied "k" (reps per 1RM fraction) is 8.0 at 10 kg, 16.9 at 70 kg and 20.4 at 150 kg ([arXiv 2603.17495](https://arxiv.org/pdf/2603.17495)).
  - **Synthesis check:** the transcribed formula reproduces the preprint's curl example (13 kg × 10 → 22.1 kg vs Brzycki 17.3 kg). It gives **117.5 kg for 100 kg × 5**, which is 5 kg above Brzycki (112.5) and close to Epley (116.7). That contradicts the notes' statement that it "agrees with Brzycki within 2 kg". **Verify the formula against the preprint before shipping it, even as an experiment.**

Velocity-based 1RM prediction is worse than rep-based prediction for absolute 1RM:
- Load–velocity profiles **overestimated 1RM by 18.5–23.8% (squat) and 6.3–8.2% (bench)** in trained men ([Macarilla 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9465738)).
- Back-squat SEE was 10.6 kg (CV 7.4%) ([Banyard 2017](https://pubmed.ncbi.nlm.nih.gov/27669192/)).
- An individual-patient-data (IPD) meta-analysis reportedly found a pooled SEE of about 9.8% of 1RM [secondary] ([Marzagao 2026 review](https://arxiv.org/pdf/2603.17495)).

### Reps at a given %1RM vary by exercise far more than by sex or training status

The best table available is **Nuzzo et al. 2024** [MA]: 269 studies, 952 tests, 7,289 people, giving means and between-person SDs of reps to failure ([PMC10933212](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212)). Exercise was the only moderator with clear evidence: leg press allows many more reps than bench. For sex, age and training status, "almost all interval estimates on contrast ratios included 1". The search was not systematic, 77 studies were digitised from figures, and two authors formerly worked for an equipment company.

| %1RM | Pooled mean [95% CI] | Pooled SD | Bench mean [CI] | Bench SD | Leg press mean [CI] | Leg press SD |
|---|---|---|---|---|---|---|
| 95 | 3.28 [2.66–4.04] | 1.66 | 2.59 [1.71–3.92] | 1.25 | 7.04 [1.67–29.75] | 2.63 |
| 90 | 4.94 [4.35–5.61] | 1.90 | 4.11 [3.19–5.28] | 1.46 | 8.69 [3.71–20.39] | 3.08 |
| 85 | 7.15 [6.69–7.65] | 2.19 | 6.23 [5.34–7.26] | 1.71 | 10.69 [6.98–16.37] | 3.62 |
| 80 | 9.75 [9.32–10.20] | 2.51 | 8.82 [7.72–10.08] | 1.99 | 13.05 [9.78–17.41] | 4.24 |
| 75 | 12.37 [11.87–12.88] | 2.88 | 11.51 [10.13–13.08] | 2.33 | 15.79 [11.71–21.30] | 4.98 |
| 70 | 14.80 [14.23–15.40] | 3.31 | 14.08 [12.38–16.01] | 2.72 | 18.96 [14.14–25.43] | 5.84 |
| 65 | 17.11 [16.36–17.90] | 3.80 | 16.59 [14.28–19.28] | 3.17 | 22.59 [16.24–31.41] | 6.85 |
| 60 | 19.53 [18.52–20.59] | 4.37 | 19.34 [16.33–22.91] | 3.70 | 26.74 [17.60–40.62] | 8.03 |
| 55 | 22.43 | 5.02 | 22.79 | 4.31 | 31.47 | 9.42 |
| 50 | 25.99 | 5.76 | 27.25 | 5.03 | 36.86 | 11.05 |
| 40 | 35.75 | 7.60 | 40.45 | 6.86 | 49.87 | 15.21 |
| 30 | 50.50 | 10.02 | 62.62 | 9.33 | 66.47 | 20.92 |
| 20 | 72.75 | 13.21 | 100.02 | 12.71 | 87.62 | 28.78 |

The textbook NSCA chart [PRACT] (100→1, 95→2, 93→3, 90→4, 87→5, 85→6, 83→7, 80→8, 77→9, 75→10, 70→11, 67→12, 65→15) fits bench well. It **underestimates reps for leg press and for pooled data at moderate loads** (pooled: about 5 reps at 90% and 15 at 70%) ([Nuzzo 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212)).

Other studies agree on the direction but not always the size:
- Squat allowed more reps than bench or curl at 60% [OBS] ([Shimano 2006](https://pubmed.ncbi.nlm.nih.gov/17194239/)).
- Endurance runners did **39.9 ± 17.6** leg-press reps at 70% versus 17.9 ± 2.8 for weightlifters [OBS] ([Richens & Cleather 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4042664)).
- Reynolds' plate-loaded leg press showed the **opposite** pattern (85.9 / 70.1 / 51.6 %1RM at 5 / 10 / 20RM versus 87.5 / 75.7 / 61.6% for bench). This conflict probably comes from machine geometry and metronome tempo ([Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)).
- Individual multilevel models fit much better than pooled ones (R² 0.97–0.98 vs 0.89–0.93), with a two-parameter exponential best [OBS] ([Mitter 2023](https://pubmed.ncbi.nlm.nih.gov/35703009/)).
- Hoeger's 7-exercise data showed differences by exercise and by training status [secondary] ([Nuzzo 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212); [Kravitz, UNM](http://www.unm.edu/~lkravitz/Article%20folder/1RM.html)).
- Novices choosing 1-RIR loads picked 88.2 / 84.3 / 79.2% (deadlift) and 93.0 / 87.3 / 79.6% (bench) for 3 / 5 / 8 reps, with ICC 0.95–0.99 ([Lovegrove 2022](https://pubmed.ncbi.nlm.nih.gov/36135029/)).
- Percentage prescription applied to a group produces "a wide range of per-set RIR" ([Pelland 2022](https://pubmed.ncbi.nlm.nih.gov/35247203/)).

**Recommended load-for-target-reps hierarchy [INF]:**
1. The user's own fitted curve per exercise.
2. An exercise-class prior: bench-like upper-body compounds use Nuzzo bench or RTS/Wathan; leg press and machine lower-body lifts use the Nuzzo leg press table; everything else uses Nuzzo pooled.
3. RPE autoregulation on top.

At 80% 1RM the pooled SD of 2.5 reps means about two-thirds of lifters do 7–12 reps. A population table is therefore off by about ±1 effective rep (≈ ±3% load) for many users. Inverting the Nuzzo leg-press means suggests standard formulas could **inflate leg-press e1RM by about 15% at 10 reps** [INF].

### The RTS RPE chart is one-dimensional in reps + RIR and tracks Wathan

**The RIR-based RPE scale** (Zourdos 2016) [OBS, 29 squatters] defines "RPE-10 = 0-RIR, RPE-9 = 1-RIR, and so forth". Velocity–RPE correlated at r = −0.88 in experienced lifters and −0.77 in novices ([PubMed 26049792](https://pubmed.ncbi.nlm.nih.gov/26049792/)).
- Half-point descriptors [secondary]: 9.5 = no further reps but load could increase; 8.5 = 1–2 reps left; 7.5 = 2–3 left ([Topend Sports](https://www.topendsports.com/fitness/strength/rpe-resistance-training.htm)).
- Helms 2016 [NARR] argues the scale "adjusts loads automatically to match athlete capabilities on a set-to-set basis" ([AUT repository](https://openrepository.aut.ac.nz/items/92cefeac-7c32-44f1-bfbc-f48f4a5dd8cf/full)).

**Experienced lifters rate a true 1RM close to 10:**
- Powerlifters: 9.6 ± 0.5 (squat), 9.7 ± 0.4 (bench), 9.6 ± 0.5 (deadlift), with %1RM–RPE r = 0.88–0.91 ([Helms 2017](https://pubmed.ncbi.nlm.nih.gov/27243918/)).
- Bench press, experienced vs novice: 9.86 ± 0.14 vs 9.35 ± 0.36 ([Ormsbee 2019](https://pubmed.ncbi.nlm.nih.gov/28301439/)).
- So a beginner's "RPE 10" single may not be a true max.

**RPE-based loading works at least as well as percentages.** Over 8 weeks in trained men, RPE loading produced 1RM gains similar to %1RM loading (bench +10.70 vs +9.64 kg; squat +17.05 vs +13.91 kg), with a 57–79% chance of a small advantage for RPE [RCT-T] ([Helms 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330)).

The Tuchscherer/RTS chart [PRACT, secondary] is **exactly one-dimensional in effective reps**: `value(r, RPE x) = value(r + (10 − x), RPE 10)`, so 5 @ RPE 8 = 7 @ RPE 10 = 81.1% ([FitnessVolt](https://fitnessvolt.com/rpe-training/guides/tuchscherer-chart-explained)). Its source warns that the chart:
- is a guide and should not be used to derive a max;
- assumes a fresh set;
- is less reliable above 10 reps and on isolation lifts.

The full chart reduces to this lookup:

| r_eff | %1RM | r_eff | %1RM | r_eff | %1RM |
|---|---|---|---|---|---|
| 1 | 100 | 5.5 | 85.0 | 10 | 73.9 |
| 1.5 | 97.8 | 6 | 83.7 | 10.5 | 72.3 |
| 2 | 95.5 | 6.5 | 82.4 | 11 | 70.7 |
| 2.5 | 93.9 | 7 | 81.1 | 11.5 | 69.4 |
| 3 | 92.2 | 7.5 | 79.9 | 12 | 68.0 |
| 3.5 | 90.7 | 8 | 78.6 | 12.5 | 66.7 |
| 4 | 89.2 | 8.5 | 77.4 | 13 | 65.3 |
| 4.5 | 87.8 | 9 | 76.2 | 13.5 | 64.0 |
| 5 | 86.3 | 9.5 | 75.1 | | |

**Synthesis check:** the RPE-10 row matches Wathan within ≈0.6 points for 2–10 effective reps (e.g. 86.3 vs 85.8 at 5 reps). It diverges by 1.7–2.7 points at 11–12 reps, and Wathan gives 98.7% at 1 rep. The chart's claimed "Epley basis" does not fit at low reps (2 reps: 95.5 vs Epley 93.8).

The app can therefore use `pct(r_eff) = Wathan(r_eff)` with r_eff = 1 forced to 100%, plus an optional exact-RTS lookup. One RPE point ≈ one rep ≈ **2.3–3.3 points of %1RM** over 2–12 effective reps, so a one-rep RIR error is about a 3% error in e1RM or load [INF].

### Lifters under-call RIR by about one rep, and worse far from failure

**Headline estimate:** lifters **underpredict reps to failure by 0.95 reps** (95% CI 0.17–1.73), with I² = 97.9% [MA, 12 studies, 414 participants] ([Halperin 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/)).
- Accuracy is slightly better closer to failure (β −0.025) and in later sets (β −0.07).
- It is **much worse in sets of more than 12 reps** (β 0.47 reps per rep, vs 0.06 for ≤ 12).
- Training status had no effect (β −0.006), nor did upper vs lower body (−0.58 reps, CI −2.32 to 1.16).
- Between-person SD of accuracy was 1.45 reps.

**Error grows far from failure, at high reps and at light loads:**
- **Squat at 70% to failure (16 ± 4 reps)** in trained men: RIR error was 2.05 ± 1.73 at a called RPE 9, 3.65 ± 2.46 at RPE 7 and 5.15 ± 2.92 at RPE 5 [OBS] ([Zourdos 2021](https://pubmed.ncbi.nlm.nih.gov/30747900/)).
- Error was about 1 rep when actual RIR was 0–5 and more than 2 reps at 7–10 ([Hackett 2017](https://pubmed.ncbi.nlm.nih.gov/27787474/)).
- On machines, people underpredicted (leg press predicted 12.5 vs actual 16.4 reps). SEM shrank from 4.15–5.13 reps in an orientation group to 1.27–2.29 in experts ([Steele 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5712461)).
- Trained participants underpredicted knee-extension reps by 2.0 ([Armes 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7785525)).
- On leg press at 80%, calls of RIR 3 were accurate (0.46–0.56 reps). At 60% they were off by **4.73 ± 3.35** (young) and **7.78 ± 5.12** (older) [PREPRINT] ([Ferrari 2026](https://doi.org/10.21203/rs.3.rs-8899476/v1)).
- Haischer 2023 found first-rep velocity at 70% predicted total squat reps only with SEE 2.21 ([PMC10203840](https://pmc.ncbi.nlm.nih.gov/articles/PMC10203840)).

**Close to failure, trained lifters are accurate:**
- Bench at 75%: **absolute error 0.65 ± 0.78 reps**, equivalent across 1 vs 3 RIR, sets and sessions, with no effect of sex or experience [OBS] ([Refalo 2024](https://pubmed.ncbi.nlm.nih.gov/37967832/)).
- Machine biceps curl, pushdown and row: no effect of sex, experience or exercise; better near failure and in later sets ([Remmert 2023a](https://pubmed.ncbi.nlm.nih.gov/37036795/)).

**Experience and practice give mixed results:**
- Accuracy did **not** improve over 6 weeks in trained men, who tended to underestimate more in later sessions and higher-rep sets ([Remmert 2023b](https://pubmed.ncbi.nlm.nih.gov/37436724/)).
- Mean absolute error fell by up to 2.3 reps over 6 sessions in younger and older adults ("a trainable skill") ([Wiedenmann 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13499321)).
- Experienced and novice squatters did not differ ([Droguett 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13215226)).
- Older adults underestimated RIR 2 by 2.1 reps ([Gómez-Redondo 2025](https://pubmed.ncbi.nlm.nih.gov/40902458/)).
- Sex mattered little in one abstract-only study ([Casanova 2025](http://hdl.handle.net/10174/39787)).

**For context:** strength gains are similar across a wide range of RIR, while hypertrophy improves closer to failure ([Robinson 2024](https://pubmed.ncbi.nlm.nih.gov/38970765/)). RIR measures proximity to failure, not intensity, so the app must store load, reps and RIR separately ([Alcazar 2026 commentary](https://pubmed.ncbi.nlm.nih.gov/42303420/)). The newest synthesis of RIR accuracy factors (Russo 2025, doi:10.1080/10833196.2025.2564026) was not readable and should be checked.

**Correction policy [INF]:**
- No correction for reported RIR ≤ 2–3 on sets of ≤ 12 reps at ≥ 75% 1RM.
- Treat reported RIR ≥ 4, r_eff > 12–15 or loads ≤ 65% as **low-information**: exclude them or widen their uncertainty rather than "correcting" them.
- Start beginners with wide priors.
- Learn a per-user, per-exercise-class bias from occasional calibration sets taken to failure: an AMRAP last set, or "call RIR 3, then keep going".

### The e1RM algorithm and its error budget

No peer-reviewed study directly validates e1RM from reps + RIR against a measured 1RM. The method rests on the scale's definition and on two known error sources ([Zourdos 2016](https://pubmed.ncbi.nlm.nih.gov/26049792/); [Halperin 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/)). If users train at 3–5 RIR and the app ignores RIR, standard equations "will systematically underestimate true 1RM" [PREPRINT] ([Marzagao 2026](https://arxiv.org/pdf/2603.17495)).

No equation accounts for set order. Rep counts fall from set 2 with 1-min rest and from set 3 with 3–5-min rest [secondary], so prefer the first working set ([Marzagao 2026 review](https://arxiv.org/pdf/2603.17495)).

```text
// e1RM from one logged set  [INF; built from Zourdos 2016, Halperin 2022, Reynolds 2006, Mayhew 2008]
RIR      = reported RIR ?? (10 − RPE)        // RPE 9.5 → RIR 0.5
if RIR unknown: RIR = 2..3 (conservative prior) OR mark set non-informative
RIR_adj  = RIR + bias_user(exerciseClass, RIR)   // ≈0 if RIR ≤ 2 (trained); +0.5..1 if RIR ≥ 3; learned
r_eff    = reps + RIR_adj
pct      = (r_eff == 1) ? 1.00 : Wathan(r_eff)/100      // or RTS lookup; or Epley: 1/(1 + r_eff/30)
e1RM     = w / pct
weight   = 1.0  if RPE ≥ 8 and r_eff ≤ 8
           0.5  if RPE 7–7.5 or r_eff 9–12
           ≤0.1 / exclude if RPE ≤ 6 or r_eff > 12–15
           × downweight for sets after the first working set or after short rest
session_e1RM = weighted max (or top-set-weighted mean) per exercise
// Reverse: load = e1RM × pct(target_reps + target_RIR), rounded to the user's plate/dumbbell inventory
```

**Error budget [INF]:** formula error is about 2–4% at r_eff ≤ 6 (Reynolds' 5RM SEE was 1.8 kg on a ~63 kg bench), and a 1-rep RIR error adds about 3%. A single good set at RPE 8–9 is therefore good to roughly **±4–6% (1 SD)** for trained lifters, and worse for beginners and high reps. That is consistent with the **≈8.5–10% within-person spread** of near-failure e1RMs in 14-day windows of real app data, which also contains true daily variation [PREPRINT] ([Marzagao 2026](https://arxiv.org/pdf/2603.17495)).

**Worked example:** 4 reps @ RPE 8 → r_eff 6 → 83.7% (RTS) or 83.1% (Wathan). Half-RPE steps move load by about 1.2–1.6 points.

### e1RM tracks group change but drifts when the rep range changes

Training changes each person's reps-at-%1RM relationship, in both directions:
- **Mayhew 2008:** college women gained 7.7 ± 5.4 kg on bench. Reps at a fixed %1RM changed by only 0.6 on average, but individuals ranged from −15 to +17. The change in 1RM correlated with the change in RTF at **r = −0.55** (bigger gainers did fewer reps). Agreement between predicted and actual change ranged from ICC −0.09 to 0.95 across equations; Tucker was best (ICC 0.87). The authors caution that RTF tracking "may not be appropriate" for strength athletes ([PubMed 18714230](https://pubmed.ncbi.nlm.nih.gov/18714230/); [full text](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf)).
- **Braith 1993:** after 18 weeks of 7–10RM knee-extension training, the 7–10RM moved from 68.4% to 79.1% of 1RM, and the pre-training equation **overpredicted post-training 1RM by 21.2 kg** ([PubMed 8423746](https://pubmed.ncbi.nlm.nih.gov/8423746/)).
- **Velocity, by contrast**, reportedly stayed stable at each %1RM after a 9.3% 1RM gain [secondary] ([Marzagao 2026 review](https://arxiv.org/pdf/2603.17495)).
- Kemmler's cubic held in a trained steady state ([PubMed 17194251](https://pubmed.ncbi.nlm.nih.gov/17194251/)), and the relationship is best modelled per individual ([Mitter 2023](https://pubmed.ncbi.nlm.nih.gov/35703009/); [Richens & Cleather 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4042664)).

**Implementation [INF]:**
- Track the "strength e1RM" mainly from sets with r_eff ≤ 6–8, and show it **separately from rep PRs**.
- Learn a per-user, per-exercise correction (heavy-single e1RM ÷ high-rep formula e1RM), refreshed whenever an RPE ≥ 9 single or triple is logged.
- **Flag e1RM jumps that coincide with a change in typical rep range** (for example, switching from a hypertrophy block to a strength block) as possibly artefactual.
- Show wider bands for beginners in their first 4–8 weeks.

### A real change must beat about 2.8 typical errors

**A tested 1RM is highly reliable** [SR, 32 studies, n = 1,595] ([Grgic 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7367986)):
- Median ICC 0.97; median CV 4.2% (range 0.5–12.1%).
- Trained median CV 3.3% vs untrained 5.5%.
- Upper body 4.1% vs lower body 4.7%.
- One or more familiarisation sessions: 3.8%; none: 5.3%.
- Bland–Altman limits of agreement were about ±3–5 kg (bench), ±10–15 kg (squat) and ±8–13 kg (leg press).
- About two-thirds of analyses showed no retest bias. Where bias existed, retests were higher (median +5.5 kg lower body, +1.8 kg upper body).

**Supporting figures:**
- Trained back squat: CV 2.1%, SEM 2.9 kg, with individual trial-to-trial variation of −5.6% to +4.8% ([Banyard 2017](https://pubmed.ncbi.nlm.nih.gov/27669192/)).
- 5RM test–retest ICC 0.999 ([Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)).
- Hopkins recommends the typical error (as a CV) for monitoring individuals ([Hopkins 2000](https://pubmed.ncbi.nlm.nih.gov/10907753/)).

The minimum detectable change between two single tests is `MDC95 = 1.96·√2·TE ≈ 2.77·CV` [INF, recomputed]:

| Population | CV | MDC95 |
|---|---|---|
| Trained back squat | 2.1% | 5.8% |
| Trained median | 3.3% | 9.1% |
| Overall median | 4.2% | 11.6% |
| Untrained median | 5.5% | 15.2% |

**Smoothing and labelling rules [INF]:**
- Smooth e1RM per exercise with an EWMA or a Kalman/Bayesian local-level filter.
- Use measurement noise of about 3–5% for heavy, low-rep, high-RPE sets and about 8–10% for typical logged sets.
- Call a change "likely real" when the smoothed trend moves more than about 1 TE (≈2–4% for trained lifters) and holds for ≥ 2–3 sessions.
- Call it "very likely real" when it exceeds about 2.8 TE (6–9% trained, 11–15% novice) or its credible interval excludes zero.
- Show actual load × reps PR badges separately from e1RM changes.
- Use exercise-specific absolute noise in kg, since squat and leg press vary more than bench.

## Weekly fractional sets drive muscle growth with diminishing returns; strength levels off after a few sets

Most of this section rests on one paper. Pelland, Remmert, Robinson, Hinson & Zourdos (*Sports Med* 2026;56(2):481–505; 67 studies, 2,058 participants; Bayesian multilevel meta-regressions adjusted for duration and training status) found a 100% posterior probability that volume increases both hypertrophy and strength, with diminishing returns that are "considerably more pronounced" for strength [MA] ([PubMed 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/)).

**Verify before hard-coding:** the slopes, tiers and thresholds below come from the September 2024 full-text preprint, not the paywalled published version ([SportRxiv 460](https://sportrxiv.org/index.php/server/preprint/view/460)). A further caveat applies throughout: most trials in trained lifters measure muscle thickness by ultrasound 48–72 h after the last session, and at high volumes swelling (edema) may inflate these readings.

### About 4 sets per week is detectable, 10–20 is the default, and nothing extra is detectable beyond about 31

**Hypertrophy model:**
- Data: 35 studies, 220 effects, 1,032 participants.
- Best fit was a **square-root model** (R² marginal 22.3%, conditional 73.3%).
- At the mean of 12.25 sets, each extra fractional weekly set added **+0.24% muscle size** (95% CrI 0.15–0.33%).

**Strength model:**
- Data: 66 studies, 490 effects, 2,020 participants.
- Best fit was a **reciprocal model**: "strong diminishing returns and a functional plateau".
- Slope +0.21% per set (CrI 0.16–0.26%).

**Smallest detectable effect sizes (SDES)**, estimated from untrained control groups: **2.05% for hypertrophy** and **3.96% for strength** ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460)).

From these the authors built efficiency tiers. Each tier states how many extra sets buy one more SDES-sized gain [MA/PREPRINT-derived]:

| Hypertrophy, fractional sets/week | Tier | Extra sets per detectable (≥ 2.05%) gain |
|---|---|---|
| 4 | Minimum effective dose | — |
| 5–10 | Higher efficiency | ~6 |
| 11–18 | Intermediate | ~8.5 |
| 19–29 | Lower | ~10.75 |
| 30–42 | Lowest | ~12.5 |
| 43+ | Unclear (insufficient data, possibly less growth) | — |

| Strength, fractional sets/week | Tier |
|---|---|
| 1 | Minimum effective dose |
| 2 | Higher efficiency (~0.75 extra set per detectable gain) |
| 3–4 | Intermediate (~2.25 extra sets per detectable gain) |
| 5+ | Extra sets do not consistently exceed the 3.96% SDES |

**Point of undetectable outcome superiority (PUOS):** the volume beyond which more sets no longer produce a detectably better outcome. It is about **31 fractional sets/week for hypertrophy** and about **3 for strength** ([Remmert preprint citing Pelland](https://sportrxiv.org/index.php/server/preprint/view/537)).

**How much data sits behind each part of the curve:**
- Hypertrophy effects had a median of 10.5 sets/week (mean 13.00 ± 8.87), and "few studies have explored ~25+ 'fractional' weekly sets". The model therefore remains compatible with a plateau or an inverted U at high volumes.
- In well-trained powerlifters, 1–3 direct weekly sets were insufficient and 3–9 were sufficient. The large strength effect of the first set may partly reflect learning a novel test ([Androulakis-Korakakis 2021](https://pubmed.ncbi.nlm.nih.gov/34527944/)).

**Earlier meta-analyses point the same way:**
- Each additional weekly set added ES +0.023, about **+0.37% growth**. Higher vs lower volume gave about 3.9% more growth. The <5 / 5–9 / 10+ category comparison was only a trend (p = 0.074) [MA] ([Schoenfeld 2017](https://pubmed.ncbi.nlm.nih.gov/27433992/)).
- Strength, sets per exercise per week: ≥ 10 vs ≤ 5 gave ES 0.18 (0.06–0.30), and 5–9 vs ≤ 5 gave 0.15. Participants were mostly novices [MA] ([Ralston 2017](https://pubmed.ncbi.nlm.nih.gov/28755103/); [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5684266/)).
- In trained lifters, > 20 sets beat 12–20 only for triceps (SMD −0.50). The authors call "**12–20 weekly sets per muscle group** … an optimum standard recommendation" [MA] ([Baz-Valle 2022](https://pubmed.ncbi.nlm.nih.gov/35291645/)).
- Hypertrophy ES was 0.24 / 0.34 / 0.44 for 1 / 2–3 / 4–6 sets [MA] ([Krieger 2010](https://pubmed.ncbi.nlm.nih.gov/20300012/)).
- A network meta-analysis ranked higher-load multi-set training twice weekly top for hypertrophy (SMD 0.66) and three times weekly top for strength (SMD 1.60) [MA] ([Currier 2023](https://pubmed.ncbi.nlm.nih.gov/37414459/)).
- The **ACSM 2026 position stand** (an umbrella review of 137 systematic reviews) endorses "higher volumes (**≥ 10 sets/wk**)" for hypertrophy, and **≥ 80% 1RM, 2–3 sets and ≥ 2 sessions/wk** for strength [POS] ([PubMed 41843416](https://pubmed.ncbi.nlm.nih.gov/41843416/)).
- A composite-dosage strength analysis plateaued at about 773,000–887,000 arbitrary units, mostly in untrained people [MA] ([Lyristakis 2026](https://pubmed.ncbi.nlm.nih.gov/41995957/)).
- Older adults did best on low volume (lean mass SMD 0.25) — a different population from the app's users [MA] ([Radaelli 2025](https://pubmed.ncbi.nlm.nih.gov/39405023/)).

**Trials in trained lifters disagree on whether more than ~20 sets helps:**

Favour higher volume:
- 1 / 3 / 5 sets per exercise (6–45 weekly sets) gave greater growth with more sets, with similar 1RM [RCT-T] ([Schoenfeld 2019](https://pubmed.ncbi.nlm.nih.gov/30153194/)).
- 32 sets beat 16 for lower-body thickness, 1RM and triceps [RCT-T] ([Brigatto 2022](https://pubmed.ncbi.nlm.nih.gov/31868813/)).
- Adding 6 sets every 2 weeks from 22 quadriceps sets beat adding 4 for squat 1RM. Hypertrophy showed only a "possible small benefit" [RCT-T] ([Enes 2024](https://pubmed.ncbi.nlm.nih.gov/37796222/); design confirmed in [Enes 2026](https://pubmed.ncbi.nlm.nih.gov/42713159/)).

Show no benefit beyond moderate volume:
- 12 / 18 / 24 lower-body sets gave 7.7% / 6.7% / 6.1% thigh growth (no difference), and squat trended toward favouring 18 sets [RCT-T] ([Aube 2022](https://pubmed.ncbi.nlm.nih.gov/32058362/)).
- 9 / 18 / 27 biceps sets gave +4.3% / +9.5% / +5.4% [RCT-T] ([Heaselgrave 2019](https://pubmed.ncbi.nlm.nih.gov/30160627/)).
- Raising previous volume by 30% or 60% added no growth, and maintaining volume gave the best 1RM [RCT-T] ([Barsuhn 2025](https://pubmed.ncbi.nlm.nih.gov/39665246/)).

**Policy [INF]:**
- 4 fractional sets/muscle/week is the floor.
- **10–20** is the default band.
- 20–30 is an "advanced/specialisation" band.
- Soft warning above about 30 ("no detectable superiority"); hard warning above about 40 ("no data").
- Treat anything above 20 as an individual experiment.
- In the UI, show diminishing marginal value using a square-root curve.

### Count synergist sets as half

Pelland compared three ways of counting sets. "Fractional" counts the primary mover as 1.0 and a meaningful synergist as 0.5. "Total" counts every set as 1.0. "Direct" ignores indirect sets. Fractional counting fit better than both alternatives on every outcome, measured as 2 × log Bayes factor [MA] ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460); [PubMed 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/)):

| Outcome | Fractional vs total | Fractional vs direct |
|---|---|---|
| Hypertrophy, volume | 9.48 | 10.29 |
| Strength, volume | 18.21 | 45.96 |
| Hypertrophy, frequency | 9.96 | 10.82 |
| Strength, frequency | 31.27 | 54.84 |

Worked examples:
- 5 sets of curls + 5 sets of rows = 10 / **7.5** / 5 biceps sets (total / fractional / direct).
- For strength, 5 squat + 5 squat + 5 leg press = 15 / 12.5 / 10 squat sets.

**Pelland's coding of direct and indirect sets:**
- Quadriceps: direct for squats, leg press, lunges, hack squat and leg extension.
- Rectus femoris: direct only from leg extension; squats and leg press are indirect.
- **Hamstrings: direct only from leg curls; squats and leg press were not credited.**
- Pecs: direct from bench and flyes.
- Anterior delts: direct from shoulder press; indirect from bench.
- Triceps: indirect from all pressing.
- Biceps: indirect from pulldowns and rows.
- Traps: indirect from pulldowns and rows.

The authors call the 0.5 weight an assumption and the coding "not wholly objective". A per-session preprint found fractional counting fits hypertrophy best but direct counting fits strength best, with indirect sets worth "likely < 50%" for strength [PREPRINT] ([Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537)). RP's landmarks count **direct sets only**; for example, its triceps maximum recoverable volume (MRV) of 18 sets assumes pressing is "already factored in" [PRACT] ([RP 2017](https://rpstrength.com/training-volume-landmarks-muscle-growth/)).

**Data model [INF]:**
- Store `exercise → muscle → coefficient` as data (1.0 / 0.5 / 0), with user overrides.
- Display both "fractional sets" (default) and "direct sets": RP heuristics must be compared with direct counts, and Pelland tiers with fractional counts.
- For powerlift strength volume, count only the lift and close variants as direct, and other exercises at ≤ 0.5.
- The full mapping table is in the session-design section.

### Frequency matters for strength, not for growth

**Hypertrophy:** with volume equated, frequency has little independent effect.
- Early meta-analysis: twice weekly beat once weekly (ES 0.49 vs 0.30) [MA] ([Schoenfeld 2016](https://pubmed.ncbi.nlm.nih.gov/27102172/)).
- With 25 studies, volume-equated frequency made no significant difference: "individuals can choose a weekly frequency per muscle group based on personal preference" [MA] ([Schoenfeld 2019](https://pubmed.ncbi.nlm.nih.gov/30558493/)).
- Pelland: +0.32% per session (CrI −0.14 to 0.82%), i.e. "small and … not consistently identifiable".
- A 2026 preprint (16 trials) found g = −0.06 (−0.24 to 0.13), with low-to-very-low GRADE certainty [PREPRINT] ([Boutagy & McKean 2026](https://doi.org/10.64898/2026.10.07.26365015)).
- Two trained-lifter RCTs favoured higher frequency for growth but not strength: total-body 3×/week vs a split ([Schoenfeld 2015](https://pubmed.ncbi.nlm.nih.gov/25932981/)), and 5× vs 1×/week ([Zaroni 2019](https://pubmed.ncbi.nlm.nih.gov/31260419/)).
- In people with training experience, more sessions were associated with more growth ([Lopez 2021](https://pubmed.ncbi.nlm.nih.gov/33433148/)).

**Strength:** frequency has a real, independent effect.
- Pelland: **+3.27% per session** (CrI 2.74–3.84%). Control-adjusted gains were 12.72% at 1 session/week and 17.32% at 2, with "accelerating diminishing returns" after that. The mean volume in these studies was low (8.14 ± 6.23 sets) ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460)).
- The PUOS for strength is about 3 sessions per week ([Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537)).
- Grgic 2018 found ES 0.74 / 0.82 / 0.93 / 1.08 for 1 / 2 / 3 / 4+ sessions, but no frequency effect once volume was equated. Benefits were larger for multi-joint, upper-body and female outcomes [MA] ([Grgic 2018](https://pubmed.ncbi.nlm.nih.gov/29470825/)).
- In trained powerlifters, 3 vs 6 sessions/week (volume-equated) produced identical gains [RCT-T] ([Colquhoun 2018](https://pubmed.ncbi.nlm.nih.gov/29324578/)):

| Outcome | 3×/week | 6×/week |
|---|---|---|
| Squat 1RM | +16.8 kg | +16.7 kg |
| Bench 1RM | +7.8 kg | +8.8 kg |
| Deadlift 1RM | +19 kg | +21 kg |
| Total | +43.6 kg | +46.5 kg |

**Defaults [INF]:** each muscle ≥ 2 sessions/week, as a way to distribute volume. Each competition lift or close variant 2–3 sessions/week. For strength-only goals, prefer adding a session over adding sets once a session already has about 2–4 heavy sets.

### Per-session returns flatten near 11 fractional sets per muscle

The only per-session dose–response analysis is a **preprint** with no peer-reviewed version as of November 2026 [PREPRINT] ([Remmert et al. 2025](https://sportrxiv.org/index.php/server/preprint/view/537)):
- Hypertrophy: linear-log fit, +0.393% per fractional set per session (CrI 0.202–0.583%).
- Strength: reciprocal fit, +1.23% per direct set per session (0.941–1.52%).
- Neither rest interval nor proximity to failure changed the curve.
- The dataset's mean per-session volume was 5.95 ± 4.49 fractional sets.
- The authors stress the PUOS values below "are not upper limits": more sets still add gains, just not detectably.

| Outcome (per session) | Total sets | Direct sets | Fractional sets |
|---|---|---|---|
| Hypertrophy, per muscle | ≈13.8 | ≈8.2 | ≈11 |
| Strength, per lift | ≈5.0 | ≈2 | ≈3.5 |

Earlier signals:
- Krieger's unpublished 2017 analysis suggested about 6–8 sets per muscle per session.
- Splitting 10.5 weekly biceps sets as 3.5 × 3 sessions gave +6.5% growth vs +4.4% for 4.5 + 6 over two sessions (β 1.41, p = 0.012) ([Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537)).

**Policy [INF]:** a soft cap of about 8–10 direct or ~11 fractional sets per muscle per session. Above that, the planner should suggest another session. **Never present "junk volume" as fact.** No reviewed evidence shows harm from extra sets at the volumes studied; the harm claims came from the retracted Barbalho trials.

### Minimum and maintenance doses are small if intensity stays high

**Minimum doses:**
- In trained men, **one hard set of 6–12 reps at ~70–85% 1RM, 2–3×/week** raised 1RM by +12.09 kg overall (squat +17.48, bench +8.25 kg) — "suboptimal, yet significant" [MA] ([Androulakis-Korakakis 2020](https://pubmed.ncbi.nlm.nih.gov/31797219/)).
- For powerlifters, a mixed-methods paper (interviews, two interventions, survey) proposes a minimum of "**~3–6 working sets of 1–5 repetitions each week … across 1–3 sessions per week per powerlift, using loads above 80% 1RM at RPE 7.5–9.5**". Single top sets alone are "less likely to be meaningful"; adding 2–3 back-off sets at about 80% of the single's load helps; accessories 1–3 per lift at RPE 7–9 for 6–10 reps [DELPHI/SURVEY + small trials] ([Androulakis-Korakakis 2021](https://pubmed.ncbi.nlm.nih.gov/34527944/)).
- A daily-max pilot produced individual totals ranging from +4.8% to −5% ([AK 2018](https://pubmed.ncbi.nlm.nih.gov/30158433/)).
- Iversen recommends at least **4 weekly sets per muscle at 6–15RM**; 15–40 reps work if taken to failure [NARR] ([Iversen 2021](https://pubmed.ncbi.nlm.nih.gov/34125411/)).
- One set of 9 exercises twice weekly worked even for lifters coming off higher-volume programs [RCT-T] ([Hermann 2025](https://pubmed.ncbi.nlm.nih.gov/40249908/)).
- One set per exercise matched 3–5 sets for strength ([Schoenfeld 2019](https://pubmed.ncbi.nlm.nih.gov/30153194/)).

**Maintenance:**
- After 16 weeks of training, doses of one-third or one-ninth preserved hypertrophy in 20–35-year-olds (not in 60–75-year-olds) for 32 weeks [RCT] ([Bickel 2011](https://pubmed.ncbi.nlm.nih.gov/21131862/)).
- Younger adults can maintain for up to 32 weeks with as little as **1 session and 1 set per exercise per week if relative load is kept**. "Exercise intensity seems to be the key variable" [NARR] ([Spiering 2021](https://pubmed.ncbi.nlm.nih.gov/33629972/)).
- RP's maintenance volume (MV) is about 6 direct sets/week at ≥ 2 sessions [PRACT] ([RP 2017](https://rpstrength.com/training-volume-landmarks-muscle-growth/)).

**Modes [INF]:**
- "Minimum" mode: 4–6 sets per muscle at 0–2 RIR; 3–6 heavy sets per lift.
- "Maintenance" mode: about one-third of normal volume, keeping load and effort.

### Any load from about 30% to 85% 1RM builds muscle; strength needs ≥ 80%

**Hypertrophy is similar across a wide load range, provided sets go to or near failure:**
- High vs low load to failure: hypertrophy similar, 1RM better with heavy loads [MA] ([Schoenfeld 2017](https://pubmed.ncbi.nlm.nih.gov/28834797/)).
- Network meta-analysis: no hypertrophy differences. For strength vs low load (> 15RM), **high load (≤ 8RM) SMD 0.60–0.63** and moderate (9–15RM) 0.34–0.35 [MA] ([Lopez 2021](https://pubmed.ncbi.nlm.nih.gov/33433148/)).
- With volume load matched, hypertrophy did not differ by load, and 1RM ranked high > moderate > low [MA] ([Carvalho 2022](https://pubmed.ncbi.nlm.nih.gov/35015560/)).
- Higher-load prescriptions (> 80% 1RM) maximised strength [MA] ([Currier 2023](https://pubmed.ncbi.nlm.nih.gov/37414459/)).
- Supporting trials in trained lifters:
  - 30–50% vs 75–90% loads gave similar lean mass and fibre CSA, except bench 1RM (+9 vs +14 kg) ([Morton 2016](https://pubmed.ncbi.nlm.nih.gov/27174923/)).
  - 25–35 vs 8–12 reps gave similar growth, but squat 1RM rose +8.8% vs +19.6% ([Schoenfeld 2015](https://pubmed.ncbi.nlm.nih.gov/25853914/)).
  - 3 × 10RM vs 7 × 3RM gave similar biceps growth, with bench favouring 3RM ([Schoenfeld 2014](https://pubmed.ncbi.nlm.nih.gov/24714538/)).
  - 4 × 3–5 at ~90% beat 4 × 10–12 at ~70% for bench (14.8% vs 6.9%) and lean arm mass ([Mangine 2015](https://pubmed.ncbi.nlm.nih.gov/26272733/)).
  - Gains can be "optimized across a wide spectrum of loading zones" ([Schoenfeld 2021](https://pubmed.ncbi.nlm.nih.gov/33671664/)).

**The lower bound** comes from Lasevicius 2018 [RCT-U, volume matched to the 20% condition]. 20% 1RM gave about half the growth of 40–80% ([PubMed 29564973](https://pubmed.ncbi.nlm.nih.gov/29564973/)):

| Load | Vastus lateralis CSA | Elbow flexor CSA |
|---|---|---|
| 20% 1RM | +8.9% | +11.4% |
| 40% | +20.5% | +25.3% |
| 60% | +20.4% | +25.1% |
| 80% | +19.5% | +25.0% |

**Defaults [INF]:**
- Hypertrophy: allow about 5–30 reps; default 6–15 for compounds and 8–20 for isolation.
- Count sets above 20 reps as "hard" only at ≤ 2 RIR (all low-load meta-analyses required failure).
- Flag loads below about 30% 1RM.
- Strength: main work at ≥ 80% 1RM (about 1–6 reps), with accessories at 6–12 reps.

### Proximity to failure improves growth, leaves strength flat and steeply raises fatigue

**Hypertrophy gains with closeness to failure:**
- Across volume-equated studies, with RIR estimated from study descriptions [MA] ([Robinson 2024](https://pubmed.ncbi.nlm.nih.gov/38970765/)):
  - Strength slope was negligible: SMD β = 0.003 per RIR (−0.012 to 0.018); response ratio −0.059% per RIR.
  - Hypertrophy slope was negative: **−0.48% muscle size per extra RIR** (95% CI −0.78 to −0.179).
  - These numbers come from the preprint version ([SportRxiv 295](https://sportrxiv.org/index.php/server/preprint/view/295)); verify against the final paper.
  - The authors warn that failure's advantage may shrink if more RIR allows more weekly sets.
- Failure vs non-failure overall was trivial (ES 0.19, 0.00–0.37). Momentary failure was 0.12, not significant [MA] ([Refalo 2023](https://pubmed.ncbi.nlm.nih.gov/36334240/)).
- In trained subgroups, failure helped hypertrophy (ES 0.15). Where volume was not equated, non-failure was better for strength (ES −0.32) [MA] ([Grgic 2022](https://pubmed.ncbi.nlm.nih.gov/33497853/)).
- Failure helped hypertrophy only when volume was not equated [MA] ([Vieira 2021](https://pubmed.ncbi.nlm.nih.gov/33555822/)).
- Direct trials:
  - Non-failure vs failure at 85% gave no difference ([Sampson & Groeller 2016](https://pubmed.ncbi.nlm.nih.gov/25809472/)).
  - Quadriceps growth was +0.181 cm (failure) vs +0.182 cm (1–2 RIR) [RCT-T] ([Refalo 2024](https://pubmed.ncbi.nlm.nih.gov/38393985/)).
  - Hypertrophy "tended to favor FAIL" with single sets [RCT-T] ([Hermann 2025](https://pubmed.ncbi.nlm.nih.gov/40249908/)).
  - Preacher curls gave similar adaptations ([Vasconcelos 2026](https://pubmed.ncbi.nlm.nih.gov/42784046/)).

**Velocity-loss data say the same:**
- Higher velocity loss slightly increases growth (b = 0.006 per % velocity loss) without improving strength [MA] ([Jukic 2023](https://pubmed.ncbi.nlm.nih.gov/36178597/)).
- 40% vs 20% velocity loss gave more hypertrophy but lost type IIX fibres and jump performance ([Pareja-Blanco 2017](https://pubmed.ncbi.nlm.nih.gov/27038416/)).

**Fatigue cost is steep:**
- Failure slowed recovery by **24–48 h** ([Morán-Navarro 2017](https://pubmed.ncbi.nlm.nih.gov/28965198/)).
- Fatigue rose as sets approached failure, squats were more fatiguing than rows, and 65% was more fatiguing than 85% ([Cowley 2026](https://pubmed.ncbi.nlm.nih.gov/42458937/)).
- Failure "may exacerbate neuromuscular fatigue, muscle damage, and post-set perceived discomfort" ([Refalo 2022](https://pubmed.ncbi.nlm.nih.gov/35658845/)).
- ACSM 2026: training to failure "did not consistently impact training outcomes" ([ACSM 2026](https://pubmed.ncbi.nlm.nih.gov/41843416/)).
- Self-reported RIR is under-called by about one rep ([Halperin 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/)). Velocity stops or RIR are preferred over percentages ([Pelland 2022](https://pubmed.ncbi.nlm.nih.gov/35247203/)).

**Defaults [INF]:**
- Hypertrophy: 1–2 RIR on most sets. Allow 0 RIR on the last set of isolation or machine work. Discourage failure on heavy free-weight compounds.
- Sets ending above about 4 RIR count as reduced-stimulus sets.
- Strength: RPE 6–9 (1–4 RIR) on competition lifts, occasional heavy singles at RPE 8–9.5, and no failure.
- When users trade effort for volume, prefer more sets at 1–2 RIR.

### RP volume landmarks are heuristics that sit inside the evidence bands

RP defines four landmarks [PRACT]: maintenance volume (MV) as "the minimum training needed to preserve your current muscle mass"; minimum effective volume (MEV) as "the lowest amount of training that actually grows muscle"; maximum adaptive volume (MAV) as "the range where you make your best gains"; and MRV as the limit beyond which training "prevents adequate recovery". RP cites no studies and calls the numbers "starting points, not gospel". Its mesocycle progression goes from MEV toward MRV and then a deload, with MEV scored from pump, challenge and soreness ([RP 2017](https://rpstrength.com/training-volume-landmarks-muscle-growth/)).

The per-muscle table below is **second-hand and possibly outdated** [PRACT] ([repost](https://davidroesener.blogspot.com/2020/05/rp-hypertrophy.html); variant values in a [community sheet](https://docs.google.com/spreadsheets/d/1Dc0oZnkxcFVZ6Cl8whOs2O1AiXNKSkhRCRJmJ103_QA/edit)):

| Muscle | MV | MEV | MAV | MRV | Freq/wk |
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

How the landmarks compare with the evidence:
- RP's MAV (about 12–20) matches Baz-Valle's 12–20 and Pelland's efficient tiers.
- RP's MEV (8–10 direct) is higher than the meta-analytic minimum of 4 fractional sets.
- RP's MRV (about 20–26) sits below the 30–52 sets some trained lifters benefited from ([Schoenfeld 2019](https://pubmed.ncbi.nlm.nih.gov/30153194/); [Brigatto 2022](https://pubmed.ncbi.nlm.nih.gov/31868813/); [Enes 2024](https://pubmed.ncbi.nlm.nih.gov/37796222/)). It sits above the 9–18 sets beyond which others found nothing extra ([Aube 2022](https://pubmed.ncbi.nlm.nih.gov/32058362/); [Heaselgrave 2019](https://pubmed.ncbi.nlm.nih.gov/30160627/); [Barsuhn 2025](https://pubmed.ncbi.nlm.nih.gov/39665246/)).

**Display rule [INF]:** label the landmarks "coaching heuristics (RP), not research-derived". Compare them with direct sets, and treat MRV as a per-user parameter learned from performance and recovery.

### Individual response dwarfs program effects

How widely individuals vary:
- Untrained responses ranged from **−2% to +59%** in size and **0 to +250%** in 1RM ([Hubal 2005](https://pubmed.ncbi.nlm.nih.gov/15947721/)).
- Size changed +4.8 ± 6.1% (range −11 to +30%) and strength +21.1 ± 11.5%, with age and sex having no effect ([Ahtiainen 2016](https://pubmed.ncbi.nlm.nih.gov/26767377/)).
- In trained men, "between-subject variability was **40-fold** greater than the variability promoted by extrinsic manipulation of RT variables" [RCT-T, within-subject] ([Damas 2019 JAP](https://pubmed.ncbi.nlm.nih.gov/31268828/)).
- 31.6% grew more with high frequency and 36.8% with low ([Damas 2019 JSCR](https://pubmed.ncbi.nlm.nih.gov/30289872/)).
- 13 of 34 people clearly benefited from 3 vs 1 sets (CSA +5.2% vs +3.7%), linked to early ribosome accumulation [RCT-U] ([Hammarström 2020](https://pubmed.ncbi.nlm.nih.gov/31813190/)).

Some apparent "non-response" is just measurement error. Responders should be classified against control-group error ([Dankel & Loenneke 2020](https://pubmed.ncbi.nlm.nih.gov/31254258/)).

The two trials on individualising volume partly conflict:
- Setting volume at **1.2× the person's logged weekly sets** beat a standard 22 sets for vastus lateralis growth (ES 0.75) [RCT-T, n = 16] ([Scarpelli 2022](https://pubmed.ncbi.nlm.nih.gov/32108724/)).
- Raising volume by 30–60% gave nothing extra ([Barsuhn 2025](https://pubmed.ncbi.nlm.nih.gov/39665246/)).
- Meta-analytic averages remain "the best estimate" without N-of-1 data ([Robinson preprint](https://sportrxiv.org/index.php/server/preprint/view/295)).

**Policy [INF]:**
- Start each user at their recent logged volume, or up to 1.2× it, never +30–60%.
- Require several weeks of trend data before concluding that more volume "worked". Measurement noise is about 2% for size and 4% for strength.
- Never label a user a "non-responder".

## How the app progresses load matters more than which periodization label it uses

### Periodization adds a small strength edge and no hypertrophy edge

When volume is equated, periodized training beats non-periodized training for 1RM:
- **ES 0.31 (95% CI 0.04–0.57)** [MA, 35 studies] ([Moesgaard 2022](https://pubmed.ncbi.nlm.nih.gov/35044672/); [Europe PMC](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:35044672&resultType=core&format=json); [Copenhagen release](https://nexs.ku.dk/english/news/2022/varied-strength-training-programmes-increase-strength-but-not-muscle-mass/)).
- ES 0.43 (0.27–0.58), with a larger benefit in **untrained** people (β = −0.59) [MA] ([Williams 2017](https://pubmed.ncbi.nlm.nih.gov/28497285/); disputed in [Nunes 2018](https://pubmed.ncbi.nlm.nih.gov/29178086/)).
- The older overall ES of 0.84 shrinks to 0.25 once volume, frequency and intensity are controlled [MA] ([Rhea & Alderman 2004](https://pubmed.ncbi.nlm.nih.gov/15673040/)).

Periodization gives **no hypertrophy** benefit (ES 0.13, −0.10 to 0.36) ([Moesgaard 2022](https://pubmed.ncbi.nlm.nih.gov/35044672/)).

Undulating vs linear periodization:
- For strength, undulating beat linear: ES 0.31 overall, and **ES 0.61 (0.00–1.22) in trained lifters**, while untrained lifters showed no difference (ES 0.06) ([Moesgaard 2022](https://pubmed.ncbi.nlm.nih.gov/35044672/)).
- An earlier meta-analysis found no linear-vs-undulating strength difference ([Harries 2015](https://pubmed.ncbi.nlm.nih.gov/25268290/)).
- Hypertrophy was identical (d = −0.02) [MA] ([Grgic 2017](https://pubmed.ncbi.nlm.nih.gov/28848690/)).
- A mini-review agrees: periodization helps strength, while for hypertrophy linear ≈ undulating [NARR] ([Evans 2019](https://pubmed.ncbi.nlm.nih.gov/30728780/)).
- An early RCT favoured daily undulating periodization (DUP) ([Rhea 2002](https://pubmed.ncbi.nlm.nih.gov/11991778/)).

Block periodization has only small trials in non-powerlifters. Block training gave more upper-body power ([Bartolomei 2014](https://cris.iucc.ac.il/en/publications/a-comparison-of-traditional-and-block-periodized-strength-trainin/)) and larger bench gains than weekly undulation ([Bartolomei 2016](https://hrcak.srce.hr/160744)).

In practice, 364 raw powerlifters peak volume **5–8 weeks** before a meet and intensity about **2 weeks** before [DELPHI/SURVEY] ([Travis 2021](https://pubmed.ncbi.nlm.nih.gov/34846328/)).

**Templates [INF]:**
- Offer linear, DUP/WUP and block as user choices; do not hard-code one "best" model.
- Hypertrophy users: any model.
- Powerlifters: accumulation → intensification → peak/taper blocks, with heavy/moderate/light undulation within each week.
- Mesocycles of 3–6 weeks plus a deload are standard practice but have not been tested against alternatives.

### Progression rules: double progression, RPE-based loading, APRE

**ACSM 2009** sets the only formal increment rule: **increase load 2–10% when the lifter completes the current load for 1–2 reps above target** [POS]. ACSM's level guidance:
- Novices: 8–12RM.
- Intermediates (about 6 months of training): 1–12RM, periodized.
- Frequency: 2–3 days/week for novices, 3–4 for intermediates, 4–5 for advanced lifters.
- Sources: [PubMed 19204579](https://pubmed.ncbi.nlm.nih.gov/19204579/); same 2–10% rule in the [2002 stand](https://pubmed.ncbi.nlm.nih.gov/11828249/).

**Adding reps vs adding load** works about equally well [RCT-T, n = 43] ([Plotkin 2022](https://pubmed.ncbi.nlm.nih.gov/36199287/)):
- Rectus femoris growth slightly favoured adding reps (+2.8 mm, 90% CI −0.5 to 5.8).
- Smith-squat 1RM slightly favoured adding load (+2.0 kg, −2.4 to 7.8).

**RPE/RIR autoregulation** is at least as good as fixed loading:
- RPE vs %1RM in trained men: squat +17.1 vs +13.9 kg (ES 0.50 favouring RPE); bench +10.7 vs +9.6 kg; similar muscle thickness [RCT-T] ([Helms 2018](https://pubmed.ncbi.nlm.nih.gov/29628895/)).
- RIR-autoregulated squats beat fixed loading: front squat +11.7% vs +8.3%, back squat +10.8% vs +7.1% [RCT-T] ([Graham & Cleather 2021](https://pubmed.ncbi.nlm.nih.gov/31009432/); [repository](https://research.stmarys.ac.uk/3067)).
- Autoregulation beat fixed loading in athletes, ES **0.64**, I² 0%; ES 0.87 at ≤ 8 weeks; APRE ES 0.78 [MA, 8 studies] ([Zhang 2021](https://pubmed.ncbi.nlm.nih.gov/33776802/)).
- All 14 autoregulation protocols increased 1RM [SR] ([Larsen 2021](https://pubmed.ncbi.nlm.nih.gov/33520457/)).
- **Autoregulated and standardized loading were similar** [MA, 15 studies] ([Hickmott 2022](https://pubmed.ncbi.nlm.nih.gov/35038063/)).

**APRE** (autoregulatory progressive resistance exercise) beat linear periodization in a 6-week trial in football players: bench +93.4 vs −0.4, with units garbled as N in the abstract [RCT-T, small] ([Mann 2010](https://pubmed.ncbi.nlm.nih.gov/20543732/)). The 6RM protocol below is tabulated in [Huang 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10414022/table/table-2); see also [Training & Conditioning](https://training-conditioning.com/article/understanding-apre-part-1/). Secondary sources differ slightly; one gives +5–7.5 kg for ≥ 13 reps. 3RM and 10RM variants exist, but the original tables were not retrieved.

| APRE-6 step | Prescription |
|---|---|
| Set 1 | 10 reps at 50% of 6RM |
| Set 2 | 6 reps at 75% of 6RM |
| Set 3 | AMRAP at the 6RM load |
| Set 4 and next session's 6RM, from set-3 reps | 0–2 → −2.5 to −5 kg; 3–4 → 0 to −2.5 kg; 5–7 → no change; 8–12 → +2.5 to +5 kg; ≥ 13 → +5 to +10 kg |

**Progression engine [INF]:**
1. **Double progression** (default for accessories and hypertrophy work): prescribe a rep range at a target RIR. When all sets reach the top of the range at or above the target RIR, add the smallest available increment and reset to the bottom of the range.
2. **RPE-based loading** (default for main lifts, intermediate and above): load = e1RM × pct(reps + RIR), updating e1RM from each top set.
3. **APRE** as a preset.
4. **Fixed-% linear progression** for beginners, with a stall rule: two failed sessions → reduce 5–10% and rebuild. This reset is an untested [PRACT] convention.

**Increment sizing [INF]:**
- Novices: about +2.5–5 kg per session on lower-body compounds and +1–2.5 kg on upper-body lifts.
- Intermediates: about +1–2.5% per week.
- Advanced: progress through reps, sets and RPE, with load jumps every 2–4 weeks.
- Support micro-plates (0.25–0.5 kg per side) and the user's own plate inventory.

The rationale for shrinking increments: elite strength rises only about 0.42% per session, and 0.9% / 1.8% / 1.3% per week at 2 / 3 / 4 sessions per week [SR] ([McMaster 2013](https://pubmed.ncbi.nlm.nih.gov/23529287/)). An advanced powerlifter whose total grows about 1 kg/week cannot sustain +2.5 kg/week on every lift. The engine should detect prescriptions that outrun the observed e1RM slope and switch to rep- or RPE-based progression.

### Velocity-based training works for daily loading, not 1RM prediction, and is unvalidated on Android

**Load–velocity relationship.** Mean concentric velocity tracks %1RM tightly and is stable within a person:
- Bench mean propulsive velocity vs %1RM: **R² = 0.98**. Mean velocity at 1RM was 0.16 ± 0.04 m/s, and velocities stayed stable after a 9.3% 1RM gain [OBS] ([González-Badillo 2010](https://pubmed.ncbi.nlm.nih.gov/20180176/)).
- Smith-machine full squat: R² = 0.96, MV at 1RM 0.32 ± 0.03 m/s [OBS] ([Sánchez-Medina 2017](https://www.thieme-connect.de/products/ejournals/pdf/10.1055/s-0043-102933.pdf)).
- **Do not hard-code the squat equation.** A response letter restates it as `%1RM = 7.5786·MV² − 75.865·MV + 113.02` ([PMC6260059](https://pmc.ncbi.nlm.nih.gov/articles/PMC6260059)). A synthesis check found it returns **≈89.5% at the reported 0.32 m/s 1RM velocity and reaches 100% only at ≈0.17 m/s**. The transcription or the velocity metric is probably wrong.

**Minimum velocity thresholds (MVTs).** In powerlifters lifting free weights, average concentric velocity at 1RM was **squat 0.23 ± 0.05, bench 0.10 ± 0.04, deadlift 0.14 ± 0.05 m/s**. Velocity correlated with RPE at r = −0.79 to −0.87 [OBS] ([Helms 2017](https://pubmed.ncbi.nlm.nih.gov/27243918/)).

**Velocity at 1RM is too variable to predict 1RM.** It was 0.24 ± 0.06 m/s but **unreliable (ICC 0.42, CV 22.5%)**. The best load–velocity prediction erred by −5.5% to +27.8%, versus −5.6% to +4.8% for simply retesting 1RM [OBS] ([Banyard 2017](https://pubmed.ncbi.nlm.nih.gov/27669192/)).

**Velocity at a given RIR is load-independent**:
- Similar velocities at 2, 4, 6 and 8 RIR across loads (CV 4.4–8.0%), regardless of training level ([Morán-Navarro 2019](https://pubmed.ncbi.nlm.nih.gov/29944141/)).
- Individual RIR–velocity models predicted RIR within 2 reps in a later session; general models did not ([Jukic 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10901726)).

**Velocity loss (VL) within a set:**
- VL tracks lactate (r = 0.93–0.97) and countermovement-jump loss, and bench shows more VL than squat at comparable effort ([Sánchez-Medina 2011](https://pubmed.ncbi.nlm.nih.gov/21311352/)).
- VL20 vs VL40: equal strength gains, better jump with VL20 (+9.5% vs +3.5%) on **40% fewer reps**; more hypertrophy with VL40, but loss of type IIX fibres ([Pareja-Blanco 2017](https://pubmed.ncbi.nlm.nih.gov/27038416/)).
- VL0 / VL10 / VL20 / VL40 gave similar strength. Hypertrophy occurred only at VL20 and VL40, and VL40 impaired early rate of force development ([Pareja-Blanco 2020](https://pubmed.ncbi.nlm.nih.gov/32049887/)).
- VL did not affect strength or endurance gains. Per 1% VL: hypertrophy b = +0.006, CMJ b = −0.040, submaximal velocity b = −0.018. **In the squat, 20% VL ≈ 50% of possible reps**, and 40–50% VL ≈ failure [MA] ([Jukic 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9807551); [Springer](https://link.springer.com/10.1007/s40279-022-01754-4)).
- The VL dose–response for strength is an inverted U, with **20–30% possibly optimal** [MA] ([Zhang 2023](https://pubmed.ncbi.nlm.nih.gov/36766912/)).
- VL ≤ 25% is better for strength when sets are equated; > 25% is better for hypertrophy but no better than 20–25% ([Hickmott 2022](https://pubmed.ncbi.nlm.nih.gov/35038063/)).

**Phone-camera VBT apps.** Against Vicon motion capture in 20 powerlifters, **on an iPhone SE 2022 only** [OBS] ([Renner 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11575817)):
- **Qwik VBT** had RMSE 0.01–0.04 m/s and missed no reps.
- **Metric VBT** had RMSE up to 0.14 m/s, missed 52 reps and recorded 16 ghost reps.
- **MyLift** missed 175 reps.
- These results hold only for the tested app versions under ideal tripod and lighting conditions.

Elsewhere, Metric detected more than 95% of reps but showed poor-to-moderate agreement on velocity, and is iOS-only ([PeerJ 17789](https://peerj.com/articles/17789)). PowerLift (iOS) was reported valid ([Balsalobre-Fernández 2017](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5581394/)). A review of six apps found validity below that of dedicated devices ([AUT repository](https://openrepository.aut.ac.nz/bitstreams/c29c52ac-01ca-46cf-a7b5-df6e6661f9f6/download)). Linear position transducers are the most accurate and reliable device class [SR] ([Weakley 2021](https://doi.org/10.1007/s40279-020-01382-w)).

**No Android or Galaxy S22 camera-VBT validation exists.**

**VBT policy [INF]:**
- Use MVT priors as above, then learn per-user values.
- Use the load–velocity profile for **daily load adjustment at 60–85% 1RM only, never for 1RM prediction**.
- Readiness: if the warm-up velocity at a fixed load drops by more than 0.05–0.06 m/s, or more than 1 SD of the user's history, reduce the top set by 2.5–5%. Allow +2.5% when velocity rises by a similar margin.
- VL presets: powerlifting/peaking 10–20%; general strength 20–30%; hypertrophy 25–40% (or 20–25% with extra sets). Store VL per exercise.
- Treat in-app camera velocity on the S22 as approximate (error likely ≥ 0.03–0.05 m/s). Require a side-on tripod, plate-diameter calibration and good light. Prefer relative VL over absolute MVT.
- **Never auto-stop sets on absolute MVT for bench or deadlift.** A 0.03 m/s error against a 0.10 m/s threshold is about a 30% error.
- Offer Bluetooth linear-transducer or IMU import as the high-accuracy path.

### Deloads every ~5–6 weeks are common practice, not proven physiology

**Delphi consensus** [DELPHI/SURVEY; 34 → 21 coaches, ~81% powerlifting, ≥ 70% threshold] ([Bell 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/); [Europe PMC full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10511399/fullTextXML)):
- Proposed definition: "a period of reduced training stress designed to mitigate physiological and psychological fatigue, promote recovery, and enhance preparedness for subsequent training".
- Items with consensus:
  - Deloads could be included in each mesocycle (100%), with frequency depending on the athlete's response (100%).
  - Volume falls via fewer sets (100%), fewer reps (100%), fewer training days (100%) and fewer exercises (95%).
  - Proximity to failure is reduced (100%).
  - Intensity "could remain the same, but volume may drop" (95.2%).
  - Exercise selection stays the same (100%), multi-joint lifts are kept (100%) and assistance work is removed (85.7%).
  - Planned, autoregulated and combined scheduling were all endorsed (100%).
  - 84.6% disagreed with sex-specific deloads.
- There was **no consensus on duration**.
- Coach interviews supply the background ([Bell 2022](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9811819/)).

**Athlete survey** [DELPHI/SURVEY; 246 athletes, 63% powerlifters] ([Rogerson 2024](https://www.pubmed.gov/38499934/); [Europe PMC full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10948666/fullTextXML)):
- Athletes deload **every 5.6 ± 2.3 weeks for 6.4 ± 1.7 days** (powerlifters 5.5 weeks / 6.5 days; physique about 5.8 weeks / 6.3 days).
- Scheduling: 47.2% pre-plan, 39.4% plan and react, 13.4% react only.
- Changes made: weekly sets cut by 78.9%; multi-joint load cut by 83.7% and effort by 84.9%; session frequency unchanged for 63.0%; exercise selection unchanged for about 64–70%.
- **No magnitudes of reduction were reported.**

**The only RCT** tested complete cessation for one week in a program of 5 sets of 8–12RM to failure (~90 sets/week). Hypertrophy did not differ. Strength trended toward continuous training: Smith squat −3.6 kg (CrI −10.4 to 3.2, P = 0.85) and knee-extension isometric strength −14.4 N·m (P = 0.92). The deload group reported more soreness on return. The study was funded by Renaissance Periodization [RCT-T] ([Coleman 2024](https://pubmed.ncbi.nlm.nih.gov/38274324/); [Europe PMC](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10809978/fullTextXML)).

**Deload policy [INF; magnitudes synthesised from direction-of-change data, not tested]:**
- **Planned** deload every **4–6 weeks** (user-selectable 3–8), lasting about 1 week.
- Keep the same exercises and session frequency.
- **Cut sets by 40–60%.**
- **Raise target RIR by 2–3.**
- Hold load at 85–100% of normal, or cut it 10–20% for higher-rep work.
- Optionally drop accessories.
- **Reactive trigger:** any 2 of the following, which pulls the scheduled deload forward rather than adding an extra one:
  - e1RM or reps at a fixed load declining for ≥ 2 consecutive sessions;
  - readiness in the user's worst decile for ≥ 3 days;
  - a joint-pain flag;
  - warm-up velocity below baseline for ≥ 2 sessions.
- No complete-rest deloads for strength-focused users.
- The same rules apply to all sexes.
- Before a meet, the taper replaces the deload.

### Tapering and attempt selection follow surveyed elite practice

**General taper evidence** (mostly endurance athletes): the best strategy was a **2-week taper with volume cut exponentially by 41–60% and intensity and frequency unchanged** (ES 0.59) [MA] ([Bosquet 2007](https://pubmed.ncbi.nlm.nih.gov/17762369/)).

**What powerlifters do:**
- Elite New Zealand lifters [OBS, interviews] ([Pritchard 2016](https://pubmed.ncbi.nlm.nih.gov/26670988/)):
  - Volume peaked **5.2 ± 1.7 weeks** out and intensity **1.9 ± 0.8 weeks** out.
  - The taper cut volume by **58.9 ± 8.4%**, with the last session **3.7 ± 1.6 days** out.
  - Accessories were dropped about 2 weeks out.
  - "Poor tapering occurred when too long (1 week or more) was taken off".
- Croatian champions cut volume by **50.5 ± 11.7%**, peaked intensity **8 ± 3 days** out, cut final-week frequency by 47.9% and trained last **3 ± 1 days** out [OBS] ([Grgic & Mikulic 2017](https://pubmed.ncbi.nlm.nih.gov/27806009/)).
- 364 North American lifters [DELPHI/SURVEY] ([Travis 2021](https://pubmed.ncbi.nlm.nih.gov/34846328/); [ETSU](https://dc.etsu.edu/etsu-works-2/366)):
  - Most used a **7–10-day step taper with volume-load cut by 41–50%**.
  - The last heavy session (> 85%) was **7–10 days out for squat and deadlift and < 7 days for bench, at 90–92.5% 1RM**.
  - The last session per lift used 75–80% (squat, bench) and 70–75% (deadlift), e.g. 3 × 2 squat, 3 × 3 bench, 3 × 1 deadlift.
  - Lifts stopped 5.8 ± 2.5 days (deadlift), 4.1 ± 1.9 (squat) and 3.9 ± 1.8 (bench) before the meet; complete cessation lasted 2.8 ± 1.1 days.
- Evidence on peaking maximal strength is limited [NARR] ([Travis 2020](https://pubmed.ncbi.nlm.nih.gov/32917000/)).

**Cessation and taper-intensity trials:**
- 3.7 vs 5.7 days off after 4-week blocks both improved CMJ and isometric bench ([Pritchard 2018](https://pubmed.ncbi.nlm.nih.gov/29369954/)).
- A +5.9% vs −8.5% intensity taper made no significant difference ([Pritchard 2019](https://pubmed.ncbi.nlm.nih.gov/30204523/)).
- **Isometric bench fell after 5 days off but not after 3** [RCT] ([Travis 2022](https://pubmed.ncbi.nlm.nih.gov/35180185/)).

**Attempt selection:**
- At IPF Classic Worlds, openers were about **91% of the third-attempt weight**, then about **+5%** to the second and about **+3%** to the third [OBS] ([Travis, Zourdos & Bazyler 2021](https://www.pubmed.gov/33095691/)).
- In 10,672 Australian squat entries, openers averaged **92% of the day's best**. Winners opened 7 kg heavier (d = 0.14), and third-attempt success was about 68% for winners vs 64% for others [OBS] ([Howells 2022](https://www.pubmed.gov/33721983/)).
- In IPF data (read via a search summary only), third attempts succeeded less often than seconds. For men, 5–20 kg jumps were associated with success, which declined with jumps over 20 kg ([Darragh 2025](https://doras.dcu.ie/31743/1/Darraghetal_2025_PredictingPowerliftingSuccess.pdf)).

**Peaking generator [INF; no RCT validates the full sequence]:**

| Window | Content |
|---|---|
| Weeks −10 to −5 | Accumulation: highest volume, ~70–82% |
| Weeks −5 to −2 | Intensification: volume −20–30% per block; heavy triples/doubles/singles at 85–92%+ |
| Days −10 to −7 | Final heavy singles at ~90–92.5% (opener or slightly above) for squat and deadlift; bench heavy single at ~day −7 to −5 |
| Final 7–10 days | Step taper: volume-load −40–60%; top work ≥ 85–90% early, then a light last session per lift (squat/bench 75–80%, deadlift 70–75%, low reps) |
| Last training day | 2–4 days out (deadlift last trained ~5–6 days out); avoid ≥ 5 days without bench and ≥ 7 days of total rest; accessories removed ~2 weeks out |

**Attempt planner [INF]:**
- Projected best = current e1RM, adjusted +0–3% for the taper.
- Opener ≈ **90–92%** of projected best: a weight already hit for a triple or as an easy single.
- Second ≈ opener +4–6%, about projected best − 3%.
- Third ≈ second +2–4%, up to 100–102% of projected best, adjusted live by how the second moved.
- Warn on jumps above 20 kg (men), or a proportional jump for lighter lifters.

### Strength survives about three weeks off; return gradually

**Detraining rates:**
- Training cessation reduced maximal force by SMD −0.46 and submaximal strength by −0.62, with a dose–response by duration. Losses were larger in people over 65 and in inactive people [MA, 103 studies] ([Bosquet 2013](https://pubmed.ncbi.nlm.nih.gov/23347054/)).
- In elite football-code athletes, **strength was maintained for up to 3 weeks**, then fell **14.5%** over about 7 weeks [SR] ([McMaster 2013](https://pubmed.ncbi.nlm.nih.gov/23529287/)).
- In trained men, 2 weeks off caused no loss of leg-press strength or lean mass [RCT-T] ([Hwang 2017](https://pubmed.ncbi.nlm.nih.gov/28328712/)).
- In older adults, size loss became significant only after 31–52 weeks (d = −1.11) [MA] ([Grgic 2022](https://pubmed.ncbi.nlm.nih.gov/36360927/)).
- How long gains persist remains unresolved [SR] ([Encarnação 2022](https://www.mdpi.com/2813-0413/1/1/1)).

**Breaks and retraining:**
- In untrained men, 3-week breaks every 6 weeks gave the same 24-week gains as continuous training, with faster retraining [RCT-U] ([Ogasawara 2013](https://pubmed.ncbi.nlm.nih.gov/23053130/)).
- Older men lost 5–15% strength over 12 weeks off and **regained it in under 8 weeks** ([Blocquiaux 2020](https://pubmed.ncbi.nlm.nih.gov/32017951/)).

**"Muscle memory":**
- Myonuclei were retained through detraining, but retraining growth did not differ between previously trained and untrained arms ([Cumming 2024](https://pubmed.ncbi.nlm.nih.gov/39159314/)).
- An epigenetic memory has been described ([Seaborne 2018](https://pubmed.ncbi.nlm.nih.gov/29382913/)).

**Return-from-break algorithm [INF; percentages synthesised, untested]**, keyed to days since the lift was last trained, then refined by first-day RPE or velocity:

| Break | Expected change | App action |
|---|---|---|
| ≤ 7 days | No loss; may act as a mini-taper (bench may dip after ≥ 5 days) | Resume plan; autoregulate first top set |
| 8–14 days | Strength maintained in trained men | Session 1 at ~90–95% of previous working load, +1 RIR; back to plan in 1–2 weeks |
| 15–28 days | Mostly maintained to ~3 weeks; small losses at ~4 | Week 1 ~85–90% load and ~60–70% of usual sets; week 2 ~90–95%; re-estimate e1RM |
| 5–8 weeks | Up to ~10–15% loss | 3–4 week ramp from ~75–85% load and ~50% volume ("re-entry" mesocycle) |
| > 2–3 months | Larger losses; retraining is fast | Rebuild e1RMs via submaximal testing; expect to regain in ~4–8 weeks |

After any break of more than about 10 days, expect extra soreness for 1–2 sessions, as Coleman's deload group reported. Breaks of ≤ 2 weeks need no penalty beyond a soft re-entry.

### Realistic strength progress slows from 10–30% a year to 2–5% a year

**Strength progress in competitive and long-term trainees:**
- Powerlifters gain **7.5–12.5% in the first competitive year** and up to about **20% after 10 years**. Women progress faster, and masters women still gain [OBS] ([Latella 2024](https://pubmed.ncbi.nlm.nih.gov/38060089/)).
- 1,897 Australian lifters added **0.15 ± 0.44 kg/day (men; ≈ 54.8 kg/yr) and 0.12 ± 0.69 kg/day (women)** to their totals. Men fell from 0.211 kg/day in the weakest quartile to **0.102 kg/day in the strongest** (a ceiling effect). First-to-best totals rose about 9.5% (men) and 11.4% (women) [OBS] ([Latella 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7448836/)).
- Elite football players gained +7.1% at 12 months, +8.5% at 24 and +12.5% at 48 ([McMaster 2013](https://pubmed.ncbi.nlm.nih.gov/23529287/)).
- 14,690 minimal-dose trainees gained fast and **plateaued after about 1 year** [OBS] ([Steele 2023](https://informahealthcare.com/doi/abs/10.1080/02701367.2022.2070592); [SportRxiv](https://sportrxiv.org/index.php/server/preprint/view/69)).

**Sex differences:**
- Relative hypertrophy shows no sex difference (ES 0.07). Relative upper-body strength gains **favour women** (ES −0.60) [MA] ([Roberts 2020](https://pubmed.ncbi.nlm.nih.gov/32218059/)).
- Absolute size gains favour men (SMD 0.19), mostly in the upper body, while relative gains are similar (+0.69%) [MA] ([Refalo 2025](https://pubmed.ncbi.nlm.nih.gov/40028215/)).

**Muscle-gain rates by training age are practitioner heuristics only [PRACT]** ([RNT Fitness](https://www.rntfitness.co.uk/realistic-rates-muscle-gain/); [Muscle & Strength](https://www.muscleandstrength.com/articles/how-much-muscle-can-you-gain)):
- McDonald, men: about 9–11 kg in year 1, 4.5–5.5 kg in year 2, 2.3–2.7 kg in year 3, then about 1–1.4 kg/yr; women about half.
- Aragon, as % of bodyweight per month: beginner 1–1.5%, intermediate 0.5–1%, advanced 0.25–0.5%.

**Expectation bands [INF]:**
- Strength, first serious year: +10–30%. Years 2–4: +5–10%/yr. 5+ years: +2–5%/yr (≈ 0.5–1 kg/month on a lift).
- Use the same relative targets for both sexes, with smaller absolute increments for women.
- Model each user's progress as a log or exponential-decay curve.
- Flag a **plateau** when the e1RM slope over 8–12 weeks is ≤ 0.
- Flag "faster than expected" above 2× the band; this may be measurement error or a technique change.
- Reduce, rather than reverse, expectations with age.

### Classify trainees by observed progression rate, not labels

**No classification of training level has been validated**:
- ACSM uses training age: novice (none, or none for years), intermediate (about 6 months), advanced (years) ([ACSM 2009](https://pubmed.ncbi.nlm.nih.gov/19204579/)).
- Research typically defines "trained" as ≥ 1 year of training ([Plotkin 2022](https://pubmed.ncbi.nlm.nih.gov/36199287/); [Coleman 2024](https://pubmed.ncbi.nlm.nih.gov/38274324/); [Zhang 2023](https://pubmed.ncbi.nlm.nih.gov/36766912/)).
- McKay 2022 offers a generic, non-resistance-training framework of 6 tiers (sedentary to world class) ([PubMed 34965513](https://pubmed.ncbi.nlm.nih.gov/34965513/)).
- Santos Junior 2021 scores multiple parameters into four levels, but its cut-offs were not retrieved ([ResearchGate](https://www.researchgate.net/profile/Evaldo-Junior-3/publication/349287497_Classification_and_Determination_Model_of_Resistance_Training_Status/links/6029329b299bf1cc26c4894e/Classification-and-Determination-Model-of-Resistance-Training-Status.pdf)).
- Training status moderates outcomes: periodization benefits are larger in untrained people ([Williams 2017](https://pubmed.ncbi.nlm.nih.gov/28497285/)), and undulating beats linear only in trained people ([Moesgaard 2022](https://pubmed.ncbi.nlm.nih.gov/35044672/)).

**Classifier [INF]:** combine three inputs.
1. Consistent training age: < 6 months, 6–24 months, 2–5 years, > 5 years.
2. The e1RM slope on main lifts over the last 8–12 weeks: **≥ 1%/week = novice-like; 0.25–1%/week = intermediate; < 0.25%/week = advanced**.
3. Optionally, relative strength (DOTS/GL or van den Hoek percentile) as a tiebreak.

Weight the observed slope most heavily once 8 or more weeks of data exist, because it selects the progression model:
- Novice: session-to-session load increases.
- Intermediate: weekly increases or DUP.
- Advanced: blocks with RPE or velocity autoregulation.

Users can override the label, and it is re-evaluated each mesocycle. Returning lifters show novice-like slopes, so a fast slope after a break must not lower their assumed volume tolerance.

## Session design: long rests for strength, full stretch, mapped muscles, counted techniques

### Rest: about 90 s is enough for growth; strength needs more than 2 minutes

**Hypertrophy:** rest longer than 60 s gives a small benefit, and nothing more appears beyond about 90 s.
- A Bayesian meta-analysis of 9 studies found "a small hypertrophic benefit to employing inter-set rest interval durations > 60 s, perhaps mediated by reductions in volume load", with "no appreciable differences … when resting > 90 s" [MA].
  - Estimates were imprecise: arm 0.13 (CrI −0.27 to 0.51), thigh 0.17 (−0.13 to 0.43).
  - Training to failure did not change the relationship.
  - Sources: [Singer 2024](https://pubmed.ncbi.nlm.nih.gov/39205815/); [Frontiers](https://www.frontiersin.org/articles/10.3389/fspor.2024.1429789/full).
- At equal volume load, 1-min and 3-min rest produced the same quadriceps growth (13.1% vs 12.9%). Volume load, not rest per se, drove growth [RCT] ([Longo 2022](https://pubmed.ncbi.nlm.nih.gov/35622106/)).
- 3-min beat 1-min rest for 1RM and thigh thickness in trained men when volume load was not equated [RCT-T] ([Schoenfeld 2016](https://pubmed.ncbi.nlm.nih.gov/26605807/)).

**Strength:**
- Untrained people maximise strength gains with **60–120 s**. Trained people need **> 2 min** [SR] ([Grgic 2018](https://www.pubmed.gov/28933024/); [VU record](https://vuir.vu.edu.au/38537/)).
- Earlier short-vs-long reviews could not separate the two ([Grgic 2017](https://pubmed.ncbi.nlm.nih.gov/28641044/)). 2 vs 5 min performed similarly in trained men ([PubMed 16095405](https://pubmed.ncbi.nlm.nih.gov/16095405/)).

**Self-selected rest:**
- Self-selected rest averaged about 97 s and performed like a fixed 120 s, in an acute study ([PMC11503322](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11503322/)).
- Self-determined rest lengthened sessions without benefit (conference abstract) ([IJESAB](https://digitalcommons.wku.edu/ijesab/vol15/iss8/23)).
- A 2025 preprint on rest in trained males could not be retrieved [PREPRINT] ([medRxiv](https://www.medrxiv.org/content/10.1101/2025.09.22.25336351.full.pdf)).

**Rest-timer defaults [INF]:**

| Context | Default | Range |
|---|---|---|
| Strength sets (≤ 5 reps, ≥ ~80–85%), competition lifts | 3:00 (squat/deadlift 4:00) | 2:30–5:00 |
| Hypertrophy multi-joint compounds | 2:30 | 2:00–3:00 |
| Hypertrophy single-joint / small muscles | 1:30 | 1:00–2:00 |
| Short-rest / time-saving mode | 1:00 | 0:45–1:15 (prompt to add a set or accept a load drop) |
| Antagonist superset, A→B | 0:15–0:30 | 0–1:00 |
| Novice (≤ 6 months) | 1:30 compound / 1:00 isolation | — |

**Related rules:**
- Volume-load hint: show "rest longer or add a set" when rest is ≤ 60 s and reps on later sets fall more than about 20–25% below set 1.
- Offer a count-up "ready when ready" timer with a soft minimum of 60 s (isolation) or 90 s (compound).
- Log actual rest durations so the app can personalise later.

### Tempo: controlled eccentric, maximal-intent concentric

- Hypertrophy is similar across **0.5–8 s rep durations** when sets are taken to failure. **Superslow reps (> 10 s) appear inferior** [MA, 8 studies] ([Schoenfeld 2015](https://pubmed.ncbi.nlm.nih.gov/25601394/); summary in [PMC7061915](https://pmc.ncbi.nlm.nih.gov/articles/PMC7061915)).
- A slower eccentric combined with a faster concentric appears best, but the phases have not been isolated in long-term studies [NARR] ([Wilk 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8310485)).
- Squats with maximal intended velocity beat deliberately half-speed squats [RCT-T] ([Pareja-Blanco 2014](https://thieme-connect.com/products/ejournals/abstract/10.1055/s-0033-1363985?lang=en)). In bench press, 1RM rose **+18.2% vs +9.7%** [RCT] ([González-Badillo 2014](https://rio.upo.es/entities/publication/c94a5051-591d-43bf-99e8-8c11ce0ca9d3/full)).
- Eccentric-only vs concentric-only training showed an ES difference of 0.25 (−0.03 to 0.52, not significant); include both [MA] ([Schoenfeld 2017](https://pubmed.ncbi.nlm.nih.gov/28486337/)).

**Defaults [INF]:**
- Store tempo as an eccentric–pause–concentric–pause string, defaulting to **"2-0-X-0"** (eccentric 1–4 s).
- Warn when total rep duration exceeds 8–10 s.
- Do not use time under tension as a progression metric.
- Cue: "lower under control, lift with intent".
- Model paused competition bench as a separate exercise, not as a tempo.

### Range of motion: full ROM with emphasis on the stretched position

**Full vs partial ROM:**
- Full ROM beat partial ROM for strength (ES 0.56) and lower-limb hypertrophy (ES 0.88) [MA] ([Pallarés 2021](https://pubmed.ncbi.nlm.nih.gov/34170576/)).
- Full ROM was trivially better overall (SMD 0.12). The subgroup of partials performed at **long muscle lengths** favoured those partials [MA] ([Wolf 2023](https://doaj.org/article/99e86b317bec40f5abc2f0008358737e); [Solent](https://pure.solent.ac.uk/en/publications/partial-vs-full-range-of-motion-resistance-training-a-systematic-/)).
- Training at longer muscle lengths generally grew more muscle. Study quality was poor to fair (SMART-LD 11.4/20), and fascicle-length findings were equivocal [SR] ([Wolf 2025 SMHS](https://pmc.ncbi.nlm.nih.gov/articles/PMC12869050)).
- Regional (proximal vs distal) effects were "very modest, likely trivial" [PREPRINT] ([Varovic SportRxiv](https://sportrxiv.org/index.php/server/preprint/view/464); [SBS summary](https://www.strongerbyscience.com/muscle-length-regional-hypertrophy/)).
- In trained lifters, lengthened partials matched full ROM [RCT-T] ([Wolf 2025 PeerJ](https://peerj.com/articles/18904)).

**Exercise-specific trials of muscle length:**
- **Knee extension:** initial-range (lengthened) partials grew some distal quadriceps regions more than full ROM [RCT-U] ([Pedrosa 2022](https://pubmed.ncbi.nlm.nih.gov/33977835/)).
- **Calves:** medial gastrocnemius grew **+15.2% with lengthened partials vs +6.7% with full ROM vs +3.4% with shortened partials** [RCT-U] ([Kassiano 2023](https://pubmed.ncbi.nlm.nih.gov/37015016/)).
- **Leg curl:** seated (hip-flexed) beat prone for hamstring volume, **+14% vs +9%** [RCT-U] ([Maeo 2021](https://pubmed.ncbi.nlm.nih.gov/33009197/)).
- **Triceps:** overhead extension gave **1.4–1.5×** the triceps growth of the neutral position despite lighter loads [RCT-U] ([Maeo 2023](https://pubmed.ncbi.nlm.nih.gov/35819335/)).
- **Squat depth:** full squats grew adductors and glutes more than half squats. Neither grew the hamstrings. Full-squat 1RM rose +31.8% vs +11.3% [RCT-U] ([Kubo 2019](https://link.springer.com/doi/10.1007/s00421-019-04181-y)).
- **Leg-extension hip angle:** at 40° hip flexion (more reclined) the rectus femoris grew more than at 90° [RCT-U] ([PubMed 39699974](https://pubmed.ncbi.nlm.nih.gov/39699974/)).

**Defaults [INF]:**
- Use "full ROM the joint allows, reaching the stretched position under load".
- Offer lengthened partials as a set flag or a standalone ROM option, counted as normal sets.
- Avoid shortened-range partials for hypertrophy. Powerlifting overload partials (board press, pin squat, block pull) are a specificity convention.
- Treat the competition lifts as fixed-ROM exercises.

### Exercise selection: vary systematically between mesocycles, not randomly

**Variation:**
- "Some degree of systematic variation" improves regional growth, whereas "excessive, random variation may compromise muscular gains" [SR] ([Kassiano 2022](https://pubmed.ncbi.nlm.nih.gov/35438660/)).
- Constant vs varied exercises gave "virtually similar" results in young women [RCT-U] ([Kassiano 2024](https://repositorio.usp.br/item/003221381)).
- App-randomised exercises gave equal gains and higher motivation in trained men [RCT-T] ([Baz-Valle 2019](https://pubmed.ncbi.nlm.nih.gov/31881066/)).
- Varying squat, leg press, deadlift and lunge grew all quadriceps heads [RCT] ([Fonseca 2014](https://pesquisa.bvsalud.org/portal/resource/es/mdl-24832974)). A varied group grew at all measured sites [RCT] ([Costa 2021](https://www.thieme-connect.com/products/ejournals/pdf/10.1055/a-1308-3674.pdf)).
- Exercise choice affects regional growth ([Zabaleta-Korta 2021 letter](https://www.pubmed.gov/35291926/); [follow-up](https://pmc.ncbi.nlm.nih.gov/articles/PMC10407320); [Burke 2024](https://journal.hep.com.cn/josisae/EN/10.1007/s42978-024-00299-4)).

**Single-joint vs multi-joint:**
- Rectus femoris activation is low in the leg press [EMG] ([Ema 2016](https://www.springermedicine.com/unique-activation-of-the-quadriceps-femoris-during-single-and-mu/21072252)).
- Whole-muscle hypertrophy is similar with single-joint and multi-joint exercises [MA] ([Rosa 2023](https://vuir.vu.edu.au/45635/)).
- Lat pulldown and curls gave similar elbow-flexor growth in novices ([Gentil 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4592763)). However, **curls gave +11.06% vs +5.16% for rows** ([Mannarino 2021](https://paulogentil.com/pdf/Single-Joint%20Exercise%20Results%20in%20Higher%20Hypertrophy%20of%20Elbow%20Flexors%20Than%20Multijoint%20Exercise.pdf)).
- Adding single-joint work to a multi-joint program added nothing in trained men ([de França 2015](https://pubmed.ncbi.nlm.nih.gov/26244600/), via [Paoli 2017](https://www.frontiersin.org/articles/10.3389/fphys.2017.01105/full)). At equal volume load, multi-joint programs gave more strength ([Paoli 2017](https://www.frontiersin.org/articles/10.3389/fphys.2017.01105/full)).
- 45° hip extension grew the biceps femoris long head more than Nordics did (d = 1.03) [RCT] ([Bourne 2017](https://pubmed.ncbi.nlm.nih.gov/27660368/)).

**Policy [INF]:**
- Keep exercises fixed within a 4–8-week mesocycle and rotate 1–2 per muscle between mesocycles.
- Offer random variation only as an opt-in "variety mode".
- Coverage pairings:
  - quadriceps: squat or leg press **plus** leg extension;
  - hamstrings: a hinge **plus** a seated curl;
  - triceps: overhead extension **plus** pressdowns or pressing;
  - elbow flexors: at least one curl (rows are not enough);
  - glutes: deep squat or hip thrust;
  - chest: incline work when upper-chest emphasis is wanted.
- Powerlifters keep the competition lifts in every block and vary accessories.

### Exercise-to-muscle mapping for volume attribution

The table below is the proposed default data set. Credits:
- **1.0** = direct.
- **0.5** = indirect; this is the validated fractional scheme ([Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460); [sponet catalogue](https://sponet.de/sponet/Record/4097139?lng=en); [Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537)).
- **0.25** = an optional finer convention that has **not** been validated.

Evidence codes:
- **H** = longitudinal hypertrophy data;
- **EMG** = muscle-activation data only;
- **C** = convention or biomechanics, with no direct hypertrophy data.

| Exercise | 1.0 primary | 0.5 secondary | 0 / do not credit | Basis |
|---|---|---|---|---|
| Back squat (≥ parallel) | Quadriceps (vasti) | Glute max (consider 1.0 if deep), adductors | Hamstrings 0; rectus femoris under-loaded | H ([Kubo 2019](https://link.springer.com/doi/10.1007/s00421-019-04181-y); [Plotkin 2023](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full)); RF EMG ([Ema 2016](https://www.springermedicine.com/unique-activation-of-the-quadriceps-femoris-during-single-and-mu/21072252)) |
| Half / partial squat | Quadriceps | — | Glutes and adductors reduced, hamstrings 0 | H (Kubo 2019) |
| Leg press / hack squat | Quadriceps (vasti) | Glutes, adductors | Hamstrings 0; RF under-loaded | RF EMG; glutes/adductors C |
| Lunge / split squat | Quadriceps | Glutes, adductors | Hamstrings ~0 | C |
| Leg extension | Quadriceps incl. rectus femoris | — | — | H ([PubMed 39699974](https://pubmed.ncbi.nlm.nih.gov/39699974/)) |
| Hip thrust / bridge | Glute max | Quads 0.25, hamstrings 0.25 (optional) | — | H ([Plotkin 2023](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full)); adding hip thrusts raised glute growth +9.3% vs +6.0% [PREPRINT] ([Research Square](https://researchsquare.com/article/rs-2882506/v1)) |
| RDL / stiff-leg deadlift / good morning | Hamstrings, glute max | Adductor magnus, spinal erectors | Quadriceps 0 | H by analogy ([Bourne 2017](https://pubmed.ncbi.nlm.nih.gov/27660368/)); rest C |
| 45° back extension | Hamstrings (BFLH), glute max | Spinal erectors | — | H (Bourne 2017) |
| Conventional / sumo deadlift | Glutes, spinal erectors | Quads, hamstrings, adductors (sumo: adductors 1.0?), traps/forearms 0.25 | — | C |
| Seated leg curl | Hamstrings (biarticular emphasis) | Gastrocnemius 0.25 (optional) | — | H ([Maeo 2021](https://pubmed.ncbi.nlm.nih.gov/33009197/)) |
| Lying leg curl | Hamstrings (less biarticular growth) | Gastrocnemius 0.25 (optional) | — | H (Maeo 2021) |
| Nordic curl | Hamstrings (semitendinosus) | — | — | H (Bourne 2017) |
| Standing calf raise | Gastrocnemius | Soleus | — | H ([Kassiano 2023](https://pubmed.ncbi.nlm.nih.gov/37015016/)); soleus C |
| Seated calf raise | Soleus | Gastrocnemius 0.25 | — | C |
| Flat bench (barbell/DB) | Pectoralis major (sternocostal) | Triceps, anterior delt | — | H pec > triceps ([PubMed 24265879](https://pubmed.ncbi.nlm.nih.gov/24265879/)); regional EMG ([PubMed 34644424](https://pubmed.ncbi.nlm.nih.gov/34644424/)) |
| Incline press (30–45°) | Pec (clavicular), anterior delt | Triceps | — | EMG + one unverified training study ([PubMed 36334406](https://pubmed.ncbi.nlm.nih.gov/36334406/)) |
| Dips (torso forward) | Pec (lower), triceps | Anterior delt | — | C |
| Push-up | Pec | Triceps, anterior delt | — | C |
| Fly / pec deck | Pec | Anterior delt 0.25 | Triceps 0 | C |
| Overhead press | Anterior delt | Lateral delt, triceps; upper traps 0.25 | — | C |
| Lateral raise | Lateral delt | Upper traps 0.25 | — | C/EMG |
| Rear-delt fly / face pull | Posterior delt | Mid traps / rhomboids | — | C |
| Pulldown / pull-up / chin-up | Lats (and teres major) | Elbow flexors; posterior delt 0.25; mid/lower traps 0.25 | — | Elbow flexors H ([Gentil 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4592763)); lats C (MRI trial pending, [NCT07360236](https://clinicaltrials.gov/study/NCT07360236)) |
| Rows (any) | Lats, mid traps / rhomboids, posterior delt | Elbow flexors; erectors 0.25–0.5 (bent-over only) | — | Elbow flexors H (row ≈ 47% of curl, [Mannarino 2021](https://paulogentil.com/pdf/Single-Joint%20Exercise%20Results%20in%20Higher%20Hypertrophy%20of%20Elbow%20Flexors%20Than%20Multijoint%20Exercise.pdf)) |
| Shrug | Upper traps | Forearm grip 0.25 | — | C |
| Biceps curl | Elbow flexors | Forearm flexors 0.25 | — | H |
| Overhead triceps extension | Triceps (long-head emphasis) | — | — | H ([Maeo 2023](https://pubmed.ncbi.nlm.nih.gov/35819335/)) |
| Pressdown / skull crusher | Triceps (lateral/medial emphasis) | — | — | H (Maeo 2023) |
| Close-grip bench | Triceps, pec | Anterior delt | — | C |

**Implementation [INF]:**
- Store per exercise a list of `{muscle, fraction, evidence_tag, source_id}`, editable by advanced users.
- Report direct and fractional totals.
- Use a sub-muscle taxonomy (vasti vs rectus femoris; biarticular vs short-head hamstrings; long vs lateral/medial triceps; clavicular vs sternocostal pec; gastrocnemius vs soleus) that rolls up to parent muscles.
- Show evidence tags in the UI, e.g. "squats do not count toward hamstrings (MRI evidence)".
- Track powerlifters' competition-lift volume separately.

### Exercise order: priority lifts first; hypertrophy is unaffected

- Strength gains are largest for exercises performed early in a session. Order has **no hypertrophy effect** (ES 0.03) [MA] ([Nunes 2021](https://pubmed.ncbi.nlm.nih.gov/32077380/)).
- Order should follow priority, not "large before small" [NARR] ([Simão 2012](https://link.springer.com/article/10.2165%2F11597240-000000000-00000)).
- Pre-exhaustion gave no benefit ([Fisher 2014](https://pubmed.ncbi.nlm.nih.gov/25092528/); [Trindade 2019](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6882301/)).

**Default ordering [INF]:**
1. Priority or competition lifts.
2. Heavy or technical multi-joint lifts.
3. Isolation.
4. Cardio.

Users can drag to reorder freely. Show a soft warning only when a tracked strength-goal lift moves behind other work for the same muscle.

### Advanced set techniques work about as well as straight sets and need explicit credit rules

**Evidence by technique:**
- **Drop sets:**
  - No hypertrophy difference vs traditional sets, using **one-half to one-third of the time** [MA] ([Sødal 2023](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10390395/)); similar strength and hypertrophy [MA] ([Coleman 2022](https://vuir.vu.edu.au/46296/)).
  - They raise perceived exertion, lactate and fatigue [MA] ([Sports Med Open 2026](https://link.springer.com/article/10.1186/s40798-026-01012-1)).
  - A possible regional rectus femoris benefit ([PubMed 34564324](https://pubmed.ncbi.nlm.nih.gov/34564324/)).
- **Supersets:**
  - They shorten sessions without reducing volume, and agonist–antagonist pairs allow more reps (SMD 0.68) [MA] ([Zhang 2025](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12011898/)).
  - They "hampered maximal strength gains somewhat" on whole-body multi-joint work [RCT] ([Iversen 2024](https://pubmed.ncbi.nlm.nih.gov/39072654/)).
- **Rest-pause:**
  - Similar strength, larger thigh gain [RCT-T] ([Prestes 2019](https://pubmed.ncbi.nlm.nih.gov/28617715/)).
  - Rest-pause and drop sets matched traditional hypertrophy, with slightly better strength for rest-pause [RCT-T] ([Enes 2021](https://pubmed.ncbi.nlm.nih.gov/34260860/)).
- **Cluster sets:** hypertrophy ES −0.05 and strength ES −0.05 vs traditional sets [MA] ([Davies 2021](https://pubmed.ncbi.nlm.nih.gov/33475986/); [Jukic 2021](https://cris.maastrichtuniversity.nl/en/publications/the-effects-of-set-structure-manipulation-on-chronic-adaptations-/)).
- **Myo-reps** are a practitioner protocol: an activation set at about 1–2 RIR, then mini-sets after 3–5 breaths [PRACT] ([Barbell Medicine](https://www.barbellmedicine.com/blog/myo-reps/); [StrengthLog](https://www.strengthlog.com/?p=36118)). Evidence is a thesis with n = 8 ([Liberty](https://digitalcommons.liberty.edu/doctoral/6303)) and an unpublished trial reporting similar gains with 29% fewer reps in 62% less time [PREPRINT/PRACT] ([Biolayne](https://biolayne.com/reps/issue-50/myo-reps-for-mass/); [Henselmans](https://mennohenselmans.com/3-epic-new-studies-to-build-more-muscle-2026/)).
- **Blood-flow restriction (BFR)** with low loads matches high-load hypertrophy but gives less strength [MA] ([Lixandrão 2018](https://doi.org/10.1007/s40279-017-0795-y); [summary](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11595635/)).
- Supersets, drop sets and rest-pause roughly halve training time [NARR] ([Iversen 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8449772)).

**No study validates how to convert these techniques into "sets".** The proposed credits below are explicit, documented heuristics [INF]:

| Technique (`set_type`) | Proposed credit | Basis |
|---|---|---|
| Superset / paired set / circuit | Each exercise's sets count normally | Volume unchanged (Zhang 2025) |
| Pre-exhaust | Count normally | Order only |
| Drop set (`drop`) | Main set 1.0 + **0.5 per drop**, cap **2.0** | Drop protocols ≈ multi-set hypertrophy (Sødal 2023; Coleman 2022) |
| Rest-pause (`rest_pause_mini`) | Activation 1.0 + **0.33–0.5 per mini-set**, cap **2.0** | Enes 2021; Prestes 2019 |
| Myo-reps (`myo_activation` / `myo_mini`) | Activation 1.0 + **0.33 per mini-set**, cap **2.5** | Practitioner claims; unpublished trial |
| Cluster set (`cluster_rep_block`) | 1.0 per block, i.e. as many sets as the equivalent traditional configuration | Davies 2021; Jukic 2021 |
| Lengthened partials, standalone | 1.0 per set | Wolf 2025 PeerJ |
| Lengthened partials after failure (`partial_extension`) | +0.25 to that set, cap 1.25 | Untested |
| BFR set near failure (`bfr`) | 1.0 per set | Lixandrão 2018 |
| Warm-up (`warmup`) | 0 | Not training sets |

**When to suggest each technique [INF]:**
- **Supersets** are suggested in time-saver mode. Avoid pairing two heavy strength-priority multi-joint lifts.
- **Drop sets** go on the last isolation or machine set, dropping load 20–30% for 1–2 drops (load drops are a convention). Never on competition lifts.
- **Rest-pause and myo-reps** are for isolation or machine exercises in hypertrophy blocks.
- **Cluster sets** are for heavy singles and doubles.
- **Pre-exhaust** is allowed but not suggested.
- **BFR** is optional, at 20–40% 1RM. Show a safety note and never prescribe cuff pressure.
- No advanced techniques for novices in their first 3–6 months.

### Warm-up generator: ramp up to about 80% of working weight

**Specific (ramp) warm-ups:**
- In trained men, warm-ups with few reps at low loads were "not enough": a 40% + 80% (of training load) ramp beat 40% alone on squat velocity (ES 0.51–0.80) [RCT-T crossover] ([Ribeiro 2020](https://pubmed.ncbi.nlm.nih.gov/32971729/)).
- The same 2 × 6 ramp raised first-set velocity ([Ribeiro 2021](https://doaj.org/article/90de36e35e514c36af5f61118a42eb3a)).
- In an earlier study, warm-up type did not change rep performance ([Ribeiro 2014](https://eld.bl.uk/catalog/100170261683_0x000001)). Reviews call the combined general-plus-specific evidence "not consensual" ([Ribeiro SR](https://doaj.org/article/25ec6f05b30f409c83052eb328c0d9f7)).

**General warm-ups:**
- Adding 20 min of cycling at 60% HRmax raised leg-press 1RM by **8.4%** ([Abad 2011](https://pubmed.ncbi.nlm.nih.gov/21544000/)).
- A long, low-intensity general warm-up added about 3% ([Barroso 2013](https://read.qxmd.com/read/22692116/the-effects-of-different-intensities-and-durations-of-the-general-warm-up-on-leg-press-1rm)).
- High-load dynamic warm-ups improve upper-body strength and power [SR] ([McCrary 2015](https://pubmed.ncbi.nlm.nih.gov/25694615/)).

**Stretching:**
- Static stretching reduces immediate performance by about −3.7% and PNF by −4.4%, while dynamic stretching adds +1.3%. Deficits mainly occur with holds **≥ 60 s per muscle** [SR] ([Behm 2016](https://pubmed.ncbi.nlm.nih.gov/26642915/); [Kay & Blazevich 2012](https://pubmed.ncbi.nlm.nih.gov/21659901/)).
- For time-efficient training, use specific warm-ups and keep stretching only for flexibility goals ([Iversen 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8449772)).

```text
// Warm-up generator [INF; informed by Ribeiro 2020, McCrary 2015; ramps are coaching convention]
inputs: W (working weight), R (target reps), firstForPattern, barWeight, plateIncrement
Rule 0 (optional, session start): 5–10 min easy cardio / dynamic movement
Rule 1 (R ≤ 5 or W ≥ ~80% e1RM): bar×8–10 → 40%W×5 → 60%W×3 → 75%W×2 → 85%W×1
                                  (+ 92–95%W×1 if W ≥ ~90% e1RM or 1RM attempt day)
Rule 2 (compounds, R 6–15):       (bar×8–10) → 40–50%W×6–8 → 70%W×4 → (85%W×2, optional)
Rule 3 (isolation / already-warm muscle): 1×8–12 @ ~50%W or skip;
                                  later exercises on same pattern: 1 feeder ×3–5 @ ~70%W
Rounding/pruning: round to available increments; drop steps < bar or within ~5% of previous step;
                  never warm-up reps ≥ working reps at loads ≥ 70%W
Rest: 30–60 s light steps; 1–2 min before first work set after ≥ 75% steps
set_type = warmup → excluded from volume and progression metrics
Stretching: none by default; if requested, < 60 s per muscle followed by dynamic movement
```

### Concurrent training: separate cardio from lower-body lifting

**Overall interference is small:**
- Concurrent training "does not compromise muscle hypertrophy and maximal strength development". **Explosive strength may be attenuated when both are done in the same session** [MA, 43 studies] ([Schumann 2022](https://pubmed.ncbi.nlm.nih.gov/34757594/)).
- A companion analysis found a small negative effect on muscle-fibre hypertrophy, larger with running [MA] ([Springer](https://link.springer.com/doi/10.1007/s40279-022-01688-x)).

**Where interference appears:**
- Interference with **lower-body 1RM appeared only in trained lifters and only when both were done in the same session** [MA] ([Petré 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8053170/)).
- Lower-body strength was blunted in **men** (SMD −0.43) but not women [MA] ([Huiberts 2024](https://link.springer.com/article/10.1007/s40279-023-01943-9)).
- Older data showed **running, not cycling** reduced hypertrophy and strength, and endurance frequency and duration correlated with interference (r = −0.26 to −0.75) [MA] ([Wilson 2012](https://pesquisa.bvsalud.org/sms/resource/pt/mdl-22002517); [record](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_1027372546)).
- HIIT reduced lower-body strength gains (ES −0.248). By subgroup, cycling HIIT was −0.377 and running HIIT −0.176 [MA] ([Sabag 2018](https://pubmed.ncbi.nlm.nih.gov/29658408/)).

**Sequence and spacing:**
- Lifting before cardio gave **+3.96 kg** lower-body 1RM [MA] ([Murlasits 2018](https://pubmed.ncbi.nlm.nih.gov/28783467/)) and **+6.91%** lower-body dynamic strength [MA] ([Eddens 2018](https://pubmed.ncbi.nlm.nih.gov/28917030/)).
- Gaps of 0 h, and to a lesser extent 6 h, were worse than 24 h in rugby players [RCT] ([Robineau 2016](https://pubmed.ncbi.nlm.nih.gov/25546450/)).

**Scheduling rules [INF; soft warnings]:**
- Warn when cardio and lower-body lifting fall on the same day **less than 6 h apart**.
- Lift first by default.
- Prefer cycling, incline walking, rowing or elliptical for steady-state cardio. Do not prefer cycling for HIIT, given the conflicting subgroup data; keep HIIT away from heavy leg days.
- Soft cap of about 2–3 moderate sessions per week of ≤ 30–45 min (heuristic), with low-intensity walking unrestricted.
- Stronger warnings in peaking blocks for HIIT or long runs within 24 h before heavy lower-body work.
- Optionally relax warnings for women.
- Relax warnings for novices.
- Log cardio as its own session type so the time gaps can be computed.

### Session duration and time-cap mode

**Evidence:** per-session returns flatten at about 11 fractional sets per muscle for hypertrophy and about 2 direct sets per lift for strength [PREPRINT] ([Remmert preprint](https://sportrxiv.org/index.php/server/preprint/view/537); [FAU release](https://fau.edu/newsdesk/articles/build-muscle-gain-strength-study.php)). For time efficiency, Iversen prioritises bilateral multi-joint lifts, specific warm-ups and supersets or drop sets [NARR] ([Iversen 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8449772)). Critics note that its general-public framing may not suit athletes ([Carlson, Smith & Fisher 2022](https://e-space.mmu.ac.uk/629394/1/Letter%20to%20Editor%20Iverson_FINAL_after%20revisions.pdf)).

**Duration estimator [INF]:**
```text
duration ≈ Σ_sets (reps × rep_duration[3–4 s default] + rest_after_set)
         + warm-up time [~1 min per warm-up set] + transitions [~1–2 min per exercise]
```
Replace the defaults with logged rest times once they exist.

**Time-cap mode [INF]** applies these steps in order:
1. Superset antagonist or non-competing pairs.
2. Convert final isolation sets to drop sets or myo-reps, credited as in the table above.
3. Trim warm-ups to the Rule 2/3 minimums.
4. Shorten isolation rest to 60–90 s, with a note about volume load.

**Never shorten rest below 2 min on strength-priority competition lifts.** Warn when one muscle gets more than about 10–12 fractional sets in one session.

## Monitor load, readiness and pain as trends; never present ACWR as an injury predictor

### Training-load metrics worth computing

**Background.** A review of resistance-training monitoring makes three points ([Scott 2016](https://doi.org/10.1007/s40279-015-0454-0); [accepted manuscript](https://vuir.vu.edu.au/32754)):
- %1RM alone is an inadequate measure of intensity.
- Volume load, session and set RPE, wellness questionnaires and velocity should be combined.
- There is "no consensus on how best to integrate these methods" [NARR].

A device review adds that volume load "has inherent flaws" ([Weakley 2021](https://doi.org/10.1007/s40279-020-01382-w)).

**Session RPE (sRPE)** was validated against heart-rate methods as "mode and intensity-independent" ([Foster 2001](https://pubmed.ncbi.nlm.nih.gov/11708692/)). In resistance training:
- sRPE rose with intensity even as total work fell. It was collected **30 min after the session** and "may meaningfully underestimate" ratings taken immediately after each set ([Sweet 2004](https://doi.org/10.1519/14153.1)).
- Heavier protocols felt harder, and **sRPE ICC = 0.88** ([Day 2004](https://doi.org/10.1519/R-13113.1)).
- An sRPE-guided progression matched a fixed progression for CSA (+6.55% vs +9.65%) and strength (+9.68% vs +9.28%) [RCT-T] ([Gomes 2022](https://doi.org/10.1519/JSC.0000000000003568)).

**Monotony and strain** (Foster 1998, n = 25): illnesses occurred when athletes exceeded individually identifiable thresholds, "mostly related to the strain of training" ([Foster 1998](https://doi.org/10.1097/00005768-199807000-00023)). The often-quoted "monotony > 2.0 is risky" rule was **not verified** in the abstract, which stresses individual thresholds. Do not hard-code it.

**Overtraining.** In resistance-training studies, "no marker other than a sustained decrease in performance has been established as a reliable indicator of overtraining" [SR] ([Grandou 2020](https://doi.org/10.1007/s40279-019-01242-2)). The Doha consensus frames internal and external load in general terms ([Bourdon 2017](https://doi.org/10.1123/ijspp.2017-0208)).

```text
// Load metrics [standard definitions per Scott 2016; Foster 1998, 2001]
VL        = Σ_sets reps × kg                         // "tonnage"; lift-specific, never compare across exercises
RVL       = Σ_sets reps × (kg / e1RM_or_1RM)          // comparable across lifts
sRPE_load = session RPE (CR-10) × minutes             // prompt 15–30 min post-session; flag late entries
weeklyLoad = Σ_7days dailyLoad (rest days = 0)
monotony  = mean(dailyLoad_7d) / sd(dailyLoad_7d)
strain    = weeklyLoad × monotony
// Optional, label "unvalidated heuristic": intensity-weighted VL = Σ reps × kg × (setRPE/10)
// Primary overreaching trigger: e1RM or reps-at-fixed-load declining across ≥ 2–3 sessions / ~2 weeks [Grandou 2020]
```

### ACWR and Banister models: descriptive at most

**ACWR (acute:chronic workload ratio).** Gabbett proposed it as a "best practice predictor" of injury in team sports. Its widely cited "sweet spot" of **0.8–1.3** and "danger zone" of **≥ 1.5** come from rugby, cricket and Australian football data ([Gabbett 2016](https://doi.org/10.1136/bjsports-2015-095788)). The EWMA variant is `EWMA_today = load_today·λ + (1 − λ)·EWMA_yesterday`, with `λ = 2/(N + 1)`, N = 7 (acute) and 28 (chronic) ([Williams 2017](https://doi.org/10.1136/bjsports-2016-096589)).

The criticisms are severe:
- Mathematical coupling creates spurious correlation ([Lolli 2019](https://doi.org/10.1136/bjsports-2017-098110)).
- "There is no evidence supporting the use of ACWR in training-load-management systems" ([Impellizzeri 2020](https://doi.org/10.1123/ijspp.2019-0864)).
- **Dividing acute load by a fixed constant gave similar odds ratios** (1.95 vs 2.45), and neither ACWR nor acute load beat an intercept-only model (c-statistic 0.574 / 0.544 vs 0.5). The authors recommend it "be dismissed as a framework and model" ([Impellizzeri 2021](https://doi.org/10.1007/s40279-020-01378-6)).
- The EWMA has an initial-load problem and breaks during tapers, so its use should be "discouraged" ([Wang 2020](https://doi.org/10.1007/s40279-020-01280-1)).

**Banister fitness–fatigue model:**
- Form: `Perf(t) = p0 + k1·Σ w(s)·e^(−(t−s)/τ1) − k2·Σ w(s)·e^(−(t−s)/τ2)`.
- It tracked performance in 6 elite weightlifters, but "the fatigue index remains to be clarified" ([Busso 1990](https://doi.org/10.1007/BF00236693); [Busso 1992](https://doi.org/10.1007/BF00636228)).
- In swimmers the time-constant CIs were huge (τa 38 [17, 59] days, τf 19 [6, 32] days), and correlated parameters made interpretation "worthless" ([Hellard 2006](https://doi.org/10.1080/02640410500244697)).
- A practitioner review covers its use in strength coaching ([Chiu & Barnes 2003](https://doi.org/10.1519/00126548-200312000-00007)).

**Policy [INF]:**
- Show ACWR, if at all, as a neutral "this week vs your 4-week average" percentage. Use the uncoupled or EWMA form and hide it until 4 or more weeks of data exist.
- No red/green zones.
- Banister is an optional, experimental visual fitted per user and never drives programming. The CTL/ATL-style constants τ1 ≈ 42 d and τ2 ≈ 7 d are an unverified practitioner convention.

### Readiness check-ins: subjective ratings beat objective markers

**Subjective vs objective:**
- **Subjective measures reflected acute and chronic load "with superior sensitivity and consistency"** compared with blood and heart-rate markers. The data came mostly from endurance and team sports [SR, 56 studies] ([Saw 2016](https://doi.org/10.1136/bjsports-2015-094758)).
- Well-being logs predicted 76% of staleness variance in swimmers ([Hooper 1995](https://doi.org/10.1249/00005768-199501000-00019)).
- The common **Hooper Index** sums sleep, fatigue, stress and soreness, each scored 1–7 (scale details not verified).
- Rugby players' wellness and CMJ recovered by about 4 days ([McLean 2010](https://doi.org/10.1123/ijspp.5.3.367)). The McLean 5-item 1–5 scale is likewise unverified.

**Perceived Recovery Status (PRS), 0–10:**
- It correlated with sprint change at r = −0.63 ([Laurent 2011](https://doi.org/10.1519/JSC.0b013e3181c69ec6)).
- After a high-volume resistance session it **fell from 8.6 to 4.2 at 48 h**, tracking CK ([Sikorski 2013](https://doi.org/10.1519/JSC.0b013e31827e8e78)).
- Perceived recovery worsens as sets approach failure ([Refalo 2023](https://doi.org/10.1186/s40798-023-00554-y)).

**Motivation vs readiness:**
- In 28 trained women, **motivation to train predicted velocity performance (β = 0.0004, p = 0.021), but self-rated readiness did not**. Menstrual-phase effects were about 0.01–0.02 m/s [OBS] ([Munteanu 2026](https://doi.org/10.1007/s40279-026-02459-8)).
- DALDA is a stress-tolerance tool whose item structure was not verified ([Rushall 1990](https://doi.org/10.1080/10413209008406420)).

**Objective markers:**
- The **average** CMJ is more sensitive than the best CMJ ([Claudino 2017](https://doi.org/10.1016/j.jsams.2016.08.011)).
- Velocity loss, velocity at the load that elicits 1 m/s ("V1-load") and CMJ loss correlate at r = 0.91–0.97 ([Sánchez-Medina 2011](https://doi.org/10.1249/MSS.0b013e318213f880)).
- Within-set velocity loss maps reliably onto the percentage of possible reps completed in the bench press ([González-Badillo 2017](https://doi.org/10.1055/s-0042-120324)).

**HRV-guided training did not beat fixed schedules**:
- Young men: 1RM +30% vs +42% (n.s.) ([De Oliveira 2019](https://doi.org/10.1080/17461391.2019.1572227)).
- Older women: no group differences ([Bittencourt 2024](https://doi.org/10.3389/fphys.2024.1472702)).
- Failure protocols depress HRV more ([Pareja-Blanco 2017](https://doi.org/10.1111/cpf.12348)).

**Check-in and decision rules [INF; no validated cut-offs exist]:**
- A daily check-in of 30 s or less: sleep quality, sleep hours, fatigue/energy, soreness (optionally per muscle), stress, mood, one PRS item (0–10) and one motivation item.
- Z-score each item against the user's own **rolling 28-day baseline**, needing 7–14 or more entries before flagging. Average the z-scores with signs aligned so that higher is better.
- **Composite z ≤ −1.0 → "low readiness". z ≤ −1.5, or PRS ≤ 3 on two consecutive days → "consider modifying"**. These are adjustable defaults.
- Actions:
  - cap the top-set RPE at −1 (i.e. +1 RIR);
  - drop 1–2 back-off sets;
  - or swap with a lighter day.
- **Never auto-cancel a session on HRV alone.**
- Optional objective checks:
  - the warm-up single's velocity at a fixed load, flagged at a drop of more than 0.05–0.06 m/s or 1 SD;
  - the average of 2–3 CMJs.
- Grip strength has no supporting evidence and should not be prioritised.

### Recovery takes 24–48 h after non-failure work and 48–72 h after failure

| Protocol | Recovery finding | Source |
|---|---|---|
| Failure vs non-failure (bench, squat; trained men) | Failure slows recovery by **24–48 h**; non-failure recovered faster between 24 and 48 h | [Morán-Navarro 2017](https://doi.org/10.1007/s00421-017-3725-7) |
| 3×12[12] vs 3×6[12] at 70% | Failure reduced V1-load velocity until 24 h (bench) / 6 h (squat), CMJ to 48 h; "halving the number of repetitions … minimize[s] fatigue" | [Pareja-Blanco 2017](https://doi.org/10.1111/cpf.12348) |
| 10 protocols 6(12)–4(4) | High-rep failure protocols reduced function up to 48 h | [Pareja-Blanco 2020](https://doi.org/10.1519/JSC.0000000000002756) |
| 6 sets bench at 75%: FAIL / 1 RIR / 3 RIR | Velocity −25/−13/−8% at 4 min; **−3/−3/+2% at 24 h; equal by 48 h**; males fatigued more after FAIL (−29% vs −21%) | [Refalo 2023](https://doi.org/10.1186/s40798-023-00554-y) |
| Failure vs non-failure [MA] | Performance drop SMD −0.96; more CK especially at 48 h | [Vieira 2022](https://doi.org/10.1007/s40279-021-01602-x) |
| 4 sets to failure at 80%: squat / bench / deadlift | Squat velocity at 70% down up to **72 h (−8.61%)**; **no between-lift differences**, so deadlift needs no extra recovery | [Belcher 2019](https://doi.org/10.1139/apnm-2019-0004); [AUT summary](https://openrepository.aut.ac.nz/items/fe9ce8b4-b96f-4081-99ba-26b2aa8cdb37) |
| Heavy (3RM) vs moderate lower-body session | Biphasic recovery; baseline by **3 h (moderate) vs 33 h (heavy)** | [Raastad & Hallén 2000](https://doi.org/10.1007/s004210050673) |
| 8×10 vs 8×3 (trained) | High volume caused larger deficits and more damage than high intensity | [Bartolomei 2017](https://doi.org/10.1007/s00421-017-3598-9) |
| Maximal eccentric elbow flexion | Trained men back to baseline by 3 days; untrained still ~40% down | [Newton 2008](https://doi.org/10.1519/JSC.0b013e3181660003) |
| Unaccustomed eccentric (n = 286) | MVC fell to 82/61/42% across responder clusters | [Damas 2016 IJSM](https://doi.org/10.1055/s-0042-100281); repeated-bout effect [Hyldahl 2017](https://doi.org/10.1249/JES.0000000000000095) |
| Muscle protein synthesis | +50% at 4 h, +109% at 24 h, near baseline by ~36 h | [MacDougall 1995](https://doi.org/10.1139/h95-038) |
| Trained vs untrained MPS | Training blunts and shortens the response (FSR 0.045→0.067 vs 0.036→0.080 %/h) | [Phillips 1999](https://doi.org/10.1152/ajpendo.1999.276.1.E118) |
| Early training | MyoPS goes to repair first; correlates with hypertrophy only by weeks 3–10 | [Damas 2016 J Physiol](https://doi.org/10.1113/JP272472) |

**Spacing rules [INF]:**
- **Heavy work that stops short of failure (≥ 2–3 RIR): ≥ 24–48 h** before training the same lift or muscle again. Near-daily submaximal practice is fine.
- **Failure or high-volume work: ≥ 48–72 h.**
- **Unaccustomed or eccentric-heavy work, a new exercise, or a return from a layoff: expect 3–5+ days** of strength loss. Show a "new stimulus: expect more soreness" note.

A per-muscle recovery-status model is an optional heuristic. Each set's fatigue cost is scaled by proximity to failure: failure 1.0, 1 RIR 0.8, 3 RIR 0.5. The cost then decays with a half-life of about 12–24 h for non-failure work and about 24–36 h for failure or high-volume work, adjusted by soreness and PRS. **These constants are heuristic fits, not published parameters.**

### Sleep and stress

**Sleep:**
- Sleep loss reduced performance by **−7.56%** (CI −11.9 to −3.13). Effects were consistent only for total deprivation and late restriction (waking early), at about **−0.4% per hour awake**. **PM tasks were impaired; AM tasks were "largely unaffected"** [MA, 69 publications] ([Craven 2022](https://doi.org/10.1007/s40279-022-01706-y)).
- In resistance training, a single night of deprivation "had little effect on muscle strength", but **consecutive nights of restriction reduced multi-joint, not single-joint, force** [SR] ([Knowles 2018](https://doi.org/10.1016/j.jsams.2018.01.012)).
- One night of total deprivation **cut postprandial MPS by 18%** [RCT crossover] ([Lamon 2021](https://doi.org/10.14814/phy2.14660)).

**Stress:**
- Low-stress students gained more bench and squat 1RM over 12 weeks [OBS] ([Bartholomew 2008](https://doi.org/10.1519/JSC.0b013e318173d0bf)).
- Higher stress slowed recovery of force, energy, fatigue and soreness over 96 h ([Stults-Kolehmainen 2012](https://doi.org/10.1249/MSS.0b013e31825f67a0); [Stults-Kolehmainen 2014](https://doi.org/10.1519/JSC.0000000000000335)).

**Rules [INF]:**
- Log sleep hours, sleep quality, wake time vs usual, and life stress (1–5).
- After < 6 h of sleep before a PM session, keep intensity but trim volume or skip max singles.
- After ≥ 2 consecutive short nights, lower expectations for multi-joint lifts more than for isolation work.
- In high-stress weeks, add about 24 h of spacing and soften progression targets.
- Base messaging on the rolling 7-day sleep average.

### Injury epidemiology: rare time-loss injury, common training pain

**Incidence and prevalence:**
- **Powerlifting 1.0–4.4 and weightlifting 2.4–3.3 injuries per 1,000 h** [SR] ([Aasa 2017](https://doi.org/10.1136/bjsports-2016-096037)).
- **Bodybuilding 0.24–1 per 1,000 h (0.12–0.7 per lifter-year)**, the lowest of the weight-training sports, vs strongman 4.5–6.1. Common sites are shoulder, lower back, knee, elbow and wrist/hand [SR] ([Keogh & Winwood 2017](https://doi.org/10.1007/s40279-016-0575-0)).
- The updated review reports **70% point prevalence** in powerlifting under a "pain that impairs training" definition, with lower back/pelvis, shoulder and elbow most common. Pelvic-floor dysfunction affected **50% of women vs 9.3% of men** [SR] ([Tung 2024](https://doi.org/10.1136/bmjsem-2023-001884)).

**Cross-sectional risk associations:**
- Swedish sub-elite lifters: **70% currently injured, 87% in the past year, but only 16% stopped training**. Current injury was associated with training frequency, deadlift PB, bench and deadlift onset, straps, alcohol and dietary issues [OBS] ([Strömbäck 2018](https://doi.org/10.1177/2325967118771016)).
- Powerlifters: 43.3% had problems in routine training, at 0.3 injuries per lifter-year (~1 per 1,000 h). Belt use was linked to lumbar injury (confounded), age over 40 to upper-extremity injury, and female sex to hand/wrist injury ([Siewe 2011](https://doi.org/10.1055/s-0031-1277207)).
- Bodybuilders: 45.1% had symptoms, at 0.24 per 1,000 h, with higher rates over age 40 ([Siewe 2014](https://doi.org/10.1055/s-0034-1367049)).

**Hypothesised causes** include excessive loads, large ROM, insufficient rest between sessions and faulty technique [NARR] ([Bengtsson 2018](https://doi.org/10.1136/bmjsem-2018-000382)). Recent bodybuilding data are sparse ([Fagotti 2021](https://doi.org/10.1590/1413-785220212903242430)).

**What the app should and should not flag [INF]:**
- **Pain logging** is the highest-value feature. Use a body map (lumbopelvic, shoulder, hip, knee, elbow, wrist/hand, neck/thoracic), a 0–10 rating, the lift or session where pain started, and whether training was modified, reduced or stopped.
- **Gentle alert:** the same region rated ≥ 3/10 on ≥ 3 sessions within 14 days, or pain rising across sessions → suggest a variation, a load reduction or a clinician. Tag the lift where pain started.
- **Load-spike awareness:** flag weekly per-lift or per-muscle volume load or hard sets more than 20–30% above the 4-week average, or a sudden frequency jump, as "bigger jump than usual". **Never as an injury-risk score.**
- **Contextual hints:**
  - age > 40 → upper-extremity overuse;
  - women → optional pelvic-floor symptom item with educational content.
- Do not discourage belts or straps on confounded cross-sectional data.
- **Do not claim that failure training causes injury.** No evidence supports it.
- **Tone:** normalise logging and early modification. Time-loss injury is rare; nagging pain is common.

## Scoring formulas reproduce their official test values exactly

All formulas were transcribed from OpenPowerlifting (OPL) source code [OFFICIAL]. The 2019 IPF coefficients were cross-checked against the IPF announcement. Inputs are **kg** (1 lb = 0.45359237 kg). **The scores are on different scales and are not interchangeable**:
- Wilks and DOTS run roughly 300–600.
- Wilks2020 runs about 20% higher than Wilks.
- IPF Points centre on 500.
- IPF GL centres on 100.

During this synthesis, **every unit-test vector below was recomputed and matched**.

### Wilks, Wilks2020 and DOTS

```text
// Original Wilks — x = bodyweight kg; score = coef × kg lifted   [OPL wilks.rs]
coef = 500 / (a + b·x + c·x² + d·x³ + e·x⁴ + f·x⁵)
Men:   a=−216.0475144  b=16.2606339  c=−0.002388645  d=−0.00113732  e=7.01863E−06  f=−1.291E−08
Women: a=594.31747775582  b=−27.23842536447  c=0.82112226871  d=−0.00930733913  e=0.00004731582  f=−0.00000009054
Clamp BW: men [40, 201.9]; women [26.51, 154.53]
Tests: M 100 kg / 1000 kg → 608.58907;  F 60 kg / 500 kg → 557.4434

// Wilks2020 — numerator 600   [OPL wilks2020.rs]
Men:   a=47.4617885411949  b=8.47206137941125  c=0.073694103462609  d=−0.00139583381094385
       e=0.00000707665973070743  f=−0.0000000120804336482315
Women: a=−125.425539779509  b=13.7121941940668  c=−0.0330725063103405  d=−0.0010504000506583
       e=0.00000938773881462799  f=−0.000000023334613884954
Clamp BW: men [40, 200.95]; women [40, 150.95]
Coefficient tests: M 40→1.3895, 60→0.9968, 80→0.8191, 100→0.7294, 120→0.6817, 140→0.6546, 200→0.6123
                   F 40→1.8486, 60→1.3190, 80→1.1318, 100→1.0525, 150→0.9635

// DOTS   [OPL dots.rs]
coef = 500 / (A·x⁴ + B·x³ + C·x² + D·x + E)
Men:   A=−0.0000010930  B=0.0007391293  C=−0.1918759221  D=24.0900756  E=−307.75076   clamp [40, 210]
Women: A=−0.0000010706  B=0.0005158568  C=−0.1126655495  D=13.6175032  E=−57.96288    clamp [40, 150]
```

Sources: [OPL wilks.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/wilks.rs); [OPL wilks2020.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/wilks2020.rs); [OPL dots.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/dots.rs).

**Notes on origin and validity:**
- Wilks showed no bias for bench and total in world-class lifters, but **a linear bias against heavier lifters in the deadlift**, and it is "not … based on published data" [OBS] ([Vanderburgh & Batterham 1999](https://doi.org/10.1097/00005768-199912000-00027)).
- Wilks2020's attribution to Robert Wilks (2020, mainly Powerlifting Australia) is secondary ([Lift Vault](https://liftvault.com/resources/powerlifting-calculator/)).
- DOTS is credited to Tim Konertz (BVDK, ~2019) by third parties, which conflict on details. **No official derivation exists** ([Lift Vault](https://liftvault.com/resources/powerlifting-calculator/); [FitnessVolt](https://fitnessvolt.com/rpe-training/compare/wilks-vs-dots/)).

### IPF Points (2019) and IPF GL (2020+)

**IPF Points** [OFFICIAL] ([IPF Formula PDF](https://www.britishpowerlifting.org/wp-content/uploads/2025/03/ipf_formula.pdf); [OPL ipf.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/ipf.rs)):
- Formula: `IPFPoints = 500 + 100 × (Total − (C1·ln(BW) − C2)) / (C3·ln(BW) − C4)`; a total of 0 scores 0.
- Origin: authored by Joe Marksteiner from about 20,000 best performances, and replaced Wilks from 1 Jan 2019.
- OPL returns 0 for BW < 40 kg and floors scores at 0.
- Tests: M classic 93 kg / 777.5 → **741.32**; F classic 73 kg / 337.5 → **546.67**.
- The structure reads as `500 + 100 × z` relative to a modelled mean and SD at that bodyweight [INF].

| IPF Points category | C1 | C2 | C3 | C4 |
|---|---|---|---|---|
| Men Classic 3-lift | 310.67 | 857.785 | 53.216 | 147.0835 |
| Men Classic Bench | 86.4745 | 259.155 | 17.57845 | 53.122 |
| Men Equipped 3-lift | 387.265 | 1121.28 | 80.6324 | 222.4896 |
| Men Equipped Bench | 133.94 | 441.465 | 35.3938 | 113.0057 |
| Women Classic 3-lift | 125.1435 | 228.03 | 34.5246 | 86.8301 |
| Women Classic Bench | 25.0485 | 43.848 | 6.7172 | 13.952 |
| Women Equipped 3-lift | 176.58 | 373.315 | 48.4534 | 110.0103 |
| Women Equipped Bench | 49.106 | 124.209 | 23.199 | **67.4926** (OPL uses 67.492; use the IPF value) |

OPL also carries single-lift IPF constants of **unverified origin**, absent from the IPF document:

| Lift | M Raw (C1, C2, C3, C4) | M Single-ply | F Raw | F Single-ply |
|---|---|---|---|---|
| Squat | 123.1000, 363.0850, 25.1667, 75.4311 | 150.4850, 446.4450, 36.5155, 103.7061 | 50.4790, 105.6320, 19.1846, 56.2215 | 74.6855, 171.5850, 21.9475, 52.2948 |
| Deadlift | 103.5355, 244.7650, 15.3714, 31.5022 | 110.1350, 263.6600, 14.9960, 23.0110 | 47.1360, 67.3490, 9.1555, 13.6700 | 51.0020, 69.8265, 8.5802, 5.7258 |

**Wilks vs IPF Points.** In 26,472 open lifters, Wilks equalised 53 of 98 weight-class comparisons and IPF Points 51 of 98. The authors "could not validate the IPF's decision to replace the Wilks" [OBS] ([Ferland 2020](https://doi.org/10.70252/XGHM8852)).

**IPF GL Points** [OFFICIAL] ([OPL goodlift.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/goodlift.rs)):
- Formula: `GL = Total × 100 / (A − B·e^(−C·BW))`, implemented as `Total × max(0, 100/(A − B·e^(−C·BW)))`, with 0 for BW < 35 kg.
- Equipment mapping: wraps count as classic, multi-ply as single-ply. There are no squat-only or deadlift-only coefficients.
- Tests: M equipped 3-lift 92.04 kg / 1035 → **112.85**; F classic bench 70.50 kg / 122.5 → **96.78**.
- Men's classic values were confirmed independently ([vCalc](https://www.vcalc.com/wiki/ipf-gl-formula-points-calculator)).
- The official GL model document could not be opened, so the adoption date is unverified ([IPF Points Proposal](https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_Points_Proposal.pdf)).

| IPF GL category | A | B | C |
|---|---|---|---|
| Men Classic 3-lift | 1199.72839 | 1025.18162 | 0.009210 |
| Men Equipped 3-lift | 1236.25115 | 1449.21864 | 0.01644 |
| Women Classic 3-lift | 610.32796 | 1045.59282 | 0.03048 |
| Women Equipped 3-lift | 758.63878 | 949.31382 | 0.02435 |
| Men Classic Bench | 320.98041 | 281.40258 | 0.01008 |
| Men Equipped Bench | 381.22073 | 733.79378 | 0.02398 |
| Women Classic Bench | 142.40398 | 442.52671 | 0.04724 |
| Women Equipped Bench | 221.82209 | 357.00377 | 0.02937 |

### Allometric alternatives and example outputs

**Allometric scaling:**
- `S_norm = S / m^b`, with **b = 0.67** for force ([Jaric 2002](https://doi.org/10.2165/00007256-200232100-00002)).
- `y = a − b·x^(−c)` fit IPF data without body-mass bias; the constants are not retrieved ([Cleather 2006](https://doi.org/10.1519/R-17545.1)).
- In 457,471 drug-tested lifters, empirical exponents were **0.55 (men) and 0.50 (women)**, falling to 0.47 and 0.41 for the all-time top 20. A simple allometric model matched IPF GL's independence from body mass in elite men [OBS] ([Montenegro 2026](https://doi.org/10.3389/fphys.2026.1847605)).

Cross-check values, recomputed during this synthesis:

| Lifter | Wilks | Wilks2020 | DOTS | GL (classic 3-lift) | Total / BW^0.67 |
|---|---|---|---|---|---|
| M, 83 kg, 700 | 467.25 | 561.15 | 472.56 | 96.90 | 36.25 |
| M, 100 kg, 800 | 486.87 | 583.49 | 492.41 | 101.06 | 36.57 |
| F, 63 kg, 400 | 429.58 | 511.45 | 430.21 | 87.51 | 24.92 |
| F, 76 kg, 450 | 424.29 | 520.63 | 435.25 | 88.72 | 24.72 |

**Implementation [INF]:**
- Use kg internally.
- Select coefficients by sex × equipment × event, apply the OPL clamps (documented as an implementation choice), and floor IPF and GL at 0.
- Labels: "IPF GL Points (official IPF 2020+)", "DOTS" as the common non-IPF meet standard, and Wilks/Wilks2020 as legacy.
- **Ship all test vectors as automated tests.**
- Label Wilks or DOTS applied to a single squat or deadlift as "informal".
- Offer `kg / BW^0.67` (or 0.55/0.50) as a transparent index.

### Strength standards: one peer-reviewed set, the rest are labelled heuristics

**van den Hoek 2024** gives percentile norms from 809,986 drug-tested, unequipped entries [OBS] ([van den Hoek 2024](https://doi.org/10.1016/j.jsams.2024.07.005)):
- Percentiles 10th–90th, by sex, age class and weight class.
- At the **90th percentile, ages 18–35**: squat **2.83× BW (men) / 2.26× (women)**, bench **1.95× / 1.35×**, deadlift **3.25× / 2.66×**.
- Over-80s at the 90th percentile: 1.72 / 1.01, 1.31 / 0.92 and 2.30 / 1.68.
- **The full per-class tables must be extracted from the paper or thestrengthinitiative.com, and licensing checked.**

**Other competition data:**
- First-meet relative totals were **5.89 ± 1.04 (men) and 4.27 ± 0.85 (women) × BW** (absolute 513.3 / 289.4 kg) ([Latella 2020](https://doi.org/10.1519/JSC.0000000000003657)).
- Local-to-national differences were moderate to large, national-to-international negligible, and within-category CV of totals was 17.4–22.9% ([Latella, van den Hoek & Teo 2019](https://doi.org/10.1519/JSC.0000000000002823)).
- Lift-to-bodyweight ratio falls with bodyweight, and performance peaks at about age 24–49 ([Ball & Weidman 2018](https://doi.org/10.1519/JSC.0000000000002103)).
- Ferland 2020 tabulates performance by weight class ([Ferland 2020](https://doi.org/10.70252/XGHM8852)).
- Santos Junior's possible benchmarks (bench 120% and squat 150% of body mass) are unconfirmed ([ResearchGate](https://www.researchgate.net/profile/Evaldo-Junior-3/publication/349287497_Classification_and_Determination_Model_of_Resistance_Training_Status/links/6029329b299bf1cc26c4894e/Classification-and-Determination-Model-of-Resistance-Training-Status.pdf)).

**Not peer-reviewed** (label as such in the app) [PRACT]:
- **ExRx/Kilgore** tables ([ExRx](https://exrx.net/Testing/WeightLifting/StrengthStandards.htm)).
- **StrengthLevel**, which uses percentiles of self-reported user lifts: Beginner > 5%, Novice > 20%, Intermediate > 50%, Advanced > 80%, Elite > 95% ([StrengthLevel](https://strengthlevel.pt/sobre)).
- **Symmetric Strength**, which has no primary methodology page ([FitnessVolt](https://fitnessvolt.com/strength-standards/methodology)).

**Display [INF]:**
- Show percentiles against van den Hoek, labelled "relative to competitive drug-tested lifters".
- Optional app-convention bands: < 10th percentile "developing", 10–50th "competitive", 50–90th "advanced", > 90th "elite".
- Use Latella's first-meet totals as a "typical first meet" benchmark.
- Bodybuilders' 1RMs may sit below these norms at equal muscularity.

## Nutrition logic: set protein first, derive energy from the weight trend, enforce safety limits

### Protein: 1.6 g/kg covers most lifters; cutting raises the target

**Evidence:**
- **Morton 2018** [MA, 49 RCTs, n = 1,863]: protein supplementation during resistance training added +2.49 kg to 1RM and +0.30 kg FFM, and trained lifters gained +0.75 kg FFM. FFM gains plateaued at a **breakpoint of 1.62 g/kg/day**. An erratum exists ([PubMed 28698222](https://pubmed.ncbi.nlm.nih.gov/28698222/)).
  - The upper target of about 2.2 g/kg comes from the upper confidence limit of that breakpoint ([Schoenfeld & Aragon 2018](https://pubmed.ncbi.nlm.nih.gov/29497353/); [Slater 2019](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2019.00131/full)).
  - The often-quoted 95% CI of 1.03–2.20 was **not verified** in the abstract.
- **Nunes 2022** [MA, 74 RCTs]: lean-mass gains appeared at ≥ 1.6 g/kg in adults under 65 and at 1.2–1.59 in those 65 and over ([PubMed 35187864](https://pubmed.ncbi.nlm.nih.gov/35187864/)).
- **Tagawa 2021** [MA]: below 1.3 g/kg, each +0.1 g/kg added +0.39 kg lean body mass (LBM); above 1.3, only +0.12 kg ([PubMed 33300582](https://pubmed.ncbi.nlm.nih.gov/33300582/)).
- **Tagawa 2022** [MA]: strength rose about 0.72% per +0.1 g/kg up to 1.5 g/kg. Several authors were employed by Meiji, the industry sponsor ([PubMed 36057893](https://pubmed.ncbi.nlm.nih.gov/36057893/)).
- **ISSN** [POS] recommends 1.4–2.0 g/kg for building muscle, **2.3–3.1 g/kg when hypocaloric**, and 20–40 g per dose (700–3,000 mg leucine) every 3–4 h. It also recommends 30–40 g casein before sleep ([Jäger 2017](https://pubmed.ncbi.nlm.nih.gov/28642676/)).
- **IOC** [POS] calls 1.6 g/kg optimal and up to 2.2 g/kg well tolerated, at 0.3–0.5 g/kg per meal 3–4 times a day ([Maughan 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5867441/)).

**In a deficit:**
- Lean trained lifters need about **2.3–3.1 g/kg FFM**, scaled up with leanness and the size of the deficit. FFM fell 0.3–2.7 kg in 9 of 13 dieting groups [SR, 6 studies] ([Helms 2014](https://pubmed.ncbi.nlm.nih.gov/24092765/)).
- Contest prep guidance: 2.3–3.1 g/kg LBM, fat at 15–30% of kcal, 3–6 meals ([Helms, Aragon & Fitschen 2014](https://pubmed.ncbi.nlm.nih.gov/24864135/)).
- Physique athletes: 1.8–2.7 g/kg over 4–5 feedings ([Roberts 2020](https://pubmed.ncbi.nlm.nih.gov/32148575/)).
- Bodybuilders often exceed the guidelines, but research in this group is limited ([Ribeiro 2019](https://pubmed.ncbi.nlm.nih.gov/31028659/)).

**Per meal:**
- Aim for at least 0.4 g/kg per meal across at least 4 meals, and up to 0.55 g/kg at 2.2 g/kg/day ([Schoenfeld & Aragon 2018](https://pubmed.ncbi.nlm.nih.gov/29497353/)).
- After whole-body exercise, 100 g protein produced a larger and more prolonged (> 12 h) anabolic response than 25 g. This weakens the idea of a hard 20–25 g ceiling per meal ([Trommelen 2023](https://pubmed.ncbi.nlm.nih.gov/38118410/)).
- Timing effects vanish once total protein is controlled [MA] ([Schoenfeld 2013](https://pubmed.ncbi.nlm.nih.gov/24299050/)).

**Safety:**
- High protein showed no kidney harm in healthy adults (GFR SMD 0.19) [MA] ([Devries 2018](https://pubmed.ncbi.nlm.nih.gov/30383278/)).
- Intakes above about 2.5 g/kg are not validated for health. Above 3.0 g/kg, thermogenesis rises by about 120 kcal/day ([Slater 2019](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2019.00131/full)).

**Defaults [INF]:**
- Maintenance or bulk: **1.6 g/kg BW** (configurable 1.6–2.2).
- Cut: **2.3–3.1 g/kg FFM** when FFM is known, otherwise **1.8–2.7 g/kg BW**.
- For obese users, base targets on FFM or an adjusted weight.
- Per meal: `perMeal = clamp(0.4·BW, 0.3·BW, 0.55·BW)`, `meals = ceil(daily/perMeal)` bounded to 3–6.
- Optional pre-sleep 30–40 g casein.
- Present distribution as secondary to the daily total.

### Bulking: small surplus, slow gain

**Evidence:**
- Natural bodybuilders [NARR] ([Iraki 2019](https://pubmed.ncbi.nlm.nih.gov/31247944/)):
  - surplus about **10–20%**;
  - gain **0.25–0.5% BW/week** for novices and intermediates, less for advanced lifters;
  - protein 1.6–2.2 g/kg at 0.40–0.55 g/kg per meal;
  - fat 0.5–1.5 g/kg; carbohydrate ≥ 3–5 g/kg.
- **Helms 2023** [RCT-T, 17 completers]: maintenance vs +5% vs +15% energy showed no difference in muscle thickness or squat. Bench improved more with +15%, and skinfolds rose more with +15% than at maintenance. Bodyweight change predicted skinfold change (R² 0.49) better than biceps thickness (R² 0.24) ([PubMed 37914977](https://pubmed.ncbi.nlm.nih.gov/37914977/)).
- **Garthe 2013** [RCT, elite athletes]: a counselled surplus raised BW +3.9% vs +1.5% and fat mass **+15% vs +3%**, with **no lean-mass difference** ([PubMed 23679146](https://pubmed.ncbi.nlm.nih.gov/23679146/)).
- **Slater 2019** [NARR]:
  - Textbook surpluses are 1,500–2,000 kJ (≈360–480 kcal) per day, or about 950 kcal for "hard gainers".
  - Muscle stores about 1,200–1,240 kcal/kg, or about 1,450–1,780 kcal/kg including synthesis costs.
  - Overfeeding without training adds about 2 kg fat per 1 kg lean.
  - Carbohydrate 4–7 g/kg.
  - Fat should not go below 15–20% of energy: cutting fat from 33.3% to 13.9% lowered testosterone.
  - Source: [Frontiers](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2019.00131/full).

**Bulk logic [INF]:**
- Target rate: novice 0.5% BW/week, intermediate 0.25–0.5%, advanced 0.1–0.25%.
- `kcal_surplus = rate × BW × ρ_gain / 7`, with ρ_gain ≈ 5,000–7,000 kcal/kg (an assumption). Example: 80 kg × 0.25% → 140–200 kcal/day.
- Cap the surplus at 20% of TDEE. After the first estimate, adjust from the weight trend.
- Warn when the trend exceeds about 0.5% per week (novice) or 0.25–0.35% per week (advanced) for 3 weeks or more.

### Cutting: 0.5–1% per week, slower when lean

**Evidence:**
- Contest prep target: lose **0.5–1% BW/week** ([Helms, Aragon & Fitschen 2014](https://pubmed.ncbi.nlm.nih.gov/24864135/)).
- **Garthe 2011** [RCT, elite athletes]: slow (0.7%/week target) vs fast (1.4%/week). LBM **+2.1% vs −0.2%** ([PubMed 21558571](https://pubmed.ncbi.nlm.nih.gov/21558571/)), and upper-body strength +12% vs +6% ([follow-up](https://pubmed.ncbi.nlm.nih.gov/21896944/)).
- **Murphy & Koehler 2022** [MA]: an energy deficit reduced lean-mass gains (ES −0.57) but not strength (ES −0.31, n.s.). **A deficit of about 500 kcal/day prevented lean-mass gains** ([PubMed 34623696](https://pubmed.ncbi.nlm.nih.gov/34623696/)).
- **Diet breaks (ICECAP)** [RCT-T, n = 61]: 4 × 3-week diet blocks with 1-week maintenance breaks vs continuous dieting gave the **same fat and FFM outcomes, with less hunger** ([Peos 2021](https://pubmed.ncbi.nlm.nih.gov/33587549/)). In a secondary analysis, a maintenance week added +0.6 kg BW, likely water and glycogen ([Peos 2021 PLoS One](https://pubmed.ncbi.nlm.nih.gov/33630880/)).
- **MATADOR** (men with obesity): 2 weeks on / 2 weeks off restriction lost more fat (12.3 vs 8.0 kg) than continuous restriction ([Byrne 2018](https://pubmed.ncbi.nlm.nih.gov/28925405/)).
- Physique prep: fat 10–25% of kcal. A "≤ 0.5%/week" target was reported only by automated abstract extraction; **verify it** ([Roberts 2020](https://pubmed.ncbi.nlm.nih.gov/32148575/)).
- Strength athletes' intakes should be individualised ([Slater & Phillips 2011](https://pubmed.ncbi.nlm.nih.gov/21660839/)).

**Cut logic [INF]:**
- Default rate 0.5–0.7% BW/week; allowed range 0.25–1.0%.
- **Hard warning above 1.0%/week sustained for ≥ 2 weeks.**
- Soft warning above 0.7%/week when estimated body fat is below about 12% (men) or 20% (women). These cut-offs are inferred.
- `kcal_deficit ≈ rate × BW × ρ_loss / 7`, with ρ_loss = 7,700 kcal/kg (lower in lean users). Example: 80 kg at 0.5% ≈ 440 kcal/day. The app should explain that the aim of a cut is to retain muscle, not gain it.
- Macro order: protein → fat floor `max(0.5 g/kg, 15–20% kcal)`, default 20–30% → carbohydrate as the remainder. Flag carbohydrate below 3 g/kg in high-volume phases.
- Offer 1-week diet breaks every 3–8 weeks to help with adherence, and do not read the resulting +0.5–1 kg as fat regain.

### Energy-expenditure equations and adaptive TDEE

| Equation | Formula (kcal/day; W kg, H cm unless stated, A years) | Population / accuracy | Tag |
|---|---|---|---|
| Mifflin–St Jeor | Men `10W + 6.25H − 5A + 5`; women `10W + 6.25H − 5A − 161`; FFM form `19.7·FFM + 413` | 498 healthy adults; Harris-Benedict overestimated by 5% | [OBS] ([PubMed 2305711](https://pubmed.ncbi.nlm.nih.gov/2305711/)) |
| Tinsley 2019 | `24.8·BW + 10`; `25.9·FFM + 284` | 27 physique athletes; most general equations underestimated | [OBS] ([PubMed 30240568](https://pubmed.ncbi.nlm.nih.gov/30240568/)) |
| ten Haaf & Weijs 2014 | `11.936·W + 587.728·H(m) − 8.129·A + 191.027·sex + 29.279` (male = 1); FFM `22.771·FFM + 484.264` | 90 recreational athletes; ~83% within ±10% vs < 50% for Harris-Benedict, WHO, Schofield, Mifflin, Owen | [OBS] ([PLoS One](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0108460); kcal coefficients via [Martinho 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10286600/)) |
| Cunningham 1991 ("Katch-McArdle") | `370 + 21.6·FFM` | FFM explains 65–90% of REE | [OBS] ([PubMed 1957828](https://pubmed.ncbi.nlm.nih.gov/1957828/)) |
| Roza & Shizgal 1984 (revised Harris-Benedict) | Commonly men `88.362 + 13.397W + 4.799H − 5.677A`; women `447.593 + 9.247W + 3.098H − 4.330A` (**unverified coefficients**) | ±14% precision | [OBS] ([PubMed 6741850](https://pubmed.ncbi.nlm.nih.gov/6741850/)) |

**Notes on the table:**
- A synthesis check confirms the ten Haaf kcal coefficients equal the kJ originals ÷ 4.184 (49.940 → 11.936; 2459.053 → 587.73).
- Athlete reviews rate **De Lorenzo and ten Haaf & Weijs** as the most appropriate equations. General equations were "not comparable" with measured REE in athletes [SR] ([Martinho 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10286600/)).
- The commonly quoted forms of Cunningham 1980 (`500 + 22·FFM`) and De Lorenzo (`−857 + 9.0W + 11.7H`) are **unverified**.
- Activity multipliers (1.2 / 1.375 / 1.55 / 1.725 / 1.9) and the FAO/WHO physical activity level (PAL) bands (1.40–1.69 / 1.70–1.99 / 2.00–2.40) are **unsourced seeds; verify before hard-coding**.

**Energy content of weight change:**
- The "3,500 kcal/lb" rule (≈ 7,700 kcal/kg) fits only people with more than about 30 kg of fat. The energy densities are fat 9,440 kcal/kg and lean 1,816 kcal/kg, so lean people need a smaller deficit per kg lost (e.g. about 5,900 kcal/kg) [MODEL] ([Hall 2008](https://pmc.ncbi.nlm.nih.gov/articles/PMC2376744/)).
- A model using demographics and repeated bodyweights estimated intake change **within 40 kcal/day** of doubly labelled water over 2 years. Individual RMSD was 215 kcal/day [MODEL validation] ([Sanghvi 2015](https://pubmed.ncbi.nlm.nih.gov/26040640/)).

```text
// Equation selection and adaptive TDEE [INF; principle supported by Hall 2008, Sanghvi 2015]
RMR = FFM known ? mean(25.9·FFM + 284, 22.771·FFM + 484.264)
    : athlete   ? tenHaaf_weight(H in metres)  (or 24.8·BW + 10 for very muscular users)
    :             Mifflin
show ±10–15% band; TDEE_seed = RMR × PAL (unverified multipliers)
window      = last 14–28 days with ≥ 70% intake-logging compliance (impute/exclude unlogged days)
intake_mean = mean(logged kcal over window)
dW          = trend[end] − trend[start]               // kg, from the smoothed trend below
rho         = 7700 kcal/kg default; lean cut 5500–7000; gaining with RT ~5000–7000 (assumptions)
TDEE_est    = intake_mean − rho × dW / days
TDEE        = blend(prior, TDEE_est) via Kalman/Bayesian update or EMA (α ≈ 0.1–0.2 per week)
exclude/flag windows: creatine start (+1–2 kg water), diet-break/refeed weeks (+0.5–0.7 kg),
             first 1–2 weeks of a large carb change, menstrual water shifts, meet water cuts
```

The sensitivity is small. A 1,000 kcal/kg error in ρ at 0.3 kg/week shifts TDEE by only about 43 kcal/day.

### Bodyweight trend smoothing

**Evidence:**
- Day-to-day fluctuation scales with body size. One-day changes "rarely exceeded" about 1.5% BW, and one subject's SD was about 0.5% [OBS] ([Khosla & Billewicz 1964](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/4E78A0DB251133BEF39D73EB50C2F8A2/S0007114564000228a.pdf/div-class-title-measurement-of-change-in-body-weight-div.pdf)).
- Weight peaks on Sunday and Monday, with about **0.35%** within-week swing [OBS] ([Orsama 2014](https://pubmed.ncbi.nlm.nih.gov/24504358/)).
- The Hacker's Diet recommends an exponentially smoothed average with a smoothing constant of 0.9, "roughly equivalent to a 20 day simple moving average" in lag [PRACT] ([Walker](https://www.fourmilab.ch/hackdiet/e4/signalnoise.html)).
- **No peer-reviewed study validates any smoothing parameter.**

```text
// Weight trend [INF; equivalent to Hacker's Diet when Δt = 1 day]
α_day  = 0.1                    // 0.1–0.15 in loss phases; 0.05–0.1 for slow bulks
α_eff  = 1 − (1 − α_day)^Δdays  // handles missed days
trend  = trend_prev + α_eff × (w_today − trend_prev)
init   = mean(first 3–7 weigh-ins)
outlier: winsorize readings > ~2–2.5% from trend before updating
rate   = linear regression slope over last 14–28 days → kg/wk and %BW/wk
```

Ask for morning weigh-ins after voiding. Make the trend and weekly rate the primary display, and never alert on a single day's weight.

### Body composition: trend-only estimates and the FFMI benchmark

**US Navy circumference equations (inches, verified)** (Hodgdon & Beckett, via [Potter 2022](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.868627/full)):
- **Men:** `%BF = 86.010·log10(abdomen − neck) − 70.041·log10(height) + 36.76`, with the abdomen measured at the umbilicus.
- **Women:** `%BF = 163.205·log10(waist + hip − neck) − 97.684·log10(height) − 78.387`. Potter's printed female form omits the hip, which looks like a transcription error.
- SEE is about 3–4% body fat.

How well it performs against DXA in 609 Marines [OBS]:
- Bias was **−2.6 ± 3.7 points in men and +1.3 to +2.3 in women**, with concordance of 0.51–0.57 in men.
- It **overestimates fat in lean people and underestimates it in fatter people**, and it failed to track change in an Army study.
- BIA was more accurate.

**Metric Navy form (unverified coefficients):**
- Men: `%BF = 495/(1.0324 − 0.19077·log10(waist − neck) + 0.15456·log10(height)) − 450`.
- Women: `%BF = 495/(1.29579 − 0.35004·log10(waist + hip − neck) + 0.22100·log10(height)) − 450`.
- A synthesis spot-check of six cases agreed with the verified inch forms within 0.1–0.4 points. Either form is usable, but **verify before hard-coding**.

**Skinfolds, Jackson–Pollock (JP):**
- Only the JP3 men's intercept (1.10938) was verified. The original validation SEE was about 3.4% (men) and 3.9% (women).
- Cross-validation against DXA showed ethnic bias ([PubMed 18702849](https://pubmed.ncbi.nlm.nih.gov/18702849/)).
- The other coefficients are **unverified** (Jackson & Pollock 1978; Jackson, Pollock & Ward 1980). S = sum of skinfolds in mm, A = age in years:
  - JP3 men (chest, abdomen, thigh): `BD = 1.10938 − 0.0008267S + 0.0000016S² − 0.0002574A`.
  - JP3 women (triceps, suprailiac, thigh): `BD = 1.0994921 − 0.0009929S + 0.0000023S² − 0.0001392A`.
  - JP7 men: `BD = 1.112 − 0.00043499S + 0.00000055S² − 0.00028826A`.
  - JP7 women: `BD = 1.097 − 0.00046971S + 0.00000056S² − 0.00012828A`.
- Convert body density with Siri `%BF = 495/BD − 450` or Brozek `457/BD − 414.2` (Brozek unverified).
- Raw skinfold sums are recommended for applied practice ([Kasper 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8065383/)).
- No body-composition cut-off conferring a performance advantage exists, and practitioners have moved away from focusing on %BF ([Mathisen 2023](https://pubmed.ncbi.nlm.nih.gov/37752006/)).

**FFMI** [OBS] ([Kouri 1995](https://pubmed.ncbi.nlm.nih.gov/7496846/)):
- `FFM = BW·(1 − %BF/100)`; `FFMI = FFM/H²`; `normalized FFMI = FFMI + 6.3·(1.80 − H)`.
- The abstract says 6.3; most calculators use 6.1. The difference is about 0.02 at 1.70 m, so pick one and document it.
- Non-users' normalised FFMI extended "up to a well-defined limit of **25.0**", and pre-steroid-era Mr. America winners averaged 25.4.
- **Label 25 as an observation from a single 1995 male sample, not a limit or a doping test.**
- Do not compute FFMI for users under 18.

**BMI** misclassifies lifters. A 1.80 m man at FFMI 25 and 10% body fat weighs 90 kg, which gives BMI 27.8 ("overweight", recomputed here). Do not use BMI in health messaging.

**Display:** show %BF ±3–4 points with a "trend only" label.

### Weight cuts for powerlifting meets

**How common and how large cuts are:**
- **85.8% of 321 powerlifters cut, losing 3.0 ± 1.9% BW**. Common methods were fluid restriction (54% always) and water loading (49%); coaches and online sources were most influential [OBS] ([Nolan 2022](https://pubmed.ncbi.nlm.nih.gov/31904717/)).
- **97%** of British IPF lifters cut, typically 4.2%. The highest-ever losses were 6.7% (women) and 5.3% (men), about 70% of lifters perceived the cut negatively, and the authors caution against losses above 5% [OBS] ([Campbell 2025](https://pubmed.ncbi.nlm.nih.gov/37697737/)).
- At IPF Worlds, lifters lost −2.5% in the final week, and larger cuts were associated with worse stress and recovery scores [OBS] ([Kwan 2026](https://pubmed.ncbi.nlm.nih.gov/41894735/)).

**Effect on performance:** a 4-day cut of **−4.81% BW** (10% calorie deficit, < 50 g carbohydrate, low sodium, fluid manipulation) followed by 2 h of recovery caused **no change in squat, bench, deadlift or total** in men [RCT] ([Matras 2025](https://pubmed.ncbi.nlm.nih.gov/40864504/)).

**ACSM 2021 consensus** [POS] ([LJMU PDF](https://researchonline.ljmu.ac.uk/id/eprint/17789/1/ACSM%20Consensus%20Statement%20Weight%20Making.pdf); [PubMed 33790193](https://pubmed.ncbi.nlm.nih.gov/33790193/)):
- **2–3% BM** via fluid loss "likely to have few disadvantages" with aggressive recovery.
- **> 3% "may have substantial negative implications"**.
- IPF weigh-in is ≥ 2 h before lifting.
- Rehydration: about **150% of the fluid deficit**, with sodium (≈ 50–60 mmol/L or salty foods). Start with a **10 mL/kg bolus**. Adding protein helps fluid retention.
- Refuelling: about **1 g/kg/h carbohydrate**, plus **20–25 g protein**. A 2-h rowing example used 2.3 g/kg carbohydrate, 25–28 mL/kg fluid and 34 mg/kg sodium.
- Saunas, plastic suits, laxatives, emetics, diuretics and IV rehydration are discouraged or banned.
- The NCAA caps loss at **≤ 1.5% BM/week**.
- A decision tree exists, but its thresholds were not retrieved ([Reale 2017](https://pubmed.ncbi.nlm.nih.gov/27347784/)).

**Meet-cut planner [INF]:**
- Required loss = (trend − class limit) / trend.
- The chronic diet covers any amount above about 3% (2-h weigh-in) or about 5% (24-h weigh-in; inferred), at ≤ 0.5–1% per week.
- Acute cut ≤ 2–3%. **Warn above 3%; strong warning or block above 5%**, and for any sauna, diuretic or laxative plan.
- Post-weigh-in checklist:
  - fluid ≈ 1.5 L per kg lost, starting with the 10 mL/kg bolus;
  - an oral rehydration solution;
  - carbohydrate about 1 g/kg/h (about 2–2.5 g/kg over 2 h);
  - 20–25 g protein;
  - low-fibre, low-fat foods.
- Suggest a weight class at or within 2–3% above the user's off-season trend.

### Supplements and timing

**Creatine** [POS/MA]:
- Dosing: 3–5 g/day, or load at about 20 g/day in 4 doses for 5–7 days. Expect +1–2 kg, mostly water ([IOC: Maughan 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5867441/); [PubMed 29540367](https://pubmed.ncbi.nlm.nih.gov/29540367/)).
- Safety: up to 30 g/day for 5 years is described as safe ([Kreider 2017](https://pubmed.ncbi.nlm.nih.gov/28615996/)).
- Effects:
  - LBM +1.10 kg when combined with resistance training; **men +1.46 kg, women +0.29 kg (n.s.)** ([Delpino 2022](https://pubmed.ncbi.nlm.nih.gov/35986981/));
  - upper-limb strength ES 0.317 ([Lanhers 2017](https://pubmed.ncbi.nlm.nih.gov/27328852/)).

**Caffeine:** **3–6 mg/kg about 60 min before training**. The minimum effective dose is about 2 mg/kg, and **≥ 9 mg/kg adds side effects without benefit** [POS] ([Guest 2021](https://pubmed.ncbi.nlm.nih.gov/33388079/)).

**Beta-alanine** (4–6 g/day) mainly helps 1–4 min efforts, so it is of low relevance to 1RM work ([Trexler 2015](https://pubmed.ncbi.nlm.nih.gov/26175657/)).

**Citrulline:** ≥ 3 g at least 30 min before training gives a small strength/power effect, g = 0.20 [MA] ([Trexler 2019](https://pubmed.ncbi.nlm.nih.gov/30895562/)).

**Vitamin D** is test-and-treat only.

**Contamination:** about **15% of more than 600 products contained undeclared prohormones**, which matters for drug-tested lifters ([IOC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5867441/)).

**Carbohydrate:**
- Carbohydrate rarely improves strength performance, though higher-volume sessions may benefit [SR, 49 studies] ([Henselmans 2022](https://pubmed.ncbi.nlm.nih.gov/35215506/)).
- Higher carbohydrate had no independent hypertrophy effect (SMD 0.15, low certainty) [MA] ([Henselmans 2026](https://pubmed.ncbi.nlm.nih.gov/41712097/)).

**Practical guides:**
- Carbohydrate: 3–7 g/kg — 3–5 in a cut, 4–7 in a bulk ([Slater 2019](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2019.00131/full)).
- Timing: a "protein near training" nudge ([Roberts 2020](https://pubmed.ncbi.nlm.nih.gov/32148575/)).
- Never rank carbohydrate targets above protein or energy.

### Sex-specific considerations

**Menstrual cycle:**
- Performance in the early follicular phase is only trivially lower (ES −0.06, low-quality evidence) [MA] ([McNulty 2020](https://pubmed.ncbi.nlm.nih.gov/32661839/)).
- No phase effect on strength or adaptations [umbrella review] ([Colenso-Semple 2023](https://pubmed.ncbi.nlm.nih.gov/37033884/)).
- Myofibrillar protein synthesis does not differ by phase ([Colenso-Semple 2025](https://pubmed.ncbi.nlm.nih.gov/39630025/)).

**Policy [INF]:**
- Offer optional cycle logging, used only to annotate weight noise and readiness, never to change macros.
- Use the female-specific equations.
- Apply RED-S prompts to every user, with emphasis for women.

### Safety thresholds

**Energy availability (EA) and RED-S:**
- `EA = (energy intake − exercise energy expenditure) / FFM`. **Below 30 kcal/kg FFM/day is "low"; about 45 is "optimal"**. The 30 threshold comes from studies of sedentary women and is debated [NARR] ([Areta, Taylor & Koehler 2021](https://researchonline.ljmu.ac.uk/id/eprint/14136/1/Low%20energy%20availability%20history,%20definition%20and%20evidence%20of%20its%20endocrine,%20metabolic%20and%20physiological%20effects%20in%20prospective%20studies%20in%20females%20and%20males.pdf)).
- The 2023 IOC consensus on relative energy deficiency in sport (REDs) includes the CAT2 traffic-light tool [POS] ([Mountjoy 2023](https://pubmed.ncbi.nlm.nih.gov/37752011/); [Stellingwerff 2023](https://pubmed.ncbi.nlm.nih.gov/37752002/)).
- MPS fell about 30% after 5 days at 30 kcal/kg FFM ([Slater 2019](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2019.00131/full)).

**Guardrails [INF]; evidence-informed design choices, not clinical cut-offs:**
1. Warn when EA < 30; soft-warn at 30–45 during cuts.
2. Warn when loss exceeds 1.0% BW/week for ≥ 2 weeks; strong warning above 1.5%/week.
3. Warn when the kcal target is below estimated RMR (practitioner convention).
4. Flag fat below 0.5 g/kg or 15% of kcal.
5. Acute cut: warn above 3%; strong warning or refusal above 5%. Always discourage saunas, diuretics, laxatives, vomiting and IV rehydration.
6. Cap caffeine below 9 mg/kg.
7. Refer to a clinician for amenorrhea, bone-stress injury or disordered-eating cues.
8. Show an "information, not medical advice" disclaimer.

The common 1,200 / 1,500 kcal floors are unsourced.

## Consolidated default parameters for the planning agent

Every value below should ship as **configuration data, not code**. Each row carries its evidence tag and a source ID, so values can be updated when the preprints are published or new trials appear. "Guard" means a soft or hard warning threshold.

### Load, e1RM and change detection

| Parameter | Default | Range / guard | Evidence | Key sources |
|---|---|---|---|---|
| e1RM formula | Wathan on r_eff (equivalent to the RTS chart); r_eff = 1 at RIR 0 → e1RM = w | Epley/Brzycki acceptable at r_eff ≤ 6; Marzagao weight-dependent formula experimental only | [PRACT] formulas, [OBS] validation, [INF] | [Mayhew 2008](https://pubmed.ncbi.nlm.nih.gov/18714230/); [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf) |
| Effective reps | r_eff = reps + RIR (RIR = 10 − RPE) | Unknown RIR → assume 2–3 or mark non-informative | [OBS] scale definition, [INF] | [Zourdos 2016](https://pubmed.ncbi.nlm.nih.gov/26049792/) |
| Set weighting | 1.0 if RPE ≥ 8 and r_eff ≤ 8; 0.5 if RPE 7–7.5 or r_eff 9–12 | ≤ 0.1 or exclude if RPE ≤ 6 or r_eff > 12–15; down-weight non-first sets | [MA] + [INF] | [Halperin 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/) |
| RIR bias correction | 0 for reported RIR ≤ 2 (trained) | +0.5–1 for RIR ≥ 3; learn per user from AMRAP calibration | [MA] + [RCT] | [Halperin 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/); [Refalo 2024](https://pubmed.ncbi.nlm.nih.gov/37967832/) |
| Load for target | e1RM × pct(target reps + target RIR), rounded to plate inventory | Leg press / machine lower body: use Nuzzo leg-press curve or the user's own curve | [MA] + [INF] | [Nuzzo 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212) |
| Smoothing noise | 3–5% (heavy, low-rep, RPE ≥ 9 sets); 8–10% (typical logged sets) | Exercise-specific kg noise (squat and leg press > bench) | [SR] + [PREPRINT] | [Grgic 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7367986); [Marzagao 2026](https://arxiv.org/pdf/2603.17495) |
| "Likely real" change | > 1 TE (≈ 2–4% trained) sustained ≥ 2–3 sessions | "Very likely" > 2.8 TE (6–9% trained; 11–15% novice) | [SR] + [INF] | [Hopkins 2000](https://pubmed.ncbi.nlm.nih.gov/10907753/) |
| Re-anchoring | Refresh per-exercise correction on any RPE ≥ 9 single or triple | Flag e1RM jumps that coincide with a rep-range change | [OBS] + [INF] | [Braith 1993](https://pubmed.ncbi.nlm.nih.gov/8423746/) |

### Volume, frequency, load and effort

| Parameter | Default | Range / guard | Evidence | Key sources |
|---|---|---|---|---|
| Hypertrophy weekly sets per muscle (fractional) | 10–20 | Floor 4; high band 20–30; soft warning > 30; hard warning > 40 | [MA] (preprint numbers: verify) | [Pelland 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/); [preprint](https://sportrxiv.org/index.php/server/preprint/view/460) |
| Set counting | Primary 1.0, synergist 0.5; show direct and fractional | 0.25 optional, unvalidated | [MA] | [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460) |
| Strength sets per competition lift per week | 4–10 direct heavy sets | Minimum 3–6 (powerlifters); returns plateau above ~5 | [MA] + mixed-methods | [Androulakis-Korakakis 2021](https://pubmed.ncbi.nlm.nih.gov/34527944/) |
| Frequency, hypertrophy | ≥ 2 sessions per muscle per week | Personal preference at equal volume | [MA] | [Schoenfeld 2019](https://pubmed.ncbi.nlm.nih.gov/30558493/) |
| Frequency, strength | 2–3 sessions per lift per week | Little detectable gain above ~3 | [MA] | [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460) |
| Per-session cap, hypertrophy | ~11 fractional (~8 direct) sets per muscle | Soft nudge at 10–12: "consider another day" | [PREPRINT] | [Remmert 2025](https://sportrxiv.org/index.php/server/preprint/view/537) |
| Per-session cap, strength | ~2–3 direct heavy sets per lift | Add a session rather than more sets | [PREPRINT] | [Remmert 2025](https://sportrxiv.org/index.php/server/preprint/view/537) |
| Starting volume | User's recent logged average | Up to 1.2×; never +30–60% | [RCT-T] | [Scarpelli 2022](https://pubmed.ncbi.nlm.nih.gov/32108724/); [Barsuhn 2025](https://pubmed.ncbi.nlm.nih.gov/39665246/) |
| Maintenance | ~1/3 of normal volume, ≥ 1 session/week, keep load and effort | — | [RCT] + [NARR] | [Bickel 2011](https://pubmed.ncbi.nlm.nih.gov/21131862/); [Spiering 2021](https://pubmed.ncbi.nlm.nih.gov/33629972/) |
| Hypertrophy rep range | 6–15 compound; 8–20 isolation | Allowed 5–30; flag < 30% 1RM; > 20 reps counts as hard only at ≤ 2 RIR | [MA] + [INF] | [Lopez 2021](https://pubmed.ncbi.nlm.nih.gov/33433148/); [Lasevicius 2018](https://pubmed.ncbi.nlm.nih.gov/29564973/) |
| Strength load | ≥ 80% 1RM (1–6 reps) for main work; accessories 6–12 reps | — | [MA] + [POS] | [ACSM 2026](https://pubmed.ncbi.nlm.nih.gov/41843416/) |
| Hypertrophy RIR | 1–2 | 0 allowed on last isolation/machine set; > 4 RIR = reduced stimulus | [MA] + [RCT-T] | [Robinson 2024](https://pubmed.ncbi.nlm.nih.gov/38970765/) |
| Strength RPE | 6–9 (1–4 RIR); heavy singles RPE 8–9.5 | No failure on competition lifts | [MA] | [Robinson 2024](https://pubmed.ncbi.nlm.nih.gov/38970765/) |

### Progression, autoregulation and VBT

| Parameter | Default | Range / guard | Evidence | Key sources |
|---|---|---|---|---|
| Accessory progression | Double progression; all sets at top of range at target RIR → add smallest increment | ACSM: +2–10% when 1–2 reps over target | [RCT-T] + [POS] | [Plotkin 2022](https://pubmed.ncbi.nlm.nih.gov/36199287/); [ACSM 2009](https://pubmed.ncbi.nlm.nih.gov/19204579/) |
| Main-lift progression | RPE-based load from e1RM | APRE preset; fixed % for beginners | [RCT-T] + [MA] | [Helms 2018](https://pubmed.ncbi.nlm.nih.gov/29628895/); [Zhang 2021](https://pubmed.ncbi.nlm.nih.gov/33776802/) |
| Increments | Novice +2.5–5 kg lower / +1–2.5 kg upper per session; intermediate +1–2.5%/week; advanced load jump every 2–4 weeks | Microplates 0.25–0.5 kg per side | [INF] | [McMaster 2013](https://pubmed.ncbi.nlm.nih.gov/23529287/) |
| Stall rule | 2 failed sessions → −5–10% and rebuild | — | [PRACT] | — |
| Periodization | Any model for hypertrophy; block plus within-week undulation for powerlifting | User-selectable | [MA] + [SURVEY] | [Moesgaard 2022](https://pubmed.ncbi.nlm.nih.gov/35044672/) |
| MVT priors (mean concentric velocity) | Squat 0.23–0.30; bench 0.10–0.17; deadlift 0.14 m/s | Learn per user | [OBS] | [Helms 2017](https://pubmed.ncbi.nlm.nih.gov/27243918/) |
| Velocity-loss presets | Peaking 10–20%; strength 20–30%; hypertrophy 25–40% | Stored per exercise | [MA] | [Jukic 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9807551); [Zhang 2023](https://pubmed.ncbi.nlm.nih.gov/36766912/) |
| Velocity readiness | Drop > 0.05–0.06 m/s or > 1 SD at fixed load → −2.5–5% load | Wider bands for camera apps | [INF] | [Sánchez-Medina 2011](https://doi.org/10.1249/MSS.0b013e318213f880) |
| Load–velocity 1RM prediction | Off | Never use for 1RM; no automatic MVT stop on bench or deadlift | [OBS] | [Banyard 2017](https://pubmed.ncbi.nlm.nih.gov/27669192/) |

### Deloads, tapering, attempts and returning from breaks

| Parameter | Default | Range / guard | Evidence | Key sources |
|---|---|---|---|---|
| Deload frequency | Every 4–6 weeks, ~1 week | User 3–8 weeks; reactive trigger = any 2 signals | [DELPHI/SURVEY] + [INF] | [Rogerson 2024](https://www.pubmed.gov/38499934/); [Bell 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/) |
| Deload content | Sets −40–60%; RIR +2–3; load 85–100% (or −10–20% for higher-rep work); same exercises and frequency | No complete-rest deloads for strength users | [INF] from [DELPHI/SURVEY] + [RCT-T] | [Coleman 2024](https://pubmed.ncbi.nlm.nih.gov/38274324/) |
| Taper | 7–14 days, volume −40–60%, intensity maintained | Last session 2–4 days out; avoid ≥ 5 days without bench | [MA] (endurance) + [OBS] | [Bosquet 2007](https://pubmed.ncbi.nlm.nih.gov/17762369/); [Travis 2021](https://pubmed.ncbi.nlm.nih.gov/34846328/) |
| Last heavy single | 90–92.5%: 7–10 days out (squat, deadlift); ~5–7 days (bench) | — | [SURVEY] | [Travis 2021](https://pubmed.ncbi.nlm.nih.gov/34846328/) |
| Attempts | Opener 90–92% of projected best; 2nd +4–6%; 3rd +2–4% (≤ 100–102%) | Warn on jumps > 20 kg (men) | [OBS] + [INF] | [Travis, Zourdos & Bazyler 2021](https://www.pubmed.gov/33095691/); [Howells 2022](https://www.pubmed.gov/33721983/) |
| Return from break | ≤ 7 days: resume; 8–14 days: 90–95% load, +1 RIR; 15–28 days: 85–90% load, 60–70% of sets; 5–8 weeks: 75–85% load, 50% volume over 3–4 weeks | — | [INF] | [McMaster 2013](https://pubmed.ncbi.nlm.nih.gov/23529287/); [Hwang 2017](https://pubmed.ncbi.nlm.nih.gov/28328712/) |

### Expectations and trainee classification

| Parameter | Default | Range / guard | Evidence | Key sources |
|---|---|---|---|---|
| Expected strength gain | Year 1 +10–30%; years 2–4 +5–10%/year; 5+ years +2–5%/year | Plateau flag: slope ≤ 0 over 8–12 weeks | [OBS] + [INF] | [Latella 2024](https://pubmed.ncbi.nlm.nih.gov/38060089/) |
| Trainee classification | e1RM slope ≥ 1%/week novice; 0.25–1% intermediate; < 0.25% advanced | Plus training age; user override | [INF] | [ACSM 2009](https://pubmed.ncbi.nlm.nih.gov/19204579/) |

### Session design

| Parameter | Default | Range / guard | Evidence | Key sources |
|---|---|---|---|---|
| Rest, strength | 3:00 (squat/deadlift 4:00) | 2:30–5:00; never < 2:00 on competition lifts | [SR] | [Grgic 2018](https://www.pubmed.gov/28933024/) |
| Rest, hypertrophy | Compound 2:30; isolation 1:30 | 2:00–3:00 / 1:00–2:00; short-rest mode 1:00 | [MA] + [RCT-T] | [Singer 2024](https://pubmed.ncbi.nlm.nih.gov/39205815/) |
| Tempo | 2-0-X-0 | Eccentric 1–4 s; warn if total rep > 8–10 s | [MA] + [RCT] | [Schoenfeld 2015](https://pubmed.ncbi.nlm.nih.gov/25601394/) |
| Range of motion | Full ROM with stretch emphasis | Lengthened partials optional, count 1.0 | [MA] + [RCT] | [Pallarés 2021](https://pubmed.ncbi.nlm.nih.gov/34170576/) |
| Exercise rotation | Fixed within a 4–8-week mesocycle; rotate 1–2 per muscle between mesocycles | Random rotation only as opt-in | [SR] + [RCT-T] | [Kassiano 2022](https://pubmed.ncbi.nlm.nih.gov/35438660/) |
| Exercise order | Priority → multi-joint → isolation → cardio | Free reordering for hypertrophy goals | [MA] | [Nunes 2021](https://pubmed.ncbi.nlm.nih.gov/32077380/) |
| Advanced-technique credit | Drop +0.5 per drop (cap 2.0); rest-pause +0.33–0.5 (cap 2.0); myo +0.33 (cap 2.5); cluster block 1.0; warm-up 0 | Configurable | [INF] | [Sødal 2023](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10390395/) |
| Warm-up ramp | Heavy: bar → 40/60/75/85% (+92–95%); compound: 40–50/70/(85)% | Warm-up sets excluded from all metrics | [RCT-T] acute + [INF] | [Ribeiro 2020](https://pubmed.ncbi.nlm.nih.gov/32971729/) |
| Static stretching | None by default | < 60 s per muscle if used | [SR] | [Behm 2016](https://pubmed.ncbi.nlm.nih.gov/26642915/) |
| Concurrent training | ≥ 6 h gap from lower-body lifting; lift first | Cardio soft cap 2–3 × ≤ 30–45 min/week (moderate) | [MA] + [INF] | [Petré 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8053170/) |

### Monitoring, readiness and safety flags

| Parameter | Default | Range / guard | Evidence | Key sources |
|---|---|---|---|---|
| Session RPE | Prompt 15–30 min after the session | Flag late entries | [RCT] method | [Day 2004](https://doi.org/10.1519/R-13113.1) |
| Readiness | Z-score vs 28-day baseline; z ≤ −1.0 "low"; z ≤ −1.5 or PRS ≤ 3 twice → modify | Needs ≥ 7–14 entries; never cancel a session on HRV alone | [PRACT] + [INF] | [Saw 2016](https://doi.org/10.1136/bjsports-2015-094758) |
| Spacing between hard sessions | Non-failure ≥ 24–48 h; failure or high volume ≥ 48–72 h; unaccustomed work 3–5+ days | +24 h in high-stress weeks | [RCT] + [INF] | [Morán-Navarro 2017](https://doi.org/10.1007/s00421-017-3725-7); [Refalo 2023](https://doi.org/10.1186/s40798-023-00554-y) |
| Sleep | < 6 h before a PM session → trim volume, skip max singles | ≥ 2 short nights → lower multi-joint expectations | [MA] + [SR] | [Craven 2022](https://doi.org/10.1007/s40279-022-01706-y) |
| ACWR | Neutral "% vs 4-week average" only | Hidden until 4 weeks of data; no risk zones | [MA critique] | [Impellizzeri 2021](https://doi.org/10.1007/s40279-020-01378-6) |
| Load spike | Weekly per-lift/muscle volume load or hard sets > 20–30% above 4-week average → "bigger jump than usual" | Never labelled as injury risk | [INF] | [Impellizzeri 2020](https://doi.org/10.1123/ijspp.2019-0864) |
| Pain alert | Same region ≥ 3/10 on ≥ 3 sessions in 14 days, or rising | Suggest variation, load reduction, clinician | [INF] from [OBS] | [Strömbäck 2018](https://doi.org/10.1177/2325967118771016) |
| Overreaching | Sustained performance decline over ≥ 2–3 sessions (~2 weeks) | Combine with wellness trend | [SR] | [Grandou 2020](https://doi.org/10.1007/s40279-019-01242-2) |
| Scoring display | IPF GL plus DOTS; Wilks/Wilks2020 marked as legacy | OPL clamps; floor at 0; unit tests shipped | [OFFICIAL] | [OPL goodlift.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/goodlift.rs) |

### Nutrition and body composition

| Parameter | Default | Range / guard | Evidence | Key sources |
|---|---|---|---|---|
| Protein, maintenance or bulk | 1.6 g/kg BW | 1.6–2.2 | [MA] | [Morton 2018](https://pubmed.ncbi.nlm.nih.gov/28698222/) |
| Protein, cut | 2.3–3.1 g/kg FFM (or 1.8–2.7 g/kg BW) | Base on FFM or adjusted weight for obese users | [SR] + [NARR] | [Helms 2014](https://pubmed.ncbi.nlm.nih.gov/24092765/) |
| Protein per meal | 0.4 g/kg | 0.3–0.55; 3–6 meals | [NARR] + [POS] | [Schoenfeld & Aragon 2018](https://pubmed.ncbi.nlm.nih.gov/29497353/) |
| Bulk rate | Novice 0.5%; intermediate 0.25–0.5%; advanced 0.1–0.25% BW/week | Surplus cap 20% of TDEE; warn above band for ≥ 3 weeks | [NARR] + [RCT] + [INF] | [Iraki 2019](https://pubmed.ncbi.nlm.nih.gov/31247944/); [Helms 2023](https://pubmed.ncbi.nlm.nih.gov/37914977/) |
| Cut rate | 0.5–0.7% BW/week | 0.25–1.0%; hard warn > 1.0% for ≥ 2 weeks; strong > 1.5% | [NARR] + [RCT] | [Garthe 2011](https://pubmed.ncbi.nlm.nih.gov/21558571/) |
| Fat floor | 20–30% of kcal | Flag < 0.5 g/kg or < 15% | [NARR] | [Slater 2019](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2019.00131/full) |
| Carbohydrate | Remainder after protein and fat; guide 3–5 g/kg (cut), 4–7 (bulk) | Low certainty | [SR] + [MA] | [Henselmans 2022](https://pubmed.ncbi.nlm.nih.gov/35215506/) |
| RMR equation | FFM: mean(Tinsley, ten Haaf); else ten Haaf weight-based; Mifflin fallback | Show ±10–15% band | [OBS] + [SR] | [Tinsley 2019](https://pubmed.ncbi.nlm.nih.gov/30240568/); [Martinho 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10286600/) |
| Energy density of weight change (ρ) | 7,700 kcal/kg | Lean cut 5,500–7,000; gaining 5,000–7,000 | [MODEL] + [INF] | [Hall 2008](https://pmc.ncbi.nlm.nih.gov/articles/PMC2376744/) |
| Adaptive TDEE | 14–28-day window, ≥ 70% logging compliance; weekly EMA α 0.1–0.2 | Exclude water-perturbed windows | [MODEL] + [INF] | [Sanghvi 2015](https://pubmed.ncbi.nlm.nih.gov/26040640/) |
| Weight trend | Daily EMA α 0.1 | 0.1–0.15 cutting; 0.05–0.1 slow bulk; winsorise > 2–2.5% | [PRACT] + [OBS] | [Hacker's Diet](https://www.fourmilab.ch/hackdiet/e4/signalnoise.html) |
| Body fat display | Navy or JP estimate ± 3–4 points, "trend only" | No BMI messaging for lifters | [OBS] | [Potter 2022](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.868627/full) |
| FFMI | Normalised k = 6.3 (or 6.1, documented) | 25 = observation, not a limit; no FFMI under 18 | [OBS] | [Kouri 1995](https://pubmed.ncbi.nlm.nih.gov/7496846/) |
| Meet weight cut | Acute ≤ 2–3% (2-h weigh-in) | Warn > 3%; strong/block > 5%; rehydrate 150% + 10 mL/kg bolus; carbohydrate 1 g/kg/h; protein 20–25 g | [POS] + [RCT] | [Burke 2021](https://pubmed.ncbi.nlm.nih.gov/33790193/); [Matras 2025](https://pubmed.ncbi.nlm.nih.gov/40864504/) |
| Supplements | Creatine 3–5 g/day; caffeine 3–6 mg/kg ~60 min pre | Caffeine cap < 9 mg/kg; third-party tested | [POS] + [MA] | [Maughan 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5867441/); [Guest 2021](https://pubmed.ncbi.nlm.nih.gov/33388079/) |
| Energy availability | Warn < 30 kcal/kg FFM/day | Soft-warn 30–45 during cuts; clinician prompts | [NARR] + [POS] | [Areta 2021](https://researchonline.ljmu.ac.uk/id/eprint/14136/1/Low%20energy%20availability%20history,%20definition%20and%20evidence%20of%20its%20endocrine,%20metabolic%20and%20physiological%20effects%20in%20prospective%20studies%20in%20females%20and%20males.pdf); [Mountjoy 2023](https://pubmed.ncbi.nlm.nih.gov/37752011/) |

## Open evidence gaps and design decisions

The planning agent must resolve the following before or during implementation. Each row states what is missing and the default this synthesis recommends.

| # | Gap or uncertainty | Decision required | Recommended default |
|---|---|---|---|
| 1 | Pelland dose–response tiers, slopes and the ~31-set / ~3-set PUOS come from the 2024 preprint; the Sports Med 2026 version was not accessed. Remmert per-session values are an unreviewed preprint. | Hard-code now, or wait for verification? | Ship as config with a `verified=false` flag; recheck against the published paper |
| 2 | No study validates e1RM from reps + RIR against a measured 1RM, and none tracks trained powerlifters or bodybuilders over a block | How much to trust logged-set e1RM | Weighting and calibration loop as specified; separate "strength e1RM" from rep PRs |
| 3 | Marzagao weight-dependent formula: preprint, industry author, not validated against measured 1RM; the "100 × 5" example does not reproduce | Ship it at all? | Experimental toggle only, after checking the formula against the preprint |
| 4 | Lombardi exponent 0.10 vs 0.13; original Epley, Brzycki, Lander, Lombardi, O'Conner and Wathen sources not accessed | Which equations to expose | Offer Wathan (default), Epley and Brzycki; hide Lombardi, Lander and O'Conner |
| 5 | No reps-vs-%1RM tables for squat, deadlift, OHP, rows or isolation lifts; Nuzzo leg-press CIs are very wide | Exercise-class priors | Bench-like / leg-press / pooled classes, replaced by the user's fitted curve as data accrue |
| 6 | 0.5 synergist weight not validated per muscle; no data for glutes, lats, delt heads, calves, abs, deadlift variants | Mapping coefficients | Use the mapping table with evidence tags and allow user overrides |
| 7 | RP landmark table is second-hand and possibly outdated | Show MEV/MAV/MRV? | Optional overlay labelled "coaching heuristic", compared against direct sets |
| 8 | No validated algorithm for individualised volume progression; Scarpelli and Barsuhn partly conflict | Volume autoregulation logic | Start at recent volume (≤ 1.2×); change in small steps; judge over several weeks |
| 9 | Deload magnitudes, taper percentages and return-from-break percentages are inferred from surveys and Delphi, not RCTs | Fixed or adaptive? | Ship defaults as editable presets; log outcomes for later personalisation |
| 10 | Readiness cut-offs, recovery decay half-lives, intensity-weighted volume load and monotony > 2 are unvalidated | Which monitoring features to ship | Z-score check-in plus sRPE; per-muscle fatigue model labelled "estimate" |
| 11 | ACWR has been discredited as an injury predictor; Banister parameters are unstable | Include them? | ACWR as a neutral % change only; Banister off by default |
| 12 | **No Android (Galaxy S22) camera-VBT validation**; Qwik VBT validated only on iPhone SE 2022; app availability on Android not verified | VBT architecture | Bluetooth transducer/IMU import as primary; any camera VBT experimental with wide error bands |
| 13 | Sánchez-Medina squat %1RM–velocity equation returns 89.5% at the reported 1RM velocity | Use velocity → %1RM equations? | Do not hard-code; fit per-user load–velocity profiles at submaximal loads instead |
| 14 | Advanced-technique set credits (drop, rest-pause, myo-reps, partials) are untested | Credit rules | Ship the table as config with a visible "heuristic" label |
| 15 | Trainee classification is unvalidated; Santos Junior cut-offs and the Rippetoe session/week/month definitions were not verified | Classifier | Slope-based classifier plus training age; user override |
| 16 | van den Hoek percentile tables not extracted; licensing unknown | Strength-standard data source | Extract tables and confirm licence before shipping; label web standards as non-peer-reviewed |
| 17 | IPF Women Equipped Bench C4 is 67.4926 (IPF) vs 67.492 (OPL); single-lift IPF constants of unknown origin; GL adoption date and document unverified | Coefficient source of truth | Use the IPF document values; mark single-lift IPF scores "informal" |
| 18 | Unverified formulas: metric Navy, JP3 women and JP7, Brozek, Cunningham 1980, Roza & Shizgal, De Lorenzo, PAL multipliers | Which body-composition and RMR equations ship | Ship the verified ones (Navy inch form, Mifflin, Tinsley, ten Haaf, Cunningham 1991); verify the rest against primary texts first |
| 19 | FFMI constant 6.3 (Kouri abstract) vs 6.1 (calculators); no female FFMI reference | Constant and messaging | Choose one, document it; no "natural limit" messaging for women |
| 20 | No validated adaptive-TDEE or EMA parameters in lifters; ρ for lean or gaining states is assumed | Filter design | EMA or Kalman as specified; show uncertainty; exclude water-shift windows |
| 21 | No validated minimum-calorie floor; the 2023 IOC REDs full text was not read | Safety floor | Use EA < 30 kcal/kg FFM and kcal < RMR as warnings, not hard blocks |
| 22 | Female-specific data are scarce (protein, surplus, deficit, weight cuts, highly trained women in concurrent training) | Sex-specific logic | Same relative targets; optional cycle logging used only for annotation |
| 23 | Retracted Barbalho volume trials; Barbalho 2020 EJSS single-joint paper from the same group | Inclusion policy | Exclude all from the rule base; document the exclusion in the source registry |
| 24 | Concurrent-training thresholds (6 h, 2–3 sessions, 30–45 min) are heuristic; HIIT cycling-vs-running evidence conflicts | Warning strength | Soft warnings only; stronger warnings only in peaking blocks |
| 25 | No prospective injury data link logged load to injury in powerlifting or bodybuilding | Injury features | Pain logging and "bigger jump than usual" only; no risk scores; legal disclaimer |
| 26 | RIR-accuracy synthesis (Russo 2025), Weakley VBT review, Helms 2016 load-adjustment guidance and Jukic VL category effects were not read | Follow-up research | Assign a verification pass before finalising the RIR correction and VBT presets |

## Conclusion

The evidence tells the developers what the population prior is, but almost never what a given user needs. Three facts make that unavoidable:
- Between-person differences in response are about 40 times larger than the effect of changing program variables.
- Logged-set e1RM carries 8–10% noise.
- An advanced lifter's true monthly change of 0.5–1% sits below the single-test detection threshold (6–9% for trained lifters).

For an advanced user, session-to-session e1RM comparisons are therefore mostly noise, and real progress only appears in trend models fitted over 8–12 weeks. The natural architecture is a **Bayesian personalisation engine**:
- Meta-analytic values seed the priors: Wathan curves, 10–20 fractional sets, 1.6 g/kg protein, 7,700 kcal/kg.
- Each user's own data updates them: AMRAP calibration sets, smoothed e1RM, bodyweight trend against logged intake, readiness z-scores.

Many apparently precise numbers turn out to be conventions with explicit uncertainty: the 0.5 synergist weight, deload magnitudes, readiness cut-offs and technique credits. They belong in a versioned rules registry carrying evidence tags and source IDs, not in code.

The second takeaway concerns what the app must not claim:
- The strongest, most actionable findings are mostly negative: no inverted U in volume once the retracted trials are removed; no frequency effect on growth; no injury prediction from ACWR; no 1RM prediction from velocity; no validated Android camera VBT; no benefit from HRV-gated scheduling.
- A credible product shows uncertainty bands and labels its heuristics. It reserves hard warnings for the few thresholds backed by consensus statements: weekly loss above 1–1.5%, acute cuts above 3–5%, energy availability below 30 kcal/kg FFM, caffeine at 9 mg/kg or more.
- Two items carry outsized value relative to their implementation cost, because they deliver the personalisation the averages cannot: the calibration loop (occasional AMRAP sets to learn each user's RIR bias and rep–load curve) and per-exercise correction factors.
