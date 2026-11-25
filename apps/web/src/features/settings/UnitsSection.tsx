import { Trans, useLingui } from '@lingui/react/macro';

import type { LengthUnit, MassUnit, Profile } from '@powr/domain';

import { Segmented } from '#ui/segmented';

import { useProfile } from '../../hooks/use-planning';
import { useSettingsUseCases } from '../../hooks/use-settings';
import { SettingsSection } from './parts';

/**
 * SET-02 (M5s): weights, body weight and lengths in kg/lb and cm/in. Display only: stored values
 * keep their unit and convert when shown, so switching never drifts (NFR-REL-07); each plate set
 * keeps its own unit in Equipment.
 */
export function UnitsSection() {
  const { t } = useLingui();
  const profile = useProfile();
  const run = useSettingsUseCases();
  if (!profile.loaded || !profile.value) return null;
  const units = profile.value.units;
  const save = (next: Profile['units']) =>
    void run((settings, deps) => settings.setUnits(deps, next));
  const mass = [
    { value: 'kg' as const, label: t`Kilograms (kg)` },
    { value: 'lb' as const, label: t`Pounds (lb)` },
  ];
  return (
    <SettingsSection id="units" title={t`Units`}>
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="px-2 font-medium">
          <Trans>Weights you lift</Trans>
        </span>
        <Segmented<MassUnit>
          label={t`Weights you lift`}
          value={units.load}
          onChange={(load) => save({ ...units, load })}
          options={mass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="px-2 font-medium">
          <Trans>Bodyweight</Trans>
        </span>
        <Segmented<MassUnit>
          label={t`Bodyweight`}
          value={units.bodyweight}
          onChange={(bodyweight) => save({ ...units, bodyweight })}
          options={mass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="px-2 font-medium">
          <Trans>Lengths</Trans>
        </span>
        <Segmented<LengthUnit>
          label={t`Lengths`}
          value={units.length}
          onChange={(length) => save({ ...units, length })}
          options={[
            { value: 'cm', label: t`Centimetres (cm)` },
            { value: 'in', label: t`Inches (in)` },
          ]}
        />
      </div>
      <p className="text-sm text-fg-muted">
        <Trans>
          Changing a unit only changes how values are shown; nothing you logged is rounded or lost.
          Plate sets keep their own unit under Equipment.
        </Trans>
      </p>
    </SettingsSection>
  );
}
