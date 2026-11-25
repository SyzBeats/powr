import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Trans, useLingui } from '@lingui/react/macro';
import { useBlocker, useRouter } from '@tanstack/react-router';
import { useRef, useState } from 'react';

import { buttonClass } from '#ui/button-class';

interface Question {
  /** `true`: leave and lose the changes; `false`: stay on the editor. */
  readonly answer: (leave: boolean) => void;
}

/**
 * PWA-12, TD-68 (M6c): asks before an editor's unsaved changes are lost. While `when` is true,
 * TanStack Router's blocker stops every navigation to another screen (in-app links, Back, the
 * Android back gesture, the update notice's link) and an alert dialog asks: "Keep editing" (the
 * first and focused choice, also Escape and Back) or "Discard changes". A sheet's own history
 * entry has the same path, so Back still closes an open sheet first. Reloading or closing the
 * tab gets the browser's own "Leave site?" prompt.
 *
 * Links and back steps are handled differently: a link waits for the answer before it moves; a
 * back step has already moved the browser, so it is undone at once and "Discard changes" takes
 * it again without the blocker.
 */
export function UnsavedChangesGuard({ when, description }: { when: boolean; description: string }) {
  const { t } = useLingui();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const question = useRef<Question | null>(null);

  const ask = (answer: (leave: boolean) => void) => {
    question.current = {
      answer: (leave) => {
        question.current = null;
        setOpen(false);
        answer(leave);
      },
    };
    setOpen(true);
  };

  useBlocker({
    disabled: !when,
    enableBeforeUnload: when,
    shouldBlockFn: ({ current, next, action }) => {
      // Opening or closing a sheet (Back) moves within this screen: never asked.
      if (current.pathname === next.pathname) return false;
      // Back while the question is open: keep editing, like Escape.
      if (question.current) {
        question.current.answer(false);
        return true;
      }
      if (action === 'PUSH' || action === 'REPLACE')
        return new Promise<boolean>((resolve) => ask((leave) => resolve(!leave)));
      ask((leave) => {
        if (!leave) return;
        if (action === 'FORWARD') router.history.forward({ ignoreBlocker: true });
        else router.history.back({ ignoreBlocker: true });
      });
      return true;
    },
  });

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) question.current?.answer(false);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-fg opacity-40" />
        <AlertDialog.Popup
          data-testid="unsaved-changes"
          className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[90dvh] w-auto max-w-md -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-3xl border border-border bg-surface p-4 text-fg outline-none"
        >
          <AlertDialog.Title className="text-xl font-bold">
            {t`Discard your changes?`}
          </AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="flex flex-col gap-3 pt-2">
            <AlertDialog.Close className={buttonClass({ variant: 'primary', size: 'lg' })}>
              <Trans>Keep editing</Trans>
            </AlertDialog.Close>
            <button
              type="button"
              className={buttonClass({ variant: 'danger', size: 'lg' })}
              onClick={() => question.current?.answer(true)}
            >
              <Trans>Discard changes</Trans>
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
