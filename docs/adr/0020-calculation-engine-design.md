# ADR-0020: Calculation engine design: pure functional core with injected rules and explanation traces

- Status: Accepted
- Date: 2026-11-23
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
