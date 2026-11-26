import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { dispatch, startWorkout } from '@powr/application/session';
import type { ExerciseId } from '@powr/domain';
import type { SettingsRecord } from '@powr/formats';

import type { Container } from '../src/app/container';
import { resetSessionUi, useSessionUi } from '../src/features/session/session-ui';
import { i18n } from '../src/i18n';
import { messages } from '../src/i18n/locales/en/messages.po';
import { createTestContainer, onboarded, renderRoute, seriousViolations } from './harness';

/**
 * "Start set timer" once it is enabled: it stays disabled until the alert settings have loaded,
 * so a click cannot race the live query (on a slow CI runner it otherwise could, and skipped the
 * lead-in).
 */
async function startSetTimerButton(
  dock: HTMLElement,
  name: string | RegExp = 'Start set timer',
): Promise<HTMLButtonElement> {
  return waitFor(() => {
    const button = within(dock).getByRole<HTMLButtonElement>('button', { name });
    expect(button.disabled).toBe(false);
    return button;
  });
}

/*
 * M4v timer extras on the session screen: the 3-2-1 lead-in before a timed set and the automatic
 * stop at the target (TMR-09, TD-48), and the tempo metronome (TMR-10, TD-39), with their
 * switches in Settings → Workout. Real time, short targets: the drivers' timing is covered on a
 * fake clock in src/infrastructure/alerts/metronome.test.ts.
 */

const BENCH = 'ex.barbell-bench-press' as ExerciseId;
const LEG_RAISE = 'ex.hanging-leg-raise' as ExerciseId;

type Alerts = NonNullable<SettingsRecord['alerts']>;
const ALERTS: Alerts = {
  sound: true,
  volume: 0.8,
  vibration: true,
  preAlert: true,
  preAlertSeconds: 10,
  countdown: false,
  restingNotice: true,
  keepScreenOn: true,
};

async function storeAlerts(container: Container, patch: Partial<Alerts>): Promise<void> {
  await container.deps.uow.write(['settings'], async (repos) => {
    const current = await repos.settings.get();
    await repos.settings.put({
      ...current,
      id: 'me',
      theme: current?.theme ?? 'system',
      alerts: { ...ALERTS, ...patch },
    });
  });
}

async function storedAlerts(container: Container) {
  return (await container.deps.uow.read(['settings'], (repos) => repos.settings.get()))?.alerts;
}

async function storedTimer(container: Container) {
  const active = await container.deps.uow.read(['sessions'], (repos) => repos.sessions.getActive());
  return active?.timer ?? null;
}

/** An onboarded user in a freestyle workout past the check-in; `timedS` makes its sets timed. */
async function workout(
  exerciseId: ExerciseId,
  alerts: Partial<Alerts>,
  timedS?: number,
): Promise<Container> {
  const container = await createTestContainer();
  await onboarded(container);
  await storeAlerts(container, alerts);
  const started = await startWorkout(container.deps, {
    source: { kind: 'freestyle', exerciseIds: [exerciseId] },
    warmups: false,
  });
  if (!started.ok) throw new Error(`start: ${started.error.kind}`);
  const skipped = await dispatch(container.deps, { type: 'READINESS', items: null });
  if (!skipped.ok) throw new Error(`check-in: ${skipped.error.kind}`);
  const cursor = skipped.value.view.session.cursor;
  if (!cursor) throw new Error('no cursor');
  if (timedS !== undefined) {
    const changed = await dispatch(container.deps, {
      type: 'CHANGE_PRESCRIPTION',
      slotKey: cursor.slotKey,
      change: { durationS: timedS },
    });
    if (!changed.ok) throw new Error(`timed: ${changed.error.kind}`);
  }
  await container.platform.timers.load();
  return container;
}

/** Every text the shell's polite live region showed, in order (one per announcement). */
async function recordAnnouncements(): Promise<string[]> {
  const region = await screen.findByTestId('live-announcer');
  const said: string[] = [];
  const observer = new MutationObserver(() => {
    const text = region.textContent ?? '';
    if (text !== '' && said.at(-1) !== text) said.push(text);
  });
  observer.observe(region, { childList: true, characterData: true, subtree: true });
  return said;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  resetSessionUi();
  useSessionUi.setState({ runtimeFor: null, deloadCheck: null, focusSetTimer: false });
});

describe('Settings → Workout: timed sets and tempo (M4v)', () => {
  it('stores the three switches, all off by default', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/settings');
    const group = await screen.findByRole('group', { name: 'Timed sets and tempo' });
    const leadIn = within(group).getByRole('checkbox', { name: /^Count down 3-2-1/ });
    const autoStop = within(group).getByRole('checkbox', { name: /^Stop the set timer/ });
    const tempo = within(group).getByRole('checkbox', { name: /^Tempo cues/ });
    for (const box of [leadIn, autoStop, tempo])
      expect(box.getAttribute('aria-checked')).toBe('false');
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(leadIn);
    await waitFor(async () => expect((await storedAlerts(container))?.setTimerLeadIn).toBe(true));
    // Wait for the live query to re-render before the next click (it writes the whole object).
    await waitFor(() => expect(leadIn.getAttribute('aria-checked')).toBe('true'));
    await userEvent.click(autoStop);
    await waitFor(async () =>
      expect(await storedAlerts(container)).toMatchObject({
        setTimerLeadIn: true,
        setTimerAutoStop: true,
      }),
    );
    await waitFor(() => expect(autoStop.getAttribute('aria-checked')).toBe('true'));
    await userEvent.click(tempo);
    await waitFor(async () =>
      expect(await storedAlerts(container)).toMatchObject({
        setTimerLeadIn: true,
        setTimerAutoStop: true,
        tempoCues: true,
        // The alert switches stay as they were.
        sound: true,
        preAlertSeconds: 10,
      }),
    );
  });
});

describe('3-2-1 lead-in before a timed set (TMR-09, TD-48)', () => {
  it('counts 3, 2, 1, then starts the set timer; focus goes Cancel → Stop', async () => {
    const container = await workout(LEG_RAISE, { setTimerLeadIn: true }, 20);
    renderRoute(container, '/session');
    const said = await recordAnnouncements();
    const dock = await screen.findByRole('region', { name: 'Log this set' });
    await userEvent.click(await startSetTimerButton(dock));

    // The count renders once the click's state update lands (slower under a full parallel run).
    // The count stays on screen for the whole 3 s lead-in, so a 2.5 s wait is safe and keeps the
    // test meaningful when the browser project runs next to the full suite.
    const count = await within(dock).findByTestId('lead-in-count', {}, { timeout: 2500 });
    expect(count.textContent).toBe('3');
    const cancel = within(dock).getByRole('button', { name: 'Cancel' });
    expect(cancel.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(await storedTimer(container)).toBeNull();
    expect(await seriousViolations()).toEqual([]);
    await waitFor(() => expect(count.textContent).toBe('2'), { timeout: 2000 });
    await waitFor(() => expect(count.textContent).toBe('1'), { timeout: 2000 });

    const stop = await within(dock).findByRole('button', { name: 'Stop' }, { timeout: 3000 });
    expect(within(dock).queryByTestId('lead-in')).toBeNull();
    expect(await storedTimer(container)).toMatchObject({
      kind: 'set',
      mode: 'countdown',
      targetMs: 20_000,
    });
    await waitFor(() => expect(document.activeElement).toBe(stop));
    // One announcement for the lead-in (never per count), then the timer's own.
    await waitFor(() => expect(said.at(-1)).toMatch(/^Set timer started, (19|20) seconds$/));
    expect(said.filter((text) => text.startsWith('Set timer starts'))).toEqual([
      'Set timer starts in 3 seconds',
    ]);
    expect(said.some((text) => /^[123]$/.test(text))).toBe(false);
  });

  it('Cancel stops the count and no timer starts; with the switch off the timer starts at once', async () => {
    const container = await workout(LEG_RAISE, { setTimerLeadIn: true }, 20);
    const view = renderRoute(container, '/session');
    const dock = await screen.findByRole('region', { name: 'Log this set' });
    await userEvent.click(await startSetTimerButton(dock));
    await userEvent.click(await within(dock).findByRole('button', { name: 'Cancel' }));
    expect(within(dock).queryByTestId('lead-in')).toBeNull();
    expect(within(dock).getByRole('button', { name: 'Start set timer' })).toBeTruthy();
    await sleep(3300);
    expect(await storedTimer(container)).toBeNull();
    expect(within(dock).queryByRole('button', { name: 'Stop' })).toBeNull();
    view.unmount();

    const plain = await workout(LEG_RAISE, { setTimerLeadIn: false }, 20);
    renderRoute(plain, '/session');
    const plainDock = await screen.findByRole('region', { name: 'Log this set' });
    await userEvent.click(await startSetTimerButton(plainDock));
    expect(within(plainDock).queryByTestId('lead-in')).toBeNull();
    await within(plainDock).findByRole('button', { name: 'Stop' });
    expect(await storedTimer(plain)).toMatchObject({ kind: 'set', targetMs: 20_000 });
  });
});

describe('set timer stops at the target (TMR-09, TD-48)', () => {
  it('stops by itself after the end alert and enters the target, not the overrun', async () => {
    const container = await workout(LEG_RAISE, { setTimerAutoStop: true }, 2);
    renderRoute(container, '/session');
    const said = await recordAnnouncements();
    const dock = await screen.findByRole('region', { name: 'Log this set' });
    await userEvent.click(await startSetTimerButton(dock));
    await within(dock).findByRole('button', { name: 'Stop' });
    // The user types something else meanwhile: the stop at the target replaces it.
    const seconds = within(dock).getByRole<HTMLInputElement>('textbox', { name: 'Seconds' });
    await userEvent.clear(seconds);
    await userEvent.type(seconds, '9');

    await waitFor(() => expect(within(dock).queryByRole('button', { name: 'Stop' })).toBeNull(), {
      timeout: 10_000,
    });
    expect(seconds.value).toBe('2');
    expect(await storedTimer(container)).toBeNull();
    await waitFor(() => expect(said.at(-1)).toBe('Time is up, set timer stopped at 2 seconds'));
    expect(within(dock).getByRole('button', { name: 'Start set timer' })).toBeTruthy();
  });

  it('runs on past the target while the switch is off (the user taps Stop)', async () => {
    const container = await workout(LEG_RAISE, { setTimerAutoStop: false }, 1);
    renderRoute(container, '/session');
    const dock = await screen.findByRole('region', { name: 'Log this set' });
    await userEvent.click(await startSetTimerButton(dock));
    await waitFor(
      () => expect(within(dock).getByTestId('timer-time').textContent).toMatch(/^Time is up/),
      { timeout: 5000 },
    );
    // The end has fired (recorded in the session), and the timer still runs.
    await waitFor(async () => expect((await storedTimer(container))?.fired.end).toBe(true), {
      timeout: 5000,
    });
    await sleep(800);
    expect(within(dock).getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(await storedTimer(container)).not.toBeNull();
  });
});

describe('tempo cues (TMR-10, TD-39)', () => {
  it('appear only with the switch on and a tempo; start and stop with one toggle and two announcements', async () => {
    const off = await workout(BENCH, { tempoCues: false });
    const offView = renderRoute(off, '/session');
    await screen.findByTestId('current-set');
    // Give the settings' live query time to arrive: absence must not be a loading artefact.
    await sleep(600);
    expect(screen.queryByRole('button', { name: /^Tempo cues/ })).toBeNull();
    offView.unmount();

    const container = await workout(BENCH, { tempoCues: true });
    renderRoute(container, '/session');
    const said = await recordAnnouncements();
    const card = await screen.findByTestId('current-set');
    const toggle = await within(card).findByRole('button', { name: 'Tempo cues 2-0-X-0' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    const metronome = container.platform.timers.current()!.metronome;

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    // The same name; the state is in aria-pressed.
    expect(within(card).getByRole('button', { name: 'Tempo cues 2-0-X-0' })).toBe(toggle);
    expect(metronome.state().running).toBe(true);
    const phase = within(card).getByTestId('tempo-phase');
    expect(phase.getAttribute('aria-hidden')).toBe('true');
    await waitFor(() => expect(phase.textContent).toMatch(/^Rep 1 · (Lower|Lift)$/), {
      timeout: 2000,
    });
    await waitFor(() => expect(said).toContain('Tempo cues on, 2-0-X-0'));
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(metronome.state().running).toBe(false);
    expect(within(card).queryByTestId('tempo-phase')).toBeNull();
    await waitFor(() => expect(said.at(-1)).toBe('Tempo cues off'));
    // Never per beat.
    expect(said.filter((text) => text.startsWith('Tempo cues'))).toEqual([
      'Tempo cues on, 2-0-X-0',
      'Tempo cues off',
    ]);
  });

  it('stops silently when the set is confirmed (the set announcement stays)', async () => {
    const container = await workout(BENCH, { tempoCues: true });
    renderRoute(container, '/session');
    const said = await recordAnnouncements();
    const card = await screen.findByTestId('current-set');
    await userEvent.click(await within(card).findByRole('button', { name: 'Tempo cues 2-0-X-0' }));
    const metronome = container.platform.timers.current()!.metronome;
    expect(metronome.state().running).toBe(true);

    const dock = screen.getByRole('region', { name: 'Log this set' });
    await userEvent.type(within(dock).getByRole('textbox', { name: 'Weight (kg)' }), '60');
    await userEvent.click(within(dock).getByRole('button', { name: 'Confirm set' }));
    await waitFor(() => expect(screen.getAllByTestId('logged-set')).toHaveLength(1));
    await waitFor(() => expect(metronome.state().running).toBe(false));
    // The next set offers the control again, off.
    const next = await screen.findByRole('button', { name: 'Tempo cues 2-0-X-0' });
    expect(next.getAttribute('aria-pressed')).toBe('false');
    await sleep(1200);
    expect(said).not.toContain('Tempo cues off');
  });

  it('is not offered for a timed set', async () => {
    const container = await workout(LEG_RAISE, { tempoCues: true }, 20);
    renderRoute(container, '/session');
    await screen.findByTestId('current-set');
    await sleep(600);
    expect(screen.queryByRole('button', { name: /^Tempo cues/ })).toBeNull();
  });
});

/*
 * NFR-L10N-02: the new controls with every English string 30% longer (as in
 * test/pseudo-locale.test.tsx) still fit 360 px.
 */
type Compiled = (typeof messages)[string];

function expand(text: string): string {
  if (text.trim() === '') return text;
  const words = Array.from({ length: Math.ceil(Math.ceil(text.length * 0.3) / 6) }, () => 'ẍàñđé');
  return `${text} ${words.join(' ')}`;
}

function expandMessage(message: Compiled): Compiled {
  if (typeof message === 'string') return expand(message);
  if (Array.isArray(message))
    return message.map((part) => (typeof part === 'string' ? expand(part) : part)) as Compiled;
  return message;
}

function overflows(): string[] {
  const width = document.documentElement.clientWidth;
  const problems: string[] = [];
  if (document.documentElement.scrollWidth > width + 1)
    problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${width}`);
  for (const element of document.querySelectorAll<HTMLElement>('button, a, label, h1, h2, h3')) {
    if (
      element.scrollWidth > element.clientWidth + 1 &&
      getComputedStyle(element).overflow !== 'visible'
    )
      problems.push(`clipped: "${element.textContent?.slice(0, 40)}"`);
    if (element.getBoundingClientRect().right > width + 1)
      problems.push(`off-screen: "${element.textContent?.slice(0, 40)}"`);
  }
  return problems;
}

describe('pseudo-locale expansion (+30%, NFR-L10N-02)', () => {
  beforeEach(() => {
    i18n.load(
      'en-x-expanded',
      Object.fromEntries(Object.entries(messages).map(([id, text]) => [id, expandMessage(text)])),
    );
    i18n.activate('en-x-expanded');
    return () => i18n.activate('en');
  });

  it('the settings group, the tempo control and the lead-in fit 360 px', async () => {
    const settings = await createTestContainer();
    await onboarded(settings);
    const settingsView = renderRoute(settings, '/settings');
    await screen.findByRole('group', { name: /^Timed sets and tempo/ });
    expect({ settings: overflows() }).toEqual({ settings: [] });
    settingsView.unmount();

    const tempo = await workout(BENCH, { tempoCues: true });
    const tempoView = renderRoute(tempo, '/session');
    const card = await screen.findByTestId('current-set');
    await userEvent.click(await within(card).findByRole('button', { name: /^Tempo cues/ }));
    await waitFor(() =>
      expect(within(card).getByTestId('tempo-phase').textContent).toContain('ẍàñđé'),
    );
    expect({ tempo: overflows() }).toEqual({ tempo: [] });
    tempoView.unmount();

    const timed = await workout(LEG_RAISE, { setTimerLeadIn: true }, 20);
    renderRoute(timed, '/session');
    const dock = await screen.findByRole('region', { name: /^Log this set/ });
    await userEvent.click(await startSetTimerButton(dock, /^Start set timer/));
    expect((await within(dock).findByTestId('lead-in-count')).textContent).toBe('3');
    expect({ leadIn: overflows() }).toEqual({ leadIn: [] });
    await userEvent.click(within(dock).getByRole('button', { name: /^Cancel/ }));
  });
});
