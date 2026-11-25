import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { WeeklyVolumeView } from '@powr/application/insights';
import type { MuscleId } from '@powr/domain';
import type { HeatLabel, MuscleWeekRow, SubRegionRow } from '@powr/domain/analytics';

import { Badge, type Tone } from '#ui/badge';
import { buttonClass } from '#ui/button';
import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useLiveInsight } from '../../hooks/use-insights';
import type { Loadable } from '../../hooks/use-load';
import { useCatalog } from '../../hooks/use-planning';
import { formatNumber } from '../../i18n/format';
import { useSetsText, useVolumeWords } from '../insights/words';
import { useLabels } from '../labels';
import { WhyButton } from '../why/WhySheet';
import { RankedExercises } from './RankedExercises';
import { panelSearch, patchSearch, type MuscleSearch, type VolumeMode } from './search';
import { useBodyMapWords } from './words';

const HEAT_TONE: Readonly<Record<HeatLabel, Tone>> = {
  none: 'neutral',
  belowFloor: 'info',
  belowTarget: 'info',
  inTarget: 'ok',
  high: 'warning',
  veryHigh: 'warning',
};

/**
 * The muscle panel (MAP-02…05, MAP-07; §8.11): what tapping a region on the body map opens. A
 * screen of its own (own `h1`, Back returns to the map, deep-linkable), because it holds the
 * week's sets against the target with "Why?", the exercises that contributed, the sub-regions,
 * and the ranked exercise list with its actions, too much for a bottom sheet over the figure.
 * Works for a display group (`mu.triceps`) and for a sub-region (`mu.triceps-long`, MAP-07).
 */
export function MuscleScreen({ muscleId, search }: { muscleId: string; search: MuscleSearch }) {
  const { t } = useLingui();
  const labels = useLabels();
  const navigate = useNavigate();
  const words = useBodyMapWords();
  const groups = useCatalog().muscles().groups;
  const group =
    groups.find((entry) => entry.id === muscleId) ??
    groups.find((entry) => entry.subRegions.some((sub) => sub.id === muscleId));
  const mode: VolumeMode = search.mode ?? 'week';
  const volume = useLiveInsight(`volume:${mode}`, (insights, deps) =>
    insights.observeWeeklyVolume(deps, { mode }),
  );

  if (!group) {
    return (
      <Screen title={t`Muscle not found`}>
        <p>
          <Trans>This muscle is not on the body map.</Trans>
        </p>
        <Link to="/explore/body-map" className={buttonClass({ size: 'lg' })}>
          <Trans>Back to the body map</Trans>
        </Link>
      </Screen>
    );
  }
  const name = labels.muscle(muscleId);
  const isSubRegion = group.id !== muscleId;
  const row = volume.loaded
    ? (volume.value.rows.find((entry) => entry.muscle === group.id) ?? null)
    : null;
  const sub = isSubRegion
    ? (row?.subRegions.find((entry) => entry.muscle === muscleId) ?? null)
    : null;

  return (
    <Screen title={name}>
      <Link
        to="/explore/body-map"
        search={{ ...panelSearch(search), selected: group.id }}
        className="flex min-h-target items-center gap-1 self-start font-semibold text-info underline-offset-4 hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
        <Trans>Back to the body map</Trans>
      </Link>
      {isSubRegion ? (
        <p className="text-fg-muted">
          <Trans>
            A part of{' '}
            <Link
              to="/explore/body-map/$muscleId"
              params={{ muscleId: group.id }}
              search={panelSearch(search)}
              className="font-semibold text-info underline underline-offset-4"
            >
              {labels.muscle(group.id)}
            </Link>
            . Volume targets apply to the whole muscle.
          </Trans>
        </p>
      ) : null}
      <Segmented
        label={t`Show the sets of`}
        value={mode}
        onChange={(next) =>
          void navigate({
            to: '/explore/body-map/$muscleId',
            params: { muscleId },
            search: patchSearch(search, { mode: next === 'week' ? undefined : next }),
            replace: true,
          })
        }
        options={words.modes}
      />
      <VolumeCard volume={volume} row={row} sub={sub} name={name} mode={mode} />
      {row ? <Contributors contributors={(sub ?? row).contributors} mode={mode} /> : null}
      {!isSubRegion && group.subRegions.length > 0 ? (
        <SubRegions
          subRegions={group.subRegions.map((entry) => entry.id)}
          rows={row?.subRegions ?? []}
          search={panelSearch(search)}
        />
      ) : null}
      <RankedExercises
        muscle={muscleId as MuscleId}
        name={name}
        sort={search.sort ?? 'effectiveness'}
        includeUnavailable={search.unavailable === true}
        onSortChange={(sort) =>
          void navigate({
            to: '/explore/body-map/$muscleId',
            params: { muscleId },
            search: patchSearch(search, { sort: sort === 'focus' ? 'focus' : undefined }),
            replace: true,
          })
        }
        onIncludeUnavailableChange={(include) =>
          void navigate({
            to: '/explore/body-map/$muscleId',
            params: { muscleId },
            search: patchSearch(search, { unavailable: include ? true : undefined }),
            replace: true,
          })
        }
      />
    </Screen>
  );
}

/** MAP-04 tap: fractional and direct sets, the target band with its "Why?", the planned rest. */
function VolumeCard({
  volume,
  row,
  sub,
  name,
  mode,
}: {
  volume: Loadable<WeeklyVolumeView>;
  row: MuscleWeekRow | null;
  sub: SubRegionRow | null;
  name: string;
  mode: VolumeMode;
}) {
  const { t } = useLingui();
  const words = useBodyMapWords();
  const volumeWords = useVolumeWords();
  const sets = useSetsText();
  const title = words.modes.find((entry) => entry.value === mode)?.label ?? '';
  if (!volume.loaded || !row) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">{title}</h2>
        <output className="block text-fg-muted">
          <Trans>Loading the sets…</Trans>
        </output>
      </Card>
    );
  }
  const shown = sub ?? row;
  const average = mode === 'avg4';
  return (
    <Card>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="flex flex-col" data-testid="muscle-sets">
        <span className="text-fg-muted">
          {average ? (
            <Trans>Fractional hard sets a week</Trans>
          ) : (
            <Trans>Fractional hard sets</Trans>
          )}
        </span>
        <span className="text-3xl font-bold tabular">{sets(shown.fractional)}</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-fg-muted">
          <Trans>Direct sets</Trans>
        </dt>
        <dd className="font-semibold tabular">{sets(shown.direct)}</dd>
        {sub ? null : (
          <>
            <dt className="text-fg-muted">
              <Trans>Target</Trans>
            </dt>
            <dd className="font-semibold">
              {row.targeted ? (
                <Trans>{volumeWords.band(row)} a week (your plan)</Trans>
              ) : (
                <Trans>{volumeWords.band(row)} a week (the evidence default; no plan target)</Trans>
              )}
            </dd>
          </>
        )}
        {mode === 'week' && !sub && row.remaining.fractional > 0 ? (
          <>
            <dt className="text-fg-muted">
              <Trans>Still planned</Trans>
            </dt>
            <dd className="font-semibold">
              <Trans>{sets(row.remaining.fractional)} in your open sessions this week</Trans>
            </dd>
          </>
        ) : null}
      </dl>
      {sub ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={HEAT_TONE[row.heatLabel]}>{volumeWords.heatLabel(row.heatLabel)}</Badge>
          <WhyButton why={row.why} subject={t`the target for ${name}`} />
        </div>
      )}
    </Card>
  );
}

/** MAP-04 "the contributing exercises": what each exercise added to the muscle's sets. */
function Contributors({
  contributors,
  mode,
}: {
  contributors: MuscleWeekRow['contributors'];
  mode: VolumeMode;
}) {
  const labels = useLabels();
  const sets = useSetsText();
  const list = contributors.filter((entry) => entry.fractional > 0);
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Contributing exercises</Trans>
      </h2>
      {list.length === 0 ? (
        <p className="text-fg-muted">
          {mode === 'week' ? (
            <Trans>No hard sets for this muscle yet this week.</Trans>
          ) : (
            <Trans>No hard sets for this muscle in this period.</Trans>
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="contributors">
          {list.map((entry) => {
            const credited = sets(entry.sets);
            const credit = formatNumber(entry.credit, 2);
            const added = sets(entry.fractional);
            return (
              <li key={entry.exerciseId} className="flex flex-col">
                <span className="font-semibold">{labels.exercise(entry.exerciseId)}</span>
                <span className="text-sm text-fg-muted">
                  <Trans>
                    {credited} × credit {credit} = {added}
                  </Trans>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** MAP-07: the muscle's sub-regions with their own sets; each opens its own panel. */
function SubRegions({
  subRegions,
  rows,
  search,
}: {
  subRegions: readonly MuscleId[];
  rows: readonly SubRegionRow[];
  search: MuscleSearch;
}) {
  const labels = useLabels();
  const sets = useSetsText();
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Sub-regions</Trans>
      </h2>
      <p className="text-sm text-fg-muted">
        <Trans>Open a part of the muscle for its own sets and best exercises.</Trans>
      </p>
      <ul className="flex flex-col gap-2">
        {subRegions.map((id) => {
          const entry = rows.find((candidate) => candidate.muscle === id);
          return (
            <li key={id}>
              <Link
                to="/explore/body-map/$muscleId"
                params={{ muscleId: id }}
                search={search}
                className="flex min-h-target items-center gap-3 rounded-xl border border-control bg-surface px-3 py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{labels.muscle(id)}</span>
                  <span className="text-sm text-fg-muted">{sets(entry?.fractional ?? 0)}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
