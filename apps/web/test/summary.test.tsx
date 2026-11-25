import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { dispatch, finishWorkout, startWorkout } from '@powr/application/session';
import type { ExerciseId, SessionId } from '@powr/domain';

import type { Container } from '../src/app/container';
import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/*
 * WKT-13, MOT-01/02: the summary of a finished session, with the PRs it set, its e1RM change,
 * the sets against the plan and the streak.
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

describe('workout summary (WKT-13, MOT-02)', () => {
  it('shows the PRs of the session in words, the e1RM change, the sets and the streak', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await container.platform.timers.load();
    // The first exposure is a milestone without PRs; the second one beats it.
    await benchSession(container, 80, 5, 2);
    const id = await benchSession(container, 100, 5, 2);
    renderRoute(container, `/session/summary/${id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Workout summary' })).toBeTruthy();
    const prs = await screen.findByTestId('summary-prs');
    expect(within(prs).getByRole('heading', { name: 'New personal records' })).toBeTruthy();
    expect(prs.textContent).toContain('New rep PR on Barbell bench press: 100 kg for 5');
    expect(prs.textContent).toContain('New heaviest weight on Barbell bench press: 100 kg');
    expect(screen.getByText('1 set logged')).toBeTruthy();
    expect(screen.getByText('Counts for your weekly streak')).toBeTruthy();
    const e1rm = screen.getByRole('heading', { name: 'Estimated 1-rep max' }).parentElement!;
    expect(e1rm.textContent).toMatch(/Barbell bench press.*kg → .*kg/);
    expect(screen.getByRole('heading', { name: 'Sets per muscle' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit this workout' }).getAttribute('href')).toBe(
      `/session/past/${id}`,
    );
    expect(await seriousViolations()).toEqual([]);
  });

  it('marks the first time of an exercise instead of PRs', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const id = await benchSession(container, 60, 8, 3);
    renderRoute(container, `/session/summary/${id}`);
    expect(await screen.findByRole('heading', { name: 'First time' })).toBeTruthy();
    expect(screen.queryByTestId('summary-prs')).toBeNull();
    expect(screen.getByText(/New exercises today: Barbell bench press/)).toBeTruthy();
  });

  it('says so when the session does not exist', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/session/summary/missing-session');
    await waitFor(() =>
      expect(
        screen.getByText('This workout was not found. It may have been deleted.'),
      ).toBeTruthy(),
    );
    expect(screen.getByRole('link', { name: 'Back to Home' })).toBeTruthy();
  });
});
