import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import type { ScoreBoardView } from '@powr/application/insights';
import type { FormulaScore } from '@powr/domain/analytics';
import type { ScoreFormula } from '@powr/domain/rules';

import { Badge, Callout } from '#ui/badge';
import { TrendChart, type TrendSeries } from '#ui/charts/trend-chart';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useInsight, useInsights } from '../../hooks/use-insights';
import { formatLocalDateWithYear, formatNumber, todayLocal } from '../../i18n/format';
import { useLabels } from '../labels';
import { massFromKg, useLoadUnit } from '../session/words';
import { WhyButton } from '../why/WhySheet';
import { Loading } from './parts';
import { useLiftName, useScoreWords } from './words';

/**
 * ANL-07: IPF GL Points, DOTS, IPF Points, Wilks and Wilks2020 (legacy) and the allometric index
 * for the competition-lift total and each lift, from the current estimates or the heaviest weights
 * lifted (the user's choice, kept in the settings), with each formula's version, sources and
 * "Why?", and the points history.
 */
export function ScoresScreen() {
  const { t } = useLingui();
  const run = useInsights();
  const board = useInsight('scores', (insights, deps) => insights.scores(deps));
  const view = board.loaded ? board.value : null;

  const save = (patch: {
    readonly scoreSource?: 'e1rm' | 'tested';
    readonly division?: 'classic' | 'equipped';
  }) =>
    void run((insights, deps) => insights.updateInsightPreferences(deps, patch)).then(() =>
      board.reload(),
    );

  return (
    <Screen title={t`Powerlifting scores`}>
      {!view ? (
        <Loading />
      ) : (
        <>
          <Card>
            <Segmented
              label={t`Lifts the scores use`}
              value={view.source}
              onChange={(scoreSource) => save({ scoreSource })}
              options={[
                { value: 'e1rm', label: t`Current estimates` },
                { value: 'tested', label: t`Heaviest lifted` },
              ]}
            />
            <p className="text-sm text-fg-muted">
              {view.source === 'e1rm' ? (
                <Trans>
                  Your current estimated 1-rep max of each lift, from its strength trend.
                </Trans>
              ) : (
                <Trans>The heaviest weight you lifted for at least one rep in each lift.</Trans>
              )}
            </p>
            <Segmented
              label={t`Division`}
              value={view.division}
              onChange={(division) => save({ division })}
              options={[
                { value: 'classic', label: t`Classic (raw)` },
                { value: 'equipped', label: t`Equipped` },
              ]}
            />
          </Card>
          {board.loaded && board.stale ? (
            <output className="block text-sm text-fg-muted">
              <Trans>Updating the scores…</Trans>
            </output>
          ) : null}
          <Missing view={view} />
          <TotalCard view={view} />
          {view.formulas.map((formula) => (
            <FormulaCard key={formula.formula} formula={formula} />
          ))}
          <PointsHistory view={view} />
          <p className="text-sm text-fg-muted">
            <Trans>
              Formulas are implemented from the official IPF documents and the published
              coefficients. Rules version {view.rulesVersion}.
            </Trans>
          </p>
        </>
      )}
    </Screen>
  );
}

function Missing({ view }: { view: ScoreBoardView }) {
  const { t } = useLingui();
  const words = useScoreWords();
  if (view.missing.length === 0) return null;
  return (
    <Callout tone="info" title={t`What the scores still need`}>
      <ul className="flex flex-col gap-2">
        {view.missing.map((reason) => (
          <li key={reason} className="flex flex-col">
            <span>{words.missing(reason)}</span>
            {reason === 'bodyweight' ? (
              <Link
                to="/body/log"
                className="inline-flex min-h-target items-center font-semibold text-info underline underline-offset-4"
              >
                <Trans>Log your bodyweight</Trans>
              </Link>
            ) : reason === 'sex' ? (
              <Link
                to="/plan/setup/$step"
                params={{ step: 'body' }}
                className="inline-flex min-h-target items-center font-semibold text-info underline underline-offset-4"
              >
                <Trans>Answer it in the plan setup</Trans>
              </Link>
            ) : (
              <Link
                to="/session"
                className="inline-flex min-h-target items-center font-semibold text-info underline underline-offset-4"
              >
                <Trans>Start a workout</Trans>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Callout>
  );
}

function TotalCard({ view }: { view: ScoreBoardView }) {
  const labels = useLabels();
  const liftName = useLiftName();
  const unit = useLoadUnit();
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Your total</Trans>
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        {view.lifts.map((lift) => (
          <div key={lift.lift} className="contents">
            <dt className="text-fg-muted">{liftName(lift.lift)}</dt>
            <dd className="tabular">
              {lift.kg === null ? (
                <Trans>Not logged yet</Trans>
              ) : (
                <>
                  <span className="font-semibold">{massFromKg(lift.kg, unit, 1)}</span>
                  {lift.exerciseId ? (
                    <span className="block text-sm text-fg-muted">
                      {labels.exercise(lift.exerciseId)}
                    </span>
                  ) : null}
                </>
              )}
            </dd>
          </div>
        ))}
        <dt className="font-semibold">
          <Trans>Total</Trans>
        </dt>
        <dd className="font-bold tabular">
          {view.totalKg === null ? (
            <Trans>Needs all three lifts</Trans>
          ) : (
            massFromKg(view.totalKg, unit, 1)
          )}
        </dd>
        <dt className="text-fg-muted">
          <Trans>Bodyweight (trend)</Trans>
        </dt>
        <dd className="tabular">
          {view.bodyweightKg === null ? (
            <Trans>Not logged yet</Trans>
          ) : (
            massFromKg(view.bodyweightKg, unit, 1)
          )}
        </dd>
      </dl>
    </Card>
  );
}

function FormulaCard({ formula }: { formula: FormulaScore }) {
  const { t } = useLingui();
  const words = useScoreWords();
  const liftName = useLiftName();
  const unit = useLoadUnit();
  const name = words.formula(formula.formula);
  const lifts = formula.lifts.filter((lift) => lift.value !== null);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">{name}</h2>
        {formula.legacy ? <Badge>{t`Legacy`}</Badge> : null}
      </div>
      <p className="text-3xl font-bold tabular">
        {formula.total === null ? '–' : formatNumber(formula.total, 2)}
      </p>
      {formula.best ? (
        <p>
          <Trans>
            Best: {formatNumber(formula.best.value, 2)} on{' '}
            {formatLocalDateWithYear(formula.best.localDate)} (total{' '}
            {massFromKg(formula.best.totalKg, unit, 1)} at{' '}
            {massFromKg(formula.best.bodyweightKg, unit, 1)})
          </Trans>
        </p>
      ) : null}
      {lifts.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {lifts.map((lift) => (
            <li key={lift.lift}>
              {lift.informal ? (
                <Trans>
                  {liftName(lift.lift)}: {formatNumber(lift.value ?? 0, 2)} (informal: the formula
                  is made for totals)
                </Trans>
              ) : (
                <Trans>
                  {liftName(lift.lift)}: {formatNumber(lift.value ?? 0, 2)}
                </Trans>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-fg-muted">
          <Trans>Version</Trans>
        </dt>
        <dd className="wrap-anywhere">{formula.version}</dd>
        <dt className="text-fg-muted">
          <Trans>Sources</Trans>
        </dt>
        <dd className="wrap-anywhere">
          {formula.sources.map((source) => source.replace(/^src\./, '')).join(', ')}
        </dd>
      </dl>
      {formula.verified ? null : (
        <p className="text-sm">
          <Trans>Preliminary coefficients: not yet checked against the primary source.</Trans>
        </p>
      )}
      {formula.why ? <WhyButton why={formula.why} subject={name} className="self-start" /> : null}
    </Card>
  );
}

function PointsHistory({ view }: { view: ScoreBoardView }) {
  const { t } = useLingui();
  const words = useScoreWords();
  const [formula, setFormula] = useState<ScoreFormula>('ipfGl');
  if (view.history.length === 0) return null;
  const name = words.formula(formula);
  const points = view.history.flatMap((entry) => {
    const value = entry.scores[formula];
    return value === null ? [] : [{ date: entry.localDate, value: Math.round(value * 100) / 100 }];
  });
  const series: TrendSeries[] = [{ name, points }];
  const first = points[0];
  const last = points.at(-1);
  const summary =
    first && last
      ? t`${name}: ${formatNumber(first.value, 2)} on ${formatLocalDateWithYear(first.date)}, ${formatNumber(last.value, 2)} on ${formatLocalDateWithYear(last.date)}.`
      : t`No ${name} history yet.`;
  return (
    <>
      <Segmented
        label={t`Points history of`}
        value={formula}
        onChange={setFormula}
        options={view.formulas.map((entry) => ({
          value: entry.formula,
          label: words.formula(entry.formula),
        }))}
      />
      <TrendChart
        measureId="scores"
        title={t`Points history`}
        summary={summary}
        series={series}
        unit={t`points`}
        formatValue={(value) => formatNumber(value, 2)}
        labels={{ points: t`Each total` }}
        defaultRange="all"
        endDate={todayLocal()}
        emptyText={t`No complete total yet.`}
      />
    </>
  );
}
