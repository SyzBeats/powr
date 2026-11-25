import { Plural, Trans } from '@lingui/react/macro';
import { Table2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { Button } from '#ui/button';
import { cn } from '#ui/cn';

/**
 * The legend under a chart: plain HTML (it scales with the text size, unlike canvas text), each
 * entry a small drawing of the mark itself plus words, so a series is told apart by shape and
 * dash as well as colour (NFR-A11Y-10). The drawings are decorative; the words carry the meaning.
 */
export function Legend({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {children}
    </ul>
  );
}

export function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <svg aria-hidden="true" viewBox="0 0 24 12" className="h-3 w-6 shrink-0 overflow-visible">
        {swatch}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** Stroke classes of the chart series, in their fixed order (Tailwind needs literal names). */
const SERIES_STROKE = ['stroke-chart-1', 'stroke-chart-2', 'stroke-chart-3'] as const;
const SERIES_FILL = ['fill-chart-1', 'fill-chart-2', 'fill-chart-3'] as const;
/** Dash patterns that tell the series apart without colour (canvas and legend alike). */
export const SERIES_DASH = [undefined, '6 3', '2 3'] as const;

export function LineSwatch({ series, dash }: { series: 0 | 1 | 2; dash?: string | undefined }) {
  return (
    <line
      x1="0"
      y1="6"
      x2="24"
      y2="6"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeDasharray={dash}
      className={SERIES_STROKE[series]}
    />
  );
}

export function BandSwatch({ series }: { series: 0 | 1 | 2 }) {
  return (
    <>
      <rect x="0" y="1" width="24" height="10" fillOpacity="0.2" className={SERIES_FILL[series]} />
      <line x1="0" y1="1" x2="24" y2="1" strokeDasharray="3 2" className={SERIES_STROKE[series]} />
      <line
        x1="0"
        y1="11"
        x2="24"
        y2="11"
        strokeDasharray="3 2"
        className={SERIES_STROKE[series]}
      />
    </>
  );
}

/** The hollow symbol of raw points: circle, square or triangle by series. */
export function PointSwatch({ series }: { series: 0 | 1 | 2 }) {
  const common = { strokeWidth: 1.5, className: cn('fill-surface', SERIES_STROKE[series]) };
  if (series === 1) return <rect x="8" y="2" width="8" height="8" {...common} />;
  if (series === 2) return <path d="M12 1.5 17 10.5 7 10.5Z" {...common} />;
  return <circle cx="12" cy="6" r="4" {...common} />;
}

/** The PR star (also the canvas symbol): `--pr-accent` with a surface ring. */
export const STAR_PATH =
  'm12,0.5l2.7,7.3l7.8,0.3l-6.1,4.8l2.1,7.6l-6.5,-4.3l-6.5,4.3l2.1,-7.6l-6.1,-4.8l7.8,-0.3z';

export function StarSwatch() {
  return (
    <path
      d={STAR_PATH}
      transform="translate(6 0) scale(0.5)"
      strokeWidth="2"
      className="fill-pr-accent stroke-surface"
    />
  );
}

export function DiamondSwatch({ hollow = false }: { hollow?: boolean }) {
  return (
    <path
      d="M12 0.5 17.5 6 12 11.5 6.5 6Z"
      strokeWidth="1.5"
      className={hollow ? 'fill-surface stroke-fg' : 'fill-fg stroke-fg'}
    />
  );
}

const PAGE = 30;

/**
 * "View as table" (ANL-11, NFR-A11Y-06): an HTML table with a caption, the same values as the
 * chart, in pages of 30 rows so years of data do not flood the page.
 */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly string[];
  rows: readonly { readonly key: string; readonly cells: readonly string[] }[];
}) {
  const tableId = useId();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(PAGE);
  const shown = rows.slice(0, count);
  const more = Math.min(PAGE, rows.length - shown.length);
  return (
    <div className="flex flex-col gap-2">
      <Button
        className="self-start"
        aria-expanded={open}
        aria-controls={tableId}
        onClick={() => setOpen((value) => !value)}
      >
        <Table2 aria-hidden="true" />
        {open ? <Trans>Hide table</Trans> : <Trans>View as table</Trans>}
      </Button>
      <div id={tableId} hidden={!open} className="flex flex-col gap-2">
        {open ? (
          <>
            <table className="w-full border-collapse text-left text-sm tabular">
              <caption className="pb-1 text-left font-medium">{caption}</caption>
              <thead>
                <tr className="border-b border-control">
                  {columns.map((column) => (
                    <th key={column} scope="col" className="py-1 pr-2 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-1 text-fg-muted">
                      <Trans>No values in this range.</Trans>
                    </td>
                  </tr>
                ) : (
                  shown.map((row) => (
                    <tr key={row.key} className="border-b border-border">
                      {row.cells.map((cell, index) =>
                        index === 0 ? (
                          <th key={columns[index]} scope="row" className="py-1 pr-2 font-normal">
                            {cell}
                          </th>
                        ) : (
                          <td key={columns[index]} className="py-1 pr-2">
                            {cell}
                          </td>
                        ),
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {more > 0 ? (
              <Button className="self-start" onClick={() => setCount((value) => value + PAGE)}>
                <Plural value={more} one="Show # more row" other="Show # more rows" />
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
