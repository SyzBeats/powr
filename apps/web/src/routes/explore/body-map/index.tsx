import { createFileRoute } from '@tanstack/react-router';

import { BodyMapScreen } from '../../../features/bodymap/BodyMapScreen';
import { validateBodyMapSearch } from '../../../features/bodymap/search';

export const Route = createFileRoute('/explore/body-map/')({
  validateSearch: validateBodyMapSearch,
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  return <BodyMapScreen search={search} />;
}
