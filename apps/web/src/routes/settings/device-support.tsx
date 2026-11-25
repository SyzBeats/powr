import { createFileRoute } from '@tanstack/react-router';

import { DeviceSupportScreen } from '../../features/shell/DeviceSupportScreen';

/** Settings → About → Device support (PWA-13); also linked from Data and backups. */
export const Route = createFileRoute('/settings/device-support')({
  component: DeviceSupportScreen,
});
