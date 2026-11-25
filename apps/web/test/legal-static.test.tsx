import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AttributionEntry } from '../src/features/legal/attributions-data';
import { renderLegalPages, STATIC_LEGAL_PAGES } from '../src/features/legal/texts/static/render';
import { createTestContainer, renderRoute } from './harness';

/*
 * The static website copy of the legal texts (LEG-09, TD-71; M6c): the build renders these pages
 * from the app's own texts, publisher details and catalogs. Here the renderer's output is compared
 * with what the app's legal screens show, word for word (draft marker included), and checked to be
 * plain HTML: no script, no inline style, no event handler. The E2E spec checks the built files.
 */

const ENTRIES: AttributionEntry[] = [
  {
    kind: 'npm',
    name: 'react',
    version: '19.3.1',
    licence: 'MIT',
    copyright: ['Copyright (c) Meta Platforms, Inc. and affiliates.'],
    licenceText: 'MIT License\n\nPermission is hereby granted …',
    noticeText: null,
  },
  {
    kind: 'npm',
    name: 'echarts',
    version: '6.1.0',
    licence: 'Apache-2.0',
    copyright: [],
    licenceText: 'Apache License',
    noticeText: 'Apache ECharts\nCopyright 2017-2026 The Apache Software Foundation',
  },
  {
    kind: 'asset',
    name: 'powr-app-icons',
    version: '0.0.0',
    licence: 'LicenseRef-Own-Work',
    copyright: [],
    licenceText: null,
    noticeText: null,
  },
];

const pages = renderLegalPages({
  attributions: ENTRIES,
  app: { version: '1.2.3', build: 'abc1234' },
});
/**
 * Parses a page as the browser would load it. Through XHR, because the test page enforces Trusted
 * Types and DOMParser is one of its sinks; a document loaded as data runs no script either way.
 */
async function parse(file: string): Promise<Document> {
  const url = URL.createObjectURL(new Blob([pages[file] ?? ''], { type: 'text/html' }));
  try {
    return await new Promise<Document>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.responseType = 'document';
      request.addEventListener('load', () =>
        request.responseXML ? resolve(request.responseXML) : reject(new Error(file)),
      );
      request.addEventListener('error', () => reject(new Error(file)));
      request.open('GET', url);
      request.send();
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
const text = (node: Element | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ');

const byName = (a: string, b: string) => a.localeCompare(b);

/** What is wrong with one page as plain, accessible HTML (empty when nothing is). */
async function problemsOf(file: string): Promise<string[]> {
  const doc = await parse(file);
  const problems: string[] = [];
  const check = (ok: boolean, problem: string) => {
    if (!ok) problems.push(`${file}: ${problem}`);
  };
  check(pages[file]?.startsWith('<!doctype html>\n<html lang="en">') === true, 'doctype or lang');
  check(doc.querySelectorAll('script, style, [style]').length === 0, 'script or inline style');
  const handlers = [...doc.querySelectorAll('*')].flatMap((element) =>
    [...element.attributes].filter((attribute) => attribute.name.startsWith('on')),
  );
  check(handlers.length === 0, 'event handler attribute');
  check(doc.querySelectorAll('h1').length === 1, 'not exactly one h1');
  check(doc.querySelector('main#main') !== null, 'no main#main');
  check(doc.querySelector('a[href="#main"]') !== null, 'no skip link');
  check(
    doc.querySelector('link[rel="stylesheet"]')?.getAttribute('href') === '/legal-static/legal.css',
    'stylesheet',
  );
  check(text(doc.querySelector('footer')).includes('version 1.2.3 (abc1234)'), 'app version');
  // Every page links every text and the app.
  const links = new Set(
    [...doc.querySelectorAll('a[href]')].map((link) => link.getAttribute('href')),
  );
  for (const page of STATIC_LEGAL_PAGES)
    check(links.has(`/legal-static/${page}.html`), `no link to ${page}`);
  check(links.has('/'), 'no link to the app');
  return problems;
}

describe('static website copy of the legal texts (LEG-09, TD-71)', () => {
  it('renders every page as plain HTML: no script, no inline style, no event handler', async () => {
    expect(Object.keys(pages).toSorted(byName)).toEqual(
      ['index', ...STATIC_LEGAL_PAGES].map((page) => `${page}.html`).toSorted(byName),
    );
    const problems = await Promise.all(Object.keys(pages).map(problemsOf));
    expect(problems.flat()).toEqual([]);
  });

  for (const page of ['imprint', 'privacy', 'disclaimer'] as const) {
    it(`${page}: the same words as the app's legal screen, draft marker included`, async () => {
      const container = await createTestContainer();
      renderRoute(container, `/legal/${page}`);
      const heading = await screen.findByRole('heading', { level: 1 });
      // The texts are the lazy `legal` catalog: wait until the screen shows them.
      await waitFor(() => expect(heading.parentElement?.querySelector('section h2')).toBeTruthy());
      const doc = await parse(`${page}.html`);

      expect(text(doc.querySelector('main'))).toBe(text(heading.parentElement));
      expect(doc.title).toBe(document.title);
      expect(text(doc.querySelector('[data-testid="legal-draft"]'))).toBe(
        text(screen.getByTestId('legal-draft')),
      );
      expect(text(doc.querySelector('[data-testid="legal-draft"]'))).toContain(
        "the publisher's postal address",
      );
      expect(doc.querySelector('a[href="mailto:tools@sz-development.com"]')).not.toBeNull();
    });
  }

  for (const page of ['imprint', 'privacy'] as const) {
    it(`${page}: names the publisher, with the postal address still a placeholder`, async () => {
      const body = text((await parse(`${page}.html`)).body);
      for (const detail of [
        'Simeon Zimmermann',
        'SZ WEB DEVELOPMENT',
        'Switzerland',
        'Postal address: to be added before the public release.',
      ])
        expect(body).toContain(detail);
    });
  }

  it('attributions: every entry with its licence and NOTICE, the licence text behind a disclosure', async () => {
    const doc = await parse('attributions.html');
    const names = [...doc.querySelectorAll('[data-testid="attribution"]')].map(
      (item) => item.getAttribute('data-name') ?? '',
    );
    expect(names.toSorted(byName)).toEqual(ENTRIES.map((entry) => entry.name).toSorted(byName));
    expect(doc.querySelector('[data-testid="notice-text"]')?.textContent).toBe(
      ENTRIES[1]!.noticeText,
    );
    expect(doc.querySelectorAll('details summary')).toHaveLength(2);
    // The attributions screen has no draft marker in the app, so neither here.
    expect(doc.querySelector('[data-testid="legal-draft"]')).toBeNull();
  });

  it('the index names the publisher and links the four texts', async () => {
    const doc = await parse('index.html');
    expect(text(doc.querySelector('main'))).toContain(
      'Published by Simeon Zimmermann, SZ WEB DEVELOPMENT, Switzerland.',
    );
    expect([...doc.querySelectorAll('main li a')].map((link) => link.getAttribute('href'))).toEqual(
      STATIC_LEGAL_PAGES.map((page) => `/legal-static/${page}.html`),
    );
  });
});
