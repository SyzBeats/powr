# ADR-0012: Rules registry: versioned YAML parameter tables with evidence metadata

- Status: Accepted (v0.4, 2026-11-24: registry as built in M1, see below)
- Date: 2026-11-23, amended 2026-11-24
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

## Amendment (v0.4, 2026-11-24)

The decision stands. M1 built the registry with these details and deviations:

- **Tables:** 8 files (`load`, `volume`, `progression`, `deload`, `session`, `monitoring`, `scoring`, `bodyweight`) with **109 parameters**, **24** of them `verified: false` (preprint-derived values, values the EB flags as unverified, POWR design values with only a direction in the EB; a test fails if a preprint-citing row is verified). `bodyweight.yaml` holds the BOD-02 rows instead of `nutrition.yaml`.
- **Row format:** `unit` is required (closed list), `range` is checked with the parameter's own schema, `guard` is a JSON object of UI thresholds, `sources` needs at least one ID, optional `note`; `label` and `since` have defaults.
- **Per-parameter value schemas:** `src/params.ts`, one Zod schema per ID, tied with `satisfies` to the engine's `ParamValues` type; the set of IDs is closed in both directions.
- **Source registry directory:** `data/sources/*.yaml` (README, `excluded.yaml`, `exercise-mapping.yaml`, one file per topic; `content-*.yaml` for content) instead of one `sources.yaml`, merged into one registry with IDs unique across files, so parallel work does not collide. 93 sources (3 excluded Barbalho papers, 19 mapping, 71 topic). `SourceDef` gained `seeAlso` and `note`; `reason` only and always for excluded entries.
- **Source-ID convention:** `src.<first author><year>[a|b]`, the registry name plus identifier when the EB names no author (`src.pmid24265879`), `src.powr-<topic>` for POWR's own documents; checked by `isSourceId` in `@powr/domain`. EMG-only studies are tagged `OBS` (the EB's `[EMG]` marker is not an evidence tag). `src.powr-eb-mapping` (tag `INF`) is the sanctioned source of convention (C) muscle credits.
- **Where the loader lives:** pure validator in `@powr/rules/sources`; Node loader in `@powr/rules/sources/node` (`packages/rules/scripts/`), used by the rules build and by `tools/content-build`; the content runtime does not depend on `@powr/rules`.
- **Build:** `pnpm --filter @powr/rules build` writes `dist/rules.json` (SemVer `RULES_VERSION` = `1.0.0` plus a SHA-256 of the canonical JSON; stamp `1.0.0+<hash12>`), reports `verified: false` rows and, with `--diff`, the registry diff. `ids.lock.json` lists every published parameter ID. The same checks and the **golden tests** (engine reference values recomputed from the compiled registry) run under Vitest. The plan-matrix snapshot waits for the generator (M2).
- **Resolver:** `resolveRules` returns a flat record keyed by parameter ID (not a tree), typed as `RuleSet`; context dimensions `level`, `style`, `goal`, `sex`, `timeSaver` and the exercise's `competitionLift`, `restClass`, `pattern`, `mechanics`, `curveClass`. It is the entry `@powr/rules/resolve` and loads lazily in the app (the package root is Zod-free).
- **Deliberately not shipped:** velocity-based parameters (VBT), Lombardi, Lander and O'Conner, the Marzagao weight-dependent formula, ACWR zones, Banister constants, OPL's single-lift IPF constants, the RP landmark table.

Source: `IMPLEMENTATION_NOTES.md` (repository root): §3 rows marked "Docs amended in v0.4" and the sections "M1-B content" and "M1-A engine and rules".
