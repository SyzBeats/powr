import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Moves focus to an element that appears in the same update as the state that shows it, such as
 * an error summary (NFR-A11Y, WCAG 2.2 3.3.1 and 2.4.3): call `request()` together with the state
 * update; the element is focused in a layout effect, after React has committed it and before the
 * browser paints. A `requestAnimationFrame` right after `setState` could run before React drew the
 * summary (a render after an `await` is scheduled, not synchronous), and then nothing was focused,
 * so a keyboard or screen-reader user missed the summary (found as flaky component tests in M5p).
 * Every request focuses again, also when the summary was already on screen.
 */
export function useFocusRequest<T extends HTMLElement>(): readonly [
  ref: RefObject<T | null>,
  request: () => void,
] {
  const ref = useRef<T>(null);
  const [requests, setRequests] = useState(0);
  useLayoutEffect(() => {
    if (requests > 0) ref.current?.focus();
  }, [requests]);
  return [ref, () => setRequests((count) => count + 1)] as const;
}
