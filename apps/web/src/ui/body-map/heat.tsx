import { useLingui } from '@lingui/react/macro';
import { useCallback, useId } from 'react';

import { cn } from '#ui/cn';

/**
 * The weekly-volume heat bands of the body map (MAP-04, §8.11, tokens `--heat-0…5`): 0 none,
 * 1 below the floor (< 4 sets), 2 below target, 3 in target, 4 high (20–30), 5 very high (> 30).
 * Colour never carries the band alone (NFR-A11Y-05/10): band 1 has a diagonal hatch, band 5 a
 * cross-hatch, every region's name says its band, and the legend repeats the patterns.
 */
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;

/** One legend entry; its label also completes the regions' names ("Chest, 12 sets, In target"). */
export interface HeatBand {
  readonly step: HeatStep;
  readonly label: string;
}

/** A muscle's data on the map and in the list (keyed by display-group muscle ID, `mu.chest`). */
export interface BodyMapMuscle {
  /** The muscle's display name, e.g. "Chest". */
  readonly name: string;
  /** Heat band (MAP-04); absent or null: no heat colouring, the plain figure. */
  readonly step?: HeatStep | null;
  /** The value in words, e.g. "12 sets this week"; shown in the list and part of the name. */
  readonly valueText?: string;
}

/** Literal class names, so Tailwind finds them. */
export const HEAT_FILL = [
  'fill-heat-0',
  'fill-heat-1',
  'fill-heat-2',
  'fill-heat-3',
  'fill-heat-4',
  'fill-heat-5',
] as const;

/** The pattern of a band, if it has one (the extremes, MAP-04). */
export function heatPattern(step: HeatStep | null | undefined): 'hatch' | 'cross' | null {
  return step === 1 ? 'hatch' : step === 5 ? 'cross' : null;
}

/** Pattern IDs unique to one SVG (React's IDs carry characters that a url(#…) reference dislikes). */
export function usePatternIds() {
  const base = `bm${useId().replaceAll(/[^a-zA-Z0-9]/g, '')}`;
  return { hatch: `${base}-hatch`, cross: `${base}-cross`, selected: `${base}-selected` };
}

/**
 * The patterns: lines and dots in the page background colour, which every heat step contrasts
 * with at 3:1 or more in both themes (the token gate checks the steps against the backgrounds).
 */
export function HeatPatternDefs({ ids }: { ids: ReturnType<typeof usePatternIds> }) {
  return (
    <defs>
      <pattern
        id={ids.hatch}
        width="5"
        height="5"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1="1" y1="0" x2="1" y2="5" strokeWidth="1.6" className="stroke-bg" />
      </pattern>
      <pattern
        id={ids.cross}
        width="5"
        height="5"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1="1" y1="0" x2="1" y2="5" strokeWidth="1.4" className="stroke-bg" />
        <line x1="0" y1="3.5" x2="5" y2="3.5" strokeWidth="1.4" className="stroke-bg" />
      </pattern>
      <pattern id={ids.selected} width="4" height="4" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.9" className="fill-bg" />
      </pattern>
    </defs>
  );
}

/** A small legend or list swatch: the band's colour and pattern (decorative, the text names it). */
export function HeatSwatch({ step, className }: { step: HeatStep; className?: string }) {
  const ids = usePatternIds();
  const pattern = heatPattern(step);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 14"
      className={cn('h-3.5 w-5 shrink-0 overflow-visible', className)}
    >
      {pattern ? <HeatPatternDefs ids={ids} /> : null}
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="13"
        rx="3"
        strokeWidth="1"
        className={cn(HEAT_FILL[step], 'stroke-control')}
      />
      {pattern ? (
        <rect x="0.5" y="0.5" width="19" height="13" rx="3" fill={`url(#${ids[pattern]})`} />
      ) : null}
    </svg>
  );
}

/** "Chest, 12 sets this week, In target": the same accessible name on the map and in the list. */
export function useMuscleLabel(bands: readonly HeatBand[] | undefined) {
  const { t } = useLingui();
  return useCallback(
    (muscle: BodyMapMuscle) => {
      const { name, valueText } = muscle;
      const band = bandLabel(bands, muscle.step);
      if (valueText && band) return t`${name}, ${valueText}, ${band}`;
      if (valueText) return t`${name}, ${valueText}`;
      if (band) return t`${name}, ${band}`;
      return name;
    },
    [bands, t],
  );
}

/** The band label of a step (visible in the list, part of every name). */
export function bandLabel(
  bands: readonly HeatBand[] | undefined,
  step: HeatStep | null | undefined,
): string | undefined {
  return step === null || step === undefined
    ? undefined
    : bands?.find((entry) => entry.step === step)?.label;
}
