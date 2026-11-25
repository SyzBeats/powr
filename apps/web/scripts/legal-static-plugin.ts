import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { lingui } from '@lingui/vite-plugin';
import react from '@vitejs/plugin-react';
import { build, type Plugin } from 'vite';

/*
 * The static website copy of the legal texts (LEG-09, TD-71; M6c): dist/legal-static/*.html,
 * rendered at build time from the app's own legal texts (src/features/legal/texts/static/
 * render.tsx), so the website that serves the app identifies the publisher, also without
 * JavaScript.
 *
 * It runs in the service-worker build, after tools/licence has written attributions.json (the
 * licence gate's `writeBundle`; `closeBundle` comes after every `writeBundle`), so the
 * attributions page lists exactly what the app's attributions screen lists. The texts are
 * compiled by a small server-side Vite build with the same Lingui setup as the app (macros and
 * the English catalogs), then rendered with react-dom/server. The pages are not precached
 * (`globIgnores`) and the service worker never answers their navigations (sw.ts).
 */

export interface LegalStaticOptions {
  /** apps/web */
  readonly root: string;
  /** apps/web/dist */
  readonly distDir: string;
  /** The app's Lingui plugin options (vite.config.ts). */
  readonly lingui: { readonly cwd: string; readonly configPath: string };
  readonly app: { readonly version: string; readonly build: string };
}

interface RenderModule {
  readonly renderLegalPages: (input: {
    readonly attributions: readonly unknown[];
    readonly app: LegalStaticOptions['app'];
  }) => Record<string, string>;
}

const ENTRY = 'src/features/legal/texts/static/render.tsx';
const OUT_DIR = 'legal-static';

export function legalStaticPages(options: LegalStaticOptions): Plugin {
  return {
    name: 'powr-legal-static',
    apply: 'build',
    async closeBundle() {
      const attributionsFile = join(options.distDir, 'attributions.json');
      let attributions: unknown;
      try {
        attributions = JSON.parse(readFileSync(attributionsFile, 'utf8'));
      } catch (error) {
        this.error(`legal-static: cannot read ${attributionsFile} (${String(error)})`);
      }
      if (!Array.isArray(attributions)) this.error('legal-static: attributions.json is no list');

      // Inside node_modules, so the bundle's external packages (React, Lingui) resolve from
      // apps/web exactly as the app's do.
      const work = join(options.root, 'node_modules/.cache/powr-legal-static');
      await build({
        configFile: false,
        root: options.root,
        mode: 'production',
        logLevel: 'warn',
        clearScreen: false,
        publicDir: false,
        plugins: [
          react(),
          lingui({ ...options.lingui, failOnMissing: true, macroTransform: true }),
        ],
        build: {
          ssr: ENTRY,
          outDir: work,
          emptyOutDir: true,
          minify: false,
          rolldownOptions: { output: { entryFileNames: 'render.mjs' } },
        },
      });
      const module = (await import(
        `${pathToFileURL(join(work, 'render.mjs')).href}?t=${Date.now()}`
      )) as RenderModule;
      const pages = module.renderLegalPages({ attributions, app: options.app });
      rmSync(work, { recursive: true, force: true });

      const target = join(options.distDir, OUT_DIR);
      mkdirSync(target, { recursive: true });
      for (const [file, html] of Object.entries(pages)) writeFileSync(join(target, file), html);
      // The app's colour tokens (checked for WCAG 2.2 AA by the token gate), then the layout.
      const css = [
        readFileSync(join(options.root, 'src/ui/tokens.css'), 'utf8'),
        readFileSync(join(options.root, 'scripts/legal-static.css'), 'utf8'),
      ].join('\n');
      writeFileSync(join(target, 'legal.css'), css);
    },
  };
}
