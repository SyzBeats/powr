import { useLingui } from '@lingui/react/macro';

import type { MassUnit } from '@powr/domain';
import type { SetInput } from '@powr/domain/session';

import { DecimalField } from '#ui/field';

/** One set as typed in a past-session form: weight (empty = bodyweight), reps, optional RIR. */
export interface SetDraft {
  readonly load: number | null;
  readonly reps: number | null;
  readonly rir: number | null;
}

export type SetErrors = Partial<Record<keyof SetDraft, string>>;

export const EMPTY_SET: SetDraft = { load: null, reps: null, rir: null };

/** The draft as the session core's set input (WKT-03). */
export function setInputOf(draft: SetDraft, unit: MassUnit): SetInput {
  return {
    load: draft.load === null ? null : { value: draft.load, unit },
    reps: draft.reps,
    rir: draft.rir,
  };
}

/**
 * The checks of WKT-03 in words, before anything is sent: reps are required and whole, a weight
 * is optional (bodyweight) and not negative, RIR is optional, 0–10 in half steps. The use cases
 * check the same ranges again.
 */
export function useSetChecks(): (draft: SetDraft) => SetErrors {
  const { t } = useLingui();
  return (draft) => {
    const errors: { load?: string; reps?: string; rir?: string } = {};
    if (draft.reps === null) errors.reps = t`Enter the reps.`;
    else if (!Number.isInteger(draft.reps) || draft.reps < 0 || draft.reps > 1000)
      errors.reps = t`Enter the reps as a whole number from 0 to 1000.`;
    if (draft.load !== null && (draft.load < 0 || draft.load > 2000))
      errors.load = t`Enter a weight from 0 to 2000, or leave it empty for bodyweight.`;
    if (draft.rir !== null && (draft.rir < 0 || draft.rir > 10 || !Number.isInteger(draft.rir * 2)))
      errors.rir = t`Enter reps in reserve from 0 to 10, in steps of 0.5.`;
    return errors;
  };
}

/** Weight, reps and reps in reserve of one set, each with its error next to it (WCAG 3.3.1). */
export function SetFields({
  draft,
  errors,
  unit,
  onChange,
}: {
  draft: SetDraft;
  errors: SetErrors;
  unit: MassUnit;
  onChange: (draft: SetDraft) => void;
}) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-3">
      <DecimalField
        label={t`Weight (${unit})`}
        hint={t`Leave empty for bodyweight.`}
        value={draft.load}
        onValueChange={(load) => onChange({ ...draft, load })}
        error={errors.load}
        autoComplete="off"
      />
      <DecimalField
        label={t`Reps`}
        value={draft.reps}
        onValueChange={(reps) => onChange({ ...draft, reps })}
        error={errors.reps}
        autoComplete="off"
      />
      <DecimalField
        label={t`Reps in reserve (optional)`}
        hint={t`How many more reps you could have done.`}
        value={draft.rir}
        onValueChange={(rir) => onChange({ ...draft, rir })}
        error={errors.rir}
        autoComplete="off"
      />
    </div>
  );
}
