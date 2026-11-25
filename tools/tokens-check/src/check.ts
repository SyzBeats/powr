import { composite, contrast, deltaE2000, DEFICIENCIES, simulate, type Rgb } from './color.ts';
import {
  MANIFEST,
  MIN_ADJACENT_DELTA_E,
  MIN_SERIES_DELTA_E,
  MINIMUM,
  type TokenManifest,
} from './manifest.ts';
import { THEMES, type Theme, type TokenColours } from './tokens.ts';

export interface PairResult {
  readonly kind: 'text' | 'fill-text' | 'ui' | 'scale' | 'series' | 'tint-text';
  readonly fg: string;
  readonly bg: string;
  readonly theme: Theme;
  readonly ratio: number;
  readonly minimum: number;
}

export interface ScaleResult {
  /** `scale`: adjacent heat-map steps; `series`: any two chart series. */
  readonly kind: 'scale' | 'series';
  readonly theme: Theme;
  readonly vision: 'normal' | (typeof DEFICIENCIES)[number];
  readonly from: string;
  readonly to: string;
  readonly deltaE: number;
}

export interface TokenReport {
  readonly pairs: readonly PairResult[];
  readonly scale: readonly ScaleResult[];
  readonly problems: readonly string[];
}

/** Every pair the manifest implies, in both themes, plus the colour-vision check of the scale. */
export function checkTokens(
  tokens: ReadonlyMap<string, TokenColours>,
  manifest: TokenManifest = MANIFEST,
): TokenReport {
  const problems: string[] = [];
  const pairs: PairResult[] = [];
  const scale: ScaleResult[] = [];
  const colour = (name: string, theme: Theme): Rgb | null => {
    const token = tokens.get(name);
    if (!token) {
      problems.push(`--${name} is in the manifest but not in tokens.css`);
      return null;
    }
    return token[theme];
  };
  const classified = new Set([
    ...manifest.backgrounds,
    ...manifest.text,
    ...manifest.fills.flatMap(({ fill, on }) => [fill, on]),
    ...manifest.ui,
    ...manifest.scale,
    ...manifest.series,
    ...manifest.decorative,
  ]);
  for (const name of tokens.keys()) {
    if (!classified.has(name))
      problems.push(`--${name} has no role in tools/tokens-check/src/manifest.ts`);
  }
  for (const theme of THEMES) {
    const pair = (kind: PairResult['kind'], fg: string, bg: string, minimum: number) => {
      const a = colour(fg, theme);
      const b = colour(bg, theme);
      if (a && b) pairs.push({ kind, fg, bg, theme, ratio: contrast(a, b), minimum });
    };
    for (const bg of manifest.backgrounds) {
      for (const fg of manifest.text) pair('text', fg, bg, MINIMUM.text);
      for (const fg of manifest.ui) pair('ui', fg, bg, MINIMUM.ui);
      for (const { fill } of manifest.fills) pair('ui', fill, bg, MINIMUM.ui);
      for (const step of manifest.scale) pair('scale', step, bg, MINIMUM.ui);
      for (const series of manifest.series) pair('series', series, bg, MINIMUM.ui);
    }
    for (const { fill, on } of manifest.fills) pair('fill-text', on, fill, MINIMUM.text);

    const steps = manifest.scale.map((name) => ({ name, rgb: colour(name, theme) }));
    const series = manifest.series.map((name) => ({ name, rgb: colour(name, theme) }));
    for (const vision of ['normal', ...DEFICIENCIES] as const) {
      const see = ({ name, rgb }: { name: string; rgb: Rgb | null }) => ({
        name,
        rgb: rgb && vision !== 'normal' ? simulate(rgb, vision) : rgb,
      });
      const seen = steps.map(see);
      for (let i = 1; i < seen.length; i++) {
        const [a, b] = [seen[i - 1]!, seen[i]!];
        if (a.rgb && b.rgb)
          scale.push({
            kind: 'scale',
            theme,
            vision,
            from: a.name,
            to: b.name,
            deltaE: deltaE2000(a.rgb, b.rgb),
          });
      }
      const seenSeries = series.map(see);
      for (let i = 0; i < seenSeries.length; i++) {
        for (let j = i + 1; j < seenSeries.length; j++) {
          const [a, b] = [seenSeries[i]!, seenSeries[j]!];
          if (a.rgb && b.rgb)
            scale.push({
              kind: 'series',
              theme,
              vision,
              from: a.name,
              to: b.name,
              deltaE: deltaE2000(a.rgb, b.rgb),
            });
        }
      }
    }
  }
  for (const result of pairs) {
    if (result.ratio + 1e-9 < result.minimum) {
      problems.push(
        `${result.fg} on ${result.bg} (${result.theme}): ${result.ratio.toFixed(2)}:1, needs ${result.minimum}:1`,
      );
    }
  }
  for (const result of scale) {
    const minimum = result.kind === 'series' ? MIN_SERIES_DELTA_E : MIN_ADJACENT_DELTA_E;
    if (result.deltaE < minimum) {
      const arrow = result.kind === 'series' ? '↔' : '→';
      problems.push(
        `${result.from} ${arrow} ${result.to} (${result.theme}, ${result.vision}): ΔE00 ${result.deltaE.toFixed(1)}, needs ${minimum}`,
      );
    }
  }
  return { pairs, scale, problems };
}

/** Colour utilities of Tailwind v4 that paint a colour token. */
const UTILITY =
  /(?<![\w-])((?:[\w[\]&=:@*.-]+:)*)(text|bg|border(?:-[trblxy])?|outline|ring|fill|stroke|decoration|placeholder|caret|divide|from|via|to)-([a-z][a-z0-9-]*)(?:\/(\d{1,3}))?(?![\w-])/g;

const TAILWIND_PALETTE =
  /^(?:black|white|(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe)-\d{2,3})$/;

export interface Usage {
  readonly file: string;
  readonly utility: string;
  readonly token: string;
  readonly alpha: number | null;
  readonly variants: string;
  readonly property: string;
}

/**
 * Colour utilities used by the app's source files. Raw palette colours (`text-white`,
 * `bg-red-500`) and arbitrary colour values (`bg-[#…]`) are problems: components use the
 * semantic tokens only (ADR-0004). `aliases` are the shadcn bridge names.
 */
export function scanUsage(
  files: readonly { readonly path: string; readonly text: string }[],
  tokens: ReadonlyMap<string, TokenColours>,
  aliases: ReadonlyMap<string, string>,
): { readonly usages: readonly Usage[]; readonly problems: readonly string[] } {
  const usages: Usage[] = [];
  const problems: string[] = [];
  for (const { path, text } of files) {
    for (const match of text.matchAll(UTILITY)) {
      const [utility, variants = '', property = '', name = '', alpha] = match;
      if (TAILWIND_PALETTE.test(name)) {
        problems.push(`${path}: ${utility} uses a raw palette colour; use a semantic token`);
        continue;
      }
      const token = tokens.has(name) ? name : aliases.get(name);
      if (token === undefined || !tokens.has(token)) continue;
      usages.push({
        file: path,
        utility,
        token,
        alpha: alpha === undefined ? null : Number(alpha) / 100,
        variants,
        property,
      });
    }
    for (const match of text.matchAll(
      /(?:text|bg|border|fill|stroke|ring|outline)-\[(?:#|rgb|hsl|oklch|color)/g,
    ))
      problems.push(`${path}: ${match[0]}…] is an arbitrary colour; use a semantic token`);
  }
  return { usages, problems };
}

/**
 * Checks how the used tokens are used: text utilities need a text or fill-text token, a tinted
 * background (`bg-x/30`) must still carry body text at 4.5:1 on every background, and translucent
 * text or outlines are only allowed where WCAG exempts them (disabled controls) or where a solid
 * outline already carries the meaning (`aria-invalid:ring-…/20` next to the border).
 */
export function checkUsage(
  usages: readonly Usage[],
  tokens: ReadonlyMap<string, TokenColours>,
  manifest: TokenManifest = MANIFEST,
): { readonly pairs: readonly PairResult[]; readonly problems: readonly string[] } {
  const problems: string[] = [];
  const pairs: PairResult[] = [];
  const textTokens = new Set([...manifest.text, ...manifest.fills.map(({ on }) => on)]);
  const decorative = new Set(manifest.decorative);
  for (const usage of usages) {
    const exempt = /(?:^|:)disabled:|(?:^|:)aria-disabled:|data-\[disabled\]:/.test(usage.variants);
    if (exempt) continue;
    const where = `${usage.file}: ${usage.utility}`;
    if (
      (usage.property === 'text' || usage.property === 'placeholder') &&
      !textTokens.has(usage.token)
    ) {
      problems.push(`${where}: --${usage.token} is not a text colour in the manifest`);
    }
    if (usage.alpha === null) continue;
    if (usage.property === 'ring' || decorative.has(usage.token)) continue;
    if (usage.property !== 'bg') {
      problems.push(`${where}: translucent ${usage.property} colours are not contrast-checked`);
      continue;
    }
    for (const theme of THEMES) {
      const tint = tokens.get(usage.token)![theme];
      for (const bg of manifest.backgrounds) {
        const base = tokens.get(bg)?.[theme];
        const fg = tokens.get('fg')?.[theme];
        if (!base || !fg) continue;
        const ratio = contrast(fg, composite(tint, usage.alpha, base));
        pairs.push({
          kind: 'tint-text',
          fg: 'fg',
          bg: `${usage.token}/${usage.alpha * 100} over ${bg}`,
          theme,
          ratio,
          minimum: MINIMUM.text,
        });
        if (ratio + 1e-9 < MINIMUM.text)
          problems.push(
            `${where} (${theme}, over ${bg}): fg on it ${ratio.toFixed(2)}:1, needs 4.5:1`,
          );
      }
    }
  }
  return { pairs, problems };
}
