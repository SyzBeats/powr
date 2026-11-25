import { existsSync, readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';
import {
  acceptLegal,
  checkReflow,
  checkScreen,
  onboardToPreview,
  skipOptionalSteps,
} from './planning';
import { addExercise, dock, logSet, startEmptyWorkout } from './session';

/*
 * M5s settings, legal and explainability against the production build (Trusted Types enforced):
 * a rest default reaches the workout and resets (SET-03), one onboarding answer re-plans with a
 * preview (SET-08), the legal screens with their lazy texts (LEG-01/02/09), "How POWR decides"
 * reached from a "Why?" sheet (LEG-05, TD-33), and the attributions screen against the licence
 * inventory with the ECharts NOTICE (LEG-06). axe in light and dark, reflow at 320 px and 200%.
 */

/** "3:20" → 200. */
function seconds(text: string | null): number {
  const [minutes, rest] = (text ?? '0:00').split(':').map(Number);
  return (minutes ?? 0) * 60 + (rest ?? 0);
}

const byName = (a: string, b: string) => a.localeCompare(b);

async function restSeconds(page: Page): Promise<number> {
  const time = dock(page).getByTestId('timer-time');
  await expect(time).toHaveText(/^\d:\d\d$/);
  return seconds(await time.textContent());
}

test.describe('settings, legal and explainability (M5s)', () => {
  test('a rest default reaches the workout and resets to the evidence default (SET-03)', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 2, name: 'Profile and plan' })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await checkScreen(page, 'settings');
    await checkReflow(page, 'settings');

    await page
      .getByRole('region', { name: 'Workout', exact: true })
      .getByRole('link', { name: 'Rest times' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Rest times' })).toBeVisible();
    const strength = page.getByRole('textbox', { name: 'Strength sets' });
    await expect(strength).toHaveValue('180');
    const row = page.getByTestId('rest-session.rest.strength');
    await expect(row).toContainText('Evidence default: 3:00 (squat and deadlift 4:00)');
    await strength.fill('200');
    await expect(row.getByText('Your setting')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await checkScreen(page, 'settings-rest-times');
    await checkReflow(page, 'settings-rest-times');

    // The workout uses it: the squat rests 3:20 instead of the competition-lift 4:00.
    await page.goto('/session');
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await logSet(page, { weight: 100, reps: 5 });
    const own = await restSeconds(page);
    expect(own).toBeLessThanOrEqual(200);
    expect(own).toBeGreaterThan(190);

    // Reset to the evidence defaults; the next set rests 4:00 again.
    await page.goto('/settings/rest');
    await page.getByRole('button', { name: 'Reset all rest times' }).click();
    await expect(page.getByTestId('rest-status')).toHaveText(
      'Rest times reset to the evidence defaults.',
    );
    await expect(strength).toHaveValue('180');
    await page.goto('/session');
    await expect(page.getByRole('heading', { level: 1, name: 'Workout' })).toBeVisible();
    await logSet(page, { weight: 100, reps: 5 });
    const reset = await restSeconds(page);
    expect(reset).toBeLessThanOrEqual(240);
    expect(reset).toBeGreaterThan(230);
  });

  test('one onboarding answer changes the plan only after its preview (SET-08)', async ({
    page,
  }) => {
    await onboardToPreview(page);
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    await page.goto('/settings');
    const profile = page.getByRole('region', { name: 'Profile and plan' });
    await expect(profile.getByTestId('answer-schedule')).toContainText('Mon, Tue, Thu, Fri');
    await profile.getByRole('link', { name: 'Change: Your week' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your week' })).toBeVisible();
    await page.getByRole('button', { name: 'Saturday', exact: true }).click();
    await checkScreen(page, 'settings-profile-edit');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Your plan would change' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('replan-differences')).toContainText(
      'Training days a week: 4 → 5',
    );
    await checkScreen(page, 'settings-replan-preview');
    await checkReflow(page, 'settings-replan-preview');
    await page.getByRole('button', { name: /^Update my plan from / }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.goto('/settings');
    await expect(
      page.getByRole('region', { name: 'Profile and plan' }).getByTestId('answer-schedule'),
    ).toContainText('Mon, Tue, Thu, Fri, Sat');
  });

  test('the legal screens show their full texts before onboarding, with the draft marker', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to POWR' })).toBeVisible();
    await page.getByRole('link', { name: 'Read the full privacy notice' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible();
    // The lazy legal catalog: production builds carry no message text in the code.
    await expect(page.getByRole('heading', { level: 2, name: 'Your rights' })).toBeVisible();
    await expect(
      page.getByText(/Federal Data Protection and Information Commissioner/),
    ).toBeVisible();
    await expect(page.getByTestId('legal-draft')).toContainText("the publisher's postal address");
    await expect(page.getByTestId('legal-version')).toHaveText('Version 2026-11-25');
    await expect(
      page.getByRole('link', { name: 'tools@sz-development.com' }).first(),
    ).toHaveAttribute('href', 'mailto:tools@sz-development.com');
    await checkScreen(page, 'legal-privacy');
    await checkReflow(page, 'legal-privacy');

    await page.goto('/legal/disclaimer');
    await expect(page.getByRole('heading', { level: 2, name: 'Stop and get help' })).toBeVisible();
    await expect(page.getByText(/POWR is not medical advice/)).toBeVisible();
    await checkScreen(page, 'legal-disclaimer');
    await checkReflow(page, 'legal-disclaimer');

    await page.goto('/legal/imprint');
    await expect(page.getByRole('heading', { level: 2, name: 'Publisher' })).toBeVisible();
    await expect(page.getByTestId('address-placeholder')).toBeVisible();
    await checkScreen(page, 'legal-imprint');
    await checkReflow(page, 'legal-imprint');

    // The gate still asks for the acknowledgement of the new versions.
    await page.goto('/');
    await acceptLegal(page);
  });

  test('"How POWR decides" from a "Why?" sheet, with labels and full citations (LEG-05, TD-33)', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await startEmptyWorkout(page);
    await addExercise(page, 'Barbell back squat');
    await page
      .getByTestId('current-set')
      .getByRole('button', { name: /^Why\? / })
      .first()
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByTestId('why-sources')).toBeVisible();
    await expect(sheet.getByRole('link', { name: /^How POWR decides: / }).first()).toBeVisible();
    await checkScreen(page, 'why-sheet-citations');
    await sheet
      .getByRole('link', { name: /^How POWR decides: / })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'How POWR decides' })).toBeVisible();
    const target = page.locator(':focus');
    await expect(target).toHaveAttribute('id', /^param-/);
    await expect(target).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId('registry-versions')).toContainText('Rules registry:');
    await checkScreen(page, 'legal-how-powr-decides');
    await checkReflow(page, 'legal-how-powr-decides');
  });

  test('the attributions screen lists every distributed component of the inventory (LEG-06)', async ({
    page,
    request,
  }) => {
    await page.goto('/legal/attributions');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Open-source licences and attributions' }),
    ).toBeVisible();
    await expect(page.getByTestId('attributions-software')).toBeVisible();
    const shown = await page
      .getByTestId('attribution')
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset['name'] ?? ''));

    // Exactly the build's attributions, which the licence gate writes from the inventory.
    const built = (await (await request.get('/attributions.json')).json()) as {
      name: string;
    }[];
    expect(shown.toSorted(byName)).toEqual(built.map((entry) => entry.name).toSorted(byName));
    // And every distributed entry of licence-inventory.json (written by `pnpm licence`).
    const inventory = new URL('../../../licence-inventory.json', import.meta.url);
    if (existsSync(inventory)) {
      const distributed = (
        JSON.parse(readFileSync(inventory, 'utf8')) as { name: string; distributed: boolean }[]
      ).filter((entry) => entry.distributed);
      expect(shown.toSorted(byName)).toEqual(
        distributed.map((entry) => entry.name).toSorted(byName),
      );
    }
    expect(shown).toContain('echarts');
    expect(shown).toContain('powr-body-map-artwork');

    // Apache-2.0: the full NOTICE of ECharts.
    const notice = readFileSync(new URL('../node_modules/echarts/NOTICE', import.meta.url), 'utf8');
    await expect(
      page.locator('[data-testid="attribution"][data-name="echarts"] [data-testid="notice-text"]'),
    ).toHaveText(notice);
    await checkScreen(page, 'legal-attributions');
    await checkReflow(page, 'legal-attributions');
  });
});
