import type { Container } from './container';

/** What every route's `beforeLoad` sees: the composition root (the first-run guard reads it). */
export interface RouterContext {
  readonly container: Container;
}
