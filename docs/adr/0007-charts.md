# ADR-0007: Charts: Apache ECharts 6 (modular, lazy-loaded) + own SVG sparklines

- Status: Accepted (confirm bundle size and S22 performance in spike S-4)
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
