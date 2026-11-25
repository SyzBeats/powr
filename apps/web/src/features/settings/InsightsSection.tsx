import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import type { InsightPreferencesPatch } from '@powr/application/insights';
import { DEFAULT_MEASUREMENT_SITES, MEASUREMENT_SITES, type MeasurementSite } from '@powr/domain';

import { CheckRow } from '#ui/choice';
import { Card } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useInsights } from '../../hooks/use-insights';
import { useSettingsRecord } from '../../hooks/use-settings';
import { useBodyWords } from '../body/words';

type Target = 'none' | '1' | '2' | '3' | '4' | '5' | '6' | '7';

/**
 * Settings → Insights (M4b): the streak's grace (MOT-03, A-07, off by default) and the weekly
 * session goal without a plan, the measurement sites to track (BOD-03) and how powerlifting
 * points are worked out (ANL-07). Read from the settings record; written through the lazy
 * insights entry's `updateInsightPreferences` (the streak is recomputed on a change).
 */
export function InsightsSection() {
  const { t } = useLingui();
  const settings = useSettingsRecord();
  const run = useInsights();
  const words = useBodyWords();
  const [saving, setSaving] = useState(false);
  if (!settings.loaded) return null;
  const stored = settings.value?.insights;
  const grace = stored?.streakGrace ?? false;
  const target = stored?.weeklySessionTarget ?? null;
  const sites: readonly MeasurementSite[] = stored?.measurementSites ?? DEFAULT_MEASUREMENT_SITES;
  const scoreSource = stored?.scoreSource ?? 'e1rm';
  const division = stored?.division ?? 'classic';

  const save = async (patch: InsightPreferencesPatch) => {
    setSaving(true);
    try {
      await run((insights, deps) => insights.updateInsightPreferences(deps, patch));
    } finally {
      setSaving(false);
    }
  };

  const toggleSite = (site: MeasurementSite, on: boolean) =>
    void save({
      measurementSites: on
        ? MEASUREMENT_SITES.filter((entry) => entry === site || sites.includes(entry))
        : sites.filter((entry) => entry !== site),
    });

  return (
    <Card>
      <section
        id="insights"
        aria-labelledby="settings-insights"
        aria-busy={saving}
        className="flex scroll-mt-16 flex-col gap-3"
      >
        <h2 id="settings-insights" className="text-lg font-semibold">
          <Trans>Insights</Trans>
        </h2>

        <h3 className="font-semibold">
          <Trans>Weekly streak</Trans>
        </h3>
        <CheckRow
          label={t`Grace: a week with one workout short still counts`}
          description={t`A week without any workout never counts. Off by default.`}
          checked={grace}
          onChange={(streakGrace) => void save({ streakGrace })}
        />
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="px-2 font-medium">
            <Trans>Weekly workout goal without a plan</Trans>
          </span>
          <Segmented<Target>
            label={t`Weekly workout goal without a plan`}
            value={target === null ? 'none' : (String(Math.min(7, target)) as Target)}
            onChange={(next) =>
              void save({ weeklySessionTarget: next === 'none' ? null : Number(next) })
            }
            options={[
              { value: 'none', label: t`Not set` },
              ...(['1', '2', '3', '4', '5', '6', '7'] as const).map((value) => ({
                value,
                label: value,
              })),
            ]}
          />
          <p className="px-2 text-sm text-fg-muted">
            <Trans>
              Used for weeks without planned workouts. Not set: one workout keeps such a week.
            </Trans>
          </p>
        </div>

        <h3 className="font-semibold">
          <Trans>Measurements to track</Trans>
        </h3>
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">
            <Trans>Measurements to track</Trans>
          </legend>
          {MEASUREMENT_SITES.map((site) => (
            <CheckRow
              key={site}
              label={words.site(site)}
              checked={sites.includes(site)}
              onChange={(on) => toggleSite(site, on)}
            />
          ))}
        </fieldset>

        <h3 className="font-semibold">
          <Trans>Powerlifting points</Trans>
        </h3>
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="px-2 font-medium">
            <Trans>Work out points from</Trans>
          </span>
          <Segmented<'e1rm' | 'tested'>
            label={t`Work out points from`}
            value={scoreSource}
            onChange={(next) => void save({ scoreSource: next })}
            options={[
              { value: 'e1rm', label: t`Current estimates` },
              { value: 'tested', label: t`Heaviest lifted` },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="px-2 font-medium">
            <Trans>Division</Trans>
          </span>
          <Segmented<'classic' | 'equipped'>
            label={t`Division`}
            value={division}
            onChange={(next) => void save({ division: next })}
            options={[
              { value: 'classic', label: t`Classic (raw)` },
              { value: 'equipped', label: t`Equipped` },
            ]}
          />
        </div>
      </section>
    </Card>
  );
}
