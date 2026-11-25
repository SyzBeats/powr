import type { Locator, Page } from '@playwright/test';

import { expect } from './fixtures';

/*
 * The M6a accessibility sweep's checks beyond axe (WCAG 2.2 AA, NFR-A11Y-02, NFR-A11Y-06): target
 * sizes (2.5.8 with its spacing and inline exceptions; 48 × 48 px and 8 px apart for the primary
 * workout controls), an accessible name on every control (from Chromium's accessibility tree) and
 * the page title (2.4.2).
 */

/** Interactive elements a pointer can hit. */
const TARGETS = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
].join(', ');

export interface TargetIssue {
  readonly target: string;
  readonly width: number;
  readonly height: number;
}

/**
 * WCAG 2.5.8 (AA): every target is at least 24 × 24 CSS px, or a 24 px circle centred on it
 * touches no other target (nor another undersized target's circle), or it is a link inside a
 * sentence. A visually hidden input counts by its label (the label is what a finger hits).
 */
export async function undersizedTargets(page: Page, within?: Locator): Promise<TargetIssue[]> {
  const root = within ? await within.elementHandle() : null;
  return page.evaluate(
    // The helpers run in the page: page.evaluate serializes this one function, so they live inside.
    // oxlint-disable unicorn/consistent-function-scoping
    ({ selector, scope }) => {
      const container = (scope as Element | null) ?? document.body;
      const visible = (element: Element) => {
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        if (style.pointerEvents === 'none') return false;
        if (element.closest('[inert], [aria-hidden="true"]')) return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      };
      const describe = (element: Element) => {
        const name =
          element.getAttribute('aria-label') ??
          element.textContent?.trim().slice(0, 40) ??
          element.getAttribute('name') ??
          '';
        return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} "${name}"`;
      };
      const boxes: { element: Element; box: DOMRect }[] = [];
      for (const element of container.querySelectorAll(selector)) {
        if (!visible(element)) continue;
        let target: Element = element;
        let box = element.getBoundingClientRect();
        if (box.width <= 2 || box.height <= 2) {
          // A visually hidden input: its label is the target.
          const id = element.getAttribute('id');
          const label =
            element.closest('label') ?? (id ? document.querySelector(`label[for="${id}"]`) : null);
          if (!label || !visible(label)) continue;
          target = label;
          box = label.getBoundingClientRect();
        }
        boxes.push({ element: target, box });
      }
      const unique = boxes.filter(
        (entry, index) => boxes.findIndex((other) => other.element === entry.element) === index,
      );
      const small = (box: DOMRect) => box.width < 23.5 || box.height < 23.5;
      const centre = (box: DOMRect) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
      const circleHitsBox = (c: { x: number; y: number }, box: DOMRect) => {
        const dx = Math.max(box.left - c.x, 0, c.x - box.right);
        const dy = Math.max(box.top - c.y, 0, c.y - box.bottom);
        return dx * dx + dy * dy < 12 * 12;
      };
      const inline = (element: Element) => {
        if (getComputedStyle(element).display !== 'inline') return false;
        const parent = element.parentElement;
        if (!parent) return false;
        // In a sentence: the parent has text of its own besides the link.
        return [...parent.childNodes].some(
          (node) => node !== element && (node.textContent ?? '').trim().length > 0,
        );
      };
      const issues: { target: string; width: number; height: number }[] = [];
      for (const entry of unique) {
        if (!small(entry.box) || inline(entry.element)) continue;
        const c = centre(entry.box);
        const crowded = unique.some((other) => {
          if (other === entry) return false;
          if (other.element.contains(entry.element) || entry.element.contains(other.element))
            return false;
          if (circleHitsBox(c, other.box)) return true;
          if (!small(other.box)) return false;
          const o = centre(other.box);
          return Math.hypot(o.x - c.x, o.y - c.y) < 24;
        });
        if (crowded)
          issues.push({
            target: describe(entry.element),
            width: Math.round(entry.box.width * 10) / 10,
            height: Math.round(entry.box.height * 10) / 10,
          });
      }
      return issues;
    },
    // oxlint-enable unicorn/consistent-function-scoping
    { selector: TARGETS, scope: root },
  );
}

/**
 * NFR-A11Y-02: the primary workout controls (confirm set, steppers, effort chips, timer controls)
 * are at least 48 × 48 CSS px and at least 8 px apart.
 */
export async function primaryTargetIssues(region: Locator): Promise<string[]> {
  return region.evaluate((root, selector) => {
    const boxes = [...root.querySelectorAll(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && box.width > 2 && box.height > 2;
      })
      .map((element) => ({
        name:
          element.getAttribute('aria-label') ??
          element.textContent?.trim().slice(0, 30) ??
          element.tagName,
        box: element.getBoundingClientRect(),
      }));
    const issues: string[] = [];
    for (const { name, box } of boxes) {
      if (box.width < 47.5 || box.height < 47.5)
        issues.push(`${name}: ${Math.round(box.width)} × ${Math.round(box.height)} px`);
    }
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const one = boxes[a]!.box;
        const two = boxes[b]!.box;
        const gapX = Math.max(two.left - one.right, one.left - two.right);
        const gapY = Math.max(two.top - one.bottom, one.top - two.bottom);
        if (Math.max(gapX, gapY) < 7.5)
          issues.push(
            `${boxes[a]!.name} and ${boxes[b]!.name}: ${Math.round(Math.max(gapX, gapY))} px apart`,
          );
      }
    }
    return issues;
  }, TARGETS);
}

/** Roles a user operates: each needs an accessible name (WCAG 4.1.2, NFR-A11Y-06). */
const NAMED_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'switch',
  'combobox',
  'listbox',
  'slider',
  'spinbutton',
  'tab',
  'menuitem',
  'option',
  'radiogroup',
  'dialog',
]);

/** Controls (and dialogs and radio groups) without a name, from Chromium's accessibility tree. */
export async function unnamedControls(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
      nodes: {
        ignored: boolean;
        role?: { value?: string };
        name?: { value?: string };
        properties?: { name: string; value: { value?: unknown } }[];
      }[];
    };
    return nodes
      .filter((node) => !node.ignored)
      .filter((node) => {
        const role = node.role?.value ?? '';
        if (!NAMED_ROLES.has(role)) return false;
        return (node.name?.value ?? '').trim() === '';
      })
      .map((node) => node.role?.value ?? '');
  } finally {
    await cdp.detach();
  }
}

/** The page title names the screen and the app (WCAG 2.4.2). */
export async function pageTitle(page: Page): Promise<string> {
  await expect(page).toHaveTitle(/^.+ · POWR$/);
  return page.title();
}
