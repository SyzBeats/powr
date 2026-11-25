import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  EQUIPMENT_CATEGORIES,
  type EquipmentDef,
  type EquipmentProfile,
  type PlatePairs,
} from '@powr/domain';

import { Button } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { Field } from '#ui/field';
import { Card } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useCatalog, usePlanning } from '../../hooks/use-planning';
import { formatMass } from '../../i18n/format';
import { useLabels } from '../labels';
import {
  hasItem,
  normalizePlates,
  parseNumber,
  parseWeights,
  selectedOfKind,
  toggleItem,
} from './inventory';

/**
 * The equipment inventory editor (EQP-01…03, EQP-07), laid out like the mock-up's "Equipment
 * Inventory": toggle rows per category, then the load details of what is selected (bar weights,
 * plate pairs, microplates, dumbbells, kettlebells, stack increments, bands, collars) and custom
 * items. Search finds items by name and synonym ("hex bar" finds the trap bar).
 */
export function EquipmentEditor({
  profile,
  onChange,
  showName = true,
}: {
  profile: EquipmentProfile;
  onChange: (profile: EquipmentProfile) => void;
  showName?: boolean;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const catalog = useCatalog().equipment().items;
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = (item: EquipmentDef) =>
    needle === '' ||
    item.name.en.toLowerCase().includes(needle) ||
    item.synonyms.some((synonym) => synonym.toLowerCase().includes(needle));

  return (
    <div className="flex flex-col gap-4">
      {showName ? (
        <Field
          label={t`Name`}
          value={profile.name}
          maxLength={120}
          onChange={(event) => onChange({ ...profile, name: event.target.value })}
          error={
            profile.name.trim() === ''
              ? t`Give this equipment a name, for example "Home gym".`
              : undefined
          }
        />
      ) : null}
      <Segmented
        label={t`Unit of your plates and dumbbells`}
        value={profile.unit}
        onChange={(unit) => onChange({ ...profile, unit })}
        options={[
          { value: 'kg', label: t`Kilograms (kg)` },
          { value: 'lb', label: t`Pounds (lb)` },
        ]}
      />
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-fg-muted"
        />
        <Field
          label={<span className="sr-only">{t`Search equipment`}</span>}
          type="search"
          placeholder={t`Search, for example hex bar`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="[&_input]:pl-10"
        />
      </div>
      <p className="text-sm text-fg-muted">
        <Plural value={profile.items.length} one="# item selected" other="# items selected" />
      </p>

      {EQUIPMENT_CATEGORIES.map((category) => {
        const items = catalog.filter((item) => item.category === category && matches(item));
        if (items.length === 0) return null;
        return (
          <Card key={category} className="gap-1">
            <h3 className="text-lg font-bold">{labels.category(category)}</h3>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <CheckRow
                    label={item.name.en}
                    checked={hasItem(profile, item.id)}
                    onChange={(on) => onChange(toggleItem(profile, item, on))}
                  />
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      <LoadDetails profile={profile} onChange={onChange} catalog={catalog} />
      <CustomItems profile={profile} onChange={onChange} />
    </div>
  );
}

function LoadDetails({
  profile,
  onChange,
  catalog,
}: {
  profile: EquipmentProfile;
  onChange: (profile: EquipmentProfile) => void;
  catalog: readonly EquipmentDef[];
}) {
  const { t } = useLingui();
  const unit = profile.unit;
  const bars = selectedOfKind(profile, catalog, 'bar');
  const stacks = selectedOfKind(profile, catalog, 'stack');
  const has = (kind: 'plates' | 'microplates' | 'dumbbells' | 'kettlebells' | 'bands') =>
    selectedOfKind(profile, catalog, kind).length > 0;

  return (
    <>
      {bars.length > 0 ? (
        <Card>
          <h3 className="text-lg font-bold">
            <Trans>Bar weights</Trans>
          </h3>
          {bars.map((bar) => {
            const entry = profile.bars.find((candidate) => candidate.item === bar.id);
            return (
              <Field
                key={bar.id}
                label={bar.name.en}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                suffix={unit}
                hint={
                  bar.loading?.kind === 'bar' && bar.loading.variesByModel
                    ? t`Models differ: check the weight on your bar.`
                    : undefined
                }
                value={entry?.weight.value ?? ''}
                onChange={(event) => {
                  const value = parseNumber(event.target.value);
                  if (value === null) return;
                  onChange({
                    ...profile,
                    bars: [
                      ...profile.bars.filter((candidate) => candidate.item !== bar.id),
                      { item: bar.id, weight: { value, unit } },
                    ],
                  });
                }}
              />
            );
          })}
          <Field
            label={t`Collar weight (each)`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            suffix={unit}
            hint={t`Usually 0. Competition collars weigh 2.5 kg each.`}
            value={profile.collarWeight}
            onChange={(event) => {
              const value = parseNumber(event.target.value);
              if (value !== null && value >= 0) onChange({ ...profile, collarWeight: value });
            }}
          />
        </Card>
      ) : null}

      {has('plates') ? (
        <PlateEditor
          title={t`Plate inventory`}
          plates={profile.plates}
          unit={unit}
          onChange={(plates) => onChange({ ...profile, plates })}
        />
      ) : null}
      {has('microplates') ? (
        <PlateEditor
          title={t`Microplates`}
          plates={profile.microplates}
          unit={unit}
          onChange={(microplates) => onChange({ ...profile, microplates })}
        />
      ) : null}

      {has('dumbbells') ? (
        <Card>
          <h3 className="text-lg font-bold">
            <Trans>Dumbbells</Trans>
          </h3>
          <WeightList
            label={t`Dumbbell weights`}
            hint={t`Separate the weights with commas, for example 2.5, 5, 7.5, 10.`}
            unit={unit}
            weights={dumbbellWeights(profile.dumbbells)}
            onChange={(weights) =>
              onChange({ ...profile, dumbbells: weights.length > 0 ? { weights } : null })
            }
          />
        </Card>
      ) : null}

      {has('kettlebells') ? (
        <Card>
          <h3 className="text-lg font-bold">
            <Trans>Kettlebells</Trans>
          </h3>
          <WeightList
            label={t`Kettlebell weights`}
            hint={t`Separate the weights with commas, for example 8, 12, 16.`}
            unit={unit}
            weights={profile.kettlebells}
            onChange={(kettlebells) => onChange({ ...profile, kettlebells })}
          />
        </Card>
      ) : null}

      {stacks.length > 0 ? (
        <Card>
          <h3 className="text-lg font-bold">
            <Trans>Machine and cable steps</Trans>
          </h3>
          {stacks.map((item) => {
            const entry = profile.stacks.find((stack) => stack.item === item.id);
            return (
              <Field
                key={item.id}
                label={item.name.en}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                suffix={entry?.increment.unit ?? unit}
                value={entry?.increment.value ?? ''}
                onChange={(event) => {
                  const value = parseNumber(event.target.value);
                  if (value === null || value <= 0) return;
                  onChange({
                    ...profile,
                    stacks: [
                      ...profile.stacks.filter((stack) => stack.item !== item.id),
                      { item: item.id, increment: { value, unit: entry?.increment.unit ?? unit } },
                    ],
                  });
                }}
              />
            );
          })}
        </Card>
      ) : null}

      {has('bands') ? <BandEditor profile={profile} onChange={onChange} /> : null}
    </>
  );
}

function dumbbellWeights(dumbbells: EquipmentProfile['dumbbells']): readonly number[] {
  if (!dumbbells) return [];
  if ('weights' in dumbbells) return dumbbells.weights;
  const weights: number[] = [];
  for (
    let weight = dumbbells.from;
    weight <= dumbbells.to + 1e-9 && weights.length < 200;
    weight += dumbbells.step
  )
    weights.push(Math.round(weight * 100) / 100);
  return weights;
}

/** Plate pairs per denomination with large ± buttons (the mock-up's "Plate Inventory"). */
function PlateEditor({
  title,
  plates,
  unit,
  onChange,
}: {
  title: string;
  plates: readonly PlatePairs[];
  unit: EquipmentProfile['unit'];
  onChange: (plates: PlatePairs[]) => void;
}) {
  const { t } = useLingui();
  const [denomination, setDenomination] = useState('');
  const setPairs = (weight: number, pairs: number) =>
    onChange(
      normalizePlates(
        plates.map((plate) =>
          plate.weight === weight ? { weight, pairs: Math.max(0, pairs) } : plate,
        ),
      ),
    );
  return (
    <Card>
      <h3 className="text-lg font-bold">{title}</h3>
      {plates.length === 0 ? (
        <p className="text-fg-muted">
          <Trans>No plates yet. Add the weights you have below.</Trans>
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {plates.map((plate) => {
          const weight = formatMass(plate.weight, unit);
          return (
            <li key={plate.weight} className="flex flex-wrap items-center gap-2">
              <span className="min-w-24 flex-1 font-semibold tabular">
                <Trans>
                  {weight} × {plate.pairs} pairs
                </Trans>
              </span>
              <Button
                size="icon"
                aria-label={t`One pair fewer of ${weight}`}
                onClick={() => setPairs(plate.weight, plate.pairs - 1)}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                aria-label={t`One pair more of ${weight}`}
                onClick={() => setPairs(plate.weight, plate.pairs + 1)}
              >
                <Plus aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = parseNumber(denomination);
          if (value === null || value <= 0) return;
          onChange(normalizePlates([...plates, { weight: value, pairs: 1 }]));
          setDenomination('');
        }}
      >
        <Field
          className="min-w-32 flex-1"
          label={t`Add a plate weight`}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          suffix={unit}
          value={denomination}
          onChange={(event) => setDenomination(event.target.value)}
        />
        <Button type="submit">
          <Plus aria-hidden="true" />
          <Trans>Add</Trans>
        </Button>
      </form>
    </Card>
  );
}

function WeightList({
  label,
  hint,
  unit,
  weights,
  onChange,
}: {
  label: string;
  hint: string;
  unit: EquipmentProfile['unit'];
  weights: readonly number[];
  onChange: (weights: number[]) => void;
}) {
  const [text, setText] = useState(weights.join(', '));
  return (
    <Field
      label={label}
      hint={hint}
      inputMode="decimal"
      suffix={unit}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const parsed = parseWeights(text);
        onChange(parsed);
        setText(parsed.join(', '));
      }}
    />
  );
}

function BandEditor({
  profile,
  onChange,
}: {
  profile: EquipmentProfile;
  onChange: (profile: EquipmentProfile) => void;
}) {
  const { t } = useLingui();
  const [label, setLabel] = useState('');
  return (
    <Card>
      <h3 className="text-lg font-bold">
        <Trans>Bands</Trans>
      </h3>
      <p className="text-sm text-fg-muted">
        <Trans>
          Bands assist or add resistance; they never count towards your strength estimates.
        </Trans>
      </p>
      <ul className="flex flex-col gap-1">
        {profile.bands.map((band) => (
          <li key={band.label} className="flex items-center justify-between gap-2">
            <span>{band.label}</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t`Remove band ${band.label}`}
              onClick={() =>
                onChange({ ...profile, bands: profile.bands.filter((other) => other !== band) })
              }
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const name = label.trim();
          if (name === '' || profile.bands.some((band) => band.label === name)) return;
          onChange({ ...profile, bands: [...profile.bands, { label: name }] });
          setLabel('');
        }}
      >
        <Field
          className="min-w-32 flex-1"
          label={t`Band label`}
          placeholder={t`For example red, light`}
          value={label}
          maxLength={60}
          onChange={(event) => setLabel(event.target.value)}
        />
        <Button type="submit">
          <Plus aria-hidden="true" />
          <Trans>Add</Trans>
        </Button>
      </form>
    </Card>
  );
}

/** EQP-07: items the catalog lacks, by name. */
function CustomItems({
  profile,
  onChange,
}: {
  profile: EquipmentProfile;
  onChange: (profile: EquipmentProfile) => void;
}) {
  const { t } = useLingui();
  const run = usePlanning();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <h3 className="text-lg font-bold">
        <Trans>Your own items</Trans>
      </h3>
      <p className="text-sm text-fg-muted">
        <Trans>
          Anything not in the list, for example a specific machine. Custom exercises can use it
          later.
        </Trans>
      </p>
      <ul className="flex flex-col gap-1">
        {profile.customItems.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span>{item.name}</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t`Remove ${item.name}`}
              onClick={() =>
                onChange({
                  ...profile,
                  customItems: profile.customItems.filter((other) => other.id !== item.id),
                })
              }
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() === '') {
            setError(t`Type a name for the item first.`);
            return;
          }
          setError(null);
          void run((planning, deps) => planning.newCustomEquipmentItem(deps, name)).then((item) => {
            onChange({ ...profile, customItems: [...profile.customItems, item] });
            setName('');
          });
        }}
      >
        <Field
          className="min-w-32 flex-1"
          label={t`Item name`}
          value={name}
          maxLength={120}
          error={error ?? undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit">
          <Plus aria-hidden="true" />
          <Trans>Add item</Trans>
        </Button>
      </form>
    </Card>
  );
}
