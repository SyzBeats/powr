import { useId } from 'react';

import { cn } from '#ui/cn';

import { HeatSwatch, type HeatBand } from './heat';

/**
 * The heat map's legend (MAP-04, §8.9.2 `HeatLegend`): every band as a swatch with its pattern
 * and its words. The labels come from the screen (the user's own band numbers, for example
 * "In target, 10–20 sets"); they are the same labels that complete the regions' names.
 */
export function HeatLegend({
  title,
  bands,
  className,
}: {
  /** Visible title, e.g. "Hard sets this week". */
  title: string;
  bands: readonly HeatBand[];
  className?: string;
}) {
  const titleId = useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p id={titleId} className="text-sm font-semibold">
        {title}
      </p>
      <ul aria-labelledby={titleId} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {bands.map((band) => (
          <li key={band.step} className="flex items-center gap-2">
            <HeatSwatch step={band.step} />
            <span>{band.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
