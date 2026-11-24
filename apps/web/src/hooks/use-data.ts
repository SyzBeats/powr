import { useEffect, useMemo, useState } from 'react';

import { getStorageStatus, requestPersistentStorage, type StorageStatus } from '@powr/application';
import type { DecodedBackup } from '@powr/application/backup';

import { useContainer } from '../app/container-context';
import { useObservable } from './use-observable';

/**
 * The backup code path (Zod record schemas, fflate, export and import) is a lazy chunk, so it is
 * not part of the startup bundle (§8.19). The service worker precaches it with every other chunk,
 * so the first export or import works offline too. Lint allows only type imports of it elsewhere.
 */
// oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the chunk
const loadBackup = () => import('@powr/application/backup');

export function useMeta(key: string) {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.meta(key), [deps, key]);
  return useObservable(observable);
}

export function useExportBackup() {
  const { deps, diagnostics } = useContainer();
  return async () => {
    const startedAt = performance.now();
    const { exportBackup } = await loadBackup();
    const result = await exportBackup(deps);
    if (result.ok) {
      diagnostics.log('info', 'backup.exported', {
        bytes: result.value.bytes,
        ms: Math.round(performance.now() - startedAt),
      });
    }
    return result;
  };
}

export function useImportBackup() {
  const { deps, diagnostics } = useContainer();
  return {
    async preview(file: File) {
      const { previewImport } = await loadBackup();
      const result = await previewImport(deps, new Uint8Array(await file.arrayBuffer()));
      if (!result.ok) diagnostics.log('info', 'backup.rejected', { kind: result.error.kind });
      return result;
    },
    async apply(backup: DecodedBackup) {
      const startedAt = performance.now();
      const { applyImport } = await loadBackup();
      const result = await applyImport(deps, backup);
      diagnostics.log('info', 'backup.imported', { ms: Math.round(performance.now() - startedAt) });
      return result;
    },
  };
}

export function useStorageStatus() {
  const { deps, diagnostics } = useContainer();
  const [status, setStatus] = useState<StorageStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getStorageStatus(deps).then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  const requestPersistence = async () => {
    const granted = await requestPersistentStorage(deps, 'user');
    diagnostics.log('info', 'storage.persist', { granted, trigger: 'user' });
    setStatus(await getStorageStatus(deps));
    return granted;
  };

  return { status, requestPersistence };
}
