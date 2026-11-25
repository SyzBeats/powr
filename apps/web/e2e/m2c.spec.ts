import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import {
  checkReflow,
  checkScreen,
  expectPreview,
  onboardToPreview,
  skipBaselines,
  skipOptionalSteps,
  skipPriorities,
} from './planning';

const pad = (value: number) => String(value).padStart(2, '0');

/** A date `days` before today on the device, as a date input takes it. */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const lift = (page: Page, name: string) => page.getByRole('region', { name });

test.describe('M2c planning gaps (ONB-08, PLN-02, PLN-08, TD-36)', () => {
  // Long flows with axe scans in two themes on the new screens.
  test.describe.configure({ timeout: 120_000 });

  test('baselines: entered lifts give a starting e1RM and are kept with the profile (ONB-08)', async ({
    page,
  }) => {
    await onboardToPreview(page, {
      style: 'Powerlifting',
      days: ['Monday', 'Wednesday', 'Friday'],
    });
    await skipPriorities(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Your current lifts' })).toBeVisible();
    const squat = lift(page, 'Barbell back squat');
    const bench = lift(page, 'Barbell bench press');
    const deadlift = lift(page, 'Barbell deadlift');
    await expect(squat).toBeVisible({ timeout: 15_000 });
    await expect(bench).toBeVisible();
    await expect(deadlift).toBeVisible();
    await checkScreen(page, 'onboarding-baselines');

    // A recent set: 100 kg × 4 with 2 reps left → effective reps 6 → Wathan 83.1% → 120.3 kg.
    await squat.getByRole('button', { name: 'A recent set' }).click();
    await squat.getByRole('textbox', { name: 'Weight' }).fill('100');
    await squat.getByRole('textbox', { name: 'Reps' }).fill('4');
    await expect(squat.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(squat.getByText('Estimated 1-rep max: 120.3 kg')).toBeVisible();

    // A known 1RM from more than 3 months ago: used, with the "refined automatically" hint.
    await bench.getByRole('button', { name: 'My 1-rep max' }).click();
    await bench.getByRole('textbox', { name: '1-rep max' }).fill('102.5');
    await bench.getByLabel('When did you lift it? (optional)').fill(daysAgo(200));
    await expect(bench.getByText('Estimated 1-rep max: 102.5 kg')).toBeVisible();
    await expect(bench.getByText(/You lifted this max a while ago/)).toBeVisible();
    await bench.getByRole('button', { name: 'Why? the estimate for Barbell bench press' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(/Your known 1-rep max, 102.5 kg/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();

    // An unfinished entry is pointed out, next to its field and in the summary (WCAG 3.3.1).
    await deadlift.getByRole('button', { name: 'A recent set' }).click();
    await deadlift.getByRole('textbox', { name: 'Weight' }).fill('140');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('alert')).toContainText('Barbell deadlift: enter the reps');
    await expect(deadlift.getByText(/Barbell deadlift: enter the reps/)).toBeVisible();
    await checkScreen(page, 'onboarding-baselines-entered');
    await checkReflow(page, 'onboarding-baselines-entered');
    await deadlift.getByRole('button', { name: 'Not now' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expectPreview(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    // Stored in the profile: re-planning shows them again, prefilled.
    await page.goto('/plan/setup/baselines');
    await expect(
      lift(page, 'Barbell back squat').getByRole('textbox', { name: 'Weight' }),
    ).toHaveValue('100', {
      timeout: 15_000,
    });
    await expect(
      lift(page, 'Barbell back squat').getByRole('textbox', { name: 'Reps' }),
    ).toHaveValue('4');
    await expect(
      lift(page, 'Barbell bench press').getByRole('textbox', { name: '1-rep max' }),
    ).toHaveValue('102.5');
  });

  test('the baselines step is skipped in one tap; the first sessions calibrate', async ({
    page,
  }) => {
    await onboardToPreview(page);
    await skipPriorities(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Your current lifts' })).toBeVisible();
    await page.getByRole('button', { name: 'Why? starting without these numbers' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(/POWR calibrates/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();
    await skipBaselines(page);
  });

  test('a different plan: the generator says why it does not fit, then plans it (PLN-02)', async ({
    page,
  }) => {
    await onboardToPreview(page, {
      days: ['Monday', 'Wednesday', 'Friday'],
      minutes: '45 min',
    });
    await skipOptionalSteps(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Full body ×3' })).toBeVisible();

    await page.getByRole('button', { name: 'Choose a different plan' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('radio', { name: /^Full body ×3/ })).toBeChecked();
    await expect(sheet.getByText(/^Recommended for your 3 training days/)).toBeVisible();
    // Two plans need four days: Upper/lower ×2 and its alternative Full body ×4 (TD-37, M5).
    await expect(sheet.getByText('Needs 4 training days a week.')).toHaveCount(2);
    await expect(sheet.getByRole('radio', { name: /^Full body ×4/ })).toBeVisible();
    await checkScreen(page, 'plan-template-chooser');
    await sheet.getByRole('radio', { name: /^Upper\/lower ×2/ }).click();
    await expect(sheet).toHaveCount(0);

    // The generator's own check, in its existing words, with the ways out.
    await expect(
      page.getByText(/Upper\/lower ×2 is made for a different style or number of training days/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use the recommended plan' })).toBeVisible();
    await checkScreen(page, 'plan-template-refused');

    // Four days fit the chosen plan: the choice is kept while the days change.
    await page.getByRole('button', { name: 'Change days', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your week' })).toBeVisible();
    await page.getByRole('button', { name: 'Thursday', exact: true }).click();
    for (const heading of ['Your week', 'Units and body', 'Your equipment']) {
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await page.getByRole('button', { name: 'Continue' }).click();
    }
    await skipOptionalSteps(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Upper/lower ×2' })).toBeVisible();
    await expect(page.getByText(/^You chose Upper\/lower ×2/)).toBeVisible();
    // 45 minutes: the time budget shows as the usual note and checks (PLN-14).
    await expect(page.getByText('Your session time is tight')).toBeVisible();
    await checkScreen(page, 'plan-preview-chosen-template');
  });

  test('the block length changes the first block on the calendar (PLN-08)', async ({ page }) => {
    await onboardToPreview(page);
    await skipOptionalSteps(page);
    const block = page.getByRole('list', { name: 'Your first block' });
    await expect(block.getByRole('listitem')).toHaveCount(6);
    await expect(block.getByRole('listitem').nth(5)).toContainText('Week 6');
    await expect(block.getByRole('listitem').nth(5)).toContainText('Lighter week');

    // The evidence-based default and its why.
    await expect(page.getByText('Recommended: 5 weeks. Pick from 3 to 8.')).toBeVisible();
    await page.getByRole('button', { name: 'Why? the block length' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(/This is the plan's default/)).toBeVisible();
    await expect(sheet.getByText('Based on')).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();

    await page
      .getByRole('group', { name: 'Training weeks before the lighter week' })
      .getByRole('button', { name: '7', exact: true })
      .click();
    await expect(block.getByRole('listitem')).toHaveCount(8);
    await expect(block.getByRole('listitem').nth(6)).not.toContainText('Lighter week');
    await expect(block.getByRole('listitem').nth(7)).toContainText('Week 8');
    await expect(block.getByRole('listitem').nth(7)).toContainText('Lighter week');
    await expect(page.getByText('7 weeks of training, then a lighter week')).toBeVisible();
    await checkScreen(page, 'plan-preview-block-length');
    await checkReflow(page, 'plan-preview-block-length');
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);
  });

  test('the next block keeps the time-budget rule at 45 minutes (TD-36)', async ({ page }) => {
    await onboardToPreview(page, { minutes: '45 min' });
    await skipOptionalSteps(page);
    await expect(page.getByText('Your session time is tight')).toBeVisible();
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    await page.goto('/plan/next');
    await expect(page.getByRole('button', { name: 'Accept the next block' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Your session time is tight')).toBeVisible();
    await expect(page.getByText(/set lower, towards the minimum effective dose/)).toBeVisible();
    await checkScreen(page, 'plan-next-block-budget');
  });
});
