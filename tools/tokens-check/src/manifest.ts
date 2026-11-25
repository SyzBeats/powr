/**
 * What each colour token of `apps/web/src/ui/tokens.css` is for. Every token must be listed
 * here, and every colour utility the app uses must resolve to a listed token, so the gate covers
 * every foreground/background pair the screens can paint (§8.9.3, NFR-A11Y-05).
 */
export interface TokenManifest {
  /** Page and card backgrounds that text and controls sit on. */
  readonly backgrounds: readonly string[];
  /** Text colours: ≥ 4.5:1 on every background (WCAG 1.4.3). */
  readonly text: readonly string[];
  /**
   * Filled controls and badges with the text colour on them: the text ≥ 4.5:1 on the fill, the
   * fill ≥ 3:1 against every background (its boundary identifies the control, WCAG 1.4.11).
   */
  readonly fills: readonly { readonly fill: string; readonly on: string }[];
  /** Control outlines, focus indicators and graphics: ≥ 3:1 on every background (1.4.11). */
  readonly ui: readonly string[];
  /**
   * An ordered scale (the volume heat map): every step is a graphic (≥ 3:1), and adjacent steps
   * stay apart for normal vision and simulated protanopia, deuteranopia and tritanopia
   * (NFR-A11Y-10).
   */
  readonly scale: readonly string[];
  /**
   * Categorical chart series (§8.10), in their fixed order: every series is a graphic (≥ 3:1),
   * and every pair (not only neighbours: lines cross and markers overlap) stays apart for normal
   * vision and simulated protanopia, deuteranopia and tritanopia (NFR-A11Y-10).
   */
  readonly series: readonly string[];
  /** Decorative lines that carry no meaning (dividers, card edges): no contrast requirement. */
  readonly decorative: readonly string[];
}

export const MANIFEST: TokenManifest = {
  backgrounds: ['bg', 'surface', 'surface-raised'],
  text: ['fg', 'fg-muted', 'primary', 'info', 'warning', 'danger', 'success', 'pr-accent'],
  fills: [
    { fill: 'primary', on: 'on-primary' },
    { fill: 'info', on: 'on-info' },
    { fill: 'warning', on: 'on-warning' },
    { fill: 'danger', on: 'on-danger' },
  ],
  ui: ['control', 'focus', 'fg-muted', 'primary', 'info', 'warning', 'danger', 'success'],
  scale: ['heat-0', 'heat-1', 'heat-2', 'heat-3', 'heat-4', 'heat-5'],
  series: ['chart-1', 'chart-2', 'chart-3'],
  decorative: ['border'],
};

export const MINIMUM = { text: 4.5, ui: 3 } as const;

/**
 * Smallest CIEDE2000 difference between adjacent scale steps, for normal vision and each
 * simulated deficiency. ΔE00 ≈ 2.3 is a just-noticeable difference; 10 keeps neighbouring map
 * regions clearly apart at a glance (a common threshold for categorical palettes).
 */
export const MIN_ADJACENT_DELTA_E = 10;

/** Smallest CIEDE2000 difference between any two chart series (all pairs), same visions. */
export const MIN_SERIES_DELTA_E = 10;
