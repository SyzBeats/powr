import { useEffect, useMemo, useState } from 'react';

import {
  applyImport,
  exportBackup,
  getStorageStatus,
  previewImport,
  requestPersistentStorage,
  type StorageStatus,
} from '@powr/application';
import type { DecodedBackup } from '@powr/formats';

import { useContainer } from '../app/container-context';
import { useObservable } from './use-observable';

export function useMeta(key: string) {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.meta(key), [deps, key]);
  return useObservable(observable);
}

export function useExportBackup() {
  const { deps, diagnostics } = useContainer();
  return async () => {
    const startedAt = performance.now();
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
      const result = await previewImport(deps, new Uint8Array(await file.arrayBuffer()));
      if (!result.ok) diagnostics.log('info', 'backup.rejected', { kind: result.error.kind });
      return result;
    },
    async apply(backup: DecodedBackup) {
      const startedAt = performance.now();
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
