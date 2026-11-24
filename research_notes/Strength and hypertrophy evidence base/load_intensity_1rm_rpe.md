# Load–Intensity–Repetition Relationships for Prescribing and Tracking Resistance-Training Loads (1RM estimation, reps vs %1RM, RPE/RIR)

Scope: notes for the developers of a PWA training planner/tracker for bodybuilders and powerlifters (beginners too). The app needs to (a) estimate e1RM from any logged set (load × reps, optionally with RPE/RIR), (b) turn a target (reps @ RPE, or %1RM) into a suggested load, and (c) track e1RM trends.
Labels: **[PR]** = peer-reviewed; **[PREPRINT]** = not peer-reviewed; **[PRACTITIONER]** = coaching heuristic or textbook/manual, no published derivation; **[SECONDARY]** = I could only read a secondary description, not the original.
Notation: w = load lifted, r = reps completed, RIR = reps in reserve, RPE = 10 − RIR on the RIR-based scale, %1RM = 100·w/1RM.

---

## Q1. What are the 1RM prediction equations (exact coefficients), how accurate are they, and for which rep ranges, lifts, and populations?

### Takeaway
All the classic equations (Epley, Brzycki, Lander, Lombardi, Mayhew, O'Conner, Wathan) agree closely at ≤5–6 reps and correlate highly with measured 1RM (r > 0.9). They diverge, and the linear ones (Brzycki, Lander) fail, above ~10 reps. Most were derived from bench press in young people, and several have no published derivation at all. Validation data favor sets of ≤10 reps, ideally 3–6. Errors are larger for lower-body lifts (all equations underestimated the deadlift in LeSuer 1997), on machines, and in untrained people. No single equation is "best" across studies: Mayhew, Wathan, Epley/Brzycki and O'Conner each win somewhere. Trained-lifter validation for squat and deadlift is thin.

### Cited Findings

**Exact equation forms (w and 1RM in the same unit unless stated)**

| Name (source) | Equation | Author's stated rep range | Derivation / population |
|---|---|---|---|
| Epley 1985 [PRACTITIONER] | 1RM = w·(1 + r/30) (Reynolds prints it as 1RM = 0.033·r·w + w; Welday's version uses 0.0333) | <10 reps | From a poundage chart in *Boyd Epley Workout* (Univ. Nebraska). No documented empirical derivation — [Marzagao 2026 preprint](https://arxiv.org/pdf/2603.17495); [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf) |
| Brzycki 1993 [PRACTITIONER] | 1RM = w / (1.0278 − 0.0278·r) (≡ w·36/(37 − r)) | <10 reps | Practitioner article in JOPERD 64:88–90. No sample or method reported — [Marzagao 2026](https://arxiv.org/pdf/2603.17495); [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf) |
| Lander 1985 [PRACTITIONER] | %1RM = 101.3 − 2.67123·r → 1RM = 100·w/(101.3 − 2.67123·r) (Mayhew 2008 writes it as w/(1.013 − 0.0267123·r)) | not specified | NSCA Journal 6:60–61. Population unknown — [Reynolds 2006 Table 5](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf); [Mayhew 2008](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf) |
| Lombardi 1989 [PRACTITIONER] | 1RM = w·r^0.10 | <11 reps | Textbook (*Beginning Weight Training*). "No data, or evidence of data" — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf). Note: Mayhew 2008 Table 2 prints the exponent as 0.13 ([PDF](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf)), probably a typo or text-extraction artifact. 0.10 is the commonly used value. |
| Mayhew et al. 1992 [PR] | %1RM = 52.2 + 41.9·e^(−0.055·r) → 1RM = 100·w/(52.2 + 41.9·e^(−0.055·r)) | <15 reps | Bench press, ~435 college students (184 M / 251 W per Marzagao; 185 M / 251 W, N=434 per Reynolds). Reps in 1 min at 55–95% 1RM. J Appl Sport Sci Res 6:200–206 — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf); [Marzagao 2026](https://arxiv.org/pdf/2603.17495) |
| O'Conner et al. 1989 [PRACTITIONER] | 1RM = w·(1 + 0.025·r) | not specified | Textbook (*Weight Training Today*) — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf) |
| Wathan (Wathen) 1994 [PRACTITIONER] | 1RM = 100·w/(48.8 + 53.8·e^(−0.075·r)) | — | Fitted to a chart in Baechle (ed.), *Essentials of Strength Training & Conditioning*. Mayhew 2008 notes "equation calculated from chart provided" — [Marzagao 2026](https://arxiv.org/pdf/2603.17495); [Mayhew 2008](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf) |
| Reynolds et al. 2006, exponential [PR] | 1RM = w/(0.5551·e^(−0.0723·r) + 0.4847) | — | As listed in [Mayhew 2008 Table 2](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf) |
| Reynolds et al. 2006, linear (kg) [PR] | Chest/bench press: 1RM = 1.1307·(5RM kg) + 0.6998. Leg press: 1RM = 1.09703·(5RM kg) + 14.2546. 10RM chest press: 1RM = 1.2321·10RM + 0.1752·FFM(kg) − 5.7443. 10RM leg press: 1RM = 1.2091·10RM + 38.0908. 20RM chest press: 1RM = 1.5471·20RM + 3.834. 20RM leg press: 1RM = 1.3870·20RM + 69.2494 | 5RM best | 70 adults (34 M / 36 W), 18–69 y, mixed training status. Barbell bench and Cybex plate-loaded leg press — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf) |
| Kemmler et al. 2006 [PR] | 1RM = w·(0.988 + 0.0104·r + 0.00190·r² − 0.0000584·r³) | 3–20 RTF | 70 trained postmenopausal women (57 y), 4 machine exercises — [PubMed 17194251](https://pubmed.ncbi.nlm.nih.gov/17194251/) |
| Tucker et al. (kg) | 1RM = 1.139·w + 0.352·r + 0.243 | — | As listed in [Mayhew 2008](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf) |
| Others listed in Mayhew 2008 | Adams: w/(1 − 0.02·r). Berger: w/(1.0261 − 0.00262·r). Brown: w·(0.0338·r + 0.9849). Cummings & Finn (kg): 1.175·w + 0.839·r − 4.29787. Abadie & Wentworth (kg, college women, 5–10 reps): 7.24 + 1.05·w | — | [Mayhew 2008 Table 2](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf); Abadie from [Reynolds 2006 Table 5](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf) |
| Macht et al. 2016 [PR] | 1RM(kg) = 1.20·w + 2.19·r − 0.56·biacromial width(cm) + 9.6 (R = 0.99, SEE = 3.5 kg) | random load to failure | 60 moderately trained men, bench press — [PubMed 26913865](https://pubmed.ncbi.nlm.nih.gov/26913865/) |
| Marzagao 2026 [PREPRINT, industry author: Fitbod] | 1RM = w·(1 + (r − 1)^0.85 / (−2.55 + 4.58·ln w)), w in **kg**, k(w) floor of 0.5 | 1–30 reps in data | 303,494 "near-failure" sets from 14,966 Fitbod users, 388 exercises. Fitted by internal consistency, **not** against measured 1RM — [arXiv 2603.17495](https://arxiv.org/pdf/2603.17495) |

**Validation evidence**
- LeSuer et al. 1997 (J Strength Cond Res 11:211–213) [SECONDARY]: 7 equations tested on 67 **untrained** college students (40 M, 27 W) for bench press, squat and deadlift. Predicted–actual correlations were all r > 0.95, but absolute accuracy differed by exercise, and **every equation significantly underestimated the deadlift 1RM** — [Marzagao 2026 lit. review](https://arxiv.org/pdf/2603.17495).
- Reynolds et al. 2006 [PR], design: 70 adults did 1, 5, 10 and 20RM tests (metronome 60 bpm, i.e. 1 s concentric / 1 s eccentric; 5 min rest), plus a 20-person cross-validation group. The load-vs-RM curve was **non-linear** (chest press: linear Sy.x 2.6 kg vs non-linear 0.2 kg; leg press: 11.2 vs 2.4 kg). Mean loads: leg press 85.91 / 70.10 / 51.58 %1RM and chest press 87.45 / 75.65 / 61.61 %1RM at 5 / 10 / 20RM — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf).
- Reynolds 2006 cross-validation SEE (kg): chest press 1.80 / 3.64 / 4.82 and leg press 13.51 / 23.79 / 33.08 from 5RM / 10RM / 20RM. Accuracy fell as RM rose. Anthropometrics, sex and training volume added nothing beyond the 5RM. Authors' conclusion: "no more than 10 repetitions should be used". Most accurate: their own equations, plus Brzycki and O'Conner for chest press and Abadie for leg press. Lombardi and Mayhew (non-linear) were less accurate than the linear equations on this sample. Epley slightly overestimated leg press. Brzycki, Lander and O'Conner underestimated leg press — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf).
- Reynolds 2006, sensitivity: a ±5 kg error in the 5RM becomes a 19.7 kg (leg press) or 6.3 kg (chest press) 1RM prediction error. The 5RM itself was highly repeatable (ICC 0.999, mean error ±0.5%) — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf).
- Mayhew et al. 2008 [PR], design: 103 college women, bench press, reps to fatigue at randomly assigned 60–90% 1RM, before and after 12 weeks of training. 14 equations tested — [PubMed 18714230](https://pubmed.ncbi.nlm.nih.gov/18714230/); [full text](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf).
  - **Full rep range (2–30 RTF), pre-training** (constant error = predicted − actual): Brzycki +7.2 ± 23.7 kg (+26.7 ± 101.7%, ICC 0.24); Lander +6.3 ± 16.8 kg (+22.9 ± 70.7%); Berger −7.1 kg (−24%). The good ones: Mayhew +0.2 ± 2.6 kg (+1.2 ± 9.0%, ICC 0.96); O'Conner −0.8 ± 2.6 kg; Wathen +1.3 ± 2.9 kg; Kemmler −1.5 ± 2.6 kg; Lombardi −1.6 ± 3.1 kg.
  - **≤10 RTF, pre-training, n = 46**: Mayhew +0.4 ± 2.6 kg (+1.6 ± 9.4%); Wathen +0.2 ± 2.9 kg (+0.7 ± 10.6%); Welday/Epley +0.1 ± 2.8 kg; Brzycki −0.6 ± 2.9 kg (−2.0 ± 10.5%); Lander −0.3 ± 2.9 kg; Lombardi −0.3 ± 2.6 kg; O'Conner −1.1 ± 2.6 kg; Kemmler −1.9 ± 2.6 kg; Berger −17.4%. Actual 1RM was 27.8 kg.
  - Conclusion: "Prediction equations were more accurate … in which fewer than 10 RTF were used." The exponential Mayhew equation and the Tucker equation (which uses both load and reps) performed best.
- Kemmler et al. 2006 [PR]: the cubic polynomial predicted 1RM from 3–20 RTF on leg press, bench, row and adduction machines with mean absolute differences of **1.5–3.1%** and CV < 3.3%. Accuracy did not depend on exercise or RTF, but the sample was only trained women aged ~57 — [PubMed 17194251](https://pubmed.ncbi.nlm.nih.gov/17194251/).
- DiStasio 2014 (thesis, Southern Illinois Univ.) [SECONDARY]: in Division I football players, Epley and Brzycki predicted back-squat 1RM from 5RM/3RM tests within ~2.7 kg and ~3.1 kg, with no significant difference from actual — [cited in Macarilla 2022, PMC9465738](https://pmc.ncbi.nlm.nih.gov/articles/PMC9465738).
- Braith et al. 1993 [PR]: 58 young adults, knee extension, 7–10RM. Before training, 1RM = 1.554·(7–10RM) − 5.181 (R² 0.89, SEE 9.3 kg) — [PubMed 8423746](https://pubmed.ncbi.nlm.nih.gov/8423746/). See Q5 for the post-training bias.
- Eston & Evans 2009 [PR]: predicting 1RM by extrapolating Borg 6–20 RPE from light sets (20/40/60% 1RM) to RPE 20 gave group means close to measured 1RM (biceps curl 32.3 vs 32.3 kg; knee extension 34.3 vs 35.9 kg). Individual accuracy was 95–102 ± 10–19% of measured. n = 20 young adults — [PMC3761544](https://pmc.ncbi.nlm.nih.gov/articles/PMC3761544).
- Marzagao 2026 [PREPRINT]:
  - In app data, Brzycki, Epley and Wathen gave nearly identical within-person consistency (SD(log 1RM) 0.1021–0.1028 within 14-day windows); Mayhew was worse (0.1084).
  - The weight-dependent formula cut inconsistency by 17–22% overall and improved all 183 exercises with ≥50 tuples. Gains were largest for light isolation lifts (e.g. +24–35% for dumbbell curls) and smallest for barbell bench (+7–16%).
  - Implied "k" (reps per 1RM fraction; Epley k = 30, Brzycki ≈ 36, Wathen/Mayhew ≈ 29) was 8.0 at 10 kg, 16.9 at 70 kg and 20.4 at 150 kg.
  - Example: a 13 kg curl × 10 gives ~17 kg (Brzycki) vs ~22 kg (new formula). 100 kg × 5 bench: the two agree within 2 kg.
  - Limitations: no measured 1RMs, the near-failure filter is heuristic, dumbbell loads are logged per hand, and the author works for Fitbod — [arXiv 2603.17495](https://arxiv.org/pdf/2603.17495).
- Velocity-based alternatives (for context; they need bar-speed hardware):
  - Load–velocity profiles overestimated 1RM in 17 trained men by 18.5–23.8% (squat) and 6.3–8.2% (bench) — [Macarilla 2022, PMC9465738](https://pmc.ncbi.nlm.nih.gov/articles/PMC9465738).
  - Back-squat LV prediction had SEE 10.6 kg / CV 7.4%. Measured 1RM was stable (CV 2.1%) — [Banyard 2017, PubMed 27669192](https://pubmed.ncbi.nlm.nih.gov/27669192/).
  - An IPD meta-analysis reportedly found a pooled SEE of ≈9.8% 1RM for individualized LV profiles [SECONDARY] — [Marzagao 2026 lit. review](https://arxiv.org/pdf/2603.17495).

### Inferences
- Implied %1RM at a given rep count for each formula (computed by me from the equations above; RTS = practitioner chart, see Q3; NSCA = textbook table, see Q2):

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

- Edge cases the app must handle (computed):
  - Mayhew implies a 1-rep set is only 91.9% of 1RM, so a logged single would give e1RM = 1.088·w. Epley gives 1.033·w for a single.
  - Brzycki and Lander fall off a cliff past ~12 reps, and Brzycki is undefined at r ≥ 37.
  - Lombardi and O'Conner flatten out, so they give low e1RMs for high-rep sets.
  - Fix: special-case r = 1 (e1RM = w if RIR = 0) and cap or down-weight r_eff > 10–12.
- **Default for the app:** Epley or Wathan for r_eff ≤ 10 (Wathan matches the RTS chart within ~0.6 percentage points for 2–10 reps). Brzycki is equivalent at ≤6 reps.
  - Epley, Brzycki and Wathan differ by <3% at 5 reps and are within ~1% of each other at 10 reps. The choice of formula matters far less than (i) using r ≤ ~10, (ii) proximity to failure, and (iii) exercise-specific bias.
- Expect a systematic bias by exercise:
  - Standard formulas probably **underestimate deadlift** e1RM (LeSuer).
  - They likely **overestimate e1RM on leg press and other machine lower-body lifts**, because people do more reps at a given %1RM there (Nuzzo, Q2). Reynolds' leg-press data point the other way (see Q2 conflict).
  - Per-exercise calibration factors learned from the user's own heavy singles or low-rep sets are therefore valuable.
- For isolation and light dumbbell work, the weight-dependent preprint formula is the only large-sample evidence, and it suggests classic formulas understate e1RM. But it is unvalidated against real 1RM, so treat it as optional or experimental, and remember its dumbbell weights are per hand.
- Regression equations with intercepts (Reynolds, Macht, Tucker, Abadie, Cummings & Finn) are kg-specific and machine/population-specific. Don't use them as general formulas.

### Gaps
- I could not read the original LeSuer 1997 paper. A widely repeated secondary claim — that only Mayhew and Wathan predicted bench press accurately, only Wathan predicted squat, and deadlift was underestimated by ~9–14% (≈22–34 lb) — could not be checked against the original. Treat it as unverified.
- I found no peer-reviewed validation of rep-based equations in **trained powerlifters** for squat, bench and deadlift with modern methods. A 2019 conference abstract ("Establishing prediction equations for 'the big 3'", D1 football players and powerlifters; digitalcommons.wku.edu) exists but was not readable.
- No independent study compares the weight-dependent preprint formula against measured 1RM.
- The original Epley (1985), Brzycki (1993), Lander (1985), Lombardi (1989), O'Conner (1989) and Wathen (1994) sources were not accessible. Formulas are taken from Reynolds 2006, Mayhew 2008 and Marzagao 2026, which agree except for the Lombardi exponent noted above.

---

## Q2. How many reps can be done at a given %1RM, and how does that vary by exercise, muscle group, training status, sex, and upper vs lower body?

### Takeaway
The best quantitative source is the Nuzzo et al. 2024 meta-regression: 269 studies, 952 tests, 7,289 people. It gives means **and between-person SDs** of reps to failure at 15–95% 1RM, pooled and separately for bench press and leg press.
- **Exercise** is the only moderator with clear evidence: leg press allows many more reps than bench press at the same %1RM. Sex, age and training status showed little evidence of moderation.
- Between-person spread is large (SD ≈ 2.5 reps at 80% 1RM). A population table is only a starting point; individual calibration is needed.
- The classic NSCA table (e.g. 75% = 10 reps) is close to the bench-press data, but underestimates reps for leg press and for pooled data at moderate loads.
- Smaller studies show more reps on squat than bench or curl at 60% 1RM, and many more reps in endurance-trained people.

### Cited Findings
- **NSCA textbook table** (Sheppard & Triplett, *Essentials of S&C*, 4th ed. 2016) [PRACTITIONER], reproduced as Table 1 in Nuzzo 2024. %1RM → max reps: 100→1, 95→2, 93→3, 90→4, 87→5, 85→6, 83→7, 80→8, 77→9, 75→10, 70→11, 67→12, 65→15. It is presented as a general guideline based on a few studies (e.g. Hoeger 1987/1990), with point estimates only — [Nuzzo 2024, PMC10933212](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212).
- **Nuzzo, Pinto, Nosaka & Steele 2024**, *Sports Med* 54:303–321, doi:10.1007/s40279-023-01937-7 [PR, open access] — [PMC10933212](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212):
  - Data: 269 studies / 452 groups / 952 tests / 7,289 people identified; 6,970 analysed. Samples were 66% male, 60% resistance-trained, median age 23. Bench press made up 42% of tests, leg press 14%, squat 12%, knee extension 11%, chest press 9%.
  - Model: mean reps from a natural cubic spline on log reps (knots at 60% and 80%, boundaries at 0% and 100%); SD from a log-linear model.
  - Limitations: the search was not systematic; 77 studies were digitized from figures; the sample is mostly healthy 20–40-year-olds; isolation and overhead exercises are sparse. Two authors were formerly employed by an equipment company.
- **Nuzzo 2024 table values** (mean reps [95% CI]; between-person SD), transcribed from Figs 2–4 — [PMC10933212](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212):

| %1RM | Pooled mean [CI] | Pooled SD | Bench mean [CI] | Bench SD | Leg press mean [CI] | Leg press SD |
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

- Nuzzo 2024 moderators:
  - **Sex, age (30/50/70 y) and training status** (trained vs untrained): "almost all interval estimates on contrast ratios included 1". Effects are uncertain or small.
  - **Exercise:** only bench vs leg press differed clearly. Chest press and squat were analysed but not tabulated. The authors recommend the pooled table for other exercises.
  - Longer rep durations tended toward fewer reps. Muscle action (eccentric-only) could not be tested — [PMC10933212](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212).
- Nuzzo 2024 vs the textbook: the textbook says 4 reps at 90% and 11 at 70%; the pooled model gives ~5 and ~15. Bench is similar to the textbook (4/9/14 vs 4/8/11 at 90/80/70%). Leg press is much higher (~9/13/19) — [PMC10933212](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212).
- **Shimano et al. 2006** [PR]: 8 trained + 8 untrained men did back squat, bench press and arm curl to failure at 60/80/90% 1RM. Significant intensity × exercise interaction. More reps on squat than bench or curl at 60%; smaller differences at 80–90%. Trained vs untrained differed only on bench at 90%. Conclusion: muscle mass involved matters and training status matters little — [PubMed 17194239](https://pubmed.ncbi.nlm.nih.gov/17194239/).
- **Richens & Cleather 2014** [PR]: leg press, 8 weightlifters vs 8 endurance runners. Reps at 70% 1RM: 17.9 ± 2.8 (lifters) vs 39.9 ± 17.6 (runners). At 80%: 11.8 ± 2.7 vs 19.8 ± 6.4. At 90%: 7.0 ± 2.1 vs 10.8 ± 3.9 (n.s.). "Traditional guidelines may underestimate" reps, especially in endurance-trained athletes — [PMC4042664](https://pmc.ncbi.nlm.nih.gov/articles/PMC4042664).
- **Reynolds 2006** [PR]: mean %1RM at 5/10/20RM was 85.9/70.1/51.6% (plate-loaded leg press) and 87.5/75.7/61.6% (bench). Leg press showed a *larger* load drop with reps than bench, and women showed a smaller drop than men in both lifts — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf). **This conflicts with Nuzzo's finding of more leg-press reps at a given %1RM**; machine type, 90° knee angle and metronome tempo probably differ.
- **Mitter et al. 2023** [PR]: 30 resistance-trained men and women, pin press to failure at 90/80/70%. Individual (multilevel) models fit much better than pooled ones (R² 0.97–0.98 vs 0.89–0.93). A 2-parameter exponential was best. "The relationship should … be modelled on a subject-specific level" — [PubMed 35703009](https://pubmed.ncbi.nlm.nih.gov/35703009/).
- **Hoeger 1987/1990** [SECONDARY]: 7 exercises at 40/60/80% 1RM in trained/untrained men and women. Rep counts differed by exercise, and trained men out-repped untrained men at several loads (e.g. arm curl, knee extension, lat pulldown) — [Nuzzo 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212); [Kravitz et al. (UNM)](http://www.unm.edu/~lkravitz/Article%20folder/1RM.html).
- **Lovegrove et al. 2022** [PR]: novice young men chose loads for 1 RIR. Deadlift: 88.2 / 84.3 / 79.2% 1RM for 3 / 5 / 8-rep sets. Bench: 93.0 / 87.3 / 79.6%. Test–retest ICC 0.95–0.99, CV 2.7–6.2% — [PubMed 36135029](https://pubmed.ncbi.nlm.nih.gov/36135029/).
- Percentage-based prescription applied across a group produces a "wide range of per-set RIR owing to interindividual differences in repetitions performed at specific percentages of 1RM" — [Pelland 2022, PubMed 35247203](https://pubmed.ncbi.nlm.nih.gov/35247203/).

### Inferences
- Inverting the Nuzzo means (log-interpolated; computed by me — this is an approximation because inverting means is not the same as averaging %1RM at fixed reps), the implied %1RM for a set to failure is:
  - Pooled: ~89.8% at 5 reps, 79.5% at 10, 75.6% at 12.
  - Bench: 87.6% at 5, 77.6% at 10.
  - Leg press: ~86.6% at 10, 82.1% at 12.
  - So for bench at 5 reps, Epley/RTS (85.7–86.3%) are ~1.5% "conservative" on load (they give a slightly higher e1RM). At 10 reps they are ~5% higher on e1RM than the bench meta-mean. For leg press, standard formulas could inflate e1RM by ~15% at 10 reps.
- Between-person variability dominates. At 80% 1RM the pooled SD is 2.5 reps, so roughly two-thirds of lifters will do ~7–12 reps. A load suggested from a population table will be off by ±1 effective rep (≈ ±3% load) or more for many users. This argues for personal curves fitted from each user's own logged near-failure sets.
- Suggested hierarchy for load-for-target-reps (inference):
  1. The user's own fitted curve per exercise, e.g. an individual exponential (Mitter).
  2. An exercise-class prior: bench-like upper-body compounds → Nuzzo bench or RTS/Epley; leg press / machine lower-body → Nuzzo leg press; everything else → Nuzzo pooled.
  3. Then autoregulate by RPE.
- Endurance-oriented users (and probably high-rep bodybuilders) will do more reps at a given %1RM than strength athletes. Their rep-derived e1RMs from high-rep sets will be inflated if strength-athlete curves are used.

### Gaps
- No meta-analytic tables exist for squat, deadlift, overhead press, rows, pulldowns or isolation lifts specifically. Nuzzo's squat data were analysed but not tabulated, and no deadlift-specific reps-vs-%1RM data were found.
- Hoeger 1990's exact rep counts could not be retrieved.
- Nuzzo's sex and training-status contrast ratios are only on OSF (osf.io/jub3h, osf.io/9f5ke); the numeric ratios were not retrieved.
- No data specific to elite powerlifters or bodybuilders on reps at %1RM were found.

---

## Q3. RPE/RIR: scale definitions, RPE→%1RM tables, and how accurately lifters predict RIR (and what correction factors could apply)

### Takeaway
The RIR-based RPE scale (Zourdos et al. 2016; Helms et al. 2016) defines RPE = 10 − RIR, with half-points. It is reliable and correlates strongly with %1RM and bar velocity in powerlifters, and experienced lifters rate a true 1RM close to 10 (9.6–9.9).

The widely used RPE→%1RM chart (Tuchscherer/RTS) is a **practitioner heuristic**, not a validated research table. Its numbers are one-dimensional in reps + RIR and almost identical to the Wathan equation.

Lifters' RIR predictions:
- They underpredict reps to failure by ~1 rep on average (Halperin 2022 meta-analysis), with large heterogeneity.
- Accuracy is good (≈0.5–1 rep) when close to failure (≤3 RIR), in low-to-moderate-rep sets (≤~12), with heavier loads, and in later sets.
- It degrades badly far from failure and in high-rep sets (errors of 3–5+ reps at "RPE 5–7" in 16-rep squat sets; 5–8 reps at 60% 1RM).
- Training experience has inconsistent or small effects, and accuracy improves with practice.

### Cited Findings
**Scale definitions**
- Zourdos et al. 2016, J Strength Cond Res 30(1):267–275, doi:10.1519/JSC.0000000000001049 [PR]: "RPE-10 = 0-RIR, RPE-9 = 1-RIR, and so forth". 29 squatters: 15 experienced (training age 5.2 ± 3.5 y) and 14 novices (0.4 ± 0.6 y). Single reps at 60/75/90% and an 8-rep set at 70%. Velocity–RPE r = −0.88 (experienced) and −0.77 (novice). Experienced lifters gave a higher RPE at 1RM than novices (p = 0.023) — [PubMed 26049792](https://pubmed.ncbi.nlm.nih.gov/26049792/).
- Scale descriptors (attributed to Zourdos 2016) [SECONDARY]: 10 = maximum effort; 9.5 = no further reps but could increase load; 9 = 1 rep remaining; 8.5 = 1–2 reps remaining; 8 = 2 reps remaining; 7.5 = 2–3 reps remaining; 7 = 3 reps remaining; 5–6 = 4–6 reps remaining; 3–4 = light effort; 1–2 = little to no effort — [Topend Sports](https://www.topendsports.com/fitness/strength/rpe-resistance-training.htm).
- Helms, Cronin, Storey & Zourdos 2016, *Strength Cond J* 38(4):42–49, doi:10.1519/SSC.0000000000000218 [PR, narrative]: the RIR-based RPE "adjusts loads automatically to match athlete capabilities on a set-to-set basis" and "may more accurately gauge intensity at near-limit loads" — [AUT repository](https://openrepository.aut.ac.nz/items/92cefeac-7c32-44f1-bfbc-f48f4a5dd8cf/full).

**RPE vs %1RM (peer-reviewed data)**
- Helms et al. 2017 [PR]: 15 powerlifters (12 M / 3 W). RPE at 1RM was 9.6 ± 0.5 (squat), 9.7 ± 0.4 (bench) and 9.6 ± 0.5 (deadlift). %1RM–RPE r = 0.88–0.91. Velocity at 1RM was 0.23 / 0.10 / 0.14 m/s — [PubMed 27243918](https://pubmed.ncbi.nlm.nih.gov/27243918/).
- Ormsbee et al. 2019 [PR]: bench press, 14 experienced vs 13 novice men. RPE at 1RM was 9.86 ± 0.14 vs 9.35 ± 0.36. Velocity–RPE r = 0.85 in both groups — [PubMed 28301439](https://pubmed.ncbi.nlm.nih.gov/28301439/).
- Lovegrove 2022 [PR]: novices targeting 1 RIR chose bench loads of 93.0 / 87.3 / 79.6% 1RM for 3 / 5 / 8 reps and deadlift loads of 88.2 / 84.3 / 79.2%. Repeatable across sessions (ICC 0.95–0.99, CV 2.7–6.2%) — [PubMed 36135029](https://pubmed.ncbi.nlm.nih.gov/36135029/).
- Helms et al. 2018 [PR]: 8 weeks of squat and bench in trained men, matched sets and reps. RPE-based load selection (n = 10) vs %1RM (n = 11) produced similar 1RM gains: bench +10.70 vs +9.64 kg, squat +17.05 vs +13.91 kg. There was a 57–79% chance of a small advantage for RPE — [PMC5877330](https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330).

**Practitioner RPE chart (Tuchscherer / Reactive Training Systems)** [PRACTITIONER, SECONDARY]
- %1RM by reps (rows) × RPE (columns), reps 1–10, RPE 10 down to 6.5 — [FitnessVolt](https://fitnessvolt.com/rpe-training/guides/tuchscherer-chart-explained):
  - RPE 10, reps 1–10: 100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9. Reps 11–12 (70.7, 68.0) appear in other FitnessVolt chart pages per search snippets, and are consistent with the RPE 9 / RPE 8 values at 10 reps.
  - RPE 9, reps 1–10: 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7.
  - RPE 8, reps 1–10: 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0.
  - RPE 7, reps 1–10: 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3.
  - Half-point columns: RPE 9.5 → 97.8, 93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3. RPE 8.5 → 93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4. RPE 7.5 → 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7. RPE 6.5 → 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0.
- Caveats on that site: Tuchscherer says the chart is a guide and should not be used to derive a max; it assumes a fresh set; it is less reliable above 10 reps and for isolation lifts; it is mainly based on squat, bench and deadlift — [FitnessVolt](https://fitnessvolt.com/rpe-training/guides/tuchscherer-chart-explained).
- The same site claims the chart is "Epley-based". My computation (below) shows it is closer to Wathan.

**Accuracy of RIR prediction**
- **Halperin et al. 2022** (Sports Med 52:377–390, doi:10.1007/s40279-021-01559-x) [PR, scoping review + exploratory meta-analysis] — [PubMed 34542869](https://pubmed.ncbi.nlm.nih.gov/34542869/):
  - 13 publications / 12 studies / 414 participants / 262 effects.
  - Participants **underpredicted** reps to failure by **0.95 reps** (95% CI 0.17–1.73), with I² = 97.9%.
  - Slightly better accuracy closer to failure (β = −0.025).
  - Much worse in sets of >12 reps (β = 0.47 reps per rep, vs 0.06 for ≤12).
  - Slightly better in later sets (β = −0.07).
  - No effect of training status (β = −0.006) or upper vs lower body (−0.58 reps, CI −2.32 to 1.16).
  - Between-participant SD of accuracy: 1.45 reps.
- **Zourdos et al. 2021** [PR]: 25 trained men (training age 4.7 y), squat at 70% 1RM to failure (16 ± 4 reps). RIR error was 2.05 ± 1.73 at called RPE 9, 3.65 ± 2.46 at RPE 7 and 5.15 ± 2.92 at RPE 5. More reps per set predicted larger error at RPE 5 and 7 (r = 0.65 and 0.56) but not at RPE 9. Training age did not predict accuracy — [PubMed 30747900](https://pubmed.ncbi.nlm.nih.gov/30747900/).
- **Hackett et al. 2017** [PR]: 81 adults (53 M / 28 W), chest press at 70% and leg press at 80%, up to 10 × 10. Error was ~1 rep when actual RIR was 0–5 and >2 reps when actual RIR was 7–10. Chest press was more accurate than leg press. Men were more accurate than women on leg press at some RIRs. Experience had no effect — [PubMed 27787474](https://pubmed.ncbi.nlm.nih.gov/27787474/).
- **Steele et al. 2017** [PR]: 141 people, machine exercises, single sets to momentary failure. Mean underprediction overall: chest press predicted 12.4 vs actual 14.2 reps; leg press 12.5 vs 16.4. SEM 2.64–3.38 reps. SEMs shrank with experience: "orientation" group 4.15–5.13 reps, "expert" group 1.27–2.29 reps — [PMC5712461](https://pmc.ncbi.nlm.nih.gov/articles/PMC5712461).
- **Armes et al. 2020** [PR]: trained (≥1 y) participants doing knee extension at 70% 1RM underpredicted reps to momentary failure by 2.0 reps (95% CI 0.0–4.0) — [PMC7785525](https://pmc.ncbi.nlm.nih.gov/articles/PMC7785525).
- **Refalo et al. 2024** (J Strength Cond Res 38(3):e78–e85) [PR]: 24 trained subjects (12 M / 12 W), bench press at 75% 1RM, calling 1 and 3 RIR. Raw error −0.17 ± 1.00, absolute error **0.65 ± 0.78 reps**. Statistically equivalent (±1 rep) between 1 vs 3 RIR, set 1 vs 2 and session 1 vs 2. No relationship with sex, experience or relative strength — [PubMed 37967832](https://pubmed.ncbi.nlm.nih.gov/37967832/).
- **Remmert, Laurson & Zourdos 2023a** [PR]: 27 men and 31 women, trained and untrained, machine biceps curl, triceps pushdown and seated row at 72.5% 1RM. More accurate closer to failure and in later sets. No effect of sex, training experience, experience using RIR, or exercise — [PubMed 37036795](https://pubmed.ncbi.nlm.nih.gov/37036795/).
- **Remmert et al. 2023b** [PR]: 9 trained men, bench 3×/week for 6 weeks, calling 4 and 1 RIR. Absolute accuracy did **not** improve over time, with "a greater tendency to underestimate RIR in later sessions and during higher repetition sets" — [PubMed 37436724](https://pubmed.ncbi.nlm.nih.gov/37436724/).
- **Wiedenmann et al. 2026** [PR]: 13 younger and 13 older adults, bench and leg press at 75–85% 1RM, calling 4 and 2 RIR over 6 sessions. MAE fell by up to 2.3 reps from session 1 to 6. No age effect. RIR estimation is "a trainable skill" — [PMC13499321](https://pmc.ncbi.nlm.nih.gov/articles/PMC13499321).
- **Droguett et al. 2026** [PR]: Smith-machine squat at 70% 1RM. No difference in accuracy at RIR 3 and RIR 1 between experienced (≥18 months) and novice lifters (8 each) — [PMC13215226](https://pmc.ncbi.nlm.nih.gov/articles/PMC13215226).
- **Gómez-Redondo et al. 2025** [PR]: 25 older adults, chest press at 65%. Underestimated predicted RIR 2 by 2.1 reps and RIR 4 by 1.6 reps; accurate at RIR 6. Post-set RPE barely differed across RIR targets (8.0 / 7.6 / 7.3) — [PubMed 40902458](https://pubmed.ncbi.nlm.nih.gov/40902458/).
- **Ferrari et al. 2026** [PREPRINT]: leg press, calling RIR 3. Accurate at 80% 1RM (error 0.46–0.56 reps), but large underestimation at 60% 1RM (4.73 ± 3.35 reps in young, 7.78 ± 5.12 in older adults). Intensity had a main effect; age did not — [Research Square](https://doi.org/10.21203/rs.3.rs-8899476/v1).
- Casanova et al. 2025 (J Phys Educ Sport, doi:10.7752/jpes.2025.11262) [SECONDARY, abstract only]: 34 trained young adults at 50% and 75% 1RM calling 3 and 1 RIR. Sex mostly did not matter, and there were minor exercise differences — [repository record](http://hdl.handle.net/10174/39787).
- Haischer et al. 2023 [PR]: in 56 trained lifters, bar velocity of the first rep at 70% predicted total squat reps with SEE 2.21 reps (R² 0.26). Velocity loss was not predictive — [PMC10203840](https://pmc.ncbi.nlm.nih.gov/articles/PMC10203840).
- Context: in a meta-regression, strength gains were similar across a wide range of estimated RIR, while hypertrophy increased as sets ended closer to failure — [Robinson et al. 2024, PubMed 38970765](https://pubmed.ncbi.nlm.nih.gov/38970765/).

### Inferences
- **The RTS chart is exactly one-dimensional in "effective reps" = reps + RIR** (verified by me on every cell): value(reps r, RPE x) = value(r + (10 − x), RPE 10).
  - Effective reps 1 → 100, 1.5 → 97.8, 2 → 95.5, 2.5 → 93.9, 3 → 92.2, 3.5 → 90.7, 4 → 89.2, 4.5 → 87.8, 5 → 86.3, 5.5 → 85.0, 6 → 83.7, 6.5 → 82.4, 7 → 81.1, 7.5 → 79.9, 8 → 78.6, 8.5 → 77.4, 9 → 76.2, 9.5 → 75.1, 10 → 73.9, 10.5 → 72.3, 11 → 70.7, 11.5 → 69.4, 12 → 68.0, 12.5 → 66.7, 13 → 65.3, 13.5 → 64.0.
  - The RPE-10 row is within ≈0.6 percentage points of **Wathan** for 2–10 reps (e.g. 5 reps: 86.3 vs 85.8; 10 reps: 73.9 vs 74.2). It is not a close match to Epley at low reps (2 reps: 95.5 vs 93.8).
  - An app can replace the chart with `pct(r_eff) = Wathan(r_eff)` plus a lookup override for exact RTS values.
- One RPE point ≈ one rep ≈ **2.3–3.3 percentage points of 1RM** across 2–12 effective reps (from the chart; Epley's slope is 1/30 ≈ 3.3%/rep). So an RIR error of 1 rep → ~3% e1RM or load error, and 2 reps → ~6%.
- **Possible correction factors** (inferences to test against user data):
  - **Base bias:** Halperin's pooled 0.95-rep underprediction means the true RIR is, on average, about 1 more than reported. Near failure (reported RIR ≤ 2–3, sets ≤ ~12 reps, loads ≥ ~75% 1RM) the bias in trained lifters is ~0–0.5 rep (Refalo, Ferrari at 80%), so apply little or no correction there.
  - **Far from failure or high reps** (reported RIR ≥ 4, i.e. RPE ≤ 6, or r_eff > 12–15, or loads ≤ ~65% 1RM): expect underprediction of 2–5+ reps (Zourdos 2021, Ferrari at 60%, Steele). Treat these sets as low-information for e1RM: either exclude them or give them a much wider uncertainty, rather than "correcting" them.
  - **Beginners:** give them wider priors at first and shrink the uncertainty as their calibration history grows. Accuracy is trainable (Wiedenmann; MAE −2.3 reps over 6 sessions), though Remmert 2023b found no improvement in already-trained men.
  - **Personal calibration loop:** occasionally ask for a set to failure (AMRAP on the last set, or "call RIR 3, then keep going"). Store reported-vs-actual RIR per user and exercise class, and use the running mean error as a user-specific bias with its SD as uncertainty. This mirrors the research protocols (Refalo; Zourdos 2021; Remmert).
  - **Exercise class:** some data suggest upper-body/chest press is more accurate than leg press (Hackett), but meta-analysis found no upper-vs-lower difference (Halperin). Default to no exercise-class correction until there is user data.
- Experienced lifters rate a true 1RM at about 9.6–9.9, novices at about 9.35. When a beginner logs "RPE 10" on a heavy single, it may not be a true max.
- RIR describes proximity to failure, not intensity. The same RIR at different loads means very different %1RM (cf. the "RIR is not intensity" commentary, Alcazar et al., *Med Sci Sports Exerc* 2026, PubMed 42303420; abstract not available). The app should store load, reps and RIR separately and derive %1RM from them.

### Gaps
- I found no peer-reviewed validation of the RTS RPE chart's %1RM values themselves. Its origin (Tuchscherer's coaching data) is not published.
- The full text of Helms 2016 (SCJ) could not be read, so its specific load-adjustment guidance (e.g. % change per RPE point) is unverified.
- The full results of Russo et al. 2025, "Factors influencing the accuracy of the RIR scale … a systematic review" (*Physical Therapy Reviews*, doi:10.1080/10833196.2025.2564026), were not accessible. Its conclusions should be checked as the most recent synthesis.
- Data on RIR accuracy for deadlifts, and for very heavy loads (>90% 1RM) in powerlifters, are sparse.

---

## Q4. How should an app compute e1RM from a set with RPE (e.g., effective reps = reps + RIR)? Is there research supporting this?

### Takeaway
"Effective reps = reps + RIR, then apply a rep-max formula (or the RTS chart)" is the standard practitioner approach. It is internally consistent with the RIR-based RPE scale and is exactly how the RTS chart is built.

I found **no peer-reviewed study that directly validates reps + RIR–based e1RM against a measured 1RM**. Its accuracy is therefore inferred from two error sources: (1) rep-to-1RM formula error (small at ≤10 effective reps) and (2) RIR misjudgment (≈0.5–1 rep near failure, 2–5+ reps far from failure).

The approach is defensible for sets at RPE ≥ ~7–8 with r_eff ≤ ~10–12. Lower-RPE or high-rep sets should be down-weighted or ignored.

### Cited Findings
- All rep-based prediction assumes the set is performed to or near failure. If app users typically train with 3–5 RIR, applying standard equations to raw logged reps "will systematically underestimate true 1RM" [PREPRINT] — [Marzagao 2026](https://arxiv.org/pdf/2603.17495).
- The RIR-based RPE scale defines RPE 10 = 0 RIR, RPE 9 = 1 RIR, and so on, so reps + (10 − RPE) is by definition the predicted reps to failure at that load — [Zourdos 2016, PubMed 26049792](https://pubmed.ncbi.nlm.nih.gov/26049792/).
- The RTS chart lists %1RM by reps and RPE (e.g. 5 reps @ RPE 8 = 81.1% = 7 reps @ RPE 10) [PRACTITIONER] — [FitnessVolt](https://fitnessvolt.com/rpe-training/guides/tuchscherer-chart-explained).
- Prediction error rises with the number of reps to failure and with distance from failure:
  - >12 reps: β = 0.47 reps per rep — [Halperin 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/).
  - Error of 5.15 reps at a called RPE 5 vs 2.05 at RPE 9 in 16-rep squat sets — [Zourdos 2021](https://pubmed.ncbi.nlm.nih.gov/30747900/).
- Rep-formula accuracy is best with ≤10 reps to failure — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf); [Mayhew 2008](https://pubmed.ncbi.nlm.nih.gov/18714230/).
- Near failure, trained lifters' RIR calls are accurate to ~0.65 reps (absolute) — [Refalo 2024](https://pubmed.ncbi.nlm.nih.gov/37967832/).
- Set order and fatigue: rep counts fall from set 2 with 1-min rest and from set 3 with 3–5-min rest [SECONDARY], and no existing equation accounts for set order — [Marzagao 2026 lit. review citing Senna 2011](https://arxiv.org/pdf/2603.17495). The preprint used only the first near-failure set per exercise per day to limit this.
- In ~14-day windows of real app data, near-failure sets from the same person and exercise gave e1RMs with a within-tuple SD(log 1RM) of ≈0.085–0.10 (≈8.5–10%) depending on formula [PREPRINT]. This is an empirical estimate of practical noise in logged-set e1RM, mixing true day-to-day change, effort noise and formula error — [Marzagao 2026](https://arxiv.org/pdf/2603.17495).
- Training by RPE produces 1RM gains comparable to or slightly better than %1RM loading in trained men — [Helms 2018, PMC5877330](https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330). This supports RPE as a prescription tool, not e1RM accuracy per se.

### Inferences
- **Suggested algorithm** (inference):
  1. RIR = 10 − RPE, or the user's reported RIR. Treat RPE 9.5 as RIR 0.5. If no RPE is given, assume RIR is unknown and use a prior of 2–3, which gives a conservative e1RM, or flag the set as non-informative.
  2. Optionally apply the user's calibration offset: RIR_adj = RIR + bias_user (bias ≈ +0.5 to +1 for reported RIR ≥ 3; ≈0 for RIR ≤ 2 in trained users).
  3. r_eff = reps + RIR_adj.
  4. e1RM = w / pct(r_eff), where pct = Wathan or the RTS table (or Epley: e1RM = w·(1 + r_eff/30), except r_eff = 1 → w).
  5. Give each set a weight that shrinks with RIR and r_eff. For example, as a heuristic: weight = 1 for RPE ≥ 8 and r_eff ≤ 8; 0.5 for RPE 7–7.5 or r_eff 9–12; ~0.1 or exclude for RPE ≤ 6 or r_eff > 12–15; downweight sets after the first working set, or after short rest.
  6. Session e1RM = the weighted maximum (or a top-set-focused weighted mean) per exercise.
- Error budget for one RPE-rated set (inference): formula error ≈ 2–4% at r_eff ≤ 6 (e.g. Reynolds 5RM SEE 1.8 kg on a ~63 kg bench), plus RIR error of 1 rep ≈ 3%. So e1RM from a single good set at RPE 8–9 is probably good to about ±4–6% (1 SD) for trained lifters, and worse for beginners and higher reps. That matches the ~8.5–10% within-person spread in the app-data preprint, which also includes day-to-day variation.
- **Reverse direction (target → load):** suggested load = e1RM × pct(target_reps + target_RIR), rounded to plate or dumbbell increments. Example: 4 reps @ RPE 8 → r_eff = 6 → 83.7% (RTS) or 83.1% (Wathan). For leg press and machine lower-body lifts, use an exercise-specific curve (Nuzzo leg press) or the user's own curve, or the suggestion will be too light.
- When users log RPE in half-points, use them; the chart supports 0.5-RPE steps (~1.2–1.6 percentage points).

### Gaps
- No direct validation study (reps + RIR → e1RM vs measured 1RM) was found in PubMed/Europe PMC searches up to 2026. This is a key evidence gap; the approach rests on construct logic and practitioner use.
- No published data quantify how much within-session fatigue (set number, rest interval) biases e1RM from later sets in trained lifters. Only indirect rep-decline data are available.

---

## Q5. How well do 1RM estimates from submaximal sets track real 1RM changes over a training block?

### Takeaway
On average, rep-based e1RMs track group-level 1RM changes reasonably well, but individual tracking is noisy and can be biased. Training changes the reps-at-%1RM relationship in individuals, in both directions:
- In novices doing 7–10RM knee extension training, endurance improved more than max strength, so a pre-training equation overpredicted post-training 1RM by ~21 kg.
- In women benching, the strongest gainers did fewer reps at the same %1RM, and predicted vs actual change agreed poorly for most equations (ICC −0.09 to 0.95).

The practical implication is to periodically re-anchor e1RM with heavy low-rep sets (≤5 reps at high RPE) or an actual test, and to prefer low-rep sets for trend tracking.

### Cited Findings
- **Mayhew et al. 2008** [PR], 103 college women, 12 weeks, bench press — [PubMed 18714230](https://pubmed.ncbi.nlm.nih.gov/18714230/); [full text](https://www.unm.edu/~rrobergs/478PredictionAccuracy.pdf):
  - 1RM rose 7.7 ± 5.4 kg (≈28%). Reps to fatigue at the same %1RM changed by only 0.6 on average, but ranged from −15 to +17 reps (pre–post r = 0.66).
  - Change in 1RM correlated negatively with change in RTF (r = −0.55): bigger strength gains meant fewer reps at the same %1RM.
  - Agreement between predicted and actual change ranged from ICC −0.09 to 0.95 across equations. The Tucker equation was best (ICC 0.87, 65% of women within ±2.3 kg).
  - Authors: changes "can be tracked with acceptable accuracy" in women, but an RTF assessment "may not be appropriate" when precise strength measurement is needed, e.g. for strength athletes.
- **Braith et al. 1993** [PR], 18 weeks of knee-extension training (1 × 7–10 to fatigue) — [PubMed 8423746](https://pubmed.ncbi.nlm.nih.gov/8423746/):
  - 1RM rose 31.7% and 7–10RM rose 51.4%. The relative 7–10RM went from 68.4% to 79.1% of 1RM.
  - Applying the pre-training equation after training **systematically overpredicted 1RM by 21.2 kg**.
- **Velocity, for contrast** [SECONDARY]: the bench press mean-propulsive-velocity vs %1RM relationship (R² = 0.98 in 120 strength-trained men) reportedly stayed stable after a 9.3% 1RM increase over 6 weeks (González-Badillo & Sánchez-Medina 2010) — [Marzagao 2026 lit. review](https://arxiv.org/pdf/2603.17495).
- In 70 trained older women, the Kemmler cubic equation was accurate across 3–20 RTF after 2 years of training (MAD 1.5–3.1%), suggesting a population-specific equation can hold in a trained steady state — [PubMed 17194251](https://pubmed.ncbi.nlm.nih.gov/17194251/).
- The repetitions–1RM relationship is best modelled per individual — [Mitter 2023](https://pubmed.ncbi.nlm.nih.gov/35703009/). It is also changed by training background — [Richens & Cleather 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4042664).

### Inferences
- A training phase heavy in high-rep work (hypertrophy blocks) may raise reps at a given %1RM and inflate e1RMs derived from 8–15-rep sets, as Braith's data show. A heavy strength block may do the opposite (Mayhew's top gainers did fewer reps). Trend lines built from mixed rep ranges can therefore show spurious changes when the block focus changes.
- Implementation suggestions (inference):
  - (a) Track e1RM per exercise primarily from sets with r_eff ≤ 6–8 when available.
  - (b) Show separate "strength e1RM" (low-rep) and "rep-PR" metrics rather than merging them.
  - (c) Learn a per-user, per-exercise correction (actual 1RM or heavy-single e1RM ÷ formula e1RM from higher-rep sets) and refresh it whenever the user logs a heavy single or triple at RPE ≥ 9.
  - (d) Flag e1RM jumps that coincide with a change in typical rep range as possibly artifactual.
- For beginners, early e1RM gains largely reflect learning and neural adaptation, and RIR calibration is poor. Show trends with wider bands for the first ~4–8 weeks.

### Gaps
- No modern study was found that tests how well reps + RIR e1RMs (or AMRAP-based e1RMs) track measured 1RM changes in **trained powerlifters or bodybuilders** over a block. The main data are from novice women (bench) and novice knee extension, both pre-2010.
- No study examined whether formula bias shifts differently across hypertrophy vs strength blocks within the same lifters.

---

## Q6. How reliable is 1RM testing itself (test–retest variability, smallest worthwhile change), so an app can tell whether an e1RM change is real?

### Takeaway
A directly tested 1RM is highly reliable: median ICC 0.97 and median CV 4.2% across 32 studies. Trained lifters are more consistent (median CV ~3.3%; e.g. 2.1% for back squat in strength-trained men) than untrained people (median ~5.5%). Lower-body lifts vary more in absolute kg (95% limits of agreement roughly ±10–15 kg for squat vs ±3–5 kg for bench).

Using Hopkins' typical-error framework, a change has to exceed roughly 2.8 × the typical error (≈6–9% for trained lifters, ≈11–15% for untrained) to be "real" with 95% confidence from two single tests. Smaller changes become credible through repeated measures or trends. e1RMs from submaximal logged sets are noisier than true 1RM tests (≈8–10% within-person spread in app data), so trend smoothing is essential.

### Cited Findings
- **Grgic, Lazinica, Schoenfeld & Pedisic 2020**, *Sports Med Open* 6:31 [PR, systematic review] — [PMC7367986](https://pmc.ncbi.nlm.nih.gov/articles/PMC7367986):
  - Sample: 32 studies, n = 1,595.
  - Overall: ICC 0.64–0.99 (median 0.97); CV 0.5–12.1% (median 4.2%).
  - By training status: trained median CV 3.3% (0.5–7.8%) vs untrained 5.5% (1–12%).
  - By body region: upper body median 4.1% vs lower body 4.7%. Single-joint median 4.1% vs multi-joint 4.3%.
  - Familiarization: 0 sessions, median 5.3%; ≥1 session, median 3.8%.
  - Individual studies — bench press CV 1.9–6.5%; squat 1.6–12.1% (Smith machine 12.1% in men); leg press 2.4–6.7%.
  - Bland–Altman 95% limits of agreement: ≈±3–5 kg bench, ±10–15 kg squat, ±8–13 kg leg press.
  - Retest bias: about two-thirds of analyses showed no systematic change. Where present, retest values were higher (median +5.5 kg lower body, +1.8 kg upper body).
  - Familiarization is "not necessary for a reliable assessment of 1RM", although untrained people may need many sessions (≈1.6 kg gain per session).
- **Banyard, Nosaka & Haff 2017** [PR]: 17 strength-trained men, 3 back-squat 1RM tests on separate days. ICC 0.99, SEM 2.9 kg, CV 2.1%. Individual between-trial variation −5.6% to +4.8% — [PubMed 27669192](https://pubmed.ncbi.nlm.nih.gov/27669192/).
- **Reynolds 2006** [PR]: 5RM chest press and leg press test–retest ICC 0.999. 60–65% of subjects lifted the identical load. Residual ranges were 5–10 kg (leg press) and 2–5 kg (chest press) — [Reynolds 2006](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf).
- **Hopkins 2000** [PR]: the typical (standard) error of measurement — the SD of an individual's repeated measurements, best expressed as a CV — is the recommended reliability statistic for "decision-making when monitoring individuals". Limits of agreement are "the 95% likely range of change of an individual's measurements between 2 trials". Precise reliability estimates need ~50 participants and ≥3 trials — [PubMed 10907753](https://pubmed.ncbi.nlm.nih.gov/10907753/).
- RIR-based load selection is also repeatable session to session (CV 2.7–6.2%) in novices — [Lovegrove 2022](https://pubmed.ncbi.nlm.nih.gov/36135029/).
- Within-person e1RM spread from near-failure logged sets within 14 days was ≈8.5–10% (SD of log e1RM 0.085–0.103) [PREPRINT] — [Marzagao 2026](https://arxiv.org/pdf/2603.17495).

### Inferences
- **Minimal detectable change** between two single measurements: MDC95 ≈ 1.96 × √2 × TE ≈ 2.77 × CV (computed). That gives:
  - Trained back squat (CV 2.1%): ≈5.8%.
  - Trained median (CV 3.3%): ≈9.1%.
  - Overall median (CV 4.2%): ≈11.6%.
  - Untrained median (CV 5.5%): ≈15.2%.
  - So a single 1RM test after a short block rarely proves a real change in an individual; trends across many sessions are more informative.
- **Practical thresholds for the app** (inference):
  - Smooth per-exercise e1RM, e.g. with an exponentially weighted moving average or a Kalman/Bayesian local-level filter. Use measurement noise ≈3–5% for heavy, high-RPE, low-rep sets and ≈8–10% for typical logged sets; the process noise represents true strength change.
  - Label a change "likely real" when the smoothed trend changes by more than ~1 TE (≈2–4% for trained users) sustained over ≥2–3 sessions. Label it "very likely real" when it exceeds ~2.8 TE (≈6–9% trained, 11–15% novice) or when its 95% credible interval excludes zero.
  - Show a "PR" badge for actual load × reps PRs separately from e1RM changes, since e1RM is model-dependent.
  - Use exercise-specific noise in kg: squat and leg press have wider absolute LoA (±8–15 kg) than bench (±3–5 kg).
  - Account for the learning effect in beginners (retest increases of up to several kg) before calling plateaus or regressions.

### Gaps
- No reliability data specific to competitive powerlifters' or bodybuilders' 1RMs on squat, bench and deadlift were found beyond Banyard 2017 (squat). Grgic 2020 reported no deadlift reliability data.
- I found no peer-reviewed estimate of day-to-day variability of e1RM computed from RPE-rated submaximal sets (as opposed to 1RM tests) in trained lifters. The only figure is the industry preprint.
- Hopkins' "smallest worthwhile change = 0.2 × between-subject SD" convention is widely used, but the source describing it (Hopkins' Sportscience articles) was not retrieved here. For an individual app user, TE-based thresholds (above) are more directly applicable.
