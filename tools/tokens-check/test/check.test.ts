import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { checkTokens, checkUsage, scanUsage } from '../src/check.ts';
import { contrast, deltaE2000, parseHex, simulate } from '../src/color.ts';
import { MANIFEST } from '../src/manifest.ts';
import { parseBridge, parseTokens } from '../src/tokens.ts';

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const shipped = parseTokens(read('apps/web/src/ui/tokens.css'));
const aliases = parseBridge(read('apps/web/src/ui/app.css'));

describe('colour maths', () => {
  it('computes WCAG contrast', () => {
    expect(contrast(parseHex('#000000'), parseHex('#ffffff'))).toBeCloseTo(21, 5);
    // #777 on white is the classic "just below AA" grey.
    expect(contrast(parseHex('#777777'), parseHex('#ffffff'))).toBeCloseTo(4.48, 2);
  });

  it('computes CIEDE2000 (Sharma et al. 2005 pair 17: L*a*b* via a grey pair)', () => {
    expect(deltaE2000(parseHex('#808080'), parseHex('#808080'))).toBe(0);
    // A large blue-vs-yellow difference and a tiny one.
    expect(deltaE2000(parseHex('#0000ff'), parseHex('#ffff00'))).toBeGreaterThan(50);
    expect(deltaE2000(parseHex('#808080'), parseHex('#818181'))).toBeLessThan(1);
  });

  it('simulates dichromacy: red and green collapse for protanopia and deuteranopia', () => {
    const [red, green] = [parseHex('#d62728'), parseHex('#2ca02c')];
    for (const deficiency of ['protanopia', 'deuteranopia'] as const) {
      expect(deltaE2000(simulate(red, deficiency), simulate(green, deficiency))).toBeLessThan(
        deltaE2000(red, green) / 2,
      );
    }
    // Blue and yellow stay apart for both, and collapse towards each other for tritanopia.
    const [blue, yellow] = [parseHex('#1f77b4'), parseHex('#bcbd22')];
    expect(deltaE2000(simulate(blue, 'tritanopia'), simulate(yellow, 'tritanopia'))).toBeLessThan(
      deltaE2000(blue, yellow),
    );
  });
});

describe('the shipped tokens', () => {
  it('are all readable light-dark() pairs with a role', () => {
    expect(shipped.unreadable).toEqual([]);
    expect(checkTokens(shipped.tokens).problems).toEqual([]);
  });

  it('meet the minimums the gate claims, in both themes', () => {
    const { pairs } = checkTokens(shipped.tokens);
    expect(pairs.filter((pair) => pair.kind === 'text').every((pair) => pair.ratio >= 4.5)).toBe(
      true,
    );
    expect(pairs.filter((pair) => pair.kind === 'fill-text').map((pair) => pair.fg)).toEqual(
      expect.arrayContaining(MANIFEST.fills.map(({ on }) => on)),
    );
    expect(pairs.some((pair) => pair.theme === 'light')).toBe(true);
    expect(pairs.some((pair) => pair.theme === 'dark')).toBe(true);
  });

  it('bridges every shadcn alias to an existing token', () => {
    for (const token of aliases.values()) expect(shipped.tokens.has(token)).toBe(true);
  });
});

const swap = (name: string, light: string, dark: string) =>
  new Map([...shipped.tokens, [name, { light: parseHex(light), dark: parseHex(dark) }]]);

describe('the gate fails', () => {
  it('on white text on the vibrant green (the mock-up button)', () => {
    const tokens = swap('on-primary', '#ffffff', '#ffffff');
    expect(checkTokens(tokens).problems.join('\n')).toMatch(/on-primary on primary \(dark\)/);
  });

  it('on muted text below 4.5:1', () => {
    const tokens = swap('fg-muted', '#8a8a8a', '#5a5a5a');
    expect(checkTokens(tokens).problems.join('\n')).toMatch(/fg-muted on surface/);
  });

  it('on heat-map steps that colour-blind users cannot tell apart', () => {
    const tokens = swap('heat-4', '#9a5a00', '#f4b740');
    const red = swap('heat-5', '#a35a00', '#f2b23f');
    expect(checkTokens(tokens).problems).toEqual([]);
    expect(checkTokens(red).problems.join('\n')).toMatch(/heat-4 → heat-5/);
  });

  it('on chart series that collapse for a colour-vision deficiency, also when not neighbours', () => {
    expect(checkTokens(shipped.tokens).scale.some((step) => step.kind === 'series')).toBe(true);
    // Series 1 and 3 (not adjacent) become a red/green pair that deuteranopes cannot tell apart.
    const tokens = new Map([
      ...shipped.tokens,
      ['chart-1', { light: parseHex('#b8460f'), dark: parseHex('#dd6e32') }],
      ['chart-3', { light: parseHex('#2f7d1f'), dark: parseHex('#6aa84f') }],
    ]);
    expect(checkTokens(tokens).problems.join('\n')).toMatch(
      /chart-1 ↔ chart-3 \(\w+, deuteranopia\)/,
    );
  });

  it('on a chart series below 3:1 on a surface', () => {
    const tokens = swap('chart-2', '#f4a582', '#dd6e32');
    expect(checkTokens(tokens).problems.join('\n')).toMatch(/chart-2 on surface \(light\)/);
  });

  it('on a token without a role, and on raw or arbitrary colours in the app', () => {
    const tokens = swap('mystery', '#000000', '#ffffff');
    expect(checkTokens(tokens).problems.join('\n')).toMatch(/--mystery has no role/);
    const { problems } = scanUsage(
      [{ path: 'x.tsx', text: '<p className="text-white bg-[#123456] text-fg">' }],
      shipped.tokens,
      aliases,
    );
    expect(problems).toHaveLength(2);
  });

  it('on text in a fill colour that is not a text token, and on unreadable tints', () => {
    const scanned = scanUsage(
      [
        {
          path: 'x.tsx',
          text: 'className="text-heat-3 bg-primary/90 disabled:bg-input/80 aria-invalid:ring-destructive/20 text-muted-foreground"',
        },
      ],
      shipped.tokens,
      aliases,
    );
    const { problems } = checkUsage(scanned.usages, shipped.tokens);
    expect(problems.some((problem) => problem.includes('text-heat-3'))).toBe(true);
    expect(problems.some((problem) => problem.includes('bg-primary/90'))).toBe(true);
    expect(problems.some((problem) => problem.includes('disabled:'))).toBe(false);
    expect(problems.some((problem) => problem.includes('ring-destructive'))).toBe(false);
    expect(problems.some((problem) => problem.includes('muted-foreground'))).toBe(false);
  });
});
