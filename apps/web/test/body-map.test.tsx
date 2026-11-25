import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../src/i18n';
import { messages } from '../src/i18n/locales/en/messages.po';
import { BODY_MAP_ARTWORK, type BodyView } from '../src/ui/body-map/artwork.gen';
import { BodyMap } from '../src/ui/body-map/body-map';
import { BodyMapList } from '../src/ui/body-map/body-map-list';
import type { BodyMapMuscle, HeatBand, HeatStep } from '../src/ui/body-map/heat';
import { HeatLegend } from '../src/ui/body-map/heat-legend';
import { seriousViolations } from './harness';

/**
 * The body map (S-5; MAP-01, MAP-04, MAP-06; §8.11) in real Chromium at 360 × 780: names with
 * values and bands, one tab stop with arrow keys, heat steps and patterns, the view switch, the
 * small-region chips, the list alternative, axe in both themes, +30% strings, and the S-5
 * measurement of every region's tap target.
 */
const NAMES: Record<string, string> = {
  'mu.chest': 'Chest',
  'mu.front-delts': 'Front delts',
  'mu.side-delts': 'Side delts',
  'mu.elbow-flexors': 'Biceps',
  'mu.forearms': 'Forearms',
  'mu.abs': 'Abs',
  'mu.obliques': 'Obliques',
  'mu.quads': 'Quadriceps',
  'mu.adductors': 'Adductors',
  'mu.tibialis': 'Tibialis',
  'mu.upper-traps': 'Upper traps',
  'mu.mid-back': 'Mid back',
  'mu.lats': 'Lats',
  'mu.rear-delts': 'Rear delts',
  'mu.triceps': 'Triceps',
  'mu.lower-back': 'Lower back',
  'mu.glutes': 'Glutes',
  'mu.hamstrings': 'Hamstrings',
  'mu.calves': 'Calves',
};
const STEPS: Record<string, HeatStep> = {
  'mu.chest': 3,
  'mu.abs': 1,
  'mu.quads': 5,
  'mu.side-delts': 4,
  'mu.lats': 2,
  'mu.calves': 0,
};
const BANDS: readonly HeatBand[] = [
  { step: 0, label: 'No sets' },
  { step: 1, label: 'Below the floor' },
  { step: 2, label: 'Below target' },
  { step: 3, label: 'In target' },
  { step: 4, label: 'High' },
  { step: 5, label: 'Very high' },
];
const MUSCLES: Record<string, BodyMapMuscle> = Object.fromEntries(
  Object.entries(NAMES).map(([id, name], index) => [
    id,
    { name, step: STEPS[id] ?? 2, valueText: `${index + 2} sets` },
  ]),
);
const nameOf = (id: string) => {
  const muscle = MUSCLES[id]!;
  const band = BANDS.find((entry) => entry.step === muscle.step)!.label;
  return `${muscle.name}, ${muscle.valueText}, ${band}`;
};

function wrap(ui: ReactNode) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

function Selectable({ onSelect, view }: { onSelect?: (id: string) => void; view?: BodyView }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <BodyMap
      muscles={MUSCLES}
      bands={BANDS}
      selected={selected}
      {...(view ? { defaultView: view } : {})}
      onSelect={(id) => {
        setSelected(id);
        onSelect?.(id);
      }}
    />
  );
}

const regionButton = (id: string) => document.querySelector<SVGGElement>(`[data-region="${id}"]`)!;

describe('BodyMap', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('draws the front view 222 px wide with every display group a named button', () => {
    wrap(<Selectable />);
    const figure = screen.getByRole('group', { name: 'Front view, body map' });
    expect(Math.round(figure.getBoundingClientRect().width)).toBe(
      BODY_MAP_ARTWORK.reference.widthPx,
    );
    const front = BODY_MAP_ARTWORK.views.front.regions;
    expect(within(figure).getAllByRole('button')).toHaveLength(front.length);
    for (const region of front) {
      const button = within(figure).getByRole('button', { name: nameOf(region.muscleId) });
      expect(button.getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('has one tab stop and moves along the artwork neighbours with the arrow keys', async () => {
    const user = userEvent.setup();
    wrap(<Selectable />);
    const regions = BODY_MAP_ARTWORK.views.front.regions;
    const stops = document.querySelectorAll('[data-region][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0]!.getAttribute('data-region')).toBe(regions[0]!.id);
    // Focus order: the view switch (one stop), then the figure's one stop, then the chips.
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Front' }));
    await user.tab();
    expect(document.activeElement).toBe(regionButton(regions[0]!.id));
    // The focus ring is drawn (keyboard focus is :focus-visible).
    expect(document.querySelector('.stroke-focus')).not.toBeNull();

    let current = regions[0]!;
    for (const [key, direction] of [
      ['{ArrowDown}', 'down'],
      ['{ArrowDown}', 'down'],
      ['{ArrowUp}', 'up'],
      ['{ArrowLeft}', 'left'],
      ['{ArrowRight}', 'right'],
    ] as const) {
      const target = current.neighbours[direction] ?? current.id;
      await user.keyboard(key);
      expect(document.activeElement?.getAttribute('data-region')).toBe(target);
      current = regions.find((region) => region.id === target)!;
    }
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(regionButton(regions.at(-1)!.id));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(regionButton(regions[0]!.id));
    expect(document.querySelectorAll('[data-region][tabindex="0"]')).toHaveLength(1);
    await user.tab();
    expect(document.activeElement?.hasAttribute('data-chip')).toBe(true);
  });

  it('selects with Enter, Space and a tap, and shows the selection without colour alone', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(muscleId: string) => void>();
    wrap(<Selectable onSelect={onSelect} />);
    regionButton('front.chest').focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('mu.chest');
    expect(regionButton('front.chest').getAttribute('aria-pressed')).toBe('true');
    // A thick double outline (stroke-fg over stroke-bg) and the dot pattern.
    expect(document.querySelector('[aria-hidden="true"] .stroke-fg')).not.toBeNull();
    expect(regionButton('front.chest').querySelector('path[fill*="selected"]')).not.toBeNull();
    regionButton('front.abs').focus();
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenLastCalledWith('mu.abs');
    // A tap on the region itself, and one just outside it on its hit area (the gap around it).
    const shape = regionButton('front.quads').getBoundingClientRect();
    const inside = document.elementFromPoint(shape.x + shape.width / 4, shape.y + shape.height / 2);
    expect(inside?.closest('[data-region]')?.getAttribute('data-region')).toBe('front.quads');
    fireEvent.click(inside!);
    expect(onSelect).toHaveBeenLastCalledWith('mu.quads');
    expect(regionButton('front.quads').getAttribute('aria-pressed')).toBe('true');
    expect(regionButton('front.chest').getAttribute('aria-pressed')).toBe('false');
    const tibialis = regionButton('front.tibialis').getBoundingClientRect();
    const near = document.elementFromPoint(tibialis.right + 4, tibialis.y + tibialis.height / 2);
    expect(near?.getAttribute('data-hit')).toBe('front.tibialis');
    fireEvent.click(near!);
    expect(onSelect).toHaveBeenLastCalledWith('mu.tibialis');
  });

  it('colours each region by its heat step, with patterns on the extremes', () => {
    wrap(<Selectable />);
    const style = getComputedStyle(document.documentElement);
    for (const region of BODY_MAP_ARTWORK.views.front.regions) {
      const step = MUSCLES[region.muscleId]!.step!;
      const button = regionButton(region.id);
      expect(button.getAttribute('data-step')).toBe(String(step));
      const shape = button.querySelector('path')!;
      expect(shape.classList.contains(`fill-heat-${step}`)).toBe(true);
      // The fill resolves to the token of that step.
      const probe = document.createElement('div');
      probe.style.color = style.getPropertyValue(`--heat-${step}`);
      document.body.append(probe);
      expect(getComputedStyle(shape).fill).toBe(getComputedStyle(probe).color);
      probe.remove();
      const fills = [...button.querySelectorAll('path')].map((path) => path.getAttribute('fill'));
      expect(fills.some((fill) => fill?.includes('hatch'))).toBe(step === 1);
      expect(fills.some((fill) => fill?.includes('cross'))).toBe(step === 5);
    }
    // The legend repeats colour and pattern next to the words.
    const legend = wrap(<HeatLegend title="Hard sets this week" bands={BANDS} />);
    const list = within(legend.container).getByRole('list', { name: 'Hard sets this week' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(BANDS.map((band) => band.label));
    expect(list.querySelectorAll('rect[fill*="hatch"]')).toHaveLength(1);
    expect(list.querySelectorAll('rect[fill*="cross"]')).toHaveLength(1);
  });

  it('switches between front and back in one tap', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn<(view: BodyView) => void>();
    wrap(<BodyMap muscles={MUSCLES} bands={BANDS} onViewChange={onViewChange} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onViewChange).toHaveBeenCalledWith('back');
    const figure = screen.getByRole('group', { name: 'Back view, body map' });
    expect(within(figure).getAllByRole('button')).toHaveLength(
      BODY_MAP_ARTWORK.views.back.regions.length,
    );
    within(figure).getByRole('button', { name: nameOf('mu.lats') });
    // Side delts and forearms are on both sides.
    within(figure).getByRole('button', { name: nameOf('mu.side-delts') });
    expect(screen.queryByRole('group', { name: 'Front view, body map' })).toBeNull();
  });

  it('repeats the small regions as buttons below the figure, with the same names', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(muscleId: string) => void>();
    wrap(<Selectable onSelect={onSelect} />);
    for (const view of ['front', 'back'] as const) {
      if (view === 'back') await user.click(screen.getByRole('button', { name: 'Back' }));
      const small = BODY_MAP_ARTWORK.views[view].regions.filter((region) => region.small);
      const list = screen.getByRole('list', { name: 'Small on the figure, so also here:' });
      const chips = within(list).getAllByRole('button');
      expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual(
        small.map((region) => nameOf(region.muscleId)),
      );
      for (const chip of chips) {
        const box = chip.getBoundingClientRect();
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await user.click(chips[0]!);
      expect(onSelect).toHaveBeenLastCalledWith(small[0]!.muscleId);
      expect(chips[0]!.getAttribute('aria-pressed')).toBe('true');
    }
  });

  /*
   * S-5: the tap target of every region as the browser hit-tests it (hit areas, the gap clip and
   * the drawing order included): the largest square of CSS px where a tap lands on the region.
   * The pipeline flags a region small below 46 px (44 plus its raster margin); this proves that
   * no region the browser measures under 44 px goes without its chip, and that the pipeline's
   * numbers hold within 2 px.
   */
  it('measures every tap target at 360 × 780 and agrees with the small flags', async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <BodyMap muscles={MUSCLES} bands={BANDS} />
        {/* Room to scroll the whole figure into the viewport. */}
        <div className="h-dvh" />
      </>,
    );
    const problems: string[] = [];
    for (const view of ['front', 'back'] as const) {
      if (view === 'back') await user.click(screen.getByRole('button', { name: 'Back' }));
      const figure = document.querySelector<SVGSVGElement>(`svg[data-view="${view}"]`)!;
      // The app's scroll padding would keep the figure 4rem down: scroll it to the very top.
      window.scrollTo(0, window.scrollY + figure.getBoundingClientRect().top);
      const box = figure.getBoundingClientRect();
      const width = Math.ceil(box.width);
      const height = Math.ceil(box.height);
      expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
      const regions = BODY_MAP_ARTWORK.views[view].regions;
      const best = new Map(regions.map((region) => [region.id, 0]));
      const index = new Map(regions.map((region, i) => [region.id, i + 1]));
      const grid = new Uint8Array(width * height);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const element = document.elementFromPoint(box.left + x + 0.5, box.top + y + 0.5);
          const id =
            element?.closest('[data-region]')?.getAttribute('data-region') ??
            element?.closest('[data-hit]')?.getAttribute('data-hit');
          if (id) grid[y * width + x] = index.get(id)!;
        }
      // Largest square per region (dynamic programming over the hit-test grid).
      let previous = new Uint16Array(width);
      for (let y = 0; y < height; y++) {
        const current = new Uint16Array(width);
        for (let x = 0; x < width; x++) {
          const owner = grid[y * width + x]!;
          if (!owner) continue;
          const same = (yy: number, xx: number) =>
            yy >= 0 && xx >= 0 && grid[yy * width + xx] === owner;
          current[x] =
            same(y - 1, x) && same(y, x - 1) && same(y - 1, x - 1)
              ? Math.min(previous[x]!, current[x - 1]!, previous[x - 1]!) + 1
              : 1;
          const id = regions[owner - 1]!.id;
          best.set(id, Math.max(best.get(id)!, current[x]!));
        }
        previous = current;
      }
      for (const region of regions) {
        const measured = best.get(region.id)!;
        const line = `${region.id}: ${measured} px, pipeline ${region.targetPx}`;
        // Under 44 px without a chip, or the pipeline more than 2 px off: a problem.
        if (measured < BODY_MAP_ARTWORK.reference.minTargetPx && !region.small)
          problems.push(`${line}, no chip`);
        if (Math.abs(measured - region.targetPx) > 2) problems.push(`${line}, differs`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('BodyMapList (MAP-06)', () => {
  it('lists the same muscles front and back with the same names and selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(muscleId: string) => void>();
    function Both() {
      const [selected, setSelected] = useState<string | null>(null);
      const select = (id: string) => {
        setSelected(id);
        onSelect(id);
      };
      return (
        <>
          <BodyMap muscles={MUSCLES} bands={BANDS} selected={selected} onSelect={select} />
          <BodyMapList muscles={MUSCLES} bands={BANDS} selected={selected} onSelect={select} />
        </>
      );
    }
    wrap(<Both />);
    for (const view of ['Front', 'Back'] as const) {
      const section = screen.getByRole('region', { name: view });
      within(section).getByRole('heading', { level: 3, name: view });
      const regions = BODY_MAP_ARTWORK.views[view === 'Front' ? 'front' : 'back'].regions;
      expect(
        within(section)
          .getAllByRole('button')
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual(regions.map((region) => nameOf(region.muscleId)));
    }
    // The same names as the figure's regions.
    const figure = screen.getByRole('group', { name: 'Front view, body map' });
    for (const button of within(figure).getAllByRole('button'))
      expect(
        within(screen.getByRole('region', { name: 'Front' })).getByRole('button', {
          name: button.getAttribute('aria-label')!,
        }),
      ).toBeTruthy();
    const back = screen.getByRole('region', { name: 'Back' });
    await user.click(within(back).getByRole('button', { name: nameOf('mu.glutes') }));
    expect(onSelect).toHaveBeenLastCalledWith('mu.glutes');
    expect(
      within(back)
        .getByRole('button', { name: nameOf('mu.glutes') })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    // Visible text: name, value and band (the list is the text alternative).
    expect(within(back).getByRole('button', { name: nameOf('mu.glutes') }).textContent).toBe(
      'Glutes18 sets · Below target',
    );
  });
});

function All() {
  const [selected, setSelected] = useState<string | null>('mu.chest');
  return (
    <main>
      <h1>Body map</h1>
      <BodyMap muscles={MUSCLES} bands={BANDS} selected={selected} onSelect={setSelected} />
      <HeatLegend title="Hard sets this week" bands={BANDS} />
      <h2>As a list</h2>
      <BodyMapList muscles={MUSCLES} bands={BANDS} selected={selected} onSelect={setSelected} />
    </main>
  );
}

describe('body map accessibility', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  for (const theme of ['light', 'dark'] as const)
    it(`has no serious or critical axe violation (${theme})`, async () => {
      document.documentElement.setAttribute('data-theme', theme);
      const user = userEvent.setup();
      wrap(<All />);
      expect(await seriousViolations()).toEqual([]);
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(await seriousViolations()).toEqual([]);
    });
});

/** NFR-L10N-02: every literal part of every message 30% longer (as test/pseudo-locale.test.tsx). */
type Compiled = (typeof messages)[string];
function expand(text: string): string {
  if (text.trim() === '') return text;
  const extra = Math.ceil(text.length * 0.3);
  return `${text} ${Array.from({ length: Math.ceil(extra / 6) }, () => 'ẍàñđé').join(' ')}`;
}
function expandMessage(message: Compiled): Compiled {
  if (typeof message === 'string') return expand(message);
  if (Array.isArray(message))
    return message.map((part) => (typeof part === 'string' ? expand(part) : part)) as Compiled;
  return message;
}

function overflows(): string[] {
  const width = document.documentElement.clientWidth;
  const problems: string[] = [];
  if (document.documentElement.scrollWidth > width + 1)
    problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${width}`);
  for (const element of document.querySelectorAll<HTMLElement>('button, a, label, h1, h2, h3, p')) {
    if (element.classList.contains('sr-only')) continue;
    if (
      element.scrollWidth > element.clientWidth + 1 &&
      getComputedStyle(element).overflow !== 'visible'
    )
      problems.push(
        `clipped: ${element.tagName.toLowerCase()} "${element.textContent?.slice(0, 40)}"`,
      );
    if (element.getBoundingClientRect().right > width + 1)
      problems.push(
        `off-screen: ${element.tagName.toLowerCase()} "${element.textContent?.slice(0, 40)}"`,
      );
  }
  return problems;
}

describe('body map with +30% strings (NFR-L10N-02)', () => {
  beforeEach(() => {
    i18n.load(
      'en-x-expanded',
      Object.fromEntries(
        Object.entries(messages).map(([id, message]) => [id, expandMessage(message)]),
      ),
    );
    i18n.activate('en-x-expanded');
  });
  afterEach(() => {
    i18n.activate('en');
  });

  it('fits 360 px: the switch, the figure, the chips, the legend and the list', async () => {
    const user = userEvent.setup();
    const long = Object.fromEntries(
      Object.entries(MUSCLES).map(([id, muscle]) => [id, { ...muscle, name: expand(muscle.name) }]),
    );
    const bands = BANDS.map((band) => ({ ...band, label: expand(band.label) }));
    wrap(
      <div className="px-4">
        <BodyMap muscles={long} bands={bands} />
        <HeatLegend title={expand('Hard sets this week')} bands={bands} />
        <BodyMapList muscles={long} bands={bands} />
      </div>,
    );
    expect(document.body.textContent).toContain('ẍàñđé');
    expect(overflows()).toEqual([]);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^Back/ }));
    });
    expect(overflows()).toEqual([]);
  });
});
