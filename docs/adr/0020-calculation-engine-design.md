# ADR-0020: Calculation engine design: pure functional core with injected rules and explanation traces

- Status: Accepted (v0.4, 2026-11-24: engine as built in M1; curve class of the competition squat and deadlift, see below; amended v0.5, v0.7)
- Date: 2026-11-23, amended 2026-11-24
- Related: technical concept §8.7, §8.6; PRD PRG-01…18, PRG-09, PLN-01, NFR-MNT-01/02, NFR-REL-03, TC-05, TC-15, §7.8; EB Conclusion

## Context

The evidence base frames the engine as per-user personalization on top of research priors: meta-analytic values seed the defaults, and each user's logs update them (smoothed e1RM, personal load–rep curves, RIR bias, bodyweight trend). The PRD requires determinism (same inputs and versions → same plan), reference-value tests, recomputable derived data, "Why?" explanations for 100% of suggestion types, parameter versions recorded with outputs, and generation within 1 s on the S22.

## Options considered

| Criterion (weight) | Pure TS functions, injected `ResolvedRuleSet`, `Explained<T>` results | Generic rules-engine library (e.g. JSON rule evaluation) | Classes with injected configuration singletons |
|---|---|---|---|
| Determinism and testability (3) | 5 | 3 | 3 |
| Explainability (3) | 5 | 3 | 2 |
| Performance (2) | 5 | 3 | 3 |
| Fit with numeric algorithms (Kalman filter, curve fit, knapsack) (2) | 4 | 3 | 4 |
| Solo productivity (2) | 4 | 2 | 3 |
| **Total (max 60)** | **56** | 34 | 35 |

## Decision

- All calculations are pure functions in `@powr/domain` without I/O, time or randomness (lint-enforced). Inputs include the `ResolvedRuleSet` slice, the content catalog and history; outputs that the UI presents are `Explained<T>` with rule ID, message ID, arguments, facts and parameter references (with evidence and provenance).
- Per-user calibration state (trend filters, correction factors, personal curves, calibration status, later RIR bias) is **derived** from raw logs and stored in rebuildable tables stamped with engine, rules and content versions.
- Heavy work (plan generation, forward recompute, full rebuild, "Verify data") runs in a dedicated Web Worker with a small typed RPC layer.
- Evidence item E-1 is resolved as specified in technical concept §8.7.7 (unknown-effort sets: no e1RM PRs; trend inclusion with a personal or default prior and widened noise).

## Consequences

- Positive: reference suites, property tests and determinism checks are straightforward; explanations come from the same code that computes values.
- Positive: changing a parameter never requires code changes; changing an algorithm bumps the engine version and triggers derived rebuilds.
- Negative: explanation plumbing adds code to every suggestion path; enforced by the closed `RuleId` union and a catalog coverage test.

## Amendment (v0.4, 2026-11-24)

The decision stands. M1 built the engine as described in technical concept §8.7.9:

- **Modules and entries:** `@powr/domain` subpath exports `explain`, `loading`, `e1rm`, `trend`, `progression`, `warmup`, `volume`, `rest`, `scoring`, `bodyweight` and `rules` (parameter types); `units` and `time` are in the root. Every suggestion and derived value is an `Explained<T>` with rule ID, `why.<rule>` message ID, arguments, facts and the registry parameters used. Functions take the rule slice they read (`RuleSlice<…>`), not the whole set.
- **E-1 as implemented:** unknown effort takes the user's median entered RIR over the last 8 weeks at a rep count within ±3, else the default 2; the set weight is halved and the trend noise widened by about 4.5% in quadrature; no e1RM PRs from such sets.
- **Trend:** local-level Kalman filter on ln e1RM; the change interval uses Var(Δ) = P_now + P_ref (conservative).
- **Scoring** implemented from the official formulas (IPF Points, IPF GL, published Wilks, Wilks2020 and DOTS coefficients); no OpenPowerlifting code; OPL and EB values are test vectors only.
- **Versions:** `RULES_VERSION` is `1.0.0`; the app still stamps it unhashed and moves to the resolved `1.0.0+<hash12>` in M2 (TD-31).
- **Decision (product owner, 2026-11-24): load–rep curve of the competition lifts.** Curve classes map to curves through the registry row `load.curve.classMap` (`benchLike` → the user's equation, Wathan by default or the RTS chart; `legPressLike` and `pooled` → inverted Nuzzo tables). The competition squat and deadlift and their close variants (back squat, paused back squat, deadlift, sumo deadlift, deficit deadlift) use `curveClass: benchLike`, not the Nuzzo pooled curve, until the personal curve fit exists. Reason: the pooled curve includes leg-press data and suggested about 5–6% more load than the RTS chart for 5 @ RPE 8, and no squat- or deadlift-specific reps-vs-%1RM data exist. This is a content data change. Because `benchLike` now covers more than bench-like lifts, renaming the class (e.g. to `equation`) is proposed as a future contract change (TD-30).
- **Not built yet:** personal curve fit and per-exercise correction (TD-26), PR detection and the calibration state machine (TD-27), English `why.*` messages (TD-28), mapping equipment presets to `Implement` (TD-29).

Source: `IMPLEMENTATION_NOTES.md` (repository root): §3 rows marked "Docs amended in v0.4" and the sections "M1-B content" and "M1-A engine and rules".

## Amendment (v0.5, 2026-11-24)

The decision stands, with one deviation and two product-owner decisions (technical concept §8.7.10):

- **Deviation:** plan generation and validation run in the lazy `@powr/application/planning` chunk on the main thread until the engine worker exists (a few milliseconds per plan; TD-32).
- **Decision: time-budget prioritisation.** When the session budget cannot fit every weekly target, the user's priority muscles (else the template's emphasis) keep their full target and the others fall back towards the minimum dose of 4 weekly sets (`volume.hypertrophy.minimumDose`, Iversen 2021); the plan states the reason and suggests more minutes or another day. The fallback rule is a POWR design value (`planning.timeBudget.fallback`, `verified: false`).
- **Decision: curve class `equation`.** `benchLike` is renamed `equation` ("the user's e1RM equation, Wathan/RTS") in the domain, the registry and the content (TD-30); rules 1.2.0, content 0.2.0.
- **Explanations:** every `RuleId` has an English message, and a coverage test keeps it so (TD-28).

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M2a planning core" and "M2b screens".

## Amendment (v0.7, 2026-11-24)

The decision stands. M3a added the session engine as the domain subpath `@powr/domain/session` (technical concept §8.7.5, §8.7.7, §8.7.11): set suggestions with "Why?" in a fixed order (fixed values, in-session autoregulation, the progression model from the history, calibration, load for target, deload and return-from-break percentages), every load through the rounding service; the calibration state machine; PR detection; readiness and its proposals; return from break per lift; guardrails. Rules 1.4.0 (133 parameters, 34 `verified: false`).

- **Deviation:** the derived-data rebuilds (finish, past edits, backdating, stale states) run as a per-exercise full rebuild on the main thread in the lazy session chunk, not in the engine worker, which does not exist yet (TD-32, extended).
- **Decisions (product owner, 2026-11-24), accepted as built:** no e1RM PR from a set without entered effort, while its load × reps can set rep, load and volume PRs (E-1); rep PRs as the n-rep max; `load.pr.minSetWeight` and `progression.calibration.reliableSetWeight` at 0.5 and the noon cut-off for a "PM session" (all `verified: false`); the deload load in the middle of 85–100%; the readiness proposal sizes; the WKT-03 plausibility limits (3× the e1RM, 100 reps) as code constants rather than registry rows.

Source: `IMPLEMENTATION_NOTES.md` (repository root), section "M3a session core".

## Amendment (v0.9, 2026-11-25)

The decision stands. As built in M5 (technical concept §8.7.5, §8.7.6):

- **Trend model (rules 1.7.0):** the observation noise is floored at the level's typical error (TD-59), advanced lifters use a 12-week reference (TD-60), the session engine keeps 60 trend points and 60 exposures, and a change label without a claim says why (`noise` or `unconfirmed`, TD-62), in the explanation and since M5z in the value (`ChangeLabel.reason`). `ENGINE_VERSION` 0.2.0, because outputs changed for the same inputs.
- **Standard-variant tie-break (product-owner decision of 2026-11-25):** among candidates with equal MAP-03 scores the standard variant of a movement wins (`ranking.standard`, an explicit content field on 86 exercises), then the ID. It is a tie-break only, never part of a score, so the effectiveness explanation is unchanged; it applies to the slot ranking (generator, next block, substitutes, session alternatives) and the body map's muscle ranking. The plan-matrix snapshot gained the exercise picks, so a changed pick shows in review.

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M5p content and engine follow-ups" and "M5z bundle trim, fixes and docs".
