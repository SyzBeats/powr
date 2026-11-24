import { Trans } from '@lingui/react/macro';

/** Shown when the database cannot be opened (§6.8). Data is never deleted automatically. */
export function StartupError() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">
        <Trans>POWR could not open its data</Trans>
      </h1>
      <p className="text-fg-muted">
        <Trans>Your data has not been changed. Close other POWR windows, then reload.</Trans>
      </p>
      <button
        type="button"
        className="min-h-target rounded-xl bg-primary px-4 font-semibold text-on-primary"
        onClick={() => location.reload()}
      >
        <Trans>Reload</Trans>
      </button>
    </main>
  );
}
