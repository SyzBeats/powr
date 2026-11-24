import { createFileRoute } from '@tanstack/react-router';

import { EquipmentEditScreen } from '../../../features/equipment/EquipmentScreens';
import { validatePresetSearch } from '../../../features/search';

export const Route = createFileRoute('/settings/equipment/$profileId')({
  validateSearch: validatePresetSearch,
  component: EquipmentEditRoute,
});

function EquipmentEditRoute() {
  const { profileId } = Route.useParams();
  const { preset } = Route.useSearch();
  return <EquipmentEditScreen key={profileId} profileId={profileId} presetId={preset} />;
}
