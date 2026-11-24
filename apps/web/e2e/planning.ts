import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect } from './fixtures';

/**
 * Helpers of the M2b onboarding and planning tests: the onboarding path, axe in both themes, and
 * screenshots for the product owner (`M2B_SCREENS=<dir>`, 360 × 780, light and dark).
 */

const SCREENS = process.env['M2B_SCREENS'];

/** axe (WCAG 2.2 A/AA) in light and dark; with M2B_SCREENS set, a screenshot of each. */
export async function checkScreen(page: Page, name: string): Promise<void> {
  // A screen has its h1; a modal sheet hides the page behind it from assistive technology.
  await expect(
    page
      .getByRole('dialog')
      .or(page.getByRole('heading', { level: 1 }))
      .first(),
  ).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    // Reduced motion: no colour transitions mid-scan (and the reduced-motion styles get checked).
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    );
    expect(
      serious.map(
        (violation) =>
          `${name} (${colorScheme}): ${violation.id} ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
      ),
    ).toEqual([]);
    if (SCREENS) {
      mkdirSync(SCREENS, { recursive: true });
      // A whole-page shot, unless a sheet is open (it is fixed to the 360 × 780 viewport).
      const sheet = (await page.getByRole('dialog').count()) > 0;
      await page.screenshot({
        path: join(SCREENS, `${name}-${colorScheme}.png`),
        fullPage: !sheet,
      });
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

/** WCAG 1.4.4/1.4.10 (NFR-A11Y-07): 320 CSS px and 200% text without horizontal scrolling. */
export async function checkReflow(page: Page, name: string): Promise<void> {
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 780 });
  // CSSOM, not a <style> element: the CSP allows no inline styles.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll('body *')]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.right > width + 1 || box.left < -1;
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 120))
      .slice(0, 5);
  });
  expect(overflow, `${name}: content wider than 320 px at 200% text`).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
    `${name}: horizontal scrolling`,
  ).toBeLessThanOrEqual(320);
  if (SCREENS) await page.screenshot({ path: join(SCREENS, `${name}-320px-200pct.png`) });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  if (viewport) await page.setViewportSize(viewport);
}

/** The legal gate: both confirmations, then the chosen path. */
export async function acceptLegal(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to POWR' })).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'I have read the health notice and the privacy summary.' })
    .click();
  await page.getByRole('checkbox', { name: 'I am 16 or older.' }).click();
}

export interface OnboardingChoices {
  readonly style?: 'Bodybuilding' | 'Powerlifting' | 'Powerbuilding';
  readonly days?: readonly string[];
  readonly minutes?: string;
  readonly preset?: string;
  /** Called on each step before Continue (axe, screenshots). */
  readonly onStep?: (name: string) => Promise<void>;
}

/** The onboarding core path from the legal gate to the plan preview (ONB-01…10). */
export async function onboardToPreview(page: Page, choices: OnboardingChoices = {}): Promise<void> {
  const step = async (name: string) => choices.onStep?.(name);
  await page.goto('/');
  await step('onboarding-welcome');
  await acceptLegal(page);
  await page.getByRole('button', { name: 'Set up my plan' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Your goal' })).toBeVisible();
  await page
    .getByRole('radio', { name: new RegExp(`^${choices.style ?? 'Bodybuilding'}`) })
    .click();
  await step('onboarding-goal');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Your experience' })).toBeVisible();
  await page.getByRole('radio', { name: '2 to 5 years' }).click();
  await page.getByRole('radio', { name: 'I trained in the last week' }).click();
  await page.getByRole('radio', { name: 'I know a bit' }).click();
  await step('onboarding-experience');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Your week' })).toBeVisible();
  for (const day of choices.days ?? ['Monday', 'Tuesday', 'Thursday', 'Friday'])
    await page.getByRole('button', { name: day, exact: true }).click();
  await page.getByRole('button', { name: choices.minutes ?? '75 min', exact: true }).click();
  await step('onboarding-schedule');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Units and body' })).toBeVisible();
  await page.getByRole('button', { name: 'Kilograms (kg)' }).click();
  await step('onboarding-body');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Your equipment' })).toBeVisible();
  await page
    .getByRole('radio', { name: new RegExp(`^${choices.preset ?? 'Commercial gym'}`) })
    .click();
  await step('onboarding-equipment');
  await page.getByRole('button', { name: 'Use this preset' }).click();
}

/** Skips the optional priorities step. */
export async function skipPriorities(page: Page, onStep?: (name: string) => Promise<void>) {
  await expect(page.getByRole('heading', { level: 1, name: 'Priorities' })).toBeVisible();
  await onStep?.('onboarding-priorities');
  await page.getByRole('button', { name: 'Skip this step' }).click();
}

/** Skips the optional baselines step (ONB-08: one tap) and waits for the generated preview. */
export async function skipBaselines(page: Page, onStep?: (name: string) => Promise<void>) {
  await expect(page.getByRole('heading', { level: 1, name: 'Your current lifts' })).toBeVisible();
  await onStep?.('onboarding-baselines');
  await page.getByRole('button', { name: 'Skip this step' }).click();
  await expectPreview(page);
}

/** The generated plan preview (ONB-10). */
export async function expectPreview(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Your plan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept plan' })).toBeVisible({ timeout: 15_000 });
}

/** Skips both optional steps (priorities, baselines) and waits for the generated preview. */
export async function skipOptionalSteps(page: Page, onStep?: (name: string) => Promise<void>) {
  await skipPriorities(page, onStep);
  await skipBaselines(page, onStep);
}
