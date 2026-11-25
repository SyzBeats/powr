import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import type { InstantTz, MassUnit, MeasurementSite } from '@powr/domain';

import { announce } from '#ui/announcer';
import { Button, buttonClass } from '#ui/button';
import { DecimalField, Field } from '#ui/field';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useInsight, useInsights } from '../../hooks/use-insights';
import { useProfile } from '../../hooks/use-planning';
import { formatNumber, todayLocal } from '../../i18n/format';
import { bodyMass, kgToUnit, useBodyWords, useBodyweightUnit, useLengthUnit } from './words';

type What = 'bodyweight' | 'measurements';

/** Plausible bodyweights (BOD-01, the use case's 20–400 kg) in the user's unit, for the error. */
const LIMITS_KG = { min: 20, max: 400 } as const;

/** The device's wall-clock time as an instant (no Temporal on this path, §8.19). */
function instantOf(date: string, time: string): InstantTz {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const epochMs = new Date(year, month - 1, day, hours, minutes).getTime();
  return {
    epochMs,
    offsetMin: -new Date(epochMs).getTimezoneOffset(),
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Date and time of an entry: now unless the user changed them (then that wall-clock time). */
function useWhen() {
  const [custom, setCustom] = useState<{ readonly date: string; readonly time: string } | null>(
    null,
  );
  const date = custom?.date ?? todayLocal();
  const time = custom?.time ?? nowTime();
  return {
    date,
    time,
    setDate: (value: string) => setCustom({ date: value, time }),
    setTime: (value: string) => setCustom({ date, time: value }),
    /** Undefined for "now" (the use case takes the clock's time). */
    instant: (): InstantTz | undefined =>
      custom ? instantOf(custom.date, custom.time) : undefined,
  };
}

/** Moves focus to the error summary after each failed attempt (WCAG 3.3.1). */
function useErrorFocus() {
  const summary = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt > 0) summary.current?.focus();
  }, [attempt]);
  return { summary, failed: () => setAttempt((count) => count + 1) };
}

/**
 * BOD-01 and BOD-03: log a bodyweight (≤ 3 taps from Home: "Log bodyweight", the field, Save;
 * date and time default to now, a note is optional) or the measurements of the user's sites.
 * Guidance on weighing and measuring sits next to the fields (BOD-01, BOD-03).
 */
export function LogBodyScreen({ what }: { what: What }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  // The units come with the profile: no form in a default unit before it is known.
  const profile = useProfile();
  return (
    <Screen title={what === 'bodyweight' ? t`Log bodyweight` : t`Log measurements`}>
      <Segmented<What>
        label={t`What to log`}
        value={what}
        onChange={(next) =>
          void navigate({
            to: '/body/log',
            search: next === 'measurements' ? { what: 'measurements' } : {},
            replace: true,
          })
        }
        options={[
          { value: 'bodyweight', label: t`Bodyweight` },
          { value: 'measurements', label: t`Measurements` },
        ]}
      />
      {!profile.loaded ? null : what === 'bodyweight' ? <BodyweightForm /> : <MeasurementsForm />}
    </Screen>
  );
}

/** "When": now by default, a past date and time on request. */
function WhenFields({
  date,
  time,
  onDate,
  onTime,
  error,
}: {
  date: string;
  time: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  error?: string | undefined;
}) {
  const { t } = useLingui();
  const today = todayLocal();
  return (
    <details className="rounded-xl border border-border p-3" open={Boolean(error)}>
      <summary className="flex min-h-target cursor-pointer items-center font-medium">
        {date === today ? <Trans>When: today, now</Trans> : <Trans>When: {date}</Trans>}
      </summary>
      <div className="flex flex-col gap-3 pt-2">
        <Field
          label={t`Date`}
          type="date"
          value={date}
          max={today}
          onChange={(event) => onDate(event.target.value)}
          error={error}
        />
        <Field
          label={t`Time`}
          type="time"
          value={time}
          onChange={(event) => onTime(event.target.value)}
        />
      </div>
    </details>
  );
}

function BodyweightForm() {
  const { t } = useLingui();
  const run = useInsights();
  const navigate = useNavigate();
  const unit = useBodyweightUnit();
  const words = useBodyWords();
  const latest = useInsight('bodyweight-latest', (insights, deps) =>
    insights.bodyweightOverview(deps),
  );
  const [value, setValue] = useState<number | null>(null);
  const when = useWhen();
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ value?: string | undefined; when?: string | undefined }>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const { summary, failed } = useErrorFocus();
  const last = latest.loaded ? latest.value.entries[0] : undefined;
  const limit = (kg: number) => formatNumber(Math.round(kgToUnit(kg, unit)), 0);

  const save = async () => {
    if (value === null) {
      setErrors({ value: t`Enter your bodyweight, for example 80.5.` });
      failed();
      return;
    }
    setBusy(true);
    const measuredAt = when.instant();
    const result = await run((insights, deps) =>
      insights.logBodyweight(deps, {
        mass: { value, unit },
        ...(measuredAt ? { measuredAt } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    );
    setBusy(false);
    if (!result.ok) {
      const min = limit(LIMITS_KG.min);
      const max = limit(LIMITS_KG.max);
      setErrors(
        result.error.kind === 'future'
          ? { when: t`That time is in the future. Choose now or an earlier time.` }
          : unit === 'kg'
            ? { value: t`Enter a bodyweight between ${min} and ${max} kg.` }
            : { value: t`Enter a bodyweight between ${min} and ${max} lb.` },
      );
      failed();
      return;
    }
    const saved = bodyMass(toKgOf(result.value.mass), unit);
    announce(t`Saved: ${saved}.`);
    void navigate({ to: '/body' });
  };

  const errorList = [errors.value, errors.when].filter(Boolean);
  return (
    <>
      {errorList.length > 0 ? (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border-2 border-danger p-3 font-medium text-danger"
        >
          <p>
            <Trans>Please check:</Trans>
          </p>
          <ul className="list-disc pl-5">
            {errorList.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Card>
        <DecimalField
          label={t`Bodyweight`}
          suffix={unit === 'kg' ? t`kg` : t`lb`}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            setErrors((current) => ({ ...current, value: undefined }));
          }}
          hint={last ? t`Last: ${words.mass(toKgOf(last.mass), unit)}` : undefined}
          error={errors.value}
          enterKeyHint="done"
          className="text-lg"
        />
        <WhenFields
          date={when.date}
          time={when.time}
          onDate={when.setDate}
          onTime={when.setTime}
          error={errors.when}
        />
        <Field
          label={t`Note (optional)`}
          value={note}
          maxLength={2000}
          onChange={(event) => setNote(event.target.value)}
        />
        <p className="text-sm text-fg-muted">
          <Trans>
            For a trend you can trust: weigh in the morning, after the bathroom, before food and
            drink, on the same scale. Day-to-day jumps are normal; the trend smooths them out.
          </Trans>
        </p>
      </Card>
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void save()}>
          <Trans>Save</Trans>
        </Button>
        <Link to="/body" className={buttonClass({ size: 'lg' })}>
          <Trans>Cancel</Trans>
        </Link>
      </div>
    </>
  );
}

function toKgOf(mass: { readonly value: number; readonly unit: MassUnit }): number {
  return mass.unit === 'kg' ? mass.value : mass.value * 0.45359237;
}

function MeasurementsForm() {
  const { t } = useLingui();
  const run = useInsights();
  const navigate = useNavigate();
  const lengthUnit = useLengthUnit();
  const words = useBodyWords();
  const overview = useInsight('measurements', (insights, deps) =>
    insights.measurementsOverview(deps),
  );
  const [values, setValues] = useState<Partial<Record<MeasurementSite, number | null>>>({});
  const when = useWhen();
  const [errors, setErrors] = useState<Partial<Record<MeasurementSite | 'when' | 'empty', string>>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const { summary, failed } = useErrorFocus();

  if (!overview.loaded) {
    return (
      <output className="block text-fg-muted">
        <Trans>Loading your measurement sites…</Trans>
      </output>
    );
  }
  const { sites, series } = overview.value;
  const unitOf = (site: MeasurementSite) => (site.startsWith('skinfold') ? 'mm' : lengthUnit);

  const save = async () => {
    const filled = sites.filter((site) => values[site] !== undefined && values[site] !== null);
    if (filled.length === 0) {
      setErrors({ empty: t`Enter at least one measurement.` });
      failed();
      return;
    }
    setBusy(true);
    const measuredAt = when.instant();
    const next: Partial<Record<MeasurementSite | 'when' | 'empty', string>> = {};
    const saved: MeasurementSite[] = [];
    for (const site of filled) {
      const result = await run((insights, deps) =>
        insights.logMeasurement(deps, {
          site,
          value: values[site]!,
          unit: unitOf(site),
          ...(measuredAt ? { measuredAt } : {}),
        }),
      );
      if (result.ok) saved.push(site);
      else if (result.error.kind === 'future')
        next.when = t`That time is in the future. Choose now or an earlier time.`;
      else next[site] = t`Enter a value above 0 and up to 500.`;
    }
    setBusy(false);
    if (Object.keys(next).length > 0) {
      setValues((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([site]) => !saved.includes(site as MeasurementSite)),
        ),
      );
      setErrors(next);
      failed();
      return;
    }
    announce(plural(saved.length, { one: 'Saved # measurement.', other: 'Saved # measurements.' }));
    void navigate({ to: '/body', hash: 'measurements' });
  };

  const errorList = Object.entries(errors).filter(([, message]) => Boolean(message));
  return (
    <>
      {errorList.length > 0 ? (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border-2 border-danger p-3 font-medium text-danger"
        >
          <p>
            <Trans>Please check:</Trans>
          </p>
          <ul className="list-disc pl-5">
            {errorList.map(([key, message]) => (
              <li key={key}>
                {key === 'when' || key === 'empty'
                  ? message
                  : t`${words.site(key as MeasurementSite)}: ${message ?? ''}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Card>
        <p className="text-sm text-fg-muted">
          <Trans>
            Measure in the morning, relaxed, with the tape snug but not tight, at the same spots
            each time. Fill in only what you measured today.
          </Trans>
        </p>
        {sites.map((site) => {
          const unit = unitOf(site);
          const latest = series.find((entry) => entry.site === site)?.latest ?? null;
          const seriesUnit = series.find((entry) => entry.site === site)?.unit ?? unit;
          return (
            <DecimalField
              key={site}
              label={words.site(site)}
              suffix={unit === 'mm' ? t`mm` : unit === 'cm' ? t`cm` : t`in`}
              value={values[site] ?? null}
              onValueChange={(next) => setValues((current) => ({ ...current, [site]: next }))}
              hint={latest ? t`Last: ${words.length(latest.value, seriesUnit)}` : undefined}
              error={errors[site]}
            />
          );
        })}
        <WhenFields
          date={when.date}
          time={when.time}
          onDate={when.setDate}
          onTime={when.setTime}
          error={errors.when}
        />
        <Link
          to="/settings"
          hash="insights"
          className="font-semibold text-info underline-offset-4 hover:underline"
        >
          <Trans>Choose which sites to track</Trans>
        </Link>
      </Card>
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void save()}>
          <Trans>Save</Trans>
        </Button>
        <Link to="/body" className={buttonClass({ size: 'lg' })}>
          <Trans>Cancel</Trans>
        </Link>
      </div>
    </>
  );
}
