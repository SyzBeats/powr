import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';

import type {
  PlanDifferences,
  ProfileAnswers,
  ProfileChange,
  Replan,
} from '@powr/application/planning';

import { announce } from '#ui/announcer';
import { Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { useFocusRequest } from '../../hooks/use-focus-request';
import { usePlanning, useWeekStart } from '../../hooks/use-planning';
import { formatLocalDate } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';
import { draftFromProfile, type Draft } from '../onboarding/answers';
import { BaselinesStep } from '../onboarding/BaselinesStep';
import { useFieldErrors, useStepValidation } from '../onboarding/OnboardingFlow';
import {
  BodyStep,
  ExperienceStep,
  GoalStep,
  PrioritiesStep,
  ScheduleStep,
  type StepProps,
} from '../onboarding/steps';
import { PlanPreviewView } from '../plan/PlanPreviewView';
import { NotFound } from '../shell/NotFound';
import { WhySimpleContext } from '../why/WhySheet';
import { isProfileAnswer, type ProfileAnswer } from './profile-answers';
import { useAnswerTitle } from './ProfileSection';

/**
 * SET-08 (M5s): change one onboarding answer in Settings instead of redoing onboarding. The same
 * question as in onboarding, prefilled; "Save" asks the planning entry whether the plan would
 * change. If not, only the answer is stored. If it would, the new plan is shown first (what
 * changes, then the plan itself) and the user chooses: update the plan from next week (this week
 * stays as planned), or keep the current plan (the answer still applies to the next block or the
 * next plan). Nothing is stored before that choice.
 */
export function ProfileAnswerScreen({ answer }: { answer: string }) {
  if (!isProfileAnswer(answer)) return <NotFound />;
  return <AnswerEditor key={answer} answer={answer} />;
}

function AnswerEditor({ answer }: { answer: ProfileAnswer }) {
  const { t } = useLingui();
  const run = usePlanning();
  const navigate = useNavigate();
  const { weekStart } = useWeekStart();
  const validate = useStepValidation();
  const fieldErrors = useFieldErrors();
  const title = useAnswerTitle()(answer);
  const [stored, setStored] = useState<{
    readonly answers: ProfileAnswers;
    readonly draft: Draft;
  } | null>(null);
  const [edits, setEdits] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState<{
    readonly change: ProfileChange;
    readonly replan: Replan;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, focusSummary] = useFocusRequest<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;
    void run((planning, deps) => planning.profileAnswers(deps)).then((answers) => {
      if (cancelled) return;
      if (!answers) {
        void navigate({ to: '/settings', hash: 'profile', replace: true });
        return;
      }
      const draft: Draft = {
        ...draftFromProfile(answers.profile, answers.equipment ?? undefined),
        ...(answers.plan
          ? {
              schedule: {
                weekdays: answers.plan.schedule.weekdays,
                sessionMinutes: answers.plan.schedule.sessionMinutes,
              },
              startTimes: answers.plan.schedule.startTimes,
            }
          : {}),
      };
      setStored({ answers, draft });
    });
    return () => {
      cancelled = true;
    };
  }, [run, navigate]);

  if (!stored) {
    return (
      <Screen title={title} context={t`Settings`}>
        <p className="text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      </Screen>
    );
  }

  const draft = edits ?? stored.draft;
  const novice =
    draft.experience?.trainingAge === 'under6Months' || draft.experience?.rpeFamiliarity === 'none';
  const update = (patch: Draft) => {
    setEdits({ ...draft, ...patch });
    setErrors({});
  };
  const showErrors = (found: Record<string, string>) => {
    setErrors(found);
    focusSummary();
  };
  const back = () => void navigate({ to: '/settings', hash: 'profile' });
  const finish = async (change: ProfileChange, replan: Replan | null) => {
    setBusy(true);
    const saved = await run((planning, deps) =>
      planning.saveProfileChange(deps, { change, replan }),
    );
    setBusy(false);
    if (!saved.ok) {
      if (saved.error.kind === 'invalidAnswers') showErrors(fieldErrors(saved.error.fields));
      else if (saved.error.kind === 'stale') setReview(null);
      return;
    }
    announce(saved.value.replanned ? t`Saved. Your plan is updated.` : t`Saved.`);
    if (saved.value.replanned) void navigate({ to: '/plan' });
    else back();
  };
  const save = async () => {
    const found = validate(answer, draft);
    if (Object.keys(found).length > 0) return showErrors(found);
    const change = changeOf(answer, draft);
    setBusy(true);
    const preview = await run((planning, deps) => planning.previewProfileChange(deps, change));
    setBusy(false);
    if (!preview.ok) {
      if (preview.error.kind === 'invalidAnswers') showErrors(fieldErrors(preview.error.fields));
      return;
    }
    if (preview.value.replan) setReview({ change, replan: preview.value.replan });
    else await finish(change, null);
  };

  if (review) {
    return (
      <WhySimpleContext value={novice}>
        <ReplanReview
          answerTitle={title}
          review={review}
          equipment={stored.answers.equipment ?? undefined}
          novice={novice}
          busy={busy}
          onApply={() => void finish(review.change, review.replan)}
          onKeep={() => void finish(review.change, null)}
          onCancel={back}
          onEdit={() => setReview(null)}
        />
      </WhySimpleContext>
    );
  }

  const props: StepProps = { draft, update, errors, weekStart, inSettings: true };
  return (
    <WhySimpleContext value={novice}>
      <Screen title={title} context={t`Settings`}>
        {Object.keys(errors).length > 0 ? (
          <div ref={summary} tabIndex={-1} role="alert" className="outline-none">
            <Callout tone="danger" title={t`Please check your answers`}>
              <ul className="list-disc pl-5">
                {Object.values(errors).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Callout>
          </div>
        ) : null}
        <StepFor answer={answer} props={props} />
        <p className="text-sm text-fg-muted">
          <Trans>
            If this changes your plan, you see the new plan first and decide whether to use it.
          </Trans>
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" disabled={busy} onClick={() => void save()}>
            <Trans>Save</Trans>
          </Button>
          <Button size="lg" disabled={busy} onClick={back}>
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </Screen>
    </WhySimpleContext>
  );
}

function StepFor({ answer, props }: { answer: ProfileAnswer; props: StepProps }) {
  switch (answer) {
    case 'goal':
      return <GoalStep {...props} />;
    case 'experience':
      return <ExperienceStep {...props} />;
    case 'schedule':
      return <ScheduleStep {...props} />;
    case 'body':
      return <BodyStep {...props} />;
    case 'priorities':
      return <PrioritiesStep {...props} />;
    case 'baselines':
      return <BaselinesStep {...props} />;
    default:
      return assertNever(answer);
  }
}

/** The change one editor makes, in the use case's terms (only that answer's fields). */
function changeOf(answer: ProfileAnswer, draft: Draft): ProfileChange {
  switch (answer) {
    case 'goal':
      return {
        ...(draft.style ? { style: draft.style } : {}),
        ...(draft.phase ? { phase: draft.phase } : {}),
      };
    case 'experience':
      return draft.experience ? { experience: draft.experience } : {};
    case 'schedule':
      return draft.schedule
        ? {
            schedule: {
              weekdays: draft.schedule.weekdays,
              sessionMinutes: draft.schedule.sessionMinutes,
              startTimes: (draft.startTimes ?? []).filter((entry) =>
                draft.schedule?.weekdays.includes(entry.weekday),
              ),
            },
          }
        : {};
    case 'body':
      return {
        ...(draft.sex ? { sex: draft.sex } : {}),
        referenceSet: draft.referenceSet ?? null,
        birthYear: draft.birthYear ?? null,
        height: draft.height ?? null,
      };
    case 'priorities':
      return {
        priorities: draft.priorities ?? [],
        avoid: draft.avoid ?? { exercises: [], patterns: [] },
      };
    case 'baselines':
      return { baselines: draft.baselines ?? [] };
    default:
      return assertNever(answer);
  }
}

/** SET-08's preview: what changes in words, the new plan, then the choice. */
function ReplanReview({
  answerTitle,
  review,
  equipment,
  novice,
  busy,
  onApply,
  onKeep,
  onCancel,
  onEdit,
}: {
  answerTitle: string;
  review: { readonly change: ProfileChange; readonly replan: Replan };
  equipment: ProfileAnswers['equipment'] | undefined;
  novice: boolean;
  busy: boolean;
  onApply: () => void;
  onKeep: () => void;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const { t } = useLingui();
  const { replan, change } = review;
  const from = formatLocalDate(replan.from, 'long');
  const schedule = change.schedule !== undefined;
  return (
    <Screen title={t`Your plan would change`}>
      <Card>
        <p>
          <Trans>
            With your new answer ({answerTitle}), POWR worked out your plan again. Nothing is saved
            yet.
          </Trans>
        </p>
        <Differences differences={replan.differences} />
        <p className="text-sm text-fg-muted">
          <Trans>
            If you update, the new plan starts on {from}. This week stays as planned. Changes you
            made to the current plan by hand do not carry over.
          </Trans>
        </p>
      </Card>
      <PlanPreviewView
        preview={replan.preview}
        equipment={equipment ?? undefined}
        novice={novice}
      />
      <div className="flex flex-col gap-2" data-testid="replan-choices">
        <Button variant="primary" size="lg" disabled={busy} onClick={onApply}>
          <Trans>Update my plan from {from}</Trans>
        </Button>
        {schedule ? (
          <Button size="lg" disabled={busy} onClick={onCancel}>
            <Trans>Keep my current plan and days</Trans>
          </Button>
        ) : (
          <>
            <Button size="lg" disabled={busy} onClick={onKeep}>
              <Trans>Keep my current plan</Trans>
            </Button>
            <p className="text-sm text-fg-muted">
              {replan.nextBlock ? (
                <Trans>
                  Your answer is saved, and the plan stays as it is. The next block uses your new
                  answer.
                </Trans>
              ) : (
                <Trans>
                  Your answer is saved, and the plan stays as it is. Your next plan uses it.
                </Trans>
              )}
            </p>
          </>
        )}
        <Button size="lg" variant="ghost" disabled={busy} onClick={onEdit}>
          <Trans>Back to the question</Trans>
        </Button>
      </div>
      <Link
        to="/settings"
        hash="profile"
        className="flex min-h-target items-center font-semibold text-primary underline-offset-4 hover:underline"
      >
        <Trans>Back to Settings</Trans>
      </Link>
    </Screen>
  );
}

/** What a re-plan changes, in words (template, days, weekly sets, exercises). */
function Differences({ differences }: { differences: PlanDifferences }) {
  const labels = useLabels();
  const items: { readonly key: string; readonly text: ReactNode }[] = [];
  const { template, days, targets, added, removed } = differences;
  if (template) {
    const before = labels.template(template.from);
    const after = labels.template(template.to);
    items.push({
      key: 'template',
      text: (
        <Trans>
          Plan: {before} → {after}
        </Trans>
      ),
    });
  }
  if (days) {
    const before = days.from;
    const after = days.to;
    items.push({
      key: 'days',
      text: (
        <Trans>
          Training days a week: {before} → {after}
        </Trans>
      ),
    });
  }
  for (const target of targets) {
    const muscle = labels.muscle(target.muscle);
    const before = Math.round(target.from * 10) / 10;
    const after = Math.round(target.to * 10) / 10;
    items.push({
      key: `target-${target.muscle}`,
      text: (
        <Trans>
          Weekly sets for {muscle}: {before} → {after}
        </Trans>
      ),
    });
  }
  if (added.length > 0) {
    const names = added.map((id) => labels.exercise(id)).join(', ');
    items.push({ key: 'added', text: <Trans>New exercises: {names}</Trans> });
  }
  if (removed.length > 0) {
    const names = removed.map((id) => labels.exercise(id)).join(', ');
    items.push({ key: 'removed', text: <Trans>No longer in the plan: {names}</Trans> });
  }
  if (items.length === 0) return null;
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5" data-testid="replan-differences">
      {items.map((item) => (
        <li key={item.key}>{item.text}</li>
      ))}
    </ul>
  );
}
