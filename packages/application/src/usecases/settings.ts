import type { ThemePreference } from '@powr/formats';

import type { Deps } from '../deps';

export async function setTheme(deps: Deps, theme: ThemePreference): Promise<void> {
  await deps.uow.write(['settings'], async (repos) => {
    const current = await repos.settings.get();
    await repos.settings.put({ ...current, id: 'me', theme });
  });
}
