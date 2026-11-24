import { Trans, useLingui } from '@lingui/react/macro';

import { Card, Screen } from '#ui/screen';

import { LEGAL_VERSIONS } from './versions';

/*
 * The full texts behind the onboarding summaries (LEG-01, LEG-02; PRD §8.1, §8.2). Drafts for the
 * legal review (V-06): the publisher's postal address and e-mail are still to be provided
 * (LEG-09). Available before onboarding completes, offline, and later from Settings.
 */

export function DisclaimerScreen() {
  const { t } = useLingui();
  const version = LEGAL_VERSIONS.disclaimerVersion;
  return (
    <Screen title={t`Health and safety notice`}>
      <p className="text-sm text-fg-muted">
        <Trans>Version {version}</Trans>
      </p>
      <Card>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <Trans>
              POWR gives general fitness information and training suggestions. It is not medical
              advice and does not replace a doctor, physiotherapist, dietitian or qualified coach.
            </Trans>
          </li>
          <li>
            <Trans>
              Talk to a doctor before you start or change a training or nutrition programme,
              especially if you have a known condition, are pregnant or have had an injury.
            </Trans>
          </li>
          <li>
            <Trans>
              Stop training and get medical help if you feel chest pain, dizziness, shortness of
              breath or sharp pain.
            </Trans>
          </li>
          <li>
            <Trans>
              Lifting heavy weights carries a risk of injury. Use safe technique, a spotter or
              safety equipment such as rack safeties.
            </Trans>
          </li>
          <li>
            <Trans>
              Nutrition targets and weight-cut guidance are estimates for healthy adults. They are
              not suitable for people with an eating disorder, during pregnancy or for minors.
            </Trans>
          </li>
          <li>
            <Trans>
              POWR suggests; you confirm. You are responsible for the decisions you make with its
              suggestions.
            </Trans>
          </li>
        </ul>
      </Card>
    </Screen>
  );
}

export function PrivacyScreen() {
  const { t } = useLingui();
  const version = LEGAL_VERSIONS.privacyVersion;
  return (
    <Screen title={t`Privacy notice`}>
      <p className="text-sm text-fg-muted">
        <Trans>Version {version}. Draft, pending legal review.</Trans>
      </p>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>In short</Trans>
        </h2>
        <p>
          <Trans>
            Everything you enter is stored only on this device. We never receive it: there is no
            account, analytics or tracking. Only you can export it, as a backup file.
          </Trans>
        </p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>What POWR stores, where and why</Trans>
        </h2>
        <p>
          <Trans>
            Your training (plans, sessions and sets), body data you choose to enter (such as body
            weight), check-ins and settings. They are stored in your browser's storage on this
            device, only to run the app for you.
          </Trans>
        </p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Who is responsible</Trans>
        </h2>
        <p>
          <Trans>
            Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland. Postal address and e-mail: to be
            added before the public release.
          </Trans>
        </p>
        <p>
          <Trans>
            We do not collect, receive or process your training data. There is no account, no
            analytics, no telemetry and no tracking.
          </Trans>
        </p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Hosting</Trans>
        </h2>
        <p>
          <Trans>
            The app files are served from a server in Germany that we rent from Hetzner Online GmbH
            and operate ourselves. We do not keep access logs. Your training data never reaches this
            server.
          </Trans>
        </p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Permissions</Trans>
        </h2>
        <p>
          <Trans>
            Notifications are only used for rest-timer alerts, and only after you allow them. POWR
            asks for nothing else without a reason you can see.
          </Trans>
        </p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Backups and data loss</Trans>
        </h2>
        <p>
          <Trans>
            Backup files you export are under your control. If you store or share them elsewhere,
            for example in a cloud drive, that service's terms apply. Clearing your browser data,
            uninstalling or the browser freeing space can delete your data, so keep backups.
          </Trans>
        </p>
        <p>
          <Trans>You can delete all your data at any time in Settings, Data and backups.</Trans>
        </p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Legal framework</Trans>
        </h2>
        <p>
          <Trans>
            The Swiss Federal Act on Data Protection (revFADP) applies. Whether the EU GDPR also
            applies is being confirmed in a legal review; this notice is written to meet both.
          </Trans>
        </p>
      </Card>
    </Screen>
  );
}
