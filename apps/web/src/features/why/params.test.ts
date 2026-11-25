import { describe, expect, it } from 'vitest';

import rulesText from '../../../../../packages/rules/generated/rules.json?raw';
import poText from '../../i18n/locales/en/params.po?raw';

/*
 * TD-33 (M5s): every parameter of the shipped registry has a label in words, `params.<id>`, in the
 * lazy `params` catalog the "Why?" sheet and "How POWR decides" load. The labels module's type
 * already requires one per `ParamId`; this checks what ships (the catalog). Files are read as text:
 * the labels use Lingui macros, which Node unit tests do not compile.
 */
const ids = (JSON.parse(rulesText) as { params: readonly { id: string }[] }).params.map(
  (param) => param.id,
);
const catalog = new Map(
  [...poText.matchAll(/^msgid "(params\.[^"]+)"\nmsgstr "([^"]*)"$/gm)].map((match) => [
    match[1]!,
    match[2]!,
  ]),
);

describe('parameter labels (TD-33)', () => {
  it('has a label for every registry parameter, and none for a parameter that does not exist', () => {
    expect(ids.length).toBeGreaterThan(100);
    expect(ids.filter((id) => !catalog.has(`params.${id}`))).toEqual([]);
    expect([...catalog.keys()].filter((key) => !ids.includes(key.slice('params.'.length)))).toEqual(
      [],
    );
  });

  it('labels are plain words: capitalised, short, without the ID or a full stop', () => {
    const odd = [...catalog].filter(
      ([, label]) => !/^[A-Z0-9]/.test(label) || label.length > 60 || /\.$|params\./.test(label),
    );
    expect(odd).toEqual([]);
  });
});
