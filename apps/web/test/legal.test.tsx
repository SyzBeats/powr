import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';

import type { SourceId } from '@powr/domain';
import type { Explanation } from '@powr/domain/explain';

import { WhyButton } from '../src/features/why/WhySheet';
import { createTestContainer, renderRoute, renderWith, seriousViolations } from './harness';

/*
 * M5s legal and explainability (LEG-01, LEG-02, LEG-05, LEG-06, LEG-09, TD-33): the full texts
 * from the lazy catalog with the draft marker, the attributions screen from the build's
 * attributions (with the ECharts NOTICE), "How POWR decides" from the registry, and the "Why?"
 * sheet with parameter labels and full citations. The legal pages are open before onboarding.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

async function axeBothThemes(): Promise<string[]> {
  const root = document.documentElement;
  const light = await seriousViolations();
  root.dataset['theme'] = 'dark';
  const dark = await seriousViolations();
  delete root.dataset['theme'];
  return [...light, ...dark.map((violation) => `dark: ${violation}`)];
}

describe('legal texts (LEG-01, LEG-02, LEG-09)', () => {
  it('shows the full privacy notice with its version, the draft marker and contact by e-mail', async () => {
    const container = await createTestContainer();
    renderRoute(container, '/legal/privacy');
    await screen.findByRole('heading', { level: 2, name: 'Your rights' });
    for (const heading of [
      'In short',
      'Who is responsible',
      'What POWR stores, where and why',
      'What we do not do',
      'Hosting',
      'Permissions',
      'Backups and exported files',
      'Data loss',
      'Deleting your data',
      'Legal framework',
      'Changes and contact',
    ])
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy();
    expect(screen.getByTestId('legal-version').textContent).toBe('Version 2026-11-25');
    expect(screen.getByTestId('legal-draft').textContent).toContain(
      "the publisher's postal address",
    );
    const text = document.body.textContent ?? '';
    expect(text).toContain('Simeon Zimmermann');
    expect(text).toContain('SZ WEB DEVELOPMENT');
    expect(text).toContain('Hetzner Online GmbH');
    expect(text).toContain('revFADP');
    expect(text).toContain('GDPR');
    expect(screen.getByTestId('address-placeholder')).toBeTruthy();
    for (const link of screen.getAllByRole('link', { name: 'tools@sz-development.com' }))
      expect(link.getAttribute('href')).toBe('mailto:tools@sz-development.com');
    expect(await axeBothThemes()).toEqual([]);
  });

  it('shows the health notice and the imprint', async () => {
    const container = await createTestContainer();
    const disclaimer = renderRoute(container, '/legal/disclaimer');
    await screen.findByRole('heading', { level: 2, name: 'Stop and get help' });
    expect(document.body.textContent).toContain('POWR is not medical advice');
    expect(screen.getByTestId('legal-draft')).toBeTruthy();
    expect(await axeBothThemes()).toEqual([]);
    disclaimer.unmount();

    renderRoute(container, '/legal/imprint');
    await screen.findByRole('heading', { level: 1, name: 'Publisher and imprint' });
    const publisher = await screen.findByRole('region', { name: 'Publisher' });
    expect(within(publisher).getByText('Simeon Zimmermann')).toBeTruthy();
    expect(within(publisher).getByText('Switzerland')).toBeTruthy();
    expect(within(publisher).getByTestId('address-placeholder')).toBeTruthy();
    expect(await axeBothThemes()).toEqual([]);
  });
});

describe('attributions (LEG-06)', () => {
  it('lists every distributed component with its licence, the ECharts NOTICE and the own work', async () => {
    const notice = await commands.readFile('node_modules/echarts/NOTICE');
    const entries = [
      {
        kind: 'npm',
        name: 'echarts',
        version: '6.1.0',
        licence: 'Apache-2.0',
        copyright: [],
        licenceText: 'Apache License\nVersion 2.0, January 2004',
        noticeText: notice,
      },
      {
        kind: 'npm',
        name: 'react',
        version: '19.3.1',
        licence: 'MIT',
        copyright: ['Copyright (c) Meta Platforms, Inc. and affiliates.'],
        licenceText: 'MIT License\n\nCopyright (c) Meta Platforms, Inc. and affiliates.',
        noticeText: null,
      },
      {
        kind: 'asset',
        name: 'powr-body-map-artwork',
        version: '0.1.0',
        licence: 'LicenseRef-Own-Work',
        copyright: ['Body-map figure, original artwork drawn for POWR (own work)'],
        licenceText: null,
        noticeText: null,
      },
    ];
    const fetch = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(entries), { status: 200 }));
    const container = await createTestContainer();
    renderRoute(container, '/legal/attributions');
    const software = await screen.findByTestId('attributions-software');
    expect(fetch).toHaveBeenCalledWith('/attributions.json');
    expect(
      within(software)
        .getAllByTestId('attribution')
        .map((item) => item.dataset['name']),
    ).toEqual(['echarts', 'react']);
    const echarts = within(software).getAllByTestId('attribution')[0]!;
    expect(within(echarts).getByText('Licence: Apache-2.0')).toBeTruthy();
    // Apache-2.0 §4(d): the NOTICE text in full, as text.
    expect(within(echarts).getByTestId('notice-text').textContent).toBe(notice);
    expect(notice).toContain('Apache ECharts');
    const react = within(software).getAllByTestId('attribution')[1]!;
    expect(react.textContent).toContain('Copyright (c) Meta Platforms, Inc. and affiliates.');
    expect(within(react).getByText('Licence text')).toBeTruthy();
    const own = screen.getByTestId('attributions-own');
    expect(within(own).getByText('powr-body-map-artwork')).toBeTruthy();
    expect(within(own).getByText('Licence: Own work')).toBeTruthy();
    expect(await axeBothThemes()).toEqual([]);
  });

  it('says so when the build carries no attributions file', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('missing', { status: 404 }));
    const container = await createTestContainer();
    renderRoute(container, '/legal/attributions');
    expect(await screen.findByText('The list is not available')).toBeTruthy();
  });
});

describe('"How POWR decides" (LEG-05, PRG-09)', () => {
  it('explains the labels and versions and opens the entry a "Why?" sheet links to', async () => {
    const container = await createTestContainer();
    renderRoute(container, '/legal/how-powr-decides#param-session.rest.strength');
    await screen.findByRole('heading', { level: 2, name: 'What the evidence labels mean' });
    for (const label of [
      'Strong research',
      'Limited research',
      'Coaching convention',
      'App estimate',
      'Official standard',
    ])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByTestId('registry-versions').textContent).toContain(
      container.deps.rules.version,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Preliminary values' })).toBeTruthy();
    // The rest area is open at the linked value, with its label, evidence and full sources.
    const entry = await waitFor(() => {
      const found = document.getElementById('param-session.rest.strength');
      if (!found) throw new Error('entry missing');
      return found;
    });
    await waitFor(() => expect(entry.textContent).toContain('Rest between strength sets'));
    expect(entry.closest('details')?.open).toBe(true);
    const area = screen.getByRole('region', { name: 'Rest times' });
    await waitFor(() => expect(area.textContent).toContain('Grgic et al. (2018).'));
    expect(await axeBothThemes()).toEqual([]);
  });
});

describe('"Why?" sheet with full citations (TD-33)', () => {
  it('names each parameter in words and lists its sources in full', async () => {
    const container = await createTestContainer();
    const why: Explanation = {
      rule: 'rest.default',
      message: 'why.rest.default',
      args: { seconds: 180, restClass: 'strength', timeSaver: false },
      facts: [],
      params: [
        {
          id: 'session.rest.strength',
          value: 180,
          origin: 'default',
          evidence: ['SR'],
          sources: ['src.grgic2018b' as SourceId],
          verified: true,
        },
      ],
      children: [],
    };
    renderWith(container, <WhyButton why={why} subject="Rest" />);
    await userEvent.click(screen.getByRole('button', { name: 'Why? Rest' }));
    const sheet = await screen.findByRole('dialog');
    await waitFor(() => expect(within(sheet).getByText('Rest between strength sets')).toBeTruthy());
    const sources = await within(sheet).findByTestId('why-sources');
    expect(sources.textContent).toContain('Grgic et al. (2018).');
    expect(sources.textContent).toContain('Rest interval duration and strength gains');
    const link = within(sources).getByRole('link', { name: /pubmed\.gov.*opens in a new tab/ });
    expect(link.getAttribute('href')).toBe('https://www.pubmed.gov/28933024/');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(within(sheet).getByText('Sources: Grgic et al. 2018')).toBeTruthy();
    expect(
      within(sheet)
        .getByRole('link', { name: 'How POWR decides: Rest between strength sets' })
        .getAttribute('href'),
    ).toBe('/legal/how-powr-decides#param-session.rest.strength');
    expect(await seriousViolations()).toEqual([]);
  });
});
