/**
 * `@powr/domain/rest`: evidence-based rest defaults (TMR-02; EB §Session › Rest). The rest class
 * comes from the exercise; competition squat/deadlift (4:00) and novice (1:30/1:00) are context
 * variants the rules resolver already applied. Time-saver mode shortens hypertrophy rest to 1:00
 * but never touches strength work (never below 2:00 on competition lifts).
 */
import { explained, type Explained } from '../explain';
import type { RestClass } from '../model';
import type { RuleSlice } from '../rules';

export type RestRules = RuleSlice<
  | 'session.rest.strength'
  | 'session.rest.hypertrophyCompound'
  | 'session.rest.hypertrophyIsolation'
  | 'session.rest.timeSaver'
>;

const CLASS_PARAM = {
  strength: 'session.rest.strength',
  hypertrophyCompound: 'session.rest.hypertrophyCompound',
  hypertrophyIsolation: 'session.rest.hypertrophyIsolation',
} as const satisfies Record<RestClass, keyof RestRules>;

/** Default rest after a working set, in seconds. */
export function restSeconds(
  input: { readonly restClass: RestClass; readonly timeSaver?: boolean },
  rules: RestRules,
): Explained<number> {
  const param =
    input.timeSaver && input.restClass !== 'strength'
      ? rules['session.rest.timeSaver']
      : rules[CLASS_PARAM[input.restClass]];
  return explained(param.value, 'rest.default', {
    args: { seconds: param.value, restClass: input.restClass, timeSaver: input.timeSaver ?? false },
    params: [param],
  });
}
