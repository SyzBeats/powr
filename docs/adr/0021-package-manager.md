# ADR-0021: Package manager: pnpm 12

- Status: Accepted (resolved 2026-11-24: A, OQ-T8; confirmed by the product owner)
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
