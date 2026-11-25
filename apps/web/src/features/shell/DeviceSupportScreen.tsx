import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { CircleHelp } from 'lucide-react';
import { Suspense, type ReactElement, type ReactNode } from 'react';

import type { CapabilityReport, CapabilityValue } from '@powr/application';

import { Badge, type Tone } from '#ui/badge';
import { Button } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import type { AlertStatusReport } from '../../app/container';
import { isEnabled } from '../../feature-flags';
import {
  useAlertSettings,
  useAlertStatus,
  useNotificationPermission,
} from '../../hooks/use-alert-settings';
import { useCapabilityReport, useInstall } from '../../hooks/use-device';
import { useTimerKit } from '../../hooks/use-timer-kit';
import { formatBytes } from '../../i18n/format';

/**
 * What this browser does for one capability, in words (never colour alone). `instead`: POWR uses
 * another way on purpose here (a download instead of the share sheet), which is not a fault.
 */
type Level = 'works' | 'limited' | 'missing' | 'instead' | 'unknown';

const TONE: Record<Level, Tone> = {
  works: 'ok',
  limited: 'warning',
  missing: 'danger',
  instead: 'info',
  unknown: 'neutral',
};

/**
 * Device support (PWA-13, §8.23): what works on this phone and browser, from runtime detection
 * and, for timer alerts, the shipped device-test matrix (S-1). It never claims more than was
 * detected or tested: anything the app cannot check says so, and capabilities whose device test
 * (S-2) has not run yet say that too. Each row names what POWR does instead.
 */
// The explicit return type keeps TypeScript from inferring this route component through the
// route tree while the Data screen links here and this screen links back (a type cycle).
export function DeviceSupportScreen(): ReactElement {
  const { t } = useLingui();
  const report = useCapabilityReport();
  return (
    <Screen title={t`Device support`}>
      <p className="text-fg-muted">
        <Trans>
          What works in this browser on this phone, checked just now. Where something is missing,
          POWR uses another way, shown under each item.
        </Trans>
      </p>
      <Suspense fallback={null}>
        <BrowserLine />
      </Suspense>
      {report === null ? (
        <output className="block text-fg-muted">
          <Trans>Checking this browser…</Trans>
        </output>
      ) : (
        <Capabilities report={report} />
      )}
      <TestersCard />
    </Screen>
  );
}

function BrowserLine() {
  const { t } = useLingui();
  const browser = useTimerKit().browser();
  const family =
    browser.family === 'chrome'
      ? t`Chrome`
      : browser.family === 'samsung'
        ? t`Samsung Internet`
        : t`Another browser`;
  const version = browser.major === null ? '' : ` ${browser.major}`;
  const platform = browser.platform === 'android' ? t`Android` : t`not Android`;
  return (
    <p data-testid="device-browser" className="font-semibold">
      {browser.displayMode === 'standalone' ? (
        <Trans>
          {family}
          {version} on {platform}, installed app
        </Trans>
      ) : (
        <Trans>
          {family}
          {version} on {platform}, in the browser
        </Trans>
      )}
    </p>
  );
}

function value(report: CapabilityReport, key: string): CapabilityValue {
  for (const group of report.groups) {
    const item = group.items.find((entry) => entry.key === key);
    if (item) return item.value;
  }
  return null;
}

function Capabilities({ report }: { report: CapabilityReport }) {
  const { t } = useLingui();
  const install = useInstall();
  const has = (key: string) => value(report, key) === true;
  const usage = value(report, 'storageUsageMb');
  const quota = value(report, 'storageQuotaMb');
  const notTested = t`Device test S-2 has not run yet.`;

  const installLevel: Level = install.installed
    ? 'works'
    : install.available
      ? 'works'
      : install.samsung
        ? 'limited'
        : 'unknown';

  return (
    <ul className="flex flex-col gap-3" data-testid="device-capabilities">
      <Row
        name={t`Works offline`}
        level={has('serviceWorker') ? 'works' : 'missing'}
        status={has('serviceWorker') ? t`Works here` : t`Not available here`}
        instead={
          has('serviceWorker')
            ? t`After the first visit everything works without a connection.`
            : t`POWR needs a connection to open in this browser.`
        }
        tested={notTested}
      />
      <Row
        name={t`Install on the home screen`}
        level={installLevel}
        status={
          install.installed
            ? t`Installed`
            : install.available
              ? t`Can be installed`
              : install.samsung
                ? t`From the browser menu`
                : t`Not offered yet`
        }
        instead={
          install.installed
            ? t`POWR runs as its own app.`
            : install.samsung
              ? t`In Samsung Internet: menu, then “Add page to”, then “Home screen”.`
              : install.available
                ? t`Install it to open POWR like any app.`
                : t`The browser decides when to offer it; its menu may have “Install app” or “Add to Home screen”.`
        }
        tested={notTested}
        action={
          install.available && !install.installed ? (
            <Button onClick={() => void install.prompt()}>
              <Trans>Install</Trans>
            </Button>
          ) : null
        }
      />
      <Row
        name={t`Storage protection`}
        level={
          value(report, 'storagePersisted') === true
            ? 'works'
            : has('storagePersist')
              ? 'limited'
              : 'missing'
        }
        status={
          value(report, 'storagePersisted') === true
            ? t`Protected`
            : has('storagePersist')
              ? t`Not protected yet`
              : t`Not available here`
        }
        instead={t`Without protection the browser may delete data when space runs low, so backup reminders come more often.`}
        tested={notTested}
        action={
          <Link to="/data" className="font-semibold text-info underline underline-offset-4">
            <Trans>Data and backups</Trans>
          </Link>
        }
      />
      <Row
        name={t`Storage use`}
        level={typeof usage === 'number' && typeof quota === 'number' ? 'works' : 'missing'}
        status={
          typeof usage === 'number' && typeof quota === 'number'
            ? t`Using ${formatBytes(usage * 1e6)} of ${formatBytes(quota * 1e6)}`
            : t`Not reported`
        }
        instead={t`Shown in Data and backups.`}
        tested={notTested}
      />
      <Row
        name={t`Keep the screen on`}
        level={has('wakeLock') ? 'works' : 'missing'}
        status={has('wakeLock') ? t`Works here` : t`Not supported on this browser`}
        instead={
          has('wakeLock')
            ? t`On during workouts; it uses more battery.`
            : t`Set a longer screen timeout in the phone settings for workouts.`
        }
        tested={notTested}
      />
      <Row
        name={t`Vibration`}
        level={has('vibrate') ? 'works' : 'missing'}
        status={has('vibrate') ? t`Works here` : t`Not available here`}
        instead={
          has('vibrate')
            ? t`Timer alerts can vibrate (Settings, Alerts).`
            : t`Alerts use sound and the screen instead.`
        }
        tested={notTested}
      />
      <Suspense
        fallback={
          <Row
            name={t`Alerts while the screen is locked`}
            level="unknown"
            status={t`Checking…`}
            instead=""
            tested=""
          />
        }
      >
        <LockedAlertsRow />
      </Suspense>
      <Row
        name={t`Share the calendar file`}
        level={value(report, 'canShareIcs') === true ? 'works' : 'instead'}
        status={
          value(report, 'canShareIcs') === true ? t`Share sheet offered` : t`Downloaded instead`
        }
        instead={t`The calendar file is downloaded; open it from your downloads.`}
        tested={notTested}
      />
      <Row
        name={t`Share backup files`}
        level="instead"
        status={t`Downloaded instead`}
        instead={t`Browsers do not share .zip files, so backups always go to Downloads. Copy them off the phone.`}
        tested={notTested}
      />
      <Row
        name={t`Save to a folder you choose`}
        level={has('saveFilePicker') ? 'limited' : 'missing'}
        status={has('saveFilePicker') ? t`Available, not used yet` : t`Not available here`}
        instead={t`Backups go to Downloads.`}
        tested={notTested}
      />
      <Row
        name={t`App shortcuts`}
        level="unknown"
        status={t`Cannot be checked from the app`}
        instead={t`After installing, touch and hold the POWR icon: Start today’s session, Log bodyweight. Your launcher decides whether it shows them.`}
        tested={notTested}
      />
    </ul>
  );
}

function LockedAlertsRow() {
  const { t } = useLingui();
  const { permission } = useNotificationPermission();
  const settings = useAlertSettings();
  const status = useAlertStatus(permission, settings.restingNotice);
  if (status === null) {
    return (
      <Row
        name={t`Alerts while the screen is locked`}
        level="unknown"
        status={t`Checking…`}
        instead=""
        tested=""
      />
    );
  }
  return (
    <Row
      name={t`Alerts while the screen is locked`}
      level={alertLevel(status)}
      status={
        status.level === 'supported'
          ? t`Supported`
          : status.level === 'not-supported'
            ? t`Not supported`
            : status.reason === 'tested'
              ? t`Limited`
              : t`Limited (best effort)`
      }
      instead={t`Keep the screen on during workouts for alerts you can rely on. Details in Settings, Alerts.`}
      tested={
        status.tested
          ? t`Device test S-1: ${status.tested.onTime} of ${status.tested.runs} alerts on time (${status.tested.device}).`
          : t`Device test S-1 has no result for this browser yet.`
      }
    />
  );
}

function alertLevel(status: AlertStatusReport): Level {
  return status.level === 'supported'
    ? 'works'
    : status.level === 'not-supported'
      ? 'missing'
      : 'limited';
}

function Row({
  name,
  level,
  status,
  instead,
  tested,
  action,
}: {
  name: string;
  level: Level;
  status: string;
  instead: string;
  tested: string;
  action?: ReactNode;
}) {
  return (
    <li data-testid="device-capability" className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
      <h2 className="text-lg font-semibold">{name}</h2>
      <p>
        <Badge tone={TONE[level]} {...(level === 'unknown' ? { icon: CircleHelp } : {})}>
          {status}
        </Badge>
      </p>
      {instead ? <p>{instead}</p> : null}
      {tested ? <p className="text-sm text-fg-muted">{tested}</p> : null}
      {action ? <div>{action}</div> : null}
    </li>
  );
}

/** For testers: where the device tests are described, and the in-app harnesses in beta builds. */
function TestersCard() {
  const debugTools = isEnabled('debugTools');
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>How this is tested</Trans>
      </h2>
      <p className="text-sm">
        <Trans>
          Results come from two device-test protocols run on a Galaxy S22 with Chrome and Samsung
          Internet: S-1 for timers and alerts (docs/device-tests/S-1-protocol.md) and S-2 for the
          other capabilities (docs/device-tests/S-2-protocol.md).
        </Trans>
      </p>
      {debugTools ? (
        <ul className="flex flex-col gap-2">
          <li>
            <Link
              to="/debug/alerts"
              className="flex min-h-target items-center font-semibold text-info underline underline-offset-4"
            >
              <Trans>Run the S-1 alert test</Trans>
            </Link>
          </li>
          <li>
            <Link
              to="/debug/capabilities"
              className="flex min-h-target items-center font-semibold text-info underline underline-offset-4"
            >
              <Trans>Run the S-2 capability checks</Trans>
            </Link>
          </li>
        </ul>
      ) : null}
    </Card>
  );
}
