import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { lingui, linguiTransformerBabelPreset } from "@lingui/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { licenceCollector, licenceFixturePlugin } from "@powr/tools-licence";

import packageJson from "./package.json" with { type: "json" };
import { compilerReport } from "./scripts/compiler-report.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const distDir = `${root}dist`;
const licenceReportDir = `${root}.licence`;

const APP_VERSION = packageJson.version;
const APP_BUILD =
  process.env["POWR_BUILD"] ||
  gitShortSha() ||
  `local-${Date.now().toString(36)}`;
const RELEASE_TARGET = process.env["RELEASE_TARGET"] || "next";

const THEME_COLOR = { light: "#f6f6f4", dark: "#101214" };

const compiler = compilerReport(`${root}.compiler-report.json`);
// Explicit, so tools that load this config from the repository root (knip) find it too.
const linguiConfig = { cwd: root, configPath: `${root}lingui.config.ts` };
// We keep the Babel macro on purpose (technical concept §8.15); see IMPLEMENTATION_NOTES.md.
process.env["LINGUI_SUPPRESS_BABEL_WARNING"] = "1";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILD__: JSON.stringify(APP_BUILD),
    __RELEASE_TARGET__: JSON.stringify(RELEASE_TARGET),
  },
  build: {
    target: ["chrome130"],
    // Everything stays a same-origin file: no data: URLs, simpler CSP and precaching.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  preview: { port: 4173, strictPort: true },
  server: { port: 5173, strictPort: true },
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    babel({
      // Babel applies presets last to first: Lingui macros expand before the React Compiler
      // memoizes the result (§8.5, §8.15).
      presets: [
        reactCompilerPreset({ logger: compiler.logger }),
        linguiTransformerBabelPreset({}, linguiConfig),
      ],
    }),
    lingui({ ...linguiConfig, failOnMissing: true }),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "sw.ts",
      registerType: "prompt",
      // Registration is our own code (src/infrastructure/pwa), see IMPLEMENTATION_NOTES.md.
      injectRegister: false,
      manifest: {
        id: "/",
        name: "POWR",
        short_name: "POWR",
        description:
          "Evidence-based training planner and tracker that works offline.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: THEME_COLOR.dark,
        background_color: THEME_COLOR.dark,
        categories: ["health", "fitness", "sports"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Log a set",
            short_name: "Log",
            url: "/session?source=shortcut",
          },
        ],
      },
      injectManifest: {
        // A classic script: no module service worker needed, works on every Chromium we support.
        rollupFormat: "iife",
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest,json,txt}"],
        globIgnores: ["sw.js", "version.json"],
        buildPlugins: {
          vite: [
            licenceCollector({
              label: "sw",
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
    licenceCollector({ label: "app", reportDir: licenceReportDir }),
    licenceFixturePlugin(
      process.env["POWR_LICENCE_FIXTURE"],
      `${root}src/main.tsx`,
    ),
    versionFile(),
    compiler.plugin,
  ],
});

/** Emits /version.json, used by the health check and the post-deploy smoke test (§7.5). */
function versionFile(): Plugin {
  return {
    name: "powr-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
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
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
