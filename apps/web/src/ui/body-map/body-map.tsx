import { useLingui } from '@lingui/react/macro';
import { Check } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { cn } from '#ui/cn';
import { Segmented } from '#ui/segmented';

import { BODY_MAP_ARTWORK, type ArtworkRegion, type BodyView } from './artwork.gen';
import {
  HEAT_FILL,
  HeatPatternDefs,
  HeatSwatch,
  heatPattern,
  useMuscleLabel,
  usePatternIds,
  type BodyMapMuscle,
  type HeatBand,
} from './heat';

export interface BodyMapProps {
  /** Per display group, keyed by muscle ID (`mu.chest`): name, heat band, value in words. */
  readonly muscles: Readonly<Record<string, BodyMapMuscle>>;
  /** The legend's bands: their labels complete the regions' names. */
  readonly bands?: readonly HeatBand[];
  /** The selected muscle ID (shown in both views where the muscle is visible). */
  readonly selected?: string | null;
  /** A region, its chip or Enter/Space on it was activated (M4b opens the muscle's panel). */
  readonly onSelect?: (muscleId: string) => void;
  /** Controlled view; without it the map keeps its own, starting at `defaultView`. */
  readonly view?: BodyView;
  readonly defaultView?: BodyView;
  readonly onViewChange?: (view: BodyView) => void;
  readonly className?: string;
}

const { hitStroke } = BODY_MAP_ARTWORK.reference;

/** The area outside every region (the hit areas count only there). */
function gapsPath(viewBox: string, regions: readonly ArtworkRegion[]): string {
  const [x = 0, y = 0, width = 0, height = 0] = viewBox.split(' ').map(Number);
  const pad = hitStroke * 2;
  const frame = ['m', x - pad, y - pad, 'h', width + 2 * pad, 'v', height + 2 * pad];
  return [...frame, 'h', -(width + 2 * pad), 'z', ...regions.map((region) => region.d)].join(' ');
}

/**
 * The interactive body map (MAP-01, MAP-04, MAP-06; technical concept §8.11): the original front
 * and back figure with a one-tap view switch, every display group a named, focusable button
 * ("Chest, 12 sets this week, In target") with `aria-pressed`, heat colouring from `--heat-0…5`
 * with patterns on the extremes, a thick double outline and dots when selected, a focus ring of
 * its own, and arrow keys along the artwork's precomputed neighbours (one tab stop).
 *
 * Taps: a visible region always takes its own taps. Around it, an invisible hit area (its outline
 * with a wide stroke) extends it into the gaps between regions, drawn in the artwork's order so a
 * smaller region wins a gap it shares with a larger one. The regions whose target stays under
 * 44 × 44 CSS px are repeated as buttons below the figure (MAP-01). Nothing animates.
 */
export function BodyMap({
  muscles,
  bands,
  selected = null,
  onSelect,
  view: controlledView,
  defaultView = 'front',
  onViewChange,
  className,
}: BodyMapProps) {
  const { t } = useLingui();
  const [ownView, setOwnView] = useState<BodyView>(defaultView);
  const view = controlledView ?? ownView;
  const art = BODY_MAP_ARTWORK.views[view];
  const label = useMuscleLabel(bands);
  const ids = usePatternIds();
  const gapsId = `${ids.selected}-gaps`;
  const hintId = useId();
  const chipsId = useId();
  const [active, setActive] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ readonly id: string; readonly visible: boolean } | null>(
    null,
  );
  const elements = useRef(new Map<string, SVGGElement>());
  const hitLayer = useRef<SVGGElement>(null);

  const muscleOf = (region: ArtworkRegion): BodyMapMuscle =>
    muscles[region.muscleId] ?? { name: region.muscleId };
  const byId = new Map(art.regions.map((region) => [region.id, region]));
  const selectedRegion = art.regions.find((region) => region.muscleId === selected);
  const focusedRegion = focus?.visible ? byId.get(focus.id) : undefined;
  const tabStop =
    (active && byId.has(active) ? active : null) ?? selectedRegion?.id ?? art.regions[0]?.id;
  const small = art.regions.filter((region) => region.small);

  // Taps on the hit areas (decorative copies, so a delegated listener; keyboard and screen
  // readers use the region buttons).
  useEffect(() => {
    const layer = hitLayer.current;
    if (!layer) return undefined;
    const onClick = (event: MouseEvent) => {
      const id = (event.target as Element | null)?.closest('[data-hit]')?.getAttribute('data-hit');
      const region = id
        ? BODY_MAP_ARTWORK.views[view].regions.find((entry) => entry.id === id)
        : undefined;
      if (!region) return;
      setActive(region.id);
      onSelect?.(region.muscleId);
    };
    layer.addEventListener('click', onClick);
    return () => layer.removeEventListener('click', onClick);
  }, [view, onSelect]);

  const changeView = (next: BodyView) => {
    setOwnView(next);
    onViewChange?.(next);
  };

  const onKeyDown = (region: ArtworkRegion, event: KeyboardEvent<SVGGElement>) => {
    let target: string | null;
    switch (event.key) {
      case 'ArrowUp':
        target = region.neighbours.up;
        break;
      case 'ArrowDown':
        target = region.neighbours.down;
        break;
      case 'ArrowLeft':
        target = region.neighbours.left;
        break;
      case 'ArrowRight':
        target = region.neighbours.right;
        break;
      case 'Home':
        target = art.regions[0]?.id ?? null;
        break;
      case 'End':
        target = art.regions.at(-1)?.id ?? null;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect?.(region.muscleId);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (!target) return;
    setActive(target);
    elements.current.get(target)?.focus();
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Segmented<BodyView>
        label={t`Body view`}
        value={view}
        onChange={changeView}
        options={[
          { value: 'front', label: t`Front` },
          { value: 'back', label: t`Back` },
        ]}
      />
      <svg
        viewBox={art.viewBox}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an <svg> cannot be a <fieldset>
        role="group"
        aria-label={view === 'front' ? t`Front view, body map` : t`Back view, body map`}
        aria-describedby={hintId}
        className="mx-auto block h-auto w-full max-w-[20rem] overflow-visible"
        data-view={view}
      >
        <HeatPatternDefs ids={ids} />
        <clipPath id={gapsId}>
          <path clipRule="evenodd" d={gapsPath(art.viewBox, art.regions)} />
        </clipPath>
        <path
          d={art.silhouette}
          aria-hidden="true"
          strokeWidth="1.2"
          className="fill-surface-raised stroke-control"
        />
        {/* The region buttons, top to bottom (the reading order for screen readers). */}
        {art.regions.map((region) => {
          const muscle = muscleOf(region);
          const step = muscle.step ?? null;
          const pattern = heatPattern(step);
          const pressed = region.muscleId === selected;
          return (
            <g
              key={region.id}
              ref={(element) => {
                if (!element) return undefined;
                elements.current.set(region.id, element);
                return () => {
                  elements.current.delete(region.id);
                };
              }}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an SVG shape cannot be a <button>
              role="button"
              tabIndex={region.id === tabStop ? 0 : -1}
              aria-label={label(muscle)}
              aria-pressed={pressed}
              data-region={region.id}
              data-muscle={region.muscleId}
              data-step={step ?? undefined}
              data-small={region.small ? '' : undefined}
              onClick={() => {
                setActive(region.id);
                onSelect?.(region.muscleId);
              }}
              onKeyDown={(event) => onKeyDown(region, event)}
              onFocus={(event) =>
                setFocus({ id: region.id, visible: event.currentTarget.matches(':focus-visible') })
              }
              onBlur={() => setFocus(null)}
              className="cursor-pointer outline-none"
            >
              <path
                d={region.d}
                strokeWidth="1"
                className={cn(HEAT_FILL[step ?? 0], 'stroke-surface-raised')}
              />
              {pattern ? (
                <path d={region.d} fill={`url(#${ids[pattern]})`} pointerEvents="none" />
              ) : null}
              {pressed ? (
                <path d={region.d} fill={`url(#${ids.selected})`} pointerEvents="none" />
              ) : null}
            </g>
          );
        })}
        {art.details ? (
          <path
            d={art.details}
            aria-hidden="true"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            pointerEvents="none"
            className="stroke-surface-raised"
          />
        ) : null}
        {/* Hit areas in the gaps (§8.11, MAP-01), in the artwork's drawing order. */}
        <g ref={hitLayer} aria-hidden="true" clipPath={`url(#${gapsId})`}>
          {art.drawOrder.map((id) => (
            <path
              key={id}
              d={byId.get(id)?.d}
              fill="none"
              stroke="none"
              strokeWidth={hitStroke}
              strokeLinejoin="round"
              pointerEvents="all"
              className="cursor-pointer"
              data-hit={id}
            />
          ))}
        </g>
        <g aria-hidden="true" pointerEvents="none" fill="none" strokeLinejoin="round">
          {focusedRegion ? (
            <>
              <path d={focusedRegion.d} strokeWidth="6.5" className="stroke-bg" />
              <path d={focusedRegion.d} strokeWidth="3.5" className="stroke-focus" />
            </>
          ) : null}
          {selectedRegion ? (
            <>
              <path d={selectedRegion.d} strokeWidth="4.5" className="stroke-bg" />
              <path d={selectedRegion.d} strokeWidth="2" className="stroke-fg" />
            </>
          ) : null}
        </g>
      </svg>
      <p id={hintId} className="sr-only">
        {t`Arrow keys move between muscles. Enter selects one.`}
      </p>
      {small.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p id={chipsId} className="text-sm text-fg-muted">
            {t`Small on the figure, so also here:`}
          </p>
          <ul aria-labelledby={chipsId} className="flex flex-wrap gap-2">
            {small.map((region) => {
              const muscle = muscleOf(region);
              const pressed = region.muscleId === selected;
              return (
                <li key={region.id}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    aria-label={label(muscle)}
                    data-chip={region.id}
                    onClick={() => onSelect?.(region.muscleId)}
                    className={cn(
                      'flex min-h-target items-center gap-2 rounded-xl border border-control bg-surface px-3 font-medium',
                      pressed && 'border-2 border-fg',
                    )}
                  >
                    <HeatSwatch step={muscle.step ?? 0} />
                    <span>{muscle.name}</span>
                    {pressed ? <Check aria-hidden="true" className="size-4" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
