import { writeFileSync } from 'node:fs';

import type { Plugin } from 'vite';

interface CompilerEvent {
  kind: string;
  fnName?: string | null;
  reason?: string;
  detail?: { reason?: string };
}

/**
 * Collects the React Compiler's bail-outs during a build and writes them to a JSON report
 * (a CI artifact, §8.5), so skipped components are visible without failing the build.
 */
export function compilerReport(file: string) {
  const skipped: { file: string; fn: string | null; kind: string; reason: string }[] = [];
  const logger = {
    logEvent(filename: string | null, event: CompilerEvent) {
      if (event.kind === 'CompileSuccess') return;
      if (
        !['CompileError', 'CompileSkip', 'PipelineError', 'CompileDiagnostic'].includes(event.kind)
      )
        return;
      skipped.push({
        file: filename ?? 'unknown',
        fn: event.fnName ?? null,
        kind: event.kind,
        reason: event.reason ?? event.detail?.reason ?? '',
      });
    },
  };
  const plugin: Plugin = {
    name: 'powr-compiler-report',
    apply: 'build',
    closeBundle() {
      writeFileSync(file, JSON.stringify({ skipped }, null, 2));
    },
  };
  return { logger, plugin };
}
