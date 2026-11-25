import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { snapshotBeforeUpgrade } from '@powr/application/backup';
import { startWorkout } from '@powr/application/session';
import type { ExerciseId } from '@powr/domain';

import { useAppUi } from '../src/app/ui-store';
import { RecoveryScreen } from '../src/features/shell/RecoveryScreen';
import { UpdateFirstOffer } from '../src/features/shell/UpdateFirstOffer';
import {
  createTestContainer,
  onboarded,
  renderRoute,
  renderWith,
  seriousViolations,
} from './harness';

/*
 * M5d: Data and backups (storage, backup reminder cadence, safety copies, delete all), the
 * calendar export screen (CAL-01…05), the device-support screen (PWA-13), the recovery screen
 * (DAT-14) and the "Update first" offer (TD-14). Real IndexedDB, axe in each.
 */

afterEach(() => {
  useAppUi.setState({
    installPrompt: null,
    updateAvailable: false,
    updateDeferred: false,
    wipe: null,
  });
  vi.restoreAllMocks();
});

describe('Data and backups (DAT-03…08, DAT-13)', () => {
  it('shows storage, saves the reminder cadence and lists and deletes a safety copy', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    await snapshotBeforeUpgrade(
      {
        app: container.deps.app,
        clock: container.deps.clock,
        ids: container.deps.ids,
        safety: container.deps.safety,
        files: container.deps.files,
        rulesVersion: 'r',
        contentVersion: 'c',
      },
      { dataVersion: 1, tables: { settings: [{ id: 'me', theme: 'dark' }] } },
    );
    const user = userEvent.setup();
    renderRoute(container, '/data');
    expect(await screen.findByRole('heading', { level: 1, name: 'Data and backups' })).toBeTruthy();
    expect((await screen.findByTestId('storage-protected')).textContent).toMatch(
      /Storage protected: (Yes|No)/,
    );
    expect(screen.getByTestId('storage-usage').textContent).toMatch(/Using|not reported/);

    // DAT-08: the cadence is a radio group; the choice is stored in the settings.
    const reminders = await screen.findByRole('radiogroup', { name: 'Backup reminders' });
    await user.click(within(reminders).getByRole('radio', { name: 'Every 30 days' }));
    await waitFor(async () => {
      const settings = await container.deps.uow.read(['settings'], (repos) => repos.settings.get());
      expect(settings?.backup).toEqual({ reminderDays: 30 });
    });
    await user.click(within(reminders).getByRole('radio', { name: 'Off' }));
    await waitFor(async () => {
      const settings = await container.deps.uow.read(['settings'], (repos) => repos.settings.get());
      expect(settings?.backup).toEqual({ reminderDays: null });
    });

    // Safety copies: the one taken before a data update, deleted after a confirmation.
    const copy = await screen.findByTestId('safety-copy');
    expect(copy.textContent).toContain('Before a data update');
    await user.click(within(copy).getByRole('button', { name: /^Delete: Before a data update/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete this safety copy?' });
    expect(await seriousViolations()).toEqual([]);
    await user.click(within(sheet).getByRole('button', { name: 'Delete the safety copy' }));
    expect(await screen.findByTestId('safety-copies-empty')).toBeTruthy();
    expect(screen.getByTestId('safety-copies-status').textContent).toBe('Safety copy deleted.');
    expect(await container.deps.safety.list()).toEqual([]);
    expect(await seriousViolations()).toEqual([]);
  });

  it('delete all: a two-step, typed confirmation, then the app shows only the deletion screen', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const wipe = vi.spyOn(container.platform, 'deleteAllData').mockResolvedValue({ remaining: [] });
    const user = userEvent.setup();
    renderRoute(container, '/data');
    await user.click(await screen.findByRole('button', { name: 'Delete all data…' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete all data?' });
    const confirm = within(sheet).getByRole('button', { name: 'Delete everything' });
    expect(confirm.hasAttribute('disabled') || confirm.getAttribute('aria-disabled')).toBeTruthy();
    await user.type(within(sheet).getByTestId('delete-confirm'), 'delete');
    // The word must match exactly (case included).
    expect(confirm.hasAttribute('disabled') || confirm.getAttribute('aria-disabled')).toBeTruthy();
    await user.clear(within(sheet).getByTestId('delete-confirm'));
    await user.type(within(sheet).getByTestId('delete-confirm'), 'DELETE');
    await user.click(confirm);
    await waitFor(() => expect(wipe).toHaveBeenCalledTimes(1));
    expect(useAppUi.getState().wipe).toEqual({ kind: 'done' });
  });
});

describe('backup reminder on Home (DAT-08, TD-57)', () => {
  it('shows after a workout without a backup and "Remind me later" hides it for days', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const started = await startWorkout(container.deps, {
      source: { kind: 'freestyle', exerciseIds: ['ex.barbell-bench-press' as ExerciseId] },
      warmups: false,
    });
    if (!started.ok) throw new Error('start');
    await container.deps.uow.write(['sessions'], async (repos) => {
      const session = await repos.sessions.get(started.value.view.session.id);
      await repos.sessions.put({
        ...session!,
        status: 'finished',
        endedAt: container.deps.clock.now(),
      });
    });
    const user = userEvent.setup();
    renderRoute(container, '/');
    expect(await screen.findByRole('heading', { name: 'Back up your training' })).toBeTruthy();
    expect(
      screen.getByText('Your training lives only on this phone. A backup file keeps it safe.'),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remind me later' }));
    const done = await screen.findByTestId('backup-reminder-snoozed');
    await waitFor(() => expect(document.activeElement).toBe(done));
    const meta = await container.deps.uow.read(['meta'], (repos) =>
      repos.meta.get('backupReminder'),
    );
    expect(meta?.value).toMatchObject({ snoozedUntil: expect.any(String) });
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('calendar export (CAL-01…05)', () => {
  it('previews the sessions of the range, offers the download and the import guide', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const save = vi.spyOn(container.deps.files, 'save').mockResolvedValue('downloaded');
    const user = userEvent.setup();
    renderRoute(container, '/plan/calendar');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add your plan to your calendar' }),
    ).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Next 4 weeks' }));
    await user.click(screen.getByRole('radio', { name: '1 hour before' }));
    const preview = screen.getByTestId('calendar-preview');
    await waitFor(() => expect(preview.textContent).toMatch(/\d+ sessions/));

    // An impossible time is named at the field, and the download waits for a valid one.
    const time = screen.getByLabelText('Time for every session');
    await user.clear(time);
    expect(await screen.findByText('Enter a time such as 18:00.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Download the calendar file' }).hasAttribute('disabled'),
    ).toBe(true);
    await user.type(time, '07:15');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Download the calendar file' }).hasAttribute('disabled'),
      ).toBe(false),
    );

    await user.click(screen.getByRole('button', { name: 'Download the calendar file' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const file = save.mock.calls[0]![0];
    expect(file.mime).toBe('text/calendar');
    expect(file.name).toMatch(/^powr-plan-\d{4}-\d{2}-\d{2}\.ics$/);
    const text = new TextDecoder().decode(file.bytes);
    expect(text).toContain('TRIGGER:-PT1H');
    expect(text).toMatch(/UID:[^\r\n]*@powr\.invalid/);
    expect((await screen.findByTestId('calendar-status')).textContent).toContain(
      'Saved to Downloads as',
    );
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('How to add the file to your calendar'),
    );
    const record = await container.deps.uow.read(['meta'], (repos) =>
      repos.meta.get('calendarExport'),
    );
    expect(record?.value).toMatchObject({ host: 'powr.invalid' });
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('device support (PWA-13) and install promotion (PWA-02)', () => {
  it('lists every capability with its status in words and the device-test state', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/settings/device-support');
    expect(await screen.findByRole('heading', { level: 1, name: 'Device support' })).toBeTruthy();
    const rows = await screen.findAllByTestId('device-capability', {}, { timeout: 10_000 });
    expect(rows.length).toBe(11);
    for (const row of rows) expect(within(row).getByRole('heading', { level: 2 })).toBeTruthy();
    expect(screen.getByText(/docs\/device-tests\/S-1-protocol\.md/)).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Alerts while the screen is locked' }).parentElement
          ?.textContent,
      ).not.toContain('Checking'),
    );
    expect(await seriousViolations()).toEqual([]);
  });

  it('offers installing on Home on a later visit, never during a workout', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const prompt = vi.fn<() => Promise<undefined>>(async () => undefined);
    useAppUi.setState({
      installPrompt: Object.assign(new Event('beforeinstallprompt'), {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      }),
    });
    // A later visit (the harness container counts as the first one otherwise).
    const install = { ...container.platform.install, firstVisit: false };
    const later = { ...container, platform: { ...container.platform, install } };
    const user = userEvent.setup();
    const view = renderRoute(later, '/');
    expect(await screen.findByTestId('install-promotion')).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect((await screen.findByTestId('install-closed')).textContent).toBe(
      'POWR is being added to your home screen.',
    );
    view.unmount();

    // During a workout: no promotion, even with the browser's prompt waiting.
    useAppUi.setState({
      installPrompt: Object.assign(new Event('beforeinstallprompt'), {
        prompt,
        userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
      }),
    });
    await startWorkout(container.deps, {
      source: { kind: 'freestyle', exerciseIds: ['ex.barbell-bench-press' as ExerciseId] },
      warmups: false,
    });
    renderRoute(later, '/');
    expect(await screen.findByRole('heading', { name: 'Workout in progress' })).toBeTruthy();
    expect(screen.queryByTestId('install-promotion')).toBeNull();
  });
});

describe('recovery screen (DAT-14) and "Update first" (TD-14)', () => {
  it('offers a copy of the data, the diagnostics and trying again, and says the result', async () => {
    const container = await createTestContainer();
    const user = userEvent.setup();
    const retry = vi.fn<() => void>();
    renderWith(
      container,
      <RecoveryScreen
        kind="upgrade"
        onSaveCopy={async () => ({ kind: 'saved', fileName: 'powr-backup-2026-11-25-0900.zip' })}
        onExportDiagnostics={async () => 'powr-diagnostics-202611250900.txt'}
        onRetry={retry}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'POWR could not update your data' }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save a copy of your data' }));
    expect((await screen.findByTestId('recovery-copy-status')).textContent).toContain(
      'powr-backup-2026-11-25-0900.zip',
    );
    await user.click(screen.getByRole('button', { name: 'Export diagnostics' }));
    expect((await screen.findByTestId('recovery-diagnostics-status')).textContent).toContain(
      'powr-diagnostics-202611250900.txt',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(await seriousViolations()).toEqual([]);
  });

  it('offers the waiting update before a workout, and steps aside when declined', async () => {
    const container = await createTestContainer();
    const apply = vi.spyOn(container.serviceWorker, 'applyUpdate');
    useAppUi.setState({ updateAvailable: true });
    const user = userEvent.setup();
    renderWith(container, <UpdateFirstOffer />);
    expect(await screen.findByRole('heading', { name: 'Update before you start?' })).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Update first' }));
    expect(apply).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Start without updating' }));
    expect(screen.queryByTestId('update-first')).toBeNull();
  });
});
