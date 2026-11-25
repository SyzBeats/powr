import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../../app/route-search';
import { LibraryScreen } from '../../../features/library/LibraryScreen';
import type { LibrarySearch } from '../../../features/library/search';

export const Route = createFileRoute('/explore/exercises/')({
  validateSearch: deferredSearch<LibrarySearch>(),
  component: LibraryScreen,
});
