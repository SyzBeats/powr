import { expect, skipOnboarding, test } from './fixtures';
import { checkReflow, checkScreen } from './planning';
import { addExercise, logSet, startEmptyWorkout } from './session';

/**
 * M4b Explore tab (EXL-02…04, EXL-08, EXL-09): the hub, search and filters with their chips, an
 * exercise detail, the custom-exercise form with its errors, and a custom exercise used in a
 * freestyle workout like a built-in one. axe in both themes and reflow at 320 px and 200 % text
 * on every screen; `M2B_SCREENS=<dir>` writes the screenshots.
 */

const CUSTOM = 'Garage hip thrust';

test.describe('exercise library (M4b: EXL)', () => {
  test('browse, filter, open an exercise, create a custom one and log it in a freestyle workout', async ({
    page,
  }) => {
    // Six screens with axe in both themes and two reflow checks (TD-56 added the filter sheet's).
    test.setTimeout(90_000);
    await skipOnboarding(page);

    await page.goto('/explore');
    await expect(page.getByRole('heading', { level: 1, name: 'Explore' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the body map' })).toBeVisible();
    await checkScreen(page, 'explore');
    await checkReflow(page, 'explore');

    await page.getByRole('link', { name: 'Browse exercises' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Exercise library' })).toBeVisible();
    await expect(page.getByTestId('library-count')).toHaveText(/^\d+ exercises$/);
    await checkScreen(page, 'library');

    // EXL-02, TD-56: checkboxes, several values per dimension (OR), dimensions with AND; each
    // value a chip.
    await page.getByRole('searchbox', { name: 'Search exercises' }).fill('curl');
    await page.getByRole('button', { name: 'Filters' }).click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await sheet.locator('summary', { hasText: 'Muscle' }).click();
    const muscles = sheet.getByRole('group', { name: 'Works any of these muscles' });
    await muscles.getByRole('checkbox', { name: 'Biceps', exact: true }).click();
    await muscles.getByRole('checkbox', { name: 'Forearms', exact: true }).click();
    await sheet.locator('summary', { hasText: 'Mechanics' }).click();
    await sheet.getByRole('checkbox', { name: /^Isolation/ }).click();
    await expect(sheet.getByText('2 chosen')).toBeVisible();
    await checkScreen(page, 'library-filters');
    await checkReflow(page, 'library-filters');
    await sheet.getByRole('button', { name: /^Show \d+ exercises?$/ }).click();
    await expect(sheet).toHaveCount(0);
    const chips = page.getByTestId('active-filters');
    await expect(chips.getByRole('button', { name: 'Remove filter: Biceps' })).toBeVisible();
    await expect(chips.getByRole('button', { name: 'Remove filter: Forearms' })).toBeVisible();
    await expect(page.getByTestId('library-results').getByRole('link').first()).toContainText(
      /curl/i,
    );
    // The query and filters are in the URL, so Back from an exercise keeps them.
    await expect
      .poll(() => decodeURIComponent(page.url()))
      .toMatch(/muscle=\["mu\.elbow-flexors","mu\.forearms"\]/);
    await checkScreen(page, 'library-filtered');
    await checkReflow(page, 'library-filtered');
    // One tap removes one value; the other stays.
    await chips.getByRole('button', { name: 'Remove filter: Forearms' }).click();
    await expect(chips.getByRole('button', { name: 'Remove filter: Forearms' })).toHaveCount(0);
    await expect(chips.getByRole('button', { name: 'Remove filter: Biceps' })).toBeVisible();

    await page.goto('/explore/exercises/ex.barbell-bench-press');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Barbell bench press' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Muscles worked' })).toBeVisible();
    await checkScreen(page, 'exercise-detail');
    await checkReflow(page, 'exercise-detail');

    // EXL-04: the form, its errors, then a saved custom exercise.
    await page.goto('/explore/exercises/new');
    await expect(page.getByRole('button', { name: 'Save exercise' })).toBeVisible();
    await checkScreen(page, 'custom-exercise-form');
    await checkReflow(page, 'custom-exercise-form');
    await page.getByRole('button', { name: 'Save exercise' }).click();
    const errors = page.getByTestId('custom-errors');
    await expect(errors).toContainText('Enter a name.');
    await expect(errors).toContainText('Add at least one muscle.');
    await checkScreen(page, 'custom-exercise-errors');

    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(CUSTOM);
    await page.getByRole('combobox', { name: 'Movement pattern' }).selectOption('hipExtension');
    await page.getByRole('radio', { name: /^Compound/ }).click();
    await page
      .getByRole('group', { name: 'Muscle 1' })
      .getByRole('combobox', { name: 'Muscle' })
      .selectOption('mu.glutes');
    await page.getByRole('combobox', { name: 'How the weight is loaded' }).selectOption('barbell');
    await page
      .getByRole('combobox', { name: 'Rest between sets' })
      .selectOption('hypertrophyCompound');
    await page.getByRole('button', { name: 'Save exercise' }).click();
    await expect(page.getByRole('heading', { level: 1, name: CUSTOM })).toBeVisible();
    await expect(page.getByText('Custom exercise', { exact: true })).toBeVisible();

    await page.goto('/explore');
    await expect(
      page.getByTestId('custom-exercises').getByRole('link', { name: CUSTOM }),
    ).toBeVisible();

    // It behaves like a built-in exercise: added to a freestyle workout and logged.
    await page.goto('/session');
    await startEmptyWorkout(page);
    await addExercise(page, CUSTOM);
    await logSet(page, { weight: 60, reps: 10 });
    await expect(page.getByTestId('logged-set')).toHaveCount(1);
  });
});
