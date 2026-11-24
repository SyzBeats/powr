declare module 'spdx-expression-parse' {
  export interface LicenseInfo {
    license: string;
    plus?: true;
    exception?: string;
  }
  export interface ConjunctionInfo {
    conjunction: 'and' | 'or';
    left: LicenseNode;
    right: LicenseNode;
  }
  export type LicenseNode = LicenseInfo | ConjunctionInfo;
  export default function parse(expression: string): LicenseNode;
}
