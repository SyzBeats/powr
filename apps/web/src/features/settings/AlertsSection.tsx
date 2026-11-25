import { Trans, useLingui } from '@lingui/react/macro';
import { BellRing } from 'lucide-react';
import { useId, useState } from 'react';

import type { NotificationPermissionState } from '@powr/application';

import { Badge, type Tone } from '#ui/badge';
import { Button } from '#ui/button';
import { CheckRow } from '#ui/choice';
import { Segmented } from '#ui/segmented';

import type { AlertLevel, AlertStatusReport, WakeLockStatus } from '../../app/container';
import {
  PRE_ALERT_SECONDS,
  useAlertSettings,
  useAlertStatus,
  useNotificationPermission,
  useSetAlertSettings,
  useTestAlert,
  useWakeLockStatus,
} from '../../hooks/use-alert-settings';
import { usePlatform } from '../../hooks/use-app';
import { formatPercent } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { SettingsSection } from './parts';

/**
 * Settings → Alerts (SET-03, SET-04, SET-10, TMR-05, TMR-06, PWA-06, PWA-08): the honest
 * screen-locked status, notification permission (explained first, requested only on a tap),
 * keep screen on with its live status, sound and volume, vibration, pre-alert and its timing
 * (5, 10 or 15 s), 3-2-1, the "resting until" notification and a test alert. The timer kit is a
 * lazy chunk, so the section suspends until it is loaded (render it inside a `<Suspense>`).
 */
export function AlertsSection() {
  const { t } = useLingui();
  const settings = useAlertSettings();
  const save = useSetAlertSettings();
  const { permission, request } = useNotificationPermission();
  const status = useAlertStatus(permission, settings.restingNotice);
  const wakeLock = useWakeLockStatus();
  const { haptics } = usePlatform();

  if (!settings.loaded) return null;

  return (
    <SettingsSection id="alerts" title={t`Alerts`}>
      {status ? <LockedStatus status={status} /> : null}

      <NotificationPermission permission={permission} onRequest={() => void request()} />

      <div className="flex flex-col gap-1">
        <CheckRow
          label={t`Keep the screen on during workouts`}
          description={t`Recommended: alerts are most reliable while POWR is on screen. Keeping the screen on uses more battery.`}
          checked={settings.keepScreenOn}
          onChange={(keepScreenOn) => void save({ keepScreenOn })}
        />
        <p data-testid="wake-lock-status" className="px-2 text-sm text-fg-muted">
          <WakeLockLine status={wakeLock} />
        </p>
      </div>

      <CheckRow
        label={t`Sound`}
        checked={settings.sound}
        onChange={(sound) => void save({ sound })}
      />
      <VolumeSlider
        value={settings.volume}
        disabled={!settings.sound}
        onChange={(volume) => void save({ volume })}
      />
      <CheckRow
        label={t`Vibration`}
        description={haptics.supported ? undefined : t`Not supported on this device.`}
        checked={settings.vibration}
        onChange={(vibration) => void save({ vibration })}
      />
      <div className="flex flex-col gap-2">
        <CheckRow
          label={t`Warning before the end of a rest`}
          checked={settings.preAlert}
          onChange={(preAlert) => void save({ preAlert })}
        />
        {settings.preAlert ? (
          <div className="flex flex-col gap-1 px-2">
            <span aria-hidden="true" className="text-sm font-medium text-fg-muted">
              <Trans>Seconds before the end</Trans>
            </span>
            <Segmented<`${(typeof PRE_ALERT_SECONDS)[number]}`>
              label={t`Seconds before the end`}
              value={`${settings.preAlertSeconds}`}
              onChange={(next) =>
                void save({
                  preAlertSeconds: Number(next) as (typeof PRE_ALERT_SECONDS)[number],
                })
              }
              options={PRE_ALERT_SECONDS.map((seconds) => ({
                value: `${seconds}` as const,
                label: t`${seconds} s`,
              }))}
            />
          </div>
        ) : null}
      </div>
      <CheckRow
        label={t`3-2-1 countdown beeps`}
        checked={settings.countdown}
        onChange={(countdown) => void save({ countdown })}
      />
      <CheckRow
        label={t`"Resting until" notification`}
        description={t`When you leave POWR during a rest, a silent notification shows when the rest ends.`}
        checked={settings.restingNotice}
        onChange={(restingNotice) => void save({ restingNotice })}
      />

      <TestAlert />
    </SettingsSection>
  );
}

const TONE: Record<AlertLevel, Tone> = {
  supported: 'ok',
  limited: 'warning',
  'not-supported': 'danger',
};

/** "Alerts while screen is locked: …" with the reason, never more than device tests showed. */
function LockedStatus({ status }: { status: AlertStatusReport }) {
  const { t } = useLingui();
  const label =
    status.level === 'supported'
      ? t`Supported`
      : status.level === 'not-supported'
        ? t`Not supported`
        : status.reason === 'tested'
          ? t`Limited`
          : t`Limited (best effort)`;
  return (
    <div data-testid="locked-status" className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-2 font-medium">
        <Trans>Alerts while screen is locked:</Trans>
        <Badge tone={TONE[status.level]}>{label}</Badge>
      </p>
      <p className="text-sm text-fg-muted">
        <StatusReason status={status} />
      </p>
      {status.tested ? (
        <p className="text-sm text-fg-muted">
          <Trans>
            Device test: {status.tested.onTime} of {status.tested.runs} alerts on time (
            {status.tested.device}).
          </Trans>
        </p>
      ) : null}
    </div>
  );
}

function StatusReason({ status }: { status: AlertStatusReport }) {
  switch (status.reason) {
    case 'tested':
      return status.level === 'supported' ? (
        <Trans>
          In device tests with this browser, rest alerts arrived on time with the screen locked.
        </Trans>
      ) : status.level === 'limited' ? (
        <Trans>
          In device tests with this browser, some alerts came late or not at all with the screen
          locked. Keep the screen on during workouts for reliable alerts.
        </Trans>
      ) : (
        <Trans>
          In device tests with this browser, no alert arrived with the screen locked. Keep the
          screen on during workouts.
        </Trans>
      );
    case 'untested':
      return (
        <Trans>
          This browser has not been tested yet. POWR tries every way it has, but an alert may come
          late or not at all while the screen is locked or you are in another app.
        </Trans>
      );
    case 'permission-needed':
      return (
        <Trans>
          Allow notifications so POWR can tell you when a rest ends while the screen is locked or
          you are in another app.
        </Trans>
      );
    case 'permission-denied':
      return (
        <Trans>
          Notifications are blocked for POWR, so nothing can alert you while the screen is locked.
          You can allow them in the browser's site settings.
        </Trans>
      );
    case 'unsupported':
      return (
        <Trans>
          This browser cannot show notifications from POWR, so alerts only work while POWR is on
          screen. Keep the screen on during workouts.
        </Trans>
      );
    default:
      return assertNever(status.reason);
  }
}

/** Permission status, an explanation, and the request button (never requested on load). */
function NotificationPermission({
  permission,
  onRequest,
}: {
  permission: NotificationPermissionState;
  onRequest: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p data-testid="notification-permission" className="font-medium">
        {permission === 'granted' ? (
          <Trans>Notifications: Allowed</Trans>
        ) : permission === 'denied' ? (
          <Trans>Notifications: Blocked</Trans>
        ) : permission === 'unsupported' ? (
          <Trans>Notifications: Not supported on this browser</Trans>
        ) : (
          <Trans>Notifications: Not allowed yet</Trans>
        )}
      </p>
      {permission === 'default' ? (
        <>
          <p className="text-sm text-fg-muted">
            <Trans>
              POWR uses notifications only for rest timers: one when a rest ends while you are away
              from the app, and an optional silent one with the end time. Nothing is sent over the
              internet.
            </Trans>
          </p>
          <Button onClick={onRequest}>
            <BellRing aria-hidden="true" className="size-5" />
            <Trans>Allow notifications</Trans>
          </Button>
        </>
      ) : null}
    </div>
  );
}

function WakeLockLine({ status }: { status: WakeLockStatus }) {
  if (!status.supported) return <Trans>Keep screen on: Not supported on this browser.</Trans>;
  if (!status.enabled) return <Trans>Keep screen on: Off.</Trans>;
  switch (status.state) {
    case 'held':
      return <Trans>Keep screen on: On now.</Trans>;
    case 'denied':
      return status.reason === 'NotAllowedError' ? (
        <Trans>
          Keep screen on: Not available right now. The browser refused, for example because battery
          saver is on.
        </Trans>
      ) : (
        <Trans>Keep screen on: Not available right now ({status.reason}).</Trans>
      );
    case 'off':
    case 'released':
    case 'unsupported':
      return <Trans>Keep screen on: Used during workouts.</Trans>;
    default:
      return assertNever(status.state);
  }
}

function VolumeSlider({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const percent = Math.round(value * 100);
  // Saved when the thumb is released (or a key changes it), not on every step of a drag.
  const [draft, setDraft] = useState<number | null>(null);
  const current = draft ?? percent;
  const shown = formatPercent(current / 100);
  const commit = () => {
    if (draft !== null && draft !== percent) onChange(draft / 100);
    setDraft(null);
  };
  return (
    <div className="flex flex-col gap-1 px-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="font-medium">
          <Trans>Volume</Trans>
        </label>
        {/* The slider says it itself (aria-valuetext); this is the visible copy. */}
        <span aria-hidden="true" className="text-sm text-fg-muted tabular">
          {shown}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={10}
        value={current}
        disabled={disabled}
        aria-valuetext={shown}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="h-target w-full accent-primary disabled:opacity-50"
      />
    </div>
  );
}

/** Plays the rest-end alert now in every enabled channel and shows the done state. */
function TestAlert() {
  const test = useTestAlert();
  const [result, setResult] = useState<{ sound: boolean; vibrated: boolean } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => void test().then(setResult)}>
        <Trans>Test alert</Trans>
      </Button>
      {/* Not a live region: the app's announcer says "Rest over", as during a workout. */}
      <div data-testid="test-alert-result" className="text-sm">
        {result ? (
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="ok">
              <Trans>Rest over</Trans>
            </Badge>
            {result.sound ? <Trans>Sound played.</Trans> : <Trans>No sound.</Trans>}{' '}
            {result.vibrated ? <Trans>Vibrated.</Trans> : <Trans>No vibration.</Trans>}
          </span>
        ) : null}
      </div>
    </div>
  );
}
