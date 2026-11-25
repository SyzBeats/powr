import { useLingui as useLinguiRuntime } from '@lingui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from '@tanstack/react-router';
import { CircleHelp } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { paramsUsed, type Explanation, type ParamRef } from '@powr/domain/explain';

import { Badge } from '#ui/badge';
import { cn } from '#ui/cn';
import { Sheet } from '#ui/sheet';

import { formatMass } from '../../i18n/format';
import { useLabels } from '../labels';
import { useEffortWords } from '../settings/effort';
import { CitationText, useCitations, useSourceName, type Citation } from './citations';
import { useEvidenceLabels } from './evidence';
import { setFacts, whyValues, type WhyNames } from './format';
import { WHY_MESSAGES } from './messages';
import { useParamLabel } from './param-labels';

/** Plan days for day and slot names in explanations (set by the plan screens). */
export const WhyNamesContext = createContext<WhyNames>({});
/** Novices see the plain-language text first (NFR-USE-03). */
export const WhySimpleContext = createContext(false);

/** The message of one explanation, plain-language first where one exists and wanted. */
export function WhyText({ why, simple }: { why: Explanation; simple?: boolean }) {
  const { i18n } = useLinguiRuntime();
  const labels = useLabels();
  const names = useContext(WhyNamesContext);
  const wantSimple = useContext(WhySimpleContext);
  const message = WHY_MESSAGES[why.rule];
  const descriptor = (simple ?? wantSimple) && message.simple ? message.simple : message.full;
  return <>{i18n._({ ...descriptor, values: whyValues(why, labels, names) })}</>;
}

/**
 * "Why?" button and sheet (PRG-09, NFR-USE-04): renders an `Explanation` tree, its message, the
 * registry parameters with their label, evidence label, origin and a "preliminary value" flag when
 * unverified (LEG-05, §8.6.4), each linked to its entry in "How POWR decides", the steps it was
 * built from, and the full citations of its sources (TD-33, M5s; labels and citations are lazy
 * chunks loaded when a sheet opens). Reused by the session screen (M3). The visible label stays
 * in the accessible name (WCAG 2.5.3).
 */
export function WhyButton({
  why,
  subject,
  className,
  children,
}: {
  why: Explanation;
  /** Names what the explanation is about, for the accessible name and the sheet title. */
  subject?: string;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={subject ? t`Why? ${subject}` : undefined}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex min-h-target min-w-target items-center justify-center gap-1 rounded-xl px-2 font-semibold text-info underline-offset-4 hover:underline',
          className,
        )}
      >
        <CircleHelp aria-hidden="true" className="size-5 shrink-0" />
        {children ?? <Trans>Why?</Trans>}
      </button>
      <WhySheet why={why} open={open} onOpenChange={setOpen} subject={subject} />
    </>
  );
}

function WhySheet({
  why,
  open,
  onOpenChange,
  subject,
}: {
  why: Explanation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: string | undefined;
}) {
  const { t } = useLingui();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={subject ? t`Why: ${subject}` : t`Why?`}
      closeLabel={t`Close`}
    >
      {open ? <WhyBody why={why} /> : null}
    </Sheet>
  );
}

/** The whole explanation: message, details for novices behind a toggle, steps, parameters. */
function WhyBody({ why }: { why: Explanation }) {
  const simple = useContext(WhySimpleContext);
  const hasSimple = WHY_MESSAGES[why.rule].simple !== undefined;
  const params = paramsUsed(why);
  // A root that repeats its first step (the plan's "why" is the template choice) shows it once.
  const steps = why.children.filter(
    (child) => child.rule !== why.rule || JSON.stringify(child.args) !== JSON.stringify(why.args),
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg">
        <WhyText why={why} />
      </p>
      {simple && hasSimple ? (
        <details className="rounded-xl bg-surface-raised p-3">
          <summary className="min-h-target-min cursor-pointer font-semibold">
            <Trans>In technical terms</Trans>
          </summary>
          <p className="pt-2">
            <WhyText why={why} simple={false} />
          </p>
        </details>
      ) : null}
      <SetList why={why} />
      {steps.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">
            <Trans>How it was worked out</Trans>
          </h3>
          <Steps steps={steps} depth={0} />
        </section>
      ) : null}
      {params.length > 0 ? <BasedOn params={params} /> : null}
    </div>
  );
}

/** The parameters with their labels and evidence, then the full citations of their sources. */
function BasedOn({ params }: { params: readonly ParamRef[] }) {
  const citations = useCitations();
  const sourceName = useSourceName(citations);
  const cited = [...new Set(params.flatMap((param) => param.sources))]
    .map((id) => citations?.get(id))
    .filter((citation): citation is Citation => citation !== undefined)
    .toSorted((a, b) => sourceName(a.id).localeCompare(sourceName(b.id)));
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">
          <Trans>Based on</Trans>
        </h3>
        <ul className="flex flex-col gap-2">
          {params.map((param) => (
            <ParamItem key={param.id} param={param} sourceName={sourceName} />
          ))}
        </ul>
      </section>
      {cited.length > 0 ? (
        <section className="flex flex-col gap-2" data-testid="why-sources">
          <h3 className="font-semibold">
            <Trans>Sources</Trans>
          </h3>
          <ol className="flex list-decimal flex-col gap-3 pl-5">
            {cited.map((citation) => (
              <li key={citation.id}>
                <CitationText citation={citation} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}

function Steps({ steps, depth }: { steps: readonly Explanation[]; depth: number }) {
  return (
    <ul className="flex flex-col gap-2">
      {steps.map((step, index) => (
        // Explanations carry no IDs; their position in the tree is stable for one render.
        <li key={`${step.rule}-${index}`} className="rounded-xl bg-surface-raised p-3">
          <p>
            <WhyText why={step} />
          </p>
          {step.children.length > 0 && depth < 2 ? (
            <details className="pt-1">
              <summary className="min-h-target-min cursor-pointer text-sm font-semibold">
                <Trans>Details</Trans>
              </summary>
              <div className="pt-2">
                <Steps steps={step.children} depth={depth + 1} />
              </div>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SetList({ why }: { why: Explanation }) {
  const effortWords = useEffortWords();
  const sets = setFacts(why);
  if (sets.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 tabular">
      {sets.map((set) => {
        const effort = set.rir === null ? '' : ` @ ${effortWords.value(set.rir)}`;
        return (
          <li key={set.index}>
            <Trans>
              Set {set.index + 1}: {set.load ? formatMass(set.load.value, set.load.unit) : '–'} ×{' '}
              {set.reps ?? '–'}
              {effort}
            </Trans>
          </li>
        );
      })}
    </ul>
  );
}

function ParamItem({ param, sourceName }: { param: ParamRef; sourceName: (id: string) => string }) {
  const { t } = useLingui();
  const evidence = useEvidenceLabels();
  const label = useParamLabel();
  const origin =
    param.origin === 'user'
      ? t`Your setting`
      : param.origin === 'exercise'
        ? t`Your setting for this exercise`
        : param.origin === 'variant'
          ? t`Default for your situation`
          : t`Default`;
  const name = label(param.id);
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-border p-3">
      <span className="font-medium">{name}</span>
      <span className="flex flex-wrap gap-2">
        {evidence.of(param.evidence).map((text) => (
          <Badge key={text} tone="info" icon={null}>
            {text}
          </Badge>
        ))}
        {param.verified ? null : <Badge tone="warning">{t`Preliminary value`}</Badge>}
        <Badge tone="neutral" icon={null}>
          {origin}
        </Badge>
      </span>
      {param.sources.length > 0 ? (
        <span className="text-sm text-fg-muted">
          <Trans>Sources: {param.sources.map(sourceName).join('; ')}</Trans>
        </span>
      ) : null}
      <HowDecidesLink paramId={param.id} label={t`How POWR decides: ${name}`} />
    </li>
  );
}

/**
 * The parameter's entry in "How POWR decides" (LEG-05, TD-33). An in-app navigation when a router
 * is there; the sheet also renders without one (component previews), then the link is a plain
 * same-origin link.
 */
function HowDecidesLink({ paramId, label }: { paramId: string; label: string }) {
  const router = useRouter({ warn: false });
  const hash = `param-${paramId}`;
  return (
    <a
      href={`/legal/how-powr-decides#${hash}`}
      aria-label={label}
      onClick={(event) => {
        if (!router || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey)
          return;
        event.preventDefault();
        void router.navigate({
          to: '/legal/$page',
          params: { page: 'how-powr-decides' },
          hash,
        });
      }}
      className="flex min-h-target-min items-center text-sm font-semibold text-info underline underline-offset-4"
    >
      <Trans>How POWR decides</Trans>
    </a>
  );
}
