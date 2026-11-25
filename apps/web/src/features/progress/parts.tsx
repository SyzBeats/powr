import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ExposureSets } from '@powr/domain/analytics';

import { buttonClass } from '#ui/button';
import { Sheet } from '#ui/sheet';

import { formatLocalDate } from '../../i18n/format';
import { useSummaryWords } from '../session/past/parts';

/** A polite loading line (the screens keep their heading while data arrives). */
export function Loading({ children }: { children?: ReactNode }) {
  return (
    <output className="block text-fg-muted">
      {children ?? <Trans>Loading your training…</Trans>}
    </output>
  );
}

/** The row look of the hub's links: a large target with an icon, the name and a hint. */
export const rowClass =
  'flex min-h-target-lg w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left';

export function RowContent({
  icon: Icon,
  title,
  hint,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <>
      {Icon ? <Icon aria-hidden="true" className="size-6 shrink-0 text-info" /> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        {hint ? <span className="text-sm text-fg-muted">{hint}</span> : null}
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
    </>
  );
}

/**
 * ANL-02 "tapping a point shows the underlying sets": the sets of one session of the exercise,
 * with the way to the whole workout's summary.
 */
export function SetsSheet({
  exercise,
  exposure,
  onClose,
}: {
  exercise: string;
  exposure: ExposureSets | null;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const words = useSummaryWords();
  const date = exposure ? formatLocalDate(exposure.localDate, 'long') : '';
  return (
    <Sheet
      open={exposure !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t`${exercise} on ${date}`}
      closeLabel={t`Close`}
    >
      {exposure ? (
        <>
          <ol className="flex flex-col gap-1" aria-label={t`Sets`}>
            {exposure.sets.map((set, index) => (
              <li key={set.id} className="flex gap-2 tabular">
                <span className="text-fg-muted">
                  {set.type === 'warmup' ? <Trans>Warm-up</Trans> : <Trans>Set {index + 1}</Trans>}
                </span>
                <span className="font-semibold">{words.setValues(set)}</span>
              </li>
            ))}
          </ol>
          <Link
            to="/session/summary/$sessionId"
            params={{ sessionId: exposure.sessionId }}
            className={buttonClass({ size: 'lg' })}
          >
            <Trans>Open the workout</Trans>
          </Link>
        </>
      ) : null}
    </Sheet>
  );
}
