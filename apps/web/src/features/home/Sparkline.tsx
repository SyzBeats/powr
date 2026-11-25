import { cn } from '#ui/cn';

const WIDTH = 100;
const HEIGHT = 24;

/**
 * Home sparkline (§8.10 "Home sparklines", ANL-01): a hand-written SVG line of the last weeks'
 * bodyweight trend, so ECharts never loads on the cold-start path. Decorative (`aria-hidden`):
 * the card states the trend and the weekly rate in words next to it. Gaps (null) break the line.
 */
export function Sparkline({
  values,
  className,
}: {
  values: readonly (number | null)[];
  className?: string;
}) {
  const known = values.filter((value): value is number => value !== null);
  if (known.length < 2) return null;
  const min = Math.min(...known);
  const span = Math.max(...known) - min || 1;
  const step = WIDTH / Math.max(1, values.length - 1);
  // One polyline per run of known values.
  const segments: string[][] = [[]];
  values.forEach((value, index) => {
    if (value === null) {
      if (segments.at(-1)!.length > 0) segments.push([]);
      return;
    }
    const x = (index * step).toFixed(2);
    const y = (HEIGHT - 2 - ((value - min) / span) * (HEIGHT - 4)).toFixed(2);
    segments.at(-1)!.push(`${x},${y}`);
  });
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn('overflow-visible', className)}
    >
      {segments
        .filter((points) => points.length > 1)
        .map((points) => (
          <polyline
            key={points[0]}
            points={points.join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
    </svg>
  );
}
