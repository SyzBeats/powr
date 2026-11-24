# ADR-0003: UI component library: shadcn/ui on Base UI

- Status: Accepted
- Date: 2026-11-23
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
