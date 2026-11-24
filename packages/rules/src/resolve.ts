import type { ParamDef } from './schema';

export interface ParamOverride {
  readonly paramId: string;
  readonly value: unknown;
}

export interface ResolvedParam {
  readonly id: string;
  readonly value: unknown;
  readonly origin: 'default' | 'user';
}

/**
 * Resolution order (§8.6.3): default -> context variant -> global user override ->
 * per-exercise override. M0 implements default and global override only.
 */
export function resolveParam(def: ParamDef, overrides: readonly ParamOverride[]): ResolvedParam {
  if (def.blockedUntilVerified && !def.verified) {
    throw new Error(`Parameter ${def.id} is blocked until verified (E-5)`);
  }
  const override = def.userOverridable
    ? overrides.find((candidate) => candidate.paramId === def.id)
    : undefined;
  return override
    ? { id: def.id, value: override.value, origin: 'user' }
    : { id: def.id, value: def.value, origin: 'default' };
}
