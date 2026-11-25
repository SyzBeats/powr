import { cn } from '#ui/cn';

import { BODY_MAP_ARTWORK, type BodyView } from './artwork.gen';
import { HEAT_FILL, HeatPatternDefs, heatPattern, usePatternIds, type HeatStep } from './heat';

/**
 * A small, static heat figure (ANL-01 Home, WKT-13 summary): front and back side by side, each
 * region in its heat band's colour and pattern. Decorative (`aria-hidden`): the caller states the
 * same information in words next to it and links to the interactive body map or its list
 * (MAP-06), so it has no tap targets of its own and may be as small as the layout needs.
 * Keyed by display-group muscle ID like `BodyMap`.
 */
export function BodyMapMini({
  steps,
  className,
}: {
  steps: Readonly<Record<string, HeatStep | null | undefined>>;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn('flex justify-center gap-2', className)}>
      <MiniView view="front" steps={steps} />
      <MiniView view="back" steps={steps} />
    </div>
  );
}

function MiniView({
  view,
  steps,
}: {
  view: BodyView;
  steps: Readonly<Record<string, HeatStep | null | undefined>>;
}) {
  const ids = usePatternIds();
  const art = BODY_MAP_ARTWORK.views[view];
  return (
    <svg viewBox={art.viewBox} className="h-auto w-1/2 max-w-[7.5rem]" data-mini-view={view}>
      <HeatPatternDefs ids={ids} />
      <path d={art.silhouette} strokeWidth="1.2" className="fill-surface-raised stroke-control" />
      {art.regions.map((region) => {
        const step = steps[region.muscleId] ?? 0;
        const pattern = heatPattern(step);
        return (
          <g key={region.id} data-step={step}>
            <path
              d={region.d}
              strokeWidth="1"
              className={cn(HEAT_FILL[step], 'stroke-surface-raised')}
            />
            {pattern ? <path d={region.d} fill={`url(#${ids[pattern]})`} /> : null}
          </g>
        );
      })}
      {art.details ? (
        <path
          d={art.details}
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="stroke-surface-raised"
        />
      ) : null}
    </svg>
  );
}
