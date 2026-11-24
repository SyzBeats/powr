/**
 * The `default` branch of a switch that handles every member of a union: TypeScript fails to
 * compile when a new member is added and not handled, and every path of the function returns a
 * value (`consistent-return`). Reaching it at run time means stored data holds an unknown value.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
