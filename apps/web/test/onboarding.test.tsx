import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LEGAL_ACK_KEY, loadOnboardingDraft } from '@powr/application/planning';

import { acknowledge, createTestContainer, renderRoute, seriousViolations } from './harness';

describe('onboarding steps (ONB-01…07)', () => {
  it('the legal gate explains errors in words and stores nothing before the acknowledgement', async () => {
    const container = await createTestContainer();
    renderRoute(container, '/plan');
    // The first-run guard sends a new user to the legal gate (ONB-01).
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to POWR' })).toBeTruthy();
    const start = await screen.findByRole('button', { name: 'Set up my plan' });
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(start);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Tick that you have read the health notice');
    expect(alert.textContent).toContain('Confirm that you are 16 or older.');
    expect(document.activeElement).toBe(alert);
    const ack = await container.deps.uow.read(['meta'], (repos) => repos.meta.get(LEGAL_ACK_KEY));
    expect(ack).toBeUndefined();

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'I have read the health notice and the privacy summary.',
      }),
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'I am 16 or older.' }));
    await userEvent.click(screen.getByRole('button', { name: 'Set up my plan' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your goal' })).toBeTruthy();
    const stored = await container.deps.uow.read(['meta'], (repos) =>
      repos.meta.get(LEGAL_ACK_KEY),
    );
    expect(stored?.value).toMatchObject({ disclaimerVersion: expect.any(String) });
  });

  it('a step asks again in words when an answer is missing, then saves the draft', async () => {
    const container = await createTestContainer();
    await acknowledge(container);
    renderRoute(container, '/onboarding/goal');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your goal' })).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Choose what you want from training.',
    );

    await userEvent.click(screen.getByRole('radio', { name: /^Powerlifting/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your experience' })).toBeTruthy();
    await waitFor(async () =>
      expect(await loadOnboardingDraft(container.deps)).toMatchObject({
        step: 'experience',
        answers: { style: 'powerlifting' },
      }),
    );
  });

  it('the schedule step needs 2 to 6 days and wraps its chips at 320 px', async () => {
    const container = await createTestContainer();
    await acknowledge(container);
    renderRoute(container, '/onboarding/schedule');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your week' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Monday', exact: true } as never));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Pick between 2 and 6 training days.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Thursday' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Units and body' })).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);
  });

  it('decimal body values keep the point while typing (80.5 stays 80.5)', async () => {
    const container = await createTestContainer();
    await acknowledge(container);
    renderRoute(container, '/onboarding/body');
    expect(await screen.findByRole('heading', { level: 1, name: 'Units and body' })).toBeTruthy();
    const height = screen.getByRole<HTMLInputElement>('textbox', { name: 'Height' });
    const bodyweight = screen.getByRole<HTMLInputElement>('textbox', { name: 'Bodyweight' });
    await userEvent.type(height, '180.5');
    await userEvent.type(bodyweight, '80,5');
    expect(height.value).toBe('180.5');
    expect(bodyweight.value).toBe('80,5');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () =>
      expect(await loadOnboardingDraft(container.deps)).toMatchObject({
        answers: { height: { value: 180.5 }, bodyweight: { value: 80.5 } },
      }),
    );
  });

  it('"Just let me log" stores a profile without a plan (PLN-15)', async () => {
    const container = await createTestContainer();
    await acknowledge(container);
    renderRoute(container, '/onboarding/goal');
    await userEvent.click(await screen.findByRole('button', { name: 'Just let me log' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Start a workout' })).toBeTruthy();
    const stored = await container.deps.uow.read(['profile', 'plans'], async (repos) => ({
      profile: await repos.profile.get(),
      plan: await repos.plans.getActive(),
    }));
    expect(stored.profile).toBeDefined();
    expect(stored.plan).toBeUndefined();
  });
});
