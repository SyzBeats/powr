import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// Read from disk: Vitest replaces CSS imports, even `?raw`, with empty modules.
const readUi = (file: string) =>
  readFileSync(new URL(`../src/ui/${file}`, import.meta.url), 'utf8');
const appCss = readUi('app.css');
const tokensCss = readUi('tokens.css');

/** POWR tokens: name → [light, dark] (tokens.css, `light-dark(#rrggbb, #rrggbb)`). */
const tokens = new Map(
  [...tokensCss.matchAll(/--([a-z-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/g)].map(
    ([, name, light, dark]) => [name!, [light!, dark!] as const],
  ),
);
/** shadcn name → POWR token (the bridge's `:root` block in app.css). */
const bridgeBlock = appCss.slice(
  appCss.indexOf(':root {'),
  appCss.indexOf('}', appCss.indexOf(':root {')),
);
const bridge = new Map(
  [...bridgeBlock.matchAll(/--([a-z-]+):\s*var\(--([a-z-]+)\)/g)].map(([, name, token]) => [
    name!,
    token!,
  ]),
);

function colour(name: string, theme: 0 | 1): string {
  const value = tokens.get(bridge.get(name) ?? name)?.[theme];
  if (!value) throw new Error(`No light-dark() token behind --${name}`);
  return value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

// [foreground, background, minimum]: 4.5 for text, 3 for control boundaries and focus (WCAG 2.2 AA).
const PAIRS = [
  ['foreground', 'background', 4.5],
  ['card-foreground', 'card', 4.5],
  ['popover-foreground', 'popover', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['muted-foreground', 'muted', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['destructive', 'background', 4.5],
  ['primary', 'background', 4.5],
  ['sidebar-foreground', 'sidebar', 4.5],
  ['sidebar-accent-foreground', 'sidebar-accent', 4.5],
  ['sidebar-primary-foreground', 'sidebar-primary', 4.5],
  ['input', 'background', 3],
  ['input', 'card', 3],
  ['ring', 'background', 3],
  ['ring', 'card', 3],
] as const;

describe('shadcn colour-name bridge (TD-21)', () => {
  it('aliases every shadcn colour name used by base-nova to a POWR token', () => {
    expect([...bridge.keys()]).toEqual(
      expect.arrayContaining(['background', 'muted-foreground', 'destructive', 'input', 'ring']),
    );
    for (const name of bridge.keys()) expect(() => colour(name, 0)).not.toThrow();
  });

  it('keeps WCAG 2.2 AA contrast for the shadcn pairs in light and dark', () => {
    const failures = PAIRS.flatMap(([fg, bg, minimum]) =>
      ([0, 1] as const)
        .map((theme) => ({ theme, ratio: contrast(colour(fg, theme), colour(bg, theme)) }))
        .filter(({ ratio }) => ratio < minimum)
        .map(
          ({ theme, ratio }) => `${fg} on ${bg} (${theme ? 'dark' : 'light'}): ${ratio.toFixed(2)}`,
        ),
    );
    expect(failures).toEqual([]);
  });
});
