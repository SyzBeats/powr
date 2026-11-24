import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '#ui/cn';

/**
 * One screen: an h1 that receives focus on route changes (§8.14), then the content. The page title
 * names the screen (WCAG 2.4.2).
 *
 * A view can also swap to another view inside the same route (the equipment editor's "Review plan
 * changes", the onboarding steps), and React then keeps this Screen instead of mounting a new one.
 * Its title changes, so a title change counts as a new screen: the page scrolls to the top and the
 * new h1 gets focus. On the first render the router's scroll restoration decides the position.
 * The page title is a message too: screen readers announce it, and the order of title and app
 * name is a translator's choice.
 */
export function Screen({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useLingui();
  const heading = useRef<HTMLHeadingElement>(null);
  const shownTitle = useRef(title);
  const pageTitle = t`${title} · POWR`;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);
  useEffect(() => {
    if (shownTitle.current === title) return;
    shownTitle.current = title;
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <section className={cn('mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4', className)}>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
        {title}
      </h1>
      {children}
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl bg-surface p-4', className)}>
      {children}
    </div>
  );
}
