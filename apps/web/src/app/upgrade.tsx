import { I18nProvider } from '@lingui/react';
import type { Root } from 'react-dom/client';

import type { UpgradeEnv } from '@powr/application/backup';

import {
  RecoveryScreen,
  UpdatingDataScreen,
  type CopyOutcome,
  type RecoveryKind,
} from '../features/shell/RecoveryScreen';
import { i18n } from '../i18n';
import { createSafetySnapshots } from '../infrastructure/db';
import { hasUserData, readRawDatabase } from '../infrastructure/db/raw-read';
import type { PendingUpgrade } from '../infrastructure/db/stored-version';
import type { Diagnostics } from '../infrastructure/diagnostics/log';
import { systemClock } from '../infrastructure/platform/clock';
import { downloadGateway } from '../infrastructure/platform/files';
import { uuidv7Generator } from '../infrastructure/platform/ids';

/**
 * The data-update guard (DAT-14, §6.7 step 3, §6.8): a lazy chunk, loaded only when the stored
 * database is older than the code or cannot be opened. It writes the safety snapshot before
 * Dexie runs the migration and renders the recovery screen when anything fails. It never
 * deletes data.
 */
// oxlint-disable-next-line no-restricted-imports -- the data-update guard's lazy load of the backup codec (DAT-14)
const loadBackup = () => import('@powr/application/backup');

const APP = { version: __APP_VERSION__, build: __APP_BUILD__ } as const;

export interface GuardContext {
  readonly root: Root;
  readonly diagnostics: Diagnostics;
  /** The versions stamped on the copies; 'unknown' when their chunk failed to load. */
  readonly versions: () => Promise<{ readonly rules: string; readonly content: string }>;
}

function env(versions: { readonly rules: string; readonly content: string }): UpgradeEnv {
  return {
    app: APP,
    clock: systemClock,
    ids: uuidv7Generator,
    safety: createSafetySnapshots(),
    files: downloadGateway,
    rulesVersion: versions.rules,
    contentVersion: versions.content,
  };
}

/**
 * Before the update: the blocking "Updating your data…" screen, then the safety snapshot of the
 * stored records. Returns false (and shows the recovery screen) if the copy cannot be written:
 * the update must not run without it.
 */
export async function prepareUpgrade(
  context: GuardContext,
  pending: PendingUpgrade,
): Promise<boolean> {
  context.root.render(
    <I18nProvider i18n={i18n}>
      <UpdatingDataScreen />
    </I18nProvider>,
  );
  context.diagnostics.log('info', 'db.upgrade', { from: pending.from, to: pending.to });
  const startedAt = performance.now();
  try {
    const raw = await readRawDatabase();
    if (raw === null || !hasUserData(raw)) return true;
    const [{ snapshotBeforeUpgrade }, versions] = await Promise.all([
      loadBackup(),
      context.versions(),
    ]);
    const snapshot = await snapshotBeforeUpgrade(env(versions), raw);
    context.diagnostics.log('info', 'db.snapshot', {
      from: pending.from,
      bytes: snapshot.bytes,
      ms: Math.round(performance.now() - startedAt),
    });
    return true;
  } catch (error) {
    context.diagnostics.log('error', 'db.snapshotError', {
      name: error instanceof Error ? error.name : 'unknown',
    });
    showRecovery(context, 'snapshot');
    return false;
  }
}

/** The recovery screen (§6.8): save a raw copy, export diagnostics, try again. */
export function showRecovery(context: GuardContext, kind: RecoveryKind): void {
  context.diagnostics.log('info', 'db.recovery', { kind });
  const saveCopy = async (): Promise<CopyOutcome> => {
    const raw = await readRawDatabase();
    if (raw === null) return { kind: 'unreadable' };
    const [{ saveRescueCopy }, versions] = await Promise.all([loadBackup(), context.versions()]);
    const { fileName, delivery } = await saveRescueCopy(env(versions), raw);
    return delivery === 'cancelled' ? { kind: 'cancelled' } : { kind: 'saved', fileName };
  };
  const exportDiagnostics = async () => {
    const { fileName, text } = await context.diagnostics.exportAll();
    await downloadGateway.save({
      name: fileName,
      bytes: new TextEncoder().encode(text),
      mime: 'text/plain',
    });
    return fileName;
  };
  context.root.render(
    <I18nProvider i18n={i18n}>
      <RecoveryScreen
        kind={kind}
        onSaveCopy={saveCopy}
        onExportDiagnostics={exportDiagnostics}
        onRetry={() => location.reload()}
      />
    </I18nProvider>,
  );
}
