import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../../app/route-search';
import { EquipmentEditScreen } from '../../../features/equipment/EquipmentScreens';
import { validatePresetSearch, type PresetSearch } from '../../../features/search';

export const Route = createFileRoute('/settings/equipment/$profileId')({
  validateSearch: deferredSearch<PresetSearch>(),
  component: EquipmentEditRoute,
});

function EquipmentEditRoute() {
  const { profileId } = Route.useParams();
  const { preset } = validatePresetSearch(Route.useSearch());
  return <EquipmentEditScreen key={profileId} profileId={profileId} presetId={preset} />;
}
