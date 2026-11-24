import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { loadOnboardingDraft, saveOnboardingDraft } from '@powr/application/planning';

import {
  acknowledge,
  createTestContainer,
  onboarded,
  renderRoute,
  sampleAnswers,
  seriousViolations,
} from './harness';

/*
 * M2c screens: the ONB-08 baselines step, the PLN-02 template choice and the PLN-08 block
 * length in the plan preview, and the time-budget note of the next block (TD-36).
 */

describe('baselines step (ONB-08)', () => {
  it('lists the main lifts of the plan, estimates a starting e1RM and stores the entry', async () => {
    const container = await createTestContainer();
    await acknowledge(container);
    await saveOnboardingDraft(container.deps, {
      step: 'baselines',
      answers: sampleAnswers(container),
    });
    renderRoute(container, '/onboarding/baselines');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your current lifts' }),
    ).toBeTruthy();
    // A 4-day bodybuilder in a commercial gym: the plan's main compound lifts, squat first.
    const squat = await screen.findByRole('region', { name: 'Barbell back squat' });
    expect(
      screen.getAllByRole('region').map((region) => region.querySelector('h2')?.textContent),
    ).toEqual([
      'Barbell back squat',
      'Dumbbell bench press',
      'Seated cable row',
      'Barbell Romanian deadlift',
    ]);
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(within(squat).getByRole('button', { name: 'A recent set' }));
    await userEvent.type(within(squat).getByRole('textbox', { name: 'Weight' }), '102.5');
    await userEvent.type(within(squat).getByRole('textbox', { name: 'Reps' }), '5');
    await userEvent.click(within(squat).getByRole('button', { name: 'Not sure' }));
    // 102.5 kg × 5 with the unknown-effort prior (RIR 2): effective reps 7, Wathan 80.6%.
    expect(await within(squat).findByText('Estimated 1-rep max: 127.1 kg')).toBeTruthy();
    // The typed decimal point survives (the input keeps the text as typed).
    expect(within(squat).getByRole<HTMLInputElement>('textbox', { name: 'Weight' }).value).toBe(
      '102.5',
    );
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your plan' })).toBeTruthy();
    await waitFor(async () =>
      expect((await loadOnboardingDraft(container.deps))?.answers.baselines).toEqual([
        {
          exerciseId: 'ex.barbell-back-squat',
          kind: 'recentSet',
          load: { value: 102.5, unit: 'kg' },
          reps: 5,
          rir: null,
        },
      ]),
    );
  });

  it('points to an unfinished entry instead of dropping it, and skips in one tap', async () => {
    const container = await createTestContainer();
    await acknowledge(container);
    await saveOnboardingDraft(container.deps, {
      step: 'baselines',
      answers: sampleAnswers(container),
    });
    renderRoute(container, '/onboarding/baselines');
    const bench = await screen.findByRole('region', { name: 'Dumbbell bench press' });
    await userEvent.click(within(bench).getByRole('button', { name: 'My 1-rep max' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Dumbbell bench press: enter the weight in kg');
    expect(document.activeElement).toBe(alert);
    const weight = within(bench).getByRole('textbox', { name: '1-rep max' });
    expect(weight.getAttribute('aria-invalid')).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'Skip this step' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your plan' })).toBeTruthy();
  });
});

describe('plan preview choices (PLN-02, PLN-08)', () => {
  it('changes the block length and shows the block on the calendar', async () => {
    const container = await createTestContainer();
    await acknowledge(container);
    await saveOnboardingDraft(container.deps, {
      step: 'preview',
      answers: sampleAnswers(container),
    });
    renderRoute(container, '/onboarding/preview');
    const block = await screen.findByRole('list', { name: 'Your first block' }, { timeout: 5000 });
    expect(within(block).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('Recommended: 5 weeks. Pick from 3 to 8.')).toBeTruthy();

    const weeks = screen.getByRole('group', { name: 'Training weeks before the lighter week' });
    await userEvent.click(within(weeks).getByRole('button', { name: '4' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Your first block' })).getAllByRole('listitem'),
      ).toHaveLength(5),
    );
    const items = within(screen.getByRole('list', { name: 'Your first block' })).getAllByRole(
      'listitem',
    );
    expect(items[4]?.textContent).toContain('Lighter week');
    expect(items[3]?.textContent).not.toContain('Lighter week');
    await waitFor(async () =>
      expect((await loadOnboardingDraft(container.deps))?.answers).not.toBeUndefined(),
    );
    expect(await seriousViolations()).toEqual([]);
  });

  it('lists the plans of the style with the generator verdict and explains a refusal', async () => {
    const container = await createTestContainer();
    await acknowledge(container);
    await saveOnboardingDraft(container.deps, {
      step: 'preview',
      answers: sampleAnswers(container),
    });
    renderRoute(container, '/onboarding/preview');
    const choose = await screen.findByRole(
      'button',
      { name: 'Choose a different plan' },
      { timeout: 5000 },
    );
    await userEvent.click(choose);
    const sheet = await screen.findByRole('dialog');
    const recommended = await within(sheet).findByRole('radio', { name: /^Upper\/lower ×2/ });
    expect(recommended.getAttribute('aria-checked')).toBe('true');
    expect(within(sheet).getByText('Needs 3 training days a week.')).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(within(sheet).getByRole('radio', { name: /^Full body ×3/ }));
    expect(
      await screen.findByText(/Full body ×3 is made for a different style or number of training/),
    ).toBeTruthy();
    // Back to the recommended plan in one tap; focus returned to a control that still exists.
    await userEvent.click(screen.getByRole('button', { name: 'Use the recommended plan' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Upper/lower ×2' }, { timeout: 5000 }),
    ).toBeTruthy();
  });
});

describe('next block (PLN-13, TD-36)', () => {
  it('shows the time-budget note when the budget lowers targets', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/plan/next');
    expect(
      await screen.findByRole('button', { name: 'Accept the next block' }, { timeout: 5000 }),
    ).toBeTruthy();
    // The sample plan has 75-minute sessions: the same rule lowers some targets.
    expect(screen.getByText('Your session time is tight')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Why? the time budget' })).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);
  });
});
