import { createFileRoute } from '@tanstack/react-router';

import { CalendarExportScreen } from '../../features/calendar/CalendarExportScreen';

/** CAL-01…05: the planned sessions as an `.ics` file, reached from the Plan screen. */
export const Route = createFileRoute('/plan/calendar')({ component: CalendarExportScreen });
