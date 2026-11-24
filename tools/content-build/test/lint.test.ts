import { describe, expect, it } from 'vitest';

import { loadSourceRegistry } from '@powr/rules/sources/node';

import { compileContent } from '../src/compile.ts';
import { readContentSources, type ContentFile } from '../src/load.ts';

/*
 * The linter is exercised on the real content with one defect each, so every test also proves
 * that the defect is the only problem reported.
 */

type Entry = Record<string, unknown>;
interface Draft {
  muscles: ContentFile;
  equipment: ContentFile;
  presets: ContentFile;
  exercises: ContentFile[];
  templates: ContentFile[];
}

const { sources } = readContentSources();
const registry = loadSourceRegistry();

/** Compiles a deep copy of the shipped sources after `change`; returns the issues. */
function issuesAfter(change: (draft: Draft) => void): readonly string[] {
  const draft = structuredClone(sources) as Draft;
  change(draft);
  return compileContent(draft, { version: '0.0.0', sources: registry.sources }).issues;
}

const list = (file: ContentFile) => file.data as Entry[];
const exercise = (draft: Draft, id: string): Entry => {
  const found = draft.exercises.flatMap(list).find((entry) => entry['id'] === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const credits = (entry: Entry) => entry['muscles'] as Entry[];
const template = (draft: Draft, id: string): Entry => {
  const found = draft.templates.map((file) => file.data as Entry).find((t) => t['id'] === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const firstSlot = (entry: Entry) =>
  ((entry['days'] as Entry[])[0]!['slots'] as Entry[])[0]! satisfies Entry;

describe('content lint', () => {
  it('passes the shipped content', () => {
    expect(issuesAfter(() => {})).toEqual([]);
  });

  describe('references', () => {
    it('catches a broken variantOf', () => {
      expect(
        issuesAfter((d) => {
          exercise(d, 'ex.paused-back-squat')['variantOf'] = 'ex.does-not-exist';
        }),
      ).toEqual(['ex.paused-back-squat: variantOf ex.does-not-exist does not exist']);
    });

    it('catches a broken replacedBy and a deprecated exercise without replacement', () => {
      expect(
        issuesAfter((d) => {
          exercise(d, 'ex.goblet-squat')['status'] = 'deprecated';
        }),
      ).toEqual([
        'ex.goblet-squat: a deprecated exercise names its replacement (replacedBy), an active one does not',
      ]);
      expect(
        issuesAfter((d) => {
          Object.assign(exercise(d, 'ex.goblet-squat'), {
            status: 'deprecated',
            replacedBy: 'ex.gone',
          });
        }),
      ).toEqual(['ex.goblet-squat: replacedBy ex.gone does not exist']);
    });

    it('catches unknown equipment and muscles', () => {
      expect(
        issuesAfter((d) => {
          const squat = exercise(d, 'ex.goblet-squat');
          (squat['equipment'] as { allOf: string[] }).allOf.push('eq.unicorn');
          credits(squat).push({
            muscle: 'mu.neck',
            credit: 0.5,
            evidence: 'C',
            source: 'src.powr-eb-mapping',
          });
        }),
      ).toEqual([
        'ex.goblet-squat: unknown equipment eq.unicorn',
        'ex.goblet-squat: unknown muscle mu.neck',
      ]);
    });

    it('catches a variant of a variant', () => {
      expect(
        issuesAfter((d) => {
          exercise(d, 'ex.barbell-front-squat')['variantOf'] = 'ex.paused-back-squat';
        }),
      ).toContain('ex.barbell-front-squat: variantOf ex.paused-back-squat, itself a variant');
    });
  });

  describe('sources', () => {
    it('catches a citation of an excluded source', () => {
      expect(
        issuesAfter((d) => {
          credits(exercise(d, 'ex.barbell-bench-press'))[0]!['source'] = 'src.barbalho2019';
        }),
      ).toEqual([
        expect.stringMatching(
          /^ex\.barbell-bench-press mu\.chest\.sternocostal: cites excluded source src\.barbalho2019 /,
        ),
      ]);
    });

    it('catches a citation of an unknown source', () => {
      expect(
        issuesAfter((d) => {
          credits(exercise(d, 'ex.barbell-bench-press'))[0]!['source'] = 'src.nobody2020';
        }),
      ).toEqual(['ex.barbell-bench-press mu.chest.sternocostal: unknown source src.nobody2020']);
    });

    it('requires C for 0.25 credits and the convention source for C, a study for H and EMG', () => {
      expect(
        issuesAfter((d) => {
          Object.assign(credits(exercise(d, 'ex.barbell-deadlift')).at(-1)!, {
            evidence: 'H',
            source: 'src.kubo2019',
          });
        }),
      ).toEqual(['ex.barbell-deadlift: mu.forearms.flexors: a 0.25 credit is tagged C']);
      expect(
        issuesAfter((d) => {
          credits(exercise(d, 'ex.leg-extension'))[0]!['source'] = 'src.powr-eb-mapping';
        }),
      ).toEqual([
        'ex.leg-extension: mu.quads: C credits cite src.powr-eb-mapping, H and EMG credits cite a study',
      ]);
    });
  });

  describe('exercise content', () => {
    it('catches a missing cue', () => {
      expect(
        issuesAfter((d) => {
          const squat = exercise(d, 'ex.goblet-squat');
          squat['cues'] = (squat['cues'] as unknown[]).slice(0, 2);
        }),
      ).toEqual([
        'exercises/squat.yaml entry 4 (ex.goblet-squat): cues: An exercise has 3–6 cues (EXL-03)',
      ]);
    });

    it('catches credits that would count one set twice and a missing primary', () => {
      expect(
        issuesAfter((d) => {
          credits(exercise(d, 'ex.leg-extension')).push({
            muscle: 'mu.quads.vasti',
            credit: 0.5,
            evidence: 'C',
            source: 'src.powr-eb-mapping',
          });
        }),
      ).toEqual(['ex.leg-extension: credits both mu.quads and its sub-region mu.quads.vasti']);
      expect(
        issuesAfter((d) => {
          credits(exercise(d, 'ex.dumbbell-shrug'))[0]!['credit'] = 0.5;
        }),
      ).toEqual(['ex.dumbbell-shrug: has no primary muscle (credit 1)']);
    });

    it('catches a duplicate synonym across exercises', () => {
      expect(
        issuesAfter((d) => {
          (exercise(d, 'ex.goblet-squat')['synonyms'] as string[]).push('Back Squat');
        }),
      ).toEqual(['ex.goblet-squat: "back squat" already names ex.barbell-back-squat']);
    });

    it('enforces competition-lift semantics (EXL-07, TMR-02)', () => {
      expect(
        issuesAfter((d) => {
          const defaults = exercise(d, 'ex.paused-bench-press')['defaults'] as Entry;
          Object.assign(defaults, { fixedRom: false, restClass: 'hypertrophyCompound' });
        }),
      ).toEqual([
        'ex.paused-bench-press: competition lifts and their variants have fixedRom',
        'ex.paused-bench-press: competition lifts rest as strength',
      ]);
    });

    it('catches a load type the equipment cannot provide', () => {
      expect(
        issuesAfter((d) => {
          (exercise(d, 'ex.dumbbell-curl')['load'] as Entry)['type'] = 'band';
        }),
      ).toEqual(['ex.dumbbell-curl: load type band needs bands']);
    });

    it('catches an exercise in the wrong pattern file', () => {
      expect(
        issuesAfter((d) => {
          exercise(d, 'ex.goblet-squat')['pattern'] = 'lunge';
        }),
      ).toEqual([
        'exercises/squat.yaml: ex.goblet-squat has pattern lunge; move it to exercises/lunge.yaml',
      ]);
    });
  });

  describe('taxonomy, equipment and presets', () => {
    it('catches a sub-region outside its group', () => {
      expect(
        issuesAfter((d) => {
          const chest = list(d.muscles)[0]!;
          (chest['subRegions'] as Entry[])[0]!['id'] = 'mu.upper-chest';
        }),
      ).toContain('mu.upper-chest: a sub-region of mu.chest is mu.chest.<sub-region>');
    });

    it('catches preset items and inventories that do not match', () => {
      expect(
        issuesAfter((d) => {
          const hotel = list(d.presets).find((p) => p['id'] === 'preset.hotel-gym')!;
          hotel['items'] = (hotel['items'] as string[])
            .filter((item) => item !== 'eq.dumbbells')
            .concat('eq.hoverboard');
        }),
      ).toEqual([
        'preset.hotel-gym: unknown equipment eq.hoverboard',
        'preset.hotel-gym: kg.dumbbells given but eq.dumbbells is not an item',
        'preset.hotel-gym: lb.dumbbells given but eq.dumbbells is not an item',
      ]);
    });
  });

  describe('templates', () => {
    it('needs a deload rule that names a rules-registry parameter', () => {
      expect(
        issuesAfter((d) => {
          (template(d, 'tpl.bb-full-body-3day')['mesocycle'] as Entry)['deloadRule'] =
            'deload.planned';
        }),
      ).toEqual([
        'tpl.bb-full-body-3day: mesocycle.deloadRule deload.planned is not a rules parameter',
      ]);
    });

    it('catches an unknown target and a slot no exercise can fill', () => {
      expect(
        issuesAfter((d) => {
          Object.assign(firstSlot(template(d, 'tpl.bb-full-body-3day')), {
            pattern: 'wristExtension',
            targets: ['mu.chest', 'mu.neck'],
          });
        }),
      ).toEqual([
        'tpl.bb-full-body-3day: a.squat: unknown target mu.neck',
        'tpl.bb-full-body-3day: a.squat: no exercise in the library fits this slot',
      ]);
    });

    it('catches targets outside the EB bands and a goal the style does not train', () => {
      expect(
        issuesAfter((d) => {
          Object.assign(firstSlot(template(d, 'tpl.pl-sbd-3day')), {
            repRange: [1, 8],
            effort: { rpe: [9.5, 10] },
          });
          firstSlot(template(d, 'tpl.bb-ppl-6day'))['goal'] = 'strength';
        }),
      ).toEqual([
        'tpl.bb-ppl-6day: push-a.chest: goal strength does not fit a bodybuilding template',
        'tpl.pl-sbd-3day: heavy.squat: reps 1–8 lie outside the band 1–6',
        'tpl.pl-sbd-3day: heavy.squat: RPE 9.5–10 lie outside the band 6–9.5',
      ]);
    });

    it('allows one default template per style × days cell', () => {
      expect(
        issuesAfter((d) => {
          const copy = structuredClone(template(d, 'tpl.pl-sbd-3day'));
          copy['id'] = 'tpl.pl-sbd-3day-copy';
          d.templates.push({ file: 'templates/pl-sbd-3day-copy.yaml', data: copy });
        }),
      ).toEqual([
        'tpl.pl-sbd-3day-copy: tpl.pl-sbd-3day is already the default for powerlifting × 3 days',
      ]);
    });
  });
});
