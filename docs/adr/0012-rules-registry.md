# ADR-0012: Rules registry: versioned YAML parameter tables with evidence metadata

- Status: Accepted
- Date: 2026-11-23
- Related: technical concept §8.6, §8.7, §8.12; PRD PRG-18, NFR-MNT-01, LEG-05, SET-03/07, §7.3, §7.8; EB "Consolidated default parameters" and Conclusion

## Context

The evidence base recommends that thresholds and defaults are **versioned configuration data with evidence tags and source IDs** (a rules registry), not hard-coded, with the engine acting as per-user personalization on top of research priors. The PRD requires that changing a default needs no code change (NFR-MNT-01), that every parameter carries an evidence tag, a source ID and a `verified` flag, that the version is recorded with every plan and suggestion (PRG-18), that preprint values ship with `verified = false`, that excluded sources (retracted Barbalho trials) inform no parameter, and that users can override defaults. The same pipeline pattern serves the content library.

## Options considered

| Criterion (weight) | YAML data + Zod schema, compiled to JSON | TypeScript constant tables (`as const satisfies`) | JSON files + JSON Schema |
|---|---|---|---|
| Data, not code (NFR-MNT-01) (3) | 5 | 2 | 5 |
| Type safety for the engine (2) | 4 | 5 | 3 |
| Reviewability of diffs (comments, multi-line) (2) | 5 | 4 | 3 |
| Ergonomics for evidence metadata (2) | 5 | 4 | 3 |
| Tooling simplicity (2) | 4 | 5 | 4 |
| **Total (max 55)** | **51** | 42 | 41 |

## Decision

- Parameters live in `packages/rules/data/*.yaml`; sources in `sources.yaml` (with `status: excluded` for retracted or untrusted sources).
- Each row: `id`, `value`, optional context `variants`, `range`, `guard`, `unit`, `evidence` tags, `sources`, `ebRef`, `verified`, optional `blockedUntilVerified`, `userOverridable`, `label`, `since`.
- A Zod schema per parameter ID gives types and ranges. The build validates, checks sources, compiles `rules.json` (SemVer + hash) and emits a diff report.
- The engine receives a `ResolvedRuleSet` as an argument. Resolution order: default → context variant → global user override → per-exercise user override. Every leaf carries provenance used in "Why?" explanations.
- `VersionStamp.rules` is stored with plans, suggestion snapshots and derived data.
- CI gates: schema, ID stability, no excluded sources, blocked rows unreachable, golden tests, plan-matrix snapshot, diff report in release notes.

## Consequences

- Positive: defaults change by editing data; every number is traceable to EB and its sources; unverified values are visible and labelled.
- Positive: user overrides are first-class and survive registry updates (with a "default changed" note).
- Negative: two places to look (schema in TS, values in YAML); mitigated by generated documentation ("How POWR decides" and a parameter reference page built from the registry).
- Negative: a registry change can alter generated plans; caught by the plan-matrix snapshot review.
