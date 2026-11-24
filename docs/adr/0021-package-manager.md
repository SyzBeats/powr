# ADR-0021: Package manager: pnpm 12

- Status: Accepted (resolved 2026-11-24: A, OQ-T8; confirmed by the product owner; v0.3, 2026-11-24: `minimumReleaseAgeExclude`; v0.5, 2026-11-24: `overrides` for never-loaded build-only packages, see below)
- Date: 2026-11-23
- Related: technical concept §5.2, §8.18, §8.21; ADR-0001, ADR-0018

## Context

The monorepo relies on strict dependency isolation (a package can only import what it declares) to enforce layer boundaries, and on licence listing for the inventory. Supply-chain hygiene matters because there is no telemetry and the app is public. Facts checked 2026-11-23: pnpm 12.23.0 (MIT); the developer machine already has pnpm installed.

## Options considered

| Criterion (weight) | pnpm 12 | npm workspaces | Bun |
|---|---|---|---|
| Workspace support (3) | 5 | 4 | 4 |
| Strict isolation, no phantom dependencies (3) | 5 | 2 | 3 |
| Licence listing (`pnpm licenses`) (1) | 4 | 2 | 2 |
| Speed and disk use (1) | 5 | 3 | 5 |
| Maturity for this stack (2) | 5 | 5 | 3 |
| **Total (max 50)** | **49** | 33 | 34 |

## Decision

Use **pnpm 12** with `packageManager` pinned in the root `package.json`, a committed lockfile, `--frozen-lockfile` in CI, dependency build scripts allowed only for allowlisted packages (`allowBuilds` in `pnpm-workspace.yaml`, which replaced `onlyBuiltDependencies` in pnpm 11), and `minimumReleaseAge: 10080` (7 days, in minutes; pnpm's default is 1 day) to avoid freshly published compromised versions.

## Consequences

- Positive: enforced package boundaries; fast installs; built-in licence listing; supply-chain controls.
- Negative: contributors need pnpm (Corepack or a global install); irrelevant for a solo developer.
- Runner-up: **Bun** (package manager only), if install speed ever matters more than maturity.

## Amendment (v0.3, 2026-11-24)

`minimumReleaseAge: 10080` is kept. Several exact versions pinned by the technical concept were younger than 7 days when M0 was set up, and pnpm refuses immature versions. `pnpm-workspace.yaml` therefore has a **`minimumReleaseAgeExclude`** list:

- the exact versions `oxlint@1.95.0`, `oxfmt@0.80.0`, `oxlint-tsgolint@7.0.2008`, `knip@6.48.0`, `lucide-react@1.78.0`, `vitest@5.1.1`, `fast-check@4.11.0`, and `pnpm` itself (12.23.0);
- their platform binary and companion packages by name (`@pnpm/exe.*`, `@oxlint/*`, `@oxfmt/*`, `@oxlint-tsgolint/*`, `@vitest/*`), because name patterns cannot carry versions.

**Remove the excludes after 2026-12-01**, when every listed version is older than 7 days (TD-18; also an open item in `IMPLEMENTATION_NOTES.md` §4). Where an older version was acceptable, it was installed instead: `tailwind-merge` 3.7.0 (3.7.1 was 5 days old) and `@babel/core` 8.1.2 (8.1.3 was too new).

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.

## Amendment (v0.5, 2026-11-24)

The decision stands. v0.5 folds in the M2 tooling (TD-09 native Lingui macro, TD-10 native React Compiler lint rules, TD-12 Lighthouse CI and Trusted Types in dev/E2E) and the Sentry package block list. For this ADR:

- **pnpm `overrides` in `pnpm-workspace.yaml`.** Lighthouse CI (build-only) pulls two transitive packages that the licence gate rejects and that our use never loads. Two overrides remove them from the install, with a comment in the file:
  - `'lighthouse>@sentry/node': '-'` keeps out Lighthouse's optional error reporting and with it the `sentry` CLI (`FSL-1.1-Apache-2.0`). Lighthouse imports `@sentry/node` only with `--enable-error-reporting`.
  - `'js-yaml@5>argparse': '-'` keeps out `argparse` (`PSF-2.0`), which js-yaml uses only in its own command-line binary.
- **Product-owner decisions (2026-11-24).** There must be no Sentry package anywhere. The licence gate's block list `deniedPackages` enforces this beyond this override (ADR-0018). `argparse` is excluded rather than `PSF-2.0` being allowed.

Source: `IMPLEMENTATION_NOTES.md` (repository root), section "M2 tooling (TD-09, TD-10, TD-12)", and the product-owner decision of 2026-11-24 on Sentry.
