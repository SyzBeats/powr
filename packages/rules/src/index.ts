export { resolveParam, type ParamOverride, type ResolvedParam } from './resolve';
export {
  EVIDENCE_TAGS,
  evidenceTagSchema,
  paramDefSchema,
  type EvidenceTag,
  type ParamDef,
} from './schema';

/** Registry SemVer + content hash; the build computes the hash from M1 on (§7.8). */
export const RULES_VERSION = '0.0.0+m0';
