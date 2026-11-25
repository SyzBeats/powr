import { describe, expect, it } from 'vitest';

// A unit test outside the app's startup path: the catalog loads at once.
// oxlint-disable-next-line no-restricted-imports -- the lazy-content rule is for app code
import { builtInContent } from '@powr/content/built-in';
import type { EquipmentId, PresetId } from '@powr/domain';
import { profileFromPreset } from '@powr/domain/equipment';

import { sameEquipment, toggleItem } from './inventory';

/* TD-68 (M6c): the equipment editor asks before leaving only when something really changed. */
describe('sameEquipment', () => {
  const equipment = builtInContent().equipment();
  const profile = profileFromPreset(
    equipment.preset('preset.commercial-gym' as PresetId)!,
    equipment.items,
    { id: 'eq-1', name: 'Gym', unit: 'kg' },
  );
  const rack = equipment.items.find((item) => item.id === ('eq.power-rack' as EquipmentId))!;
  // A bar in the profile: ticking it off and on also moves its bar-weight entry.
  const barbell = equipment.items.find(
    (item) => item.loading?.kind === 'bar' && profile.items.includes(item.id),
  )!;

  it('treats a box ticked off and on again as no change, although the order moved', () => {
    for (const item of [rack, barbell]) {
      const again = toggleItem(toggleItem(profile, item, false), item, true);
      expect(again.items).not.toEqual(profile.items);
      expect(sameEquipment(again, profile)).toBe(true);
    }
  });

  it('sees a real change, and a missing stored profile as a change', () => {
    expect(sameEquipment(toggleItem(profile, rack, false), profile)).toBe(false);
    expect(sameEquipment({ ...profile, name: 'Home' }, profile)).toBe(false);
    expect(sameEquipment(profile, null)).toBe(false);
  });
});
