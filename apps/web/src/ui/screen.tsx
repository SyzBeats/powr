import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '#ui/cn';

/** One screen: an h1 that receives focus on route changes (§8.14), then the content. */
export function Screen({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
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
