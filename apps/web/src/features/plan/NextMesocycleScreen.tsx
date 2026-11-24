import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { NextMesocyclePreview } from '@powr/application/planning';

import { Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { useActivePlan, usePlanning, useProfile } from '../../hooks/use-planning';
import { formatLocalDate } from '../../i18n/format';
import { useLabels } from '../labels';
import { WhyButton, WhyNamesContext, WhySimpleContext, WhyText } from '../why/WhySheet';
import { BudgetNote, DayCard, IssueList, VolumeList } from './parts';

/**
 * PLN-13: the proposed next block (level re-evaluated, 1–2 exercises per muscle rotated, targets
 * from the logged volume, its PLN-01 report), every rotation with its reason; the user accepts.
 * When the session time cannot fit every target, the same time-budget note as the first plan
 * (PLN-14, TD-36); changing the session time or the days is a re-plan (Settings).
 */
export function NextMesocycleScreen() {
  const { t } = useLingui();
  const plan = useActivePlan();
  const profile = useProfile();
  const run = usePlanning();
  const navigate = useNavigate();
  const labels = useLabels();
  const [preview, setPreview] = useState<NextMesocyclePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const planId = plan.loaded ? plan.value?.id : undefined;

  useEffect(() => {
    if (!planId) return;
    void run((planning, deps) => planning.proposeNextMesocycle(deps, planId)).then((result) => {
      if (result.ok) setPreview(result.value);
      else setError(t`The next block cannot be proposed for this plan.`);
    });
  }, [run, planId, t]);

  const novice =
    profile.loaded &&
    (profile.value?.experience.trainingAge === 'under6Months' ||
      profile.value?.experience.rpeFamiliarity === 'none');

  if (plan.loaded && !plan.value) {
    return (
      <Screen title={t`Next block`}>
        <p>
          <Trans>There is no plan yet.</Trans>
        </p>
        <Link to="/plan" className={buttonClass({ size: 'lg' })}>
          <Trans>Back to the plan</Trans>
        </Link>
      </Screen>
    );
  }
  const mesocycle = preview?.proposal.mesocycle;
  const budgetNote = preview?.proposal.notes.find((note) => note.rule === 'plan.volume.budget');
  return (
    <WhySimpleContext value={novice}>
      <WhyNamesContext value={{ days: mesocycle?.days ?? [] }}>
        <Screen title={t`Next block`}>
          {error ? <Callout tone="danger">{error}</Callout> : null}
          {!preview || !mesocycle ? (
            error ? null : (
              <output className="block text-fg-muted">
                <Trans>Preparing the next block…</Trans>
              </output>
            )
          ) : (
            <>
              <Card>
                <h2 className="text-xl font-bold">
                  <Trans>Starts {formatLocalDate(mesocycle.startDate, 'long')}</Trans>
                </h2>
                <p>
                  <WhyText why={preview.why} />
                </p>
                <p className="capitalize">
                  <Trans>Level: {labels.level(mesocycle.level)}</Trans>{' '}
                  <WhyButton why={preview.levelWhy} subject={t`your level`} />
                </p>
                <WhyButton why={preview.why} subject={t`the next block`} />
              </Card>
              {budgetNote ? (
                <BudgetNote note={budgetNote} issues={preview.proposal.report.issues} />
              ) : null}
              <Card>
                <h2 className="text-xl font-bold">
                  <Trans>Exercise changes</Trans>
                </h2>
                {preview.proposal.rotations.length === 0 ? (
                  <p>
                    <Trans>Every exercise stays: your plan keeps what works.</Trans>
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {preview.proposal.rotations.map((rotation) => (
                      <li
                        key={`${rotation.dayKey}/${rotation.slotKey}`}
                        className="flex flex-col gap-1 rounded-xl bg-surface-raised p-3"
                      >
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          {labels.exercise(rotation.from)}
                          <ArrowRight aria-label={t`replaced by`} className="size-4" />
                          {labels.exercise(rotation.to)}
                        </span>
                        <span className="text-sm text-fg-muted">
                          {rotation.reason === 'rotation' ? (
                            <Trans>Planned variety between blocks</Trans>
                          ) : (
                            <Trans>No longer possible with your equipment or avoid list</Trans>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {mesocycle.days.map((day) => (
                <DayCard
                  key={day.key}
                  day={day}
                  minutes={
                    preview.proposal.report.analysis.days.find((entry) => entry.dayKey === day.key)
                      ?.minutes
                  }
                  budget={plan.loaded ? (plan.value?.schedule.sessionMinutes ?? null) : null}
                  novice={novice}
                />
              ))}
              <Card>
                <h2 className="text-xl font-bold">
                  <Trans>Weekly sets per muscle</Trans>
                </h2>
                <VolumeList
                  analysis={preview.proposal.report.analysis}
                  targets={mesocycle.targets}
                />
              </Card>
              <Card>
                <h2 className="text-xl font-bold">
                  <Trans>Plan checks</Trans>
                </h2>
                <IssueList
                  issues={preview.proposal.report.issues}
                  days={mesocycle.days}
                  emptyText={t`Every check passed.`}
                />
              </Card>
              <Button
                variant="primary"
                size="lg"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void run((planning, deps) => planning.acceptNextMesocycle(deps, preview)).then(
                    (result) => {
                      setBusy(false);
                      if (result.ok) void navigate({ to: '/plan' });
                      else setError(t`The plan changed meanwhile. Open this page again.`);
                    },
                  );
                }}
              >
                <Trans>Accept the next block</Trans>
              </Button>
              <Link to="/plan" className={buttonClass({ size: 'lg' })}>
                <Trans>Not now</Trans>
              </Link>
            </>
          )}
        </Screen>
      </WhyNamesContext>
    </WhySimpleContext>
  );
}
