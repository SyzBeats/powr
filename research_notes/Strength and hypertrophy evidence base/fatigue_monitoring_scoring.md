# Fatigue, Recovery and Readiness Monitoring, Training-Load Metrics, Powerlifting Scoring Formulas, Strength Standards and Injury Epidemiology (for a bodybuilding/powerlifting training-planner PWA)

Scope note: These notes cover load quantification, readiness, recovery time course, sleep and stress, scoring formulas, strength standards and injury epidemiology. Out of scope (other researchers cover these): 1RM prediction, RPE/RIR scale definitions, set-volume dose-response, periodization and deloads, rest intervals and tempo, nutrition. Citations were checked against PubMed/Europe PMC metadata and abstracts, or against primary source code and official documents. Details that come only from full texts I could not open are flagged as such.

---

## 1. Training-load quantification: which metrics to compute from logged training, and should the app use ACWR?

### Takeaway
For resistance training, compute **volume load** (sets × reps × kg), **relative volume load** (reps × %1RM), and **session-RPE load** (CR-10 session RPE × minutes). Monotony and strain are cheap to add as descriptive metrics. Do **not** use the acute:chronic workload ratio (ACWR) as an injury-risk predictor or a hard warning threshold: its causal and statistical basis has been strongly criticised, and it has never been validated in strength sports. A Banister fitness-fatigue model can be an optional "experimental" visual, but its parameters are unstable and need performance data to fit.

### Cited Findings

**Volume load and relative load (resistance-specific)**
- Scott et al.'s review of resistance-training monitoring says training dose depends on exercise type, load, volume, inter-set rest and repetition velocity. It argues **%1RM alone is an inadequate measure of intensity** and recommends combining volume-load calculations, session and set-level RPE, well-being questionnaires and velocity-tracking devices. The authors state there is **no consensus on how best to integrate these methods**. Scott BR, Duthie GM, Thornton HR, Dascombe BJ. *Sports Med* 2016;46(5):687-698. PMID 26780346 — [doi:10.1007/s40279-015-0454-0](https://doi.org/10.1007/s40279-015-0454-0); accepted manuscript at [vuir.vu.edu.au/32754](https://vuir.vu.edu.au/32754)
- A systematic review of resistance-training monitoring devices says traditional methods "such as volume load have been used, but these have inherent flaws". It found **linear position transducers more accurate and reliable than other device types**, such as accelerometers and camera or phone apps (44 studies). Most validity studies did not use a gold-standard criterion. Weakley J et al. *Sports Med* 2021;51(3):443-502 — [doi:10.1007/s40279-020-01382-w](https://doi.org/10.1007/s40279-020-01382-w)
- Standard definitions, as used throughout the literature reviewed by Scott et al. 2016 ([doi](https://doi.org/10.1007/s40279-015-0454-0)):
  - `VolumeLoad (kg) = Σ_sets (reps × load_kg)` (also called "tonnage").
  - `RelativeVolumeLoad = Σ_sets (reps × load_kg / 1RM_kg)`, i.e. reps × %1RM. This makes the number comparable across lifts and lifters.

**Session-RPE (sRPE) method**
- Foster et al. 2001 validated the session-RPE method against a heart-rate standard in steady-state and interval cycling and in basketball. They call it a valid, "mode and intensity-independent" way to quantify training. `sRPE load (AU) = session RPE (CR-10) × session duration (min)`. Foster C et al. *J Strength Cond Res* 2001;15(1):109-115. PMID 11708692 — [doi:10.1519/1533-4287(2001)015<0109:ANATME>2.0.CO;2](https://pubmed.ncbi.nlm.nih.gov/11708692/)
- Sweet et al. 2004 applied the method to resistance training (10 men and 10 women, habituated to both aerobic and resistance training; 2 sets × 6 exercises at 50%/15 reps, 70%/10 reps and 90%/4 reps of 1RM). **Session RPE rose with intensity even though total work fell.** Session RPE was taken **30 min after the session**. It "may meaningfully underestimate the average intensity rated immediately after each set." Sweet TW, Foster C, McGuigan MR, Brice G. *J Strength Cond Res* 2004;18(4):796-802. PMID 15574104 — [doi:10.1519/14153.1](https://doi.org/10.1519/14153.1)
- Day et al. 2004 (9 men and 10 women; 5 exercises; 1×4–5 at 90%, 1×10 at 70% and 1×15 at 50% 1RM, each done twice): sRPE was higher for the heavy protocol. "Performing fewer repetitions at a higher intensity was perceived to be more difficult." **Session-RPE ICC = 0.88.** Day ML, McGuigan MR, Brice G, Foster C. *J Strength Cond Res* 2004;18(2):353-358. PMID 15142026 — [doi:10.1519/R-13113.1](https://doi.org/10.1519/R-13113.1)
- In an RCT of 20 previously trained young men over 6 weeks, an **sRPE-guided progression model** led to fewer high-intensity sessions than a predetermined progression. Gains in CSA (+6.55% vs +9.65%) and strength (+9.68% vs +9.28%) were similar, and total volume load was not different (45,366 vs 47,779 kg; p = 0.52). Gomes RL et al. *J Strength Cond Res* 2022;36(4):971-976 — [doi:10.1519/JSC.0000000000003568](https://doi.org/10.1519/JSC.0000000000003568)

**Monotony and strain (Foster 1998)**
- Foster 1998 (n = 25 experienced athletes) defined **monotony = daily mean load ÷ standard deviation of daily load** (over a week) and **strain = load × monotony**. A high percentage of banal illnesses occurred when athletes exceeded individually identifiable thresholds, "mostly related to the strain of training". Load was tracked as a rolling 6-week average. Foster C. *Med Sci Sports Exerc* 1998;30(7):1164-1168. PMID 9662690 — [doi:10.1097/00005768-199807000-00023](https://doi.org/10.1097/00005768-199807000-00023)
  - Implementation form: `weeklyLoad = Σ_{7 days} dailyLoad` (rest days = 0); `monotony = mean(dailyLoad_7d) / sd(dailyLoad_7d)`; `strain = weeklyLoad × monotony`.
  - Note: the frequently quoted "monotony > 2.0 = risky" threshold is a practitioner heuristic attributed to Foster's work. I did not verify it in the abstract. The abstract stresses **individual** thresholds.

**Banister impulse-response (fitness-fatigue) model**
- General form: `Perf(t) = p0 + k1 Σ_{s<t} w(s)·e^{-(t-s)/τ1} − k2 Σ_{s<t} w(s)·e^{-(t-s)/τ2}`, where w is daily training load, k1, k2 are gains and τ1 > τ2 are the decay constants. This is a standard model (Banister 1975, not indexed). It was applied to **6 elite weightlifters over 1 year**: predicted and actual performance correlated significantly in every subject, and modelled "fitness" tracked serum testosterone (group r = 0.73). "The fatigue index remains to be clarified." Busso T et al. *Eur J Appl Physiol* 1990;61(1-2):48-54 — [doi:10.1007/BF00236693](https://doi.org/10.1007/BF00236693); follow-up Busso T et al. *Eur J Appl Physiol* 1992;64(4):381-386 — [doi:10.1007/BF00636228](https://doi.org/10.1007/BF00636228)
- Limitations: in 9 elite swimmers the model fitted well (R² = 0.79 ± 0.13), but the 95% CIs of the key time constants were very wide (e.g. τa = 38 [17, 59] days, τf = 19 [6, 32] days). Some parameters were so highly correlated that "their interpretation [is] worthless" (ill-conditioning). Hellard P et al. *J Sports Sci* 2006;24(5):509-520 — [doi:10.1080/02640410500244697](https://doi.org/10.1080/02640410500244697)
- A practitioner review of the fitness-fatigue model for strength coaches (not empirical): Chiu LZF, Barnes JL. "The Fitness-Fatigue Model Revisited." *Strength Cond J* 2003;25(6):42-51 — [doi:10.1519/00126548-200312000-00007](https://doi.org/10.1519/00126548-200312000-00007)

**ACWR: original proposal**
- Gabbett 2016 proposed the acute:chronic workload ratio, typically 1-week acute ÷ 4-week rolling chronic load, as a "best practice predictor" of non-contact injury. The paper is a team-sport narrative and model paper. Gabbett TJ. *Br J Sports Med* 2016;50(5):273-280 — [doi:10.1136/bjsports-2015-095788](https://doi.org/10.1136/bjsports-2015-095788) (PMC4789704). In the full text, the widely cited "sweet spot" is ACWR ≈ 0.8–1.3 and the "danger zone" is ≥ 1.5. These are team-sport (rugby/cricket/AFL) derived figures.
- EWMA variant: `EWMA_today = load_today × λ + (1 − λ) × EWMA_yesterday`, with `λ = 2/(N+1)`, where N = 7 for acute and 28 for chronic. Williams S, West S, Cross MJ, Stokes KA. *Br J Sports Med* 2017;51(3):209-210 — [doi:10.1136/bjsports-2016-096589](https://doi.org/10.1136/bjsports-2016-096589)

**ACWR: criticisms**
- Lolli et al. showed that in the conventional "coupled" ACWR the acute week is also part of the chronic denominator. This **mathematical coupling causes spurious correlation**. Lolli L et al. *Br J Sports Med* 2019;53(15):921-922 — [doi:10.1136/bjsports-2017-098110](https://doi.org/10.1136/bjsports-2017-098110)
- Impellizzeri et al. 2020 concluded: "There is **no evidence supporting the use of ACWR in training-load-management systems** or for training recommendations aimed at reducing injury risk." The ratio is "an inaccurate metric (failing to normalize the numerator by the denominator even when uncoupled)", ambiguous, "not consistently and unidirectionally related to injury risk", and "adds noise and creates statistical artifacts." Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. *Int J Sports Physiol Perform* 2020;15(6):907-913 — [doi:10.1123/ijspp.2019-0864](https://doi.org/10.1123/ijspp.2019-0864)
- Impellizzeri et al. 2021 reanalysed published data. Dividing acute load by **fixed or random "chronic" values gave similar odds ratios** (e.g. OR 1.95 dividing by a constant 1510, vs 2.45 for the real ACWR). Neither ACWR nor acute load improved prediction over an intercept-only model (c-statistic 0.574/0.544 vs 0.5). They recommend that ACWR "be dismissed as a framework and model." *Sports Med* 2021;51(3):581-592 — [doi:10.1007/s40279-020-01378-6](https://doi.org/10.1007/s40279-020-01378-6)
- Wang et al. 2020 list further problems. Ratios may misrepresent change. EWMA has an **initial-load problem** and is inapplicable when athletes taper. Discretization, sparse data, bias in injured athletes, time-varying confounding and subsequent injuries are all issues. They "should discourage its use." Wang C, Vargas JT, Stokes T, Steele R, Shrier I. *Sports Med* 2020;50(7):1243-1254 — [doi:10.1007/s40279-020-01280-1](https://doi.org/10.1007/s40279-020-01280-1)
- Consensus context: the 2016 Doha conference consensus statement describes internal and external load monitoring frameworks in general terms. Bourdon PC et al. *Int J Sports Physiol Perform* 2017;12(Suppl 2):S2161-S2170 — [doi:10.1123/ijspp.2017-0208](https://doi.org/10.1123/ijspp.2017-0208)

**Overtraining markers in resistance training**
- A systematic review of 22 resistance-training overreaching/overtraining studies found few studies that properly established functional overreaching, non-functional overreaching or overtraining syndrome. Overtraining "may be related to frequent high-intensity and **monotonous** resistance training". **"No marker other than a sustained decrease in performance has been established as a reliable indicator of overtraining in resistance exercise."** Grandou C, Wallace L, Impellizzeri FM, Allen NG, Coutts AJ. *Sports Med* 2020;50(4):815-828 — [doi:10.1007/s40279-019-01242-2](https://doi.org/10.1007/s40279-019-01242-2)

### Inferences
- **Metrics to compute per set, session, week and muscle group:**
  - `VL = Σ reps × kg`
  - `RVL = Σ reps × (kg / e1RM)`, using the user's current e1RM or tested 1RM per lift
  - `sRPE-load = sessionRPE × minutes`
  - Weekly sum, monotony and strain from daily sRPE-load or VL
  - Optional "intensity-weighted VL", e.g. `Σ reps × kg × (setRPE/10)`. This is a **practitioner heuristic with no validation found**; label it so in the UI.
- **Volume load is load-biased and lift-specific.** One deadlift set outweighs many lateral-raise sets. Show VL per lift or per muscle group and trend it against the user's own history. Do not compare it across exercises. RVL is better for comparing across lifts.
- **sRPE is the most validated whole-session internal-load metric for resistance training** (ICC 0.88). Prompt for it **~15–30 min post-session**, because Foster/Sweet/Day collected it 30 min post. Accept a later entry, with a flag.
- **ACWR:** if shown at all, show it as a **neutral descriptive "this week vs your 4-week average" percent change**, not a red/green injury-risk gauge. Use an uncoupled or EWMA calculation, and seed EWMA with ≥ 4 weeks of data or hide it until then. Avoid hard-coded "danger zone ≥ 1.5" warnings: those come from team sports, and their validity is disputed.
- **Banister model:** treat it as optional and experimental. It needs repeated performance measures (e.g. e1RM or top-set velocity) to fit k1, k2, τ1 and τ2 per user. Parameter instability means fitted curves should not drive automatic programming. If default constants are needed for a visual only, the classic heuristic is τ1 ≈ 42 d and τ2 ≈ 7 d, as in "CTL/ATL"-style apps. This is a practitioner convention I did not verify in a primary source here.
- Use a **sustained decline in performance** (e.g. e1RM or rep-performance at a fixed load falling across ≥ 2–3 sessions or ~2 weeks) as the primary "possible overreaching" trigger, combined with wellness trends. This follows Grandou 2020.

### Gaps
- I found no peer-reviewed study linking ACWR, monotony or strain to injury or performance **specifically in powerlifters or bodybuilders**.
- I found no validated method for weighting volume load by proximity to failure or RPE. An "intensity-weighted load" is a heuristic.
- The "monotony > 2" threshold and the Gabbett sweet-spot numbers came from full texts and secondary sources, not the abstracts I verified.
- Recent (2023–2026) fitness-fatigue modelling in strength athletes, e.g. a SportRxiv preprint by Stephens Hemingway/Swinton et al. 2021, was not retrieved.

---

## 2. Readiness and recovery monitoring: what works for lifters, with thresholds or decision rules?

### Takeaway
Subjective self-report measures (wellness questionnaires, Perceived Recovery Status) track training load more sensitively and consistently than objective markers. They are also free on a phone, so a short daily check-in is the right core feature. Objective add-ons that are feasible in a PWA: **bar velocity against a fixed warm-up load** (best supported in resistance-training recovery studies) and averaged **countermovement-jump height**, if the user has a device. HRV-guided resistance training has **not** beaten fixed schedules in two small RCTs. Published numeric cut-offs are few. Decision rules must be individual-baseline (z-score/SWC) heuristics.

### Cited Findings

**Subjective vs objective measures**
- A systematic review of 56 studies found that subjective and objective well-being measures "generally did not correlate". **Subjective measures reflected acute and chronic training loads with superior sensitivity and consistency** than objective measures such as blood markers and heart rate. Well-being worsened with acute load increases and with chronic training, and improved with acute load reductions. Saw AE, Main LC, Gastin PB. *Br J Sports Med* 2016;50(5):281-291 — [doi:10.1136/bjsports-2015-094758](https://doi.org/10.1136/bjsports-2015-094758). Note: mostly endurance and team-sport athletes.

**Hooper index**
- Fourteen elite swimmers kept daily well-being logs over a 6-month season. Regression of the well-being ratings predicted staleness scores (76% of variance). During taper, well-being ratings predicted performance improvement (72% of variance). Hooper SL, Mackinnon LT, Howard A, Gordon RD, Bachmann AW. *Med Sci Sports Exerc* 1995;27(1):106-112 — [doi:10.1249/00005768-199501000-00019](https://doi.org/10.1249/00005768-199501000-00019)
  - Commonly implemented as the **Hooper Index = sum of sleep quality, fatigue, stress and muscle soreness, each rated 1–7** (1 = very, very good/low; 7 = very, very bad/high). The scale details come from the full text and secondary use; not verified in the abstract.

**McLean wellness questionnaire**
- Twelve professional rugby league players: CMJ flight time and power, perceived fatigue, well-being and soreness were reduced for ≥ 48 h after matches and recovered by ~4 days. McLean BD, Coutts AJ, Kelly V, McGuigan MR, Cormack SJ. *Int J Sports Physiol Perform* 2010;5(3):367-383 — [doi:10.1123/ijspp.5.3.367](https://doi.org/10.1123/ijspp.5.3.367)
  - The widely copied "McLean 5-item questionnaire" rates fatigue, sleep quality, general muscle soreness, stress and mood on 1–5 scales and sums them. Item details come from the full text and are not verified in the abstract.

**Perceived Recovery Status (PRS) scale**
- Laurent et al. 2011 developed a **0–10 PRS scale**, rated after warm-up and before the session. Sixteen volunteers (8 men, 8 women) did repeated sprint bouts after 24, 48 and 72 h of recovery. PRS correlated with the change in sprint performance at **r = −0.63**. Laurent CM et al. *J Strength Cond Res* 2011;25(3):620-628 — [doi:10.1519/JSC.0b013e3181c69ec6](https://doi.org/10.1519/JSC.0b013e3181c69ec6). Scale anchors from the full text, not verified here: 0 = very poorly recovered/extremely tired; ~5 = adequately recovered; 10 = very well recovered/highly energetic.
- In resistance training, 35 trained subjects did a high-volume full-body session (3 sets each of squat, bench, deadlift, pull-ups, dips, rows, press, curls and extensions). **PRS fell from 8.6 ± 2.3 to 4.2 ± 1.85 at 48 h**, and CK rose from 189 to 512 U/L. PRS was inversely related to CK (reported r = 0.58). Sikorski EM et al. *J Strength Cond Res* 2013;27(8):2079-2085 — [doi:10.1519/JSC.0b013e31827e8e78](https://doi.org/10.1519/JSC.0b013e31827e8e78)
- In 24 resistance-trained males and females, perceived recovery decreased, and soreness and discomfort increased, as sets got closer to failure (FAIL vs 1 RIR vs 3 RIR). Refalo MC, Helms ER, Hamilton DL, Fyfe JJ. *Sports Med Open* 2023;9:10 — [doi:10.1186/s40798-023-00554-y](https://doi.org/10.1186/s40798-023-00554-y)

**Readiness vs motivation (new, 2026)**
- Twenty-eight resistance-trained females did two supervised mesocycles with velocity recorded on every rep. In multivariate models, **motivation to train predicted training performance** (velocity relative to the load-velocity-profile expectation; β = 0.0004, p = 0.021). **Self-rated "readiness to perform" did not.** Menstrual-cycle phase effects were tiny (~0.01–0.02 m/s). Munteanu G et al. *Sports Med* 2026;56(9):2325-2339 — [doi:10.1007/s40279-026-02459-8](https://doi.org/10.1007/s40279-026-02459-8)

**DALDA**
- The Daily Analysis of Life Demands for Athletes (DALDA) is a stress-tolerance questionnaire. Rushall BS. "A tool for measuring stress tolerance in elite athletes." *J Appl Sport Psychol* 1990;2(1):51-66 — [doi:10.1080/10413209008406420](https://doi.org/10.1080/10413209008406420). Structure from secondary knowledge, not verified in the source here: Part A, sources of stress (9 items); Part B, symptoms of stress (25 items); each rated "worse than normal / normal / better than normal".

**Countermovement jump**
- A meta-analysis of 151 articles found that **average CMJ height was more sensitive than highest CMJ height** for detecting fatigue and supercompensation. Peak and mean power, peak velocity, peak force and impulse were also sensitive to supercompensation. Claudino JG et al. *J Sci Med Sport* 2017;20(4):397-402 — [doi:10.1016/j.jsams.2016.08.011](https://doi.org/10.1016/j.jsams.2016.08.011)

**Bar velocity as a fatigue and readiness marker**
- In 18 strength-trained men, mean velocity loss over 3 sets, loss of velocity against the **load that elicits 1 m·s⁻¹ ("V1-load")** pre-to-post, and CMJ height loss were all highly inter-correlated (**r = 0.91–0.97**). Velocity loss correlated with peak lactate (r = 0.93–0.97). Sánchez-Medina L, González-Badillo JJ. *Med Sci Sports Exerc* 2011;43(9):1725-1734 — [doi:10.1249/MSS.0b013e318213f880](https://doi.org/10.1249/MSS.0b013e318213f880)
- In the bench press (50–85% 1RM), relative velocity loss within a set relates very closely and reliably to the percentage of possible reps completed. Equations are provided. González-Badillo JJ et al. *Int J Sports Med* 2017;38(3):217-225 — [doi:10.1055/s-0042-120324](https://doi.org/10.1055/s-0042-120324)
- Velocity against a fixed load (V1-load, 75% 1RM or 70% 1RM) has been used as the recovery outcome in several trained-lifter studies: Morán-Navarro 2017, Pareja-Blanco 2017/2020, Belcher 2019 and Refalo 2023 (see Section 3).

**HRV-guided resistance training**
- In 20 young men, the individualized group trained only when RMSSD had returned to baseline (baseline set over 5 days), otherwise waiting 24 h. The fixed group trained every 48 h. 1RM gains (30% vs 42%) and CSA gains did **not** differ, and individualization did not reduce inter-individual variability. De Oliveira RM et al. *Eur J Sport Sci* 2019;19(8):1092-1100 — [doi:10.1080/17461391.2019.1572227](https://doi.org/10.1080/17461391.2019.1572227)
- Twenty-one older women (66 ± 5 y) had RMSSD-individualized recovery vs fixed recovery for 7 weeks: no group × time interaction for strength, CSA or function. Bittencourt D et al. *Front Physiol* 2024;15:1472702 — [doi:10.3389/fphys.2024.1472702](https://doi.org/10.3389/fphys.2024.1472702)
- In trained men, failure protocols (3×12[12] at 70% 1RM) reduced HRV and heart-rate complexity immediately post-exercise more than half-failure protocols (3×6[12]). Pareja-Blanco F et al. *Clin Physiol Funct Imaging* 2017;37(6):630-639 — [doi:10.1111/cpf.12348](https://doi.org/10.1111/cpf.12348)

### Inferences
- **Daily check-in (≤ 30 s).** Ask 4–5 items on 1–5 or 1–7 sliders: sleep quality, sleep hours, fatigue/energy, general and local muscle soreness (optionally per muscle group, useful for bodybuilders), stress and mood. Add one PRS item (0–10) and one motivation item. Motivation is supported by Munteanu 2026, and PRS is resistance-training-tested in Sikorski 2013.
- **Scoring (heuristic, not from a validated source).** Convert each item to a **z-score against the user's own rolling 28-day baseline** (mean and SD; need ≥ 7–14 entries before flagging). Composite = mean z, after sign-aligning items so higher = better.
  - Practitioner rule of thumb: composite z ≤ −1.0 → "low readiness"; z ≤ −1.5, or PRS ≤ 3 on two consecutive days → "consider modifying".
  - No source in this review supports specific numeric cut-offs. Present them as adjustable defaults.
- **How to adjust training (heuristic decision rules; the evidence supports flexibility but not specific rules):**
  - Low readiness: keep the planned lift but cap top-set RPE (e.g. −1 RPE / +1 RIR), drop 1–2 back-off sets, or swap the heavy day with a lighter day later in the week.
  - Do **not** auto-cancel sessions on HRV alone. Two RCTs found no benefit of HRV-gated scheduling.
  - The sRPE-guided progression RCT (Gomes 2022) supports letting session-to-session responses modulate progression without loss of gains.
- **Objective readiness option (if the user has a velocity device or a validated app).** Record mean concentric velocity of a **standard warm-up single at a fixed load** (e.g. ~70–80% 1RM, or the user's V1-load) at each session. A drop beyond the user's typical day-to-day variation (practitioner default: > ~0.05–0.06 m/s, or > 1 SD of the user's history) is a fatigue signal. Weakley 2021 shows linear transducers are the most reliable devices. Phone-camera apps vary.
- **CMJ (optional).** Use the **average of 2–3 jumps**, not the best (Claudino 2017). Flag drops relative to the user's rolling baseline. In the studies reviewed, CMJ was depressed for 24–48 h after failure-type sessions (Section 3).
- **Grip strength** as a readiness marker: no supporting evidence for lifters was found (see Gaps). Do not prioritise it.

### Gaps
- I found **no validated numeric thresholds** (cut-offs for the Hooper index, PRS, wellness z-scores or velocity drops) that prescribe training modifications for powerlifters or bodybuilders.
- No studies of **grip strength** as a readiness marker in resistance-trained athletes were found in this search.
- I found no RCT of **wellness-questionnaire-guided** autoregulation in powerlifters.
- The scale anchors for Hooper/McLean/PRS and the DALDA item structure were not verified against full texts in this session.
- A 2020 study (Vernon, Joyce, Banyard; *Int J Sports Sci Coach*) on "readiness to train" and return to baseline velocity was searched for but not retrieved.

---

## 3. Recovery time course after resistance training: implications for spacing sessions for the same muscle or lift

### Takeaway
In **trained** lifters, neuromuscular performance after typical non-failure work at moderate-to-heavy loads mostly recovers within **~24–48 h**. Sessions to **failure**, especially high-rep failure sets, delay recovery by roughly another **24–48 h**, with lower-body performance and muscle-damage markers taking **48–72 h** (squat velocity up to 72 h). Untrained or unaccustomed and eccentric-heavy work causes much larger and longer deficits, from 3 to 5+ days. Muscle protein synthesis after a heavy bout is roughly doubled at 24 h and near baseline by ~36 h in young men, and the response is shorter and smaller in trained individuals.

### Cited Findings

**Proximity to failure**
- Morán-Navarro et al. 2017: 10 resistance-trained men; bench press and full squat; 3×5(10) vs 6×5(10) vs 3×10(10); measured from −12 h to +72 h. Failure produced larger acute drops in CMJ and in velocity at the V1-load and 75% 1RM, even against equal total volume (6×5). **Non-failure protocols recovered significantly faster between 24 and 48 h.** Ammonia, GH and CK showed that "training to failure slows down recovery up to 24–48 h post-exercise." *Eur J Appl Physiol* 2017;117(12):2387-2399 — [doi:10.1007/s00421-017-3725-7](https://doi.org/10.1007/s00421-017-3725-7)
- Pareja-Blanco et al. 2017: 10 men, 70% 1RM, 3×6[12] vs 3×12[12]. Within-set velocity loss was 65% vs 26% (bench) and 44% vs 20% (squat). The failure protocol reduced V1-load velocity **until 24 h (bench) and 6 h (squat)** and **CMJ up to 48 h**, with greater CK at 48 h. "Halving the number of repetitions in relation to the maximum… serves to minimize fatigue and speed up recovery." *Clin Physiol Funct Imaging* 2017;37(6):630-639 — [doi:10.1111/cpf.12348](https://doi.org/10.1111/cpf.12348)
- Pareja-Blanco et al. 2020: 10 males, 10 protocols from 6(12) to 4(4), 3 sets, bench and squat. Protocols to failure, **especially high-rep ones**, caused larger reductions in mechanical function that "remained reduced up to 48-hour post-exercise", plus greater CK and hormonal responses. *J Strength Cond Res* 2020;34(10):2867-2876 — [doi:10.1519/JSC.0000000000002756](https://doi.org/10.1519/JSC.0000000000002756)
- Refalo et al. 2023: 24 trained males and females, 6 sets of bench at 75% 1RM to FAIL, 1 RIR or 3 RIR. Fixed-load velocity fell **−25% / −13% / −8%** at 4 min. At **24 h it was −3% (FAIL), −3% (1 RIR) and +2% (3 RIR)**. **All differences had disappeared by 48 h.** Males fatigued more than females after FAIL (−29% vs −21%). *Sports Med Open* 2023;9:10 — [doi:10.1186/s40798-023-00554-y](https://doi.org/10.1186/s40798-023-00554-y)
- Meta-analysis (20 studies in the systematic review, 12 in the meta-analysis): failure vs non-failure gave a greater drop in biomechanical performance (**SMD −0.96, 95% CI −1.43 to −0.49**), higher lactate/ammonia, **more muscle damage (CK), especially at 48 h**, and higher RPE. Upper-limb velocity impairment was larger. "RTF… can extend the time needed for recovery." Vieira JG et al. *Sports Med* 2022;52(5):1103-1125 — [doi:10.1007/s40279-021-01602-x](https://doi.org/10.1007/s40279-021-01602-x)

**By lift**
- Belcher et al. 2019: 12 well-trained males (training age 7.1 ± 4.2 y), 4 sets to failure at 80% 1RM of squat, bench or deadlift in separate weeks. Measured pre, post, 24, 48, 72 and 96 h. **Average concentric velocity at 70% 1RM was decreased up to 72 h after squat (−8.61%).** There were **no between-lift differences in recovery**, so the "deadlift does not result in greater muscle damage and recovery time than the squat and bench press." *Appl Physiol Nutr Metab* 2019;44(10):1033-1042 — [doi:10.1139/apnm-2019-0004](https://doi.org/10.1139/apnm-2019-0004)
  - A secondary summary of this study says bench velocity recovered by ~24 h and that damage markers need "at least 48–72 h" ([AUT repository record](https://openrepository.aut.ac.nz/items/fe9ce8b4-b96f-4081-99ba-26b2aa8cdb37)). The bench figure was truncated in the abstract I verified.

**Load and volume**
- Raastad & Hallén 2000: 10 male strength athletes, 90-min lower-body session; high intensity = 100% 3RM squat and front squat plus 6RM knee extension; moderate = 70% of that. Performance decrements were 12–14% vs 6–7%. Recovery was **biphasic**: rapid within ~11 h, then a plateau or second drop at 11–22 h. **Baseline was reached by 3 h after the moderate protocol and by 33 h after the 100% protocol.** *Eur J Appl Physiol* 2000;82(3):206-214 — [doi:10.1007/s004210050673](https://doi.org/10.1007/s004210050673)
- Bartolomei et al. 2017: 12 trained men (6.3 ± 3.4 y of training); high-volume (8×10) vs high-intensity (8×3); measured to 72 h. **High volume caused greater performance deficits and more muscle damage** than high intensity. *Eur J Appl Physiol* 2017;117(7):1287-1298 — [doi:10.1007/s00421-017-3598-9](https://doi.org/10.1007/s00421-017-3598-9). Exact per-time-point durations were truncated in the abstract.

**Training status, eccentric damage and the repeated-bout effect**
- Fifteen resistance-trained men (7.7 y of training) and 15 untrained men did 10×6 maximal eccentric elbow-flexor actions. In the trained group, **strength was back to baseline by 3 days**, while the untrained group was still **~40% below baseline**. Trained men had smaller changes in all markers except soreness. Newton MJ et al. *J Strength Cond Res* 2008;22(2):597-607 — [doi:10.1519/JSC.0b013e3181660003](https://doi.org/10.1519/JSC.0b013e3181660003)
- In 286 young men after an unaccustomed maximal eccentric bout, responder clusters showed MVC falling to 82%, 61% and 42% of baseline. MVC drop is the best indirect marker of muscle damage. Damas F et al. *Int J Sports Med* 2016;37(8):633-640 — [doi:10.1055/s-0042-100281](https://doi.org/10.1055/s-0042-100281)
- The repeated-bout effect (protection after an initial damaging bout) involves neural, mechanical, extracellular-matrix and signalling adaptations. Hyldahl RD, Chen TC, Nosaka K. *Exerc Sport Sci Rev* 2017;45(1):24-33 — [doi:10.1249/JES.0000000000000095](https://doi.org/10.1249/JES.0000000000000095)

**Muscle protein synthesis time course**
- In 6 healthy young men (12 sets of 6–12RM elbow flexion), MPS was **+50% at 4 h and +109% at 24 h** (citing prior data), and **within 14% of control (n.s.) at ~36 h**. MacDougall JD et al. *Can J Appl Physiol* 1995;20(4):480-486 — [doi:10.1139/h95-038](https://doi.org/10.1139/h95-038)
- **Resistance training attenuates the acute MPS response.** Mixed-muscle FSR rose from 0.036 to 0.080 %/h in untrained subjects vs 0.045 to 0.067 %/h in trained subjects (n = 6 + 6). Breakdown rose 37% only in untrained subjects. Phillips SM, Tipton KD, Ferrando AA, Wolfe RR. *Am J Physiol* 1999;276(1):E118-E124 — [doi:10.1152/ajpendo.1999.276.1.E118](https://doi.org/10.1152/ajpendo.1999.276.1.E118)
- In 10 untrained young men measured with deuterium oxide over 0–48 h post-exercise at weeks 1, 3 and 10: muscle damage (Z-band streaming) was highest at week 1 and minimal by week 10. Integrated MyoPS was highest at week 1 but **unrelated to hypertrophy then**. At weeks 3 and 10 it correlated with hypertrophy (r ≈ 0.9). In early training, MPS goes mainly to repair. Damas F et al. *J Physiol* 2016;594(18):5209-5222 — [doi:10.1113/JP272472](https://doi.org/10.1113/JP272472)

### Inferences
- **Default spacing rules for the planner** (heuristics derived from the above, for trained lifters):
  - Same lift or muscle, **heavy non-failure** work (≥ 2–3 RIR, low-to-moderate reps): **≥ 24–48 h**. Daily or near-daily practice of a lift is compatible if loads and effort are submaximal (Raastad: 3 h after 70%-type work; Refalo: 3 RIR fully recovered by 24 h).
  - Same lift or muscle, **sets to failure, or high-rep/high-volume** work: **≥ 48–72 h** before another hard session for that muscle or lift (Morán-Navarro, Pareja-Blanco, Belcher, Vieira).
  - **Unaccustomed or eccentric-heavy work**, a new exercise, or a return after a layoff: expect **3–5+ days** of strength loss. Novices sit in this category (Newton 2008; Damas 2016). Show a "new stimulus: expect more soreness" note.
  - The deadlift does **not** need a special longer recovery than the squat or bench in trained men (Belcher 2019). This contradicts a common gym belief.
- **Per-muscle "recovery status" model (app feature).** A simple heuristic decay model:
  - Assign each logged set a fatigue cost per muscle group, scaled by proximity to failure (e.g. failure = 1.0, 1 RIR = 0.8, 3 RIR = 0.5) and load or volume.
  - Decay with a half-life of ~12–24 h for non-failure work and ~24–36 h for failure or high-volume work, adjusted by the user's soreness and PRS.
  - These constants are **my heuristic fit to the studies above, not published parameters**.
- MPS evidence (elevated ~24–36 h, shorter in trained lifters) supports training each muscle **at least ~2×/week** for hypertrophy-oriented users. Frequency/volume prescription belongs to other researchers; mention it only as context.
- Make bodybuilder soreness (DOMS) logging per muscle. Soreness tracks damage but recovers on a similar or slightly longer timeline than performance (Belcher: soreness ~48–72 h). Treat it as a soft signal.

### Gaps
- Few studies directly measure recovery in **elite powerlifters** or at **> 85–90% 1RM, low-rep** work in a powerlifting-specific format. Most use 70–80% 1RM and university-level trained men.
- **Female-specific** recovery data are sparse (Refalo 2023 is an exception, showing less fatigue in females after failure).
- No study provided validated decay constants for a per-muscle fatigue model.
- Bartolomei 2017 and Belcher 2019 per-time-point values were truncated in the abstracts I verified.

---

## 4. Sleep and psychological stress: effects on strength performance and adaptation

### Takeaway
Acute sleep loss lowers exercise performance by about **7.6%** on average. The damage comes mainly from **total deprivation and late restriction** (waking early), with PM sessions more affected than AM sessions. For resistance training specifically, **a single night of deprivation has little effect on maximal strength**, but **consecutive nights of restriction reduce multi-joint strength**. One night of total deprivation also reduced MPS by 18%. **High life stress slows strength recovery over 96 h and blunts 12-week strength gains.** Both sleep and stress belong in the daily check-in.

### Cited Findings
- Craven et al. 2022 (69 publications; 227 outcomes; strength n = 66; 89% male) found a mean performance change of **−7.56% (95% CI −11.9 to −3.13)**, significant for every exercise category including strength.
  - **Consistent negative effects were found only for deprivation and late-restriction protocols.**
  - Performance fell **~0.4% for every hour awake** before the task.
  - **PM tasks were consistently impaired, while AM tasks were "largely unaffected."**
  - Craven J et al. *Sports Med* 2022;52(11):2669-2690 — [doi:10.1007/s40279-022-01706-y](https://doi.org/10.1007/s40279-022-01706-y)
- Knowles et al. 2018 (systematic review of 17 studies, rated moderate or weak quality): "**Sleep deprivation had little effect on muscle strength** during resistance exercise. In contrast, **consecutive nights of sleep restriction could reduce the force output of multi-joint, but not single-joint movements**." Suggested mitigations: group training, caffeine, training before long wakefulness. Knowles OE et al. *J Sci Med Sport* 2018;21(9):959-968 — [doi:10.1016/j.jsams.2018.01.012](https://doi.org/10.1016/j.jsams.2018.01.012)
- Lamon et al. 2021 (randomized crossover; 13 healthy young adults, 7 male and 6 female): one night of total sleep deprivation **reduced postprandial MPS by 18%** (0.072 to 0.059 %/h). Cortisol rose by 21% and testosterone fell by 24%. Lamon S et al. *Physiol Rep* 2021;9(1):e14660 — [doi:10.14814/phy2.14660](https://doi.org/10.14814/phy2.14660)
- Bartholomew et al. 2008: 135 undergraduates in 12 weeks of resistance training, twice weekly. **Low-stress participants gained significantly more bench press and squat 1RM** than high-stress participants (median split on the Adolescent Perceived Events Scale). Social support had no effect. Bartholomew JB, Stults-Kolehmainen MA, Elrod CC, Todd JS. *J Strength Cond Res* 2008;22(4):1215-1221 — [doi:10.1519/JSC.0b013e318173d0bf](https://doi.org/10.1519/JSC.0b013e318173d0bf)
- Stults-Kolehmainen & Bartholomew 2012: 31 resistance-training students did 10RM leg press plus 6 sets. Life-event stress and perceived stress moderated recovery of maximal isometric force during the first hour, adjusted for fitness, workload and experience. *Med Sci Sports Exerc* 2012;44(11):2220-2227 — [doi:10.1249/MSS.0b013e31825f67a0](https://doi.org/10.1249/MSS.0b013e31825f67a0)
- Stults-Kolehmainen, Bartholomew & Sinha 2014 (same protocol, n = 31): **higher stress meant worse recovery of maximal isometric force, energy, fatigue and soreness over 96 h**. "Under conditions of inordinate stress, individuals may need to be more mindful about observing an appropriate length of recovery." *J Strength Cond Res* 2014;28(7):2007-2017 — [doi:10.1519/JSC.0000000000000335](https://doi.org/10.1519/JSC.0000000000000335)

### Inferences
- Check-in items: **sleep hours last night**, sleep quality, wake time vs usual (late restriction = early waking is the harmful pattern), and **perceived life stress** (1–5).
- Heuristic adjustments:
  - After **< 6 h sleep**, which is Craven's definition of sleep loss: if the session is in the PM, suggest keeping intensity but trimming volume or skipping max-effort singles. Morning sessions are less affected.
  - After **≥ 2 consecutive short nights**: reduce load expectations on multi-joint lifts (squat, bench, deadlift) more than on isolation work (Knowles 2018).
  - On **high-stress weeks**: lengthen the spacing between hard sessions for the same muscle or lift by ~24 h and soften progression targets (Stults-Kolehmainen 2014; Bartholomew 2008).
- Use trends in rolling 7-day average sleep, not a single night, for "adaptation risk" messaging. One-night deprivation has small strength effects, but repeated restriction matters.

### Gaps
- Effects of **chronic** sleep restriction on long-term hypertrophy or strength gains in trained lifters: no RCTs found.
- The stress studies used **undergraduate** trainees (novice to intermediate), not competitive powerlifters or bodybuilders.
- The Craven strength-subgroup estimates by protocol and time of day are in tables I did not fully verify.

---

## 5. Powerlifting scoring formulas: exact equations and coefficients

### Takeaway
All formulas below were transcribed from the OpenPowerlifting source code. Seven unit-test vectors reproduced exactly (see the test-vector list). The 2019 IPF Formula coefficients were also cross-checked against the official IPF announcement document. All inputs are **kilograms**; 1 lb = 0.45359237 kg. Formulas differ in scale (Wilks/DOTS ~ 300–600, Wilks2020 ~ 20% higher than Wilks, IPF Points ~ 500-centred, GL ~ 100-centred) and **are not interchangeable**.

### Cited Findings

#### 5.1 Original Wilks (men and women)
- `coef = 500 / (a + b·x + c·x² + d·x³ + e·x⁴ + f·x⁵)`, where x = bodyweight in kg; `score = coef × lifted_kg` (total or a single lift).
  - **Men:** a = −216.0475144, b = 16.2606339, c = −0.002388645, d = −0.00113732, e = 7.01863E−06, f = −1.291E−08
  - **Women:** a = 594.31747775582, b = −27.23842536447, c = 0.82112226871, d = −0.00930733913, e = 0.00004731582, f = −0.00000009054
  - OpenPowerlifting clamps bodyweight to **[40, 201.9] kg for men** and **[26.51, 154.53] kg for women**. The upper bound "avoids asymptote" and the lower bound "avoids children with huge coefficients".
  - Unit tests: men 100 kg / 1000 kg → **608.58907**; women 60 kg / 500 kg → **557.4434**.
  - Source: [OpenPowerlifting wilks.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/wilks.rs)
- Validation: on 1996–97 IPF world-class lifters (30 men, 27 women per lift), Wilks showed **no bias for bench and total**. It showed a favourable bias toward intermediate-weight women in the squat, and a **linear unfavourable bias against heavier lifters in the deadlift**. Conclusion: "As used currently (BP and TOT only)" Wilks "appears to be a valid method." The study also notes that the Wilks formula "is not… based on published data." Vanderburgh PM, Batterham AM. *Med Sci Sports Exerc* 1999;31(12):1869-1875 — [doi:10.1097/00005768-199912000-00027](https://doi.org/10.1097/00005768-199912000-00027)

#### 5.2 Wilks 2020 ("Wilks2")
- `coef = 600 / (a + b·x + c·x² + d·x³ + e·x⁴ + f·x⁵)`. Note the numerator is **600**, not 500.
  - **Men:** a = 47.4617885411949, b = 8.47206137941125, c = 0.073694103462609, d = −0.00139583381094385, e = 0.00000707665973070743, f = −0.0000000120804336482315
  - **Women:** a = −125.425539779509, b = 13.7121941940668, c = −0.0330725063103405, d = −0.0010504000506583, e = 0.00000938773881462799, f = −0.000000023334613884954
  - Clamps: men **[40, 200.95] kg**, women **[40, 150.95] kg**.
  - Unit tests match the official coefficient tables to 4 decimals. Men: 40 kg → 1.3895; 60 → 0.9968; 80 → 0.8191; 100 → 0.7294; 120 → 0.6817; 140 → 0.6546; 200 → 0.6123. Women: 40 → 1.8486; 60 → 1.3190; 80 → 1.1318; 100 → 1.0525; 150 → 0.9635.
  - Source: [OpenPowerlifting wilks2020.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/wilks2020.rs)
- Secondary (non-peer-reviewed) claim: Robert Wilks released this update in 2020, and it is used mainly by Powerlifting Australia ([Lift Vault](https://liftvault.com/resources/powerlifting-calculator/)). Not verified with an official federation document.

#### 5.3 DOTS
- `coef = 500 / (A·x⁴ + B·x³ + C·x² + D·x + E)`
  - **Men:** A = −0.0000010930, B = 0.0007391293, C = −0.1918759221, D = 24.0900756, E = −307.75076
  - **Women:** A = −0.0000010706, B = 0.0005158568, C = −0.1126655495, D = 13.6175032, E = −57.96288
  - Clamps: men **[40, 210] kg**, women **[40, 150] kg**.
  - Source: [OpenPowerlifting dots.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/dots.rs)
- Origin: third-party pages credit Tim Konertz (German federation BVDK) in ~2019. One page gives a different author name, and pages conflict on which federations adopted it and when ([Lift Vault](https://liftvault.com/resources/powerlifting-calculator/); [FitnessVolt](https://fitnessvolt.com/rpe-training/compare/wilks-vs-dots/)). **No peer-reviewed or official derivation document was found.**

#### 5.4 IPF Points (the "IPF Formula", used 1 Jan 2019 until replaced by GL in 2020)
- Official formula from the IPF announcement document: `Total = 0 → 0`; otherwise `IPFPoints = 500 + 100 × (Total − (C1·ln(BW) − C2)) / (C3·ln(BW) − C4)`.
  - Authored by Joe Marksteiner and reviewed by Prof. C. Maiwald (TU Chemnitz) and Dr T. Mayer (TecStat).
  - Based on "a data set of 20.000 individual best performances across several years".
  - It replaced Wilks "as of 01/01/2019", and the document says the coefficients can be updated regularly.
  - Source: "The IPF Formula" (IPF announcement, PDF created 2019-01-04, hosted by British Powerlifting) — [britishpowerlifting.org ipf_formula.pdf](https://www.britishpowerlifting.org/wp-content/uploads/2025/03/ipf_formula.pdf)
- Coefficients (C1, C2, C3, C4), identical in the IPF document and OpenPowerlifting:

| Category | C1 | C2 | C3 | C4 |
|---|---|---|---|---|
| Men Classic 3-lift | 310.67 | 857.785 | 53.216 | 147.0835 |
| Men Classic Bench | 86.4745 | 259.155 | 17.57845 | 53.122 |
| Men Equipped 3-lift | 387.265 | 1121.28 | 80.6324 | 222.4896 |
| Men Equipped Bench | 133.94 | 441.465 | 35.3938 | 113.0057 |
| Women Classic 3-lift | 125.1435 | 228.03 | 34.5246 | 86.8301 |
| Women Classic Bench | 25.0485 | 43.848 | 6.7172 | 13.952 |
| Women Equipped 3-lift | 176.58 | 373.315 | 48.4534 | 110.0103 |
| Women Equipped Bench | 49.106 | 124.209 | 23.199 | **67.4926** |

- **Discrepancy:** OpenPowerlifting uses **67.492** for Women Equipped Bench C4, while the IPF document says **67.4926**. Use 67.4926 to match the official document. [OPL ipf.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/ipf.rs) vs the [IPF document](https://www.britishpowerlifting.org/wp-content/uploads/2025/03/ipf_formula.pdf)
- OpenPowerlifting also carries **single-lift squat and deadlift constants**, which are not in the IPF document I saw:
  - Squat: M Raw (123.1000, 363.0850, 25.1667, 75.4311); M Single (150.4850, 446.4450, 36.5155, 103.7061); F Raw (50.4790, 105.6320, 19.1846, 56.2215); F Single (74.6855, 171.5850, 21.9475, 52.2948)
  - Deadlift: M Raw (103.5355, 244.7650, 15.3714, 31.5022); M Single (110.1350, 263.6600, 14.9960, 23.0110); F Raw (47.1360, 67.3490, 9.1555, 13.6700); F Single (51.0020, 69.8265, 8.5802, 5.7258)
  - OPL returns 0 for bodyweight < 40 kg and floors points at 0. Unit tests: M classic 93 kg / 777.5 → **741.32**; F classic 73 kg / 337.5 → **546.67**.
  - Source: [OPL ipf.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/ipf.rs)
- In OpenPowerlifting data downloaded 21 June 2019 (26,472 open lifters), Wilks equalised **53/98** weight-class comparisons and the IPF Formula **51/98**. IPF was better for women and Wilks for men. "Results could not validate the IPF's decision to replace the Wilks by the IPF Formula." Ferland PM, Allard MO, Comtois AS. *Int J Exerc Sci* 2020;13(4):567-582 — [doi:10.70252/XGHM8852](https://doi.org/10.70252/XGHM8852) (PMC7523908)

#### 5.5 IPF GL ("Goodlift") Points (IPF official formula from 2020)
- `GL = Total × 100 / (A − B·e^(−C·BW))`. OPL implements it as `Total × max(0, 100/(A − B·e^(−C·BW)))`, returning 0 for BW < 35 kg.
- Coefficients (A, B, C):

| Category | A | B | C |
|---|---|---|---|
| Men Classic 3-lift | 1199.72839 | 1025.18162 | 0.009210 |
| Men Equipped 3-lift | 1236.25115 | 1449.21864 | 0.01644 |
| Women Classic 3-lift | 610.32796 | 1045.59282 | 0.03048 |
| Women Equipped 3-lift | 758.63878 | 949.31382 | 0.02435 |
| Men Classic Bench | 320.98041 | 281.40258 | 0.01008 |
| Men Equipped Bench | 381.22073 | 733.79378 | 0.02398 |
| Women Classic Bench | 142.40398 | 442.52671 | 0.04724 |
| Women Equipped Bench | 221.82209 | 357.00377 | 0.02937 |

- OPL maps wraps → classic/raw and multi-ply → single-ply. It has **no squat-only or deadlift-only GL coefficients**. Published examples: M equipped 3-lift 92.04 kg / 1035 → **112.85**; F classic bench 70.50 kg / 122.5 → **96.78**. Source: [OPL goodlift.rs](https://gitlab.com/openpowerlifting/opl-data/-/blob/main/crates/coefficients/src/goodlift.rs)
- Men's classic coefficients were independently confirmed by calculator sites ([vCalc](https://www.vcalc.com/wiki/ipf-gl-formula-points-calculator)). Sources disagree on the exact 2020 adoption date. The IPF hosts related documents (e.g. [IPF Points Proposal](https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_Points_Proposal.pdf)), but I could not open the official GL "Models_Evaluation-I-2020" document.

#### 5.6 Allometric scaling and known biases
- Jaric 2002 recommends **S_norm = S / m^b** with **b = 0.67** for muscle force (dynamometer) and b = 1 for torque. *Sports Med* 2002;32(10):615-631 — [doi:10.2165/00007256-200232100-00002](https://doi.org/10.2165/00007256-200232100-00002)
- Cleather 2006 used IPF World Championships 1995–2004 data and 7 models. The best fit was **y = a − b·x^(−c)** (y = kg lifted, x = body mass), with no body-mass residual bias. Allometric fits favoured intermediate weight classes. *J Strength Cond Res* 2006;20(2):412-421 — [doi:10.1519/R-17545.1](https://doi.org/10.1519/R-17545.1). The constants are in the full text, not retrieved.
- Montenegro et al. 2026 analysed drug-tested lifters (N = 457,471) with stratified log-log regression. The empirical exponent was **b = 0.55 (men) and 0.50 (women)** for the general population, **decaying to 0.47 (elite men) and 0.41 (elite women)** for the all-time Top 20 per class. The simple allometric model was statistically equivalent to IPF GL in mass-independence for elite males (Williams' t = −0.72, p = 0.47). The authors argue polynomial systems overfit. Montenegro S, Wicker P, Donath L. *Front Physiol* 2026;17:1847605 — [doi:10.3389/fphys.2026.1847605](https://doi.org/10.3389/fphys.2026.1847605)

#### 5.7 Example outputs (computed with the verified code, for cross-checking)

| Lifter | Wilks | Wilks2020 | DOTS | GL (classic 3-lift) | Total / BW^0.67 |
|---|---|---|---|---|---|
| M, 83 kg, total 700 | 467.25 | 561.15 | 472.56 | 96.90 | 36.25 |
| M, 100 kg, total 800 | 486.87 | 583.49 | 492.41 | 101.06 | 36.57 |
| F, 63 kg, total 400 | 429.58 | 511.45 | 430.21 | 87.51 | 24.92 |
| F, 76 kg, total 450 | 424.29 | 520.63 | 435.25 | 88.72 | 24.72 |

These were computed in this session from the coefficients above. The implementation reproduces all OpenPowerlifting unit-test values exactly (Wilks 608.58907/557.4434; IPF 741.32/546.67; GL 112.85/96.78; Wilks2020 coefficients 0.7294/1.3190).

### Inferences
- **Implementation checklist:**
  - Use kg internally.
  - Pick the coefficient set by sex × equipment (classic/raw vs equipped) × event (3-lift total vs bench-only).
  - Apply the bodyweight clamps (an OPL implementation choice; document it).
  - Floor IPF and GL at 0.
  - Present GL as "IPF GL Points (official IPF 2020+)", DOTS as the common non-IPF meet standard, and Wilks/Wilks2020 as legacy or alternative.
  - Ship the unit-test vectors above as automated tests.
- For **single lifts** (squat or deadlift alone) in training logs, Wilks/DOTS coefficients can be applied to any lift. GL has only total and bench coefficients. Label single-lift Wilks/DOTS as "informal".
- For **within-user progress tracking**, the score adds little beyond e1RM per kg of bodyweight. Its value is in cross-bodyweight comparison and meet-day estimates. Offer a simple allometric index (`kg / BW^0.67`, or the sex-specific empirical 0.55/0.50 from Montenegro 2026) as a transparent alternative.
- **IPF Points interpretation:** the OPL variable naming (mean1, mean2, dev1, dev2) shows the formula as `500 + 100 × z`, where z is the lifter's distance in standard deviations from the modelled mean performance at that bodyweight. This is my reading of the code structure.

### Gaps
- The official IPF GL technical document ("Models_Evaluation-I-2020") could not be opened, so the exact adoption date and derivation dataset are unverified.
- There is no official or peer-reviewed DOTS derivation document.
- I found no peer-reviewed evaluation of DOTS or Wilks2020 bias across bodyweight.
- The origin of OPL's single-lift IPF squat and deadlift constants is unverified.

---

## 6. Strength standards and level classification

### Takeaway
The best peer-reviewed normative data for trained lifters is **van den Hoek et al. 2024**: 809,986 drug-tested, unequipped powerlifting entries, giving **10th–90th percentile relative-strength norms** by sex, age group and weight class. The Latella et al. papers add first-meet relative totals and progression rates. Popular web standards (ExRx/Kilgore, StrengthLevel, Symmetric Strength) are **not peer-reviewed**. Their level labels are not interchangeable, and the app should label them as such.

### Cited Findings
- **van den Hoek et al. 2024:** 809,986 entries (571,650 male and 238,336 female) from global drug-tested, unequipped competitions. Relative strength (kg lifted ÷ bodyweight) is given at the 10th–90th percentiles by sex, UN age class and weight class.
  - Young adults (18–35 y), **90th percentile**: squat **2.83× BW (M) / 2.26× (F)**; bench **1.95× / 1.35×**; deadlift **3.25× / 2.66×**.
  - Over-80s, 90th percentile: squat 1.72/1.01, bench 1.31/0.92, deadlift 2.30/1.68.
  - The free online tool is at thestrengthinitiative.com.
  - van den Hoek DJ et al. *J Sci Med Sport* 2024;27(10):734-742 — [doi:10.1016/j.jsams.2024.07.005](https://doi.org/10.1016/j.jsams.2024.07.005)
- **Latella et al. 2020:** 1,897 Powerlifting Australia athletes, 2003–2018. **First-competition total** was 513.3 ± 99.8 kg (M) vs 289.4 ± 55.7 kg (F). **Relative total** was **5.89 ± 1.04 (M) and 4.27 ± 0.85 (F) kg/kg BW**. Strength gain per day was similar by sex (M 0.15 ± 0.44, F 0.12 ± 0.69 kg/d). The strongest-quartile men improved more slowly (0.102 vs 0.211 kg/d), consistent with a ceiling effect. *J Strength Cond Res* 2020;34(9):2412-2418 — [doi:10.1519/JSC.0000000000003657](https://doi.org/10.1519/JSC.0000000000003657)
- **Latella, van den Hoek & Teo 2019:** 2,137 competitors at local, national and international meets. There was a moderate-to-large increase from local to national level (d = 0.76 men, 1.09 women) and no meaningful difference from national to international by weight class. The coefficient of variation of totals within categories was **17.4–22.9%**. *J Strength Cond Res* 2019;33(Suppl 1):S103-S112 — [doi:10.1519/JSC.0000000000002823](https://doi.org/10.1519/JSC.0000000000002823)
- **Ball & Weidman 2018:** 47,913 USAPL results (2012–2016). Except for the lightest men's class, the ratio of weight lifted to bodyweight **decreases as bodyweight increases**, and men lift a higher ratio than women. Peak performance age is ~24–49. *J Strength Cond Res* 2018;32(7):1843-1851 — [doi:10.1519/JSC.0000000000002103](https://doi.org/10.1519/JSC.0000000000002103)
- **Ferland et al. 2020** published per-weight-class performance tables (kg, ratio, Wilks, IPF points) for 26,472 open lifters from OpenPowerlifting (June 2019). *Int J Exerc Sci* 2020;13(4):567-582 — [doi:10.70252/XGHM8852](https://doi.org/10.70252/XGHM8852)
- **Santos Junior et al. 2021** proposed a multi-parameter "Classification and Determination Model of Resistance Training Status". Levels are set by the mean score across parameters, which include strength relative to body mass. *Strength Cond J* 2021;43(5):77-86 ([ResearchGate copy](https://www.researchgate.net/profile/Evaldo-Junior-3/publication/349287497_Classification_and_Determination_Model_of_Resistance_Training_Status/links/6029329b299bf1cc26c4894e/Classification-and-Determination-Model-of-Resistance-Training-Status.pdf)). A snippet mentions benchmarks such as bench press at 120% of body mass and squat at 150% of body mass, but **I could not confirm whether these are the model's own cut-offs**.
- **Non-peer-reviewed standards (label as such in the app):**
  - **ExRx (Lon Kilgore tables):** five adult levels for the barbell lifts. Described as based on ~70 years of accumulated performance data, "not predicted or regression derived". Methodology not peer-reviewed. [exrx.net Strength Standards](https://exrx.net/Testing/WeightLifting/StrengthStandards.htm)
  - **StrengthLevel:** started from the Kilgore/ExRx standards, then from 2015 moved to regression on user-submitted (unjudged) lifts. Level = percentile: Beginner > 5%, Novice > 20%, Intermediate > 50%, Advanced > 80%, Elite > 95% of its users. Age-adjusted, with 25–40 as the baseline. [StrengthLevel about page (PT mirror)](https://strengthlevel.pt/sobre)
  - **Symmetric Strength:** I found **no primary methodology page**. Secondary descriptions mention meet data and user-entered gym lifts ([FitnessVolt methodology page](https://fitnessvolt.com/strength-standards/methodology)).

### Inferences
- **Recommended in-app classification:** show the user's **percentile against the van den Hoek 2024 norms** for their sex, age class and weight class, per lift and for the total. This is peer-reviewed, large and drug-tested. Its population is **competitive powerlifters**, so for general gym-goers the same number reads as "relative to competitive drug-tested lifters". Bodybuilders' 1RMs may sit lower at equal muscularity.
- Optional label mapping, as an app convention rather than a published standard: < 10th percentile of competitive powerlifters = "developing"; 10th–50th = "competitive"; 50th–90th = "advanced"; > 90th = "elite". Keep StrengthLevel-style "Beginner…Elite" labels only if attributed to their source.
- Combine with a **scoring formula** (GL or DOTS) for cross-bodyweight comparisons. Use **Latella 2020** first-meet relative totals (M ≈ 5.9×, F ≈ 4.3× BW) as a "typical first-meet" benchmark.
- Progress expectations: competitive lifters gain ~0.1–0.2 kg total per day on average early in their careers, with slower gains for the strongest. Use this only as context, not as a target.

### Gaps
- The van den Hoek 2024 full percentile tables (10th–90th by weight class) were not extracted. The developers should pull them from the paper or thestrengthinitiative.com, and check licensing.
- The Santos Junior 2021 exact cut-offs are unverified.
- I found no peer-reviewed normative strength data for **bodybuilders** or general recreational lifters by training level. Older Cooper Institute/NSCA bench and leg-press norms were not retrieved.

---

## 7. Injury epidemiology in powerlifting, bodybuilding and weightlifting, and what an app can flag

### Takeaway
Injury **incidence** (time-loss) is low: powerlifting **1.0–4.4 per 1000 h**, weightlifting **2.4–3.3 per 1000 h**, bodybuilding **0.24–1 per 1000 h**. Pain that affects training is very common: **70% of sub-elite powerlifters were currently injured** by a pain/impairment definition, but only 16% of those stopped training entirely. The most common sites are the **lower back/lumbopelvic region, shoulder, hip/knee and elbow**. Risk-factor evidence is weak and mostly cross-sectional. An app should offer **pain logging by body region and lift**, trend alerts, and **load-spike awareness**, without claiming to predict injuries.

### Cited Findings
- **Keogh & Winwood 2017** (systematic review, 20 studies across weight-training sports; only 5 had low risk of bias and only 4 were prospective):
  - **Bodybuilding** had the lowest rates: **0.12–0.7 injuries per lifter per year; 0.24–1 per 1000 h**. Strongman was 4.5–6.1 and Highland Games 7.5 per 1000 h.
  - Most common sites: **shoulder, lower back, knee, elbow, wrist/hand**. Most common types: **strains, tendinitis, sprains**.
  - "Very few significant differences" were found by age, sex, competitive standard or bodyweight class.
  - Keogh JWL, Winwood PW. *Sports Med* 2017;47(3):479-501 — [doi:10.1007/s40279-016-0575-0](https://doi.org/10.1007/s40279-016-0575-0)
- **Aasa et al. 2017** (systematic review of 9 studies, mostly low quality): incidence was **2.4–3.3 per 1000 h of training in weightlifting** and **1.0–4.4 per 1000 h in powerlifting**. The spine, shoulder and knee were most common. "Only one retrospective study had analysed possible risk factors." Aasa U, Svartholm I, Andersson F, Berglund L. *Br J Sports Med* 2017;51(4):211-219 — [doi:10.1136/bjsports-2016-096037](https://doi.org/10.1136/bjsports-2016-096037)
- **Tung et al. 2024** (updated systematic review, 17 reports: 12 weightlifting, 7 powerlifting; search to Feb 2024):
  - Powerlifting: **point prevalence 70%** (one report), incidence **1.0–4.4 per 1000 h**, most common sites **lower back/pelvis, shoulder, elbow/upper arm**.
  - Weightlifting: competition period prevalence 10.7–68%; sites knee, lower back, shoulder, hands/fingers.
  - **Pelvic floor dysfunction (e.g. urinary incontinence): 50% of females vs 9.3% of males.**
  - "In powerlifting, injury incidence was low, but injury prevalence was high when defining injury as a painful condition that impairs training/competition."
  - Tung MJ, Lantz GA, Lopes AD, Berglund L. *BMJ Open Sport Exerc Med* 2024;10(4):e001884 — [doi:10.1136/bmjsem-2023-001884](https://doi.org/10.1136/bmjsem-2023-001884)
- **Strömbäck et al. 2018** (cross-sectional; 53 female and 51 male Swedish sub-elite classic powerlifters):
  - **70% (73/104) currently injured; 87% (83/95) injured in the past 12 months**, with injury defined as pain or impairment affecting training. Only **16% of the currently injured stopped training completely**.
  - Most common sites for both sexes: **lumbopelvic region, shoulder, hip**. Women had more neck and thoracic injuries.
  - Factors associated with current injury: **training frequency, greater deadlift PB, injury onset during bench and deadlift training, use of straps, alcohol consumption, dietary issues**.
  - Strömbäck E, Aasa U, Gilenstam K, Berglund L. *Orthop J Sports Med* 2018;6(5):2325967118771016 — [doi:10.1177/2325967118771016](https://doi.org/10.1177/2325967118771016)
- **Siewe et al. 2011** (powerlifting; questionnaire, n = 245 competitive and elite):
  - **43.3% reported problems during routine workouts.** Injury rate was **0.3 injuries per lifter per year, ~1 per 1000 h**. Most common sites: shoulder, lower back, knee.
  - **Weight-belt use was associated with more lumbar injuries** (cross-sectional, confounding likely). Upper-extremity injury was higher at **age > 40** (shoulder p = 0.003, elbow p = 0.003, hand/wrist p = 0.024) and hand/wrist injury higher in **females** (p = 0.045).
  - Siewe J et al. *Int J Sports Med* 2011;32(9):703-711 — [doi:10.1055/s-0031-1277207](https://doi.org/10.1055/s-0031-1277207)
- **Siewe et al. 2014** (bodybuilding; n = 71 competitive and elite): **45.1% reported symptoms while training**. Injury rate **0.12 per bodybuilder per year (0.24 per 1000 h)**. **Age > 40 had higher injury rates** (p = 0.029). Sites: **shoulder, elbow, lumbar spine, knee**. Siewe J et al. *Int J Sports Med* 2014;35(11):943-948 — [doi:10.1055/s-0034-1367049](https://doi.org/10.1055/s-0034-1367049)
- **Bengtsson et al. 2018** (narrative review): injuries in the squat, bench press and deadlift have been suggested to relate to "excessively heavy loads, the large range of motion…, **insufficient resting times between training sessions** and/or faulty lifting technique". These are hypotheses rather than established risk factors. Bengtsson V, Berglund L, Aasa U. *BMJ Open Sport Exerc Med* 2018;4(1):e000382 — [doi:10.1136/bmjsem-2018-000382](https://doi.org/10.1136/bmjsem-2018-000382)
- On load spikes in general, the evidence base is team-sport ACWR research, now strongly criticised (Section 1). Impellizzeri 2020 ([doi](https://doi.org/10.1123/ijspp.2019-0864)); Impellizzeri 2021 ([doi](https://doi.org/10.1007/s40279-020-01378-6)).

### Inferences
- **Pain logging, the highest-value feature.** Body-map regions: lumbopelvic, shoulder, hip, knee, elbow, wrist/hand, neck/thoracic. Use a 0–10 pain rating, tied to the **lift or session in which onset occurred**, plus whether training was modified, reduced or stopped. This mirrors the "pain or impairment that affects training" definition used by Strömbäck and Tung.
- **Gentle alerts (heuristic):**
  - The same region is rated ≥ 3/10 on ≥ 3 sessions in 14 days, or pain is rising across sessions → suggest exercise variation, load reduction and/or seeing a clinician.
  - Pain onset during a specific lift → tag that lift's sessions.
- **Load-spike awareness, not prediction.** Flag a **weekly per-lift or per-muscle volume-load or hard-set increase above roughly 20–30% over the 4-week average**, or a sudden jump in frequency, as "bigger jump than usual". **Do not label it an injury-risk score**: there is no validated threshold in strength sports, and ACWR has been heavily criticised. Training frequency is cross-sectionally associated with current injury (Strömbäck 2018), but causality is unknown.
- **Contextual flags:**
  - Age > 40 → a hint about upper-extremity overuse (Siewe 2011, 2014).
  - Female lifters → optional pelvic-floor symptom item (50% prevalence; Tung 2024), with educational content.
  - Strap and belt associations are cross-sectional and confounded (heavier lifters use them more). Do not discourage their use on this evidence.
- Messaging tone: injury incidence in these sports is **low relative to team and contact sports**, while nagging pain is **common**. The app should normalise logging and early modification rather than alarm users.

### Gaps
- **No prospective cohort** in powerlifting or bodybuilding linking logged training load (volume spikes, proximity to failure, frequency) to injury was found. Risk factors are almost entirely cross-sectional or retrospective.
- I found no evidence that **training to failure** increases injury risk in these populations. That claim would be speculative.
- Bodybuilding injury data are sparse and old (Siewe 2014, n = 71). Recent bodybuilding studies found in the search were case reports or narrow (e.g. hip pain in Brazilian bodybuilders, [Fagotti 2021](https://doi.org/10.1590/1413-785220212903242430)) and were not reviewed in detail.
