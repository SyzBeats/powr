import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { logBodyweight } from '@powr/application/insights';

import type { Container } from '../src/app/container';
import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/*
 * BOD-01…03 (M4b): logging a bodyweight from the log screen, the trend with its rate and band,
 * editing and deleting a weigh-in, and logging measurements per site.
 */

/** Weigh-ins on the last `days` days, about 0.05 kg lighter each day. */
async function weighIns(container: Container, days: number): Promise<void> {
  const now = Date.now();
  for (let day = days; day >= 1; day--) {
    const epochMs = now - day * 86_400_000;
    const result = await logBodyweight(container.deps, {
      mass: { value: 82 - (days - day) * 0.05, unit: 'kg' },
      measuredAt: { epochMs, offsetMin: -new Date(epochMs).getTimezoneOffset(), zone: 'UTC' },
    });
    if (!result.ok) throw new Error(result.error.kind);
  }
}

describe('bodyweight (BOD-01, BOD-02)', () => {
  it('logs a weigh-in, names what is wrong first, and shows it with the trend', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const user = userEvent.setup();
    renderRoute(container, '/body/log');
    expect(await screen.findByRole('heading', { level: 1, name: 'Log bodyweight' })).toBeTruthy();

    // Nothing entered: the error summary takes focus and the field says what to do. (The form
    // shows once the profile, with its unit, has loaded.)
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    const summary = await screen.findByRole('alert');
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(summary.textContent).toContain('Enter your bodyweight');
    const field = screen.getByRole('textbox', { name: 'Bodyweight' });
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(await seriousViolations()).toEqual([]);

    // Implausible, then a real value typed with a decimal comma.
    await user.type(field, '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('between 20 and 400 kg'),
    );
    await user.clear(field);
    await user.type(field, '82,5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bodyweight and measurements' }),
    ).toBeTruthy();
    const list = await screen.findByTestId('weigh-ins');
    expect(list.textContent).toContain('82.5 kg');
    expect(screen.getByTestId('body-rate').textContent).toBe('Needs about two weeks');
    expect(await seriousViolations()).toEqual([]);
  });

  it('shows the trend, the weekly rate and the chart table, and edits and deletes a weigh-in', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await weighIns(container, 21);
    const user = userEvent.setup();
    renderRoute(container, '/body');

    await waitFor(() => expect(screen.getByTestId('body-trend').textContent).toMatch(/kg$/), {
      timeout: 5000,
    });
    expect(screen.getByTestId('body-rate').textContent).toMatch(/[-−]0\.\d+ kg a week/);
    expect(screen.getByRole('heading', { name: 'Bodyweight trend' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /View as table/ }));
    const table = await screen.findByRole('table', { name: /Bodyweight trend/ });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(5);

    // Edit the newest weigh-in, then delete it after the confirmation.
    const list = screen.getByTestId('weigh-ins');
    const first = within(list).getAllByRole('listitem')[0]!;
    await user.click(within(first).getByRole('button', { name: /^Edit / }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit weigh-in' });
    const value = within(sheet).getByRole('textbox', { name: 'Bodyweight' });
    await user.clear(value);
    await user.type(value, '79.7');
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByTestId('weigh-ins').textContent).toContain('79.7 kg'));
    await user.click(
      within(within(screen.getByTestId('weigh-ins')).getAllByRole('listitem')[0]!).getByRole(
        'button',
        { name: /^Edit / },
      ),
    );
    const again = await screen.findByRole('dialog', { name: 'Edit weigh-in' });
    await user.click(within(again).getByRole('button', { name: 'Delete…' }));
    await user.click(within(again).getByRole('button', { name: 'Delete weigh-in' }));
    // The list shows the newest 10, so the deleted one is gone once the live query re-rendered.
    await waitFor(() =>
      expect(screen.getByTestId('weigh-ins').textContent).not.toContain('79.7 kg'),
    );
    expect(within(screen.getByTestId('weigh-ins')).getAllByRole('listitem')).toHaveLength(10);
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('measurements (BOD-03)', () => {
  it('logs measurements of the chosen sites and lists them with their trend', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const user = userEvent.setup();
    renderRoute(container, '/body/log?what=measurements');
    expect(await screen.findByRole('heading', { level: 1, name: 'Log measurements' })).toBeTruthy();
    await user.type(await screen.findByRole('textbox', { name: 'Waist' }), '84.5');
    await user.type(screen.getByRole('textbox', { name: 'Upper arm, left' }), '38');
    expect(await seriousViolations()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const list = await screen.findByTestId('measurements');
    expect(list.textContent).toContain('Waist');
    expect(list.textContent).toContain('84.5 cm');
    expect(list.textContent).toContain('38 cm');
    expect(await seriousViolations()).toEqual([]);
  });
});
