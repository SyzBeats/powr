import { createFileRoute } from '@tanstack/react-router';

import { EquipmentListScreen } from '../../../features/equipment/EquipmentScreens';
import { validateSavedSearch } from '../../../features/search';

export const Route = createFileRoute('/settings/equipment/')({
  validateSearch: validateSavedSearch,
  component: EquipmentListRoute,
});

function EquipmentListRoute() {
  const { saved } = Route.useSearch();
  return <EquipmentListScreen saved={saved} />;
}
