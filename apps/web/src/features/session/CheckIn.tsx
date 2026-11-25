import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import type { ReadinessItem, SessionProposal, SessionView } from '@powr/domain/session';

import { Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';
import { Stepper } from '#ui/stepper';

import { usePlanning } from '../../hooks/use-planning';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';
import { WhyButton } from '../why/WhySheet';
import { useSessionCommands } from './commands';
import { useSessionUi } from './session-ui';

type Scale = Exclude<ReadinessItem, 'sleepHours'>;

const close = () => useSessionUi.setState({ proposals: null });

/**
 * RDY-01: the optional check-in before the first set, under 30 seconds: sleep hours, then chips
 * for sleep quality, energy, soreness, stress, motivation (1–5) and the Perceived Recovery Status
 * (0–10). Every item is optional; "Skip check-in" never blocks training. The assessment and the
 * proposals (RDY-02/03, PRG-13) follow.
 */
export function ReadinessCheckIn({ view }: { view: SessionView }) {
  const { t } = useLingui();
  const { dispatch } = useSessionCommands();
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [scales, setScales] = useState<Partial<Record<Scale, number>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (skip: boolean) => {
    setBusy(true);
    setError(null);
    const outcome = await dispatch(
      skip
        ? { type: 'READINESS', items: null }
        : {
            type: 'READINESS',
            items: { ...scales, ...(sleepHours === null ? {} : { sleepHours }) },
          },
    );
    setBusy(false);
    if (!outcome.ok) {
      setError(t`The check-in was not saved. Check the values and try again.`);
      return;
    }
    if (skip) return;
    const proposals = outcome.value.result.readiness?.proposals ?? [];
    useSessionUi.setState({
      proposals:
        proposals.length > 0 || outcome.value.swapWith
          ? {
              sessionId: view.session.id,
              items: proposals,
              swapWith: outcome.value.swapWith ?? null,
            }
          : null,
    });
  };

  const items: readonly { key: Scale; label: string; low: string; high: string; max: number }[] = [
    { key: 'sleepQuality', label: t`Sleep quality`, low: t`1 poor`, high: t`5 very good`, max: 5 },
    { key: 'energy', label: t`Energy`, low: t`1 exhausted`, high: t`5 full of energy`, max: 5 },
    { key: 'soreness', label: t`Soreness`, low: t`1 none`, high: t`5 very sore`, max: 5 },
    { key: 'stress', label: t`Stress`, low: t`1 relaxed`, high: t`5 very stressed`, max: 5 },
    { key: 'motivation', label: t`Motivation`, low: t`1 none`, high: t`5 eager to train`, max: 5 },
    {
      key: 'prs',
      label: t`How recovered do you feel?`,
      low: t`0 not at all`,
      high: t`10 fully`,
      max: 10,
    },
  ];

  return (
    <Screen title={t`How are you today?`}>
      <p className="text-fg-muted">
        <Trans>
          A quick check-in helps POWR suggest lighter work on low days. Every question is optional.
        </Trans>
      </p>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Card>
        <Stepper
          label={t`Hours of sleep last night`}
          value={sleepHours}
          onChange={setSleepHours}
          onStep={(direction, current) =>
            Math.min(24, Math.max(0, (current ?? 7) + direction * 0.5))
          }
          decrementLabel={t`Half an hour less sleep`}
          incrementLabel={t`Half an hour more sleep`}
          max={24}
        />
        {items.map((item) => (
          <div key={item.key} className="flex flex-col gap-1">
            <span aria-hidden="true" className="font-medium">
              {item.label}
            </span>
            <span className="flex justify-between text-sm text-fg-muted">
              <span>{item.low}</span>
              <span>{item.high}</span>
            </span>
            <Segmented
              label={item.label}
              value={scales[item.key] === undefined ? null : String(scales[item.key])}
              onChange={(next) =>
                setScales((current) => ({ ...current, [item.key]: Number(next) }))
              }
              options={Array.from({ length: item.max === 10 ? 11 : 5 }, (_, index) => {
                const value = String(item.max === 10 ? index : index + 1);
                return { value, label: value };
              })}
            />
          </div>
        ))}
      </Card>
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void submit(false)}>
          <Trans>Save check-in</Trans>
        </Button>
        <Button disabled={busy} onClick={() => void submit(true)}>
          <Trans>Skip check-in</Trans>
        </Button>
      </div>
    </Screen>
  );
}

/**
 * RDY-03 and PRG-13: the proposed changes for today, each with its reason. Nothing applies until
 * the user accepts (APPLY_CHANGES); a lighter session of the week can be done today instead.
 */
export function Proposals({
  view,
  proposals,
}: {
  view: SessionView;
  proposals: NonNullable<ReturnType<typeof useSessionUi.getState>['proposals']>;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const { dispatch, discard, start } = useSessionCommands();
  const planning = usePlanning();
  const [chosen, setChosen] = useState<readonly boolean[]>(() => proposals.items.map(() => true));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slotNames = (proposal: SessionProposal) =>
    proposal.change.slotKeys
      .map((key) => view.session.exercises.find((slot) => slot.key === key))
      .flatMap((slot) => (slot ? [labels.exercise(slot.exerciseId)] : []))
      .join(', ');

  const apply = async () => {
    const changes = proposals.items.filter((_, index) => chosen[index]).map((item) => item.change);
    if (changes.length === 0) {
      close();
      return;
    }
    setBusy(true);
    const outcome = await dispatch({ type: 'APPLY_CHANGES', changes });
    setBusy(false);
    if (!outcome.ok) {
      setError(t`The changes could not be applied. Try again or keep the plan.`);
      return;
    }
    close();
  };

  const swap = async () => {
    const planned = view.session.plannedSessionId;
    const other = proposals.swapWith;
    if (!planned || !other) return;
    setBusy(true);
    // The heavy day moves to the lighter day's date; the lighter one starts now (RDY-03).
    const discarded = await discard();
    const swapped = discarded.ok
      ? await planning((entry, deps) => entry.swapSessions(deps, { a: planned, b: other }))
      : null;
    const started =
      swapped?.ok === true ? await start({ kind: 'planned', plannedSessionId: other }) : null;
    setBusy(false);
    if (!started?.ok) setError(t`The sessions could not be swapped. Try again from the plan.`);
  };

  const proposalText = (proposal: SessionProposal): string => {
    const { change } = proposal;
    switch (change.kind) {
      case 'capTopSet':
        return t`Top sets one rep easier (+1 rep in reserve)`;
      case 'easeCompounds':
        return t`Compound lifts one rep easier (+1 rep in reserve)`;
      case 'dropBackoff': {
        const sets = change.dropSets ?? 1;
        return plural(sets, { one: 'Drop # back-off set', other: 'Drop # back-off sets' });
      }
      case 'trimVolume':
        return t`One working set fewer per exercise`;
      case 'returnFromBreak': {
        const low = Math.round(change.loadPct?.min ?? 90);
        const high = Math.round(change.loadPct?.max ?? 95);
        return t`Ease back in: ${low}–${high}% of your usual weights`;
      }
      default:
        return assertNever(change.kind);
    }
  };

  return (
    <Screen title={t`Suggested changes for today`}>
      <p className="text-fg-muted">
        <Trans>
          Based on your check-in and your recent training. Nothing changes unless you apply it.
        </Trans>
      </p>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {proposals.items.map((proposal, index) => {
        const names = slotNames(proposal);
        const text = proposalText(proposal);
        return (
          <Card key={`${proposal.change.kind}-${index}`} className="gap-2">
            <CheckRow
              label={text}
              description={names}
              checked={chosen[index] ?? false}
              onChange={(checked) =>
                setChosen((current) =>
                  current.map((value, position) => (position === index ? checked : value)),
                )
              }
            />
            <WhyButton why={proposal.why} subject={text} className="self-start" />
          </Card>
        );
      })}
      {proposals.swapWith && view.session.plannedSessionId ? (
        <Card>
          <p>
            <Trans>
              A lighter session is planned later this week. You can do it today instead.
            </Trans>
          </p>
          <Button disabled={busy} onClick={() => void swap()}>
            <Trans>Do the lighter session today</Trans>
          </Button>
        </Card>
      ) : null}
      <div className="flex flex-col gap-2">
        {proposals.items.length > 0 ? (
          <Button variant="primary" size="lg" disabled={busy} onClick={() => void apply()}>
            <Trans>Apply the selected changes</Trans>
          </Button>
        ) : null}
        <Button disabled={busy} onClick={close}>
          <Trans>Keep the plan as it is</Trans>
        </Button>
      </div>
    </Screen>
  );
}
