// Safe handling of untrusted JSON in backup files (technical concept §8.3.5).
//
// `JSON.parse` itself is safe: it creates `__proto__` as an ordinary own property and never
// touches a prototype. The danger is everything after it. Code that copies such an object by
// assignment (`out[key] = value`, `Object.assign`, Zod's record and object parsers) either
// replaces the copy's prototype or, as Zod 4 does on purpose, silently drops the key; recursive
// code (Zod's `z.json()`, `JSON.stringify`) overflows the call stack on deeply nested input.
// A backup therefore never contains these keys or deep nesting, and import rejects them up front.

/**
 * Object keys a POWR backup never contains, at any depth. `__proto__` cannot be copied by
 * assignment without changing a prototype; `constructor` and `prototype` are the other two
 * steps of the classic prototype-pollution path (`obj.constructor.prototype.x = …`).
 */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Deepest nesting of arrays and objects in one backup JSON file. A table file is an array of
 * records (depth 1), a record an object (2), and its deepest values (instants, efforts, meta
 * values) are a few levels further down; 32 leaves room for future record shapes.
 */
const MAX_JSON_DEPTH = 32;

interface Frame {
  readonly value: unknown;
  readonly depth: number;
  readonly parent: Frame | null;
  readonly key: string | number | null;
}

/**
 * Returns why `value` may not appear in a backup (a reserved key or too deep nesting), or null.
 * Iterative, so hostile input cannot overflow the stack. Only own enumerable string keys are
 * inspected, which are exactly the keys `JSON.parse` creates and `JSON.stringify` writes.
 */
export function findUnsafeJson(value: unknown, maxDepth: number = MAX_JSON_DEPTH): string | null {
  const stack: Frame[] = [{ value, depth: 0, parent: null, key: null }];
  for (let frame = stack.pop(); frame; frame = stack.pop()) {
    const current = frame.value;
    if (current === null || typeof current !== 'object') continue;
    const depth = frame.depth + 1;
    if (depth > maxDepth) return `nesting deeper than ${maxDepth} levels at ${pathOf(frame)}`;
    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index--) {
        stack.push({ value: current[index], depth, parent: frame, key: index });
      }
      continue;
    }
    for (const key of Object.keys(current)) {
      if (RESERVED_KEYS.has(key)) return `reserved key "${key}" at ${pathOf(frame)}`;
      stack.push({ value: (current as Record<string, unknown>)[key], depth, parent: frame, key });
    }
  }
  return null;
}

export type JsonParseResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly problem: 'syntax' | 'unsafe'; readonly reason: string };

/** `JSON.parse` plus {@link findUnsafeJson}; never throws. */
export function parseUntrustedJson(text: string): JsonParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'syntax', reason: 'not valid JSON' };
  }
  const unsafe = findUnsafeJson(value);
  return unsafe === null ? { ok: true, value } : { ok: false, problem: 'unsafe', reason: unsafe };
}

function pathOf(frame: Frame): string {
  const segments: string[] = [];
  for (let current: Frame | null = frame; current?.parent; current = current.parent) {
    segments.push(typeof current.key === 'number' ? `[${current.key}]` : `.${current.key}`);
  }
  return `$${segments.toReversed().join('')}`;
}
