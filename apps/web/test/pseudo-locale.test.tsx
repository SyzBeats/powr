import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PlanPreviewView } from '../src/features/plan/PlanPreviewView';
import { i18n } from '../src/i18n';
import { messages } from '../src/i18n/locales/en/messages.po';
import {
  acknowledge,
  createTestContainer,
  onboarded,
  renderRoute,
  renderWith,
  sampleAnswers,
  samplePreview,
} from './harness';

/**
 * NFR-L10N-02: layouts tolerate about 30% longer strings. Every literal part of every English
 * message grows by 30% (accented filler words, like Lingui's pseudo-locale); the key screens must
 * then still fit 360 px without horizontal scrolling and without clipped buttons or labels.
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

describe('pseudo-locale expansion (+30%, NFR-L10N-02)', () => {
  beforeEach(() => {
    i18n.load('en-x-expanded', expanded);
    i18n.activate('en-x-expanded');
  });
  afterEach(() => {
    i18n.activate('en');
  });

  it('onboarding steps fit 360 px', async () => {
    const container = await createTestContainer();
    renderRoute(container, '/onboarding/welcome');
    await screen.findAllByRole('checkbox');
    // The expanded catalog is the one in use.
    expect(document.body.textContent).toContain('ẍàñđé');
    expect(overflows()).toEqual([]);
    await acknowledge(container);
    for (const step of ['goal', 'experience', 'schedule', 'body', 'equipment', 'priorities']) {
      const view = renderRoute(container, `/onboarding/${step}`);
      await screen.findByRole('progressbar');
      expect({ [step]: overflows() }).toEqual({ [step]: [] });
      view.unmount();
    }
  });

  it('the plan preview and the plan editor fit 360 px', async () => {
    const container = await createTestContainer();
    const preview = await samplePreview(container);
    const view = renderWith(
      container,
      <PlanPreviewView
        preview={preview}
        equipment={sampleAnswers(container).equipment}
        novice={false}
      />,
    );
    expect({ preview: overflows() }).toEqual({ preview: [] });
    view.unmount();

    await onboarded(container);
    renderRoute(container, '/plan/edit');
    await screen.findAllByRole('button', { name: /set/ });
    expect({ editor: overflows() }).toEqual({ editor: [] });
  });
});
