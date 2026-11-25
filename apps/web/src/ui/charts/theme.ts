import { useSyncExternalStore } from 'react';

/**
 * The charts' colours and type, read from the design tokens at runtime (§8.10: "an ECharts theme
 * built from the CSS tokens"). Tokens are `light-dark()` pairs, and a custom property's computed
 * value is the unresolved pair, so each token is resolved through a hidden probe element's
 * `color`, which follows the page's `color-scheme`. The values change when the app theme
 * (`data-theme` on <html>), the OS scheme, the root font size or reduced motion changes; every
 * chart re-renders with them.
 */
export interface ChartTheme {
  readonly series: readonly [string, string, string];
  readonly heat: readonly [string, string, string, string, string, string];
  readonly fg: string;
  readonly fgMuted: string;
  readonly surface: string;
  readonly border: string;
  readonly control: string;
  readonly prAccent: string;
  readonly fontFamily: string;
  /** The root font size in CSS px (16 by default, 32 at 200% text). */
  readonly rem: number;
  readonly reducedMotion: boolean;
}

const TOKENS = [
  'chart-1',
  'chart-2',
  'chart-3',
  'heat-0',
  'heat-1',
  'heat-2',
  'heat-3',
  'heat-4',
  'heat-5',
  'fg',
  'fg-muted',
  'surface',
  'border',
  'control',
  'pr-accent',
] as const;

let probe: HTMLSpanElement | null = null;
let cached: { key: string; theme: ChartTheme } | null = null;

function resolve(): ChartTheme {
  if (!probe || !probe.isConnected) {
    probe = document.createElement('span');
    probe.hidden = true;
    probe.dataset['chartThemeProbe'] = '';
    document.body.append(probe);
  }
  const colours = TOKENS.map((token) => {
    probe!.style.color = `var(--${token})`;
    return getComputedStyle(probe!).color;
  });
  const root = getComputedStyle(document.documentElement);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const key = [...colours, root.fontSize, root.fontFamily, reducedMotion].join('|');
  if (cached?.key === key) return cached.theme;
  const [
    c1 = '',
    c2 = '',
    c3 = '',
    h0 = '',
    h1 = '',
    h2 = '',
    h3 = '',
    h4 = '',
    h5 = '',
    fg = '',
    fgMuted = '',
    surface = '',
    border = '',
    control = '',
    prAccent = '',
  ] = colours;
  const theme: ChartTheme = {
    series: [c1, c2, c3],
    heat: [h0, h1, h2, h3, h4, h5],
    fg,
    fgMuted,
    surface,
    border,
    control,
    prAccent,
    fontFamily: getComputedStyle(document.body).fontFamily,
    rem: Number.parseFloat(root.fontSize) || 16,
    reducedMotion,
  };
  cached = { key, theme };
  return theme;
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'style', 'class'],
  });
  const queries = [
    matchMedia('(prefers-color-scheme: dark)'),
    matchMedia('(prefers-reduced-motion: reduce)'),
  ];
  for (const query of queries) query.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    for (const query of queries) query.removeEventListener('change', onChange);
  };
}

export function useChartTheme(): ChartTheme {
  return useSyncExternalStore(subscribe, resolve);
}

/** `rgb(r, g, b)` → `rgba(r, g, b, alpha)` for translucent fills (bands, shading). */
export function withAlpha(colour: string, alpha: number): string {
  const match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(colour);
  return match ? `rgba(${match[1]},${match[2]},${match[3]},${alpha})` : colour;
}
