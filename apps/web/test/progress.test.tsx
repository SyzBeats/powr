import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  exerciseHistory,
  exerciseSummaries,
  exerciseTrend,
  weeklyVolume,
} from '@powr/application/insights';
import { logPastSession } from '@powr/application/session';
import type { ExerciseId, LocalDate } from '@powr/domain';

import type { Container } from '../src/app/container';
import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/*
 * M4b Progress tab (ANL-02…07, ANL-11): the hub, an exercise's e1RM trend with its table view and
 * history, the volume table with a muscle's drill-down (the same numbers as the weekly volume use
 * case, ANL-03 "one calculation"), the PR history filter, the calendar's session search and the
 * scores' missing inputs; axe on each.
 */

const BENCH = 'ex.barbell-bench-press' as ExerciseId;
const SQUAT = 'ex.barbell-back-squat' as ExerciseId;
const CURL = 'ex.dumbbell-curl' as ExerciseId;

const pad = (value: number) => String(value).padStart(2, '0');

/** A device-calendar day `offset` days from today. */
function day(offset: number): LocalDate {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as LocalDate;
}

/** A backdated workout of three sets of 5 at RIR 2 (heavy sets: they feed the strength trend). */
async function logPast(
  container: Container,
  offset: number,
  exerciseId: ExerciseId,
  load: number,
  note?: string,
): Promise<void> {
  const result = await logPastSession(container.deps, {
    localDate: day(offset),
    exercises: [
      {
        exerciseId,
        sets: [1, 2, 3].map(() => ({
          load: { value: load, unit: 'kg' as const },
          reps: 5,
          rir: 2,
        })),
      },
    ],
    ...(note ? { note } : {}),
  });
  if (!result.ok) throw new Error(`log: ${JSON.stringify(result.error)}`);
}

/** Six weekly bench sessions, 80 → 92.5 kg. */
async function benchHistory(container: Container): Promise<void> {
  for (const [index, load] of [80, 82.5, 85, 87.5, 90, 92.5].entries()) {
    await logPast(container, -42 + index * 7, BENCH, load);
  }
}

describe('Progress tab (M4b)', () => {
  it('the hub lists the trained exercises and every analytics screen, Past workouts included', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await logPast(container, -3, BENCH, 80);
    renderRoute(container, '/progress');
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Progress sections' });
    for (const name of [
      /Volume per muscle/,
      /Personal records/,
      /Calendar and history/,
      /Compare lifts/,
      /Weekly streak/,
      /Bodyweight and measurements/,
      /Powerlifting scores/,
      /Past workouts/,
    ]) {
      expect(within(nav).getByRole('link', { name })).toBeTruthy();
    }
    const trained = await screen.findByTestId('trained-exercises');
    const bench = within(trained).getByRole('link', { name: /Barbell bench press/ });
    expect(bench.getAttribute('href')).toBe(`/progress/exercise/${BENCH}`);
    expect(bench.textContent).toContain('1 workout');
    expect(await seriousViolations()).toEqual([]);
  });

  it('the hub shows each exercise’s current e1RM and the trend screen’s latest label (TD-55)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    // Eight weeks, so the trend has a reference point and the label is not "not enough data".
    await logPast(container, -56, BENCH, 75);
    await logPast(container, -49, BENCH, 77.5);
    await benchHistory(container);
    await logPastSession(container.deps, {
      localDate: day(-2),
      exercises: [
        {
          exerciseId: CURL,
          sets: [{ load: { value: 12, unit: 'kg' as const }, reps: 10, rir: null }],
        },
      ],
    });
    const [benchSummary] = await exerciseSummaries(container.deps, { exerciseIds: [BENCH] });
    const history = await exerciseHistory(container.deps, BENCH);
    const trend = await exerciseTrend(container.deps, { exerciseId: BENCH });
    // The hub's numbers are the trend screen's numbers.
    expect(benchSummary!.e1rm?.kg).toBe(history!.e1rm.strengthKg ?? history!.e1rm.allKg);
    expect(benchSummary!.change).toEqual(trend.series.latest);

    renderRoute(container, '/progress');
    const trained = await screen.findByTestId('trained-exercises');
    const bench = within(trained).getByRole('link', { name: /Barbell bench press/ });
    expect(bench.textContent).toContain('8 workouts');
    expect(trend.series.latest?.value.label).not.toBe('insufficientData');
    const kg = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
      Math.round(benchSummary!.e1rm!.kg * 10) / 10,
    );
    expect(within(bench).getByTestId('trained-e1rm').textContent).toContain(
      `Estimated 1-rep max ${kg} kg`,
    );
    // The label in words, never colour alone.
    const label = within(bench).getByTestId('trained-change').textContent;
    expect(label).toMatch(
      /^(Not enough workouts yet to tell a real change|Within normal day-to-day variation|More than normal day-to-day variation, not confirmed yet|(Very likely|Likely) a real (gain|drop))$/,
    );
    // Curls logged without an effort rating: an all-sets estimate only, still calibrating, and no
    // strength trend to call a change from.
    const [curlSummary] = await exerciseSummaries(container.deps, { exerciseIds: [CURL] });
    expect(curlSummary!.e1rm?.source).toBe('all');
    expect(curlSummary!.change).toBeNull();
    const curl = within(trained).getByRole('link', { name: /Dumbbell curl/ });
    expect(within(curl).getByTestId('trained-e1rm').textContent).toMatch(
      /^Estimated 1-rep max [\d.,]+ kg, still calibrating$/,
    );
    expect(within(curl).getByTestId('trained-change').textContent).toBe(
      'Not enough workouts yet to tell a real change',
    );
    expect(await seriousViolations()).toEqual([]);

    // Opening the row shows the same label as "Latest change".
    await userEvent.click(bench);
    const latest = await screen.findByText(/^Latest change: /);
    expect(latest.textContent).toBe(`Latest change: ${label}`);
  });

  it('an exercise trend: summary in words, table view, rep maxes and sessions (ANL-02, ANL-04)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchHistory(container);
    renderRoute(container, `/progress/exercise/${BENCH}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Barbell bench press progress' }),
    ).toBeTruthy();
    const chart = await screen.findByRole('region', { name: 'Estimated 1-rep max' });
    // The one-sentence summary names the exercise, the range and the PRG-02 label in words.
    expect(chart.textContent).toMatch(
      /Barbell bench press: [\d.]+ kg → [\d.]+ kg estimated 1-rep max over \d+ weeks \([+−]?[\d.]+%\)\./,
    );
    await userEvent.click(within(chart).getByRole('button', { name: 'View as table' }));
    const table = within(chart).getByRole('table');
    expect(within(table).getByText(/Estimated 1-rep max, 12 wks?, newest first/)).toBeTruthy();
    // Six sessions in the 12-week window, newest first, one header row.
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(7);
    expect(rows[1]!.textContent).toMatch(/kg/);
    // PR markers are named in the table's notes.
    expect(table.textContent).toMatch(/PR: /);

    // Heavy sets / all sets is a choice (PRG-02 source).
    expect(screen.getByRole('button', { name: 'Heavy sets', pressed: true })).toBeTruthy();

    const repMax = await screen.findByTestId('rep-max-table');
    expect(within(repMax).getByRole('rowheader', { name: '5' })).toBeTruthy();
    expect(within(repMax).getByRole('rowheader', { name: '12+' })).toBeTruthy();
    expect(repMax.textContent).toMatch(/92\.5 kg\s*× 5, RIR 2/);
    const sessions = await screen.findByTestId('exercise-sessions');
    expect(within(sessions).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    expect(await seriousViolations()).toEqual([]);
  });

  it('volume per muscle: the table equals the weekly volume, a muscle shows its exercises (ANL-03)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await logPast(container, 0, BENCH, 80);
    const expected = await weeklyVolume(container.deps, { mode: 'week' });
    const chest = expected.rows.find((row) => row.muscle === 'mu.chest')!;
    expect(chest.fractional).toBeGreaterThan(0);

    renderRoute(container, '/progress/volume');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Volume per muscle' }),
    ).toBeTruthy();
    const table = await screen.findByTestId('volume-table');
    expect(within(table).getByText('Hard sets per muscle this week')).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(expected.rows.length + 1);
    const chestButton = within(table).getByRole('button', { name: 'Chest' });
    const chestRow = chestButton.closest('tr')!;
    expect(chestRow.textContent).toContain(String(chest.fractional));
    expect(chestRow.textContent).toMatch(/Below the floor|Below your target|In your target|High/);

    await userEvent.click(chestButton);
    const detail = await screen.findByTestId('volume-muscle');
    await waitFor(() =>
      expect(document.activeElement).toBe(within(detail).getByRole('heading', { name: 'Chest' })),
    );
    const contributors = within(detail).getByTestId('volume-contributors');
    expect(contributors.textContent).toContain('Barbell bench press');
    expect(
      await within(detail).findByRole('region', { name: 'Chest: hard sets per week' }),
    ).toBeTruthy();
    expect(chestButton.getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'Last week' }));
    await waitFor(() =>
      expect(screen.getByTestId('volume-table').textContent).toContain(
        'Hard sets per muscle last week',
      ),
    );
    expect(await seriousViolations()).toEqual([]);
  });

  it('PR history filters by type and opens the workout (ANL-05)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchHistory(container);
    renderRoute(container, '/progress/prs');
    expect(await screen.findByRole('heading', { level: 1, name: 'Personal records' })).toBeTruthy();
    const list = await screen.findByTestId('pr-list');
    expect(within(list).getAllByRole('link').length).toBeGreaterThan(1);
    await userEvent.click(screen.getByRole('button', { name: 'Heaviest weight' }));
    await waitFor(() => {
      const links = within(screen.getByTestId('pr-list')).getAllByRole('link');
      for (const link of links) expect(link.textContent).toContain('New heaviest weight');
    });
    const newest = within(screen.getByTestId('pr-list')).getAllByRole('link')[0]!;
    expect(newest.textContent).toContain('92.5 kg');
    expect(newest.getAttribute('href')).toMatch(/^\/session\/summary\//);
    expect(await seriousViolations()).toEqual([]);
  });

  it('the calendar marks workouts and the list searches names and notes (ANL-06)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await logPast(container, -1, BENCH, 80, 'Felt strong');
    await logPast(container, -2, SQUAT, 100);
    renderRoute(container, '/progress/calendar');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Calendar and history' }),
    ).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Training calendar' })).toBeTruthy();
    const count = await screen.findByTestId('session-count');
    expect(count.textContent).toBe('2 workouts in the last 12 months');
    await userEvent.type(screen.getByRole('searchbox', { name: /Search workouts/ }), 'squat');
    await waitFor(() =>
      expect(screen.getByTestId('session-count').textContent).toBe(
        '1 workout in the last 12 months',
      ),
    );
    expect(screen.getByTestId('session-list').textContent).toContain('Barbell back squat');
    await userEvent.clear(screen.getByRole('searchbox', { name: /Search workouts/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: /Search workouts/ }), 'strong');
    await waitFor(() =>
      expect(screen.getByTestId('session-list').textContent).toContain('Felt strong'),
    );
    expect(await seriousViolations()).toEqual([]);
  });

  it('scores say what they still need (ANL-07)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/progress/scores');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Powerlifting scores' }),
    ).toBeTruthy();
    expect(await screen.findByText('What the scores still need')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log your bodyweight' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'IPF GL Points' })).toBeTruthy();
    expect(screen.getByText('ipf-gl-2020')).toBeTruthy();
    expect(screen.getAllByText('Legacy')).toHaveLength(2);
    expect(await seriousViolations()).toEqual([]);
  });
});
