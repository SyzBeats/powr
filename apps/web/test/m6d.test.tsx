import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecoveryScreen, type CopyOutcome } from '../src/features/shell/RecoveryScreen';
import { DATA_MARKER_KEY } from '../src/infrastructure/db/data-guard';
import {
  createTestContainer,
  onboarded,
  renderRoute,
  renderWith,
  seriousViolations,
} from './harness';

/*
 * M6d: never a first run over lost data. The recovery screen for data that is gone ("Your data
 * could not be read"), and the data marker the first-run guard sets once the database holds the
 * legal acknowledgement. Real IndexedDB and localStorage, axe in each.
 */

beforeEach(() => localStorage.removeItem(DATA_MARKER_KEY));
afterEach(() => {
  localStorage.removeItem(DATA_MARKER_KEY);
  vi.restoreAllMocks();
});

describe('"Your data could not be read" (M6d)', () => {
  it('offers trying again and the diagnostics, and starts again only after a confirmation', async () => {
    const container = await createTestContainer();
    const user = userEvent.setup();
    const retry = vi.fn<() => void>();
    const startAgain = vi.fn<() => void>();
    const saveCopy = vi.fn<() => Promise<CopyOutcome>>(async () => ({ kind: 'unreadable' }));
    renderWith(
      container,
      <RecoveryScreen
        kind="missing"
        onSaveCopy={saveCopy}
        onExportDiagnostics={async () => 'powr-diagnostics-202611250900.txt'}
        onRetry={retry}
        onStartAgain={startAgain}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your data could not be read' }),
    ).toBeTruthy();
    // Nothing to copy: the store is empty or gone. No restore claim here either.
    expect(screen.queryByRole('button', { name: 'Save a copy of your data' })).toBeNull();
    expect(await seriousViolations()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Export diagnostics' }));
    expect((await screen.findByTestId('recovery-diagnostics-status')).textContent).toContain(
      'powr-diagnostics-202611250900.txt',
    );

    await user.click(screen.getByRole('button', { name: 'Start again without data…' }));
    const question = screen.getByRole('heading', { name: 'Start again without data?' });
    await waitFor(() => expect(document.activeElement).toBe(question));
    expect(await seriousViolations()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(startAgain).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Start again without data…' }));
    await user.click(screen.getByRole('button', { name: /^Start again without data$/ }));
    expect(startAgain).toHaveBeenCalledTimes(1);
    expect(saveCopy).not.toHaveBeenCalled();
  });
});

describe('the data marker (M6d)', () => {
  it('is not set on a first run, and is set once the legal acknowledgement is stored', async () => {
    const fresh = await createTestContainer();
    renderRoute(fresh, '/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to POWR' })).toBeTruthy();
    expect(localStorage.getItem(DATA_MARKER_KEY)).toBeNull();

    const container = await createTestContainer();
    await onboarded(container);
    renderRoute(container, '/');
    await waitFor(() => expect(localStorage.getItem(DATA_MARKER_KEY)).not.toBeNull());
    expect(JSON.parse(localStorage.getItem(DATA_MARKER_KEY)!)).toEqual({
      since: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });
});
