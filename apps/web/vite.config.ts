import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { lingui } from '@lingui/vite-plugin';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { licenceCollector, licenceFixturePlugin } from '@powr/tools-licence';

import packageJson from './package.json' with { type: 'json' };
import { citationsPlugin } from './scripts/citations-plugin.ts';
import { compilerReport } from './scripts/compiler-report.ts';
import { TRUSTED_TYPES_CSP } from './scripts/trusted-types.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const distDir = `${root}dist`;
const licenceReportDir = `${root}.licence`;

const APP_VERSION = packageJson.version;
const APP_BUILD = process.env['POWR_BUILD'] || gitShortSha() || `local-${Date.now().toString(36)}`;
const RELEASE_TARGET = process.env['RELEASE_TARGET'] || 'next';

const THEME_COLOR = { light: '#f6f6f4', dark: '#101214' };

const compiler = compilerReport(`${root}.compiler-report.json`);
// Explicit, so tools that load this config from the repository root (knip) find it too.
const linguiConfig = { cwd: root, configPath: `${root}lingui.config.ts` };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILD__: JSON.stringify(APP_BUILD),
    __RELEASE_TARGET__: JSON.stringify(RELEASE_TARGET),
  },
  build: {
    target: ['chrome130'],
    // Everything stays a same-origin file: no data: URLs, simpler CSP and precaching.
    assetsInlineLimit: 0,
    sourcemap: false,
    // Every supported browser (Chromium 130+) has `<link rel="modulepreload">` natively, so Vite's
    // polyfill for older browsers is not shipped in the entry chunk (TD-63, M5z).
    modulePreload: { polyfill: false },
    // The startup chunk below is about 550 kB minified; the gate is the gzip budget (size-limit,
    // §8.19), not Vite's 500 kB minified warning.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        // One startup chunk (M3b, §8.19): Rolldown otherwise splits every module the entry shares
        // with a lazy route into its own small common chunk (15 first-wave scripts at M3t, each
        // compressed on its own). Grouping the entry's static graph keeps the first wave at two
        // scripts; the lazy chunks import from the group as they did from the small chunks.
        codeSplitting: { groups: [{ name: 'startup', tags: ['$initial'] }] },
      },
    },
  },
  preview: { port: 4173, strictPort: true },
  // Trusted Types only: the production CSP would reject Vite's dev preamble and its injected
  // styles (TD-12).
  server: {
    port: 5173,
    strictPort: true,
    headers: { 'Content-Security-Policy': TRUSTED_TYPES_CSP },
  },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    // Order matters: Lingui's native macro plugin (`macroTransform`, TD-09) and the Babel plugin
    // are both `enforce: 'pre'`, so they run in array order. Macros must expand before the React
    // Compiler memoizes the result; the other way round it skips every component with a `t`
    // template (§8.5, §8.15). Tailwind scans this file: a bare utility name in a comment adds CSS.
    lingui({ ...linguiConfig, failOnMissing: true, macroTransform: true }),
    babel({ presets: [reactCompilerPreset({ logger: compiler.logger })] }),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'prompt',
      // Registration is our own code (src/infrastructure/pwa), see IMPLEMENTATION_NOTES.md.
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'POWR',
        short_name: 'POWR',
        description: 'Evidence-based training planner and tracker that works offline.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // No `orientation` lock: WCAG 2.2 AA 1.3.4 (TD-35, product owner 2026-11-24).
        theme_color: THEME_COLOR.dark,
        background_color: THEME_COLOR.dark,
        categories: ['health', 'fitness', 'sports'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // PWA-05 (M5d): opened offline like any deep link (navigation route → index.html); the
        // app puts Home beneath them in the history, so Back goes to Home (PWA-12).
        shortcuts: [
          {
            name: "Start today's session",
            short_name: 'Train',
            description: "Starts today's planned session, or opens the workout start screen.",
            url: '/session?start=today&source=shortcut',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Log bodyweight',
            short_name: 'Bodyweight',
            description: "Opens the bodyweight log with today's date and time.",
            url: '/body/log?source=shortcut',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      injectManifest: {
        // A classic script: no module service worker needed, works on every Chromium we support.
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,json,txt}'],
        globIgnores: ['sw.js', 'version.json'],
        buildPlugins: {
          vite: [
            licenceCollector({
              label: 'sw',
              reportDir: licenceReportDir,
              finalize: {
                distDir,
                policyFile: `${repoRoot}licence-policy.yaml`,
                assetsInventoryFile: `${repoRoot}assets-inventory.yaml`,
              },
            }),
          ],
        },
      },
      devOptions: { enabled: false },
    }),
    licenceCollector({ label: 'app', reportDir: licenceReportDir }),
    // TD-33 (M5s): the source registry's citations as a lazy chunk.
    citationsPlugin(),
    licenceFixturePlugin(process.env['POWR_LICENCE_FIXTURE'], `${root}src/main.tsx`),
    versionFile(),
    compiler.plugin,
  ],
});

/** Emits /version.json, used by the health check and the post-deploy smoke test (§7.5). */
function versionFile(): Plugin {
  return {
    name: 'powr-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: APP_VERSION,
          build: APP_BUILD,
          releaseTarget: RELEASE_TARGET,
        }),
      });
    },
  };
}

function gitShortSha(): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}
