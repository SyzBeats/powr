import { z } from 'zod';

// The CSP forbids `new Function`, and Zod probes for it as soon as an object schema is created
// (ADR-0009). App code imports `z` from here so JIT is off before its first schema exists.
z.config({ jitless: true });

export { z };
