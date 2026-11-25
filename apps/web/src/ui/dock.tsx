import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';

import { cn } from '#ui/cn';

/**
 * The session screen's control dock (§8.9.4 thumb zone, NFR-A11Y-03): the primary workout
 * controls fixed at the bottom of the screen, just above the bottom navigation, so they sit in
 * the lower 60% of a 360 × 780 screen at any scroll position. It sits early in the DOM (right after
 * the current set), so the reading and tab order stay logical.
 *
 * WCAG 1.4.10 and 2.4.11: the page's bottom padding and scroll padding grow by the dock's
 * measured height (`--dock-inset`, read in app.css), and when the dock would cover most of the
 * screen (320 px, 200% text) it falls back into the normal flow instead of staying fixed.
 */
export function Dock({
  children,
  className,
  label,
  ref,
}: {
  children: ReactNode;
  className?: string;
  /** The region's name ("Log this set"). */
  label: string;
  /** The inner wrapper of the controls (focus management). */
  ref?: Ref<HTMLDivElement>;
}) {
  const dock = useRef<HTMLElement>(null);
  const [fixed, setFixed] = useState(true);
  useEffect(() => {
    const element = dock.current;
    const root = document.documentElement;
    const measure = () => {
      const height = element?.offsetHeight ?? 0;
      const nav = Number.parseFloat(
        getComputedStyle(root).getPropertyValue('--bottom-nav-height') || '0',
      );
      const fits = height + nav <= window.innerHeight * 0.7;
      setFixed(fits);
      root.style.setProperty('--dock-inset', fits ? `${height}px` : '0px');
    };
    const observer = new ResizeObserver(measure);
    if (element) observer.observe(element);
    addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      removeEventListener('resize', measure);
      root.style.removeProperty('--dock-inset');
    };
  }, []);
  return (
    <section
      ref={dock}
      aria-label={label}
      data-dock={fixed ? 'fixed' : 'flow'}
      className={cn(
        fixed
          ? 'fixed inset-x-0 bottom-(--bottom-nav-height,3.5rem) z-10 border-t border-border bg-bg'
          : 'relative rounded-2xl border border-border bg-bg',
        className,
      )}
    >
      <div ref={ref} className="mx-auto flex w-full max-w-xl flex-col gap-2 px-3 py-2">
        {children}
      </div>
    </section>
  );
}
