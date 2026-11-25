import { createFileRoute } from '@tanstack/react-router';

import { WhatsNewScreen } from '../../features/settings/WhatsNewScreen';

/** Settings → About → What's new (SET-09, NFR-MNT-07); the update notice links here too. */
export const Route = createFileRoute('/settings/whats-new')({
  component: WhatsNewScreen,
});
