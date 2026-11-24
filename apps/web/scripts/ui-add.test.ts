import { describe, expect, it } from 'vitest';

import { useOwnCn, withoutCnPackage } from './ui-add';

describe('ui:add post-processing (TD-21)', () => {
  it('points registry imports of the cn package at #ui/cn', () => {
    expect(useOwnCn('import { cn } from "cn"\n')).toBe("import { cn } from '#ui/cn'\n");
    expect(useOwnCn("import { cn } from 'cn';\n")).toBe("import { cn } from '#ui/cn';\n");
    // Other packages that merely contain "cn" stay untouched.
    const other = 'import { cva } from "class-variance-authority"\nimport x from "cnx"\n';
    expect(useOwnCn(other)).toBe(other);
  });

  it('removes the cn package and leaves manifests without it alone', () => {
    const manifest = JSON.stringify({ dependencies: { clsx: '2.1.1', cn: '0.5.2' } });
    expect(JSON.parse(withoutCnPackage(manifest) ?? '{}')).toEqual({
      dependencies: { clsx: '2.1.1' },
    });
    expect(withoutCnPackage(JSON.stringify({ dependencies: { clsx: '2.1.1' } }))).toBeNull();
  });
});
