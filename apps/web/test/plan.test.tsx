import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PlanPreviewView } from '../src/features/plan/PlanPreviewView';
import {
  createTestContainer,
  onboarded,
  renderRoute,
  renderWith,
  sampleAnswers,
  samplePreview,
  seriousViolations,
} from './harness';

describe('plan preview with "Why?" (ONB-10, PRG-09)', () => {
  it('explains the template with its parameters, evidence labels and sources', async () => {
    const container = await createTestContainer();
    const preview = await samplePreview(container);
    renderWith(
      container,
      <PlanPreviewView
        preview={preview}
        equipment={sampleAnswers(container).equipment}
        novice={false}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: preview.proposal.template.name.en }),
    ).toBeTruthy();
    // Every training day is listed with its exercises; weekly sets per muscle with numbers.
    for (const day of preview.proposal.days)
      expect(screen.getAllByRole('heading', { name: day.name.en }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sets a week/).length).toBeGreaterThan(3);
    expect(await seriousViolations()).toEqual([]);

    const trigger = screen.getByRole('button', {
      name: `Why? ${preview.proposal.template.name.en}`,
    });
    await userEvent.click(trigger);
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Based on')).toBeTruthy();
    expect(
      within(sheet).getAllByText(/research|convention|App estimate|Official/).length,
    ).toBeGreaterThan(0);
    expect(within(sheet).getAllByText(/^Sources: /).length).toBeGreaterThan(0);
    // Unverified registry values are flagged (LEG-05, §8.6.4).
    expect(within(sheet).getAllByText('Preliminary value').length).toBeGreaterThan(0);
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('shows the plain-language text first for novices (NFR-USE-03)', async () => {
    const container = await createTestContainer();
    const preview = await samplePreview(container);
    renderWith(
      container,
      <PlanPreviewView preview={preview} equipment={sampleAnswers(container).equipment} novice />,
    );
    expect(screen.getAllByText(/reps left/).length).toBeGreaterThan(0);
  });
});

describe('plan editor with live validation (PLN-09)', () => {
  it('shows a live warning after an edit and fixes it in one tap', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/plan/edit');
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit plan' })).toBeTruthy();
    const status = await screen.findByRole('status');
    await waitFor(() => expect(status.textContent).toMatch(/checks pass|need attention/));

    const [fewer] = screen.getAllByRole('button', { name: /^One set fewer of / });
    await userEvent.click(fewer!);
    if (!(fewer as HTMLButtonElement).disabled) await userEvent.click(fewer!);
    const fix = await screen.findAllByRole('button', { name: /^Add \d+ sets? of / });
    const issue = fix[0]!.closest('li')!;
    const before = issue.querySelector('p')!.textContent;
    expect(await seriousViolations()).toEqual([]);

    await userEvent.click(fix[0]!);
    await waitFor(() => expect(screen.queryByText(before ?? '')).toBeNull());
    expect(screen.getByRole('button', { name: 'Undo last change' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('remembers a dismissed warning for the same plan state', async () => {
    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/plan/edit');
    const dismiss = (await screen.findAllByRole('button', { name: 'Dismiss' }))[0]!;
    const count = screen.getAllByRole('button', { name: 'Dismiss' }).length;
    await userEvent.click(dismiss);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Dismiss' }).length).toBe(count - 1),
    );
    const plan = await container.deps.uow.read(['plans'], (repos) => repos.plans.getActive());
    expect(plan?.dismissedIssues).toHaveLength(1);
  });
});
