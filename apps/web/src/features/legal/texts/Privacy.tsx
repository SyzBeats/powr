import { Trans } from '@lingui/react/macro';

import { LEGAL_DETAILS } from '../publisher';
import { Bullets, EmailLink, PublisherBlock, Section } from './parts';

/**
 * The privacy notice in full (LEG-02, PRD §8.2; hosting from technical concept §7.2 and §7.4):
 * local-only storage, no account, analytics, telemetry or tracking, what is stored where and why,
 * hosting, permissions, backups, data loss, deletion, the user's rights under the Swiss revFADP
 * and, where it applies, the EU GDPR, and contact by e-mail. The publisher is the responsible
 * party (LEG-09). A draft for the legal review (V-06).
 */
export function PrivacyText() {
  const details = LEGAL_DETAILS;
  const { provider, location } = details.hosting;
  return (
    <>
      <Section title={<Trans>In short</Trans>}>
        <p>
          <Trans>
            Everything you enter is stored only on this device. We never receive it: there is no
            account, analytics or tracking. Only you can export it, as a backup file.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Who is responsible</Trans>}>
        <p>
          <Trans>The publisher of POWR is responsible for this app and this notice:</Trans>
        </p>
        <PublisherBlock details={details} />
      </Section>

      <Section title={<Trans>What POWR stores, where and why</Trans>}>
        <p>
          <Trans>POWR stores what you enter or create while you use it:</Trans>
        </p>
        <Bullets>
          <li>
            <Trans>your plans, workouts, sets, rest times and notes;</Trans>
          </li>
          <li>
            <Trans>
              profile answers, such as your goal, experience, training days, and optionally your
              sex, birth year, height and the lifts you know;
            </Trans>
          </li>
          <li>
            <Trans>bodyweight and body measurements you log;</Trans>
          </li>
          <li>
            <Trans>check-ins (sleep, energy, soreness) and pain notes;</Trans>
          </li>
          <li>
            <Trans>your equipment, settings and the choices you made in the app.</Trans>
          </li>
        </Bullets>
        <p>
          <Trans>
            All of it stays in your browser's storage on this device, for this app only. POWR uses
            it for one purpose: to run the app for you, for example to plan your training, suggest
            weights and show your progress. Some of it, such as body data, pain notes and check-ins,
            can be health data. It never leaves your device unless you export it.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>What we do not do</Trans>}>
        <Bullets>
          <li>
            <Trans>There is no account and no sign-in. We do not know who uses POWR.</Trans>
          </li>
          <li>
            <Trans>
              There is no analytics, no telemetry, no advertising and no tracking of any kind.
            </Trans>
          </li>
          <li>
            <Trans>
              The app loads nothing from other companies: no fonts, scripts or services from third
              parties.
            </Trans>
          </li>
          <li>
            <Trans>
              We do not collect, receive, sell or share your training data. We never have a copy of
              it.
            </Trans>
          </li>
        </Bullets>
      </Section>

      <Section title={<Trans>Hosting</Trans>}>
        <p>
          <Trans>
            The app files are served from a server in {location} that we rent from {provider} and
            operate ourselves. To send the files when you open or update the app, the server has to
            handle technical connection data, such as your IP address and browser type, for the
            moment of the request. We do not keep access logs. Your training data never reaches this
            server.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Permissions</Trans>}>
        <Bullets>
          <li>
            <Trans>
              Notifications: only for rest-timer alerts, and only after you allow them. They are
              created on your device; nothing is sent over the internet. You can turn them off in
              your browser's site settings at any time.
            </Trans>
          </li>
          <li>
            <Trans>
              Keeping the screen on during a workout and asking the browser to keep your data
              (persistent storage) need no personal data.
            </Trans>
          </li>
          <li>
            <Trans>POWR does not use your camera, microphone, contacts or location.</Trans>
          </li>
        </Bullets>
      </Section>

      <Section title={<Trans>Backups and exported files</Trans>}>
        <p>
          <Trans>
            Backups, calendar files and other exports are created on your device and are under your
            control. If you store or share them elsewhere, for example in a cloud drive, by e-mail
            or in a messenger, that service's terms and privacy policy apply. Backup files are not
            encrypted, so keep them somewhere safe.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Data loss</Trans>}>
        <p>
          <Trans>
            Clearing your browser data, uninstalling the app or the browser freeing up space can
            delete your data. Because we never have a copy, we cannot restore it. Export a backup
            regularly.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Deleting your data</Trans>}>
        <p>
          <Trans>
            You can delete your data at any time: in POWR under Settings, Data and backups, or in
            your browser by deleting the site data of this app. Uninstalling the app from your home
            screen may not delete the data on its own.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Your rights</Trans>}>
        <p>
          <Trans>
            Under the Swiss Federal Act on Data Protection (revFADP) and, where it applies, the EU
            General Data Protection Regulation (GDPR), you have the right to information about and
            access to your personal data, to have it corrected or deleted, to restrict or object to
            its processing, and to receive it in a portable format.
          </Trans>
        </p>
        <p>
          <Trans>
            Because your training data is only on your device, you exercise most of these rights
            yourself in the app: view it, correct it, export it as a backup or delete it. For
            anything else, for example a question about the hosting, write to us.
          </Trans>
        </p>
        <p>
          <Trans>
            You can also complain to a data protection authority: in Switzerland the Federal Data
            Protection and Information Commissioner (FDPIC), in the EU the authority of your
            country.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Legal framework</Trans>}>
        <p>
          <Trans>
            The revFADP applies because the publisher is based in Switzerland. Whether the GDPR also
            applies to users in the EU is being confirmed in a legal review; this notice is written
            to meet both.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Changes and contact</Trans>}>
        <p>
          <Trans>
            If this notice changes in substance, POWR shows the new version and asks you to confirm
            it before you continue. The version is shown at the top of this page.
          </Trans>
        </p>
        <p>
          <Trans>
            Questions about privacy: <EmailLink details={details} />
          </Trans>
        </p>
      </Section>
    </>
  );
}
