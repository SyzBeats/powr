import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../../app/route-search';
import { BodyMapScreen } from '../../../features/bodymap/BodyMapScreen';
import { validateBodyMapSearch, type BodyMapSearch } from '../../../features/bodymap/search';

export const Route = createFileRoute('/explore/body-map/')({
  validateSearch: deferredSearch<BodyMapSearch>(),
  component: Page,
});

function Page() {
  const search = validateBodyMapSearch(Route.useSearch());
  return <BodyMapScreen search={search} />;
}
