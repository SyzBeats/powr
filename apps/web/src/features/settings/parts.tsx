import type { ReactNode } from 'react';

import { Card } from '#ui/screen';

/** The Settings sections in page order (M5s): each has an anchor the "On this page" list uses. */
export const SETTINGS_SECTIONS = [
  'profile',
  'units',
  'training',
  'workout',
  'alerts',
  'insights',
  'appearance',
  'data',
  'legal',
  'about',
] as const;
export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];

/**
 * One Settings section: a card holding a region named by its h2, with an anchor that clears the
 * sticky header (`scroll-mt-16`, WCAG 2.4.11).
 */
export function SettingsSection({
  id,
  title,
  busy,
  children,
}: {
  id: SettingsSectionId;
  title: string;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <Card>
      <section
        id={id}
        aria-labelledby={`settings-${id}`}
        aria-busy={busy}
        className="flex scroll-mt-16 flex-col gap-3"
      >
        <h2 id={`settings-${id}`} className="text-lg font-semibold">
          {title}
        </h2>
        {children}
      </section>
    </Card>
  );
}

/** A link row in Settings: a 48 px target, the label in the link, an optional line under it. */
export const settingsLinkClass =
  'flex min-h-target items-center font-semibold text-primary underline-offset-4 hover:underline';
