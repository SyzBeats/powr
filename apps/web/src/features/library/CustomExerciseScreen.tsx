import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';

import {
  CREDIT_VALUES,
  CURVE_CLASSES,
  EQUIPMENT_CATEGORIES,
  LOAD_TYPES,
  MOVEMENT_PATTERNS,
  REST_CLASSES,
  type CreditValue,
  type CurveClass,
  type EquipmentId,
  type ExerciseId,
  type LoadType,
  type Mechanics,
  type MovementPattern,
  type MuscleId,
  type RestClass,
} from '@powr/domain';
import type { CustomExerciseInput, CustomExerciseIssue } from '@powr/domain/library';

import { ActionBar } from '#ui/action-bar';
import { Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { ChoiceCards, CheckRow } from '#ui/choice';
import { DecimalField, Field } from '#ui/field';
import { Card, Screen } from '#ui/screen';

import { useLibrary, useLibraryQuery } from '../../hooks/use-library';
import { useCatalog } from '../../hooks/use-planning';
import { formatNumber } from '../../i18n/format';
import { useLabels } from '../labels';
import { useLoadUnit } from '../session/words';
import { useLibraryWords } from './words';

/*
 * EXL-04 custom exercises: created from scratch or by copying another exercise (`?from=`), edited
 * later; every field of the PRD (name, equipment, muscle credits 1 / 0.5 / 0.25 / 0, movement
 * pattern, mechanics, load type, one side at a time, weight step, rep ranges, rest class and the
 * load curve for the e1RM), plus the optional MAP-03 rating (stretch and overload) that the
 * rankings use only when the user says so, a close variant (EXL-07) and the user's own cues. The
 * use case validates; every problem shows next to its field and in a focused summary.
 */

interface MuscleRow {
  readonly key: number;
  readonly muscle: MuscleId | '';
  readonly credit: CreditValue;
}

interface FormState {
  readonly name: string;
  readonly synonyms: string;
  readonly pattern: MovementPattern | '';
  readonly mechanics: Mechanics | '';
  readonly allOf: readonly EquipmentId[];
  readonly anyOf: readonly (readonly EquipmentId[])[];
  readonly muscles: readonly MuscleRow[];
  readonly loadType: LoadType | '';
  readonly curveClass: CurveClass;
  readonly unilateral: boolean;
  readonly bodyweightLoaded: boolean;
  readonly increment: number | null;
  readonly strength: readonly [string, string];
  readonly hypertrophy: readonly [string, string];
  readonly restClass: RestClass | '';
  readonly tempo: string;
  readonly stretchEmphasis: boolean;
  readonly overloadSuitability: 0 | 1 | 2 | 3;
  readonly userRated: boolean;
  readonly variantOf: ExerciseId | '';
  readonly substitutionGroups: readonly string[];
  readonly cues: string;
}

const EMPTY: FormState = {
  name: '',
  synonyms: '',
  pattern: '',
  mechanics: '',
  allOf: [],
  anyOf: [],
  muscles: [{ key: 0, muscle: '', credit: 1 }],
  loadType: '',
  curveClass: 'equation',
  unilateral: false,
  bodyweightLoaded: false,
  increment: null,
  strength: ['3', '6'],
  hypertrophy: ['8', '12'],
  restClass: '',
  tempo: '',
  stretchEmphasis: false,
  overloadSuitability: 2,
  userRated: false,
  variantOf: '',
  substitutionGroups: [],
  cues: '',
};

function stateOf(
  input: CustomExerciseInput,
  extra: { name?: string; synonyms?: readonly string[]; cues?: readonly string[] },
  unit: 'kg' | 'lb',
): FormState {
  const increment = input.load.increment;
  return {
    name: extra.name ?? input.name,
    synonyms: (extra.synonyms ?? input.synonyms ?? []).join(', '),
    pattern: input.pattern,
    mechanics: input.mechanics,
    allOf: input.equipment.allOf,
    anyOf: input.equipment.anyOf,
    muscles: input.muscles.map((entry, index) => ({ key: index, ...entry })),
    loadType: input.load.type,
    curveClass: input.load.curveClass,
    unilateral: input.load.unilateral,
    bodyweightLoaded: input.load.bodyweightLoaded ?? false,
    increment: increment
      ? Math.round((increment.unit === unit ? increment.value : toUnit(increment, unit)) * 100) /
        100
      : null,
    strength: [String(input.repRange.strength[0]), String(input.repRange.strength[1])],
    hypertrophy: [String(input.repRange.hypertrophy[0]), String(input.repRange.hypertrophy[1])],
    restClass: input.restClass,
    tempo: input.tempo ?? '',
    stretchEmphasis: input.stretchEmphasis ?? false,
    overloadSuitability: input.overloadSuitability ?? 2,
    userRated: input.userRated ?? false,
    variantOf: input.variantOf ?? '',
    substitutionGroups: input.substitutionGroups ?? [],
    cues: (extra.cues ?? input.cues ?? []).join('\n'),
  };
}

const KG_PER_LB = 0.45359237;
function toUnit(mass: { value: number; unit: 'kg' | 'lb' }, unit: 'kg' | 'lb'): number {
  const kg = mass.unit === 'kg' ? mass.value : mass.value * KG_PER_LB;
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

/** A typed rep range; an empty or non-numeric bound fails the use case's check. */
function range(pair: readonly [string, string]): readonly [number, number] {
  return [Number(pair[0].trim() || Number.NaN), Number(pair[1].trim() || Number.NaN)];
}

function inputOf(form: FormState, unit: 'kg' | 'lb'): CustomExerciseInput {
  return {
    name: form.name,
    synonyms: form.synonyms
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    pattern: form.pattern as MovementPattern,
    mechanics: form.mechanics as Mechanics,
    equipment: { allOf: form.allOf, anyOf: form.anyOf },
    muscles: form.muscles
      .filter((row) => row.muscle !== '')
      .map((row) => ({ muscle: row.muscle as MuscleId, credit: row.credit })),
    load: {
      type: form.loadType as LoadType,
      curveClass: form.curveClass,
      unilateral: form.unilateral,
      bodyweightLoaded:
        form.bodyweightLoaded &&
        (form.loadType === 'bodyweightAdded' || form.loadType === 'bodyweightAssisted'),
      ...(form.increment === null ? {} : { increment: { value: form.increment, unit } }),
    },
    repRange: { strength: range(form.strength), hypertrophy: range(form.hypertrophy) },
    restClass: form.restClass as RestClass,
    ...(form.tempo.trim() ? { tempo: form.tempo.trim() } : {}),
    stretchEmphasis: form.stretchEmphasis,
    overloadSuitability: form.overloadSuitability,
    userRated: form.userRated,
    ...(form.variantOf ? { variantOf: form.variantOf } : {}),
    substitutionGroups: form.substitutionGroups,
    cues: form.cues
      .split('\n')
      .map((cue) => cue.trim())
      .filter(Boolean),
  };
}

/** `/explore/exercises/new` (`?from=` copies an exercise). */
export function NewCustomExerciseScreen({ from }: { from: string | null }) {
  const { t } = useLingui();
  const unit = useLoadUnit();
  const draft = useLibraryQuery(`draft:${from ?? ''}`, async (library, deps) =>
    library.customExerciseDraft(deps, (from ?? undefined) as ExerciseId | undefined),
  );
  const title = t`New custom exercise`;
  if (!draft.loaded) return <Loading title={title} />;
  const { input, copiedFrom } = draft.value;
  return (
    <CustomExerciseForm
      title={title}
      initial={input ? stateOf(input, {}, unit) : EMPTY}
      copiedFrom={copiedFrom}
      id={null}
    />
  );
}

/** `/explore/exercises/edit/$exerciseId`: a custom exercise only. */
export function EditCustomExerciseScreen({ exerciseId }: { exerciseId: string }) {
  const { t } = useLingui();
  const unit = useLoadUnit();
  const catalog = useCatalog();
  const exercise = catalog.exercise(exerciseId as ExerciseId);
  const draft = useLibraryQuery(`edit:${exerciseId}`, async (library, deps) =>
    library.customExerciseDraft(deps, exerciseId as ExerciseId),
  );
  const title = t`Edit custom exercise`;
  if (!exercise || !exercise.custom || exercise.status !== 'active') {
    return (
      <Screen title={title}>
        <Card>
          <p>
            <Trans>Only your own custom exercises can be edited. Copy this one instead.</Trans>
          </p>
          <Link to="/explore" className={buttonClass({ size: 'lg' })}>
            <Trans>Back to Explore</Trans>
          </Link>
        </Card>
      </Screen>
    );
  }
  if (!draft.loaded || !draft.value.input) return <Loading title={title} />;
  return (
    <CustomExerciseForm
      title={title}
      initial={{
        ...stateOf(
          draft.value.input,
          {
            name: exercise.name.en,
            synonyms: exercise.synonyms,
            cues: exercise.cues.map((cue) => cue.en),
          },
          unit,
        ),
        userRated: exercise.userRated === true,
        // A custom exercise names its own parent; `customDraftFrom` keeps it.
        variantOf: exercise.variantOf ?? '',
      }}
      copiedFrom={null}
      id={exercise.id}
    />
  );
}

function Loading({ title }: { title: string }) {
  return (
    <Screen title={title}>
      <output className="block text-fg-muted">
        <Trans>Loading…</Trans>
      </output>
    </Screen>
  );
}

type FieldKey = CustomExerciseIssue['field'];

function CustomExerciseForm({
  title,
  initial,
  copiedFrom,
  id,
}: {
  title: string;
  initial: FormState;
  copiedFrom: ExerciseId | null;
  id: ExerciseId | null;
}) {
  const { t } = useLingui();
  const run = useLibrary();
  const navigate = useNavigate();
  const labels = useLabels();
  const words = useLibraryWords();
  const unit = useLoadUnit();
  const catalog = useCatalog();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<FormState>(initial);
  const [issues, setIssues] = useState<readonly CustomExerciseIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const cuesId = useId();

  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const fieldError = (field: FieldKey): string | undefined => {
    const messages = [...new Set(issues.filter((entry) => entry.field === field).map(words.issue))];
    return messages.length > 0 ? messages.join(' ') : undefined;
  };

  const save = async () => {
    setBusy(true);
    const result = await run((library, deps) =>
      library.saveCustomExercise(deps, {
        ...(id ? { id } : {}),
        exercise: inputOf(form, unit),
        ...(copiedFrom ? { copiedFrom } : {}),
      }),
    );
    setBusy(false);
    if (!result.ok) {
      setIssues(
        result.error.kind === 'invalid' ? result.error.issues : [{ field: 'name', code: 'empty' }],
      );
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    void navigate({
      to: '/explore/exercises/$exerciseId',
      params: { exerciseId: result.value.id },
      replace: true,
    });
  };

  const summary = [...new Set(issues.map(words.issue))];
  const groups = catalog.muscles().groups;
  const items = catalog.equipment().items;
  const parents = catalog
    .exercises()
    .filter(
      (exercise) =>
        exercise.status === 'active' &&
        exercise.competitionLift !== undefined &&
        exercise.variantOf === undefined,
    );
  const bodyweightType =
    form.loadType === 'bodyweightAdded' || form.loadType === 'bodyweightAssisted';
  const copiedName = copiedFrom ? labels.exercise(copiedFrom) : null;

  return (
    <Screen title={title}>
      {copiedName ? (
        <p className="text-fg-muted">
          <Trans>A copy of {copiedName}. Give it its own name and change what differs.</Trans>
        </p>
      ) : null}
      {summary.length > 0 ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="outline-none">
          <Callout tone="danger" title={t`Please check the exercise`}>
            <ul className="list-disc pl-5" data-testid="custom-errors">
              {summary.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Callout>
        </div>
      ) : null}

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Name</Trans>
        </h2>
        <Field
          label={t`Name`}
          value={form.name}
          maxLength={120}
          onChange={(event) => set({ name: event.target.value })}
          error={fieldError('name')}
        />
        <Field
          label={t`Other names (optional)`}
          hint={t`Separate them with commas. Search finds the exercise by these too.`}
          value={form.synonyms}
          onChange={(event) => set({ synonyms: event.target.value })}
          error={fieldError('synonyms')}
        />
      </Card>

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Movement</Trans>
        </h2>
        <Select
          label={t`Movement pattern`}
          value={form.pattern}
          onChange={(value) => set({ pattern: value as MovementPattern | '' })}
          error={fieldError('pattern')}
        >
          <option value="">{t`Choose a pattern`}</option>
          {MOVEMENT_PATTERNS.map((pattern) => (
            <option key={pattern} value={pattern}>
              {labels.pattern(pattern)}
            </option>
          ))}
        </Select>
        <ChoiceCards<Mechanics>
          legend={t`Mechanics`}
          options={[
            { value: 'compound', label: words.mechanics('compound') },
            { value: 'isolation', label: words.mechanics('isolation') },
          ]}
          value={form.mechanics || null}
          onChange={(mechanics) => set({ mechanics })}
        />
        <FieldError message={fieldError('mechanics')} />
        <Select
          label={t`A close variant of (optional)`}
          hint={t`For powerlifting: its sets then count toward that lift's heavy sets.`}
          value={form.variantOf}
          onChange={(value) => set({ variantOf: value as ExerciseId | '' })}
          error={fieldError('variantOf')}
        >
          <option value="">{t`None`}</option>
          {form.variantOf && !parents.some((exercise) => exercise.id === form.variantOf) ? (
            <option value={form.variantOf}>{labels.exercise(form.variantOf)}</option>
          ) : null}
          {parents.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name.en}
            </option>
          ))}
        </Select>
      </Card>

      <MusclesEditor
        rows={form.muscles}
        onChange={(muscles) => set({ muscles })}
        error={fieldError('muscles')}
        groups={groups}
      />

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Equipment</Trans>
        </h2>
        <p className="text-sm text-fg-muted">
          <Trans>Tick everything the exercise needs. Leave it empty for no equipment.</Trans>
        </p>
        <FieldError message={fieldError('equipment')} />
        {form.anyOf.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {form.anyOf.map((group, index) => {
              const text = new Intl.ListFormat(undefined, { type: 'disjunction' }).format(
                group.map((item) => labels.equipment(item)),
              );
              return (
                <li key={index} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <Trans>One of: {text}</Trans>
                  </span>
                  <Button
                    aria-label={t`Remove the requirement: one of ${text}`}
                    onClick={() =>
                      set({ anyOf: form.anyOf.filter((_, position) => position !== index) })
                    }
                  >
                    <Trash2 aria-hidden="true" className="size-5" />
                    <Trans>Remove</Trans>
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {EQUIPMENT_CATEGORIES.map((category) => {
          const inCategory = items.filter((item) => item.category === category);
          if (inCategory.length === 0) return null;
          const chosen = inCategory.filter((item) => form.allOf.includes(item.id)).length;
          return (
            <details key={category} className="rounded-xl border border-border" open={chosen > 0}>
              <summary className="flex min-h-target cursor-pointer items-center px-3 font-semibold">
                {chosen > 0 ? (
                  <Trans>
                    {labels.category(category)} ({formatNumber(chosen, 0)} chosen)
                  </Trans>
                ) : (
                  labels.category(category)
                )}
              </summary>
              <div className="flex flex-col px-1 pb-2">
                {inCategory.map((item) => (
                  <CheckRow
                    key={item.id}
                    label={item.name.en}
                    checked={form.allOf.includes(item.id)}
                    onChange={(checked) =>
                      set({
                        allOf: checked
                          ? [...form.allOf, item.id]
                          : form.allOf.filter((entry) => entry !== item.id),
                      })
                    }
                  />
                ))}
              </div>
            </details>
          );
        })}
      </Card>

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Loading</Trans>
        </h2>
        <Select
          label={t`How the weight is loaded`}
          value={form.loadType}
          onChange={(value) => set({ loadType: value as LoadType | '' })}
          error={fieldError('load')}
        >
          <option value="">{t`Choose how it is loaded`}</option>
          {LOAD_TYPES.map((type) => (
            <option key={type} value={type}>
              {words.loadType(type)}
            </option>
          ))}
        </Select>
        {bodyweightType ? (
          <CheckRow
            label={t`Bodyweight counts toward the load`}
            description={t`For pull-ups and dips: the 1-rep max estimate adds your bodyweight.`}
            checked={form.bodyweightLoaded}
            onChange={(bodyweightLoaded) => set({ bodyweightLoaded })}
          />
        ) : null}
        <CheckRow
          label={t`One side at a time`}
          description={t`Single-arm or single-leg: sets can be logged per side.`}
          checked={form.unilateral}
          onChange={(unilateral) => set({ unilateral })}
        />
        <DecimalField
          label={t`Weight step (optional)`}
          hint={t`The smallest jump you can make. Empty: your equipment decides.`}
          value={form.increment}
          onValueChange={(increment) => set({ increment })}
          suffix={unit}
        />
        <ChoiceCards<CurveClass>
          legend={t`Load curve for the 1-rep max estimate`}
          options={CURVE_CLASSES.map((curve) => ({
            value: curve,
            label: words.curveClass(curve),
            description: words.curveHint(curve),
          }))}
          value={form.curveClass}
          onChange={(curveClass) => set({ curveClass })}
        />
      </Card>

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Defaults</Trans>
        </h2>
        <RangeFields
          legend={t`Reps for strength`}
          value={form.strength}
          onChange={(strength) => set({ strength })}
        />
        <RangeFields
          legend={t`Reps for muscle size`}
          value={form.hypertrophy}
          onChange={(hypertrophy) => set({ hypertrophy })}
        />
        <FieldError message={fieldError('repRange')} />
        <Select
          label={t`Rest between sets`}
          value={form.restClass}
          onChange={(value) => set({ restClass: value as RestClass | '' })}
          error={fieldError('restClass')}
        >
          <option value="">{t`Choose a rest class`}</option>
          {REST_CLASSES.map((rest) => (
            <option key={rest} value={rest}>
              {words.restClass(rest)}
            </option>
          ))}
        </Select>
        <Field
          label={t`Tempo (optional)`}
          hint={t`Lowering, pause, lifting, pause in seconds, for example 3-1-X-0. Empty: 2-0-X-0.`}
          value={form.tempo}
          maxLength={11}
          onChange={(event) => set({ tempo: event.target.value })}
          error={fieldError('tempo')}
        />
      </Card>

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Your rating (optional)</Trans>
        </h2>
        <p className="text-sm text-fg-muted">
          <Trans>
            Custom exercises are unrated in the body map's rankings. Rate it to let the rankings use
            your view of it.
          </Trans>
        </p>
        <CheckRow
          label={t`Use my rating in the rankings`}
          checked={form.userRated}
          onChange={(userRated) => set({ userRated })}
        />
        <CheckRow
          label={t`Trains the muscles in a stretched position`}
          checked={form.stretchEmphasis}
          onChange={(stretchEmphasis) => set({ stretchEmphasis })}
        />
        <Select
          label={t`How easy it is to add weight over time`}
          value={String(form.overloadSuitability)}
          onChange={(value) =>
            set({ overloadSuitability: Number(value) as FormState['overloadSuitability'] })
          }
        >
          <option value="3">{t`Easy: stable and loadable`}</option>
          <option value="2">{t`Fairly easy`}</option>
          <option value="1">{t`Hard`}</option>
          <option value="0">{t`Very hard`}</option>
        </Select>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Cues (optional)</Trans>
        </h2>
        <label htmlFor={cuesId} className="font-medium">
          <Trans>Up to 6 cues, one per line</Trans>
        </label>
        <textarea
          id={cuesId}
          value={form.cues}
          rows={4}
          aria-invalid={fieldError('cues') ? true : undefined}
          onChange={(event) => set({ cues: event.target.value })}
          className="w-full rounded-xl border border-input bg-transparent p-2.5 text-base"
        />
        <FieldError message={fieldError('cues')} />
      </Card>

      <ActionBar>
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void save()}>
          <Trans>Save exercise</Trans>
        </Button>
        {id ? (
          <Link
            to="/explore/exercises/$exerciseId"
            params={{ exerciseId: id }}
            className={buttonClass({ size: 'lg' })}
          >
            <Trans>Cancel</Trans>
          </Link>
        ) : (
          <Link to="/explore" className={buttonClass({ size: 'lg' })}>
            <Trans>Cancel</Trans>
          </Link>
        )}
      </ActionBar>
    </Screen>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-danger">{message}</p>;
}

function Select({
  label,
  hint,
  value,
  onChange,
  error,
  children,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  children: ReactNode;
}) {
  const id = useId();
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-target w-full min-w-0 rounded-xl border border-control bg-surface px-3"
      >
        {children}
      </select>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RangeFields({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: readonly [string, string];
  onChange: (value: readonly [string, string]) => void;
}) {
  const { t } = useLingui();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        <Field
          className="w-28"
          label={t`From`}
          inputMode="numeric"
          value={value[0]}
          onChange={(event) => onChange([event.target.value, value[1]])}
        />
        <Field
          className="w-28"
          label={t`To`}
          inputMode="numeric"
          value={value[1]}
          onChange={(event) => onChange([value[0], event.target.value])}
        />
      </div>
    </fieldset>
  );
}

/** EXL-04, EXL-05: muscles with their credit; sub-regions roll up to their group for display. */
function MusclesEditor({
  rows,
  onChange,
  error,
  groups,
}: {
  rows: readonly MuscleRow[];
  onChange: (rows: MuscleRow[]) => void;
  error: string | undefined;
  groups: ReturnType<ReturnType<typeof useCatalog>['muscles']>['groups'];
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useLibraryWords();
  const update = (key: number, patch: Partial<MuscleRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Muscles worked</Trans>
      </h2>
      <p className="text-sm text-fg-muted">
        <Trans>
          Give at least one muscle the primary credit. A quarter set is an unvalidated convention:
          use it only for light involvement.
        </Trans>
      </p>
      <FieldError message={error} />
      <ul className="flex flex-col gap-3" data-testid="custom-muscles">
        {rows.map((row, index) => {
          const name = row.muscle ? labels.muscle(row.muscle) : formatNumber(index + 1, 0);
          return (
            <li key={row.key}>
              <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <legend className="px-1 text-sm font-semibold">
                  <Trans>Muscle {formatNumber(index + 1, 0)}</Trans>
                </legend>
                <Select
                  label={t`Muscle`}
                  value={row.muscle}
                  onChange={(value) => update(row.key, { muscle: value as MuscleId | '' })}
                >
                  <option value="">{t`Choose a muscle`}</option>
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
                </Select>
                <Select
                  label={t`Credit per set`}
                  value={String(row.credit)}
                  onChange={(value) => update(row.key, { credit: Number(value) as CreditValue })}
                >
                  {CREDIT_VALUES.map((credit) => (
                    <option key={credit} value={String(credit)}>
                      {words.creditOption(credit)}
                    </option>
                  ))}
                </Select>
                {rows.length > 1 ? (
                  <Button
                    aria-label={t`Remove muscle: ${name}`}
                    onClick={() => onChange(rows.filter((entry) => entry.key !== row.key))}
                  >
                    <Trash2 aria-hidden="true" className="size-5" />
                    <Trans>Remove</Trans>
                  </Button>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ul>
      {rows.length < 20 ? (
        <Button
          onClick={() =>
            onChange([
              ...rows,
              {
                key: Math.max(-1, ...rows.map((row) => row.key)) + 1,
                muscle: '',
                credit: 0.5,
              },
            ])
          }
        >
          <Plus aria-hidden="true" className="size-5" />
          <Trans>Add a muscle</Trans>
        </Button>
      ) : null}
    </Card>
  );
}
