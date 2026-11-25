import { Trans, useLingui } from '@lingui/react/macro';
import { useLocation } from '@tanstack/react-router';
import { use, useEffect, useState, type ReactNode } from 'react';

import { ENGINE_VERSION } from '@powr/domain';
import type { ParamId, RuleSet } from '@powr/domain/rules';

import { Badge } from '#ui/badge';

import { useRegistryInfo } from '../../../hooks/use-settings';
import { CitationText, useCitations, useSourceName, type Citation } from '../../why/citations';
import { EVIDENCE_LABELS, useEvidenceLabels } from '../../why/evidence';
import { useParamLabel } from '../../why/param-labels';
import { Section } from './parts';

/** The areas of the registry, by parameter-ID prefix, in reading order (LEG-05). */
const AREAS = [
  'load',
  'volume',
  'progression',
  'deload',
  'rest',
  'warmup',
  'session',
  'planning',
  'monitoring',
  'bodyweight',
  'scoring',
  'motivation',
  'ranking',
] as const;
type Area = (typeof AREAS)[number];

function areaOf(id: string): Area {
  if (id.startsWith('session.rest.')) return 'rest';
  if (id.startsWith('session.warmup.')) return 'warmup';
  const head = id.slice(0, id.indexOf('.'));
  return (AREAS as readonly string[]).includes(head) ? (head as Area) : 'session';
}

/**
 * "How POWR decides" (LEG-05, PRG-09): the engine in plain language, the evidence labels, what a
 * preliminary value is, the registry version and why POWR suggests and never decides; then every
 * area with its values, generated from the shipped registry (labels, evidence, sources), so it
 * cannot drift from what the app uses. Each value has an anchor (`#param-<id>`) the "Why?" sheet
 * links to. Its words are in the lazy `legal` catalog.
 */
export function HowPowrDecidesText({ parameters }: { parameters: Promise<RuleSet> }) {
  const rules = use(parameters);
  const { rulesVersion, contentVersion } = useRegistryInfo();
  const citations = useCitations();
  const evidence = useEvidenceLabels();
  const engine = ENGINE_VERSION;
  const all = Object.values(rules);
  const preliminary = all.filter((param) => !param.meta.verified).length;
  const total = all.length;
  return (
    <>
      <Section title={<Trans>POWR suggests; you decide</Trans>}>
        <p>
          <Trans>
            POWR pre-fills every weight, rep target and effort, builds your plan and points out what
            might need attention. It never decides for you: you confirm or change each suggestion,
            and a change is never treated as a mistake. Your sleep, stress, technique and how you
            feel on the day matter more than any formula.
          </Trans>
        </p>
        <p>
          <Trans>
            POWR does not diagnose anything and does not predict injuries. It describes training,
            not health.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Where the numbers come from</Trans>}>
        <p>
          <Trans>
            Every number POWR uses is a value in one versioned list, the rules registry. Each value
            names its evidence and its sources, so any suggestion can be traced back. Where research
            gives a clear answer, POWR uses it. Where research is thin, it uses an established
            coaching convention, and where neither gives a number, its own estimate, labelled as
            such.
          </Trans>
        </p>
        <p>
          <Trans>
            The "Why?" button next to a suggestion shows the rule in words, the sets it used, how it
            was worked out and the values it was based on, each with its evidence label, its sources
            and a link to its entry below.
          </Trans>
        </p>
      </Section>

      <Section id="evidence-labels" title={<Trans>What the evidence labels mean</Trans>}>
        <dl className="flex flex-col gap-3">
          {EVIDENCE_LABELS.map((label) => (
            <div key={label} className="flex flex-col gap-1">
              <dt>
                <Badge tone="info" icon={null}>
                  {evidence.name(label)}
                </Badge>
              </dt>
              <dd className="pl-1">
                <LabelMeaning label={label} />
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="preliminary" title={<Trans>Preliminary values</Trans>}>
        <p>
          <Trans>
            A value marked "Preliminary value" has not yet been checked against the original
            publication, comes from a study that is not yet peer-reviewed (a preprint), or is a
            design choice of POWR where research only gives a direction. It may change after a
            review; any change comes with a new registry version. {preliminary} of the {total}{' '}
            values are preliminary in this version.
          </Trans>
        </p>
      </Section>

      <Section id="versions" title={<Trans>Versions in this app</Trans>}>
        <ul className="flex flex-col gap-1 tabular" data-testid="registry-versions">
          <li>
            <Trans>Rules registry: {rulesVersion}</Trans>
          </li>
          <li>
            <Trans>Exercise library and templates: {contentVersion}</Trans>
          </li>
          <li>
            <Trans>Calculation engine: {engine}</Trans>
          </li>
        </ul>
        <p>
          <Trans>
            Your plans and suggestions store the versions they were made with, so a later update can
            be traced.
          </Trans>
        </p>
      </Section>

      {AREAS.map((area) => (
        <AreaSection
          key={area}
          area={area}
          params={all.filter((param) => areaOf(param.id) === area)}
          citations={citations}
        />
      ))}

      <Section id="nutrition" title={<Trans>Nutrition targets</Trans>}>
        <p>
          <Trans>
            POWR does not set calorie or protein targets in this version. Bodyweight goals only
            describe the weekly change that research considers sensible.
          </Trans>
        </p>
      </Section>
    </>
  );
}

function LabelMeaning({ label }: { label: (typeof EVIDENCE_LABELS)[number] }) {
  switch (label) {
    case 'strong':
      return (
        <Trans>
          Meta-analyses, systematic reviews, position stands and trials repeated in trained people.
        </Trans>
      );
    case 'limited':
      return (
        <Trans>
          Single trials, observational studies, narrative reviews and studies not yet peer-reviewed.
          Useful, but less certain.
        </Trans>
      );
    case 'convention':
      return (
        <Trans>
          What experienced coaches do, from surveys and expert agreement, where studies are missing.
        </Trans>
      );
    case 'estimate':
      return (
        <Trans>
          A value or model POWR chose where research gives only a direction. Treat it as a starting
          point.
        </Trans>
      );
    case 'official':
      return <Trans>Official documents, for example the federation's scoring formulas.</Trans>;
    default:
      return null;
  }
}

/** One area: what it does in plain words, then its values with evidence and sources. */
function AreaSection({
  area,
  params,
  citations,
}: {
  area: Area;
  params: readonly RuleSet[ParamId][];
  citations: ReadonlyMap<string, Citation> | null;
}) {
  const { t } = useLingui();
  const label = useParamLabel();
  const evidence = useEvidenceLabels();
  const sourceName = useSourceName(citations);
  // A link from a "Why?" sheet (#param-<id>) opens the area that holds the value and shows it.
  const target = useLocation({ select: (location) => location.hash });
  const holdsTarget = params.some((param) => `param-${param.id}` === target);
  const [open, setOpen] = useState(holdsTarget);
  useEffect(() => {
    if (!holdsTarget) return;
    const element = document.getElementById(target);
    element?.scrollIntoView({ block: 'start' });
    element?.focus({ preventScroll: true });
  }, [holdsTarget, target]);
  if (params.length === 0) return null;
  const sources = [...new Set(params.flatMap((param) => param.meta.sources))]
    .map((id) => citations?.get(id))
    .filter((citation): citation is Citation => citation !== undefined)
    .toSorted((a, b) => sourceName(a.id).localeCompare(sourceName(b.id)));
  const count = params.length;
  return (
    <Section id={`area-${area}`} title={<AreaTitle area={area} />}>
      <p>
        <AreaText area={area} />
      </p>
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="rounded-xl bg-surface-raised p-3"
      >
        <summary className="min-h-target-min cursor-pointer font-semibold">
          <Trans>The values behind it ({count})</Trans>
        </summary>
        <ul className="flex flex-col gap-2 pt-2">
          {params.map((param) => (
            <li
              key={param.id}
              id={`param-${param.id}`}
              tabIndex={-1}
              className="flex scroll-mt-20 flex-col gap-1 rounded-xl border border-border p-3 outline-offset-2"
            >
              <span className="font-medium">{label(param.id)}</span>
              <span className="flex flex-wrap gap-2">
                {evidence.of(param.meta.evidence).map((text) => (
                  <Badge key={text} tone="info" icon={null}>
                    {text}
                  </Badge>
                ))}
                {param.meta.verified ? null : <Badge tone="warning">{t`Preliminary value`}</Badge>}
              </span>
              <span className="text-sm text-fg-muted">
                <Trans>Sources: {param.meta.sources.map(sourceName).join('; ')}</Trans>
              </span>
            </li>
          ))}
        </ul>
        {sources.length > 0 ? (
          <>
            <h3 className="pt-3 font-semibold">
              <Trans>Sources</Trans>
            </h3>
            <ol className="flex list-decimal flex-col gap-3 pt-2 pl-5">
              {sources.map((citation) => (
                <li key={citation.id}>
                  <CitationText citation={citation} />
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </details>
    </Section>
  );
}

function AreaTitle({ area }: { area: Area }): ReactNode {
  switch (area) {
    case 'load':
      return <Trans>Estimated 1-rep max and strength trends</Trans>;
    case 'volume':
      return <Trans>Counting your training volume</Trans>;
    case 'progression':
      return <Trans>Progression: when the weight goes up</Trans>;
    case 'deload':
      return <Trans>Lighter weeks and breaks</Trans>;
    case 'rest':
      return <Trans>Rest times</Trans>;
    case 'warmup':
      return <Trans>Warm-up sets</Trans>;
    case 'session':
      return <Trans>Tempo, techniques and session length</Trans>;
    case 'planning':
      return <Trans>Building your plan</Trans>;
    case 'monitoring':
      return <Trans>Check-ins and readiness</Trans>;
    case 'bodyweight':
      return <Trans>Bodyweight trend</Trans>;
    case 'scoring':
      return <Trans>Powerlifting points</Trans>;
    case 'motivation':
      return <Trans>Streaks</Trans>;
    case 'ranking':
      return <Trans>Ranking exercises for a muscle</Trans>;
    default:
      return null;
  }
}

function AreaText({ area }: { area: Area }): ReactNode {
  switch (area) {
    case 'load':
      return (
        <Trans>
          From the weight, reps and effort of your sets, POWR estimates the most you could lift once
          (your estimated 1-rep max). Heavy, hard sets count most. The trend is smoothed, because
          single sessions vary by several percent; a change is only called likely real once it is
          larger than that day-to-day variation and lasts for a few sessions.
        </Trans>
      );
    case 'volume':
      return (
        <Trans>
          Volume is counted as hard sets per muscle per week: sets close to failure count fully, and
          an exercise counts fully for its main muscles and in part for helping muscles. Weekly
          targets sit inside a range from research, with fewer sets for novices and more for muscles
          you chose as priorities.
        </Trans>
      );
    case 'progression':
      return (
        <Trans>
          Assistance exercises add reps until the top of the range, then a small weight step (double
          progression). Main lifts use your estimated 1-rep max and the target effort; novices add a
          fixed step each session. Steps follow your equipment and your level.
        </Trans>
      );
    case 'deload':
      return (
        <Trans>
          After a block of training weeks comes a lighter week with fewer sets and a little more in
          reserve. POWR offers it earlier when several signs suggest it. After a break, the first
          sessions ease back in.
        </Trans>
      );
    case 'rest':
      return (
        <Trans>
          Rest times follow the kind of set: longer for heavy strength work, shorter for isolation
          exercises. You can change each one in Settings, Workout, Rest times.
        </Trans>
      );
    case 'warmup':
      return (
        <Trans>
          Warm-up sets ramp up to your first working weight: more steps before heavy sets, fewer for
          exercises whose muscles are already warm. You can switch them off in Settings.
        </Trans>
      );
    case 'session':
      return (
        <Trans>
          The default tempo, how special techniques such as drop sets count, and how long a session
          will take.
        </Trans>
      );
    case 'planning':
      return (
        <Trans>
          Your plan is built from a template for your goal, days and equipment, with exercises
          ranked for each muscle, sets per exercise and the length of a training block. It is
          checked against your time per session.
        </Trans>
      );
    case 'monitoring':
      return (
        <Trans>
          The optional check-in compares today with your usual sleep, energy and soreness. On a low
          day POWR can offer a lighter session; you choose.
        </Trans>
      );
    case 'bodyweight':
      return (
        <Trans>
          Daily weigh-ins vary with water and food, so POWR shows a smoothed trend and a weekly
          rate, and compares it with ranges research considers sensible for your goal.
        </Trans>
      );
    case 'scoring':
      return (
        <Trans>
          Points such as IPF GL and DOTS compare totals across bodyweights. They are worked out from
          the official formulas.
        </Trans>
      );
    case 'motivation':
      return (
        <Trans>
          A week counts for your streak when you did the sessions you planned. Breaks pause it, they
          never break it.
        </Trans>
      );
    case 'ranking':
      return (
        <Trans>
          When you pick a muscle, exercises are ranked by how much they train it, how strong the
          evidence is, and how well they suit heavy loading.
        </Trans>
      );
    default:
      return null;
  }
}
