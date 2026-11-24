import { expect, skipOnboarding, test, waitForOfflineReady } from './fixtures';

interface TrustedTypesFactory {
  createPolicy(name: string, rules: { createHTML(input: string): string }): unknown;
}

/**
 * Trusted Types are enforced in E2E builds (§7.3, TD-12): the test server appends
 * `require-trusted-types-for 'script'` and the policy allow-list to the production CSP. The app
 * still registers its service worker (through the `powr-sw` policy), and every other test in this
 * suite runs under the same header with no violation. Production does not send it yet (TD-03).
 */
test('enforces Trusted Types: string script sinks and unknown policies throw', async ({
  page,
  server,
  recorded,
}) => {
  test.skip(!server, 'the production headers do not enforce Trusted Types yet (TD-03)');

  // Since M2b every training screen sits behind the first-run gate.
  await skipOnboarding(page);
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain(
    "require-trusted-types-for 'script'; trusted-types powr-sw",
  );
  // Registration passed a TrustedScriptURL; a plain string would have thrown.
  await waitForOfflineReady(page);

  const outcome = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(event.violatedDirective),
    );
    const factory = (window as unknown as { trustedTypes: TrustedTypesFactory }).trustedTypes;
    const sinks: Record<string, () => unknown> = {
      innerHTML: () => {
        document.createElement('div').innerHTML = '<img src="x">';
      },
      scriptSrc: () => {
        document.createElement('script').src = '/assets/evil.js';
      },
      unknownPolicy: () => factory.createPolicy('evil', { createHTML: (input) => input }),
      duplicatePolicy: () => factory.createPolicy('powr-sw', { createHTML: (input) => input }),
    };
    const results: Record<string, string> = {};
    for (const [name, sink] of Object.entries(sinks)) {
      try {
        sink();
        results[name] = 'allowed';
      } catch (error) {
        results[name] = error instanceof TypeError ? 'TypeError' : String(error);
      }
    }
    // Violation events are dispatched as tasks after the throwing call returns.
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { results, violations: violations.toSorted() };
  });

  expect(outcome.results).toEqual({
    innerHTML: 'TypeError',
    scriptSrc: 'TypeError',
    unknownPolicy: 'TypeError',
    duplicatePolicy: 'TypeError',
  });
  expect(outcome.violations).toEqual([
    'require-trusted-types-for',
    'require-trusted-types-for',
    'trusted-types',
    'trusted-types',
  ]);

  // The fixture fails a test on any CSP violation. Wait for the four reports of its listener (the
  // browser's own console messages arrive before them), check that nothing else was reported,
  // then clear the expected ones.
  await expect
    .poll(() => recorded.cspViolations.filter((line) => line.startsWith('CSP violation:')).length)
    .toBe(outcome.violations.length);
  expect(recorded.cspViolations.filter((line) => !/trusted-types|TrustedType/.test(line))).toEqual(
    [],
  );
  recorded.cspViolations.splice(0);
});
