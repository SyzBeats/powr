import { createFileRoute } from '@tanstack/react-router';

import { LibraryScreen } from '../../../features/library/LibraryScreen';
import { validateLibrarySearch } from '../../../features/library/search';

export const Route = createFileRoute('/explore/exercises/')({
  validateSearch: validateLibrarySearch,
  component: LibraryScreen,
});
