# ADR-0017: Lint and format: oxlint (type-aware) + oxfmt

- Status: Accepted (product-owner decision 2026-11-24; supersedes the v0.1 decision "ESLint 10 + typescript-eslint + Prettier"; v0.3, 2026-11-24: amended after M0, see below)
- Date: 2026-11-23, rewritten 2026-11-24
- Related: technical concept §5.2, §8.5, §8.14, §8.15, §8.21; ADR-0001 (boundaries), ADR-0002 (TypeScript 7.0), ADR-0016 (i18n); PRD NFR-MNT-04, NFR-A11Y-01

## Context

The user asked to "replace eslint with ocx". No maintained linter named "OCX" exists. The npm package `ocx` is an OpenCode extension manager, and web searches point to Oxc. The request is therefore read as **oxlint**, the linter of the Oxc project. In a second decision the user chose **oxfmt** instead of Prettier.

Linting must cover:

- architecture (layer boundaries, a pure domain), now enforced as described in ADR-0001;
- accessibility (JSX a11y);
- React hook rules and React Compiler compatibility;
- string externalization (Lingui);
- type-aware correctness.

Formatting must cover every file type in the repo: TS/TSX, JSON, YAML (rules registry, content, workflows), Markdown (docs, educational content), CSS (Tailwind v4 tokens) and HTML.

Facts checked 2026-11-24 (npm registry, oxc.rs):

- **oxlint 1.95.0** (MIT; published 2026-11-23); 873 rules listed.
  - Native rules include `no-restricted-imports` (with `patterns`: gitignore-style `group`, `regex`, `importNames`, `message`), `no-restricted-globals`, `import/no-cycle`, `react/exhaustive-deps`, `react/jsx-no-literals`, and the `jsx-a11y` plugin.
  - Config supports `overrides` with `files` globs, nested configs and a typed `oxlint.config.ts`.
  - There is no native `import/no-restricted-paths`.
- **Type-aware linting:** `oxlint --type-aware` with **oxlint-tsgolint 7.0.2008** (MIT; uses the Go implementation of TypeScript 7.0). 60 of the 62 typescript-eslint type-aware rules are supported; `--type-check` can also report TypeScript errors. A newer Rust backend, `tsrs` (Apache-2.0, 7.1.0-beta), was announced on 2026-11-17 and is not adopted yet.
- **JS plugins:** run ESLint-v9-compatible plugins (`jsPlugins`). They are **alpha and not subject to semver**; type-aware JS-plugin rules and custom parsers are not supported.
- **oxfmt 0.80.0** (MIT; published 2026-11-23); **beta** since 2026-02-24 ("Oxfmt Beta" blog).
  - Formats JS/TS/JSX/TSX, JSON/JSONC/JSON5, YAML, TOML, CSS/SCSS/Less, Markdown/MDX, HTML, GraphQL and more.
  - Prettier-compatible output is the baseline, with documented divergences; it is "compatible with Prettier v3.9.9 for many configurations".
  - `oxfmt --migrate=prettier`; Prettier plugins are not supported, but popular ones are implemented natively.
  - **Built-in Tailwind class sorting** (`sortTailwindcss`, based on `prettier-plugin-tailwindcss`, options `stylesheet`, `functions`, `attributes`; no regex), import sorting (`sortImports`) and `package.json` sorting (on by default).
  - Default `printWidth` is 100.
- **Editor:** the official Oxc extension `oxc.oxc-vscode` (VS Code Marketplace and Open VSX) runs `oxfmt --lsp` from the project and also hosts oxlint. Configure it with `"editor.defaultFormatter": "oxc.oxc-vscode"` and `"editor.formatOnSave": true`.

## Options considered

| Criterion (weight) | oxlint + oxfmt | ESLint 10 + typescript-eslint + Prettier 3 (v0.1) | Biome 2 |
|---|---|---|---|
| Rule coverage for this project: type-aware, a11y, hooks, layers, Lingui, React Compiler (3) | 4 (gaps: Lingui and React Compiler rules only via alpha JS plugins) | 5 | 3 |
| Speed (1) | 5 | 2 | 5 |
| Maintenance (2) | 5 | 5 | 5 |
| Solo productivity: one fast toolchain (2) | 5 | 4 | 5 |
| Plugin ecosystem maturity (2) | 3 | 5 | 3 |
| Formatter maturity and file-type coverage (2) | 4 (beta; covers all repo types; Tailwind sorting built in) | 5 | 4 |
| **Total (max 60)** | **51** | 55 | 48 |

The matrix still favours ESLint + Prettier on rule coverage and plugin maturity. The product owner chose the Oxc toolchain for its speed and simplicity. The gaps are small and mitigated as described below; they are recorded as risks T-16 and T-17 and technical debt TD-08.

## Decision

**Linting: oxlint** with `oxlint.config.ts` at the repository root.

- Categories `correctness` (error) and `suspicious` (warn), plus plugins `typescript`, `react`, `jsx-a11y`, `import`, `unicorn` (selected rules), `vitest` for tests.
- **Type-aware** rules via `oxlint --type-aware` with `oxlint-tsgolint` (for example `no-floating-promises`, `no-misused-promises`, `await-thenable`).
- **Layer and purity rules** through `overrides` (`no-restricted-imports` patterns per folder, `no-restricted-globals` in `packages/domain`, `import/no-cycle`); see ADR-0001 for the full boundary design.
- **i18n:** native `react/jsx-no-literals` is blocking. `eslint-plugin-lingui` (`no-unlocalized-strings`) runs via `jsPlugins` as a non-blocking warning, blocking once oxlint JS plugins are stable (ADR-0016; resolved 2026-11-24, OQ-T10: warn now, block later).
- **React:** native `rules-of-hooks` and `exhaustive-deps`. The React Compiler rules from `eslint-plugin-react-hooks` 7 run via `jsPlugins` as non-blocking warnings, blocking once JS plugins are stable (OQ-T10, resolved). The compiler's `logger` writes a bail-out report as a CI artifact.
- **Accessibility:** native `jsx-a11y` rules (recommended set), complemented by axe-core tests (ADR-0010).
- No ESLint, no typescript-eslint and no `eslint-plugin-boundaries` in the repository.

**Formatting: oxfmt** with `.oxfmtrc.json`; **Prettier is removed entirely**.

- Coverage of the repo's file types: TS/TSX, JSON, **YAML** (rules registry, content, GitHub workflows, `pnpm-workspace.yaml`), **Markdown** (docs, ADRs, educational texts), **CSS** (`tokens.css` with Tailwind v4 at-rules, checked in M0), HTML (`index.html`). That covers everything the repository formats.
- Deliberately **not formatted:** generated files (Lingui catalogs, `content.json`, `rules.json`, lockfile), SVGO-optimized SVG art, and the two small infrastructure files `deploy/Dockerfile` and `deploy/nginx.conf`. Those two are reviewed by hand; no extra formatter is added for them.
- Options: `printWidth: 100` (oxfmt default), otherwise defaults.
  - `sortTailwindcss: { stylesheet: "apps/web/src/ui/app.css", functions: ["cn", "clsx", "cva"] }` replaces `prettier-plugin-tailwindcss`. `app.css` is the Tailwind v4 entry stylesheet; it imports `tokens.css`.
  - `sortImports` is enabled with groups (built-in → external → `@powr/*` → relative).
  - `sortPackageJson` stays on.
- The version is pinned exactly while oxfmt is beta. Upgrades land as separate "chore: reformat" commits.

**CI:** `oxlint --type-aware` (fails on errors; warnings reported) and `oxfmt --check`. **Editor:** `oxc.oxc-vscode` recommended in `.vscode/extensions.json`, format on save in `.vscode/settings.json`.

## Consequences

- Positive: lint and format run in a fraction of ESLint's and Prettier's time, so they run on every save and commit. One toolchain (Oxc) and one editor extension. Tailwind sorting and import sorting are built in. Type-aware rules use the same TypeScript 7.0 semantics as `tsc`.
- Positive: removing typescript-eslint removes the reason to pin TypeScript 6.0 (ADR-0002).
- Negative: `eslint-plugin-boundaries` is unavailable; boundaries now rely on pnpm, TypeScript project references, oxlint overrides and an architecture test (ADR-0001).
- Negative: Lingui's `no-unlocalized-strings` and the React Compiler rules are only available as alpha JS-plugin warnings (T-16, TD-08).
- Negative: oxfmt is beta. Output may change between versions and diverges from Prettier in documented edge cases (T-17).
- Runner-up: **ESLint 10 + typescript-eslint + Prettier 3**. TypeScript 6.0 would then be needed again for typescript-eslint.

## Amendment (v0.3, 2026-11-24)

- **ESLint is installed, never run.** ESLint 10.15.0 is in the lockfile as the auto-installed **peer** of `eslint-plugin-lingui` and `eslint-plugin-react-hooks`, which the alpha JS plugins need to load. No script, workflow or editor setting runs it, and there is still no ESLint configuration. `eslint-plugin-lingui` 0.16 and `@typescript-eslint/utils` declare TypeScript < 6.1 (a peer warning); the rules work without type information. Re-check when the plugins support TypeScript 7.
- **Native React Compiler rules.** oxlint 1.95 ships native ports of most React Compiler rules in its `correctness` category: `react/purity`, `refs`, `immutability`, `set-state-in-render`, `set-state-in-effect`, `static-components`, `use-memo`, `preserve-manual-memoization`, `incompatible-library`, `globals`, `error-boundaries` (`unsupported-syntax` is in `restriction`, off). With `correctness: 'error'` they already block; a `Math.random()`-in-render probe reports the native error and the alpha warning. Verifying parity, dropping the duplicated alpha rules and narrowing OQ-T10 is TD-10.
- **More native rules than planned:** `no-restricted-properties` (`Math.random` in the domain) and `jsx-a11y/label-has-associated-control` with `controlComponents: ['Input']` for the design-system input.
- **oxfmt `sortImports`** has a `subpath` group for the `#ui/*` alias (ADR-0002): built-in → external → `@powr/*` → `#ui/*` → relative.

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.
