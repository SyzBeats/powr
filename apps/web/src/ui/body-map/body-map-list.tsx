import { useLingui } from '@lingui/react/macro';
import { Check } from 'lucide-react';
import { useId } from 'react';

import { cn } from '#ui/cn';

import { BODY_MAP_ARTWORK, type BodyView } from './artwork.gen';
import { bandLabel, HeatSwatch, useMuscleLabel, type BodyMapMuscle, type HeatBand } from './heat';

/**
 * The accessible list alternative of the body map (MAP-06): the same muscles, grouped Front and
 * Back in the figure's top-to-bottom order, with the same names, values, bands and selection.
 * Muscles visible in both views (side delts, forearms) appear in both groups, as on the figure.
 */
export function BodyMapList({
  muscles,
  bands,
  selected = null,
  onSelect,
  headingLevel = 3,
  className,
}: {
  readonly muscles: Readonly<Record<string, BodyMapMuscle>>;
  readonly bands?: readonly HeatBand[];
  readonly selected?: string | null;
  readonly onSelect?: (muscleId: string) => void;
  /** Level of the "Front" and "Back" headings (the screen's own heading sits above). */
  readonly headingLevel?: 2 | 3 | 4;
  readonly className?: string;
}) {
  const { t } = useLingui();
  const label = useMuscleLabel(bands);
  const baseId = useId();
  const Heading = `h${headingLevel}` as const;
  const titles: Record<BodyView, string> = { front: t`Front`, back: t`Back` };
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {(['front', 'back'] as const).map((view) => (
        <section key={view} aria-labelledby={`${baseId}-${view}`} className="flex flex-col gap-2">
          <Heading id={`${baseId}-${view}`} className="font-semibold">
            {titles[view]}
          </Heading>
          <ul className="flex flex-col gap-2">
            {BODY_MAP_ARTWORK.views[view].regions.map((region) => {
              const muscle = muscles[region.muscleId] ?? { name: region.muscleId };
              const pressed = region.muscleId === selected;
              const band = bandLabel(bands, muscle.step);
              return (
                <li key={region.id}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    aria-label={label(muscle)}
                    data-list-item={region.muscleId}
                    onClick={() => onSelect?.(region.muscleId)}
                    className={cn(
                      'flex min-h-target w-full items-center gap-3 rounded-xl border border-control bg-surface px-3 py-2 text-left',
                      pressed && 'border-2 border-fg',
                    )}
                  >
                    <HeatSwatch step={muscle.step ?? 0} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{muscle.name}</span>
                      {muscle.valueText || band ? (
                        <span className="text-sm text-fg-muted">
                          {[muscle.valueText, band].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                    </span>
                    {pressed ? <Check aria-hidden="true" className="size-5 shrink-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
