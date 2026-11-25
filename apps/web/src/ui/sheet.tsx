import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { useBackDismiss } from '#ui/back-dismiss';
import { cn } from '#ui/cn';

/**
 * Bottom sheet (§8.9.4) on Base UI's Dialog: modal, traps focus, closes on Escape and the visible
 * Close button (no gesture-only path, NFR-A11Y-04) and returns focus to the element that opened
 * it (§8.14). The motion is a short slide that `prefers-reduced-motion` turns off (app.css).
 * M5d (PWA-12): the Android back gesture closes the sheet first; the screen stays.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children: ReactNode;
  className?: string;
}) {
  useBackDismiss(open, () => onOpenChange(false));
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-fg opacity-40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            'fixed inset-x-0 bottom-0 z-30 mx-auto flex max-h-[90dvh] w-full max-w-xl flex-col overflow-y-auto rounded-t-3xl border-t border-border bg-surface px-4 pt-4 pb-safe text-fg transition-transform duration-200 outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="pt-2 text-xl font-bold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="flex size-target shrink-0 items-center justify-center rounded-xl border border-control"
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="text-fg-muted">{description}</Dialog.Description>
          ) : null}
          <div className="flex flex-col gap-3 py-4">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
