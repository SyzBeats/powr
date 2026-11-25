import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../../app/route-search';
import { EquipmentListScreen } from '../../../features/equipment/EquipmentScreens';
import { validateSavedSearch, type SavedSearch } from '../../../features/search';

export const Route = createFileRoute('/settings/equipment/')({
  validateSearch: deferredSearch<SavedSearch>(),
  component: EquipmentListRoute,
});

function EquipmentListRoute() {
  const { saved } = validateSavedSearch(Route.useSearch());
  return <EquipmentListScreen saved={saved} />;
}
