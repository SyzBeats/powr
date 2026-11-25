import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { moveSession } from '@powr/application/planning';
import type { LocalDate } from '@powr/domain';

import type { Container } from '../src/app/container';
import { useAppUi } from '../src/app/ui-store';
import { todayLocal } from '../src/i18n/format';
import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/*
 * M6a, TD-64: the one-tap start from Home and the manifest shortcut (`/session?start=today`) offer
 * a waiting update first, as the start screen does (TD-14); "Start without updating" starts today's
 * session and no screen asks again in this page. Real IndexedDB, axe in each.
 */

afterEach(() => {
  useAppUi.setState({ updateAvailable: false, updateDeferred: false });
  vi.restoreAllMocks();
});

/** Onboarded, with a planned session today (the sample plan's first one moved if needed). */
async function plannedToday(container: Container): Promise<void> {
  await onboarded(container);
  const today = todayLocal() as LocalDate;
  const planned = await container.deps.uow.read(['plannedSessions'], (repos) =>
    repos.plannedSessions.inRange('2000-01-01' as LocalDate, '2100-01-01' as LocalDate),
  );
  const open = planned
    .filter((session) => session.status === 'planned')
    .toSorted((a, b) => (a.localDate < b.localDate ? -1 : 1));
  if (open.some((session) => session.localDate === today)) return;
  const moved = await moveSession(container.deps, { sessionId: open[0]!.id, date: today });
  if (!moved.ok) throw new Error(`move: ${moved.error.kind}`);
}

describe('TD-64: the update before the one-tap start', () => {
  it("Home's start card offers the update; starting without it starts today's session", async () => {
    const container = await createTestContainer();
    await plannedToday(container);
    const apply = vi.spyOn(container.serviceWorker, 'applyUpdate');
    useAppUi.setState({ updateAvailable: true });
    const user = userEvent.setup();
    renderRoute(container, '/');

    const offer = await screen.findByTestId('update-first');
    expect(
      within(offer).getByRole('heading', { level: 3, name: 'Update before you start?' }),
    ).toBeTruthy();
    expect(screen.getByTestId('next-session').textContent).toContain('today');
    // The plain one-tap start gives way to the explicit choice.
    expect(screen.queryByRole('link', { name: "Start today's workout" })).toBeNull();
    expect(await seriousViolations()).toEqual([]);

    await user.click(within(offer).getByRole('button', { name: 'Update first' }));
    expect(apply).toHaveBeenCalledTimes(1);

    const without = within(offer).getByRole('link', { name: 'Start without updating' });
    expect(without.getAttribute('href')).toBe('/session?start=today');
    await user.click(without);
    expect(useAppUi.getState().updateDeferred).toBe(true);
    // The start screen does not ask again: today's session starts (the check-in comes first).
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'How are you today?' },
        { timeout: 5000 },
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('update-first')).toBeNull();
  });

  it('the shortcut start waits for the choice, then starts today’s session', async () => {
    const container = await createTestContainer();
    await plannedToday(container);
    useAppUi.setState({ updateAvailable: true });
    const user = userEvent.setup();
    renderRoute(container, '/session?start=today&source=shortcut');

    const offer = await screen.findByTestId('update-first');
    expect(
      within(offer).getByRole('heading', { level: 2, name: 'Update before you start?' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Start a workout' })).toBeTruthy();
    // Nothing started while the offer is open.
    await waitFor(async () => {
      const active = await container.deps.uow.read(['sessions'], (repos) =>
        repos.sessions.getActive(),
      );
      expect(active).toBeUndefined();
    });
    expect(await seriousViolations()).toEqual([]);

    await user.click(within(offer).getByRole('button', { name: 'Start without updating' }));
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'How are you today?' },
        { timeout: 5000 },
      ),
    ).toBeTruthy();
  });

  it('without a waiting update the one-tap start is unchanged', async () => {
    const container = await createTestContainer();
    await plannedToday(container);
    const user = userEvent.setup();
    renderRoute(container, '/');
    const start = await screen.findByRole('link', { name: "Start today's workout" });
    expect(screen.queryByTestId('update-first')).toBeNull();
    await user.click(start);
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'How are you today?' },
        { timeout: 5000 },
      ),
    ).toBeTruthy();
  });
});
