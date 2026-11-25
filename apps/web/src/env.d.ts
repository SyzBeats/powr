/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;
declare const __RELEASE_TARGET__: 'mvp' | 'v1.1' | 'v1.2' | 'v1.3' | 'next';

interface ImportMetaEnv {
  /**
   * The app's public origin, set by the deploy at build time (`VITE_PUBLIC_ORIGIN=https://…`).
   * Calendar UIDs and public URLs derive from it (src/app/public-origin.ts).
   */
  readonly VITE_PUBLIC_ORIGIN?: string;
}

/**
 * TD-33 (M5s): the source registry's citations, generated at build time by
 * scripts/citations-plugin.ts. Keep in step with `CitationsFile` in
 * packages/rules/scripts/citations.ts.
 */
declare module 'virtual:powr-citations' {
  import type { EvidenceTag } from '@powr/domain';

  const file: {
    readonly format: 'powr-citations';
    readonly citations: readonly {
      readonly id: string;
      readonly authors: string | null;
      readonly year: string | null;
      readonly details: string;
      readonly doi: string | null;
      readonly url: string | null;
      readonly seeAlso: readonly string[];
      readonly tag: EvidenceTag;
      readonly note: string | null;
    }[];
  };
  export default file;
}
