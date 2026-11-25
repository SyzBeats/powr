/**
 * A strict reader for the body-map source SVG: only the small subset the artwork uses, so a
 * stray transform, style or unknown element fails the build instead of rendering differently in
 * the app than in the drawing program.
 *
 *   <svg viewBox>                         title and desc allowed
 *     <g id="front|back" data-view-box>   one per view, the app's viewBox for that view
 *       <path data-role="silhouette" d>   the figure's outline (decorative, exactly one)
 *       <path data-role="detail" d>       decorative lines over the regions (optional, open allowed)
 *       <path id="front.abs" d>           a display group without sub-regions
 *       <g id="front.chest">              a display group with sub-regions
 *         <path id="front.chest.clavicular" d>
 *
 * `fill`, `stroke` and `stroke-width` may stay on any element for previewing the file; the app
 * ignores them.
 */
export interface SvgNode {
  readonly name: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: readonly SvgNode[];
  readonly text: string;
}

const PREVIEW = ['fill', 'stroke', 'stroke-width'];
const ALLOWED: Record<string, readonly string[]> = {
  svg: ['xmlns', 'viewBox', ...PREVIEW],
  title: [],
  desc: [],
  g: ['id', 'data-view-box', ...PREVIEW],
  path: ['id', 'd', 'data-role', ...PREVIEW],
};

/** Parses the document into a tree; returns the problems instead of throwing. */
export function parseSvg(source: string): { root: SvgNode | null; issues: string[] } {
  const issues: string[] = [];
  const text = source
    .replace(/^﻿/, '')
    .replace(/^\s*<\?xml[^?]*\?>/, '')
    .replaceAll(/<!--[\s\S]*?-->/g, '');
  const stack: {
    name: string;
    attributes: Map<string, string>;
    children: SvgNode[];
    text: string;
  }[] = [];
  let root: SvgNode | null = null;
  const tag = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=/>]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  let index = 0;
  for (const match of text.matchAll(tag)) {
    const between = text.slice(index, match.index);
    index = match.index + match[0].length;
    if (between.includes('<'))
      issues.push(`unreadable markup near "${between.trim().slice(0, 30)}"`);
    if (stack.length > 0) stack.at(-1)!.text += between;
    else if (between.trim() !== '')
      issues.push(`text outside the svg element: "${between.trim().slice(0, 30)}"`);
    const [, closing, name = '', attributeText = '', selfClosing] = match;
    if (closing) {
      const open = stack.pop();
      if (!open || open.name !== name) {
        issues.push(`</${name}> does not close ${open ? `<${open.name}>` : 'anything'}`);
        return { root: null, issues };
      }
      const node: SvgNode = { ...open };
      if (stack.length > 0) stack.at(-1)!.children.push(node);
      else root = node;
      continue;
    }
    const allowed = ALLOWED[name];
    if (!allowed) issues.push(`<${name}> is not supported (svg, g, path, title, desc)`);
    const attributes = new Map<string, string>();
    for (const [, key = '', value = ''] of attributeText.matchAll(/([^\s=/>]+)\s*=\s*"([^"]*)"/g)) {
      if (allowed && !allowed.includes(key))
        issues.push(`<${name}> attribute "${key}" is not supported`);
      attributes.set(key, value);
    }
    const open = { name, attributes, children: [] as SvgNode[], text: '' };
    if (selfClosing) {
      const node: SvgNode = open;
      if (stack.length > 0) stack.at(-1)!.children.push(node);
      else root = node;
    } else stack.push(open);
  }
  if (text.slice(index).trim() !== '') issues.push('text after the svg element');
  if (stack.length > 0) issues.push(`<${stack.at(-1)!.name}> is not closed`);
  if (root?.name !== 'svg') issues.push('the document must be one <svg> element');
  return { root, issues };
}
