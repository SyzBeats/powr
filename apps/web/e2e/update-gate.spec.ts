import { controllerBuild, expect, skipOnboarding, test, waitForOfflineReady } from './fixtures';
import { addExercise, finishWorkout, logSet, startEmptyWorkout } from './session';

/**
 * QS-04 / PWA-04: version N+1 is deployed while a workout runs on N. The install gate keeps N
 * running untouched; the update is offered after the workout and applied only on accept.
 */
test('never updates during a workout; offers and applies the update afterwards', async ({
  page,
  server,
}) => {
  test.skip(!server, 'needs the local test server to deploy a second version');
  await skipOnboarding(page);
  await page.goto('/');
  await waitForOfflineReady(page);
  // The first install does not take over the open page; a reload makes it the controller.
  await page.reload();
  const buildN = await controllerBuild(page);
  expect(buildN).toBeTruthy();

  // Start a workout on N.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Train' }).click();
  await startEmptyWorkout(page);
  await addExercise(page, 'Barbell back squat');
  await logSet(page, { weight: 100, reps: 5 });

  // Deploy N+1 and let the browser find it, as on a navigation or periodic update check.
  server!.deployNextVersion();
  const gatedInstall = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return 'no registration';
    const installing = new Promise<string>((resolve) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'redundant' || worker.state === 'installed') resolve(worker.state);
        });
      });
    });
    await registration.update().catch(() => undefined);
    return installing;
  });
  // The gate rejected the install: nothing is waiting, the workout keeps running on N.
  expect(gatedInstall).toBe('redundant');
  expect(
    await page.evaluate(async () =>
      Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
    ),
  ).toBe(false);
  expect(await controllerBuild(page)).toBe(buildN);
  await expect(page.getByTestId('update-banner')).toHaveCount(0);

  // Finishing the workout releases the gate and checks for the update again.
  await finishWorkout(page);
  const banner = page.getByTestId('update-banner');
  await expect(banner).toHaveText('A new version of POWR is ready.', { timeout: 15_000 });
  expect(await controllerBuild(page)).toBe(buildN);

  // Applying it is the user's choice; the page reloads on the new version.
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Update' }).click(),
  ]);
  await expect.poll(() => controllerBuild(page)).toBe(`${buildN}-next`);
  await expect(page.getByTestId('update-banner')).toHaveCount(0);
});

test('shows the update but keeps it disabled while a workout is active', async ({
  page,
  server,
}) => {
  test.skip(!server, 'needs the local test server to deploy a second version');
  await skipOnboarding(page);
  await page.goto('/');
  await waitForOfflineReady(page);
  await page.reload();

  // The update arrives before the workout starts, so it is already waiting.
  server!.deployNextVersion();
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await expect(page.getByTestId('update-banner')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Train' }).click();
  await startEmptyWorkout(page);
  await addExercise(page, 'Barbell back squat');
  await logSet(page, { weight: 100, reps: 5 });
  await expect(page.getByTestId('update-banner')).toHaveText(
    'A new version is ready. Finish your workout to update.',
  );
  await expect(page.getByRole('button', { name: 'Update' })).toBeDisabled();
});
