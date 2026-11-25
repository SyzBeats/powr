import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { copyrightLines, readLicenceDetails } from '../src/packages.ts';

/*
 * Licence review finding L-1 (M6c): the copyright lines on the attributions screen. The fixtures
 * are the real licence and NOTICE files of the five shipped packages whose licence text the old
 * extraction misread (copied from node_modules, tools/licence/fixtures/copyright/).
 */
const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/copyright/${name}`, import.meta.url));

describe('copyright lines of the shipped packages (L-1)', () => {
  it('class-variance-authority: the notice, not three lines of the Apache licence text', () => {
    expect(readLicenceDetails(fixture('class-variance-authority')).copyright).toEqual([
      'Copyright 2022 Joe Bell',
    ]);
  });

  it('dexie: the template line is skipped and the notice comes from its NOTICE file', () => {
    const details = readLicenceDetails(fixture('dexie'));
    expect(details.copyright).toEqual(['Copyright (c) 2014-2017 David Fahlander']);
    expect(details.noticeText).toContain('Dexie.js');
  });

  it('echarts: the notice from its NOTICE file and the embedded d3 licence (BSD-3-Clause)', () => {
    const details = readLicenceDetails(fixture('echarts'));
    expect(details.copyright).toEqual([
      'Copyright 2017-2026 The Apache Software Foundation',
      'Copyright 2010-2016 Mike Bostock',
    ]);
    // The d3 licence travels with the licence text: its conditions and disclaimer included.
    expect(details.licenceText).toContain('licenses/LICENSE-d3');
    expect(details.licenceText).toContain(
      'Redistributions in binary form must reproduce the above copyright notice',
    );
    // The package's own licence text comes first, unchanged.
    const own = readFileSync(join(fixture('echarts'), 'LICENSE'), 'utf8');
    expect(details.licenceText?.startsWith(own)).toBe(true);
  });

  it('@floating-ui/utils: the notice without the MIT "COPYRIGHT HOLDERS BE LIABLE" line', () => {
    expect(readLicenceDetails(fixture('floating-ui-utils')).copyright).toEqual([
      'Copyright (c) 2021-present Floating UI contributors',
    ]);
  });

  it('lucide-react: both notices without the ISC "copyright notice and this permission" line', () => {
    expect(readLicenceDetails(fixture('lucide-react')).copyright).toEqual([
      'Copyright (c) 2026 Lucide Icons and Contributors',
      'Copyright (c) 2013-present Cole Bemis',
    ]);
  });
});

describe('copyrightLines', () => {
  it('keeps the notice forms the other shipped packages use', () => {
    const notices = [
      'Copyright (c) 2019 Material-UI SAS',
      'Copyright (c) 2017-2022 Tomáš Ehrlich, (c) 2022-2023 Crowdin.',
      'Copyright (c) Luke Edwards',
      'Copyright (c) Meta Platforms, Inc. and affiliates.',
      'Copyright (c) Microsoft Corporation.',
      'Copyright 2018 Google LLC',
      'Copyright (c) 2017, Baidu Inc.',
      'Copyright © 2024 Someone',
      '© 2024 Someone',
      '(c) 2024 Someone',
      'COPYRIGHT (C) 2001 A Person',
    ];
    expect(copyrightLines(notices.map((line) => `   ${line}`).join('\n'))).toEqual(notices);
  });

  it('drops licence boilerplate and template lines', () => {
    const boilerplate = [
      '(c) You must retain, in the Source form of any Derivative Works',
      'copyright license to reproduce, prepare Derivative Works of,',
      'copyright notice that is included in or attached to the work',
      'COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER',
      'copyright notice and this permission notice appear in all copies.',
      'Copyright {yyyy} {name of copyright owner}',
      'Copyright [yyyy] [name of copyright owner]',
      'Copyright <YEAR> <COPYRIGHT HOLDER>',
      'Copyright',
    ];
    expect(copyrightLines(boilerplate.join('\n'))).toEqual([]);
    expect(copyrightLines(null)).toEqual([]);
  });
});
