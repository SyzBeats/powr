import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { useAppUi } from '../src/app/ui-store';
import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/*
 * M6c: "What's new" (SET-09, NFR-MNT-07, TD-20) from the build's changelog (served by the release
 * notes plugin in the test server too), the update notice's link to it, and the plan editor's
 * question before unsaved edits are lost (PWA-12, TD-68). Real IndexedDB, axe in each.
 */

/** The bottom navigation's Home link. */
function homeLink(): HTMLElement {
  return within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
    name: 'Home',
  });
}

afterEach(() => {
  useAppUi.setState({ updateAvailable: false, updateDeferred: false });
});

describe("What's new (SET-09, NFR-MNT-07)", () => {
  it('lists the release notes, newest first, with this version marked', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/settings/whats-new');

    expect(await screen.findByRole('heading', { level: 1, name: "What's new" })).toBeTruthy();
    const releases = await screen.findAllByTestId('release');
    expect(releases.length).toBeGreaterThan(0);
    const versions = releases.map((release) => release.dataset['version']);
    expect(versions).toContain('0.0.0');
    const current = releases.find((release) => release.dataset['version'] === '0.0.0')!;
    expect(within(current).getByRole('heading', { level: 2, name: 'Version 0.0.0' })).toBeTruthy();
    expect(within(current).getByText('This version')).toBeTruthy();
    expect(within(current).getByRole('heading', { level: 3, name: 'New' })).toBeTruthy();
    expect(
      within(current).getByRole('heading', { level: 3, name: 'Known limitations' }),
    ).toBeTruthy();
    expect(within(current).getAllByRole('listitem').length).toBeGreaterThan(3);
    expect(await seriousViolations()).toEqual([]);
  });

  it('is linked from Settings → About and from the update notice', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/settings');
    const about = await screen.findByRole('link', { name: "What's new: the release notes" });
    expect(about.getAttribute('href')).toBe('/settings/whats-new');

    useAppUi.setState({ updateAvailable: true });
    const banner = await screen.findByTestId('update-banner');
    // Once POWR knows no workout is running (the active-session query has loaded).
    await waitFor(() => expect(banner.textContent).toContain('A new version of POWR is ready.'));
    const link = await screen.findByRole('link', { name: "What's new" });
    expect(link.getAttribute('href')).toBe('/settings/whats-new');
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('the plan editor asks before unsaved edits are lost (PWA-12, TD-68)', () => {
  it('asks on an in-app link; "Keep editing" stays, "Discard changes" leaves', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const user = userEvent.setup();
    renderRoute(container, '/plan/edit');
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit plan' })).toBeTruthy();

    const [more] = await screen.findAllByRole('button', { name: /^One set more of / });
    await user.click(more!);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Undo last change' })).toHaveProperty(
        'disabled',
        false,
      ),
    );

    await user.click(homeLink());
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' });
    expect(dialog.textContent).toContain('Your changes to the plan are not saved.');
    const keep = within(dialog).getByRole('button', { name: 'Keep editing' });
    await waitFor(() => expect(document.activeElement).toBe(keep));
    expect(await seriousViolations()).toEqual([]);
    await user.click(keep);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('heading', { level: 1, name: 'Edit plan' })).toBeTruthy();

    await user.click(homeLink());
    const again = await screen.findByRole('alertdialog', { name: 'Discard your changes?' });
    await user.click(within(again).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 1, name: 'Edit plan' })).toBeNull(),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
