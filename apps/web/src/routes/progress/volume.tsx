import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../app/route-search';
import { validateVolumeSearch, type VolumeSearch } from '../../features/progress/search';
import { VolumeScreen } from '../../features/progress/VolumeScreen';

export const Route = createFileRoute('/progress/volume')({
  validateSearch: deferredSearch<VolumeSearch>(),
  component: Page,
});

function Page() {
  const { mode, muscle } = validateVolumeSearch(Route.useSearch());
  return <VolumeScreen mode={mode} muscle={muscle} />;
}
