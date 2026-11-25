import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { exerciseUserData, searchExercises } from '@powr/application/library';
import type { ExerciseId } from '@powr/domain';

import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/*
 * M4b exercise library (EXL-02…04, EXL-08, EXL-09): search and filters with clearable chips, the
 * exercise detail with marks and setup memory, and the custom-exercise form with its errors.
 */

const BENCH = 'ex.barbell-bench-press' as ExerciseId;

describe('exercise library (EXL-02)', () => {
  it('searches by name, filters with AND, shows each filter as a chip and clears it in one tap', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/explore/exercises');
    expect(await screen.findByRole('heading', { level: 1, name: 'Exercise library' })).toBeTruthy();
    const count = await screen.findByTestId('library-count');
    await waitFor(() => expect(count.textContent).toMatch(/^\d+ exercises$/));
    const all = Number(count.textContent?.split(' ')[0]);
    expect(all).toBeGreaterThan(50);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'bench');
    await waitFor(() =>
      expect(
        within(screen.getByTestId('library-results')).getByRole('link', {
          name: /^Barbell bench press/,
        }),
      ).toBeTruthy(),
    );
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search exercises' }));

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    await userEvent.selectOptions(
      within(sheet).getByRole('combobox', { name: 'Muscle' }),
      'mu.elbow-flexors',
    );
    await userEvent.click(
      within(sheet).getByRole('checkbox', { name: /Available with my equipment/ }),
    );
    await userEvent.click(within(sheet).getByRole('button', { name: /^Show \d+ exercises?$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const chips = screen.getByTestId('active-filters');
    expect(within(chips).getByRole('button', { name: 'Remove filter: Biceps' })).toBeTruthy();
    expect(
      within(chips).getByRole('button', { name: 'Remove filter: Available with my equipment' }),
    ).toBeTruthy();
    await waitFor(() => {
      const filtered = Number(count.textContent?.split(' ')[0]);
      expect(filtered).toBeGreaterThan(0);
      expect(filtered).toBeLessThan(all);
    });
    const results = within(screen.getByTestId('library-results'));
    expect(results.getAllByRole('link').some((link) => /curl/i.test(link.textContent ?? ''))).toBe(
      true,
    );
    expect(results.queryByText('Needs other equipment')).toBeNull();
    expect(await seriousViolations()).toEqual([]);

    // One tap clears one filter; "Clear all" the rest.
    await userEvent.click(within(chips).getByRole('button', { name: 'Remove filter: Biceps' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove filter: Biceps' })).toBeNull(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const again = await screen.findByRole('dialog', { name: 'Filters' });
    await userEvent.selectOptions(
      within(again).getByRole('combobox', { name: 'Mechanics' }),
      'isolation',
    );
    await userEvent.click(within(again).getByRole('button', { name: 'Close filters' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(screen.queryByTestId('active-filters')).toBeNull());
    await waitFor(() => expect(count.textContent).toBe(`${all} exercises`));
  });
});

describe('exercise detail (EXL-03, EXL-08, EXL-09)', () => {
  it('shows cues, muscles with their evidence, history; marks a favourite and saves the setup', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, `/explore/exercises/${BENCH}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Barbell bench press' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'How to do it' })).toBeTruthy();
    expect(screen.getByTestId('exercise-cues').querySelectorAll('li').length).toBeGreaterThan(2);
    const muscles = screen.getByTestId('exercise-muscles');
    expect(muscles.textContent).toMatch(/chest/i);
    expect(muscles.textContent).toContain('Primary');
    expect(screen.getByRole('group', { name: 'Front view, body map' })).toBeTruthy();
    expect(screen.getByText('You have not logged this exercise yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Trend and full history' }).getAttribute('href')).toBe(
      `/progress/exercise/${BENCH}`,
    );
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(screen.getByRole('checkbox', { name: /^Favourite/ }));
    expect(await screen.findByText('Marked as a favourite.')).toBeTruthy();
    const favourites = await searchExercises(container.deps, { favouritesOnly: true });
    expect(favourites.map((item) => item.exerciseId)).toEqual([BENCH]);

    await userEvent.click(screen.getByRole('button', { name: 'Add a setting' }));
    const setting = screen.getByRole('group', { name: 'Setting 1' });
    await userEvent.type(within(setting).getByRole('textbox', { name: 'Value' }), 'Pins at 7');
    await userEvent.type(screen.getByRole('textbox', { name: /^Training max/ }), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    expect(
      await screen.findByText('Setup saved. It shows whenever this exercise is in a workout.'),
    ).toBeTruthy();
    const stored = await exerciseUserData(container.deps, BENCH);
    expect(stored?.setup).toEqual([{ field: 'seat', value: 'Pins at 7' }]);
    expect(stored?.trainingMax).toEqual({ value: 100, unit: 'kg' });
  });
});

describe('custom exercises (EXL-04)', () => {
  it('names every problem next to its field and in a focused summary, then saves', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const view = renderRoute(container, '/explore/exercises/new');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'New custom exercise' }),
    ).toBeTruthy();

    await userEvent.click(await screen.findByRole('button', { name: 'Save exercise' }));
    const summary = await screen.findByTestId('custom-errors');
    await waitFor(() => expect(document.activeElement?.contains(summary)).toBe(true));
    for (const message of [
      'Enter a name.',
      'Choose a movement pattern.',
      'Choose compound or isolation.',
      'Add at least one muscle.',
      'Choose how the weight is loaded.',
      'Choose a rest class.',
    ]) {
      expect(summary.textContent).toContain(message);
    }
    // Next to the field too, tied to it.
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(await seriousViolations()).toEqual([]);

    await userEvent.type(name, 'Hip thrust machine (gym 2)');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Movement pattern' }),
      'hipExtension',
    );
    await userEvent.click(screen.getByRole('radio', { name: /^Compound/ }));
    const muscle = screen.getByRole('group', { name: 'Muscle 1' });
    await userEvent.selectOptions(
      within(muscle).getByRole('combobox', { name: 'Muscle' }),
      'mu.glutes',
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'How the weight is loaded' }),
      'machine',
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Rest between sets' }),
      'hypertrophyCompound',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save exercise' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hip thrust machine (gym 2)' }),
    ).toBeTruthy();
    expect(screen.getByText('Custom exercise')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit this exercise' })).toBeTruthy();

    view.unmount();
    renderRoute(container, '/explore/exercises?q=gym%202');
    const results = await screen.findByTestId('library-results');
    expect(
      within(results).getByRole('link', { name: /^Hip thrust machine \(gym 2\)/ }),
    ).toBeTruthy();
    expect(within(results).getByText('Custom')).toBeTruthy();
  });

  it('copies an exercise as the starting point', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, `/explore/exercises/new?from=${BENCH}`);
    expect(
      await screen.findByText(
        'A copy of Barbell bench press. Give it its own name and change what differs.',
      ),
    ).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', { name: 'Movement pattern' }).value,
    ).toBe('horizontalPush');
    expect(screen.getAllByRole('group', { name: /^Muscle \d+$/ }).length).toBeGreaterThan(1);
  });
});
