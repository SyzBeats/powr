# ADR-0007: Charts: Apache ECharts 6 (modular, lazy-loaded) + own SVG sparklines

- Status: Accepted (confirm bundle size and S22 performance in spike S-4; amended v0.8: S-4 go, implemented in M4v, the S22 run still open)
- Date: 2026-11-23
- Related: technical concept §8.10; PRD ANL-01…11, NFR-PERF-05, NFR-A11Y-06/10, TC-08

## Context

Charts must be modern and interactive: tap for tooltip, range presets, pinch-zoom or a range slider, smooth transitions that respect reduced motion. They must render correctly in both themes with colour-blind-safe palettes, never rely on colour alone, offer a table view and a one-sentence summary, render 5 years of history in ≤ 500 ms and respond in ≤ 100 ms on the Galaxy S22.

Facts checked 2026-11-23:

- echarts 6.1.0 (Apache-2.0; full package about 359 KB gzipped per bundlephobia; tree-shakable). It has built-in `dataZoom` (inside and slider, with touch pinch), LTTB `sampling`, an `aria` module with auto descriptions, and decal patterns for colour-blind users (handbook). ECharts 6 adds dynamic theme switching.
- recharts 3.11.1 (MIT; about 173 KB gzipped full; depends on Redux Toolkit and Immer).
- @visx/xychart 4.0.0 (MIT).
- uplot 1.6.32 (MIT; about 21 KB gzipped; last release March 2025).

## Options considered

| Criterion (weight) | ECharts 6 | Recharts 3 | visx 4 | uPlot 1.6 |
|---|---|---|---|---|
| Fit with React + TS (2) | 3 (imperative; thin wrapper) | 5 | 4 | 2 |
| Maintenance and community (2) | 5 | 5 | 3 | 2 |
| Bundle size (2) | 2 | 3 | 4 | 5 |
| Accessibility (3) | 4 (aria descriptions, decals; canvas needs table view) | 3 (keyboard layer; no patterns built in) | 3 (build it yourself) | 1 |
| Interaction: zoom, pan, touch, tooltips (3) | 5 | 2 (Brush only, no pinch) | 2 | 3 |
| Performance on large data (2) | 5 (canvas, LTTB) | 3 (SVG) | 3 | 5 |
| Solo productivity (2) | 4 | 4 | 2 | 2 |
| **Total (max 80)** | **65** | 55 | 47 | 44 |

## Decision

- **ECharts 6.1**, imported modularly (line, scatter, bar, custom; grid, tooltip, dataZoom, markLine, markArea, legend, dataset, aria; canvas renderer), in a lazy chunk used by Progress and Exercise-detail routes, precached for offline use.
- Own `<EChart>` wrapper (about 80 lines); no `echarts-for-react`.
- Themes generated from the CSS design tokens; `aria.decal` patterns on; series also differ by symbol and dash.
- Every chart has a domain-generated text summary (`aria-label`) and a "View as table" toggle.
- Data is prepared by pure domain functions from derived tables (one point per session; weekly aggregation beyond 1 year) plus `sampling: 'lttb'`.
- Home sparklines are a hand-written SVG component, so ECharts never loads on the cold-start path.

## Consequences

- Positive: pinch-zoom, sliders, annotations and colour-blind patterns come built in; canvas rendering stays fast with years of data.
- Negative: the largest single dependency (expected 150–250 KB gzipped after tree-shaking); mitigated by lazy loading and the precache budget (§8.19).
- Negative: canvas content is not keyboard-navigable; the table view is the accessible equivalent (ANL-11).
- Apache-2.0 NOTICE text must appear on the attributions screen (handled by ADR-0018).
- Runner-up: **Recharts 3** behind the same wrapper interface if S-4 shows unacceptable size or performance.

## Amendment (v0.8, 2026-11-25)

The decision stands: spike S-4 (run in M4v) is a **go** for ECharts, accepted by the product owner on 2026-11-25 (technical concept §8.10).

- **Measured:** the modular chunk is 515.6 KB minified, **174.0 KB gzip**, inside the 150–250 KB estimate, loaded with the first chart only (the start screen never fetches it) and precached. First render of five years of squat e1RM (1,275 sessions, trend, band, 45 shaded spans) 88–95 ms unthrottled, 316–330 ms at 4× and 472–486 ms at 6× CPU slowdown; range chips and pinches stay under 100 ms unthrottled and exceed it at 4× only over the whole five-year history (up to 134 ms and one 182 ms pinch).
- **Conditions of the go:** ranges over one year are aggregated to weekly maxima before rendering (built in M4a as `e1rmSeries(...).aggregated` in `@powr/domain/analytics`, used by the M4b trend screens), and the timings are confirmed on the S22 (technical concept TD-50). Recharts 3 stays the fallback behind the same props if the S22 run fails.
- **Modular set as built:** line, scatter and bar charts, `GridSimpleComponent` (not `GridComponent`: its axis pointer pulled Rolldown's runtime helper out of the startup chunk into a second first-wave script), the inside data zoom, mark line and mark area, the canvas renderer. **Not used:** `CustomChart`, the tooltip, legend, title, dataset and aria components and the slider zoom.
- **Accessibility pattern as built (accepted by the product owner):** the canvas is `aria-hidden`; the one-sentence summary is visible text; a visually hidden point slider (a range input) is the keyboard and TalkBack way through the points, with an HTML readout instead of the ECharts tooltip; range chips plus Earlier/Later buttons are the tap alternatives to pinch and pan (`touch-action: pan-y` keeps vertical scrolling); "View as table" pages 30 rows; the legend is in words. Patterns are drawn per bar instead of aria decals. Up to three series colours (`--chart-1…3`), also told apart by dash and symbol (accepted by the product owner).
- **Theme:** colours resolved from the CSS tokens at runtime and put straight into the option (no `registerTheme`), re-rendered on theme, OS scheme, root font size and reduced-motion changes.
- **Trusted Types:** without the tooltip, the only sink is zrender's `innerHTML = ''` on its own host; a host-only setter accepts only the empty string and clears with `replaceChildren()`. No new policy (the allow-list stays `powr-sw`); TD-03 is narrowed accordingly.
- **Home sparklines:** still not ECharts (the Home route must not load the chunk).

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M4v charts, body map and timer extras" and "M4b insight screens".
