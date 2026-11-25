import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Container } from '../src/app/container';
import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/*
 * M5s Settings (SET-01…06, SET-09…11, TD-49): the sections in order, units, training and display
 * preferences, rest times with their evidence defaults and reset, and the per-exercise choices.
 * axe in both themes.
 */

async function stored(container: Container) {
  return container.deps.uow.read(['settings'], (repos) => repos.settings.get());
}

async function axeBothThemes(): Promise<string[]> {
  const root = document.documentElement;
  const light = await seriousViolations();
  root.dataset['theme'] = 'dark';
  const dark = await seriousViolations();
  delete root.dataset['theme'];
  return [...light, ...dark.map((violation) => `dark: ${violation}`)];
}

async function ready() {
  const container = await createTestContainer();
  await onboarded(container);
  // The Alerts section suspends until the lazy timer kit is there (M3b).
  await container.platform.timers.load();
  return container;
}

describe('Settings sections (SET-01…11)', () => {
  it('shows every section in order, each reachable from "On this page"', async () => {
    const container = await ready();
    renderRoute(container, '/settings');
    const names = [
      'Profile and plan',
      'Units',
      'Training',
      'Workout',
      'Alerts',
      'Insights',
      'Appearance',
      'Data',
      'Legal',
      'About',
    ];
    await screen.findByRole('heading', { level: 2, name: 'Alerts' });
    await screen.findByRole('heading', { level: 2, name: 'Profile and plan' });
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
      .filter((text): text is string => text !== null && names.includes(text));
    expect(headings).toEqual(names);
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/settings#profile',
      '/settings#units',
      '/settings#training',
      '/settings#workout',
      '/settings#alerts',
      '/settings#insights',
      '/settings#appearance',
      '/settings#data',
      '/settings#legal',
      '/settings#about',
    ]);
    // Profile answers in words; legal links; about with the registry version and contact.
    expect(screen.getByTestId('answer-goal').textContent).toBe('Bodybuilding');
    expect(screen.getByTestId('answer-schedule').textContent).toMatch(/^Mon, Tue, Thu, Fri · /);
    const legal = screen.getByRole('region', { name: 'Legal' });
    expect(
      within(legal)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Health and safety notice',
      'Privacy notice',
      'Publisher and imprint',
      'How POWR decides',
      'Open-source licences and attributions',
    ]);
    const about = screen.getByRole('region', { name: 'About' });
    expect(about.textContent).toContain(container.deps.rules.version);
    expect(
      within(about).getByRole('link', { name: 'tools@sz-development.com' }).getAttribute('href'),
    ).toBe('mailto:tools@sz-development.com');
    window.scrollTo(0, 0);
    expect(await axeBothThemes()).toEqual([]);
  });

  it('stores units, training and display preferences (SET-02, SET-05, SET-10)', async () => {
    const container = await ready();
    const user = userEvent.setup();
    renderRoute(container, '/settings');
    const units = await screen.findByRole('region', { name: 'Units' });
    await user.click(
      within(within(units).getByRole('group', { name: 'Weights you lift' })).getByRole('button', {
        name: 'Pounds (lb)',
      }),
    );
    await waitFor(async () =>
      expect(
        (await container.deps.uow.read(['profile'], (repos) => repos.profile.get()))?.units,
      ).toEqual({ load: 'lb', bodyweight: 'kg', length: 'cm' }),
    );

    const training = screen.getByRole('region', { name: 'Training' });
    await user.click(within(training).getByRole('button', { name: 'RPE (1–10)' }));
    await waitFor(async () => expect((await stored(container))?.training?.effortScale).toBe('rpe'));
    await user.click(within(training).getByRole('button', { name: 'Half steps' }));
    const warmups = within(training).getByRole('checkbox', {
      name: /^Warm-up sets at the start of a workout/,
    });
    await waitFor(() => expect(warmups.getAttribute('aria-checked')).toBe('true'));
    await user.click(warmups);
    await waitFor(async () =>
      expect((await stored(container))?.training).toEqual({
        effortScale: 'rpe',
        rirInput: 'decimal',
        warmups: false,
      }),
    );

    const workout = screen.getByRole('region', { name: 'Workout' });
    await user.click(within(workout).getByRole('checkbox', { name: /^Larger controls/ }));
    await user.click(within(workout).getByRole('checkbox', { name: /^Celebration animations/ }));
    await waitFor(async () =>
      expect((await stored(container))?.display).toEqual({
        largeControls: true,
        celebrations: false,
      }),
    );
    window.scrollTo(0, 0);
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('advanced training choices (SET-05)', () => {
  it('overrides the e1RM formula and the lighter-week interval, and goes back to the defaults', async () => {
    const container = await ready();
    const user = userEvent.setup();
    renderRoute(container, '/settings');
    const advanced = await screen.findByTestId('training-advanced');
    await user.click(within(advanced).getByText('Advanced: progression, formula, lighter weeks'));
    const formula = await within(advanced).findByRole('group', {
      name: 'Estimated 1-rep max formula',
    });
    expect(
      within(formula).getByRole('button', { name: 'Wathan' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await user.click(within(formula).getByRole('button', { name: 'Epley' }));
    await user.click(
      within(within(advanced).getByRole('group', { name: 'A lighter week after every' })).getByRole(
        'button',
        { name: '6 weeks' },
      ),
    );
    await waitFor(async () =>
      expect((await stored(container))?.overrides).toEqual([
        { paramId: 'load.e1rm.equation', value: 'epley' },
        { paramId: 'deload.planned.everyWeeks', value: 6 },
      ]),
    );
    expect(advanced.textContent).toContain('Your setting. Evidence default: Wathan.');
    expect(await seriousViolations()).toEqual([]);
    await user.click(
      within(advanced).getByRole('button', {
        name: 'Use the evidence default: Estimated 1-rep max formula',
      }),
    );
    await waitFor(async () =>
      expect((await stored(container))?.overrides).toEqual([
        { paramId: 'deload.planned.everyWeeks', value: 6 },
      ]),
    );
  });
});

describe('rest times (SET-03, TMR-02)', () => {
  it('shows the evidence defaults, stores an own value with a note, and resets to the defaults', async () => {
    const container = await ready();
    const user = userEvent.setup();
    renderRoute(container, '/settings/rest');
    const strength = await screen.findByRole('textbox', { name: 'Strength sets' });
    const row = screen.getByTestId('rest-session.rest.strength');
    expect((strength as HTMLInputElement).value).toBe('180');
    expect(row.textContent).toContain('Evidence default: 3:00 (squat and deadlift 4:00)');
    expect(within(row).getAllByText('Strong research').length).toBe(1);

    await user.click(screen.getByRole('button', { name: '15 seconds more: Strength sets' }));
    await waitFor(async () =>
      expect((await stored(container))?.overrides).toEqual([
        { paramId: 'session.rest.strength', value: 195 },
      ]),
    );
    await waitFor(() => expect(within(row).getByText('Your setting')).toBeTruthy());

    // Out of the evidence range: accepted, with a note (TMR-02).
    await user.clear(strength);
    await user.type(strength, '600');
    await waitFor(() => expect(within(row).getByTestId('rest-out-of-range')).toBeTruthy());
    expect((await stored(container))?.overrides).toEqual([
      { paramId: 'session.rest.strength', value: 600 },
    ]);
    window.scrollTo(0, 0);
    expect(await axeBothThemes()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Reset all rest times' }));
    await waitFor(() =>
      expect(screen.getByTestId('rest-status').textContent).toBe(
        'Rest times reset to the evidence defaults.',
      ),
    );
    expect((await stored(container))?.overrides).toEqual([]);
    await waitFor(() => expect((strength as HTMLInputElement).value).toBe('180'));
  });
});

describe('per-exercise choices (TMR-01, PRG-03 "keep as last time")', () => {
  it('lists the plan exercises and stores manual mode and auto-start per exercise', async () => {
    const container = await ready();
    const user = userEvent.setup();
    renderRoute(container, '/settings/exercises');
    const plan = await screen.findByRole('region', { name: 'In your plan' });
    const first = within(plan).getAllByRole('listitem')[0]!;
    const name = within(first).getByRole('heading', { level: 3 }).textContent ?? '';
    await user.click(within(first).getByRole('checkbox', { name: /^Keep as last time/ }));
    await user.click(within(first).getByRole('button', { name: 'When I tap it' }));
    await waitFor(async () =>
      expect((await stored(container))?.session?.exercises).toEqual([
        expect.objectContaining({ manual: true, restAutoStart: false }),
      ]),
    );
    const id = (await stored(container))?.session?.exercises?.[0]?.exerciseId ?? '';
    expect(container.deps.content.exercise(id as never)?.name.en).toBe(name);
    window.scrollTo(0, 0);
    expect(await axeBothThemes()).toEqual([]);
  });
});
