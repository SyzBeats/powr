import { Trans, useLingui } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';

import {
  BODY_PHASES,
  MOVEMENT_PATTERNS,
  RPE_FAMILIARITY,
  SEX_OPTIONS,
  TIME_OFF_BANDS,
  TRAINING_AGE_BANDS,
  type EquipmentProfile,
  type ExerciseId,
  type IsoWeekday,
  type MovementPattern,
  type MuscleId,
  type PresetId,
  type SexOption,
  type TrainingStyle,
} from '@powr/domain';

import { Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { CheckRow, ChipGroup, ChoiceCards } from '#ui/choice';
import { Field } from '#ui/field';
import { Card } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { useCatalog, usePlanning } from '../../hooks/use-planning';
import { EquipmentEditor } from '../equipment/EquipmentEditor';
import { PresetPicker } from '../equipment/EquipmentScreens';
import { parseNumber } from '../equipment/inventory';
import { useLabels } from '../labels';
import { draftUnits, type Draft } from './answers';

export interface StepProps {
  readonly draft: Draft;
  readonly update: (patch: Draft) => void;
  /** Field errors of this step, shown after Continue (WCAG 3.3.1). */
  readonly errors: Readonly<Record<string, string>>;
  readonly weekStart: IsoWeekday;
}

/** A visible error under a question, tied to it by proximity and announced with the summary. */
function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="font-medium text-danger">{children}</p> : null;
}

/** ONB-03: style with a one-sentence description and an example week; phase optional. */
export function GoalStep({ draft, update, errors }: StepProps) {
  const { t } = useLingui();
  const labels = useLabels();
  const describe: Record<TrainingStyle, string> = {
    bodybuilding: t`Build muscle size. Example week: upper body, lower body, upper, lower.`,
    powerlifting: t`Get stronger in squat, bench press and deadlift. Example week: heavy, light and medium days for each lift.`,
    powerbuilding: t`Both: strength on the big three plus muscle-building work. Example week: two strength days and two size days.`,
  };
  return (
    <>
      <ChoiceCards<TrainingStyle>
        legend={t`What do you want from training?`}
        value={draft.style ?? null}
        onChange={(style) => update({ style })}
        options={(['bodybuilding', 'powerlifting', 'powerbuilding'] as const).map((style) => ({
          value: style,
          label: labels.style(style),
          description: describe[style],
        }))}
      />
      <ErrorText>{errors['style']}</ErrorText>
      <details className="rounded-2xl bg-surface p-3">
        <summary className="min-h-target-min cursor-pointer font-semibold">
          <Trans>Body-weight goal (optional)</Trans>
        </summary>
        <div className="pt-3">
          <ChoiceCards
            legend={t`Are you trying to change your body weight?`}
            value={draft.phase ?? null}
            onChange={(phase) => update({ phase })}
            options={BODY_PHASES.map((phase) => ({ value: phase, label: labels.phase(phase) }))}
          />
        </div>
      </details>
    </>
  );
}

/** ONB-04: training age, time off, RPE/RIR familiarity (jargon explained on tap). */
export function ExperienceStep({ draft, update, errors }: StepProps) {
  const { t } = useLingui();
  const labels = useLabels();
  const experience = draft.experience;
  // The draft holds the answers given so far; Continue checks that all three are there.
  const set = (patch: Partial<NonNullable<Draft['experience']>>) =>
    update({
      experience: { recentVolume: [], ...experience, ...patch } as NonNullable<Draft['experience']>,
    });
  return (
    <>
      <ChoiceCards
        legend={t`How long have you trained regularly?`}
        value={experience?.trainingAge ?? null}
        onChange={(trainingAge) => set({ trainingAge })}
        options={TRAINING_AGE_BANDS.map((band) => ({
          value: band,
          label: labels.trainingAge(band),
        }))}
      />
      <ErrorText>{errors['trainingAge']}</ErrorText>
      <ChoiceCards
        legend={t`When did you last train regularly?`}
        hint={t`After a break, the first weeks start a little lighter.`}
        value={experience?.timeOff ?? null}
        onChange={(timeOff) => set({ timeOff })}
        options={TIME_OFF_BANDS.map((band) => ({ value: band, label: labels.timeOff(band) }))}
      />
      <ErrorText>{errors['timeOff']}</ErrorText>
      <ChoiceCards
        legend={t`How familiar are "reps in reserve" (RIR) and RPE?`}
        value={experience?.rpeFamiliarity ?? null}
        onChange={(rpeFamiliarity) => set({ rpeFamiliarity })}
        options={RPE_FAMILIARITY.map((value) => ({
          value,
          label: labels.rpeFamiliarity(value),
        }))}
      />
      <ErrorText>{errors['rpeFamiliarity']}</ErrorText>
      <details className="rounded-2xl bg-surface p-3">
        <summary className="min-h-target-min cursor-pointer font-semibold">
          <Trans>What do RIR and RPE mean?</Trans>
        </summary>
        <p className="pt-2">
          <Trans>
            RIR ("reps in reserve") is how many more reps you could have done when you stopped a
            set. 2 RIR means two more were possible. RPE (rate of perceived exertion) says the same
            on a 1–10 scale: RPE 8 equals 2 RIR. POWR asks in plain words if you are new to it.
          </Trans>
        </p>
      </details>
    </>
  );
}

const MINUTES = ['30', '45', '60', '75', '90', '90+'] as const;

/** ONB-05: training days (2–6), session length; start times are optional (CAL-02). */
export function ScheduleStep({ draft, update, errors, weekStart }: StepProps) {
  const { t } = useLingui();
  const labels = useLabels();
  const schedule = draft.schedule ?? { weekdays: [], sessionMinutes: 60 };
  const days = Array.from(
    { length: 7 },
    (_, index) => (((weekStart - 1 + index) % 7) + 1) as IsoWeekday,
  );
  const minutes = schedule.sessionMinutes === null ? '90+' : String(schedule.sessionMinutes);
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold" id="days-legend">
          <Trans>Which days can you train?</Trans>
        </p>
        <p className="text-fg-muted">
          <Trans>Pick 2 to 6 days. Rest days in between help recovery.</Trans>
        </p>
        <ChipGroup<string>
          label={t`Training days`}
          value={schedule.weekdays.map(String)}
          onChange={(next) =>
            update({
              schedule: {
                ...schedule,
                weekdays: days.filter((day) => next.includes(String(day))),
              },
            })
          }
          options={days.map((day) => ({ value: String(day), label: labels.weekday(day) }))}
        />
        <p className="text-sm text-fg-muted" aria-live="polite">
          <Trans>{schedule.weekdays.length} days selected</Trans>
        </p>
        <ErrorText>{errors['weekdays']}</ErrorText>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">
          <Trans>How long can a session be?</Trans>
        </p>
        <Segmented
          label={t`Session length in minutes`}
          value={minutes}
          onChange={(value) =>
            update({
              schedule: { ...schedule, sessionMinutes: value === '90+' ? null : Number(value) },
            })
          }
          options={MINUTES.map((value) => ({
            value,
            label: value === '90+' ? t`90+ min` : t`${value} min`,
          }))}
        />
        <ErrorText>{errors['sessionMinutes']}</ErrorText>
      </div>
      {schedule.weekdays.length > 0 ? (
        <details className="rounded-2xl bg-surface p-3">
          <summary className="min-h-target-min cursor-pointer font-semibold">
            <Trans>Start times for your calendar (optional)</Trans>
          </summary>
          <div className="flex flex-col gap-2 pt-3">
            {schedule.weekdays.map((day) => (
              <Field
                key={day}
                type="time"
                label={labels.weekday(day)}
                value={draft.startTimes?.find((entry) => entry.weekday === day)?.time ?? ''}
                onChange={(event) =>
                  update({
                    startTimes: [
                      ...(draft.startTimes ?? []).filter((entry) => entry.weekday !== day),
                      ...(event.target.value ? [{ weekday: day, time: event.target.value }] : []),
                    ],
                  })
                }
              />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

/** ONB-02: units first (they set the equipment's unit); body data optional. */
export function BodyStep({ draft, update, errors }: StepProps) {
  const { t } = useLingui();
  const units = draftUnits(draft);
  const sex = draft.sex ?? null;
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">
          <Trans>Units</Trans>
        </p>
        <Segmented
          label={t`Weights in`}
          value={units.load}
          onChange={(load) => update({ units: { ...units, load, bodyweight: load } })}
          options={[
            { value: 'kg', label: t`Kilograms (kg)` },
            { value: 'lb', label: t`Pounds (lb)` },
          ]}
        />
        <Segmented
          label={t`Lengths in`}
          value={units.length}
          onChange={(length) => update({ units: { ...units, length } })}
          options={[
            { value: 'cm', label: t`Centimetres (cm)` },
            { value: 'in', label: t`Inches (in)` },
          ]}
        />
      </div>
      <Card className="gap-4">
        <p className="text-fg-muted">
          <Trans>
            Optional. Used for strength scores and body-weight trends; it stays on this phone.
          </Trans>
        </p>
        <ChoiceCards<SexOption>
          legend={t`Sex`}
          value={sex}
          onChange={(value) =>
            update({ sex: value, referenceSet: value === 'preferNotToSay' ? null : value })
          }
          options={SEX_OPTIONS.map((value) => ({
            value,
            label:
              value === 'female' ? t`Female` : value === 'male' ? t`Male` : t`Prefer not to say`,
          }))}
        />
        {sex === 'preferNotToSay' ? (
          <ChoiceCards<'female' | 'male' | 'skip'>
            legend={t`Which reference values should scores use?`}
            hint={t`Strength scores and some formulas differ by sex. You can skip this.`}
            value={draft.referenceSet ?? 'skip'}
            onChange={(value) => update({ referenceSet: value === 'skip' ? null : value })}
            options={[
              { value: 'female', label: t`Female reference values` },
              { value: 'male', label: t`Male reference values` },
              { value: 'skip', label: t`Skip for now` },
            ]}
          />
        ) : null}
        <Field
          label={t`Birth year`}
          inputMode="numeric"
          autoComplete="bday-year"
          value={draft.birthYear ?? ''}
          error={errors['birthYear']}
          onChange={(event) => update({ birthYear: parseNumber(event.target.value) })}
        />
        <Field
          label={t`Height`}
          inputMode="decimal"
          suffix={units.length}
          value={draft.height?.value ?? ''}
          error={errors['height']}
          onChange={(event) => {
            const value = parseNumber(event.target.value);
            update({ height: value === null ? null : { value, unit: units.length } });
          }}
        />
        <Field
          label={t`Body weight`}
          inputMode="decimal"
          suffix={units.bodyweight}
          value={draft.bodyweight?.value ?? ''}
          error={errors['bodyweight']}
          onChange={(event) => {
            const value = parseNumber(event.target.value);
            update({ bodyweight: value === null ? null : { value, unit: units.bodyweight } });
          }}
        />
      </Card>
    </>
  );
}

/**
 * ONB-06/EQP-02: a preset in two taps, or the editor. "Custom (empty)" opens the editor straight
 * away ("toggle what you have"); saving it empty gives a bodyweight-only plan with a note
 * (product-owner decision 2026-11-24).
 */
export function EquipmentStep({
  draft,
  update,
  errors,
  onPicked,
}: StepProps & { onPicked: (equipment: EquipmentProfile) => void }) {
  const { t } = useLingui();
  const run = usePlanning();
  const equipment = draft.equipment;
  const [editing, setEditing] = useState(equipment?.presetId === 'preset.custom');
  const pick = async (presetId: PresetId) => {
    const result = await run((planning, deps) =>
      planning.equipmentProfileFromPreset(deps, {
        presetId,
        unit: draftUnits(draft).load,
        name: t`My equipment`,
      }),
    );
    if (!result.ok) return;
    if (presetId === 'preset.custom') {
      update({ equipment: result.value });
      setEditing(true);
    } else onPicked(result.value);
  };

  if (equipment && editing) {
    return (
      <>
        <p className="text-fg-muted">
          <Trans>Toggle what you have access to. You can change this any time in Settings.</Trans>
        </p>
        <EquipmentEditor
          profile={equipment}
          onChange={(profile) => update({ equipment: profile })}
          showName={false}
        />
      </>
    );
  }
  return (
    <>
      <PresetPicker
        initial={equipment?.presetId ?? null}
        confirmLabel={t`Use this preset`}
        onPick={(presetId) => void pick(presetId)}
      />
      <ErrorText>{errors['equipment']}</ErrorText>
      {equipment ? (
        <Button onClick={() => setEditing(true)}>
          <Trans>Adjust the equipment list</Trans>
        </Button>
      ) : null}
    </>
  );
}

/** ONB-07: up to three priority muscles; exercises and movement patterns to avoid. */
export function PrioritiesStep({ draft, update, errors }: StepProps) {
  const { t } = useLingui();
  const labels = useLabels();
  const content = useCatalog();
  const priorities = draft.priorities ?? [];
  const avoid = draft.avoid ?? { exercises: [], patterns: [] };
  const [query, setQuery] = useState('');
  const groups = content.muscles().groups.filter((group) => !group.optional);
  const needle = query.trim().toLowerCase();
  const exercises =
    needle.length < 2
      ? []
      : content
          .exercises()
          .filter((exercise) => exercise.name.en.toLowerCase().includes(needle))
          .slice(0, 12);
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">
          <Trans>Muscles to prioritise (up to 3)</Trans>
        </p>
        <p className="text-fg-muted">
          <Trans>
            They get more sets and come first in a session. If time is short, they keep their full
            volume.
          </Trans>
        </p>
        <ChipGroup<string>
          label={t`Priority muscles`}
          value={priorities}
          onChange={(next) => update({ priorities: next.slice(0, 3) as MuscleId[] })}
          options={groups.map((group) => ({
            value: group.id,
            label: group.name.en,
            disabled: priorities.length >= 3,
          }))}
        />
        <ErrorText>{errors['priorities']}</ErrorText>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">
          <Trans>Movements to avoid</Trans>
        </p>
        <p className="text-fg-muted">
          <Trans>For an injury or a dislike. POWR never plans or suggests them.</Trans>
        </p>
        <ChipGroup<MovementPattern>
          label={t`Movement patterns to avoid`}
          value={avoid.patterns}
          onChange={(patterns) => update({ avoid: { ...avoid, patterns } })}
          options={MOVEMENT_PATTERNS.filter((pattern) => pattern !== 'carry').map((pattern) => ({
            value: pattern,
            label: labels.pattern(pattern),
          }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Field
          label={t`Find an exercise to avoid`}
          type="search"
          value={query}
          hint={t`Type at least two letters.`}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul>
          {[
            ...avoid.exercises.filter((id) => !exercises.some((exercise) => exercise.id === id)),
            ...exercises.map((exercise) => exercise.id),
          ].map((id: ExerciseId) => (
            <li key={id}>
              <CheckRow
                label={labels.exercise(id)}
                checked={avoid.exercises.includes(id)}
                onChange={(on) =>
                  update({
                    avoid: {
                      ...avoid,
                      exercises: on
                        ? [...avoid.exercises, id]
                        : avoid.exercises.filter((other) => other !== id),
                    },
                  })
                }
              />
            </li>
          ))}
        </ul>
      </div>
      {priorities.length >= 3 ? (
        <Callout tone="info">
          <Trans>Three priorities chosen. Deselect one to pick another.</Trans>
        </Callout>
      ) : null}
    </>
  );
}
