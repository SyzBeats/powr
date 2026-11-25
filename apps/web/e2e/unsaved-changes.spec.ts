import type { Page } from '@playwright/test';

import { expect, skipOnboarding, test } from './fixtures';
import { checkScreen, onboardToPreview, skipOptionalSteps } from './planning';

/*
 * PWA-12, TD-68 (M6c, release checklist G-01): the plan editor and the equipment editor ask before
 * unsaved changes are lost: on an in-app link, on Back and on the Android back gesture (in a PWA
 * the gesture is a history step back, so `history.back()` stands in for it). The question is an
 * alert dialog with two choices; "Keep editing" is focused and also answers Escape and Back.
 */

const question = (page: Page) => page.getByRole('alertdialog', { name: 'Discard your changes?' });

/** The back gesture of an installed app: one step back in the history. */
async function backGesture(page: Page): Promise<void> {
  await page.evaluate(() => history.back());
}

test.describe('unsaved changes (PWA-12, TD-68)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('the plan editor asks before discarding edits: link, Back, gesture, Escape', async ({
    page,
  }) => {
    await onboardToPreview(page);
    await skipOptionalSteps(page);
    await page.getByRole('button', { name: 'Accept plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.getByRole('link', { name: 'Edit plan' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit plan' })).toBeVisible();

    // Nothing changed yet: leaving does not ask.
    await page.getByRole('link', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.getByRole('link', { name: 'Edit plan' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit plan' })).toBeVisible();

    // One edit; an in-app link (the bottom navigation) now asks.
    await page
      .getByRole('button', { name: /^One set more of / })
      .first()
      .click();
    await expect(page.getByRole('button', { name: 'Undo last change' })).toBeEnabled();
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Home' })
      .click();
    const dialog = question(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Your changes to the plan are not saved.');
    // The safe choice has focus (WCAG 2.4.3); the dialog passes axe in both themes.
    await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await checkScreen(page, 'unsaved-changes-plan');
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/plan\/edit$/);
    await expect(page.getByRole('button', { name: 'Undo last change' })).toBeEnabled();

    // The back gesture asks; Escape keeps editing.
    await backGesture(page);
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/plan\/edit$/);
    await expect(page.getByRole('button', { name: 'Undo last change' })).toBeEnabled();

    // A sheet's own history entry: Back closes the sheet and does not ask.
    await page
      .getByRole('button', { name: /^Swap / })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await backGesture(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/plan\/edit$/);

    // Back while asking is "Keep editing" too.
    await backGesture(page);
    await expect(dialog).toBeVisible();
    await backGesture(page);
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/plan\/edit$/);

    // The editor's own "Discard" link asks as well; "Discard changes" leaves without saving.
    await page.getByRole('link', { name: 'Discard', exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    // The gesture with "Discard changes" goes back for real.
    await page.getByRole('link', { name: 'Edit plan' }).click();
    await page
      .getByRole('button', { name: /^One set more of / })
      .first()
      .click();
    await expect(page.getByRole('button', { name: 'Undo last change' })).toBeEnabled();
    await backGesture(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page).toHaveURL(/\/plan$/);

    // Saving leaves without asking.
    await page.getByRole('link', { name: 'Edit plan' }).click();
    await page
      .getByRole('button', { name: /^One set more of / })
      .first()
      .click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('button', { name: 'From the next workout' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(dialog).toHaveCount(0);
  });

  test('the equipment editor asks before discarding changes, and not after saving', async ({
    page,
  }) => {
    await skipOnboarding(page);
    const fresh = '/settings/equipment/new?preset=preset.commercial-gym';
    await page.goto(fresh);
    await expect(page.getByRole('heading', { level: 1, name: 'New equipment' })).toBeVisible();

    // Untouched: Cancel leaves at once.
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Equipment' })).toBeVisible();

    // A profile to edit (saving a new one leaves without a question).
    await page.goto(fresh);
    await expect(page.getByRole('heading', { level: 1, name: 'New equipment' })).toBeVisible();
    await page.getByRole('button', { name: 'Save equipment' }).click();
    await expect(page.getByText('Equipment saved.')).toBeVisible();

    await page
      .getByRole('link', { name: /^Edit / })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit equipment' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Power rack', exact: true }).click();

    const dialog = question(page);
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Your changes to this equipment are not saved.');
    await checkScreen(page, 'unsaved-changes-equipment');
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit equipment' })).toBeVisible();

    await backGesture(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Equipment' })).toBeVisible();

    // Undoing the change by hand: nothing unsaved, nothing asked.
    await page
      .getByRole('link', { name: /^Edit / })
      .first()
      .click();
    const rack = page.getByRole('checkbox', { name: 'Power rack', exact: true });
    await rack.click();
    await rack.click();
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Equipment' })).toBeVisible();
    await expect(dialog).toHaveCount(0);

    // Saved: no question.
    await page
      .getByRole('link', { name: /^Edit / })
      .first()
      .click();
    await page.getByRole('checkbox', { name: 'Power rack', exact: true }).click();
    await page.getByRole('button', { name: 'Save equipment' }).click();
    await expect(page.getByText(/^Equipment saved/)).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });
});
