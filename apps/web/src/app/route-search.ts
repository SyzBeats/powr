import type { SearchSchemaInput } from '@tanstack/react-router';

/**
 * A route's search params as the router hands them over: not validated yet (TD-63). Every key of
 * the route's search type may hold any value, and any other key may be there too, so a screen
 * cannot use one before the route's validator (`features/…/search.ts`) has turned the params into
 * the typed search.
 */
export type RawSearch<T> = { readonly [K in keyof T]?: unknown } & Readonly<
  Record<string, unknown>
>;

/**
 * `validateSearch` for a route definition (TD-63, M5z). Route definitions are on the startup path
 * (TanStack Router reads `validateSearch` from the definition before it loads the route's chunk),
 * so a real validator there costs entry JS on every launch. This one only types the search: links
 * and `navigate` take `T` (TanStack's `SearchSchemaInput`), the params pass through unchanged, and
 * `Route.useSearch()` returns `RawSearch<T>`. The route's component, which the router plugin splits
 * into the route's lazy chunk, validates them with the route's own validator, so the validators
 * load with their screens and an invalid value still never reaches a screen.
 */
export function deferredSearch<T extends object>(): (
  search: T & SearchSchemaInput,
) => RawSearch<T> {
  return passThrough;
}

function passThrough(search: object): Readonly<Record<string, unknown>> {
  return search as Readonly<Record<string, unknown>>;
}
