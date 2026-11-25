import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import type { ExerciseId, MuscleId, PlanId } from '@powr/domain';
import type { PlanEdit } from '@powr/domain/planning';

import { announce } from '#ui/announcer';
import { Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { Sheet } from '#ui/sheet';

import { useLibraryQuery } from '../../hooks/use-library';
import { useLoad } from '../../hooks/use-load';
import { usePlanning } from '../../hooks/use-planning';
import { useLabels } from '../labels';
import { IssueList } from '../plan/parts';
import { WhyNamesContext } from '../why/WhySheet';

interface Choice {
  readonly edit: PlanEdit;
  /** "Add Cable fly to Push A" / "Replace Pec deck with Cable fly on Push A". */
  readonly label: string;
}

/**
 * MAP-05 "add it to a plan day (opens PLN-09)": the plan's days with "Add to <day>" and the
 * slots it could replace there; a choice is checked like an edit in the plan editor
 * (`previewPlanEdit`: the checks it adds) and saved from the next session or the next block
 * (`savePlanEdit`).
 */
export function PlaceInPlanSheet({
  exerciseId,
  muscle,
  name,
  open,
  onOpenChange,
}: {
  exerciseId: ExerciseId;
  muscle: MuscleId;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLingui();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t`Place ${name} in your plan`}
      closeLabel={t`Close`}
    >
      {open ? (
        <Placement
          exerciseId={exerciseId}
          muscle={muscle}
          name={name}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </Sheet>
  );
}

function Placement({
  exerciseId,
  muscle,
  name,
  onDone,
}: {
  exerciseId: ExerciseId;
  muscle: MuscleId;
  name: string;
  onDone: () => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const [choice, setChoice] = useState<Choice | null>(null);
  const placements = useLibraryQuery(`${exerciseId}|${muscle}`, (library, deps) =>
    library.planPlacements(deps, { exerciseId, muscle }),
  );
  if (!placements.loaded) {
    return (
      <output className="block text-fg-muted">
        <Trans>Loading your plan…</Trans>
      </output>
    );
  }
  const plan = placements.value;
  if (!plan) {
    return (
      <>
        <p>
          <Trans>You have no plan yet. Set one up, then place exercises in it from here.</Trans>
        </p>
        <Link
          to="/plan/setup/$step"
          params={{ step: 'goal' }}
          className={buttonClass({ variant: 'primary', size: 'lg' })}
        >
          <Trans>Set up a plan</Trans>
        </Link>
      </>
    );
  }
  if (choice) {
    return (
      <PlacementPreview
        planId={plan.planId}
        choice={choice}
        onBack={() => setChoice(null)}
        onSaved={onDone}
      />
    );
  }
  return (
    <>
      <p className="text-fg-muted">
        <Trans>Choose a training day. You see the plan checks before anything is saved.</Trans>
      </p>
      <ul className="flex flex-col gap-4" data-testid="plan-days">
        {plan.days.map((day) => {
          const add = t`Add ${name} to ${day.dayName}`;
          return (
            <li key={day.dayKey} className="flex flex-col gap-2">
              <h3 className="font-semibold">{day.dayName}</h3>
              <Button
                variant="secondary"
                className="justify-start text-left"
                onClick={() => setChoice({ edit: day.add, label: add })}
              >
                {add}
              </Button>
              {day.swaps.map((swap) => {
                const current = labels.exercise(swap.current);
                const replace = t`Replace ${current} with ${name}`;
                return (
                  <Button
                    key={swap.slotKey}
                    variant="secondary"
                    className="justify-start text-left"
                    onClick={() =>
                      setChoice({
                        edit: swap.edit,
                        label: t`Replace ${current} with ${name} on ${day.dayName}`,
                      })
                    }
                  >
                    {replace}
                  </Button>
                );
              })}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** The chosen edit, checked against the plan's week before saving (PLN-09). */
function PlacementPreview({
  planId,
  choice,
  onBack,
  onSaved,
}: {
  planId: PlanId;
  choice: Choice;
  onBack: () => void;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  const run = usePlanning();
  const heading = useRef<HTMLHeadingElement>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // The checks the week already has, and the ones it has with this change: only new ones show.
  const preview = useLoad(JSON.stringify(choice.edit), async () => {
    const [before, after] = await Promise.all([
      run((planning, deps) => planning.previewPlanEdit(deps, { planId, edits: [] })),
      run((planning, deps) => planning.previewPlanEdit(deps, { planId, edits: [choice.edit] })),
    ]);
    return before.ok && after.ok ? { before: before.value, after: after.value } : null;
  });

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const save = async (scope: 'nextSession' | 'nextMesocycle') => {
    setSaving(true);
    setFailed(false);
    const result = await run((planning, deps) =>
      planning.savePlanEdit(deps, { planId, edits: [choice.edit], scope }),
    );
    setSaving(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    announce(
      scope === 'nextSession'
        ? t`Saved to your plan from the next session: ${choice.label}.`
        : t`Saved to your plan from the next block: ${choice.label}.`,
    );
    onSaved();
  };

  const value = preview.loaded ? preview.value : null;
  const known = new Set(value?.before.report.issues.map((issue) => issue.key));
  const added = value?.after.report.issues.filter((issue) => !known.has(issue.key)) ?? [];

  return (
    <>
      <h3 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
        {choice.label}
      </h3>
      {!preview.loaded ? (
        <output className="block text-fg-muted">
          <Trans>Checking the plan…</Trans>
        </output>
      ) : value === null ? (
        <p>
          <Trans>The plan could not be checked. Try again from the plan editor.</Trans>
        </p>
      ) : added.length === 0 ? (
        <Callout tone="ok" title={t`No new warnings`}>
          <p>
            <Trans>The week's plan checks stay as they are with this change.</Trans>
          </p>
        </Callout>
      ) : (
        <WhyNamesContext value={{ days: value.after.days }}>
          <p className="font-semibold">
            <Trans>New or changed plan checks with this change:</Trans>
          </p>
          <IssueList issues={added} days={value.after.days} />
          <p className="text-sm text-fg-muted">
            <Trans>You can save anyway and adjust the week in the plan editor.</Trans>
          </p>
        </WhyNamesContext>
      )}
      {failed ? (
        <Callout tone="danger">
          <p>
            <Trans>The plan could not be saved. Try again.</Trans>
          </p>
        </Callout>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        disabled={saving || value === null}
        onClick={() => void save('nextSession')}
      >
        <Trans>Save from the next session</Trans>
      </Button>
      <Button
        size="lg"
        disabled={saving || value === null}
        onClick={() => void save('nextMesocycle')}
      >
        <Trans>Save from the next block</Trans>
      </Button>
      <Button variant="ghost" size="lg" onClick={onBack}>
        <Trans>Choose another day</Trans>
      </Button>
    </>
  );
}
