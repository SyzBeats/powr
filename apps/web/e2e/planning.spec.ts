import { expect, skipOnboarding, test } from './fixtures';
import {
  acceptLegal,
  checkReflow,
  checkScreen,
  onboardToPreview,
  skipOptionalSteps,
} from './planning';

test.describe('onboarding and planning (M2b: ONB, EQP, PLN)', () => {
  // Long flows with axe scans in two themes on every screen.
  test.describe.configure({ timeout: 120_000 });

  test('core path: preview with "Why?", accept, the plan is there afterwards', async ({ page }) => {
    const onStep = (name: string) => checkScreen(page, name);
    await onboardToPreview(page, { onStep });
    await skipOptionalSteps(page, onStep);
    await checkScreen(page, 'plan-preview');

    // "Why?" on the template choice: message, evidence label, focus back to the trigger.
    const why = page.getByRole('button', { name: /^Why\? Upper\/lower/ });
    await why.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: /^Why: / })).toBeVisible();
    await expect(sheet.getByText('Based on')).toBeVisible();
    await checkScreen(page, 'why-sheet');
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(why).toBeFocused();

    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Upper/lower ×2' })).toBeVisible();
    await checkScreen(page, 'plan-week');

    // The plan survives a reload, and Home shows the next planned session.
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Upper/lower ×2' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Home' })
      .click();
    await expect(page.getByTestId('next-session')).toBeVisible();
    await checkScreen(page, 'home');
  });

  test('resumes an interrupted onboarding at the same step (ONB-12)', async ({ page }) => {
    await page.goto('/');
    await acceptLegal(page);
    await page.getByRole('button', { name: 'Set up my plan' }).click();
    await page.getByRole('radio', { name: /^Powerbuilding/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your experience' })).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Your experience' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('radio', { name: /^Powerbuilding/ })).toBeChecked();
  });

  test('"Just let me log" skips plan generation (PLN-15)', async ({ page }) => {
    await skipOnboarding(page);
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Plan' })
      .click();
    await expect(page.getByRole('heading', { level: 2, name: 'Plan not set up' })).toBeVisible();
    await checkScreen(page, 'plan-not-set-up');
  });

  test('an empty Custom list gives a bodyweight plan with a note (decision 3)', async ({
    page,
  }) => {
    await onboardToPreview(page, { preset: 'Custom' });
    // Custom opens the editor straight away ("toggle what you have").
    await expect(page.getByText('Toggle what you have access to.')).toBeVisible();
    await checkScreen(page, 'equipment-editor-onboarding');
    await page.getByRole('button', { name: 'Continue' }).click();
    await skipOptionalSteps(page);
    await expect(page.getByText('Bodyweight plan')).toBeVisible();
    await expect(page.getByText(/saved your equipment list empty/)).toBeVisible();
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);
  });

  test('an equipment change offers substitutions and updates the plan (EQP-05)', async ({
    page,
  }) => {
    await onboardToPreview(page);
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    await page.goto('/settings/equipment');
    await checkScreen(page, 'equipment-list');
    await page.getByRole('link', { name: /^Edit / }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit equipment' })).toBeVisible();
    await checkScreen(page, 'equipment-editor');
    for (const item of ['Olympic barbell', 'Power rack', 'Squat stand'])
      await page.getByRole('checkbox', { name: item, exact: true }).click();
    await page.getByRole('button', { name: 'Save equipment' }).click();

    const review = page.getByRole('heading', { level: 1, name: 'Review plan changes' });
    await expect(review).toBeVisible();
    // A new view inside the same route starts at the top with focus on its heading (§8.14).
    await expect(review).toBeInViewport();
    await expect(review).toBeFocused();
    await checkScreen(page, 'equipment-substitutions');
    await page.getByRole('button', { name: /^Apply / }).click();
    await expect(page.getByText('Equipment saved and your plan updated.')).toBeVisible();
  });

  test('the plan editor validates live and applies a fix in one tap (PLN-09)', async ({ page }) => {
    await onboardToPreview(page);
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept and edit' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit plan' })).toBeVisible();
    // The live summary is a polite status region (WCAG 4.1.3).
    await expect(
      page.getByRole('status').filter({ hasText: /checks pass|need attention/ }),
    ).toHaveCount(1);

    // Remove a day's sets until a muscle drops below its target: a live warning with a fix.
    const fewer = page.getByRole('button', { name: /^One set fewer of / }).first();
    await fewer.click();
    // A second set fewer where the slot still has one to spare (the button disables at 1 set).
    if (await fewer.isEnabled()) await fewer.click({ timeout: 2_000 }).catch(() => undefined);
    const fix = page.getByRole('button', { name: /^Add \d+ sets? of / }).first();
    await expect(fix).toBeVisible();
    await checkScreen(page, 'plan-editor');
    await checkReflow(page, 'plan-editor');
    // The issue the fix belongs to changes with the next live validation (its numbers or gone).
    const issue = page.getByRole('listitem').filter({ has: fix });
    const before = await issue.first().locator('p').first().textContent();
    await fix.click();
    await expect(page.getByText(before!, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Undo last change' })).toBeEnabled();

    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('button', { name: 'From the next session' }).click();
    await expect(page).toHaveURL(/\/plan$/);
  });

  test('a missed session can be done today, merged or skipped (PLN-11)', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-30T08:00:00') });
    await onboardToPreview(page, { days: ['Monday', 'Wednesday', 'Friday'] });
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    // Four days later, Monday's and Wednesday's sessions are missed.
    await page.clock.setSystemTime(new Date('2026-12-04T08:00:00'));
    await page.reload();
    const missed = page.getByRole('heading', { level: 2, name: /missed session/ });
    await expect(missed).toBeVisible();
    await checkScreen(page, 'plan-missed');
    await page
      .getByRole('button', { name: /^Skip / })
      .first()
      .click();
    await expect(page.locator('output').first()).toContainText(/skip/i);
  });

  test('onboarding works offline after the first load (chunks precached)', async ({
    page,
    context,
    server,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to POWR' })).toBeVisible();
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active?.state !== 'activated')
        await new Promise((resolve) =>
          registration.active?.addEventListener('statechange', resolve),
        );
    });
    await context.setOffline(true);
    await server?.close();
    await page.reload();
    await onboardToPreview(page, {
      style: 'Powerlifting',
      days: ['Monday', 'Wednesday', 'Friday'],
    });
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);
  });

  test('onboarding reflows at 320 px and 200% text (NFR-A11Y-07)', async ({ page }) => {
    await page.goto('/');
    await checkReflow(page, 'onboarding-welcome');
    await acceptLegal(page);
    await page.getByRole('button', { name: 'Set up my plan' }).click();
    await checkReflow(page, 'onboarding-goal');
    await page.getByRole('radio', { name: /^Bodybuilding/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await checkReflow(page, 'onboarding-experience');
  });

  test('keyboard focus never hides behind the sticky action bar (WCAG 2.4.11)', async ({
    page,
  }) => {
    await skipOnboarding(page);
    for (const fontSize of ['', '200%']) {
      await page.goto('/settings/equipment/new?preset=preset.commercial-gym');
      await expect(page.getByRole('heading', { level: 1, name: 'New equipment' })).toBeVisible();
      // CSSOM, not a <style> element: the CSP allows no inline styles.
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, fontSize);
      let checked = 0;
      for (let step = 0; step < 40; step += 1) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => {
          const active = document.activeElement;
          const bar = document.querySelector('[data-action-bar]');
          const header = document.querySelector('header');
          if (!active || active === document.body || !bar || !header) return null;
          if (bar.contains(active) || header.contains(active) || active.closest('nav')) return null;
          const box = active.getBoundingClientRect();
          const labelledBy = active.getAttribute('aria-labelledby');
          const name =
            active.getAttribute('aria-label') ??
            (labelledBy ? document.getElementById(labelledBy)?.textContent : null) ??
            (active as HTMLInputElement).labels?.[0]?.textContent ??
            active.closest('label')?.textContent ??
            active.textContent;
          return {
            name: (name || active.tagName).trim().slice(0, 40),
            top: box.top,
            bottom: box.bottom,
            headerBottom: header.getBoundingClientRect().bottom,
            barTop: bar.getBoundingClientRect().top,
          };
        });
        if (!focus) continue;
        checked += 1;
        const where = `"${focus.name}" at ${fontSize || '100%'} text`;
        expect(focus.bottom, `${where} is hidden behind the action bar`).toBeLessThanOrEqual(
          focus.barTop + 1,
        );
        expect(focus.top, `${where} is hidden behind the header`).toBeGreaterThanOrEqual(
          focus.headerBottom - 1,
        );
      }
      expect(checked, 'the walk reached the equipment rows').toBeGreaterThan(20);
    }
  });

  test('the other new screens pass axe in both themes', async ({ page }) => {
    for (const path of ['/legal/privacy', '/legal/disclaimer']) {
      await page.goto(path);
      await checkScreen(page, path.slice(1).replace('/', '-'));
    }
    await onboardToPreview(page);
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    // A planned session's sheet: exercises, move and swap (tap alternatives to dragging).
    await page
      .getByRole('button', { name: /^(Upper|Lower) / })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await checkScreen(page, 'plan-session-sheet');
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Plan a break' }).click();
    await checkScreen(page, 'plan-break-form');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.goto('/plan/next');
    await expect(page.getByRole('button', { name: 'Accept the next block' })).toBeVisible();
    await checkScreen(page, 'plan-next-block');

    await page.goto('/settings');
    await checkScreen(page, 'settings');
    await page.goto('/settings/equipment/new?preset=preset.hotel-gym');
    await expect(page.getByRole('heading', { level: 1, name: 'New equipment' })).toBeVisible();
    await checkScreen(page, 'equipment-new');
  });
});
