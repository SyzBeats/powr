import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  dispatch,
  finishWorkout,
  startWorkout,
  type PlatformEffect,
} from '@powr/application/session';
import type { ExerciseId, LocalDate, SessionId, SetId } from '@powr/domain';
import type { PrRecord } from '@powr/domain/session';

import type { Container } from '../src/app/container';
import { runPlatformEffects, type EffectEnvironment } from '../src/features/session/commands';
import { resetSessionUi, useSessionUi } from '../src/features/session/session-ui';
import { Stepper } from '../src/ui/stepper';
import { TimerRing } from '../src/ui/timer-ring';
import {
  createTestContainer,
  onboarded,
  renderRoute,
  renderWith,
  seriousViolations,
} from './harness';

/*
 * The session screen's parts (M3b): the stepper and the effort chips (WKT-03, NFR-USE-01), the
 * timer ring (TMR-03/04), the logging card with its dock (WKT-02, TMR-01) and the global mini
 * timer (TMR-12).
 */

const BENCH = 'ex.barbell-bench-press' as ExerciseId;

/** An onboarded user with a running freestyle bench-press workout, past the check-in. */
async function benchWorkout(): Promise<{
  container: Container;
  cursor: { slotKey: string; setKey: string };
}> {
  const container = await createTestContainer();
  await onboarded(container);
  const started = await startWorkout(container.deps, {
    source: { kind: 'freestyle', exerciseIds: [BENCH] },
    warmups: false,
  });
  if (!started.ok) throw new Error(`start: ${started.error.kind}`);
  const skipped = await dispatch(container.deps, { type: 'READINESS', items: null });
  if (!skipped.ok) throw new Error(`check-in: ${skipped.error.kind}`);
  const cursor = skipped.value.view.session.cursor;
  if (!cursor) throw new Error('no cursor');
  await container.platform.timers.load();
  return { container, cursor };
}

function StepperProbe({ initial }: { initial: number | null }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Stepper
        label="Weight (kg)"
        value={value}
        onChange={setValue}
        onStep={(direction, current) => (current ?? 0) + direction * 2.5}
        decrementLabel="Less weight"
        incrementLabel="More weight"
        max={300}
      />
      <output data-testid="value">{String(value)}</output>
    </>
  );
}

beforeEach(() => {
  resetSessionUi();
  useSessionUi.setState({ runtimeFor: null, deloadCheck: null });
});

/** A fake effect environment that records what the runner did. */
function environment(settings: EffectEnvironment['settings'], calls: string[]) {
  const env: EffectEnvironment = {
    kit: {
      restAlerts: {
        disarm: (id: string) => {
          calls.push(`disarm ${id}`);
        },
      } as unknown as EffectEnvironment['kit']['restAlerts'],
      audio: {
        play: (cue: string, volume: number) => {
          calls.push(`play ${cue} ${volume}`);
        },
      } as unknown as EffectEnvironment['kit']['audio'],
    },
    vibrate: (pattern) => calls.push(`vibrate ${pattern.join(',')}`),
    settings,
    words: {
      announcement: (item) => (item.kind === 'setLogged' ? 'Bench, set 1 logged.' : null),
      pr: (record) => `New ${record.type} PR.`,
    },
    announce: (text) => calls.push(`announce ${text}`),
    celebrate: (prs) => calls.push(`celebrate ${prs.map((entry) => entry.id).join(',')}`),
  };
  return env;
}

describe('effect runner (§8.5: M3a effects on M3t)', () => {
  const pr: PrRecord = {
    id: 'set-1.rep',
    type: 'rep',
    exerciseId: BENCH,
    sessionId: 'session-1' as SessionId,
    setId: 'set-1' as SetId,
    localDate: '2026-11-23' as LocalDate,
    reps: 5,
    valueKg: 100,
    previousKg: 95,
  };
  const effects: PlatformEffect[] = [
    { kind: 'timer.disarm', timerId: 'rest-1' },
    {
      kind: 'timer.arm',
      timer: {
        id: 'rest-2',
        kind: 'rest',
        mode: 'countdown',
        startedAtEpochMs: 0,
        targetMs: 120_000,
        adjustMs: 0,
        fired: {},
      },
    },
    { kind: 'wakeLock', action: 'acquire' },
    { kind: 'cue', cue: 'setConfirmed' },
    { kind: 'celebrate', prs: [pr] },
    { kind: 'announce', announcement: { kind: 'setLogged', slotKey: 's1', setKey: 'w1' } },
    { kind: 'announce', announcement: { kind: 'restStarted', seconds: 120 } },
  ];

  it('disarms at once, leaves arming and the wake lock to the hooks, celebrates and announces once', () => {
    const calls: string[] = [];
    runPlatformEffects(
      effects,
      null,
      environment({ sound: true, volume: 0.8, vibration: true }, calls),
    );
    expect(calls).toEqual([
      'disarm rest-1',
      'vibrate 20',
      'celebrate set-1.rep',
      'vibrate 30,40,60',
      'play pr 0.8',
      // One polite announcement per event, the parts joined (rests are announced by the alerts).
      'announce New rep PR. Bench, set 1 logged.',
    ]);
  });

  it('respects sound and vibration off', () => {
    const calls: string[] = [];
    runPlatformEffects(
      effects,
      null,
      environment({ sound: false, volume: 0.8, vibration: false }, calls),
    );
    expect(calls).toEqual([
      'disarm rest-1',
      'celebrate set-1.rep',
      'announce New rep PR. Bench, set 1 logged.',
    ]);
  });
});

describe('stepper (WKT-03, NFR-USE-01)', () => {
  it('steps with 48 px named buttons, takes a typed decimal with a comma and clamps at 0', async () => {
    const container = await createTestContainer();
    renderWith(container, <StepperProbe initial={2.5} />);
    const input = screen.getByRole('textbox', { name: 'Weight (kg)' });
    const less = screen.getByRole('button', { name: 'Less weight' });
    const more = screen.getByRole('button', { name: 'More weight' });
    expect(input.getAttribute('inputmode')).toBe('decimal');
    for (const button of [less, more, input]) {
      const box = button.getBoundingClientRect();
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.width).toBeGreaterThanOrEqual(48);
    }

    await userEvent.click(more);
    expect(screen.getByTestId('value').textContent).toBe('5');
    await userEvent.click(less);
    await userEvent.click(less);
    expect(screen.getByTestId('value').textContent).toBe('0');
    expect((less as HTMLButtonElement).disabled).toBe(true);

    await userEvent.clear(input);
    await userEvent.type(input, '102,5');
    expect(screen.getByTestId('value').textContent).toBe('102.5');
    // The text stays as typed while it means the value.
    expect((input as HTMLInputElement).value).toBe('102,5');
    await userEvent.clear(input);
    expect(screen.getByTestId('value').textContent).toBe('null');
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('timer ring (TMR-03, TMR-04)', () => {
  it('draws the progress, fills it when done and stays decorative', async () => {
    const container = await createTestContainer();
    const view = renderWith(container, <TimerRing progress={0.25} done={false} size={48} />);
    const svg = view.container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    const [, bar] = view.container.querySelectorAll('circle');
    const circumference = Number(bar!.getAttribute('stroke-dasharray'));
    expect(Number(bar!.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.75, 3);
    expect(view.container.querySelector('[data-done]')).toBeNull();

    view.rerender(<TimerRing progress={0.4} done size={48} />);
    // Done: full ring and a different colour (never colour alone, no animation).
    expect(view.container.querySelector('[data-done]')).not.toBeNull();
    expect(
      Number(view.container.querySelectorAll('circle')[1]!.getAttribute('stroke-dashoffset')),
    ).toBe(0);
    expect(view.container.querySelectorAll('circle')[1]!.getAttribute('class')).toContain(
      'stroke-success',
    );
  });
});

describe('logging card and dock (WKT-02, WKT-03, TMR-01)', () => {
  it('shows the current set, takes weight, reps and effort in the dock and starts the rest', async () => {
    const { container } = await benchWorkout();
    renderRoute(container, '/session');

    expect(await screen.findByRole('heading', { level: 1, name: 'Workout' })).toBeTruthy();
    const card = await screen.findByTestId('current-set');
    expect(within(card).getByRole('heading', { level: 2 }).textContent).toBe('Barbell bench press');
    expect(card.textContent).toMatch(/Set 1 of \d/);
    // PRG-08: no history yet, so the user picks the starting weight.
    expect(card.textContent).toContain('Pick a starting weight');
    expect(within(card).getByRole('button', { name: /^Why\?/ })).toBeTruthy();

    const dock = screen.getByRole('region', { name: 'Log this set' });
    const confirm = within(dock).getByRole('button', { name: 'Confirm set' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(dock.textContent).toContain('Enter the weight first.');
    expect(await seriousViolations()).toEqual([]);

    await userEvent.type(within(dock).getByRole('textbox', { name: 'Weight (kg)' }), '60');
    const reps = within(dock).getByRole('textbox', { name: 'Reps' });
    await userEvent.clear(reps);
    await userEvent.type(reps, '10');

    // WKT-03 chips: 0, 1, 2, 3, 4, 5+ (one pressed at a time).
    const chips = within(dock).getByRole('group', { name: /^Reps in reserve/ });
    for (const name of ['0', '1', '2', '3', '4', '5 or more'])
      expect(within(chips).getByRole('button', { name })).toBeTruthy();
    await userEvent.click(within(chips).getByRole('button', { name: '5 or more' }));
    expect(
      within(chips).getByRole('button', { name: '5 or more' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await userEvent.click(within(chips).getByRole('button', { name: '2' }));
    expect(within(chips).getByRole('button', { name: '2' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      within(chips).getByRole('button', { name: '5 or more' }).getAttribute('aria-pressed'),
    ).toBe('false');

    await userEvent.click(confirm);
    // The logged row appears once the strict write committed; the rest starts by itself.
    await waitFor(() => expect(screen.getAllByTestId('logged-set')).toHaveLength(1));
    expect(screen.getByTestId('logged-set').textContent).toContain('60 kg × 10 @ RIR 2');
    // The card of the next set mounts its own dock.
    const next = screen.getByRole('region', { name: 'Log this set' });
    // WCAG 2.4.3: focus stays in the dock, on the next set's "Confirm set".
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(next).getByRole('button', { name: 'Confirm set' }),
      ),
    );
    const time = await within(next).findByTestId('timer-time');
    expect(time.textContent).toMatch(/^\d:\d\d$/);
    expect(within(next).getByRole('button', { name: '+15 seconds' })).toBeTruthy();
    expect(within(next).getByRole('button', { name: 'Skip rest' })).toBeTruthy();
    expect(within(next).getByRole('button', { name: 'Undo' })).toBeTruthy();
    // PRG-08: the next calibration set is loaded from the first one's e1RM.
    expect(
      Number(within(next).getByRole<HTMLInputElement>('textbox', { name: 'Weight (kg)' }).value),
    ).toBeGreaterThan(0);
    expect(next.textContent).not.toContain('Enter the weight first.');
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('global mini timer (TMR-12)', () => {
  it('shows the running rest on another screen and leads back to the workout', async () => {
    const { container, cursor } = await benchWorkout();
    const session = renderRoute(container, '/settings');
    // Without a timer: the session clock (TMR-11).
    const idle = await screen.findByTestId('mini-timer');
    expect(idle.textContent).toContain('Workout in progress');
    expect(idle.textContent).toMatch(/\d:\d\d/);
    expect(idle.getAttribute('href')).toBe('/session');
    session.unmount();

    const confirmed = await dispatch(container.deps, {
      type: 'CONFIRM_SET',
      slotKey: cursor.slotKey,
      setKey: cursor.setKey,
      values: { load: { value: 60, unit: 'kg' }, reps: 10, rir: 2 },
    });
    expect(confirmed.ok).toBe(true);

    renderRoute(container, '/plan');
    const mini = await screen.findByTestId('mini-timer');
    await waitFor(() => expect(mini.textContent).toContain('Resting · Barbell bench press'));
    expect(mini.textContent).toMatch(/\d:\d\d/);
    expect(mini.textContent).toContain('Back to workout');
    expect(mini.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(mini);
    expect(await screen.findByRole('heading', { level: 1, name: 'Workout' })).toBeTruthy();
    // On the session screen itself the dock shows the timer instead.
    expect(screen.queryByTestId('mini-timer')).toBeNull();
  });
});

describe('finish on real IndexedDB (WKT-13, PLN: the planned session is marked done)', () => {
  it('finishes a planned session in one transaction (regression: PrematureCommitError)', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    const planned = await container.deps.uow.read(['plannedSessions'], (repos) =>
      repos.plannedSessions.inRange('2000-01-01' as LocalDate, '2100-01-01' as LocalDate),
    );
    const first = planned[0];
    if (!first) throw new Error('no planned session');
    const started = await startWorkout(container.deps, {
      source: { kind: 'planned', plannedSessionId: first.id },
    });
    if (!started.ok) throw new Error(`start: ${started.error.kind}`);
    const cursor = started.value.view.session.cursor;
    if (!cursor) throw new Error('no cursor');
    const confirmed = await dispatch(container.deps, {
      type: 'CONFIRM_SET',
      slotKey: cursor.slotKey,
      setKey: cursor.setKey,
      values: { load: { value: 40, unit: 'kg' }, reps: 8, rir: 2 },
    });
    expect(confirmed.ok).toBe(true);

    const finished = await finishWorkout(container.deps, { as: 'finished' });
    expect(finished.ok).toBe(true);
    const after = await container.deps.uow.read(['plannedSessions'], (repos) =>
      repos.plannedSessions.get(first.id),
    );
    expect(after?.status).toBe('done');
  });
});
