import { describe, expect, it } from 'vitest';

import { RULE_IDS, type RuleId } from '@powr/domain/explain';

import poText from '../../i18n/locales/en/messages.po?raw';
import { WHY_VALUES } from './args';
// oxlint-disable-next-line import/default -- `?raw` is the file's text, not the module
import source from './messages.ts?raw';

/*
 * PRG-09 / TD-28 (technical concept §8.7.3): every rule the engine can explain has an English
 * "Why?" message. The files are read as text (`?raw`, typed by vite/client; the app tsconfig has
 * no Node types): messages.ts uses Lingui macros, which Node unit tests do not compile, and the
 * catalog is what ships (the build compiles it; `pnpm i18n:extract` writes it).
 */
const catalog = parsePo(poText);

/** Rules a novice meets while planning and scheduling: plain-language first (NFR-USE-03). */
const SIMPLE_PREFIXES = [
  'plan.',
  'validate.',
  'deload.',
  'break.',
  'schedule.',
  'ranking.',
  'volume.band.',
  'volume.sessionCap.',
  'progression.level.',
];
const SIMPLE_RULES: readonly RuleId[] = ['equipment.availability', 'rest.default'];
const needsSimple = (rule: RuleId) =>
  SIMPLE_RULES.includes(rule) || SIMPLE_PREFIXES.some((prefix) => rule.startsWith(prefix));

const RULES = new Set<string>(RULE_IDS);
const whyEntries = [...catalog].filter(([id]) => id.startsWith('why.'));

/** 'why.plan.slot.kept.simple' → 'plan.slot.kept'. */
const ruleOf = (id: string) => id.replace(/^why\./, '').replace(/\.simple$/, '');

describe('"Why?" messages (PRG-09, TD-28)', () => {
  it('cover every rule with a non-empty English message', () => {
    const missing = RULE_IDS.filter((rule) => !/\S/.test(catalog.get(`why.${rule}`) ?? ''));
    expect(missing).toEqual([]);
  });

  it('belong to real rules', () => {
    const unknown = whyEntries.map(([id]) => id).filter((id) => !RULES.has(ruleOf(id)));
    expect(unknown).toEqual([]);
  });

  it('have a plain-language variant for the rules a novice meets while planning', () => {
    const missing = RULE_IDS.filter(
      (rule) => needsSimple(rule) && !/\S/.test(catalog.get(`why.${rule}.simple`) ?? ''),
    );
    expect(missing).toEqual([]);
  });

  const parsed = whyEntries.map(([id, text]) => {
    try {
      return { id, names: icuArguments(text), error: null };
    } catch (error) {
      return { id, names: new Set<string>(), error: `${id}: ${(error as Error).message}` };
    }
  });

  it('are valid ICU with an `other` case in every plural and select', () => {
    expect(parsed.flatMap(({ error }) => error ?? [])).toEqual([]);
  });

  it('only use the values the engine passes for their rule (args.ts)', () => {
    const unknown = parsed.flatMap(({ id, names }) => {
      const allowed: readonly string[] = WHY_VALUES[ruleOf(id) as RuleId] ?? [];
      return [...names].filter((name) => !allowed.includes(name)).map((name) => `${id}: {${name}}`);
    });
    expect(unknown).toEqual([]);
  });

  it('match messages.ts (Lingui keeps a changed explicit-ID text unless extracted with --overwrite)', () => {
    const declared = new Map(
      [...source.matchAll(/id: '(why\.[\w.]+)',\s*message:\s*(?:'([^'\\]*)'|"([^"\\]*)")/g)].map(
        ([, id, single, double]): [string, string] => [id!, single ?? double ?? ''],
      ),
    );
    expect(declared.size).toBe(source.match(/id: 'why\./g)?.length);
    const stale = [...declared].filter(([id, text]) => catalog.get(id) !== text).map(([id]) => id);
    expect(stale).toEqual([]);
    expect(whyEntries.map(([id]) => id).toSorted()).toEqual([...declared.keys()].toSorted());
  });
});

/** msgid → msgstr of a PO catalog; obsolete (`#~`) entries are skipped. */
function parsePo(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const fields: Record<string, string> = {};
    let field: string | null = null;
    for (const line of block.split(/\r?\n/)) {
      const start = /^(msgctxt|msgid|msgid_plural|msgstr)\s+"(.*)"$/.exec(line);
      if (start) {
        field = start[1]!;
        fields[field] = unescapePo(start[2]!);
      } else if (field && /^".*"$/.test(line)) {
        fields[field] += unescapePo(line.slice(1, -1));
      } else {
        field = null;
      }
    }
    if (fields['msgid']) entries.set(fields['msgid'], fields['msgstr'] ?? '');
  }
  return entries;
}

function unescapePo(value: string): string {
  const escapes: Record<string, string> = { n: '\n', t: '\t', r: '\r' };
  return value.replaceAll(/\\(.)/g, (_, char: string) => escapes[char] ?? char);
}

/**
 * The argument names of an ICU message at every depth (`{name}`, `{name, number, percent}`,
 * `{name, plural|select|selectordinal, … {…}}`), with Lingui's apostrophe quoting. Throws on a
 * syntax error or a plural/select without an `other` case.
 */
function icuArguments(message: string): Set<string> {
  const names = new Set<string>();
  let at = 0;
  const fail = (what: string): never => {
    throw new Error(`${what} at ${at}`);
  };
  const skipSpace = () => {
    while (/\s/.test(message[at] ?? '')) at++;
  };
  const word = (): string => {
    const start = at;
    while (at < message.length && !/[\s{},]/.test(message[at]!)) at++;
    return at > start ? message.slice(start, at) : fail('expected a name');
  };
  /** Text and arguments up to the `}` that closes this level (not consumed) or the end. */
  const body = (nested: boolean, plural: boolean): void => {
    while (at < message.length) {
      const char = message[at]!;
      if (char === "'") quote(plural);
      else if (char === '{') {
        at++;
        argument(plural);
      } else if (char === '}') {
        if (nested) return;
        fail('unmatched }');
      } else at++;
    }
    if (nested) fail('unclosed {');
  };
  const quote = (plural: boolean) => {
    const next = message[at + 1];
    if (next === "'") at += 2;
    else if (next === '{' || next === '}' || (plural && next === '#')) {
      const end = message.indexOf("'", at + 1);
      at = end === -1 ? message.length : end + 1;
    } else at++;
  };
  const argument = (plural: boolean) => {
    skipSpace();
    const name = word();
    names.add(name);
    skipSpace();
    if (message[at] === '}') {
      at++;
      return;
    }
    if (message[at] !== ',') fail(`expected , or } after ${name}`);
    at++;
    skipSpace();
    const type = word();
    skipSpace();
    if (type !== 'plural' && type !== 'select' && type !== 'selectordinal') {
      if (message[at] === ',') at = message.indexOf('}', at);
      if (message[at] !== '}') fail(`unclosed {${name}, ${type}}`);
      at++;
      return;
    }
    if (message[at] !== ',') fail(`expected the cases of {${name}, ${type}}`);
    at++;
    const keys: string[] = [];
    for (;;) {
      skipSpace();
      if (message[at] === '}') break;
      const key = word();
      if (key.startsWith('offset:')) continue;
      skipSpace();
      if (message[at] !== '{') fail(`expected { after the case ${key} of {${name}}`);
      at++;
      body(true, plural || type !== 'select');
      at++;
      keys.push(key);
    }
    at++;
    if (!keys.includes('other')) fail(`{${name}, ${type}} has no other case`);
  };
  body(false, false);
  return names;
}
