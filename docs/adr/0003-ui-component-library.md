# ADR-0003: UI component library: shadcn/ui on Base UI

- Status: Accepted (v0.3, 2026-11-24: `#ui/*` alias and shadcn CLI workflow; v0.4, 2026-11-24: TD-21 resolved, see below)
- Date: 2026-11-23, amended 2026-11-24
- Related: technical concept §8.9, §8.14; PRD NFR-A11Y-01…11, NFR-USE-05, WKT-02, SET-01, PWA-14

## Context

The app needs accessible primitives (dialogs, bottom sheets, menus, toggles, sliders, toasts) styled for one-handed gym use: 48 px targets, thumb-zone layouts, light and dark themes with AA contrast, and a native Android feel. It must stay small for the cold-start budget and be fully under the project's control, because mobile ergonomics will need many local adjustments.

Facts checked 2026-11-23: `@base-ui/react` 1.9.0 (MIT, maintained by the MUI team); shadcn CLI 4.23.0 (MIT). Since July 2026, Base UI is shadcn/ui's default primitive layer, with Radix and React Aria still selectable; Base UI's Drawer supports swipe-to-dismiss and snap points (bottom sheets). `@mantine/core` 9.8.2 (MIT), `@mui/material` 9.6.0 (MIT), `@ionic/react` 9.0.13 (MIT), `konsta` 5.5.0 (MIT, about 21,000 weekly downloads), `react-aria-components` 1.22.1 (Apache-2.0). Full-package gzipped sizes (bundlephobia): Base UI 163 KB, Mantine core 188 KB, Ionic React 240 KB, React Aria Components 273 KB; all are tree-shakable to a fraction of that except Ionic's core.

## Options considered

| Criterion (weight) | shadcn/ui + Base UI + Tailwind | Mantine 9 | React Aria Components | MUI 9 | Ionic React 9 | Konsta UI 5 |
|---|---|---|---|---|---|---|
| Fit with React + TS (2) | 5 | 5 | 5 | 5 | 3 | 4 |
| Maintenance and community (2) | 5 | 5 | 5 | 5 | 4 | 2 |
| Bundle size and mobile performance (3) | 4 | 3 | 3 | 2 | 2 | 4 |
| Accessibility (3) | 4 | 4 | 5 | 4 | 3 | 2 |
| Mobile / PWA fit (bottom sheets, touch, native feel) (2) | 4 | 3 | 3 | 3 | 5 | 5 |
| Solo productivity (3) | 4 | 5 | 3 | 4 | 3 | 3 |
| **Total (max 75)** | **64** | 62 | 59 | 56 | 48 | 49 |

Notes:
- **Base UI vs Radix under shadcn/ui:** both are MIT and supported by the shadcn CLI. Base UI is chosen because it became shadcn's default base in July 2026 (new components ship for it first), it is actively maintained by the MUI team, and its Drawer provides swipe-to-dismiss and snap points natively. shadcn's earlier drawer depended on `vaul`, whose last release is from December 2024. Radix (`radix-ui` 1.8.1, MIT) remains a valid per-component fallback.
- **Mantine** is the most "batteries-included" option and a close second; it is more desktop-oriented and its styles live in the library, so deep mobile restyling means overriding.
- **React Aria Components** has the strongest accessibility and touch-interaction model but needs the most assembly; shadcn can also use it as a base (`--base aria`), which keeps it available as a fallback per component.
- **MUI** brings Material Design (close to Android's look) but at the highest bundle cost.
- **Ionic React** gives the most native feel but brings its own router integration, Stencil web components with shadow DOM (harder accessibility audits), and a heavy core.
- **Konsta UI** is small and native-looking but has a small community and weaker accessibility.

## Decision

Use **shadcn/ui components on Base UI primitives**, styled with Tailwind CSS v4 (ADR-0004). Components are copied into `apps/web/src/ui` and owned by the project. Domain components (steppers, RIR chips, timer ring, plate bar, body map, "Why?" sheet) are built on top.

## Consequences

- Positive: full control over mobile ergonomics; only used components are shipped; Base UI provides WAI-ARIA behaviour, focus management and the bottom-sheet Drawer.
- Positive: no runtime CSS-in-JS; theming through CSS variables.
- Negative: owned component code must be maintained (no automatic library upgrades). Mitigated by keeping changes small and re-pulling from the shadcn registry when useful.
- Negative: accessibility of custom domain components is the project's responsibility; covered by axe tests and the TalkBack protocol.
- Runner-up: **Mantine 9**, if building and maintaining owned components turns out too slow.

## Amendment (v0.3, 2026-11-24)

**M0 (v0.2 state).** `shadcn init` 4.23 needs a path alias or package `imports`, which ADR-0002 did not allow, and it adds the Geist web font (conflicts with the system font stack, OQ-T7), `tw-animate-css` and the `shadcn` package. M0 therefore wrote `components.json` by hand (style `base-nova`, Base UI) and wrote Button, the segmented control (ToggleGroup) and NumberField in shadcn style.

**Decision (product owner, 2026-11-24): the `#ui/*` subpath-imports alias is approved** so that the official CLI works (ADR-0002 amendment). Constraints: keep the system font stack; no Geist or other web font; no dependency beyond what a component genuinely needs; every dependency passes the licence gate (ADR-0018).

- `apps/web/package.json` `imports`: `#ui/cn` → `./src/ui/cn.ts`, `#ui/*` → `./src/ui/*.tsx`. `components.json` aliases: `components` and `ui` → `#ui`, `utils` → `#ui/cn`, `lib` → `#ui/lib`, `hooks` → `#ui/hooks`.
- The CLI version is pinned: `pnpm --filter @powr/web ui:add <component>` runs `pnpm dlx shadcn@4.23.0 add`. The CLI is not a repository dependency. `shadcn init` is still not used.
- **Review after every `add`** (technical concept §8.9.2): replace `import { cn } from "cn"` with `#ui/cn` and remove the `cn` package the CLI installs; map shadcn token names to POWR tokens (ADR-0004); ≥ 48 px targets for workout controls; drop `dark:` classes (tokens follow the app theme through `light-dark()`, Tailwind's `dark:` follows the OS); no fonts or extra packages.
- **Proof:** `shadcn@4.23.0 add input` resolved the aliases, created `src/ui/input.tsx` (Base UI `Input`) and added `cn@0.5.2`. The review reverted the `cn` dependency and mapped the classes; the CLI changed no CSS, fonts or other files. `Input` replaced the hand-written text inputs.
- Base UI injects `<style>` elements unless told not to; the app root uses `CSPProvider` with `disableStyleElements`, because `style-src 'self'` blocks them (technical concept §7.3).
- Open: shadcn's registry now depends on the `cn` package and on shadcn token names. Whether to adopt `cn` (replacing clsx + tailwind-merge) and whether to add a token-name bridge to `app.css` is decided when more components arrive (TD-21).

Source: `IMPLEMENTATION_NOTES.md` §3 (repository root), which records each deviation with its reason.

## Amendment (v0.4, 2026-11-24)

**Decision (product owner, 2026-11-24): TD-21 is resolved. Keep `#ui/cn` and bridge shadcn's colour names** (implemented before this amendment).

- **`cn`:** the shadcn registry imports `cn` from the pre-1.0 `cn` npm package, and `components.json` aliases cannot redirect a bare package import. `pnpm --filter @powr/web ui:add <component>` now runs `apps/web/scripts/ui-add.ts`: the pinned CLI (`shadcn@4.23.0`), then `from "cn"` → `#ui/cn`, the `cn` package removed again, `src/ui` formatted. `#ui/cn` (clsx + tailwind-merge) stays the one class-merging helper; no new dependency.
- **Colour bridge:** `src/ui/app.css` aliases shadcn's colour names to POWR tokens (`--background` → `--bg`, `--muted-foreground` → `--fg-muted`, `--ring` → `--focus`, `--input` → `--fg-muted` because `--border` is decorative and below 3:1, …) and maps them into Tailwind. Every value is a POWR token, so ADR-0004's token set stays the single source of colours. Tailwind's `dark:` variant is scoped to the app theme (`data-theme="dark"`, or the OS setting while the theme is "system"), so registry `dark:` classes follow the app theme like `light-dark()` does.
- **What the review still does** (technical concept §8.9.2): ≥ 48 px targets for workout controls, the global focus outline instead of translucent rings, no fonts or extra packages. Not bridged: shadcn's radius scale and chart colours.
- **Proof:** `Input` was re-added through the script (import rewritten, package removed, `package.json` and lockfile unchanged); `scripts/theme-bridge.test.ts` checks AA contrast for the 18 bridged pairs; an E2E test checks the shadcn `Input` in four theme × OS combinations and fails with Tailwind's default `dark:`.

Source: `IMPLEMENTATION_NOTES.md` (repository root): §3 rows marked "Docs amended in v0.4" and the sections "M1-B content" and "M1-A engine and rules".

## Amendment (v0.9, 2026-11-25)

The decision stands. `#ui/button` (Base UI's `Button` with the design system's variants) stays the button of every screen. The shell's route error boundary and the update and stale-window banners are on the startup path, and Base UI's button stack (`Button`, `useButton`, `mergeProps`, `useRenderElement`, `useMergedRefs`, …) was about 3 KB gzip of entry JS for them alone. They now render a native `<button type="button">` with the same classes from `buttonClass` in `ui/button-class.ts` (alias `#ui/button-class`, the second `.ts` exception next to `#ui/cn` in `apps/web/package.json` `imports`; `#ui/button` re-exports `buttonClass`, so no other import changed), as `app/StartupError.tsx` already did. For enabled buttons and a natively disabled one this is the same element and behaviour; anything with Base UI semantics (focusable when disabled, composite widgets) keeps using the components (technical concept §8.9.2, TD-63).

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M5z bundle trim, fixes and docs".
