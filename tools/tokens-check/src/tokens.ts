import { parseHex, type Rgb } from './color.ts';

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export type TokenColours = Readonly<Record<Theme, Rgb>>;

/**
 * Colour tokens of `tokens.css`: every `--name: light-dark(#rrggbb, #rrggbb);` declaration. Any
 * other colour declaration (a bare hex, `rgb()`, `oklch()`, a `var()` alias) is reported, so a
 * token can never slip past the gate in a format it does not read.
 */
export function parseTokens(css: string): {
  readonly tokens: ReadonlyMap<string, TokenColours>;
  readonly unreadable: readonly string[];
} {
  const tokens = new Map<string, TokenColours>();
  const unreadable: string[] = [];
  const body = css.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const pair = /^light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/i.exec(value!.trim());
    if (pair) {
      tokens.set(name!, { light: parseHex(pair[1]!), dark: parseHex(pair[2]!) });
    } else if (
      /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\(/i.test(value!)
    ) {
      unreadable.push(name!);
    }
  }
  return { tokens, unreadable };
}

/** The shadcn colour-name bridge in `app.css` (TD-21): alias → POWR token. */
export function parseBridge(appCss: string): ReadonlyMap<string, string> {
  const start = appCss.indexOf(':root {');
  if (start < 0) return new Map();
  const block = appCss.slice(start, appCss.indexOf('}', start));
  return new Map(
    [...block.matchAll(/--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\)/g)].map(([, alias, token]) => [
      alias!,
      token!,
    ]),
  );
}
