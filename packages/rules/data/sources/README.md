# Source registry

Every study, document or convention that a rules parameter (`sources`) or a muscle credit
(`MuscleCredit.source`) cites is defined here once (technical concept §8.6.1, ADR-0012). Each
`*.yaml` file in this directory is a list of entries; the loader merges all files into one registry.
A directory instead of a single `sources.yaml` lets several authors add sources without editing the
same file (IMPLEMENTATION_NOTES.md, section 3).

## Files and owners

| File                    | Contents                                                                                                                                                                                                                                                                                                                  | Owner         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `excluded.yaml`         | Sources that nothing may cite: the retracted Barbalho volume trials and the Barbalho 2020 EJSS paper (EB §Gaps #23)                                                                                                                                                                                                       | Seeded, fixed |
| `exercise-mapping.yaml` | Every source of the EB exercise-to-muscle mapping section, plus `src.powr-eb-mapping` for convention (C) credits                                                                                                                                                                                                          | Seeded        |
| `<topic>.yaml`          | Sources of rules parameters, one file per topic: `load`, `volume`, `progression`, `deload`, `session`, `monitoring`, `scoring`, `bodyweight` (M1); `nutrition`, `ranking` later. `load.yaml` also holds POWR's own design documents (`src.powr-technical-concept`); each topic file holds its `src.powr-eb-<topic>` entry | Rules engine  |
| `content-<topic>.yaml`  | Further sources of content (exercise mappings, templates, education texts)                                                                                                                                                                                                                                                | Content       |

Before adding a source, search all files for it: an ID may be defined only once in the whole
directory, and a source that is already here (for example `src.pelland2026` or `src.kubo2019`) is
cited by its existing ID, not copied into another file. Only `*.yaml` files and this README belong
here.

## Entry format

```yaml
- id: src.kubo2019 # required, see the ID convention below
  citation: >- # required: authors year. title. journal volume(issue):pages. DOI
    Kubo, Ikebukuro & Yata 2019. Effects of squat training with different depths on lower limb
    muscle volumes. Eur J Appl Physiol. DOI 10.1007/s00421-019-04181-y.
  url: https://link.springer.com/doi/10.1007/s00421-019-04181-y # optional, http(s)
  seeAlso: [https://example.org/catalogue-record] # optional: further links to the same work
  tag: RCT-U # required: one EB evidence tag for the study design
  status: active # required: active | excluded
  reason: … # required for excluded entries, forbidden for active ones
  note: … # optional caveat, e.g. "verify before hard-coding (E-2)"
```

- **Citations and links** are copied from the evidence base (the report and its research notes)
  as completely as it gives them. Text in `[brackets]` describes a work whose title the EB does not
  give. Do not invent authors or titles; complete them when the source is verified.
- **`tag`** is one of `MA`, `SR`, `RCT-T`, `RCT-U`, `RCT`, `POS`, `OBS`, `DELPHI/SURVEY`, `NARR`,
  `PREPRINT`, `PRACT`, `OFFICIAL`, `MODEL`, `INF` (`EVIDENCE_TAGS` in `@powr/domain`), as the EB
  tags the study. The EB's `[EMG]` marks activation-only findings; it is a muscle-credit evidence
  code (`H | EMG | C`), not a registry tag, so acute EMG studies are tagged `OBS`.
- **`excluded`** sources stay in the registry so that a citation of them fails with the reason
  instead of "unknown source".

## Source ID convention

| Case                                                          | Form                                                                  | Examples                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Author and year known                                         | `src.<first author><year>`                                            | `src.kubo2019`, `src.defranca2015`, `src.androulakiskorakakis2021` |
| Same first author and year                                    | letter suffix: the EB's own, else in order of first mention in the EB | `src.remmert2023a`, `src.barbalho2020a`, `src.barbalho2020b`       |
| No author in the EB                                           | registry name + identifier                                            | `src.pmid24265879`, `src.nct07360236`, `src.researchsquare2882506` |
| POWR's own documents (the EB as the basis of convention rows) | `src.powr-<topic>`                                                    | `src.powr-eb-mapping`                                              |

- All lowercase ASCII; the surname without spaces, hyphens, apostrophes or diacritics
  (de França → `defranca`, Androulakis-Korakakis → `androulakiskorakakis`).
- A preprint and its published version are two entries (`src.pelland2024`, `src.pelland2026`),
  because their numbers can differ (E-2).
- IDs are stable: once cited, an ID is never renamed or reused.
- Format check: `isSourceId` in `@powr/domain` (`/^src\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/`).

## Validation

`@powr/rules/sources` (`buildSourceRegistry`, `checkSourceRefs`) checks the entries; the Node loader
`@powr/rules/sources/node` (`loadSourceRegistry`) reads this directory. `pnpm test` runs
`packages/rules/scripts/sources.test.ts`, which fails on a schema error, a duplicate ID, an excluded
entry without a reason, a YAML error or a stray file. Every consumer also checks its citations
with `checkSourceRefs`: each cited ID must exist and must not be excluded (technical concept
§8.6.5 check 2, §8.12).
