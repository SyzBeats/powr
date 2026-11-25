import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Container } from '../src/app/container';
import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/*
 * SET-08 (M5s): one onboarding answer changed in Settings. An answer that does not change the
 * plan is stored straight away; one that does shows the new plan first, with what changes, and
 * the user chooses to update from next week or to keep the plan.
 */

async function activePlan(container: Container) {
  return container.deps.uow.read(['plans'], (repos) => repos.plans.getActive());
}

async function profile(container: Container) {
  return container.deps.uow.read(['profile'], (repos) => repos.profile.get());
}

describe('changing one onboarding answer (SET-08)', () => {
  it('stores an answer that does not change the plan, without a re-plan', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const before = await activePlan(container);
    const user = userEvent.setup();
    renderRoute(container, '/settings/profile/body');
    const year = await screen.findByRole('textbox', { name: 'Birth year' });
    // Settings has its own units and body-weight log: the editor leaves them out.
    expect(screen.queryByRole('group', { name: 'Weights in' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /Body weight/ })).toBeNull();
    expect(await seriousViolations()).toEqual([]);
    await user.type(year, '1990');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect((await profile(container))?.birthYear).toBe(1990);
    expect((await activePlan(container))?.id).toBe(before?.id);
    expect(screen.getByTestId('answer-body').textContent).toContain('born 1990');
  });

  it('previews the new plan when the training days change, and updates it from next week', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const before = (await activePlan(container))!;
    const user = userEvent.setup();
    renderRoute(container, '/settings/profile/schedule');
    const days = await screen.findByRole('group', { name: 'Training days' });
    await user.click(within(days).getByRole('button', { name: 'Saturday' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('heading', { level: 1, name: 'Your plan would change' });
    expect(screen.getByTestId('replan-differences').textContent).toContain(
      'Training days a week: 4 → 5',
    );
    // The plan itself, with its "Why?", before anything is stored.
    expect(screen.getAllByRole('button', { name: /^Why\? / }).length).toBeGreaterThan(0);
    expect((await activePlan(container))?.id).toBe(before.id);
    const choices = screen.getByTestId('replan-choices');
    // Training days belong to the plan: keeping it keeps the days.
    expect(
      within(choices).getByRole('button', { name: 'Keep my current plan and days' }),
    ).toBeTruthy();
    window.scrollTo(0, 0);
    expect(await seriousViolations()).toEqual([]);

    await user.click(within(choices).getByRole('button', { name: /^Update my plan from / }));
    await screen.findByRole('heading', { level: 1, name: 'Plan' });
    const after = (await activePlan(container))!;
    expect(after.id).not.toBe(before.id);
    expect(after.schedule.weekdays).toHaveLength(5);
    const ended = await container.deps.uow.read(['plans'], (repos) => repos.plans.get(before.id));
    expect(ended?.status).toBe('ended');
  });

  it('keeps the plan on request; a priority still reaches the next block', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const before = (await activePlan(container))!;
    const user = userEvent.setup();
    renderRoute(container, '/settings/profile/priorities');
    const muscles = await screen.findByRole('group', { name: 'Priority muscles' });
    await user.click(within(muscles).getByRole('button', { name: 'Chest' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { level: 1, name: 'Your plan would change' });
    expect(screen.getByTestId('replan-differences').textContent).toMatch(/Weekly sets for Chest/);
    expect(screen.getByText(/The next block uses your new answer/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Keep my current plan' }));
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect((await profile(container))?.priorities).toEqual(['mu.chest']);
    expect((await activePlan(container))?.id).toBe(before.id);
  });

  it('points out an answer that is not complete, next to the question', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const user = userEvent.setup();
    renderRoute(container, '/settings/profile/schedule');
    const days = await screen.findByRole('group', { name: 'Training days' });
    for (const day of ['Monday', 'Tuesday', 'Thursday'])
      await user.click(within(days).getByRole('button', { name: day }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Pick between 2 and 6 training days.');
    expect(document.activeElement).toBe(alert);
  });
});
