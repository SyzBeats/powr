import { Trans, useLingui } from '@lingui/react/macro';
import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import type { OnboardingAnswers, PlanPreview, PlanPreviewError } from '@powr/application/planning';
import type { EquipmentProfile, IsoWeekday, LocalDate, PresetId, TemplateId } from '@powr/domain';
import type { PlanFix } from '@powr/domain/planning';

import { Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { Card, Screen } from '#ui/screen';

import { useFocusRequest } from '../../hooks/use-focus-request';
import {
  useEquipmentProfiles,
  usePlanning,
  useProfile,
  useWeekStart,
} from '../../hooks/use-planning';
import { todayLocal } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';
import { LEGAL_VERSIONS } from '../legal/versions';
import { PlanPreviewView } from '../plan/PlanPreviewView';
import { TemplateChooser } from '../plan/TemplateChooser';
import { WhySimpleContext, WhyText } from '../why/WhySheet';
import {
  OPTIONAL_STEPS,
  STEPS,
  completeAnswers,
  deviceLocale,
  draftFromProfile,
  draftUnits,
  isStep,
  stepOfField,
  type Draft,
  type Step,
} from './answers';
import { MAX_BASELINE_REPS, unfinishedBaselines } from './baseline-input';
import { BaselinesStep, baselineErrorKey } from './BaselinesStep';
import {
  BodyStep,
  EquipmentStep,
  ExperienceStep,
  GoalStep,
  PrioritiesStep,
  ScheduleStep,
  type StepProps,
} from './steps';

export type FlowMode = 'onboarding' | 'replan';

/**
 * Onboarding (ONB-01…12) and re-planning (the same questions, prefilled from the profile): one
 * step per screen, the answers in a draft that is saved after every step so a killed app resumes
 * where it left off (ONB-12), optional steps skippable, "Just let me log" on every step
 * (PLN-15), and the plan preview with "Why?" at the end (ONB-10).
 */
export function OnboardingFlow({
  mode,
  step: rawStep,
  next,
}: {
  mode: FlowMode;
  step: string;
  next?: string | undefined;
}) {
  const { t } = useLingui();
  const run = usePlanning();
  const navigate = useNavigate();
  const profile = useProfile();
  const equipmentProfiles = useEquipmentProfiles();
  const { weekStart } = useWeekStart();
  // Onboarding: the saved draft and the legal state, loaded once (ONB-12). Re-planning: the
  // stored profile. `edits` holds the answers once the user changes anything.
  const [loaded, setLoaded] = useState<{
    readonly draft: Draft;
    readonly savedStep: Step | null;
    readonly legal: boolean;
  } | null>(null);
  const [edits, setEdits] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [summary, focusSummary] = useFocusRequest<HTMLDivElement>();
  const validate = useStepValidation();
  const fieldErrors = useFieldErrors();

  const steps: readonly Step[] =
    mode === 'onboarding' ? STEPS : STEPS.filter((entry) => entry !== 'welcome');
  const step: Step | 'resume' = rawStep === 'resume' || !isStep(rawStep) ? 'resume' : rawStep;
  const path = mode === 'onboarding' ? '/onboarding/$step' : '/plan/setup/$step';
  const search = next ? { next } : {};
  const go = (target: Step, replace = false) =>
    void navigate({ to: path, params: { step: target }, search, replace });

  const defaultEquipment = equipmentProfiles.loaded
    ? equipmentProfiles.value.find((entry) => entry.isDefault)
    : undefined;
  const base: Draft | null =
    mode === 'replan'
      ? profile.loaded && equipmentProfiles.loaded
        ? profile.value
          ? draftFromProfile(profile.value, defaultEquipment)
          : {}
        : null
      : (loaded?.draft ?? null);
  const draft = edits ?? base;
  const legal = mode === 'replan' ? true : (loaded?.legal ?? null);

  useEffect(() => {
    if (mode !== 'onboarding') return undefined;
    let cancelled = false;
    void run(async (planning, deps) => ({
      saved: await planning.loadOnboardingDraft(deps),
      acknowledged: await planning.isLegalAcknowledged(deps, LEGAL_VERSIONS),
    })).then(({ saved, acknowledged }) => {
      if (cancelled) return;
      const savedStep = saved && isStep(saved.step) && saved.step !== 'welcome' ? saved.step : null;
      setLoaded({ draft: saved?.answers ?? {}, savedStep, legal: acknowledged });
    });
    return () => {
      cancelled = true;
    };
  }, [mode, run]);

  // Resume where the user left off; nothing but the legal gate before the acknowledgement.
  if (legal === false && step !== 'welcome')
    return <Navigate to={path} params={{ step: 'welcome' }} search={search} replace />;
  if (legal === true && step === 'resume')
    return (
      <Navigate to={path} params={{ step: loaded?.savedStep ?? 'goal' }} search={search} replace />
    );

  if (draft === null || legal === null || step === 'resume') {
    return (
      <Screen title={mode === 'onboarding' ? t`Welcome to POWR` : t`Set up a plan`}>
        <p className="text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      </Screen>
    );
  }

  const index = steps.indexOf(step);
  const update = (patch: Draft) => {
    setEdits((current) => {
      const before = current ?? base;
      const merged = { ...before, ...patch };
      // A template belongs to one style (PLN-02): a new style starts from its recommended plan.
      if (patch.style !== undefined && patch.style !== before?.style && merged.planOptions) {
        const { templateId: _dropped, ...rest } = merged.planOptions;
        return { ...merged, planOptions: rest };
      }
      return merged;
    });
    setErrors({});
  };
  const save = async (target: Step, answers: Draft) => {
    if (mode === 'onboarding')
      await run((planning, deps) => planning.saveOnboardingDraft(deps, { step: target, answers }));
  };
  const goTo = async (target: Step) => {
    await save(target, draft);
    go(target);
  };
  const showErrors = (found: Record<string, string>) => {
    setErrors(found);
    focusSummary();
  };
  /** Continue: validates the step (with `patch`, the answer just given) and saves the draft. */
  const advance = async (patch?: Draft) => {
    const answers = patch ? { ...draft, ...patch } : draft;
    if (patch) setEdits(answers);
    const found = validate(step, answers);
    if (Object.keys(found).length > 0) return showErrors(found);
    const target = steps[index + 1];
    if (!target) return;
    await save(target, answers);
    go(target);
  };

  /** A default equipment profile for "Just let me log" when none was chosen yet. */
  const fallbackEquipment = async (): Promise<EquipmentProfile> => {
    const result = await run((planning, deps) =>
      planning.equipmentProfileFromPreset(deps, {
        presetId: 'preset.commercial-gym' as PresetId,
        unit: draftUnits(draft).load,
        name: t`My equipment`,
      }),
    );
    if (!result.ok) throw new Error('The commercial gym preset is missing');
    return result.value;
  };

  const justLog = async () => {
    setBusy(true);
    const answers = completeAnswers(
      draft,
      draft.equipment ?? (await fallbackEquipment()),
      deviceLocale(),
    );
    const result = await run((planning, deps) =>
      planning.completeOnboarding(deps, { answers, preview: null }),
    );
    setBusy(false);
    if (result.ok) void navigate({ to: '/session', replace: true });
    else showErrors(fieldErrors(result.error.fields));
  };

  // The page titles of a new plan's steps name the flow: the first run has the same headings.
  const context = mode === 'replan' ? t`Set up a plan` : undefined;
  const header = (
    <StepHeader
      mode={mode}
      index={index}
      total={steps.length}
      onBack={index > 0 ? () => go(steps[index - 1]!) : undefined}
      onJustLog={
        mode === 'onboarding' && step !== 'welcome' && step !== 'preview'
          ? () => void justLog()
          : undefined
      }
      busy={busy}
    />
  );
  const errorSummary =
    Object.keys(errors).length > 0 ? (
      <div ref={summary} tabIndex={-1} role="alert" className="outline-none">
        <Callout tone="danger" title={t`Please check your answers`}>
          <ul className="list-disc pl-5">
            {Object.values(errors).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Callout>
      </div>
    ) : null;
  const props: StepProps = { draft, update, errors, weekStart };
  const novice =
    draft.experience?.trainingAge === 'under6Months' || draft.experience?.rpeFamiliarity === 'none';

  const footer = (primary: ReactNode) => (
    <div className="flex flex-col gap-2 pt-2">
      {primary}
      {OPTIONAL_STEPS.includes(step) ? (
        <Button size="lg" variant="ghost" onClick={() => void goTo(steps[index + 1]!)}>
          <Trans>Skip this step</Trans>
        </Button>
      ) : null}
    </div>
  );
  const continueButton = footer(
    <Button variant="primary" size="lg" disabled={busy} onClick={() => void advance()}>
      <Trans>Continue</Trans>
    </Button>,
  );

  switch (step) {
    case 'welcome':
      return (
        <WelcomeStep
          returning={profile.loaded && profile.value !== undefined}
          errors={errors}
          errorSummary={errorSummary}
          busy={busy}
          onAccept={async (choice) => {
            setBusy(true);
            await run((planning, deps) => planning.acknowledgeLegal(deps, LEGAL_VERSIONS));
            setLoaded((current) => ({
              draft: current?.draft ?? {},
              savedStep: current?.savedStep ?? null,
              legal: true,
            }));
            setBusy(false);
            if (profile.loaded && profile.value) void navigate({ to: next ?? '/', replace: true });
            else if (choice === 'log') await justLog();
            else await goTo('goal');
          }}
          onMissing={showErrors}
        />
      );
    case 'goal':
      return (
        <Screen title={t`Your goal`} context={context}>
          {header}
          {errorSummary}
          <GoalStep {...props} />
          {continueButton}
        </Screen>
      );
    case 'experience':
      return (
        <Screen title={t`Your experience`} context={context}>
          {header}
          {errorSummary}
          <ExperienceStep {...props} />
          {continueButton}
        </Screen>
      );
    case 'schedule':
      return (
        <Screen title={t`Your week`} context={context}>
          {header}
          {errorSummary}
          <ScheduleStep {...props} />
          {continueButton}
        </Screen>
      );
    case 'body':
      return (
        <Screen title={t`Units and body`} context={context}>
          {header}
          {errorSummary}
          <BodyStep {...props} />
          {continueButton}
        </Screen>
      );
    case 'equipment':
      return (
        <Screen title={t`Your equipment`} context={context}>
          {header}
          {errorSummary}
          <EquipmentStep {...props} onPicked={(equipment) => void advance({ equipment })} />
          {draft.equipment ? continueButton : null}
        </Screen>
      );
    case 'priorities':
      return (
        <Screen title={t`Priorities`} context={context}>
          {header}
          {errorSummary}
          <PrioritiesStep {...props} />
          {continueButton}
        </Screen>
      );
    case 'baselines':
      return (
        <WhySimpleContext value={novice}>
          <Screen title={t`Your current lifts`} context={context}>
            {header}
            {errorSummary}
            <BaselinesStep {...props} />
            {continueButton}
          </Screen>
        </WhySimpleContext>
      );
    case 'preview':
      return (
        <WhySimpleContext value={novice}>
          <PreviewStep
            mode={mode}
            header={header}
            draft={draft}
            weekStart={weekStart}
            novice={novice}
            update={update}
            goTo={(target) => void goTo(target)}
            onAccepted={(destination) => void navigate({ to: destination, replace: true })}
          />
        </WhySimpleContext>
      );
    default:
      return assertNever(step);
  }
}

function StepHeader({
  mode,
  index,
  total,
  onBack,
  onJustLog,
  busy,
}: {
  mode: FlowMode;
  index: number;
  total: number;
  onBack: (() => void) | undefined;
  onJustLog: (() => void) | undefined;
  busy: boolean;
}) {
  const { t } = useLingui();
  const position = index + (mode === 'onboarding' ? 0 : 1);
  const count = total - (mode === 'onboarding' ? 1 : 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onBack ? (
          <Button variant="ghost" onClick={onBack} className="px-2">
            <ArrowLeft aria-hidden="true" />
            <Trans>Back</Trans>
          </Button>
        ) : (
          <span />
        )}
        {onJustLog ? (
          <Button variant="ghost" disabled={busy} onClick={onJustLog} className="text-info">
            <Trans>Just let me log</Trans>
          </Button>
        ) : null}
      </div>
      <p className="text-sm font-semibold text-fg-muted">
        <Trans>
          Step {position} of {count}
        </Trans>
      </p>
      <progress
        className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-surface-raised [&::-webkit-progress-value]:bg-primary"
        max={count}
        value={position}
        aria-label={t`Setup progress`}
      />
    </div>
  );
}

/** ONB-01: what POWR is, the privacy summary (≤ 3 sentences), the disclaimer, age; nothing is stored before. */
function WelcomeStep({
  returning,
  errors,
  errorSummary,
  busy,
  onAccept,
  onMissing,
}: {
  returning: boolean;
  errors: Record<string, string>;
  errorSummary: ReactNode;
  busy: boolean;
  onAccept: (choice: 'plan' | 'log') => Promise<void>;
  onMissing: (errors: Record<string, string>) => void;
}) {
  const { t } = useLingui();
  const [disclaimer, setDisclaimer] = useState(false);
  const [age, setAge] = useState(false);
  const accept = (choice: 'plan' | 'log') => {
    const missing: Record<string, string> = {};
    if (!disclaimer)
      missing['disclaimer'] = t`Tick that you have read the health notice and the privacy summary.`;
    if (!age) missing['age'] = t`Confirm that you are 16 or older.`;
    if (Object.keys(missing).length > 0) onMissing(missing);
    else void onAccept(choice);
  };
  return (
    <Screen title={returning ? t`We updated our notices` : t`Welcome to POWR`}>
      {errorSummary}
      <Card>
        <p className="text-lg font-semibold">
          <Trans>
            Your training planner and log. It works offline, needs no account, and your data stays
            on this phone.
          </Trans>
        </p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Privacy in short</Trans>
        </h2>
        <p>
          <Trans>
            Everything you enter is stored only on this device. We never receive it: there is no
            account, analytics or tracking. Only you can export it, as a backup file.
          </Trans>
        </p>
        <Link
          to="/legal/$page"
          params={{ page: 'privacy' }}
          className="min-h-target-min font-semibold text-info underline"
        >
          <Trans>Read the full privacy notice</Trans>
        </Link>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Health and safety</Trans>
        </h2>
        <p>
          <Trans>
            POWR gives general training suggestions, not medical advice. Check with a doctor before
            you start or change training, especially with a health condition, an injury or a
            pregnancy. Stop and get help if you feel chest pain, dizziness or sharp pain. You decide
            what you do with the suggestions.
          </Trans>
        </p>
        <Link
          to="/legal/$page"
          params={{ page: 'disclaimer' }}
          className="min-h-target-min font-semibold text-info underline"
        >
          <Trans>Read the full health notice</Trans>
        </Link>
      </Card>
      <Card className="gap-1">
        <CheckRow
          label={t`I have read the health notice and the privacy summary.`}
          checked={disclaimer}
          onChange={setDisclaimer}
        />
        {errors['disclaimer'] ? (
          <p className="px-2 font-medium text-danger">{errors['disclaimer']}</p>
        ) : null}
        <CheckRow label={t`I am 16 or older.`} checked={age} onChange={setAge} />
        {errors['age'] ? <p className="px-2 font-medium text-danger">{errors['age']}</p> : null}
      </Card>
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => accept('plan')}>
          {returning ? <Trans>Continue</Trans> : <Trans>Set up my plan</Trans>}
        </Button>
        {returning ? null : (
          <Button size="lg" disabled={busy} onClick={() => accept('log')}>
            <Trans>Just let me log</Trans>
          </Button>
        )}
      </div>
    </Screen>
  );
}

/** ONB-10: generate, explain, adjust and accept (or accept and open the editor). */
function PreviewStep({
  mode,
  header,
  draft,
  weekStart,
  novice,
  update,
  goTo,
  onAccepted,
}: {
  mode: FlowMode;
  header: ReactNode;
  draft: Draft;
  weekStart: IsoWeekday;
  novice: boolean;
  update: (patch: Draft) => void;
  goTo: (step: Step) => void;
  onAccepted: (destination: '/plan' | '/plan/edit') => void;
}) {
  const { t } = useLingui();
  const run = usePlanning();
  const [generated, setGenerated] = useState<{
    readonly key: string;
    readonly result: { ok: true; value: PlanPreview } | { ok: false; error: PlanPreviewError };
  } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fieldErrors = useFieldErrors();
  const [busy, setBusy] = useState(false);
  const equipment = draft.equipment;
  const answers: OnboardingAnswers | null = equipment
    ? completeAnswers(draft, equipment, deviceLocale())
    : null;
  // Regenerate when the answers change by value (the JSON is the key) or the week start changes.
  const key = answers ? `${weekStart}:${JSON.stringify(answers)}` : null;
  const result = generated && generated.key === key ? generated.result : null;

  useEffect(() => {
    if (key === null) return undefined;
    let cancelled = false;
    const input = JSON.parse(key.slice(key.indexOf(':') + 1)) as OnboardingAnswers;
    void run((planning, deps) =>
      planning.generatePlanPreview(deps, {
        answers: input,
        // PLN-02 template and PLN-08 block length, as chosen in this preview.
        options: {
          weekStartsOn: Number(key.slice(0, key.indexOf(':'))) as IsoWeekday,
          ...input.planOptions,
        },
        startTimes: input.startTimes,
      }),
    ).then((next) => {
      if (!cancelled) setGenerated({ key, result: next });
    });
    return () => {
      cancelled = true;
    };
  }, [key, run]);

  const accept = async (destination: '/plan' | '/plan/edit') => {
    if (!answers || !result?.ok) return;
    setBusy(true);
    const completed = await run((planning, deps) =>
      planning.completeOnboarding(deps, { answers, preview: result.value }),
    );
    setBusy(false);
    if (completed.ok) onAccepted(destination);
    else {
      const fields = completed.error.fields;
      setProblem(Object.values(fieldErrors(fields)).join(' '));
    }
  };

  const inputFix = (fix: PlanFix) => {
    if (fix.kind === 'sessionMinutes' && draft.schedule)
      update({ schedule: { ...draft.schedule, sessionMinutes: fix.minutes } });
    else if (fix.kind === 'addDay') goTo('schedule');
  };

  // PLN-02 and PLN-08: the choices live in the draft, so going back to a step keeps them.
  const options = draft.planOptions ?? {};
  const chooseTemplate = (templateId: TemplateId | null) => {
    const { templateId: _previous, ...rest } = options;
    update({ planOptions: templateId ? { ...rest, templateId } : rest });
  };
  const chooseWeeks = (weeks: number) => {
    const { accumulationWeeks: _previous, ...rest } = options;
    const defaultWeeks = result?.ok ? result.value.blockLength.defaultWeeks : null;
    update({ planOptions: weeks === defaultWeeks ? rest : { ...rest, accumulationWeeks: weeks } });
  };
  const templateControl = answers ? (
    <TemplateChooser answers={answers} selected={options.templateId} onSelect={chooseTemplate} />
  ) : null;

  return (
    <Screen title={t`Your plan`} context={mode === 'replan' ? t`Set up a plan` : undefined}>
      {header}
      {!equipment ? (
        <Callout tone="warning" title={t`Equipment missing`}>
          <Button onClick={() => goTo('equipment')}>
            <Trans>Choose your equipment</Trans>
          </Button>
        </Callout>
      ) : result === null ? (
        <output className="block text-fg-muted">
          <Trans>Building your plan…</Trans>
        </output>
      ) : !result.ok ? (
        <Callout tone="danger" title={t`No plan fits these answers yet`}>
          {result.error.why ? (
            <p>
              <WhyText why={result.error.why} />
            </p>
          ) : (
            <p>
              <Trans>Pick 2 to 6 training days.</Trans>
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {options.templateId ? (
              <Button variant="primary" onClick={() => chooseTemplate(null)}>
                <Trans>Use the recommended plan</Trans>
              </Button>
            ) : null}
            <Button onClick={() => goTo('equipment')}>
              <Trans>Change equipment</Trans>
            </Button>
            <Button onClick={() => goTo('goal')}>
              <Trans>Change goal</Trans>
            </Button>
            <Button onClick={() => goTo('schedule')}>
              <Trans>Change days</Trans>
            </Button>
          </div>
          {templateControl}
        </Callout>
      ) : (
        <>
          <PlanPreviewView
            preview={result.value}
            equipment={equipment}
            novice={novice}
            onInputFix={inputFix}
            templateControl={templateControl}
            onBlockLength={chooseWeeks}
          />
          {problem ? <Callout tone="danger">{problem}</Callout> : null}
          <Card>
            <h2 className="text-lg font-bold">
              <Trans>Not quite right?</Trans>
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => goTo('schedule')}>
                <Trans>Change days or time</Trans>
              </Button>
              <Button onClick={() => goTo('goal')}>
                <Trans>Change goal</Trans>
              </Button>
              <Button onClick={() => goTo('equipment')}>
                <Trans>Change equipment</Trans>
              </Button>
            </div>
          </Card>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={() => void accept('/plan')}
            >
              <Trans>Accept plan</Trans>
            </Button>
            <Button size="lg" disabled={busy} onClick={() => void accept('/plan/edit')}>
              <Trans>Accept and edit</Trans>
            </Button>
            {mode === 'replan' ? (
              <p className="text-sm text-fg-muted">
                <Trans>
                  Accepting replaces your current plan from today; logged training stays.
                </Trans>
              </p>
            ) : null}
          </div>
        </>
      )}
    </Screen>
  );
}

/**
 * Step completeness (the use cases re-check every range when the answers are stored). A hook, so
 * the Lingui macro sees `t` from `useLingui()`. Also used by Settings to change one answer
 * (SET-08).
 */
export function useStepValidation() {
  const { t } = useLingui();
  const labels = useLabels();
  return (step: Step, draft: Draft): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (step === 'baselines') {
      // An entry started but not complete is pointed out, not dropped (WCAG 3.3.1).
      const unit = draftUnits(draft).load;
      for (const { exerciseId, problems } of unfinishedBaselines(
        draft,
        unit,
        todayLocal() as LocalDate,
      )) {
        const name = labels.exercise(exerciseId);
        if (problems.includes('load'))
          errors[baselineErrorKey(exerciseId, 'load')] =
            t`${name}: enter the weight in ${unit}, or choose "Not now".`;
        if (problems.includes('reps'))
          errors[baselineErrorKey(exerciseId, 'reps')] =
            t`${name}: enter the reps as a whole number from 1 to ${MAX_BASELINE_REPS}.`;
        if (problems.includes('date'))
          errors[baselineErrorKey(exerciseId, 'date')] =
            t`${name}: the date cannot be in the future. Leave it empty if you are not sure.`;
      }
    }
    if (step === 'goal' && !draft.style) errors['style'] = t`Choose what you want from training.`;
    if (step === 'experience') {
      if (!draft.experience?.trainingAge)
        errors['trainingAge'] = t`Choose how long you have trained.`;
      if (!draft.experience?.timeOff)
        errors['timeOff'] = t`Choose when you last trained regularly.`;
      if (!draft.experience?.rpeFamiliarity)
        errors['rpeFamiliarity'] = t`Choose how familiar RIR and RPE are to you.`;
    }
    if (step === 'schedule') {
      const days = draft.schedule?.weekdays.length ?? 0;
      if (days < 2 || days > 6) errors['weekdays'] = t`Pick between 2 and 6 training days.`;
    }
    if (step === 'body') {
      const year = draft.birthYear;
      if (year !== undefined && year !== null && (year < 1900 || year > 2100))
        errors['birthYear'] = t`Enter a four-digit year, for example 1990, or leave it empty.`;
      if (draft.bodyweight && !(draft.bodyweight.value > 0))
        errors['bodyweight'] = t`Enter your bodyweight as a positive number, or leave it empty.`;
    }
    if (step === 'equipment' && !draft.equipment)
      errors['equipment'] = t`Choose where you train, or start from an empty list.`;
    return errors;
  };
}

/** The use case's rejected fields, in words, each pointing to its step (also SET-08). */
export function useFieldErrors() {
  const { t } = useLingui();
  return (fields: readonly string[]): Record<string, string> =>
    Object.fromEntries(
      fields.map((field) => {
        const step = stepOfField(field);
        const where =
          step === 'schedule'
            ? t`Check your training days and session time.`
            : step === 'equipment'
              ? t`Give your equipment a name.`
              : step === 'body'
                ? t`Check your birth year and bodyweight.`
                : step === 'priorities'
                  ? t`Pick at most three priority muscles.`
                  : step === 'baselines'
                    ? t`Check the weights and reps of your lifts.`
                    : t`Check your goal.`;
        return [field, where];
      }),
    );
}
