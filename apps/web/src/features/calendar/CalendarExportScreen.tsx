import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { CalendarPlus, Download, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import type { Result } from '@powr/application';
import type {
  CalendarAlarm,
  CalendarExportError,
  CalendarFile,
  CalendarPreview,
  CalendarRange,
  CalendarTexts,
} from '@powr/application/planning';

import { Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { ChoiceCards } from '#ui/choice';
import { Field } from '#ui/field';
import { Card, Screen } from '#ui/screen';

import { useCalendarExport, type CalendarRequest } from '../../hooks/use-calendar';
import { useActivePlan } from '../../hooks/use-planning';
import { formatLocalDate, formatMinutes } from '../../i18n/format';

type RangeChoice = 'restOfWeek' | 'block' | 'weeks2' | 'weeks4' | 'weeks8' | 'untilMeet';
type TimeChoice = 'planned' | 'fixed' | 'allDay';

const RANGES: Readonly<Record<RangeChoice, CalendarRange>> = {
  restOfWeek: { kind: 'restOfWeek' },
  block: { kind: 'block' },
  weeks2: { kind: 'weeks', weeks: 2 },
  weeks4: { kind: 'weeks', weeks: 4 },
  weeks8: { kind: 'weeks', weeks: 8 },
  untilMeet: { kind: 'untilMeet' },
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type Delivery =
  | { readonly kind: 'idle' | 'busy' | 'cancelled' | 'failed' }
  | { readonly kind: 'done'; readonly fileName: string; readonly shared: boolean };

/** The event texts of CAL-02 in the UI language (the use case is language-free). */
function useCalendarTexts(): CalendarTexts {
  const { t } = useLingui();
  return useMemo(
    () => ({
      title: ({ name, week, deload }) =>
        deload ? t`POWR · ${name} (Week ${week}, lighter week)` : t`POWR · ${name} (Week ${week})`,
      description: ({ exercises, minutes }) => {
        const lines = exercises.map(({ name, sets }) =>
          sets === 1 ? t`${name}: 1 set` : t`${name}: ${sets} sets`,
        );
        const length = formatMinutes(minutes);
        return [...lines, '', t`About ${length}. Planned in POWR; open the app to train.`].join(
          '\n',
        );
      },
      alarm: ({ title }) => t`Soon: ${title}`,
    }),
    [t],
  );
}

/**
 * Calendar export (CAL-01…05): pick the sessions, the start time and a reminder, then download
 * the `.ics` file (or share it where the browser accepts `.ics`, P-04). A short import guide for
 * Samsung Calendar and Google Calendar follows, with what a re-export does (CAL-04). Everything
 * works offline.
 */
export function CalendarExportScreen() {
  const { t } = useLingui();
  const plan = useActivePlan();
  const calendar = useCalendarExport();
  const texts = useCalendarTexts();
  const hasStartTimes = plan.loaded && (plan.value?.schedule.startTimes.length ?? 0) > 0;

  const [range, setRange] = useState<RangeChoice>('block');
  const [timeChoice, setTimeChoice] = useState<TimeChoice | null>(null);
  const [time, setTime] = useState('18:00');
  const [alarm, setAlarm] = useState<CalendarAlarm>(30);
  const [built, setBuilt] = useState<Result<CalendarFile, CalendarExportError> | null>(null);
  const [changed, setChanged] = useState<{ readonly at: string; readonly changed: number } | null>(
    null,
  );
  const [delivery, setDelivery] = useState<Delivery>({ kind: 'idle' });
  const guide = useRef<HTMLHeadingElement>(null);

  const timeMode: TimeChoice = timeChoice ?? (hasStartTimes ? 'planned' : 'fixed');
  const timeValid = timeMode === 'allDay' || TIME_PATTERN.test(time);
  const request = useMemo<CalendarRequest | null>(
    () =>
      timeMode !== 'allDay' && !TIME_PATTERN.test(time)
        ? null
        : {
            range: RANGES[range],
            time:
              timeMode === 'allDay'
                ? { kind: 'allDay' }
                : timeMode === 'fixed'
                  ? { kind: 'fixed', time }
                  : { kind: 'planned', fallback: time },
            alarmMinutes: alarm,
            texts,
          },
    [range, timeMode, time, alarm, texts],
  );

  // CAL-04: "your plan changed since the last export" (read again after an export).
  useEffect(() => {
    let cancelled = false;
    void calendar.status().then((status) => {
      if (!cancelled) setChanged(status);
    });
    return () => {
      cancelled = true;
    };
  }, [calendar]);

  // The file for the current choices: its summary, and whether the browser can share it.
  useEffect(() => {
    if (!request) return undefined;
    let cancelled = false;
    void calendar.build(request).then((next) => {
      if (!cancelled) setBuilt(next);
    });
    return () => {
      cancelled = true;
    };
  }, [calendar, request]);

  useEffect(() => {
    if (delivery.kind === 'done') guide.current?.focus();
  }, [delivery]);

  if (plan.loaded && !plan.value) {
    return (
      <Screen title={t`Add your plan to your calendar`}>
        <Card>
          <p>
            <Trans>There is no plan yet, so there are no sessions to add.</Trans>
          </p>
          <Link
            to="/plan/setup/$step"
            params={{ step: 'goal' }}
            className={buttonClass({ variant: 'primary', size: 'lg' })}
          >
            <Trans>Set up a plan</Trans>
          </Link>
        </Card>
      </Screen>
    );
  }

  const file = built?.ok && timeValid ? built.value : null;
  const shareable = file !== null && calendar.canShare(file);

  const deliver = async (how: 'download' | 'share') => {
    if (!file || !request) return;
    setDelivery({ kind: 'busy' });
    // A download is made fresh; sharing must start in the tap itself, so it uses the built file.
    const fresh = how === 'download' ? await calendar.build(request) : null;
    const target = fresh === null ? file : fresh.ok ? fresh.value : null;
    if (!target) {
      setDelivery({ kind: 'failed' });
      return;
    }
    const outcome = await calendar.deliver(target, how, t`POWR training plan`);
    setDelivery(
      outcome === 'downloaded' || outcome === 'shared'
        ? { kind: 'done', fileName: target.fileName, shared: outcome === 'shared' }
        : { kind: outcome },
    );
    setChanged(await calendar.status());
  };

  return (
    <Screen title={t`Add your plan to your calendar`}>
      <p className="text-fg-muted">
        <Trans>
          POWR makes a calendar file with your planned sessions. Your calendar app adds them and
          reminds you; nothing is sent anywhere.
        </Trans>
      </p>

      {changed && changed.changed > 0 ? (
        <Callout tone="info" title={t`Your plan changed`}>
          <p data-testid="calendar-changed">
            <Plural
              value={changed.changed}
              one="# session changed since your last export. Export again to update your calendar."
              other="# sessions changed since your last export. Export again to update your calendar."
            />
          </p>
        </Callout>
      ) : null}

      <Card>
        <ChoiceCards
          legend={t`Which sessions`}
          value={range}
          onChange={(value) => setRange(value)}
          options={[
            { value: 'restOfWeek', label: t`Rest of this week` },
            { value: 'block', label: t`This training block` },
            { value: 'weeks2', label: t`Next 2 weeks` },
            { value: 'weeks4', label: t`Next 4 weeks` },
            { value: 'weeks8', label: t`Next 8 weeks` },
            { value: 'untilMeet', label: t`Until your meet` },
          ]}
        />
      </Card>

      <Card>
        <ChoiceCards
          legend={t`Start time`}
          value={timeMode}
          onChange={(value) => setTimeChoice(value)}
          options={[
            ...(hasStartTimes
              ? [
                  {
                    value: 'planned' as const,
                    label: t`Your planned start times`,
                    description: t`Days without a start time use the time below.`,
                  },
                ]
              : []),
            { value: 'fixed' as const, label: t`The same time for every session` },
            {
              value: 'allDay' as const,
              label: t`All-day events`,
              description: t`No time; your calendar shows them at the top of the day.`,
            },
          ]}
        />
        {timeMode === 'allDay' ? null : (
          <Field
            label={
              timeMode === 'planned' ? t`Time for days without one` : t`Time for every session`
            }
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            error={timeValid ? undefined : t`Enter a time such as 18:00.`}
            data-testid="calendar-time"
          />
        )}
      </Card>

      <Card>
        <ChoiceCards
          legend={t`Reminder`}
          hint={t`Your calendar app shows the reminder, also when POWR is closed.`}
          value={String(alarm)}
          onChange={(value) => setAlarm(Number(value) as CalendarAlarm)}
          options={[
            { value: '0', label: t`No reminder` },
            { value: '15', label: t`15 minutes before` },
            { value: '30', label: t`30 minutes before` },
            { value: '60', label: t`1 hour before` },
            { value: '120', label: t`2 hours before` },
          ]}
        />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">
          <Trans>Your calendar file</Trans>
        </h2>
        <output data-testid="calendar-preview" className="block">
          {built === null || !timeValid ? null : built.ok ? (
            <PreviewText preview={built.value} />
          ) : (
            <PreviewError error={built.error} />
          )}
        </output>
        <Button
          variant="primary"
          size="lg"
          disabled={file === null || delivery.kind === 'busy'}
          onClick={() => void deliver('download')}
        >
          <Download aria-hidden="true" className="size-5" />
          <Trans>Download the calendar file</Trans>
        </Button>
        {shareable ? (
          <Button
            size="lg"
            disabled={delivery.kind === 'busy'}
            onClick={() => void deliver('share')}
          >
            <Share2 aria-hidden="true" className="size-5" />
            <Trans>Share with a calendar app</Trans>
          </Button>
        ) : null}
        <output data-testid="calendar-status" className="block text-sm empty:hidden">
          {delivery.kind === 'busy' ? <Trans>Making the file…</Trans> : null}
          {delivery.kind === 'done' && !delivery.shared ? (
            <Trans>Saved to Downloads as {delivery.fileName}.</Trans>
          ) : null}
          {delivery.kind === 'done' && delivery.shared ? <Trans>Shared.</Trans> : null}
          {delivery.kind === 'cancelled' ? <Trans>Not saved.</Trans> : null}
          {delivery.kind === 'failed' ? (
            <Trans>The file could not be made. Your plan is unchanged; try again.</Trans>
          ) : null}
        </output>
      </Card>

      <ImportGuide headingRef={guide} />
    </Screen>
  );
}

function PreviewText({ preview }: { preview: CalendarPreview }) {
  const first = preview.first ? formatLocalDate(preview.first, 'long') : null;
  const last = preview.last ? formatLocalDate(preview.last, 'long') : null;
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2 font-semibold">
        <CalendarPlus aria-hidden="true" className="size-5 shrink-0" />
        <Plural value={preview.sessions} one="# session" other="# sessions" />
      </span>
      {first && last ? (
        <span>
          <Trans>
            From {first} to {last}.
          </Trans>
        </span>
      ) : null}
      {preview.updates > 0 ? (
        <span>
          <Plural
            value={preview.updates}
            one="# earlier exported session changed and is updated too."
            other="# earlier exported sessions changed and are updated too."
          />
        </span>
      ) : null}
      {preview.cancelled > 0 ? (
        <span>
          <Plural
            value={preview.cancelled}
            one="# session is no longer planned and is cancelled in your calendar."
            other="# sessions are no longer planned and are cancelled in your calendar."
          />
        </span>
      ) : null}
      {preview.withoutTime > 0 ? (
        <span className="text-fg-muted">
          <Plural
            value={preview.withoutTime}
            one="# session has no planned start time and uses the time you chose."
            other="# sessions have no planned start time and use the time you chose."
          />
        </span>
      ) : null}
    </span>
  );
}

function PreviewError({ error }: { error: CalendarExportError }) {
  const { t } = useLingui();
  const messages: Record<CalendarExportError['kind'], string> = {
    noPlan: t`There is no plan yet, so there are no sessions to add.`,
    noMeet: t`No meet date is set. Choose another range.`,
    nothingToExport: t`No planned sessions in this range. Choose a longer range.`,
  };
  return messages[error.kind];
}

/** CAL-05: how to import, and what a re-export does (CAL-04). Wording to be confirmed by S-6. */
function ImportGuide({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <Card>
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
        <Trans>How to add the file to your calendar</Trans>
      </h2>
      <details className="rounded-xl border border-border p-3">
        <summary className="min-h-target cursor-pointer py-2 font-semibold">
          <Trans>Samsung Calendar</Trans>
        </summary>
        <ol className="flex list-decimal flex-col gap-2 pt-2 pl-6">
          <li>
            <Trans>
              Open the downloaded file from the notification or from My Files, Downloads.
            </Trans>
          </li>
          <li>
            <Trans>Choose Calendar if Android asks which app to use.</Trans>
          </li>
          <li>
            <Trans>Check the calendar it goes into, then tap Save or Import.</Trans>
          </li>
        </ol>
      </details>
      <details className="rounded-xl border border-border p-3">
        <summary className="min-h-target cursor-pointer py-2 font-semibold">
          <Trans>Google Calendar</Trans>
        </summary>
        <ol className="flex list-decimal flex-col gap-2 pt-2 pl-6">
          <li>
            <Trans>
              On a computer, open Google Calendar in a browser, then Settings, Import and export.
            </Trans>
          </li>
          <li>
            <Trans>
              Choose the file (copy it from the phone first) and the calendar, then Import.
            </Trans>
          </li>
          <li>
            <Trans>
              Some versions of the Google Calendar app open the file directly from Downloads; if
              yours does not, use the computer.
            </Trans>
          </li>
        </ol>
      </details>
      <p className="text-sm">
        <Trans>
          Exporting again updates the same events in calendar apps that support it. Some apps add a
          second copy instead: then delete the old events, for example by searching your calendar
          for "POWR".
        </Trans>
      </p>
    </Card>
  );
}
