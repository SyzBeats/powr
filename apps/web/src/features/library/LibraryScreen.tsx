import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronRight, SlidersHorizontal, Star, X } from 'lucide-react';
import { useId, useState } from 'react';

import {
  EQUIPMENT_CATEGORIES,
  MOVEMENT_PATTERNS,
  type MovementPattern,
  type MuscleId,
} from '@powr/domain';
import type { LibraryItem, LibraryQuery } from '@powr/domain/library';

import { Badge } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { Field } from '#ui/field';
import { Card, Screen } from '#ui/screen';
import { Sheet } from '#ui/sheet';

import { useLibraryQuery } from '../../hooks/use-library';
import { useCatalog } from '../../hooks/use-planning';
import { useLabels } from '../labels';
import type { LibrarySearch } from './search';
import { useLibraryWords } from './words';

type Flag = 'available' | 'favourites' | 'custom' | 'hidden';

/** The domain query of the route's search params (EXL-02: AND across filters). */
function queryOf(search: LibrarySearch, text: string): LibraryQuery {
  return {
    ...(text.trim() ? { text: text.trim() } : {}),
    ...(search.muscle ? { muscles: [search.muscle as MuscleId] } : {}),
    ...(search.equipment ? { equipment: [search.equipment] } : {}),
    ...(search.pattern ? { patterns: [search.pattern as MovementPattern] } : {}),
    ...(search.mechanics ? { mechanics: [search.mechanics] } : {}),
    ...(search.available ? { availableOnly: true } : {}),
    ...(search.favourites ? { favouritesOnly: true } : {}),
    ...(search.custom ? { customOnly: true } : {}),
    ...(search.hidden ? { includeHidden: true } : {}),
  };
}

/**
 * EXL-02: search by name and synonyms, filters by muscle, equipment, movement pattern and
 * mechanics, "available with my equipment", favourites, custom and hidden exercises. Filters
 * combine with AND; every active filter is a chip that clears it in one tap, "Clear all" clears
 * them all. The query and filters live in the URL, so Back from an exercise returns to the list.
 */
export function LibraryScreen() {
  const { t } = useLingui();
  const search = useSearch({ from: '/explore/exercises/' });
  const navigate = useNavigate({ from: '/explore/exercises/' });
  // The typed text is local state (the field never lags behind the URL while typing).
  const [text, setText] = useState(search.q ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = queryOf(search, text);
  const results = useLibraryQuery(JSON.stringify(query), (library, deps) =>
    library.searchExercises(deps, query),
  );

  const update = (patch: Partial<Record<keyof LibrarySearch, string | true | undefined>>) =>
    void navigate({
      search: (previous) => ({ ...previous, ...patch }) as LibrarySearch,
      replace: true,
    });

  const onText = (value: string) => {
    setText(value);
    update({ q: value.trim() ? value : undefined });
  };

  return (
    <Screen title={t`Exercise library`}>
      <search className="flex flex-col gap-3">
        <Field
          label={t`Search exercises`}
          type="search"
          value={text}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => onText(event.target.value)}
        />
        <Button size="lg" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
          <SlidersHorizontal aria-hidden="true" className="size-5" />
          <Trans>Filters</Trans>
        </Button>
      </search>
      <ActiveFilters search={search} onChange={update} />
      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        search={search}
        onChange={update}
        count={results.loaded ? results.value.length : null}
      />
      {results.loaded ? (
        <Results items={results.value} />
      ) : (
        <output className="block text-fg-muted">
          <Trans>Loading the library…</Trans>
        </output>
      )}
      <Link to="/explore/exercises/new" className={buttonClass({ size: 'lg' })}>
        <Trans>Create a custom exercise</Trans>
      </Link>
    </Screen>
  );
}

/** The words of each active filter, for its chip. */
function useFilterLabels() {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useLibraryWords();
  return (search: LibrarySearch) => {
    const chips: { readonly key: keyof LibrarySearch; readonly label: string }[] = [];
    if (search.muscle) chips.push({ key: 'muscle', label: labels.muscle(search.muscle) });
    if (search.equipment)
      chips.push({ key: 'equipment', label: labels.equipment(search.equipment) });
    if (search.pattern)
      chips.push({ key: 'pattern', label: labels.pattern(search.pattern as MovementPattern) });
    if (search.mechanics)
      chips.push({ key: 'mechanics', label: words.mechanics(search.mechanics) });
    if (search.available) chips.push({ key: 'available', label: t`Available with my equipment` });
    if (search.favourites) chips.push({ key: 'favourites', label: t`Favourites` });
    if (search.custom) chips.push({ key: 'custom', label: t`Custom exercises` });
    if (search.hidden) chips.push({ key: 'hidden', label: t`Including hidden ones` });
    return chips;
  };
}

function ActiveFilters({
  search,
  onChange,
}: {
  search: LibrarySearch;
  onChange: (patch: Partial<Record<keyof LibrarySearch, undefined>>) => void;
}) {
  const { t } = useLingui();
  const headingId = useId();
  const chips = useFilterLabels()(search);
  if (chips.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-sm font-semibold">
        <Trans>Active filters</Trans>
      </h2>
      <ul className="flex flex-wrap gap-2" data-testid="active-filters">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              aria-label={t`Remove filter: ${chip.label}`}
              onClick={() => onChange({ [chip.key]: undefined })}
              className="inline-flex min-h-target items-center gap-1.5 rounded-full border-2 border-primary bg-surface px-3 font-medium"
            >
              {chip.label}
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
        {chips.length > 1 ? (
          <li>
            <button
              type="button"
              onClick={() =>
                onChange(Object.fromEntries(chips.map((chip) => [chip.key, undefined])))
              }
              className="inline-flex min-h-target items-center rounded-full border border-control px-3 font-medium"
            >
              <Trans>Clear all</Trans>
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** One `<select>` with its visible label; the empty option means "any". */
function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string | undefined) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="min-h-target w-full min-w-0 rounded-xl border border-control bg-surface px-3"
      >
        {children}
      </select>
    </div>
  );
}

function FilterSheet({
  open,
  onOpenChange,
  search,
  onChange,
  count,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: LibrarySearch;
  onChange: (patch: Partial<Record<keyof LibrarySearch, string | true | undefined>>) => void;
  count: number | null;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useLibraryWords();
  const catalog = useCatalog();
  const groups = catalog.muscles().groups;
  const items = catalog.equipment().items;
  const flag = (key: Flag, label: string, description?: string) => (
    <CheckRow
      label={label}
      {...(description ? { description } : {})}
      checked={search[key] === true}
      onChange={(checked) => onChange({ [key]: checked ? true : undefined })}
    />
  );
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t`Filters`}
      description={t`Exercises must match every filter you choose.`}
      closeLabel={t`Close filters`}
    >
      <SelectField
        label={t`Muscle`}
        value={search.muscle ?? ''}
        onChange={(value) => onChange({ muscle: value })}
      >
        <option value="">{t`Any muscle`}</option>
        {groups.map((group) => (
          <optgroup key={group.id} label={group.name.en}>
            <option value={group.id}>{group.name.en}</option>
            {group.subRegions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name.en}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectField>
      <SelectField
        label={t`Equipment`}
        value={search.equipment ?? ''}
        onChange={(value) => onChange({ equipment: value })}
      >
        <option value="">{t`Any equipment`}</option>
        {EQUIPMENT_CATEGORIES.map((category) => {
          const inCategory = items.filter((item) => item.category === category);
          return inCategory.length === 0 ? null : (
            <optgroup key={category} label={labels.category(category)}>
              {inCategory.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name.en}
                </option>
              ))}
            </optgroup>
          );
        })}
      </SelectField>
      <SelectField
        label={t`Movement`}
        value={search.pattern ?? ''}
        onChange={(value) => onChange({ pattern: value })}
      >
        <option value="">{t`Any movement`}</option>
        {MOVEMENT_PATTERNS.map((pattern) => (
          <option key={pattern} value={pattern}>
            {labels.pattern(pattern)}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t`Mechanics`}
        value={search.mechanics ?? ''}
        onChange={(value) => onChange({ mechanics: value })}
      >
        <option value="">{t`Compound or isolation`}</option>
        <option value="compound">{words.mechanics('compound')}</option>
        <option value="isolation">{words.mechanics('isolation')}</option>
      </SelectField>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">
          <Trans>Show</Trans>
        </legend>
        {flag(
          'available',
          t`Available with my equipment`,
          t`Only exercises your equipment list allows.`,
        )}
        {flag('favourites', t`Favourites only`)}
        {flag('custom', t`Custom exercises only`)}
        {flag('hidden', t`Include hidden exercises`)}
      </fieldset>
      <Button variant="primary" size="lg" onClick={() => onOpenChange(false)}>
        {count === null
          ? t`Show the exercises`
          : plural(count, { one: 'Show # exercise', other: 'Show # exercises' })}
      </Button>
    </Sheet>
  );
}

function Results({ items }: { items: readonly LibraryItem[] }) {
  const { t } = useLingui();
  return (
    <section aria-label={t`Results`} className="flex flex-col gap-2">
      <output className="block font-semibold" data-testid="library-count">
        {items.length === 0
          ? t`No exercises match. Try fewer filters or another word.`
          : plural(items.length, { one: '# exercise', other: '# exercises' })}
      </output>
      {items.length > 0 ? (
        <Card className="gap-0 p-2">
          <ul className="flex flex-col divide-y divide-border" data-testid="library-results">
            {items.map((item) => (
              <li key={item.exerciseId}>
                <ResultRow item={item} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}

function ResultRow({ item }: { item: LibraryItem }) {
  const labels = useLabels();
  const muscles = [...item.primary, ...item.secondary].map((id) => labels.muscle(id));
  return (
    <Link
      to="/explore/exercises/$exerciseId"
      params={{ exerciseId: item.exerciseId }}
      className="flex min-h-target-lg items-center justify-between gap-3 rounded-xl px-2 py-2"
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold">{labels.exercise(item.exerciseId)}</span>
        {muscles.length > 0 ? (
          <span className="text-sm text-fg-muted">{muscles.join(' · ')}</span>
        ) : null}
        <ItemBadges item={item} />
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
    </Link>
  );
}

function ItemBadges({ item }: { item: LibraryItem }) {
  if (!item.favourite && !item.custom && !item.hidden && !item.avoided && item.available) {
    return null;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {item.favourite ? (
        <Badge tone="info" icon={Star}>
          <Trans>Favourite</Trans>
        </Badge>
      ) : null}
      {item.custom ? (
        <Badge>
          <Trans>Custom</Trans>
        </Badge>
      ) : null}
      {item.hidden ? (
        <Badge>
          <Trans>Hidden</Trans>
        </Badge>
      ) : null}
      {item.avoided ? (
        <Badge tone="warning">
          <Trans>Avoided</Trans>
        </Badge>
      ) : null}
      {item.available ? null : (
        <Badge tone="warning">
          <Trans>Needs other equipment</Trans>
        </Badge>
      )}
    </span>
  );
}
