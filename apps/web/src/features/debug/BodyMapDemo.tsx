import { useState } from 'react';

import { BodyMap } from '#ui/body-map/body-map';
import { BodyMapList } from '#ui/body-map/body-map-list';
import type { BodyMapMuscle, HeatBand, HeatStep } from '#ui/body-map/heat';
import { HeatLegend } from '#ui/body-map/heat-legend';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

/** Synthetic weekly sets per display group (spike S-5): every heat band appears at least once. */
const SETS: readonly (readonly [id: string, name: string, sets: number])[] = [
  ['mu.chest', 'Chest', 14],
  ['mu.front-delts', 'Front delts', 6],
  ['mu.side-delts', 'Side delts', 22],
  ['mu.elbow-flexors', 'Biceps', 9],
  ['mu.forearms', 'Forearms', 0],
  ['mu.abs', 'Abs', 3],
  ['mu.obliques', 'Obliques', 2],
  ['mu.quads', 'Quadriceps', 18],
  ['mu.adductors', 'Adductors', 5.5],
  ['mu.tibialis', 'Tibialis', 0],
  ['mu.upper-traps', 'Upper traps', 8],
  ['mu.mid-back', 'Mid back', 12.5],
  ['mu.lats', 'Lats', 16],
  ['mu.rear-delts', 'Rear delts', 31],
  ['mu.triceps', 'Triceps', 11],
  ['mu.lower-back', 'Lower back', 4],
  ['mu.glutes', 'Glutes', 26],
  ['mu.hamstrings', 'Hamstrings', 10],
  ['mu.calves', 'Calves', 34],
];

const BANDS: readonly HeatBand[] = [
  { step: 0, label: 'No sets' },
  { step: 1, label: 'Under 4 sets, below the floor' },
  { step: 2, label: '4–10 sets, below target' },
  { step: 3, label: '10–20 sets, in target' },
  { step: 4, label: '20–30 sets, high' },
  { step: 5, label: 'Over 30 sets, very high' },
];

function stepOf(sets: number): HeatStep {
  if (sets === 0) return 0;
  if (sets < 4) return 1;
  if (sets < 10) return 2;
  if (sets <= 20) return 3;
  return sets <= 30 ? 4 : 5;
}

function muscles(heat: boolean): Record<string, BodyMapMuscle> {
  return Object.fromEntries(
    SETS.map(([id, name, sets]) => [
      id,
      heat ? { name, step: stepOf(sets), valueText: `${sets} sets this week` } : { name },
    ]),
  );
}

/**
 * Developer demo of the body map (spike S-5, behind the debug tools): both views, heat colouring
 * with synthetic data, selection, the small-region chips, the legend and the list alternative.
 * English only, not product UI. M4b builds the real screen on the same components.
 */
export function BodyMapDemo() {
  const [heat, setHeat] = useState<'heat' | 'plain'>('heat');
  const [selected, setSelected] = useState<string | null>(null);
  const data = muscles(heat === 'heat');
  const bands = heat === 'heat' ? BANDS : undefined;
  return (
    <Screen title="Body map demo (S-5)">
      {/*
       * The figure gets the whole content column, not a padded card: 320 px wide at 360 px is
       * the reference size of the S-5 tap-target measurement.
       */}
      <Segmented
        label="Colouring"
        value={heat}
        onChange={setHeat}
        options={[
          { value: 'heat', label: 'Heat map' },
          { value: 'plain', label: 'Plain' },
        ]}
      />
      <BodyMap
        muscles={data}
        {...(bands ? { bands } : {})}
        selected={selected}
        onSelect={(id) => setSelected((current) => (current === id ? null : id))}
      />
      {bands ? <HeatLegend title="Hard sets this week" bands={bands} /> : null}
      <output data-testid="selected-muscle" className="font-semibold">
        {selected ? `Selected: ${data[selected]?.name ?? selected}` : 'Nothing selected'}
      </output>
      <Card>
        <h2 className="text-lg font-semibold">As a list</h2>
        <BodyMapList
          muscles={data}
          {...(bands ? { bands } : {})}
          selected={selected}
          onSelect={(id) => setSelected((current) => (current === id ? null : id))}
        />
      </Card>
    </Screen>
  );
}
