import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, SlidersHorizontal, Star, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

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
import { validateLibrarySearch, type LibrarySearch } from './search';
import { useLibraryWords } from './words';

type Flag = 'available' | 'favourites' | 'custom' | 'hidden';
/** The multi-value filters (TD-56), in the order the sheet and the chips show them. */
const LISTS = ['muscle', 'equipment', 'pattern', 'mechanics'] as const;
type List = (typeof LISTS)[number];
const FLAGS: readonly Flag[] = ['available', 'favourites', 'custom', 'hidden'];

/** A change of the route's search params; `undefined` removes a filter. */
type Patch = { -readonly [K in keyof LibrarySearch]?: LibrarySearch[K] | undefined };

/**
 * The domain query of the route's search params (EXL-02, TD-56): any of the values within a
 * dimension, every dimension in use (AND across).
 */
function queryOf(search: LibrarySearch, text: string): LibraryQuery {
  return {
    ...(text.trim() ? { text: text.trim() } : {}),
    ...(search.muscle ? { muscles: search.muscle as readonly MuscleId[] } : {}),
    ...(search.equipment ? { equipment: search.equipment } : {}),
    ...(search.pattern ? { patterns: search.pattern as readonly MovementPattern[] } : {}),
    ...(search.mechanics ? { mechanics: search.mechanics } : {}),
    ...(search.available ? { availableOnly: true } : {}),
    ...(search.favourites ? { favouritesOnly: true } : {}),
    ...(search.custom ? { customOnly: true } : {}),
    ...(search.hidden ? { includeHidden: true } : {}),
  };
}

/** The list with `value` added or removed; an empty list removes the filter. */
function toggled(list: readonly string[] | undefined, value: string, on: boolean) {
  const rest = (list ?? []).filter((entry) => entry !== value);
  const next = on ? [...rest, value] : rest;
  return next.length > 0 ? next : undefined;
}

/**
 * EXL-02: search by name and synonyms, filters by muscle, equipment, movement pattern and
 * mechanics (several values each, TD-56), "available with my equipment", favourites, custom and
 * hidden exercises. Values within a dimension combine with OR, dimensions with AND; every active
 * value is a chip that clears it in one tap, "Clear all" clears them all. The query and filters
 * live in the URL, so Back from an exercise returns to the list.
 */
export function LibraryScreen() {
  const { t } = useLingui();
  // TD-63: the route passes the params through; they are validated here, in the lazy chunk.
  const search = validateLibrarySearch(useSearch({ from: '/explore/exercises/' }));
  const navigate = useNavigate({ from: '/explore/exercises/' });
  // The typed text is local state (the field never lags behind the URL while typing).
  const [text, setText] = useState(search.q ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = queryOf(search, text);
  const results = useLibraryQuery(JSON.stringify(query), (library, deps) =>
    library.searchExercises(deps, query),
  );

  // From the latest search params, so quick taps on several checkboxes all count.
  const update = (patch: (previous: LibrarySearch) => Patch) =>
    void navigate({
      search: (raw) => {
        const previous = validateLibrarySearch(raw);
        return { ...previous, ...patch(previous) } as LibrarySearch;
      },
      replace: true,
    });
  const toggle = (list: List, value: string, on: boolean) =>
    update((previous) => ({ [list]: toggled(previous[list], value, on) }));

  const onText = (value: string) => {
    setText(value);
    update(() => ({ q: value.trim() ? value : undefined }));
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
      <ActiveFilters
        search={search}
        onRemove={(chip) =>
          update((previous) =>
            chip.value === undefined
              ? { [chip.key]: undefined }
              : { [chip.key]: toggled(previous[chip.key as List], chip.value, false) },
          )
        }
        onClearAll={() =>
          update(() => Object.fromEntries([...LISTS, ...FLAGS].map((key) => [key, undefined])))
        }
      />
      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        search={search}
        onToggle={toggle}
        onFlag={(key, on) => update(() => ({ [key]: on ? true : undefined }))}
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

/** One active filter value (a list value) or switch (a flag, without `value`). */
interface Chip {
  readonly key: List | Flag;
  readonly value?: string;
  readonly label: string;
}

/** The words of every active filter value, for its chip. */
function useFilterChips() {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useLibraryWords();
  const flagLabels: Record<Flag, string> = {
    available: t`Available with my equipment`,
    favourites: t`Favourites`,
    custom: t`Custom exercises`,
    hidden: t`Including hidden ones`,
  };
  const labelOf: Record<List, (value: string) => string> = {
    muscle: (value) => labels.muscle(value),
    equipment: (value) => labels.equipment(value),
    pattern: (value) => labels.pattern(value as MovementPattern),
    mechanics: (value) => words.mechanics(value as 'compound' | 'isolation'),
  };
  return (search: LibrarySearch): Chip[] => [
    ...LISTS.flatMap((key) =>
      (search[key] ?? []).map((value) => ({ key, value, label: labelOf[key](value) })),
    ),
    ...FLAGS.flatMap((key) => (search[key] ? [{ key, label: flagLabels[key] }] : [])),
  ];
}

function ActiveFilters({
  search,
  onRemove,
  onClearAll,
}: {
  search: LibrarySearch;
  onRemove: (chip: Chip) => void;
  onClearAll: () => void;
}) {
  const { t } = useLingui();
  const headingId = useId();
  const chips = useFilterChips()(search);
  if (chips.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-sm font-semibold">
        <Trans>Active filters</Trans>
      </h2>
      <ul className="flex flex-wrap gap-2" data-testid="active-filters">
        {chips.map((chip) => (
          <li key={`${chip.key}:${chip.value ?? ''}`}>
            <button
              type="button"
              aria-label={t`Remove filter: ${chip.label}`}
              onClick={() => onRemove(chip)}
              className="inline-flex min-h-target items-center gap-1.5 rounded-full border-2 border-primary bg-surface px-3 text-left font-medium"
            >
              {chip.label}
              <X aria-hidden="true" className="size-4 shrink-0" />
            </button>
          </li>
        ))}
        {chips.length > 1 ? (
          <li>
            <button
              type="button"
              onClick={onClearAll}
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

/**
 * One filter dimension as a disclosure (open when it has choices, so the sheet stays short):
 * the summary names it and how many values are chosen, the legend says how the values combine.
 */
function FilterGroup({
  title,
  legend,
  chosen,
  children,
}: {
  title: string;
  legend: string;
  chosen: number;
  children: ReactNode;
}) {
  // Uncontrolled after the first render: React never closes it under the user's finger.
  const [initiallyOpen] = useState(chosen > 0);
  return (
    <details open={initiallyOpen} className="group rounded-xl border border-control">
      <summary className="flex min-h-target cursor-pointer list-none items-center gap-2 px-3 font-medium">
        <span className="flex-1">{title}</span>
        {chosen > 0 ? (
          <span className="text-sm text-fg-muted">
            {plural(chosen, { one: '# chosen', other: '# chosen' })}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 group-open:rotate-180 motion-safe:transition-transform"
        />
      </summary>
      <fieldset className="flex min-w-0 flex-col gap-0.5 px-1 pb-2">
        <legend className="px-2 pb-1 text-sm text-fg-muted">{legend}</legend>
        {children}
      </fieldset>
    </details>
  );
}

function FilterSheet({
  open,
  onOpenChange,
  search,
  onToggle,
  onFlag,
  count,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: LibrarySearch;
  onToggle: (list: List, value: string, on: boolean) => void;
  onFlag: (key: Flag, on: boolean) => void;
  count: number | null;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useLibraryWords();
  const catalog = useCatalog();
  const groups = catalog.muscles().groups;
  const items = catalog.equipment().items;
  const check = (list: List, value: string, label: string) => (
    <CheckRow
      key={value}
      label={label}
      checked={search[list]?.includes(value as never) === true}
      onChange={(checked) => onToggle(list, value, checked)}
    />
  );
  const flag = (key: Flag, label: string, description?: string) => (
    <CheckRow
      label={label}
      {...(description ? { description } : {})}
      checked={search[key] === true}
      onChange={(checked) => onFlag(key, checked)}
    />
  );
  const chosen = (list: List) => search[list]?.length ?? 0;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t`Filters`}
      description={t`Choose any number in each group. An exercise is shown when it matches one of your choices in every group you use.`}
      closeLabel={t`Close filters`}
    >
      <FilterGroup
        title={t`Muscle`}
        legend={t`Works any of these muscles`}
        chosen={chosen('muscle')}
      >
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {check('muscle', group.id, group.name.en)}
            {group.subRegions.length > 0 ? (
              <div className="flex flex-col gap-0.5 pl-8">
                {group.subRegions.map((region) => check('muscle', region.id, region.name.en))}
              </div>
            ) : null}
          </div>
        ))}
      </FilterGroup>
      <FilterGroup
        title={t`Equipment`}
        legend={t`Uses any of these items`}
        chosen={chosen('equipment')}
      >
        {EQUIPMENT_CATEGORIES.map((category) => {
          const inCategory = items.filter((item) => item.category === category);
          return inCategory.length === 0 ? null : (
            <fieldset key={category} className="flex min-w-0 flex-col gap-0.5 pt-1">
              <legend className="px-2 text-sm font-semibold">{labels.category(category)}</legend>
              {inCategory.map((item) => check('equipment', item.id, item.name.en))}
            </fieldset>
          );
        })}
      </FilterGroup>
      <FilterGroup
        title={t`Movement`}
        legend={t`Any of these movements`}
        chosen={chosen('pattern')}
      >
        {MOVEMENT_PATTERNS.map((pattern) => check('pattern', pattern, labels.pattern(pattern)))}
      </FilterGroup>
      <FilterGroup
        title={t`Mechanics`}
        legend={t`Compound, isolation or both`}
        chosen={chosen('mechanics')}
      >
        {check('mechanics', 'compound', words.mechanics('compound'))}
        {check('mechanics', 'isolation', words.mechanics('isolation'))}
      </FilterGroup>
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
