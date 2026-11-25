import { Trans, useLingui } from '@lingui/react/macro';

import { Callout } from '#ui/badge';

import { isPlaceholder, LEGAL_DETAILS } from './publisher';

/**
 * The visible "Draft" marker while a legal detail is a placeholder (product-owner decision
 * 2026-11-25): dev and beta builds only, because `pnpm release:check` blocks a production deploy
 * until every placeholder is filled in. Shared by the legal screens and the static website copy
 * (`texts/static`, TD-71), so both show the same marker from the same details.
 */
export function DraftMarker() {
  const { t } = useLingui();
  const missing = [
    ...(isPlaceholder(LEGAL_DETAILS.postalAddress) ? [t`the publisher's postal address`] : []),
    ...(isPlaceholder(LEGAL_DETAILS.legalReview) ? [t`the legal review`] : []),
  ];
  if (missing.length === 0) return null;
  const list = missing.join(t`, `);
  return (
    <div data-testid="legal-draft">
      <Callout tone="warning" title={t`Draft`}>
        <p>
          <Trans>
            This text is a draft until its legal review and may still change. Still to come: {list}.
          </Trans>
        </p>
      </Callout>
    </div>
  );
}
