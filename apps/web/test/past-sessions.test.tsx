import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  dispatch,
  finishWorkout,
  pastSessionDetail,
  startWorkout,
} from '@powr/application/session';
import type { ExerciseId, SessionId } from '@powr/domain';

import type { Container } from '../src/app/container';
import { useSummaryWords } from '../src/features/session/past/parts';
import {
  createTestContainer,
  onboarded,
  renderRoute,
  renderWith,
  seriousViolations,
} from './harness';

/*
 * WKT-15: the past-sessions list, logging a session for a past date, and editing a finished one
 * with the PR preview ("This will remove a PR") before anything is written.
 */

const BENCH = 'ex.barbell-bench-press' as ExerciseId;

async function benchSession(container: Container, load: number): Promise<SessionId> {
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
    values: { load: { value: load, unit: 'kg' }, reps: 5, rir: 2 },
  });
  if (!confirmed.ok) throw new Error(`confirm: ${confirmed.error.kind}`);
  const finished = await finishWorkout(container.deps, { as: 'finished' });
  if (!finished.ok) throw new Error(`finish: ${finished.error.kind}`);
  return started.value.view.session.id;
}

describe('past sessions (WKT-15)', () => {
  it('lists finished sessions and previews the PR an edit removes before saving it', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await benchSession(container, 80);
    const id = await benchSession(container, 100);
    renderRoute(container, '/session/past');

    expect(await screen.findByRole('heading', { level: 1, name: 'Past workouts' })).toBeTruthy();
    const list = await screen.findByTestId('past-sessions');
    const rows = within(list).getAllByRole('link');
    expect(rows).toHaveLength(2);
    // Newest first.
    expect(rows[0]!.getAttribute('href')).toBe(`/session/past/${id}`);
    expect(rows[0]!.textContent).toContain('Barbell bench press');
    expect(rows[0]!.textContent).toContain('1 set');
    expect(screen.getByRole('link', { name: 'Log a past workout' })).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(rows[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit workout' })).toBeTruthy();
    expect((await screen.findByTestId('past-set')).textContent).toContain('100 kg × 5 · RIR 2');
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Edit set 1, Barbell bench press' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit set 1' });
    const weight = within(sheet).getByRole('textbox', { name: 'Weight (kg)' });
    await userEvent.clear(weight);
    await userEvent.type(weight, '70');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save set' }));

    // Nothing is written before the user has seen the PRs the change takes away.
    const confirm = await screen.findByRole('dialog', {
      name: 'This change affects your records',
    });
    const removed = within(confirm).getByTestId('prs-removed');
    expect(removed.textContent).toContain('This will remove a PR:');
    expect(removed.textContent).toContain('New rep PR on Barbell bench press: 100 kg for 5');
    const before = await pastSessionDetail(container.deps, id);
    expect(before.ok && before.value.sets[0]?.load).toEqual({ value: 100, unit: 'kg' });
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(within(confirm).getByRole('button', { name: 'Save anyway' }));
    await waitFor(() =>
      expect(screen.getByTestId('past-set').textContent).toContain('70 kg × 5 · RIR 2'),
    );
    const after = await pastSessionDetail(container.deps, id);
    expect(after.ok && after.value.sets[0]?.load).toEqual({ value: 70, unit: 'kg' });
    expect(screen.getByTestId('live-announcer').textContent).toBe('Workout updated.');
  });

  it('logs a workout for a past date, with the errors named next to the fields first', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/session/past/new');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Log a past workout' }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save workout' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Add at least one exercise with a set.');
    await waitFor(() => expect(document.activeElement).toBe(alert));

    await userEvent.type(screen.getByRole('searchbox', { name: 'Find an exercise' }), 'bench');
    await userEvent.click(screen.getByRole('button', { name: 'Add Barbell bench press' }));
    const exercise = screen.getByRole('region', { name: 'Barbell bench press' });
    await userEvent.click(screen.getByRole('button', { name: 'Save workout' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Barbell bench press, set 1: Enter the reps.',
    );
    expect(within(exercise).getByText('Enter the reps.')).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);

    const set = within(exercise).getByRole('group', { name: 'Set 1' });
    await userEvent.type(within(set).getByRole('textbox', { name: 'Weight (kg)' }), '62.5');
    await userEvent.type(within(set).getByRole('textbox', { name: 'Reps' }), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Save workout' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit workout' })).toBeTruthy();
    expect((await screen.findByTestId('past-set')).textContent).toContain('62.5 kg × 8');
  });
});

/** The three "no label" texts of the short trend label. */
function NoLabelTexts() {
  const words = useSummaryWords();
  return (
    <ul>
      {(['noise', 'unconfirmed', undefined] as const).map((reason) => (
        <li key={reason ?? 'none'}>
          {words.trend({ label: 'none', direction: null, ...(reason ? { reason } : {}) })}
        </li>
      ))}
    </ul>
  );
}

describe('the short trend label (PRG-02, TD-62)', () => {
  it('says why there is no label, as the "Why?" text does', async () => {
    const container = await createTestContainer();
    renderWith(container, <NoLabelTexts />);
    const items = (await screen.findAllByRole('listitem')).map((item) => item.textContent);
    expect(items).toEqual([
      'Within normal day-to-day variation',
      'More than normal day-to-day variation, not confirmed yet',
      // A point derived before the reason existed: true either way.
      'No confirmed change yet',
    ]);
  });
});
