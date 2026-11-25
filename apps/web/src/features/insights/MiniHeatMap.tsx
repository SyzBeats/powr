import { useLingui } from '@lingui/react/macro';

import type { MuscleWeekRow } from '@powr/domain/analytics';

import { BodyMapMini } from '#ui/body-map/body-map-mini';
import { HeatLegend } from '#ui/body-map/heat-legend';

import { useHeatBands } from './words';

/**
 * The mini heat map of Home (ANL-01) and the workout summary (WKT-13): the static figure in
 * both views and its legend. A lazy chunk (`React.lazy`), so the body-map artwork never joins
 * the startup path (§8.19). The figure is decorative; the caller says the same in words
 * (`useHeatSentence`) and links to the interactive body map and its list.
 */
export default function MiniHeatMap({
  rows,
  legendTitle,
}: {
  rows: readonly Pick<MuscleWeekRow, 'muscle' | 'heat'>[];
  legendTitle?: string;
}) {
  const { t } = useLingui();
  const bands = useHeatBands();
  const steps = Object.fromEntries(rows.map((row) => [row.muscle, row.heat]));
  return (
    <div className="flex flex-col gap-3" data-testid="mini-heat-map">
      <BodyMapMini steps={steps} />
      <HeatLegend title={legendTitle ?? t`Hard sets per muscle`} bands={bands} />
    </div>
  );
}
