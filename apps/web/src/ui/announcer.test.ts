import { describe, expect, it } from 'vitest';

import { createAnnouncer } from './announcer';

function setup() {
  let now = 0;
  const timeouts: { at: number; callback: () => void }[] = [];
  const announcer = createAnnouncer({
    now: () => now,
    setTimeout: (callback, ms) => {
      const entry = { at: now + ms, callback };
      timeouts.push(entry);
      return entry;
    },
    clearTimeout: (handle) => {
      const index = timeouts.indexOf(handle as (typeof timeouts)[number]);
      if (index >= 0) timeouts.splice(index, 1);
    },
  });
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const due = timeouts.filter((entry) => entry.at <= target).toSorted((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      timeouts.splice(timeouts.indexOf(due), 1);
      due.callback();
    }
    now = target;
  };
  const spoken: string[] = [];
  announcer.subscribe(() => {
    if (announcer.text()) spoken.push(announcer.text());
  });
  return { announcer, advance, spoken };
}

describe('polite announcer (NFR-A11Y-06): no flooding', () => {
  it('announces at once, then at most one message per second, the latest of a burst', () => {
    const { announcer, advance, spoken } = setup();
    announcer.announce('Rest started, 2 minutes, 30 seconds');
    announcer.announce('2 minutes, 45 seconds left');
    announcer.announce('3 minutes left');
    expect(spoken).toEqual(['Rest started, 2 minutes, 30 seconds']);
    advance(1000);
    expect(spoken).toEqual(['Rest started, 2 minutes, 30 seconds', '3 minutes left']);
  });

  it('drops a repeat of the message still shown, and clears so it can be said again later', () => {
    const { announcer, advance, spoken } = setup();
    announcer.announce('Rest over');
    advance(2000);
    announcer.announce('Rest over');
    expect(spoken).toEqual(['Rest over']);
    advance(3000);
    expect(announcer.text()).toBe('');
    announcer.announce('Rest over');
    expect(spoken).toEqual(['Rest over', 'Rest over']);
  });

  it('ignores empty messages', () => {
    const { announcer, spoken } = setup();
    announcer.announce('  ');
    expect(spoken).toEqual([]);
  });
});
