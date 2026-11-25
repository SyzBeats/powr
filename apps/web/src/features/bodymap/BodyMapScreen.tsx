import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { List, PersonStanding } from 'lucide-react';
import { useId } from 'react';

import type { WeeklyVolumeView } from '@powr/application/insights';

import { BodyMap } from '#ui/body-map/body-map';
import { BodyMapList } from '#ui/body-map/body-map-list';
import type { BodyMapMuscle } from '#ui/body-map/heat';
import { HeatLegend } from '#ui/body-map/heat-legend';
import { Button } from '#ui/button';
import { Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useLiveInsight } from '../../hooks/use-insights';
import type { Loadable } from '../../hooks/use-load';
import { useCatalog } from '../../hooks/use-planning';
import { addLocalDays, formatLocalDate } from '../../i18n/format';
import { useHeatBands, useSetsText, useVolumeWords } from '../insights/words';
import { useLabels } from '../labels';
import { panelSearch, patchSearch, type BodyMapSearch, type VolumeMode } from './search';
import { useBodyMapWords } from './words';

/**
 * `/explore/body-map` (MAP-01, MAP-04, MAP-06): the front and back figure coloured by this week's
 * fractional hard sets (or last week's, or the 4-week average) against each muscle's target band,
 * the legend, and the list alternative one tap away. The figure gets the whole content column
 * (the S-5 reference size of the tap targets). A region, its chip or a list row opens the
 * muscle's panel (MAP-02); the mode, the view and the list choice live in the URL, so Back returns
 * to the same map with the opened muscle selected.
 */
export function BodyMapScreen({ search }: { search: BodyMapSearch }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const words = useBodyMapWords();
  const mode: VolumeMode = search.mode ?? 'week';
  const volume = useLiveInsight(`volume:${mode}`, (insights, deps) =>
    insights.observeWeeklyVolume(deps, { mode }),
  );
  const bands = useHeatBands();
  const muscles = useMapMuscles(volume.loaded ? volume.value : null, mode);
  const list = search.show === 'list';
  const alternativeId = useId();

  const setSearch = (patch: Parameters<typeof patchSearch<BodyMapSearch>>[1]) =>
    void navigate({ to: '/explore/body-map', search: patchSearch(search, patch), replace: true });

  const open = (muscleId: string) => {
    // Remember the muscle on the map's own history entry, then open its panel on a new one.
    void navigate({
      to: '/explore/body-map',
      search: { ...search, selected: muscleId },
      replace: true,
    }).then(() =>
      navigate({
        to: '/explore/body-map/$muscleId',
        params: { muscleId },
        search: panelSearch(search),
      }),
    );
  };

  return (
    <Screen title={t`Body map`}>
      <p className="text-fg-muted">
        <Trans>
          Tap a muscle to see its sets against your target and the best exercises you can do with
          your equipment.
        </Trans>
      </p>
      <Segmented
        label={t`Show the sets of`}
        value={mode}
        onChange={(next) => setSearch({ mode: next === 'week' ? undefined : next })}
        options={words.modes}
      />
      <WeekLine volume={volume} mode={mode} />
      <Button
        className="self-start"
        aria-describedby={alternativeId}
        onClick={() => setSearch({ show: list ? undefined : 'list' })}
      >
        {list ? (
          <>
            <PersonStanding aria-hidden="true" className="size-5" />
            <Trans>Show the figure</Trans>
          </>
        ) : (
          <>
            <List aria-hidden="true" className="size-5" />
            <Trans>Show as a list</Trans>
          </>
        )}
      </Button>
      <p id={alternativeId} className="sr-only">
        {list ? (
          <Trans>The figure shows the same muscles and sets as this list.</Trans>
        ) : (
          <Trans>
            The list shows the same muscles and sets as the figure, grouped front and back.
          </Trans>
        )}
      </p>
      {list ? (
        <BodyMapList
          muscles={muscles}
          bands={bands}
          selected={search.selected ?? null}
          onSelect={open}
          headingLevel={2}
        />
      ) : (
        <BodyMap
          muscles={muscles}
          bands={bands}
          selected={search.selected ?? null}
          onSelect={open}
          view={search.view ?? 'front'}
          onViewChange={(view) => setSearch({ view: view === 'back' ? 'back' : undefined })}
        />
      )}
      <HeatLegend title={words.legendTitle(mode)} bands={bands} />
      <p className="text-sm text-fg-muted">
        <Trans>
          Sets count fully for a muscle an exercise trains directly and half for one it helps
          (fractional sets). Your target comes from your plan; without one, 10 to 20 sets a week.
        </Trans>
      </p>
    </Screen>
  );
}

/**
 * The map's and the list's data: every display group with its name, heat step and sets in words
 * ("14 sets this week, 6 more planned"). Before the first answer the plain figure shows the names,
 * so the map never jumps; a stale value stays while the next mode loads.
 */
function useMapMuscles(
  view: WeeklyVolumeView | null,
  mode: VolumeMode,
): Record<string, BodyMapMuscle> {
  const { t } = useLingui();
  const labels = useLabels();
  const content = useCatalog();
  const volumeWords = useVolumeWords();
  const sets = useSetsText();
  if (!view) {
    return Object.fromEntries(
      content.muscles().groups.map((group) => [group.id, { name: labels.muscle(group.id) }]),
    );
  }
  const muscles = volumeWords.bodyMapMuscles(view.rows, view.mode);
  if (mode !== 'week') return muscles;
  const remaining = new Map(view.rows.map((row) => [row.muscle as string, row]));
  return Object.fromEntries(
    Object.entries(muscles).map(([id, entry]) => {
      const row = remaining.get(id);
      if (!row || row.remaining.fractional <= 0) return [id, entry];
      const done = sets(row.fractional);
      const more = sets(row.remaining.fractional);
      return [id, { ...entry, valueText: t`${done} this week, ${more} more planned` }];
    }),
  );
}

/** Which week the colours show, and that they are loading or updating (honest status). */
function WeekLine({ volume, mode }: { volume: Loadable<WeeklyVolumeView>; mode: VolumeMode }) {
  const { t } = useLingui();
  if (!volume.loaded) {
    return (
      <output className="block text-fg-muted" data-testid="body-map-status">
        {mode === 'week' ? (
          <Trans>Loading this week's sets…</Trans>
        ) : (
          <Trans>Loading your sets…</Trans>
        )}
      </output>
    );
  }
  const view = volume.value;
  const first = view.weeks[0] ?? view.weekStart;
  const start = formatLocalDate(first, 'short');
  const end = formatLocalDate(addLocalDays(view.weekStart, 6), 'short');
  const workouts = view.sessions?.counting ?? 0;
  const text =
    view.mode === 'avg4'
      ? t`Average of the 4 weeks from ${start} to ${end}`
      : view.mode === 'week'
        ? plural(workouts, {
            one: `Week of ${start}: # workout so far`,
            other: `Week of ${start}: # workouts so far`,
          })
        : plural(workouts, {
            one: `Week of ${start}: # workout`,
            other: `Week of ${start}: # workouts`,
          });
  return (
    <output className="block text-fg-muted" data-testid="body-map-status">
      {volume.stale ? t`Updating… ${text}` : text}
    </output>
  );
}
