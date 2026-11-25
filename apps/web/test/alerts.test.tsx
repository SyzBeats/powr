import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { NotificationPermissionState, NotificationPort } from '@powr/application';

import { createAnnouncer, LiveAnnouncer } from '#ui/announcer';

import type { Container } from '../src/app/container';
import { AlertsSection } from '../src/features/settings/AlertsSection';
import {
  useScreenWakeLock,
  useTimerAlerts,
  useTimerDisplay,
  useUnlockAudio,
  type TimerState,
} from '../src/hooks/use-timers';
import { formatClock } from '../src/i18n/format';
import { createTestContainer, renderWith, seriousViolations } from './harness';

/** The container with a fake notification port: permission flips on request, nothing is shown. */
async function containerWith(initial: NotificationPermissionState = 'default') {
  const container = await createTestContainer();
  let permission = initial;
  const notifications: NotificationPort = {
    permission: () => permission,
    request: async () => {
      permission = 'granted';
      return permission;
    },
    show: async () => false,
    closeByTag: async () => undefined,
  };
  // The timer kit is a lazy chunk (M3b): load it first, so the screens render without suspending.
  await container.platform.timers.load();
  return {
    ...container,
    platform: { ...container.platform, notifications },
  } satisfies Container;
}

async function storedAlerts(container: Container) {
  return (await container.deps.uow.read(['settings'], (repos) => repos.settings.get()))?.alerts;
}

describe('polite announcer (NFR-A11Y-06)', () => {
  it('is one polite, atomic live region (not a status output) that says the latest of a burst', async () => {
    const container = await createTestContainer();
    const announcer = createAnnouncer({ minGapMs: 50, clearMs: 2000 });
    renderWith(container, <LiveAnnouncer announcer={announcer} />);
    const region = screen.getByTestId('live-announcer');
    expect(region.tagName).toBe('DIV');
    expect(screen.queryByRole('status')).toBeNull();
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');

    act(() => {
      announcer.announce('Rest started, 2 minutes, 30 seconds');
      announcer.announce('Rest started, 2 minutes, 45 seconds');
      announcer.announce('Rest started, 3 minutes');
    });
    expect(region.textContent).toBe('Rest started, 2 minutes, 30 seconds');
    await waitFor(() => expect(region.textContent).toBe('Rest started, 3 minutes'));
  });
});

describe('Settings → Alerts (SET-03, SET-04, SET-10, TMR-06)', () => {
  it('shows the honest status, explains before asking for notifications, and persists every setting', async () => {
    const container = await containerWith('default');
    renderWith(
      container,
      <>
        <LiveAnnouncer />
        <AlertsSection />
      </>,
    );

    const status = await screen.findByTestId('locked-status');
    await waitFor(() => expect(status.textContent).toContain('Alerts while screen is locked:'));
    await waitFor(() => expect(status.textContent).toContain('Limited'));
    expect(status.textContent).toContain('Allow notifications so POWR can tell you');
    expect(screen.getByTestId('notification-permission').textContent).toBe(
      'Notifications: Not allowed yet',
    );
    expect(screen.getByText(/POWR uses notifications only for rest timers/)).toBeTruthy();

    // Requested only by the tap, after the explanation; no device test yet → best effort.
    await userEvent.click(screen.getByRole('button', { name: 'Allow notifications' }));
    await waitFor(() =>
      expect(screen.getByTestId('notification-permission').textContent).toBe(
        'Notifications: Allowed',
      ),
    );
    await waitFor(() => expect(status.textContent).toContain('Limited (best effort)'));
    expect(status.textContent).toContain('This browser has not been tested yet');
    expect(screen.queryByRole('button', { name: 'Allow notifications' })).toBeNull();

    // Defaults: sound, vibration, pre-alert, keep screen on, resting notice on; 3-2-1 off.
    const sound = screen.getByRole('checkbox', { name: 'Sound' });
    expect(sound.getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByRole('checkbox', { name: '3-2-1 countdown beeps' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(screen.getByTestId('wake-lock-status').textContent).toMatch(/^Keep screen on: /);

    await userEvent.click(screen.getByRole('checkbox', { name: '3-2-1 countdown beeps' }));
    await waitFor(async () => expect((await storedAlerts(container))?.countdown).toBe(true));
    await userEvent.click(sound);
    await waitFor(async () => expect((await storedAlerts(container))?.sound).toBe(false));
    // The section re-renders from the live query after the write (wait before the next click,
    // or it would toggle from the stale state).
    await waitFor(() =>
      expect(screen.getByRole<HTMLInputElement>('slider', { name: 'Volume' }).disabled).toBe(true),
    );
    await userEvent.click(sound);
    await waitFor(async () => expect((await storedAlerts(container))?.sound).toBe(true));

    // Volume: saved when the change ends, not on every step.
    const volume = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.change(volume, { target: { value: '70' } });
    fireEvent.change(volume, { target: { value: '60' } });
    expect(await storedAlerts(container)).toMatchObject({ volume: 0.8 });
    fireEvent.pointerUp(volume);
    await waitFor(async () => expect((await storedAlerts(container))?.volume).toBeCloseTo(0.6));
    // The slider shows the stored value once the live query has re-emitted.
    await waitFor(() => expect(volume.getAttribute('aria-valuetext')).toBe('60%'));

    // Pre-alert timing (SET-03, product-owner decision 2026-11-24): 5, 10 or 15 s, default 10 s.
    const timing = screen.getByRole('group', { name: 'Seconds before the end' });
    expect(within(timing).getByRole('button', { name: '10 s' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await userEvent.click(within(timing).getByRole('button', { name: '15 s' }));
    await waitFor(async () => expect((await storedAlerts(container))?.preAlertSeconds).toBe(15));
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Warning before the end of a rest' }),
    );
    await waitFor(async () => expect((await storedAlerts(container))?.preAlert).toBe(false));
    // The section re-renders once the live query re-emitted the stored settings.
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Seconds before the end' })).toBeNull(),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Warning before the end of a rest' }),
    );
    await waitFor(async () => expect((await storedAlerts(container))?.preAlert).toBe(true));

    await userEvent.click(
      screen.getByRole('checkbox', { name: /^Keep the screen on during workouts/ }),
    );
    await waitFor(async () => expect((await storedAlerts(container))?.keepScreenOn).toBe(false));
    await waitFor(() =>
      expect(screen.getByTestId('wake-lock-status').textContent).toBe('Keep screen on: Off.'),
    );

    expect(await storedAlerts(container)).toEqual({
      sound: true,
      volume: 0.6,
      vibration: true,
      preAlert: true,
      preAlertSeconds: 15,
      countdown: true,
      restingNotice: true,
      keepScreenOn: false,
    });
    expect(await seriousViolations()).toEqual([]);
  });

  it('plays a test alert in every channel and announces it politely', async () => {
    const container = await containerWith('granted');
    renderWith(
      container,
      <>
        <LiveAnnouncer />
        <AlertsSection />
      </>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Test alert' }));
    await waitFor(() =>
      expect(screen.getByTestId('test-alert-result').textContent).toContain('Rest over'),
    );
    expect(screen.getByTestId('live-announcer').textContent).toBe('Test alert: rest over');
  });

  it('says "Not supported" when notifications are blocked, with the way to unblock', async () => {
    const container = await containerWith('denied');
    renderWith(container, <AlertsSection />);
    const status = await screen.findByTestId('locked-status');
    await waitFor(() => expect(status.textContent).toContain('Not supported'));
    expect(status.textContent).toContain("in the browser's site settings");
    expect(screen.getByTestId('notification-permission').textContent).toBe(
      'Notifications: Blocked',
    );
  });
});

function TimerProbe({ initial }: { initial: TimerState | null }) {
  const [timer, setTimer] = useState(initial);
  const display = useTimerDisplay(timer);
  const { endedWhileHidden } = useTimerAlerts(timer);
  const wakeLock = useScreenWakeLock(timer !== null);
  const unlockAudio = useUnlockAudio();
  const [audio, setAudio] = useState<string>('locked');
  return (
    <div>
      <p data-testid="probe-clock">
        {display.done
          ? `done +${formatClock(display.overMs, 'down')}`
          : formatClock(display.remainingMs)}
      </p>
      <p data-testid="probe-phase">{display.phase}</p>
      <p data-testid="probe-hidden">{String(endedWhileHidden)}</p>
      <p data-testid="probe-wake-lock">{wakeLock.state}</p>
      <button type="button" onClick={() => setTimer(null)}>
        Skip
      </button>
      <button
        type="button"
        onClick={() =>
          setTimer({
            id: 'rest-next',
            kind: 'rest',
            mode: 'countdown',
            startedAtEpochMs: Date.now(),
            targetMs: 75_000,
            adjustMs: 0,
            fired: {},
          })
        }
      >
        Next rest
      </button>
      {/* M3b: the "Start session" tap unlocks audio (autoplay policy, §8.8.2). */}
      <button type="button" onClick={() => void unlockAudio().then((ok) => setAudio(String(ok)))}>
        Start
      </button>
      <p data-testid="probe-audio">{audio}</p>
    </div>
  );
}

describe('timer hooks for the session screen (M3b)', () => {
  it('display the remaining time from timestamps and announce the start politely', async () => {
    const container = await containerWith('granted');
    const timer: TimerState = {
      id: 'rest-1',
      kind: 'rest',
      mode: 'countdown',
      startedAtEpochMs: Date.now() - 60_000,
      targetMs: 150_000,
      adjustMs: 0,
      fired: {},
    };
    renderWith(
      container,
      <>
        <LiveAnnouncer />
        <TimerProbe initial={timer} />
      </>,
    );
    expect(screen.getByTestId('probe-clock').textContent).toMatch(/^1:(29|30)$/);
    expect(screen.getByTestId('probe-phase').textContent).toBe('running');
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() =>
      expect(screen.getByTestId('probe-audio').textContent).toMatch(/^(true|false)$/),
    );
    // Announced when the scheduler chunk armed the rest: on a loaded test machine the dev server
    // may take a few seconds to serve that chunk the first time, so the remainder is a range.
    await waitFor(() =>
      expect(screen.getByTestId('live-announcer').textContent).toMatch(
        /^Rest started, 1 minute, ([12]\d|30) seconds$/,
      ),
    );
    // 4 Hz while visible: the clock moves on without any state write.
    await waitFor(
      () => expect(screen.getByTestId('probe-clock').textContent).toMatch(/^1:2[0-8]$/),
      {
        timeout: 3000,
      },
    );
    // The next rest (scheduler already loaded) is announced too.
    await userEvent.click(screen.getByRole('button', { name: 'Next rest' }));
    await waitFor(() =>
      expect(screen.getByTestId('live-announcer').textContent).toMatch(
        /^Rest started, 1 minute, 1[45] seconds$/,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByTestId('probe-phase').textContent).toBe('idle');
  });

  it('a timer that ended before it was armed (a reload) shows done with the time since the end', async () => {
    const container = await containerWith('granted');
    const timer: TimerState = {
      id: 'rest-2',
      kind: 'rest',
      mode: 'countdown',
      startedAtEpochMs: Date.now() - 192_000,
      targetMs: 150_000,
      adjustMs: 0,
      fired: {},
    };
    renderWith(container, <TimerProbe initial={timer} />);
    expect(screen.getByTestId('probe-clock').textContent).toMatch(/^done \+0:4[12]$/);
    expect(screen.getByTestId('probe-phase').textContent).toBe('done');
  });
});
