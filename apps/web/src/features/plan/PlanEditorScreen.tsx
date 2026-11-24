import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, Lock, LockOpen, Minus, Plus, Repeat, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { EditScope, PlanEditPreview } from '@powr/application/planning';
import type { ExerciseId, IsoWeekday, MuscleId, Plan, PlanDay, PlanSlot } from '@powr/domain';
import {
  setsOf,
  type PlanEdit,
  type PlanFix,
  type SlotCandidate,
  type ValidationIssue,
} from '@powr/domain/planning';
import { editsForFix } from '@powr/domain/planning';

import { ActionBar } from '#ui/action-bar';
import { Badge, Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { ChoiceCards } from '#ui/choice';
import { Card, Screen } from '#ui/screen';
import { Sheet } from '#ui/sheet';

import { useActivePlan, useCatalog, usePlanning, useProfile } from '../../hooks/use-planning';
import { useLabels } from '../labels';
import { WhyNamesContext, WhySimpleContext } from '../why/WhySheet';
import { isInputFix } from './format';
import { DayCard, IssueList, LiftList, VolumeList } from './parts';

/**
 * PLN-09 plan editor: edits are the domain's `PlanEdit`s; `previewPlanEdit` validates the week
 * live after every change, the report's issues offer one-tap fixes (`editsForFix`), warnings can
 * be dismissed (stored on the plan, so they stay dismissed for the same plan state), and saving
 * asks whether the change applies from the next session or the next block. Validation never
 * blocks saving. Every reorder has buttons (no drag-only path, NFR-A11Y-04).
 */
export function PlanEditorScreen() {
  const { t } = useLingui();
  const plan = useActivePlan();
  const profile = useProfile();
  if (!plan.loaded || !profile.loaded) {
    return (
      <Screen title={t`Edit plan`}>
        <p className="text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      </Screen>
    );
  }
  if (!plan.value) {
    return (
      <Screen title={t`Edit plan`}>
        <p>
          <Trans>There is no plan to edit yet.</Trans>
        </p>
        <Link to="/plan" className={buttonClass({ size: 'lg' })}>
          <Trans>Back to the plan</Trans>
        </Link>
      </Screen>
    );
  }
  const novice =
    profile.value?.experience.trainingAge === 'under6Months' ||
    profile.value?.experience.rpeFamiliarity === 'none';
  return <Editor key={plan.value.id} plan={plan.value} novice={novice} />;
}

function Editor({ plan, novice }: { plan: Plan; novice: boolean }) {
  const { t } = useLingui();
  const run = usePlanning();
  const navigate = useNavigate();
  const labels = useLabels();
  const [edits, setEdits] = useState<readonly PlanEdit[]>([]);
  const [preview, setPreview] = useState<PlanEditPreview | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swap, setSwap] = useState<{ dayKey: string; slot: PlanSlot } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const sequence = useRef(0);

  // Live validation (PLN-09): every change re-validates the whole week; stale answers are dropped.
  useEffect(() => {
    const id = ++sequence.current;
    void run((planning, deps) => planning.previewPlanEdit(deps, { planId: plan.id, edits })).then(
      (result) => {
        if (id === sequence.current && result.ok) setPreview(result.value);
      },
    );
  }, [run, plan.id, edits]);

  const dismissed = new Set(plan.dismissedIssues);
  const issues = preview?.report.issues ?? [];
  const open = issues.filter((issue) => !dismissed.has(issue.key));
  const hidden = issues.filter((issue) => dismissed.has(issue.key));
  const violations = open.filter((issue) => issue.severity === 'violation').length;
  const warnings = open.length - violations;

  // A polite summary: the live region's text only changes when the counts change, so screen
  // readers hear one short update per real change (WCAG 4.1.3, no flooding).
  const summary =
    violations + warnings === 0
      ? t`All checks pass.`
      : t`${violations} need attention, ${warnings} worth a look.`;
  const apply = (next: readonly PlanEdit[]) => setEdits((current) => [...current, ...next]);
  const days = preview?.days ?? currentDays(plan);
  const fixable = (fix: PlanFix) => isInputFix(fix) || editsForFix(fix, days).length > 0;
  const onFix = (_issue: ValidationIssue, fix: PlanFix) => {
    if (isInputFix(fix)) void navigate({ to: '/plan/setup/$step', params: { step: 'schedule' } });
    else apply(editsForFix(fix, days));
  };

  const save = async (scope: EditScope) => {
    setSaving(true);
    const result = await run((planning, deps) =>
      planning.savePlanEdit(deps, { planId: plan.id, edits, scope }),
    );
    setSaving(false);
    if (result.ok) void navigate({ to: '/plan' });
  };
  const [asking, setAsking] = useState(false);
  const minutes = (dayKey: string) =>
    preview?.report.analysis.days.find((day) => day.dayKey === dayKey)?.minutes;
  const budget = plan.schedule.sessionMinutes;

  return (
    <WhySimpleContext value={novice}>
      <WhyNamesContext value={{ days }}>
        <Screen title={t`Edit plan`}>
          <output aria-live="polite" className="sr-only">
            {preview ? summary : ''}
          </output>
          <Card>
            <h2 className="text-lg font-bold">
              <Trans>Checks</Trans>
            </h2>
            <p aria-hidden="true">{preview ? summary : t`Checking…`}</p>
            <IssueList
              issues={open.map((issue) => ({ ...issue, fixes: issue.fixes.filter(fixable) }))}
              days={days}
              onFix={onFix}
              onDismiss={(issue) =>
                void run((planning, deps) =>
                  planning.dismissPlanIssue(deps, { planId: plan.id, key: issue.key }),
                )
              }
            />
            {hidden.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={() => setShowDismissed((value) => !value)}>
                  {showDismissed ? (
                    <Trans>Hide dismissed warnings</Trans>
                  ) : (
                    <Plural
                      value={hidden.length}
                      one="Show # dismissed warning"
                      other="Show # dismissed warnings"
                    />
                  )}
                </Button>
                {showDismissed ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void run((planning, deps) =>
                        planning.restorePlanIssues(deps, { planId: plan.id }),
                      )
                    }
                  >
                    <Trans>Show them again</Trans>
                  </Button>
                ) : null}
              </div>
            ) : null}
            {showDismissed ? <IssueList issues={hidden} days={days} /> : null}
          </Card>

          {days
            .map((day) => (
              <DayCard
                key={day.key}
                day={day}
                minutes={minutes(day.key)}
                budget={budget}
                novice={novice}
                headerExtra={
                  <WeekdayPicker
                    day={day}
                    onChange={(weekday) =>
                      apply([{ kind: 'setWeekday', dayKey: day.key, weekday }])
                    }
                  />
                }
                renderSlotExtra={(slotKey) => {
                  const index = day.slots.findIndex((slot) => slot.key === slotKey);
                  const slot = day.slots[index];
                  if (!slot) return null;
                  const name = labels.exercise(slot.exerciseId);
                  const sets = setsOf(slot.prescription);
                  return (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="icon"
                        aria-label={t`One set fewer of ${name}`}
                        disabled={sets <= 1}
                        onClick={() =>
                          apply([{ kind: 'setSets', dayKey: day.key, slotKey, sets: sets - 1 }])
                        }
                      >
                        <Minus aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        aria-label={t`One set more of ${name}`}
                        onClick={() =>
                          apply([{ kind: 'setSets', dayKey: day.key, slotKey, sets: sets + 1 }])
                        }
                      >
                        <Plus aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        aria-label={t`Swap ${name}`}
                        onClick={() => setSwap({ dayKey: day.key, slot })}
                      >
                        <Repeat aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        aria-label={t`Move ${name} up`}
                        disabled={index === 0}
                        onClick={() =>
                          apply([
                            { kind: 'moveSlot', dayKey: day.key, slotKey, toIndex: index - 1 },
                          ])
                        }
                      >
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        aria-label={t`Move ${name} down`}
                        disabled={index === day.slots.length - 1}
                        onClick={() =>
                          apply([
                            { kind: 'moveSlot', dayKey: day.key, slotKey, toIndex: index + 1 },
                          ])
                        }
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        aria-label={
                          slot.locked ? t`Unlock ${name}` : t`Keep ${name} in the next block`
                        }
                        aria-pressed={slot.locked === true}
                        onClick={() =>
                          apply([
                            { kind: 'lockSlot', dayKey: day.key, slotKey, locked: !slot.locked },
                          ])
                        }
                      >
                        {slot.locked ? (
                          <Lock aria-hidden="true" />
                        ) : (
                          <LockOpen aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t`Remove ${name}`}
                        onClick={() => apply([{ kind: 'removeSlot', dayKey: day.key, slotKey }])}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  );
                }}
              />
            ))
            .flatMap((card, index) => [
              card,
              <div key={`${days[index]!.key}-actions`} className="-mt-2 flex flex-wrap gap-2">
                <Button onClick={() => setAdding(days[index]!.key)}>
                  <Plus aria-hidden="true" />
                  <Trans>Add exercise to {days[index]!.name.en}</Trans>
                </Button>
                {days.length > 2 ? (
                  <Button
                    variant="ghost"
                    onClick={() => apply([{ kind: 'removeDay', dayKey: days[index]!.key }])}
                  >
                    <Trans>Remove this day</Trans>
                  </Button>
                ) : null}
              </div>,
            ])}

          {preview ? (
            <Card>
              <h2 className="text-lg font-bold">
                <Trans>Weekly sets per muscle</Trans>
              </h2>
              <TargetEditor
                preview={preview}
                onChange={(muscle, sets) => apply([{ kind: 'setTarget', muscle, sets }])}
              />
              <VolumeList analysis={preview.report.analysis} targets={preview.targets} />
              <LiftList analysis={preview.report.analysis} />
            </Card>
          ) : null}

          <ActionBar>
            <Button
              variant="primary"
              size="lg"
              disabled={edits.length === 0 || saving}
              onClick={() => setAsking(true)}
            >
              <Trans>Save changes</Trans>
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1"
                disabled={edits.length === 0}
                onClick={() => setEdits((current) => current.slice(0, -1))}
              >
                <Trans>Undo last change</Trans>
              </Button>
              <Link to="/plan" className={buttonClass({}, 'flex-1')}>
                {edits.length === 0 ? <Trans>Back</Trans> : <Trans>Discard</Trans>}
              </Link>
            </div>
          </ActionBar>

          <Sheet
            open={asking}
            onOpenChange={setAsking}
            title={t`When should the changes start?`}
            closeLabel={t`Close`}
          >
            <Button
              variant="primary"
              size="lg"
              disabled={saving}
              onClick={() => void save('nextSession')}
            >
              <Trans>From the next session</Trans>
            </Button>
            <Button size="lg" disabled={saving} onClick={() => void save('nextMesocycle')}>
              <Trans>From the next block</Trans>
            </Button>
          </Sheet>

          {swap ? (
            <SwapSheet
              plan={plan}
              target={swap}
              onClose={() => setSwap(null)}
              onPick={(exerciseId) => {
                apply([
                  { kind: 'swapExercise', dayKey: swap.dayKey, slotKey: swap.slot.key, exerciseId },
                ]);
                setSwap(null);
              }}
            />
          ) : null}
          {adding ? (
            <AddSheet
              plan={plan}
              day={days.find((day) => day.key === adding)!}
              existingKeys={days.flatMap((day) => day.slots.map((slot) => slot.key))}
              onClose={() => setAdding(null)}
              onAdd={(slot) => {
                apply([{ kind: 'addSlot', dayKey: adding, slot }]);
                setAdding(null);
              }}
            />
          ) : null}
        </Screen>
      </WhyNamesContext>
    </WhySimpleContext>
  );
}

function currentDays(plan: Plan): readonly PlanDay[] {
  const mesocycle =
    plan.mesocycles.find((entry) => entry.status === 'active') ?? plan.mesocycles.at(-1);
  return mesocycle?.days ?? [];
}

function WeekdayPicker({
  day,
  onChange,
}: {
  day: PlanDay;
  onChange: (weekday: IsoWeekday) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const id = `weekday-${day.key}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-sm text-fg-muted">
        <Trans>Training day</Trans>
      </label>
      <select
        id={id}
        value={day.weekday}
        onChange={(event) => onChange(Number(event.target.value) as IsoWeekday)}
        aria-label={t`Training day for ${day.name.en}`}
        className="min-h-target rounded-xl border border-control bg-surface px-3"
      >
        {([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => (
          <option key={weekday} value={weekday}>
            {labels.weekday(weekday)}
          </option>
        ))}
      </select>
    </div>
  );
}

function TargetEditor({
  preview,
  onChange,
}: {
  preview: PlanEditPreview;
  onChange: (muscle: MuscleId, sets: number) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  return (
    <details className="rounded-xl bg-surface-raised p-3">
      <summary className="min-h-target-min cursor-pointer font-semibold">
        <Trans>Change weekly targets</Trans>
      </summary>
      <ul className="flex flex-col gap-2 pt-2">
        {preview.targets.map((target) => {
          const name = labels.muscle(target.muscle);
          const sets = target.sets;
          return (
            <li key={target.muscle} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <Trans>
                  {name}: {sets} sets
                </Trans>
              </span>
              <span className="flex gap-2">
                <Button
                  size="icon"
                  aria-label={t`Lower the target for ${name}`}
                  disabled={sets <= 1}
                  onClick={() => onChange(target.muscle, sets - 1)}
                >
                  <Minus aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  aria-label={t`Raise the target for ${name}`}
                  onClick={() => onChange(target.muscle, sets + 1)}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function SwapSheet({
  plan,
  target,
  onClose,
  onPick,
}: {
  plan: Plan;
  target: { dayKey: string; slot: PlanSlot };
  onClose: () => void;
  onPick: (exerciseId: ExerciseId) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const run = usePlanning();
  const [candidates, setCandidates] = useState<readonly SlotCandidate[] | null>(null);
  useEffect(() => {
    void run((planning, deps) =>
      planning.slotCandidates(deps, {
        planId: plan.id,
        dayKey: target.dayKey,
        slotKey: target.slot.key,
      }),
    ).then(setCandidates);
  }, [run, plan.id, target]);
  const name = labels.exercise(target.slot.exerciseId);
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={t`Swap ${name}`}
      closeLabel={t`Close`}
    >
      <p className="text-fg-muted">
        <Trans>Exercises with your equipment for the same movement, best match first.</Trans>
      </p>
      {candidates === null ? (
        <p>
          <Trans>Loading…</Trans>
        </p>
      ) : candidates.filter((entry) => entry.exerciseId !== target.slot.exerciseId).length === 0 ? (
        <p>
          <Trans>No other exercise fits this slot with your equipment.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {candidates
            .filter((entry) => entry.exerciseId !== target.slot.exerciseId)
            .slice(0, 8)
            .map((entry, index) => (
              <li key={entry.exerciseId}>
                <Button
                  size="lg"
                  className="justify-between text-left"
                  onClick={() => onPick(entry.exerciseId)}
                >
                  <span>{labels.exercise(entry.exerciseId)}</span>
                  {index === 0 ? <Badge tone="ok">{t`Best match`}</Badge> : null}
                </Button>
              </li>
            ))}
        </ul>
      )}
    </Sheet>
  );
}

function AddSheet({
  plan,
  day,
  existingKeys,
  onClose,
  onAdd,
}: {
  plan: Plan;
  day: PlanDay;
  existingKeys: readonly string[];
  onClose: () => void;
  onAdd: (slot: PlanSlot) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const run = usePlanning();
  const groups = useCatalog()
    .muscles()
    .groups.filter((group) => !group.optional);
  const [muscle, setMuscle] = useState<MuscleId | null>(null);
  const [loaded, setLoaded] = useState<{
    readonly muscle: MuscleId;
    readonly list: readonly SlotCandidate[];
  } | null>(null);
  const candidates = loaded && loaded.muscle === muscle ? loaded.list : null;
  useEffect(() => {
    if (!muscle) return;
    void run((planning, deps) => planning.addCandidates(deps, { planId: plan.id, muscle })).then(
      (list) => setLoaded({ muscle, list }),
    );
  }, [run, plan.id, muscle]);
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={t`Add to ${day.name.en}`}
      closeLabel={t`Close`}
    >
      <ChoiceCards<string>
        legend={t`Which muscle should it train?`}
        value={muscle}
        onChange={(value) => setMuscle(value as MuscleId)}
        options={groups.map((group) => ({ value: group.id, label: group.name.en }))}
      />
      {muscle && candidates ? (
        <ul className="flex flex-col gap-2">
          {candidates.slice(0, 8).map((entry) => (
            <li key={entry.exerciseId}>
              <Button
                size="lg"
                className="text-left"
                onClick={() =>
                  void run((planning, deps) =>
                    planning.newPlanSlot(deps, {
                      planId: plan.id,
                      exerciseId: entry.exerciseId,
                      existingKeys,
                    }),
                  ).then((result) => (result.ok ? onAdd(result.value) : undefined))
                }
              >
                {labels.exercise(entry.exerciseId)}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {muscle && candidates?.length === 0 ? (
        <Callout tone="info">
          <Trans>No exercise with your equipment trains this muscle directly.</Trans>
        </Callout>
      ) : null}
    </Sheet>
  );
}
