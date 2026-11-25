import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { dispatch, finishWorkout, startWorkout } from '@powr/application/session';
import type { ExerciseId } from '@powr/domain';

import type { Container } from '../src/app/container';
import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/*
 * M4b body map (MAP-01…07): the muscle panel (sets against the target with "Why?", the
 * contributing exercises, the sub-regions, the ranked list with its sort and "Why?", add to
 * today) and the list alternative of the map (MAP-06), on a real IndexedDB with the built-in
 * content and rules.
 */

const BENCH = 'ex.barbell-bench-press' as ExerciseId;

/** A finished freestyle bench-press session with `sets` hard sets (this week's chest volume). */
async function benchSession(container: Container, sets: number): Promise<void> {
  const started = await startWorkout(container.deps, {
    source: { kind: 'freestyle', exerciseIds: [BENCH] },
    warmups: false,
  });
  if (!started.ok) throw new Error(`start: ${started.error.kind}`);
  for (let index = 0; index < sets; index++) {
    const view = index === 0 ? started.value.view : null;
    const cursor =
      view?.session.cursor ??
      (await container.deps.uow.read(['sessions'], (repos) => repos.sessions.getActive()))?.cursor;
    if (!cursor) throw new Error('no cursor');
    const confirmed = await dispatch(container.deps, {
      type: 'CONFIRM_SET',
      slotKey: cursor.slotKey,
      setKey: cursor.setKey,
      values: { load: { value: 60, unit: 'kg' }, reps: 10, rir: 2 },
    });
    if (!confirmed.ok) throw new Error(`confirm: ${confirmed.error.kind}`);
  }
  const finished = await finishWorkout(container.deps, { as: 'finished' });
  if (!finished.ok) throw new Error(`finish: ${finished.error.kind}`);
}

describe('body map screens (M4b: MAP-01…07)', () => {
  it('the muscle panel shows the sets against the target, the contributors and the ranking', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchSession(container, 2);
    renderRoute(container, '/explore/body-map/mu.chest');

    expect(await screen.findByRole('heading', { level: 1, name: 'Chest' })).toBeTruthy();
    // MAP-04 tap: fractional sets, direct sets, the target and its "Why?".
    const sets = await screen.findByTestId('muscle-sets');
    expect(sets.textContent).toMatch(/2 sets/);
    expect(screen.getByText('Direct sets')).toBeTruthy();
    expect(screen.getByText(/a week \(your plan\)|a week \(the evidence default/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Why? the target for Chest' })).toBeTruthy();
    const contributors = screen.getByTestId('contributors');
    expect(contributors.textContent).toContain('Barbell bench press');
    expect(contributors.textContent).toMatch(/2 sets × credit 1 = 2 sets/);

    // MAP-07: the sub-regions, each its own panel.
    expect(screen.getByRole('link', { name: /Upper chest/ })).toBeTruthy();

    // MAP-02/03: the ranked list with the effectiveness rating and its "Why?".
    const ranked = await screen.findByTestId('ranked-exercises');
    const items = within(ranked).getAllByRole('article');
    expect(items.length).toBeGreaterThan(2);
    expect(items[0]!.textContent).toMatch(/Effectiveness: \d+ of 100/);
    expect(items[0]!.textContent).toMatch(/Primary muscle \(credit 1\)|Secondary muscle/);
    const firstName = items[0]!.getAttribute('aria-label')!;
    await userEvent.click(
      within(items[0]!).getByRole('button', { name: `Why? effectiveness of ${firstName}` }),
    );
    expect(await screen.findByRole('dialog')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // The Focus sort: every item shows its focus on the muscle with its own "Why?".
    await userEvent.click(screen.getByRole('button', { name: 'Focus' }));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('ranked-exercises')).getAllByText(/Focus on Chest: \d+ of 100/)
          .length,
      ).toBeGreaterThan(0),
    );
    expect(await seriousViolations()).toEqual([]);
  });

  it('drills down to a sub-region with its own sets and ranking (MAP-07)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchSession(container, 1);
    renderRoute(container, '/explore/body-map/mu.chest');
    await userEvent.click(await screen.findByRole('link', { name: /^Upper chest/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Upper chest' })).toBeTruthy();
    expect(screen.getByText(/Volume targets apply to the whole muscle/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Chest' })).toBeTruthy();
    expect((await screen.findByTestId('muscle-sets')).textContent).toMatch(/\d/);
    expect(
      await screen.findByRole('heading', { name: 'Best exercises for Upper chest' }),
    ).toBeTruthy();
    const ranked = await screen.findByTestId('ranked-exercises');
    expect(within(ranked).getAllByRole('article').length).toBeGreaterThan(0);
    expect(await seriousViolations()).toEqual([]);
  });

  it('adds an exercise from the ranked list to the running workout (MAP-05)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchSession(container, 1);
    const started = await startWorkout(container.deps, {
      source: { kind: 'freestyle', exerciseIds: [] },
      warmups: false,
    });
    if (!started.ok) throw new Error(`start: ${started.error.kind}`);
    renderRoute(container, '/explore/body-map/mu.chest');

    const ranked = await screen.findByTestId('ranked-exercises');
    const first = within(ranked).getAllByRole('article')[0]!;
    const name = first.getAttribute('aria-label')!;
    await userEvent.click(within(first).getByRole('button', { name: `Add to today: ${name}` }));
    expect(await within(first).findByText(`${name} was added to your workout.`)).toBeTruthy();
    expect(within(first).getByRole('link', { name: 'Back to the workout' })).toBeTruthy();
    const active = await container.deps.uow.read(['sessions'], (repos) =>
      repos.sessions.getActive(),
    );
    expect(active?.exercises.map((slot) => slot.exerciseId)).toContain(
      first.getAttribute('data-exercise'),
    );
    expect(await seriousViolations()).toEqual([]);
  });

  it('offers the list alternative with the same names, and opens the panel from it (MAP-06)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchSession(container, 1);
    renderRoute(container, '/explore/body-map');

    expect(await screen.findByRole('heading', { level: 1, name: 'Body map' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('body-map-status').textContent).toMatch(/Week of .*1 workout/),
    );
    // The figure: every region a named button with its sets and band.
    const chest = screen.getByRole('button', {
      name: 'Chest, 1 set this week, Under 4 sets, below the floor',
    });
    expect(chest.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Hard sets this week')).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Show as a list' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Front' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Back' })).toBeTruthy();
    const row = screen.getByRole('button', {
      name: 'Chest, 1 set this week, Under 4 sets, below the floor',
    });
    expect(screen.getByRole('button', { name: 'Show the figure' })).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(row);
    expect(await screen.findByRole('heading', { level: 1, name: 'Chest' })).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'Back to the body map' }));
    // Back on the map (still the list), the opened muscle is selected.
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Chest, 1 set this week, Under 4 sets, below the floor' })
          .getAttribute('aria-pressed'),
      ).toBe('true'),
    );
  });

  it('switches to last week and the 4-week average (MAP-04 toggle)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchSession(container, 1);
    renderRoute(container, '/explore/body-map');
    await screen.findByRole('button', { name: /^Chest, 1 set this week/ });
    await userEvent.click(screen.getByRole('button', { name: 'Last week' }));
    expect(
      await screen.findByRole('button', { name: /^Chest, 0 sets last week, No hard sets/ }),
    ).toBeTruthy();
    expect(screen.getByText('Hard sets last week')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '4-week average' }));
    expect(
      await screen.findByRole('button', { name: /^Chest, 0 sets a week on average/ }),
    ).toBeTruthy();
    expect(screen.getByTestId('body-map-status').textContent).toMatch(/Average of the 4 weeks/);
  });
});
