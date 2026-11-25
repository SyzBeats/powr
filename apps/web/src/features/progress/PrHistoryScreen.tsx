import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { Trophy } from 'lucide-react';
import { useState } from 'react';

import type { ExerciseId } from '@powr/domain';
import type { PrRecord } from '@powr/domain/session';

import { Button } from '#ui/button';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useInsight } from '../../hooks/use-insights';
import { formatLocalDateWithYear } from '../../i18n/format';
import { useLabels } from '../labels';
import { useLoadUnit, useSessionWords } from '../session/words';
import { Loading } from './parts';
import type { PrTypeFilter } from './search';
import { usePrTypeWords } from './words';

/** PRs shown before "Show more" (years of history stay a short page). */
const PAGE = 30;

type TypeChoice = PrTypeFilter | 'any';

/**
 * ANL-05: every PR, newest first, filtered by type (MOT-01: rep, heaviest weight, estimated
 * 1-rep max (an estimate), volume) and exercise; each opens the workout it happened in.
 */
export function PrHistoryScreen({
  type,
  exercise,
}: {
  type?: PrTypeFilter | undefined;
  exercise?: string | undefined;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const navigate = useNavigate();
  const prType = usePrTypeWords();
  const words = useSessionWords();
  const unit = useLoadUnit();
  const [count, setCount] = useState(PAGE);
  // Every PR once (cheap: one indexed read), filtered here so the exercise list stays complete.
  const all = useInsight('prs', (insights, deps) => insights.prHistory(deps));
  const records = all.loaded ? all.value : [];
  const exercises = [...new Set(records.map((record) => record.exerciseId))].toSorted((a, b) =>
    labels.exercise(a).localeCompare(labels.exercise(b)),
  );
  const shown = records.filter(
    (record) =>
      (type === undefined || record.type === type) &&
      (exercise === undefined || record.exerciseId === exercise),
  );

  const go = (next: { type?: PrTypeFilter | undefined; exercise?: string | undefined }) => {
    setCount(PAGE);
    void navigate({
      to: '/progress/prs',
      search: {
        ...(next.type ? { type: next.type } : {}),
        ...(next.exercise ? { exercise: next.exercise } : {}),
      },
      replace: true,
      resetScroll: false,
    });
  };

  return (
    <Screen title={t`Personal records`}>
      <Card>
        <Segmented<TypeChoice>
          label={t`Type of record`}
          value={type ?? 'any'}
          onChange={(next) => go({ type: next === 'any' ? undefined : next, exercise })}
          options={[
            { value: 'any', label: t`All` },
            { value: 'rep', label: prType('rep') },
            { value: 'load', label: prType('load') },
            { value: 'e1rm', label: t`Estimated 1-rep max` },
            { value: 'volume', label: prType('volume') },
          ]}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="pr-exercise" className="font-medium">
            <Trans>Exercise</Trans>
          </label>
          <select
            id="pr-exercise"
            value={exercise ?? ''}
            onChange={(event) => go({ type, exercise: event.target.value || undefined })}
            className="min-h-target rounded-xl border border-control bg-surface px-3 text-fg"
          >
            <option value="">{t`All exercises`}</option>
            {exercises.map((id) => (
              <option key={id} value={id}>
                {labels.exercise(id)}
              </option>
            ))}
            {exercise && !exercises.includes(exercise as ExerciseId) ? (
              <option value={exercise}>{labels.exercise(exercise)}</option>
            ) : null}
          </select>
        </div>
        {type === 'e1rm' ? (
          <p className="text-sm text-fg-muted">
            <Trans>
              Estimated 1-rep max records are estimates from your sets and effort ratings, not
              weights you lifted.
            </Trans>
          </p>
        ) : null}
      </Card>
      {!all.loaded ? (
        <Loading />
      ) : (
        <>
          <output className="block font-semibold" data-testid="pr-count">
            <Plural value={shown.length} one="# record" other="# records" />
          </output>
          {shown.length === 0 ? (
            <Card>
              <p>
                {records.length === 0 ? (
                  <Trans>
                    No PRs yet. Your first workouts set the marks; beating them shows up here.
                  </Trans>
                ) : (
                  <Trans>No records match these filters.</Trans>
                )}
              </p>
            </Card>
          ) : (
            <ol className="flex flex-col gap-2" data-testid="pr-list">
              {shown.slice(0, count).map((record) => (
                <PrItem
                  key={record.id}
                  record={record}
                  text={words.pr(record, unit)}
                  kind={prType(record.type)}
                />
              ))}
            </ol>
          )}
          {shown.length > count ? (
            <Button onClick={() => setCount((value) => value + PAGE)}>
              <Trans>Show more records</Trans>
            </Button>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function PrItem({ record, text, kind }: { record: PrRecord; text: string; kind: string }) {
  return (
    <li>
      <Link
        to="/session/summary/$sessionId"
        params={{ sessionId: record.sessionId }}
        className="flex min-h-target-lg items-center gap-3 rounded-2xl bg-surface px-4 py-3"
      >
        <Trophy aria-hidden="true" className="size-5 shrink-0 text-pr-accent" />
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{text}</span>
          <span className="text-sm text-fg-muted">
            {kind} · {formatLocalDateWithYear(record.localDate)}
          </span>
        </span>
      </Link>
    </li>
  );
}
