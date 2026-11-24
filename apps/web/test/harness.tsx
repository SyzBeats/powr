import { CSPProvider } from '@base-ui/react/csp-provider';
import { I18nProvider } from '@lingui/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactNode } from 'react';

import {
  acknowledgeLegal,
  completeOnboarding,
  generatePlanPreview,
  type OnboardingAnswers,
} from '@powr/application/planning';
import { builtInContent } from '@powr/content/built-in';
import type { IsoWeekday, PresetId } from '@powr/domain';
import { profileFromPreset } from '@powr/domain/equipment';

import { createContainer, type Container } from '../src/app/container';
import { ContainerContext } from '../src/app/container-context';
import { LEGAL_VERSIONS } from '../src/features/legal/versions';
import { i18n } from '../src/i18n';
import { PowrDb } from '../src/infrastructure/db';
import { createDiagnostics } from '../src/infrastructure/diagnostics/log';
import { loadBuiltInRules } from '../src/infrastructure/rules/provider';
import { routeTree } from '../src/routeTree.gen';

/**
 * Component-test harness (TD-11, §8.20): Vitest browser mode in real Chromium, so the screens run
 * against the real container, a real IndexedDB (one database per test), the built-in content and
 * rules, Tailwind's CSS and the Lingui catalog.
 */
let databases = 0;

export async function createTestContainer(): Promise<Container> {
  const db = new PowrDb({ name: `powr-component-${Date.now()}-${databases++}` });
  await db.open();
  const diagnostics = createDiagnostics({
    app: { version: 'test', build: 'test' },
    context: async () => ({}),
  });
  return createContainer(
    db,
    builtInContent(),
    await loadBuiltInRules(),
    {
      checkForUpdate: async () => undefined,
      applyUpdate: () => undefined,
      resetAppFiles: async () => undefined,
    },
    diagnostics,
  );
}

function Providers({ container, children }: { container: Container; children: ReactNode }) {
  return (
    <I18nProvider i18n={i18n}>
      <CSPProvider disableStyleElements>
        <ContainerContext value={container}>{children}</ContainerContext>
      </CSPProvider>
    </I18nProvider>
  );
}

/** A component with the app's providers (no router). */
export function renderWith(container: Container, ui: ReactNode): RenderResult {
  return render(<Providers container={container}>{ui}</Providers>);
}

/** The whole app (shell, guard, routes) at a path, with an in-memory history. */
export function renderRoute(container: Container, path: string): RenderResult {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { container },
  });
  return render(
    <Providers container={container}>
      <RouterProvider router={router} context={{ container }} />
    </Providers>,
  );
}

/** First-run state for screens behind the legal gate. */
export async function acknowledge(container: Container): Promise<void> {
  await acknowledgeLegal(container.deps, LEGAL_VERSIONS);
}

/** Answers of a 4-day bodybuilder with a commercial gym and a 75-minute budget. */
export function sampleAnswers(container: Container): OnboardingAnswers {
  const preset = container.deps.content.equipment().preset('preset.commercial-gym' as PresetId)!;
  return {
    style: 'bodybuilding',
    experience: {
      trainingAge: 'years2To5',
      timeOff: 'upTo1Week',
      rpeFamiliarity: 'some',
      recentVolume: [],
    },
    levelOverride: null,
    referenceSet: null,
    schedule: { weekdays: [1, 2, 4, 5] as IsoWeekday[], sessionMinutes: 75 },
    equipment: profileFromPreset(preset, container.deps.content.equipment().items, {
      id: 'eq-profile-1',
      name: 'Gym',
      unit: 'kg',
    }),
    priorities: [],
    avoid: { exercises: [], patterns: [] },
    preferredExercises: [],
    units: { load: 'kg', bodyweight: 'kg', length: 'cm' },
    sex: 'preferNotToSay',
    birthYear: null,
    height: null,
    bodyweight: null,
    phase: 'notTracking',
    startTimes: [],
    baselines: [],
    meet: null,
  };
}

/** A generated preview for the sample answers. */
export async function samplePreview(container: Container) {
  const result = await generatePlanPreview(container.deps, {
    answers: sampleAnswers(container),
    options: { weekStartsOn: 1 },
  });
  if (!result.ok) throw new Error(`No plan: ${result.error.kind}`);
  return result.value;
}

/** A profile with the sample plan accepted (screens of an onboarded user). */
export async function onboarded(container: Container): Promise<void> {
  await acknowledge(container);
  const preview = await samplePreview(container);
  const result = await completeOnboarding(container.deps, {
    answers: sampleAnswers(container),
    preview,
  });
  if (!result.ok) throw new Error('Onboarding failed');
}

/** axe-core (WCAG 2.2 A/AA): serious and critical violations of the rendered document. */
export async function seriousViolations(): Promise<string[]> {
  const results = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
  });
  return results.violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    );
}
