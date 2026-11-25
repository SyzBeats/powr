import { itemsOf } from '@powr/domain/equipment';
import type { LibraryUser } from '@powr/domain/library';

import type { Deps } from '../deps';
import { equipmentProfileFor, prepare, type Prepared } from '../session/context';

/*
 * What the library and body-map use cases read about the user (EXL-08, EQP-04): the equipment
 * profile in use (the active plan's, else the default one), favourites, hidden and avoided
 * exercises and patterns (all in the profile, as M2 keeps them).
 */

export interface LibraryContext {
  readonly prepared: Prepared;
  readonly user: LibraryUser;
}

export async function libraryContext(deps: Deps): Promise<LibraryContext> {
  const prepared = await prepare(deps);
  const profile = prepared.profile;
  const equipment = equipmentProfileFor(prepared, null);
  return {
    prepared,
    user: {
      equipment: equipment ? itemsOf(equipment) : null,
      favourites: profile?.preferredExercises ?? [],
      hidden: profile?.hiddenExercises ?? [],
      avoid: profile?.avoid ?? { exercises: [], patterns: [] },
    },
  };
}

/** Catalog items and every profile's custom items (EQP-07) a custom exercise may require. */
export function equipmentKnown(deps: Deps, prepared: Prepared): (id: string) => boolean {
  const custom = new Set<string>(
    prepared.equipmentProfiles.flatMap((profile) => profile.customItems.map((item) => item.id)),
  );
  return (id) =>
    custom.has(id) || deps.content.equipment().items.some((item) => (item.id as string) === id);
}
