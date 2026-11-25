import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { logBodyweight, logMeasurement } from '@powr/application/insights';
import { dispatch, finishWorkout, startWorkout } from '@powr/application/session';
import type { ExerciseId, SessionId } from '@powr/domain';

import type { Container } from '../src/app/container';
import { i18n } from '../src/i18n';
import { messages } from '../src/i18n/locales/en/messages.po';
import { createTestContainer, onboarded, renderRoute } from './harness';

/**
 * NFR-L10N-02 for the M4 screens: with every English message about 30% longer (as in
 * `pseudo-locale.test.tsx`), Home, Explore, the body map, Progress, the bodyweight screens, the
 * streak, Settings, Data and the summary still fit 360 px: no sideways scrolling, no clipped or
 * off-screen buttons, links, labels or headings.
 */
type Compiled = (typeof messages)[string];

function expand(text: string): string {
  if (text.trim() === '') return text;
  const extra = Math.ceil(text.length * 0.3);
  const words = Array.from({ length: Math.ceil(extra / 6) }, () => 'ẍàñđé');
  return `${text} ${words.join(' ')}`;
}

function expandMessage(message: Compiled): Compiled {
  if (typeof message === 'string') return expand(message);
  if (Array.isArray(message))
    return message.map((part) => (typeof part === 'string' ? expand(part) : part)) as Compiled;
  return message;
}

const expanded = Object.fromEntries(
  Object.entries(messages).map(([id, message]) => [id, expandMessage(message)]),
);

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
      problems.push(
        `clipped: ${element.tagName.toLowerCase()} "${element.textContent?.slice(0, 40)}"`,
      );
    if (element.getBoundingClientRect().right > width + 1)
      problems.push(
        `off-screen: ${element.tagName.toLowerCase()} "${element.textContent?.slice(0, 40)}"`,
      );
  }
  return problems;
}

const BENCH = 'ex.barbell-bench-press' as ExerciseId;

async function benchSession(container: Container, load: number): Promise<SessionId> {
  const started = await startWorkout(container.deps, {
    source: { kind: 'freestyle', exerciseIds: [BENCH] },
    warmups: false,
  });
  if (!started.ok) throw new Error(started.error.kind);
  const cursor = started.value.view.session.cursor!;
  await dispatch(container.deps, {
    type: 'CONFIRM_SET',
    slotKey: cursor.slotKey,
    setKey: cursor.setKey,
    values: { load: { value: load, unit: 'kg' }, reps: 5, rir: 2 },
  });
  const finished = await finishWorkout(container.deps, { as: 'finished' });
  if (!finished.ok) throw new Error(finished.error.kind);
  return started.value.view.session.id;
}

/** The screen has its heading and is past its loading states. */
async function ready(): Promise<void> {
  await screen.findByRole('heading', { level: 1 });
  await waitFor(
    () => {
      expect(document.querySelectorAll('main section > :not(h1)').length).toBeGreaterThan(0);
      expect(document.querySelector('main')?.textContent ?? '').not.toMatch(
        /Loading(…| the | your | this )/,
      );
    },
    { timeout: 5000 },
  );
}

/** An onboarded user with two workouts, three weigh-ins and a measurement. */
async function seeded(): Promise<{ container: Container; last: SessionId }> {
  const container = await createTestContainer();
  await onboarded(container);
  await benchSession(container, 80);
  const last = await benchSession(container, 100);
  for (const day of [3, 2, 1]) {
    const epochMs = Date.now() - day * 86_400_000;
    await logBodyweight(container.deps, {
      mass: { value: 82 + day / 10, unit: 'kg' },
      measuredAt: { epochMs, offsetMin: 0, zone: 'UTC' },
    });
  }
  await logMeasurement(container.deps, { site: 'waist', value: 84.5, unit: 'cm' });
  return { container, last };
}

/** Renders each route and collects what overflows at 360 px. */
async function problemsOf(
  container: Container,
  routes: readonly string[],
): Promise<Record<string, string[]>> {
  const problems: Record<string, string[]> = {};
  for (const path of routes) {
    const view = renderRoute(container, path);
    await ready();
    // The expanded catalog is the one in use.
    expect(document.body.textContent).toContain('ẍàñđé');
    const found = overflows();
    if (found.length > 0) problems[path] = found;
    view.unmount();
  }
  return problems;
}

describe('pseudo-locale expansion on the M4 screens (+30%, NFR-L10N-02)', () => {
  beforeEach(() => {
    i18n.load('en-x-expanded', expanded);
    i18n.activate('en-x-expanded');
  });
  afterEach(() => {
    i18n.activate('en');
  });

  it('Home, the streak, bodyweight, the summary, Settings and Data fit 360 px', async () => {
    const { container, last } = await seeded();
    const problems = await problemsOf(container, [
      '/',
      '/progress/streak',
      '/body',
      '/body/log',
      '/body/log?what=measurements',
      `/session/summary/${last}`,
      '/settings',
      '/data',
    ]);
    expect(problems).toEqual({});
  }, 60_000);

  it('Explore, the library, the custom-exercise form and the body map fit 360 px', async () => {
    const { container } = await seeded();
    const problems = await problemsOf(container, [
      '/explore',
      '/explore/exercises',
      `/explore/exercises/${BENCH}`,
      '/explore/exercises/new',
      '/explore/body-map',
      '/explore/body-map/mu.chest',
    ]);
    expect(problems).toEqual({});
  }, 60_000);

  it('the Progress screens fit 360 px', async () => {
    const { container } = await seeded();
    const problems = await problemsOf(container, [
      '/progress',
      `/progress/exercise/${BENCH}`,
      '/progress/compare',
      '/progress/volume',
      '/progress/prs',
      '/progress/calendar',
      '/progress/scores',
    ]);
    expect(problems).toEqual({});
  }, 60_000);
});
