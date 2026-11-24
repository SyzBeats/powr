import type { ExerciseId, PlanDay } from '@powr/domain';
import type { ExplainArg, Explanation, Fact } from '@powr/domain/explain';

import { formatLocalDate, formatMass } from '../../i18n/format';
import type { Labels } from '../labels';
import { WHY_VALUES } from './args';

/** Where the "Why?" texts can look up plan-specific names (day and slot keys). */
export interface WhyNames {
  readonly days?: readonly PlanDay[];
  /** Exercises of slots that are no longer in the days (dropped or trimmed by the generator). */
  readonly slots?: ReadonlyMap<string, ExerciseId>;
}

const CONTENT_ID = /^(ex|mu|eq|tpl|preset)\./;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The values a `why.<rule>` message interpolates (the contract of `messages.ts` and `args.ts`):
 * quantity facts by name, overridden by the explanation's args; numbers stay numbers (for ICU
 * plurals), masses become "100 kg", booleans 'yes'/'no', null 'none', content IDs and day or slot
 * keys their names, enum values of a few known args their labels, everything else stays raw for
 * ICU `select`. Values the rule can carry but this explanation lacks become 'none', so a
 * message can tell its cases apart; decimals are rounded for reading.
 */
export function whyValues(
  why: Explanation,
  labels: Labels,
  names: WhyNames = {},
): Record<string, string | number> {
  const raw = new Map<string, ExplainArg>();
  for (const fact of why.facts) if (fact.kind === 'quantity') raw.set(fact.name, fact.value);
  for (const [name, value] of Object.entries(why.args)) raw.set(name, value);
  const values: Record<string, string | number> = {};
  for (const name of WHY_VALUES[why.rule]) values[name] = 'none';
  for (const [name, value] of raw) values[name] = convert(name, value, labels, names);
  return values;
}

function convert(
  name: string,
  value: ExplainArg,
  labels: Labels,
  names: WhyNames,
): string | number {
  if (value === null) return 'none';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return round(value);
  if (typeof value === 'object') return formatMass(value.mass.value, value.mass.unit);
  if (CONTENT_ID.test(value)) {
    if (value.startsWith('ex.')) return labels.exercise(value);
    if (value.startsWith('mu.')) return labels.muscle(value);
    if (value.startsWith('tpl.')) return labels.template(value);
    if (value.startsWith('eq.')) return labels.equipment(value);
    return value;
  }
  switch (name) {
    case 'missing':
      // 'eq.a, eq.b|eq.c': every item, and one of each alternative group.
      return value
        .split(', ')
        .filter((part) => part !== '')
        .map((part) =>
          part
            .split('|')
            .map((id) => labels.equipment(id))
            .join(' / '),
        )
        .join(', ');
    case 'subject':
      return value.startsWith('lift.')
        ? labels.lift(value.slice(5) as Parameters<Labels['lift']>[0])
        : value;
    case 'dayKey':
    case 'day':
    case 'fromDay':
    case 'toDay':
      return names.days?.find((day) => day.key === value)?.name.en ?? humanize(value);
    case 'slot':
    case 'slotKey': {
      for (const day of names.days ?? []) {
        const slot = day.slots.find((candidate) => candidate.key === value);
        if (slot) return labels.exercise(slot.exerciseId);
      }
      const removed = names.slots?.get(value);
      if (removed) return labels.exercise(removed);
      return humanize(value.split('.').at(-1) ?? value);
    }
    case 'pattern':
      return labels.pattern(value as Parameters<Labels['pattern']>[0]);
    case 'lift':
      return labels.lift(value as Parameters<Labels['lift']>[0]);
    case 'level':
      return labels.level(value as Parameters<Labels['level']>[0]);
    case 'style':
      return labels.style(value as Parameters<Labels['style']>[0]);
    case 'goal':
      return labels.goal(value as Parameters<Labels['goal']>[0]);
    case 'weekday':
      return labels.weekday(Number(value));
    default:
      return ISO_DAY.test(value) ? formatLocalDate(value) : value;
  }
}

/** Whole numbers stay; decimals keep two places below 10 and one above. */
function round(value: number): number {
  if (Number.isInteger(value)) return value;
  const places = Math.abs(value) < 10 ? 100 : 10;
  return Math.round(value * places) / places;
}

/** 'upper-a' → 'Upper a' (a fallback for keys without a name). */
function humanize(key: string): string {
  const text = key.replaceAll(/[-_.]/g, ' ').replaceAll(/([a-z])([A-Z])/g, '$1 $2');
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/** Logged sets an explanation is based on (rendered as a list, not inside the message). */
export function setFacts(why: Explanation): Extract<Fact, { kind: 'set' }>[] {
  return why.facts.filter((fact): fact is Extract<Fact, { kind: 'set' }> => fact.kind === 'set');
}

/** 'volume.hypertrophy.weeklyBands' → 'Weekly bands (volume, hypertrophy)'. */
export function paramName(id: string): string {
  const parts = id
    .split('.')
    .map((part) => part.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
  const last = parts.pop() ?? id;
  const head = `${last.charAt(0).toUpperCase()}${last.slice(1)}`;
  return parts.length > 0 ? `${head} (${parts.join(', ')})` : head;
}
