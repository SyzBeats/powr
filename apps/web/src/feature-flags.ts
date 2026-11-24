/**
 * Features by release tag (§8.22). RELEASE_TARGET is injected at build time, so `isEnabled`
 * folds to a constant and disabled features are tree-shaken out.
 */
type Release = 'mvp' | 'v1.1' | 'v1.2' | 'v1.3' | 'next';

interface FeatureDef {
  readonly release: Release;
  readonly reqs: readonly string[];
}

export const FEATURES = {
  /** Developer harness pages for device spikes S-1 and S-2 (beta builds only). */
  debugTools: { release: 'next', reqs: ['DAT-16', 'V-01', 'V-07'] },
} as const satisfies Record<string, FeatureDef>;

const ORDER: readonly Release[] = ['mvp', 'v1.1', 'v1.2', 'v1.3', 'next'];

export function isEnabled(feature: keyof typeof FEATURES): boolean {
  return ORDER.indexOf(FEATURES[feature].release) <= ORDER.indexOf(__RELEASE_TARGET__);
}
