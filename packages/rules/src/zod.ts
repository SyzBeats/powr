import { z } from 'zod';

// The app's CSP forbids `new Function`, and Zod probes for it as soon as an object schema is
// created (ADR-0009). Every schema in this package imports `z` from here, so JIT is off before
// the first schema exists, whatever order a bundler evaluates the packages in.
z.config({ jitless: true });

export { z };
