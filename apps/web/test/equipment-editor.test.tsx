import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { EquipmentProfile } from '@powr/domain';

import { EquipmentEditor } from '../src/features/equipment/EquipmentEditor';
import { createTestContainer, renderWith, sampleAnswers, seriousViolations } from './harness';

function Editor({
  initial,
  onChange,
}: {
  initial: EquipmentProfile;
  onChange: (p: EquipmentProfile) => void;
}) {
  const [profile, setProfile] = useState(initial);
  return (
    <EquipmentEditor
      profile={profile}
      onChange={(next) => {
        setProfile(next);
        onChange(next);
      }}
    />
  );
}

describe('equipment editor (EQP-01…03, EQP-07)', () => {
  it('toggles items with their load details, finds synonyms and edits plates', async () => {
    const container = await createTestContainer();
    let latest = sampleAnswers(container).equipment;
    renderWith(container, <Editor initial={latest} onChange={(next) => (latest = next)} />);

    const bar = await screen.findByRole('checkbox', { name: 'Olympic barbell' });
    expect(bar.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Bar weights' })).toBeTruthy();
    await userEvent.click(bar);
    expect(latest.items).not.toContain('eq.barbell-olympic');
    expect(latest.bars.some((entry) => entry.item === 'eq.barbell-olympic')).toBe(false);

    // EQP-01: search by synonym.
    await userEvent.type(screen.getByRole('searchbox'), 'hex bar');
    expect(screen.getByRole('checkbox', { name: /trap/i })).toBeTruthy();
    await userEvent.clear(screen.getByRole('searchbox'));

    // EQP-03: plate pairs with large ± buttons, and a new denomination.
    const pairs = latest.plates[0]!;
    await userEvent.click(screen.getAllByRole('button', { name: /^One pair more of / })[0]!);
    expect(latest.plates[0]).toEqual({ weight: pairs.weight, pairs: pairs.pairs + 1 });
    await userEvent.type(screen.getAllByLabelText('Add a plate weight')[0]!, '0.5');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
    expect(latest.plates.some((plate) => plate.weight === 0.5)).toBe(true);

    expect(await seriousViolations()).toEqual([]);
  });

  it('decimal load details keep their point while typing (2.5, not 25)', async () => {
    const container = await createTestContainer();
    let latest = sampleAnswers(container).equipment;
    renderWith(container, <Editor initial={latest} onChange={(next) => (latest = next)} />);
    const collar = await screen.findByLabelText('Collar weight (each)');
    await userEvent.clear(collar);
    await userEvent.type(collar, '2.5');
    expect(latest.collarWeight).toBe(2.5);
  });

  it('adds a custom item by name and explains an empty name (EQP-07)', async () => {
    const container = await createTestContainer();
    let latest = sampleAnswers(container).equipment;
    renderWith(container, <Editor initial={latest} onChange={(next) => (latest = next)} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Type a name for the item first.')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Item name'), 'Belt squat machine');
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Belt squat machine')).toBeTruthy();
    expect(latest.customItems).toEqual([expect.objectContaining({ name: 'Belt squat machine' })]);
    expect(latest.customItems[0]!.id).toMatch(/^ce\./);
  });
});
