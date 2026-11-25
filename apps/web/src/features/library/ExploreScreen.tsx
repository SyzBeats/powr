import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Dumbbell, PersonStanding, Plus } from 'lucide-react';

import { Badge } from '#ui/badge';
import { buttonClass } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { useLibraryQuery } from '../../hooks/use-library';

/**
 * The Explore tab (§8.9.1): the body map (MAP-01…07) and the exercise library (EXL-02), plus the
 * user's own exercises (EXL-04). A hub of large entries, each one tap from its screen.
 */
export function ExploreScreen() {
  const { t } = useLingui();
  return (
    <Screen title={t`Explore`}>
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <PersonStanding aria-hidden="true" />
          <Trans>Body map</Trans>
        </h2>
        <p className="text-fg-muted">
          <Trans>
            Tap a muscle to see your hard sets this week and the best exercises for it with your
            equipment.
          </Trans>
        </p>
        <Link to="/explore/body-map" className={buttonClass({ variant: 'primary', size: 'lg' })}>
          <Trans>Open the body map</Trans>
        </Link>
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Dumbbell aria-hidden="true" />
          <Trans>Exercise library</Trans>
        </h2>
        <p className="text-fg-muted">
          <Trans>
            Search by name, filter by muscle, equipment or movement, and see how to do each
            exercise.
          </Trans>
        </p>
        <Link to="/explore/exercises" className={buttonClass({ size: 'lg' })}>
          <Trans>Browse exercises</Trans>
        </Link>
      </Card>
      <CustomExercisesCard />
    </Screen>
  );
}

/** EXL-04: the user's own exercises, retired ones marked. */
function CustomExercisesCard() {
  const custom = useLibraryQuery('custom-exercises', (library, deps) =>
    library.listCustomExercises(deps),
  );
  const list = custom.loaded
    ? custom.value.toSorted(
        (a, b) =>
          Number(a.status !== 'active') - Number(b.status !== 'active') ||
          a.name.en.localeCompare(b.name.en),
      )
    : [];
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Your custom exercises</Trans>
      </h2>
      {!custom.loaded ? (
        <output className="block text-fg-muted">
          <Trans>Loading your exercises…</Trans>
        </output>
      ) : list.length === 0 ? (
        <p className="text-fg-muted">
          <Trans>
            None yet. Add an exercise the library does not have, or copy one and change it.
          </Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="custom-exercises">
          {list.map((exercise) => (
            <li key={exercise.id}>
              <Link
                to="/explore/exercises/$exerciseId"
                params={{ exerciseId: exercise.id }}
                className="flex min-h-target items-center justify-between gap-2 rounded-xl px-2 py-1 font-semibold"
              >
                <span className="flex flex-wrap items-center gap-2">
                  {exercise.name.en}
                  {exercise.status === 'active' ? null : (
                    <Badge>
                      <Trans>Retired</Trans>
                    </Badge>
                  )}
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/explore/exercises/new" className={buttonClass({ size: 'lg' })}>
        <Plus aria-hidden="true" className="size-5" />
        <Trans>Create a custom exercise</Trans>
      </Link>
    </Card>
  );
}
