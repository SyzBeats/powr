import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

import type { PlanningAnswers, TemplateChoice } from '@powr/application/planning';
import type { TemplateId } from '@powr/domain';

import { Button } from '#ui/button';
import { ChoiceCards } from '#ui/choice';
import { Sheet } from '#ui/sheet';

import { usePlanning } from '../../hooks/use-planning';
import { useLabels } from '../labels';

/**
 * PLN-02 override: "Choose a different plan" opens a sheet with the plans of the user's style,
 * the recommended one first. Each says whether it fits the training days and level, with the
 * generator's own check; equipment and session time show in the regenerated preview's checks.
 * Picking the recommended plan clears the override.
 */
export function TemplateChooser({
  answers,
  selected,
  onSelect,
}: {
  answers: PlanningAnswers;
  /** The user's choice, if any (else the recommended plan is in use). */
  selected: TemplateId | undefined;
  onSelect: (templateId: TemplateId | null) => void;
}) {
  const { t } = useLingui();
  const run = usePlanning();
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(answers);
  const [loaded, setLoaded] = useState<{
    readonly key: string;
    readonly choices: readonly TemplateChoice[];
  } | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const input = JSON.parse(key) as PlanningAnswers;
    void run((planning, deps) => planning.templateChoices(deps, input)).then((result) => {
      if (!cancelled) setLoaded({ key, choices: result.choices });
    });
    return () => {
      cancelled = true;
    };
  }, [open, key, run]);
  const choices = loaded?.key === key ? loaded.choices : null;
  const recommended = choices?.find((choice) => choice.recommended)?.template.id;
  const days = new Set(answers.schedule.weekdays).size;

  const status = (choice: TemplateChoice): string => {
    if (choice.recommended) return t`Recommended for your ${days} training days and your level.`;
    if (choice.fits) return t`Fits your training days and your level.`;
    if (choice.why.rule === 'plan.template.levelMismatch') {
      const levels = choice.template.levels.map((level) => labels.level(level)).join(', ');
      return t`Made for other levels (${levels}).`;
    }
    return t`Needs ${choice.template.daysPerWeek} training days a week.`;
  };

  return (
    <>
      <div>
        <Button onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Trans>Choose a different plan</Trans>
        </Button>
      </div>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t`Choose a plan`}
        description={t`Plans for ${labels.style(answers.style)}. A plan that doesn't fit your days, level, equipment or session time says why in the preview.`}
        closeLabel={t`Close`}
      >
        {choices === null ? (
          <output className="block text-fg-muted">
            <Trans>Loading the plans…</Trans>
          </output>
        ) : (
          <ChoiceCards<TemplateId>
            legend={t`Plans`}
            value={selected ?? recommended ?? null}
            onChange={(templateId) => {
              onSelect(templateId === recommended ? null : templateId);
              setOpen(false);
            }}
            options={choices.map((choice) => ({
              value: choice.template.id,
              label: choice.template.name.en,
              description: (
                <>
                  <span className="block">{choice.template.description.en}</span>
                  <span className="block font-medium text-fg">{status(choice)}</span>
                </>
              ),
            }))}
          />
        )}
      </Sheet>
    </>
  );
}
