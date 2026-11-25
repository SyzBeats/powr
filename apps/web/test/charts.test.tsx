import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent as browserEvent } from 'vitest/browser';

import { i18n } from '../src/i18n';
import { messages } from '../src/i18n/locales/en/messages.po';
import type { HeatStep } from '../src/ui/body-map/heat';
import { BodyweightChart } from '../src/ui/charts/bodyweight-chart';
import { dayMs, presetWindow, shiftWindow } from '../src/ui/charts/range';
import { TrainingCalendar } from '../src/ui/charts/training-calendar';
import { TrendChart, type TrendSeries } from '../src/ui/charts/trend-chart';
import { VolumeChart, type VolumeWeek } from '../src/ui/charts/volume-chart';
import { seriousViolations } from './harness';

/**
 * The S-4 chart building blocks (ANL-02, 03, 06, 11; BOD-02; NFR-A11Y-05/06/10) with synthetic
 * data: the summary, the table view, the point slider (keyboard and screen readers), the tap
 * readout on the real ECharts canvas, the range chips, axe in both themes and +30% strings.
 */
const wrap = (ui: ReactNode) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
const DAY = 86_400_000;
const day = (offset: number) =>
  new Date(dayMs('2026-11-20') + offset * DAY).toISOString().slice(0, 10);

/** 120 sessions every other day up to 2026-11-20, a trend with a band, two PRs, one change. */
const squat: TrendSeries = {
  name: 'Back squat',
  points: Array.from({ length: 120 }, (_, index) => ({
    date: day((index - 119) * 2),
    value: 100 + index * 0.25 + (index % 3) - 1,
  })),
  trend: Array.from({ length: 120 }, (_, index) => ({
    date: day((index - 119) * 2),
    value: 100 + index * 0.25,
    low: 97 + index * 0.25,
    high: 103 + index * 0.25,
  })),
  markers: [
    { date: day(-10), kind: 'pr', label: 'PR: 128 kg' },
    { date: day(0), kind: 'likely', label: '+4%, likely real' },
  ],
};
const SERIES = [squat];
const kg = (value: number) => `${value.toFixed(1)} kg`;

afterEach(() => {
  delete document.documentElement.dataset['theme'];
});

describe('range windows', () => {
  it('maps presets to windows that end on the newest day, and back', () => {
    const start = dayMs('2022-01-01');
    const end = dayMs('2026-11-20');
    const fourWeeks = presetWindow('4w', start, end);
    expect((fourWeeks.to - fourWeeks.from) / DAY).toBe(27);
    expect(fourWeeks.to).toBe(end);
    expect(presetWindow('6m', start, end).from).toBe(dayMs('2026-05-21'));
    expect(presetWindow('all', start, end)).toEqual({ from: start, to: end });
    const earlier = shiftWindow(fourWeeks, -1, start, end);
    expect(earlier.to - earlier.from).toBe(fourWeeks.to - fourWeeks.from);
    expect(earlier.to).toBe(fourWeeks.from);
    // Clamped to the data at both ends.
    expect(shiftWindow(presetWindow('all', start, end), -1, start, end).from).toBe(start);
    expect(shiftWindow(fourWeeks, 1, start, end)).toEqual(fourWeeks);
  });
});

describe('TrendChart (ANL-02, ANL-11)', () => {
  it('names the chart, summarises it, and lists the visible points in a table', async () => {
    wrap(
      <TrendChart
        title="Squat e1RM"
        summary="Squat e1RM rose 4% over 12 weeks."
        series={SERIES}
        unit="kg"
        formatValue={kg}
      />,
    );
    const section = screen.getByRole('region', { name: 'Squat e1RM' });
    expect(within(section).getByText('Squat e1RM rose 4% over 12 weeks.')).toBeTruthy();
    // Legend in words: line, points, band, PR and the change marker.
    const legend = within(section).getByRole('list', { name: 'Legend' });
    for (const label of ['Trend', 'Each workout', '95% range', 'PR', 'Likely real change'])
      expect(within(legend).getByText(label)).toBeTruthy();
    // 12 weeks are the default range: 42 sessions every other day, newest first, 30 per page.
    await userEvent.click(within(section).getByRole('button', { name: 'View as table' }));
    const table = within(section).getByRole('table');
    expect(within(table).getByText(/Squat e1RM, 12 wks?, newest first/)).toBeTruthy();
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(31);
    expect(
      within(rows[1]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['130.8 kg', '129.8 kg', '126.8 kg to 132.8 kg', '+4%, likely real']);
    await userEvent.click(within(section).getByRole('button', { name: 'Show 12 more rows' }));
    expect(within(table).getAllByRole('row')).toHaveLength(43);
    // The canvas comes from the lazy ECharts chunk.
    await waitFor(() => expect(section.querySelector('[data-chart-ready]')).not.toBeNull());
    await waitFor(() => expect(section.querySelector('canvas')).not.toBeNull());
  });

  it('moves through the points with the keyboard; the slider speaks the readout', async () => {
    const onOpen = vi.fn<(date: string) => void>();
    wrap(
      <TrendChart
        title="Squat e1RM"
        summary="Rising."
        series={SERIES}
        unit="kg"
        formatValue={kg}
        onOpen={onOpen}
        openLabel="Show the sets"
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Points of Squat e1RM' });
    const readout = screen.getByTestId('chart-readout');
    expect(readout.textContent).toMatch(/Tap the chart or use the arrow keys/);
    await userEvent.tab();
    // Tab order: the range chips first, then the slider.
    while (document.activeElement !== slider) await userEvent.tab();
    expect(readout.textContent).toMatch(
      /130\.8 kg · trend 129\.8 kg · 95% range .* · \+4%, likely real/,
    );
    expect(slider.getAttribute('aria-valuetext')).toBe(
      within(readout).getByText(/130\.8 kg/).textContent,
    );
    await browserEvent.keyboard('{ArrowLeft}');
    expect(slider.getAttribute('aria-valuetext')).toMatch(/129\.5 kg · trend 129\.5 kg/);
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith(day(-2));
    await userEvent.click(screen.getByRole('button', { name: 'Show the sets' }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    // Home goes to the oldest point and moves the window with it.
    slider.focus();
    await browserEvent.keyboard('{Home}');
    expect(slider.getAttribute('aria-valuetext')).toMatch(/^\w+, (Mar 27|27 Mar) · 99\.0 kg/);
    expect(within(screen.getByTestId('chart-readout')).getByText(/99\.0 kg/).textContent).toBe(
      slider.getAttribute('aria-valuetext'),
    );
    expect(screen.getByRole('button', { name: 'Earlier' }).hasAttribute('disabled')).toBe(true);
  });

  it('range chips and Earlier/Later change the window; a tap on the plot shows a point', async () => {
    wrap(<TrendChart title="Squat e1RM" summary="Rising." series={SERIES} unit="kg" />);
    const all = screen.getByRole('button', { name: 'All' });
    await userEvent.click(all);
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Earlier' }).hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /^4 wks?$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Earlier' }));
    // A moved window matches no preset.
    expect(screen.queryAllByRole('button', { pressed: true })).toEqual([]);
    const section = screen.getByRole('region', { name: 'Squat e1RM' });
    await waitFor(() => expect(section.querySelector('[data-chart-ready]')).not.toBeNull());
    const canvas = section.querySelector('canvas')!;
    const box = canvas.getBoundingClientRect();
    await browserEvent.click(canvas, {
      position: { x: Math.round(box.width * 0.5), y: Math.round(box.height * 0.5) },
    });
    await waitFor(() =>
      expect(screen.getByTestId('chart-readout').textContent).toMatch(/\d+(\.\d)? · trend/),
    );
  });

  it('compares up to three series with their names in the legend and the table', async () => {
    const other = (name: string, shift: number): TrendSeries => ({
      name,
      points: squat.points.map((point) => ({ ...point, value: point.value + shift })),
      trend: squat.trend!.map((point) => ({ date: point.date, value: point.value + shift })),
    });
    wrap(
      <TrendChart
        title="Lifts compared"
        summary="All three rose."
        series={[squat, other('Bench press', -30), other('Deadlift', 40), other('Ignored', 1)]}
        unit="%"
      />,
    );
    const legend = screen.getByRole('list', { name: 'Legend' });
    const items = within(legend)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(items.slice(0, 3)).toEqual(['Back squat', 'Bench press', 'Deadlift']);
    expect(items).not.toContain('Ignored');
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Date',
      'Back squat',
      'Bench press',
      'Deadlift',
    ]);
  });

  it('shows the empty text without data', () => {
    wrap(<TrendChart title="Squat e1RM" summary="No data." series={[]} unit="kg" />);
    expect(screen.getByText('Nothing logged yet.')).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});

const volume: VolumeWeek[] = Array.from({ length: 30 }, (_, index) => {
  const sets = [0, 2, 8, 14, 24, 33][index % 6]!;
  return {
    week: day((index - 29) * 7),
    sets,
    direct: Math.round(sets * 0.6),
    step: (index % 6) as HeatStep,
  };
});
const bands = [
  { step: 0, label: 'None' },
  { step: 1, label: 'Below 4 sets' },
  { step: 2, label: 'Below target' },
  { step: 3, label: 'In target' },
  { step: 4, label: 'High' },
  { step: 5, label: 'Very high' },
] as const;

describe('VolumeChart (ANL-03)', () => {
  it('names each band in the legend, the readout and the table', async () => {
    wrap(
      <VolumeChart
        title="Chest: weekly hard sets"
        summary="In target in 4 of the last 12 weeks."
        weeks={volume}
        target={{ low: 10, high: 20 }}
        bands={bands}
      />,
    );
    const legend = screen.getByRole('list', { name: 'Legend' });
    for (const label of [...bands.map((band) => band.label), 'Direct sets', 'Target 10 to 20'])
      expect(within(legend).getByText(label)).toBeTruthy();
    const slider = screen.getByRole('slider', { name: 'Points of Chest: weekly hard sets' });
    slider.focus();
    await waitFor(() => expect(slider.getAttribute('aria-valuetext')).toMatch(/^Week of /));
    expect(slider.getAttribute('aria-valuetext')).toMatch(/33 sets \(20 direct\) · Very high$/);
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    const firstRow = within(screen.getByRole('table')).getAllByRole('row')[1]!;
    expect(
      within(firstRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['33', '20', 'Very high']);
  });
});

describe('BodyweightChart (BOD-02)', () => {
  it('draws the trend with the weigh-ins de-emphasised and names both', async () => {
    const entries = Array.from({ length: 60 }, (_, index) => ({
      date: day(index - 59),
      value: 80 + (index % 5) * 0.2,
    }));
    const trend = entries.map((entry, index) => ({
      date: entry.date,
      value: 80.4 + index * 0.001,
    }));
    wrap(
      <BodyweightChart
        title="Bodyweight"
        summary="Steady over the last 4 weeks."
        entries={entries}
        trend={trend}
        unit="kg"
        defaultRange="4w"
      />,
    );
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getByText('Trend')).toBeTruthy();
    expect(within(legend).getByText('Weigh-ins')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(29);
  });
});

describe('TrainingCalendar (ANL-06)', () => {
  it('names every day with its status, marks today and moves between months', async () => {
    const onDay = vi.fn<(date: string) => void>();
    const onMonth = vi.fn<(month: string) => void>();
    wrap(
      <TrainingCalendar
        title="Training calendar"
        summary="3 workouts, 1 missed."
        month="2026-11"
        weekStart={1}
        today="2026-11-20"
        days={[
          { date: '2026-11-02', status: 'completed', label: 'Upper A' },
          { date: '2026-11-04', status: 'missed' },
          { date: '2026-11-09', status: 'deload' },
          { date: '2026-11-23', status: 'planned', label: 'Lower B' },
        ]}
        onDaySelect={onDay}
        onMonthChange={onMonth}
      />,
    );
    const table = screen.getByRole('table', { name: /Training calendar, November 2026/ });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers[0]!.textContent).toBe('Mon');
    await userEvent.click(
      within(table).getByRole('button', {
        name: /^Monday, (2 November|November 2): Completed, Upper A$/,
      }),
    );
    expect(onDay).toHaveBeenCalledWith('2026-11-02');
    expect(
      within(table).getByRole('button', { name: /^Wednesday, (4 November|November 4): Missed$/ }),
    ).toBeTruthy();
    expect(table.querySelector('[aria-current="date"]')?.textContent).toContain('20');
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onMonth).toHaveBeenCalledWith('2026-12');
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Completed', 'Missed', 'Planned', 'Lighter week']);
  });

  it('starts the week on the given day (SET-11)', () => {
    wrap(
      <TrainingCalendar
        title="Calendar"
        summary="Nothing yet."
        month="2026-11"
        weekStart={7}
        days={[]}
      />,
    );
    expect(screen.getAllByRole('columnheader')[0]!.textContent).toBe('Sun');
    // November 2026 starts on a Sunday: no blank cell before the 1st.
    const firstWeek = screen.getAllByRole('row')[1]!;
    expect(within(firstWeek).getAllByRole('cell')[0]!.textContent).toContain('1');
    expect(screen.getByText('No workouts this month.')).toBeTruthy();
  });
});

/** Like test/pseudo-locale.test.tsx: every literal part 30% longer (NFR-L10N-02). */
function expand(text: string): string {
  if (text.trim() === '') return text;
  const words = Array.from({ length: Math.ceil((text.length * 0.3) / 6) }, () => 'ẍàñđé');
  return `${text} ${words.join(' ')}`;
}

function AllCharts() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <TrendChart title="Squat e1RM" summary="Rising." series={SERIES} unit="kg" formatValue={kg} />
      <VolumeChart
        title="Chest"
        summary="Mostly in target."
        weeks={volume}
        target={{ low: 10, high: 20 }}
        bands={bands}
      />
      <TrainingCalendar
        title="Calendar"
        summary="Three workouts."
        month="2026-11"
        weekStart={1}
        today="2026-11-20"
        days={[{ date: '2026-11-02', status: 'completed', label: 'Upper A' }]}
        onDaySelect={() => undefined}
        onMonthChange={() => undefined}
      />
    </main>
  );
}

describe('accessibility and layout', () => {
  it('passes axe in light and dark, with the tables open', async () => {
    wrap(<AllCharts />);
    for (const button of screen.getAllByRole('button', { name: 'View as table' }))
      await userEvent.click(button);
    await waitFor(() => expect(document.querySelectorAll('[data-chart-ready]')).toHaveLength(2));
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset['theme'] = theme;
      expect({ theme, violations: await seriousViolations() }).toEqual({ theme, violations: [] });
    }
  });

  it('fits 360 px with 30% longer strings (NFR-L10N-02)', async () => {
    const expanded: typeof messages = Object.fromEntries(
      Object.entries(messages).map(([id, message]) => [
        id,
        typeof message === 'string'
          ? expand(message)
          : Array.isArray(message)
            ? message.map((part) => (typeof part === 'string' ? expand(part) : part))
            : message,
      ]),
    );
    i18n.load('en-x-expanded', expanded);
    i18n.activate('en-x-expanded');
    try {
      wrap(<AllCharts />);
      for (const button of screen.getAllByRole('button', { name: /View as table/ }))
        await userEvent.click(button);
      expect(document.body.textContent).toContain('ẍàñđé');
      const width = document.documentElement.clientWidth;
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
      const clipped = [...document.querySelectorAll<HTMLElement>('button, h2, th, li')]
        .filter(
          (element) =>
            element.getBoundingClientRect().right > width + 1 ||
            (element.scrollWidth > element.clientWidth + 1 &&
              getComputedStyle(element).overflow !== 'visible'),
        )
        .map((element) => element.textContent?.slice(0, 40));
      expect(clipped).toEqual([]);
    } finally {
      i18n.activate('en');
    }
  });
});
