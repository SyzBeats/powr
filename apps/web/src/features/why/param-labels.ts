import { useLingui } from '@lingui/react';
import { useEffect, useSyncExternalStore } from 'react';

import type { ParamId } from '@powr/domain/rules';

import { loadCatalog } from '../../i18n';
import { paramName } from './format';
import type { PARAM_LABELS } from './params/labels';

/*
 * The registry's parameter labels (TD-33) load with the lazy `params` catalog the first time a
 * "Why?" sheet or "How POWR decides" needs them; until then, and for an ID without a label, the
 * ID shows in words ("Rest (session)").
 */
let labels: typeof PARAM_LABELS | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadParamLabels(): Promise<void> {
  loading ??= Promise.all([loadCatalog('params'), import('./params/labels')]).then(([, module]) => {
    labels = module.PARAM_LABELS;
    for (const listener of listeners) listener();
  });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `(id) => label`: the parameter's label once loaded (starts loading on mount), else its ID in words. */
export function useParamLabel(): (id: string) => string {
  const { i18n } = useLingui();
  const loaded = useSyncExternalStore(subscribe, () => labels);
  useEffect(() => {
    void loadParamLabels();
  }, []);
  return (id) => {
    const descriptor = loaded?.[id as ParamId];
    return descriptor ? i18n._(descriptor) : paramName(id);
  };
}
