export {
  ALLOWED_DEPENDENCIES,
  checkDependencyMatrix,
  findImpureCalls,
  type Violation,
} from './rules';
export { readWorkspace, type WorkspacePackage } from './workspace';
