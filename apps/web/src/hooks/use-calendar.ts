import { useEffect, useMemo, useState } from 'react';

import type { CalendarExportOptions, CalendarFile } from '@powr/application/planning';

import type { Platform } from '../app/container';
import { useContainer } from '../app/container-context';
import { PUBLIC_HOST } from '../app/public-origin';
import { usePlanning } from './use-planning';

export type CalendarRequest = Omit<CalendarExportOptions, 'host'>;

type FileShare = Awaited<ReturnType<Platform['share']>>;

const ICS_MIME = 'text/calendar';

/**
 * Calendar export (CAL-01…05) through the lazy planning chunk: preview, the file, its delivery
 * (download by default; the share sheet only where the browser accepts `.ics`, P-04) and the
 * "plan changed since the last export" status (CAL-04). UIDs use the configured public host.
 */
export function useCalendarExport() {
  const run = usePlanning();
  const { platform, diagnostics, deps } = useContainer();
  // Web Share must start inside the tap, so its (lazy) adapter is loaded beforehand.
  const [share, setShare] = useState<FileShare | null>(null);
  useEffect(() => {
    let cancelled = false;
    void platform.share().then((loaded) => {
      if (!cancelled) setShare(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [platform]);

  return useMemo(() => {
    const withHost = (request: CalendarRequest): CalendarExportOptions => ({
      ...request,
      host: PUBLIC_HOST,
    });
    const asFile = (file: CalendarFile) => ({
      name: file.fileName,
      bytes: new TextEncoder().encode(file.text),
      mime: ICS_MIME,
    });
    return {
      preview: (request: CalendarRequest) =>
        run((planning, d) => planning.previewCalendarExport(d, withHost(request))),
      build: (request: CalendarRequest) =>
        run((planning, d) => planning.exportCalendar(d, withHost(request))),
      status: () => run((planning, d) => planning.calendarExportStatus(d)),
      canShare: (file: CalendarFile) => share?.canShare(asFile(file)) ?? false,
      /** Delivers the file and records the export (for SEQUENCE and cancellations) if it went out. */
      deliver: async (
        file: CalendarFile,
        how: 'download' | 'share',
        shareTitle: string,
      ): Promise<'downloaded' | 'shared' | 'cancelled' | 'failed'> => {
        const outcome =
          how === 'share'
            ? share
              ? await share.share(asFile(file), shareTitle)
              : 'failed'
            : (await deps.files.save(asFile(file))) === 'cancelled'
              ? 'cancelled'
              : 'downloaded';
        if (outcome === 'downloaded' || outcome === 'shared') {
          await run((planning, d) => planning.recordCalendarExport(d, file.record));
          diagnostics.log('info', 'calendar.exported', {
            events: file.sessions + file.updates,
            cancelled: file.cancelled,
            delivery: outcome,
          });
        }
        return outcome;
      },
    };
  }, [run, share, diagnostics, deps]);
}
