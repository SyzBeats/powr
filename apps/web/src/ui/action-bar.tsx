import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '#ui/cn';

/**
 * A sticky bar of screen actions (Save, Cancel, Undo) that sits above the bottom navigation.
 *
 * WCAG 2.4.11 (Focus Not Obscured): while the bar is mounted, the page's bottom scroll padding
 * grows by the bar's measured height (`--action-bar-inset`, read in app.css). A field reached by
 * keyboard or switch access then scrolls clear of the bar, even when the buttons wrap at 320 px
 * or 200% text. The value is set through the CSSOM, which the CSP allows (no inline styles).
 */
export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = bar.current;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--action-bar-inset', `${element?.offsetHeight ?? 0}px`);
    });
    if (element) observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--action-bar-inset');
    };
  }, []);
  return (
    <div
      ref={bar}
      data-action-bar=""
      className={cn('sticky bottom-24 flex flex-col gap-2 bg-bg py-2', className)}
    >
      {children}
    </div>
  );
}
