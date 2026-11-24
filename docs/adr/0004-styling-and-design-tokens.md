# ADR-0004: Styling and design tokens: Tailwind CSS v4 + CSS-variable tokens

- Status: Accepted (v0.2 note: class sorting by oxfmt)
- Date: 2026-11-23, note added 2026-11-24
- Related: technical concept §8.9.3, §8.11; PRD SET-01, PWA-14, NFR-A11Y-05/10

## Context

Light, dark and system themes must switch without reload; all screens, charts, the body map and celebration graphics must meet WCAG AA contrast in both themes; the heat map and charts need colour-vision-safe palettes. Styling must not add runtime cost and must fit the chosen component approach (ADR-0003). Tailwind CSS 4.3.5 (MIT) was checked on 2026-11-23.

## Options considered

| Criterion (weight) | Tailwind v4 + CSS variables | CSS Modules + CSS variables | vanilla-extract | Emotion (runtime CSS-in-JS) |
|---|---|---|---|---|
| Fit with React + TS (2) | 5 | 5 | 4 | 4 |
| Runtime cost / bundle (3) | 5 | 5 | 5 | 2 |
| Theming with tokens (3) | 5 | 4 | 5 | 4 |
| Fit with shadcn/Base UI (3) | 5 | 2 | 2 | 1 |
| Solo productivity (2) | 4 | 3 | 2 | 4 |
| **Total (max 65)** | **63** | 49 | 48 | 37 |

## Decision

- **Tailwind CSS v4** utilities, with all colours, radii, spacing for touch targets and motion durations defined as **semantic CSS custom properties** in `src/ui/tokens.css` and exposed to Tailwind via `@theme inline`.
- Light and dark values with `light-dark()` (Chrome Android 123+, Samsung Internet 27+) and `color-scheme`; the user's choice sets `data-theme` on `<html>`.
- Components use semantic tokens only (`bg-surface`, `text-fg-muted`), never raw palette values.
- ECharts themes and the body-map heat palette are built from the same tokens at runtime.
- CI runs a contrast check over all token pairs (≥ 4.5:1 text, ≥ 3:1 UI and graphics) and a colour-vision simulation for the heat and chart palettes.

## Consequences

- Positive: zero runtime styling cost; one source of truth for colours across UI, charts and body map; theme switches are a single attribute change.
- Negative: long class lists in some components; mitigated by `class-variance-authority` variants and small wrapper components.
- v0.2: Tailwind class order is normalized by oxfmt's built-in `sortTailwindcss` (`functions: ["cn", "clsx", "cva"]`), which replaces `prettier-plugin-tailwindcss` (ADR-0017). Its regex limitation (no regex for attributes or functions) does not matter here because class helpers are called by name.
- Runner-up: CSS Modules + CSS variables if Tailwind is abandoned together with shadcn.
