import { createFileRoute } from '@tanstack/react-router';

import { validateVolumeSearch } from '../../features/progress/search';
import { VolumeScreen } from '../../features/progress/VolumeScreen';

export const Route = createFileRoute('/progress/volume')({
  validateSearch: validateVolumeSearch,
  component: Page,
});

function Page() {
  const { mode, muscle } = Route.useSearch();
  return <VolumeScreen mode={mode} muscle={muscle} />;
}
