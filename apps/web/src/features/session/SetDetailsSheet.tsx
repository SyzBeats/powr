import { Trans, useLingui } from '@lingui/react/macro';

import type { SetFlags, SetType } from '@powr/domain';
import { TECHNIQUE_KINDS, type Technique, type TechniqueKind } from '@powr/domain/rules';

import { Button } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { Field } from '#ui/field';
import { Segmented } from '#ui/segmented';
import { Sheet } from '#ui/sheet';
import { Stepper } from '#ui/stepper';

import { useSessionWords } from './words';

/** The extras of a set beyond load, reps and effort (WKT-03, WKT-04, WKT-10). */
export interface SetExtras {
  readonly type: SetType;
  readonly technique: Technique | null;
  readonly flags: SetFlags;
  readonly note: string;
  /** False: logged without an effort rating (E-1: no e1RM PR from it). */
  readonly rated: boolean;
}

type TypeChoice = 'working' | 'top' | 'backoff' | 'amrap';
type TechniqueChoice = 'none' | TechniqueKind;

/**
 * "Set details" (WKT-03, WKT-04, WKT-10): the set type, an advanced technique with its drops or
 * mini-sets (credits per the registry, labelled heuristic in the summary), failure, a failed rep
 * and pain markers, an effort in half steps or no rating, and a note on the set.
 */
export function SetDetailsSheet({
  open,
  onOpenChange,
  exerciseName,
  plannedType,
  extras,
  rir,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  plannedType: SetType;
  extras: SetExtras;
  rir: number | null;
  onChange: (extras: SetExtras, rir: number | null) => void;
}) {
  const { t } = useLingui();
  const words = useSessionWords();
  const set = (patch: Partial<SetExtras>) => onChange({ ...extras, ...patch }, rir);
  const technique = extras.technique;
  const units = technique ? words.techniqueUnits(technique.kind) : null;
  const fixedType = plannedType === 'warmup' || plannedType === 'timed';
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t`Set details`}
      description={exerciseName}
      closeLabel={t`Close`}
    >
      {fixedType ? null : (
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="font-medium">
            <Trans>Set type</Trans>
          </span>
          <Segmented<TypeChoice>
            label={t`Set type`}
            value={extras.type as TypeChoice}
            onChange={(type) => set({ type })}
            options={(['working', 'top', 'backoff', 'amrap'] as const).map((value) => ({
              value,
              label: words.setType(value),
            }))}
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="font-medium">
          <Trans>Technique</Trans>
        </span>
        <Segmented<TechniqueChoice>
          label={t`Technique`}
          value={technique?.kind ?? 'none'}
          onChange={(kind) =>
            set({
              technique:
                kind === 'none'
                  ? null
                  : { kind, ...(words.techniqueUnits(kind) ? { units: 1 } : {}) },
            })
          }
          options={[
            { value: 'none', label: t`None` },
            ...TECHNIQUE_KINDS.map((kind) => ({ value: kind, label: words.technique(kind) })),
          ]}
        />
        <p className="text-sm text-fg-muted">
          <Trans>Extra volume credit for techniques is a heuristic, not a measured value.</Trans>
        </p>
      </div>
      {technique && units ? (
        <Stepper
          label={units}
          value={technique.units ?? 1}
          onChange={(value) =>
            set({ technique: { ...technique, units: Math.max(0, Math.min(20, value ?? 0)) } })
          }
          onStep={(direction, current) => Math.max(0, Math.min(20, (current ?? 0) + direction))}
          decrementLabel={t`One fewer`}
          incrementLabel={t`One more`}
          decimal={false}
          max={20}
        />
      ) : null}
      <div className="flex flex-col gap-1">
        <CheckRow
          label={t`Rate the effort (reps in reserve)`}
          checked={extras.rated}
          onChange={(rated) => onChange({ ...extras, rated }, rated ? (rir ?? 2) : rir)}
        />
        {extras.rated ? (
          <Stepper
            label={t`Reps in reserve, in half steps`}
            value={rir}
            onChange={(value) => onChange(extras, value)}
            onStep={(direction, current) =>
              Math.max(0, Math.min(10, (current ?? 2) + direction * 0.5))
            }
            decrementLabel={t`Half a rep less in reserve`}
            incrementLabel={t`Half a rep more in reserve`}
            max={10}
          />
        ) : (
          <p className="text-sm text-fg-muted">
            <Trans>
              Without a rating the set still counts for reps, weight and volume, but not for your
              estimated 1-rep max.
            </Trans>
          </p>
        )}
      </div>
      <div className="flex flex-col">
        <CheckRow
          label={t`Taken to failure`}
          checked={extras.flags.failure === true}
          onChange={(failure) => set({ flags: { ...extras.flags, failure } })}
        />
        <CheckRow
          label={t`A rep failed`}
          checked={extras.flags.failedRep === true}
          onChange={(failedRep) => set({ flags: { ...extras.flags, failedRep } })}
        />
        <CheckRow
          label={t`Pain or discomfort`}
          checked={extras.flags.pain === true}
          onChange={(pain) => set({ flags: { ...extras.flags, pain } })}
        />
      </div>
      <Field
        label={t`Note on this set`}
        value={extras.note}
        maxLength={2000}
        onChange={(event) => set({ note: event.target.value })}
      />
      <Button variant="primary" onClick={() => onOpenChange(false)}>
        <Trans>Done</Trans>
      </Button>
    </Sheet>
  );
}
