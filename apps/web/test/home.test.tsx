import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { completeOnboarding } from '@powr/application/planning';
import { dispatch, finishWorkout, startWorkout } from '@powr/application/session';
import type { ExerciseId, SessionId } from '@powr/domain';

import type { Container } from '../src/app/container';
import {
  acknowledge,
  createTestContainer,
  onboarded,
  renderRoute,
  sampleAnswers,
  seriousViolations,
} from './harness';

/*
 * M4b: Home (ANL-01) with the streak (MOT-03), recent PRs, the next session and the mini heat
 * map; the streak screen with its fairness rules and a week marked as a break (MOT-04); the
 * summary's week heat map and streak change (WKT-13); Settings → Insights and "Verify data".
 */

const BENCH = 'ex.barbell-bench-press' as ExerciseId;

/** A finished freestyle session with one bench-press set, through the real use cases. */
async function benchSession(
  container: Container,
  load: number,
  reps: number,
  rir: number,
): Promise<SessionId> {
  const started = await startWorkout(container.deps, {
    source: { kind: 'freestyle', exerciseIds: [BENCH] },
    warmups: false,
  });
  if (!started.ok) throw new Error(`start: ${started.error.kind}`);
  const cursor = started.value.view.session.cursor;
  if (!cursor) throw new Error('no cursor');
  const confirmed = await dispatch(container.deps, {
    type: 'CONFIRM_SET',
    slotKey: cursor.slotKey,
    setKey: cursor.setKey,
    values: { load: { value: load, unit: 'kg' }, reps, rir },
  });
  if (!confirmed.ok) throw new Error(`confirm: ${confirmed.error.kind}`);
  const finished = await finishWorkout(container.deps, { as: 'finished' });
  if (!finished.ok) throw new Error(`finish: ${finished.error.kind}`);
  return started.value.view.session.id;
}

describe('Home (ANL-01, MOT-03)', () => {
  it('shows the next session, this week with the streak and the mini heat map, and recent PRs', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchSession(container, 80, 5, 2);
    await benchSession(container, 100, 5, 2);
    renderRoute(container, '/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeTruthy();
    expect(await screen.findByTestId('next-session')).toBeTruthy();
    const progress = await screen.findByTestId('week-progress', {}, { timeout: 5000 });
    expect(progress.textContent).toMatch(/\d+ of \d+ sessions?/);
    await waitFor(() => expect(screen.getByTestId('home-streak').textContent).toMatch(/best/));
    const prs = await screen.findByTestId('home-prs');
    expect(prs.textContent).toContain('New rep PR on Barbell bench press: 100 kg for 5');
    // The mini heat map is a lazy chunk; its words are there at once.
    expect(screen.getByTestId('home-heat-summary').textContent).toMatch(
      /muscles? (in|below) your target/,
    );
    expect(await screen.findByTestId('mini-heat-map')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the body map' }).getAttribute('href')).toBe(
      '/explore/body-map',
    );
    expect(screen.getByRole('link', { name: 'Log bodyweight' }).getAttribute('href')).toBe(
      '/body/log',
    );
    // Recent workouts and no backup yet: the backup indicator (DAT-08) shows.
    expect(screen.getByRole('heading', { name: 'Back up your training' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('home-status').textContent).toBe(''));
    expect(await seriousViolations()).toEqual([]);
  });

  it('offers a freestyle start and the way to a plan without a plan (PLN-15)', async () => {
    const container = await createTestContainer();
    await acknowledge(container);
    const result = await completeOnboarding(container.deps, {
      answers: sampleAnswers(container),
      preview: null,
    });
    if (!result.ok) throw new Error('onboarding');
    renderRoute(container, '/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Plan not set up' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start a workout' }).getAttribute('href')).toBe(
      '/session',
    );
    expect(await screen.findByText(/Log your bodyweight to see its trend/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Restore from a backup' })).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('weekly streak (MOT-03/04)', () => {
  it('explains the rules, lists the weeks and marks a week as a break', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchSession(container, 80, 5, 2);
    const user = userEvent.setup();
    renderRoute(container, '/progress/streak');

    expect(await screen.findByRole('heading', { level: 1, name: 'Weekly streak' })).toBeTruthy();
    expect(await screen.findByTestId('streak-current')).toBeTruthy();
    expect(screen.getByTestId('streak-best')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'How your streak works' })).toBeTruthy();
    expect(screen.getByText(/Your best streak always stays/)).toBeTruthy();
    const weeks = screen.getByTestId('streak-weeks');
    expect(within(weeks).getAllByRole('listitem').length).toBeGreaterThan(0);
    // Before the plan's first week, one session keeps a week (MOT-03); else it is in progress.
    expect(weeks.textContent).toMatch(/Kept|In progress/);
    expect(await seriousViolations()).toEqual([]);

    // MOT-04: the current week as a break (illness).
    await user.click(screen.getByRole('button', { name: 'Mark as a break' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Choose a week and a reason');
    const weekGroup = screen.getByRole('radiogroup', { name: 'Which week?' });
    await user.click(within(weekGroup).getAllByRole('radio')[0]!);
    await user.click(screen.getByRole('radio', { name: 'Illness' }));
    await user.click(screen.getByRole('button', { name: 'Mark as a break' }));
    expect(await screen.findByTestId('break-marked')).toBeTruthy();
    await waitFor(() =>
      expect(
        within(screen.getByTestId('streak-weeks')).getByText(/Paused for a break/),
      ).toBeTruthy(),
    );
  });
});

describe('workout summary with the week and the streak (WKT-13, TD-43)', () => {
  it('shows the week heat map and what the workout did to the streak', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await container.platform.timers.load();
    const id = await benchSession(container, 80, 5, 2);
    renderRoute(container, `/session/summary/${id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Workout summary' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Your week so far' })).toBeTruthy();
    expect((await screen.findByTestId('summary-heat-summary')).textContent).toMatch(
      /muscles? (in|below) your target/,
    );
    expect(await screen.findByTestId('mini-heat-map')).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('Settings → Insights and Data → Verify data', () => {
  it('saves the streak grace and the measurement sites', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const user = userEvent.setup();
    renderRoute(container, '/settings');
    const grace = await screen.findByRole('checkbox', {
      name: /Grace: a week with one session short still counts/,
    });
    expect(grace.getAttribute('aria-checked')).toBe('false');
    await user.click(grace);
    await waitFor(() => expect(grace.getAttribute('aria-checked')).toBe('true'));
    const skinfold = screen.getByRole('checkbox', { name: 'Skinfold, triceps' });
    await user.click(skinfold);
    await waitFor(() => expect(skinfold.getAttribute('aria-checked')).toBe('true'));
    const settings = await container.deps.uow.read(['settings'], (repos) => repos.settings.get());
    expect(settings?.insights?.streakGrace).toBe(true);
    expect(settings?.insights?.measurementSites).toContain('skinfoldTriceps');
    // The clicks scrolled the rows under the sticky header; axe measures what is on screen.
    window.scrollTo(0, 0);
    expect(await seriousViolations()).toEqual([]);
  });

  it('rebuilds the derived weeks and the streak on "Verify data"', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchSession(container, 80, 5, 2);
    const user = userEvent.setup();
    renderRoute(container, '/data');
    await user.click(await screen.findByRole('button', { name: 'Verify data' }));
    await waitFor(
      () => expect(screen.getByTestId('verify-status').textContent).toMatch(/^Done: \d+ weeks?/),
      { timeout: 5000 },
    );
    expect(await seriousViolations()).toEqual([]);
  });
});
