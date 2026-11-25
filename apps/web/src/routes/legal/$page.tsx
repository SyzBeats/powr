import { createFileRoute } from '@tanstack/react-router';

import { LegalPageScreen } from '../../features/legal/LegalScreens';

/**
 * The legal and trust pages (M5s): disclaimer, privacy, imprint, how-powr-decides and
 * attributions. One route with a parameter keeps the startup route tree small (§8.19).
 */
export const Route = createFileRoute('/legal/$page')({ component: LegalRoute });

function LegalRoute() {
  const { page } = Route.useParams();
  return <LegalPageScreen page={page} />;
}
