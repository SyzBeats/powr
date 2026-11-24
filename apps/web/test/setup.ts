// Component tests: the app's CSS (Tailwind and the tokens), the English catalog, and a clean
// DOM after every test (Vitest runs without globals, so Testing Library cannot register it).
import '../src/ui/app.css';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

import { activateLocale } from '../src/i18n';

await activateLocale();
// The dev server transforms lazy route and use-case chunks on first use: allow for it.
configure({ asyncUtilTimeout: 10_000 });
afterEach(() => cleanup());
