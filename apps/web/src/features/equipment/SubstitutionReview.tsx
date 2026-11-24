import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import type { AffectedSlot } from '@powr/application/planning';
import type { ExerciseId } from '@powr/domain';

import { Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { ChoiceCards } from '#ui/choice';
import { Card } from '#ui/screen';

import { useLabels } from '../labels';

export interface Substitution {
  readonly dayKey: string;
  readonly slotKey: string;
  readonly exerciseId: ExerciseId;
}

/**
 * EQP-05: the plan's exercises the changed equipment no longer allows, each with ranked
 * equipment-valid substitutes (best first, preselected). The user confirms each one or all at once.
 */
export function SubstitutionReview({
  affected,
  dayName,
  busy,
  onApply,
  onCancel,
}: {
  affected: readonly AffectedSlot[];
  dayName: (dayKey: string) => string;
  busy: boolean;
  onApply: (substitutions: Substitution[]) => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const [chosen, setChosen] = useState<Record<string, ExerciseId | 'keep'>>(() =>
    Object.fromEntries(
      affected.map((slot) => [
        `${slot.dayKey}/${slot.slotKey}`,
        slot.substitutes[0]?.exerciseId ?? 'keep',
      ]),
    ),
  );
  const substitutions = affected.flatMap((slot): Substitution[] => {
    const pick = chosen[`${slot.dayKey}/${slot.slotKey}`];
    return pick && pick !== 'keep'
      ? [{ dayKey: slot.dayKey, slotKey: slot.slotKey, exerciseId: pick }]
      : [];
  });

  return (
    <div className="flex flex-col gap-4">
      <Callout tone="warning" title={t`Some planned exercises need equipment you removed`}>
        <p>
          <Trans>
            Pick a replacement for each one. The best match for the same muscles comes first.
            Changes apply from your next session.
          </Trans>
        </p>
      </Callout>
      {affected.map((slot) => {
        const key = `${slot.dayKey}/${slot.slotKey}`;
        const missing = [
          ...slot.missing.allOf.map((id) => labels.equipment(id)),
          ...slot.missing.anyOf.map((group) =>
            group.map((id) => labels.equipment(id)).join(t` or `),
          ),
        ].join(', ');
        const exercise = labels.exercise(slot.exerciseId);
        const day = dayName(slot.dayKey);
        return (
          <Card key={key}>
            <h3 className="text-lg font-bold">
              <Trans>
                {exercise} ({day})
              </Trans>
            </h3>
            <p className="text-fg-muted">
              <Trans>Needs: {missing}</Trans>
            </p>
            {slot.substitutes.length === 0 ? (
              <p>
                <Trans>
                  No exercise with your equipment trains the same muscles. It stays in the plan and
                  is marked as unavailable until you change it in the plan editor.
                </Trans>
              </p>
            ) : (
              <ChoiceCards<string>
                legend={t`Replace ${exercise} with`}
                value={chosen[key] ?? 'keep'}
                onChange={(value) =>
                  setChosen((current) => ({ ...current, [key]: value as ExerciseId | 'keep' }))
                }
                options={[
                  ...slot.substitutes.slice(0, 4).map((candidate, index) => ({
                    value: candidate.exerciseId as string,
                    label: labels.exercise(candidate.exerciseId),
                    ...(index === 0 ? { description: t`Best match` } : {}),
                  })),
                  { value: 'keep', label: t`Keep it for now` },
                ]}
              />
            )}
          </Card>
        );
      })}
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => onApply(substitutions)}>
          {substitutions.length === affected.length ? (
            <Trans>Apply all replacements</Trans>
          ) : (
            <Trans>Apply the chosen replacements</Trans>
          )}
        </Button>
        <Button size="lg" disabled={busy} onClick={onCancel}>
          <Trans>Back to the equipment</Trans>
        </Button>
      </div>
    </div>
  );
}
