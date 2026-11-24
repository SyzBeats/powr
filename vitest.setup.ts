import * as fc from 'fast-check';

// Property tests use a fixed seed in CI so failures reproduce; locally they explore new seeds.
// A nightly job can set FC_SEED=random (§8.20).
const seed = process.env['FC_SEED'];
if (seed !== 'random' && (process.env['CI'] || seed)) {
  fc.configureGlobal({ seed: Number(seed ?? 20261124) });
}
