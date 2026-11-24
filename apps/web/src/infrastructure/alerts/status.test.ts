import { describe, expect, it } from 'vitest';

import { parseBrowser, type BrowserInfo } from './browser';
import shipped from './capability-matrix.json' with { type: 'json' };
import {
  alertStatus,
  lookupMatrix,
  type AlertCapabilities,
  type CapabilityMatrix,
  type MatrixEntry,
} from './status';

const S22_CHROME =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const S22_SAMSUNG =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36';

describe('browser identity for the matrix', () => {
  it('tells Chrome, Samsung Internet and others apart', () => {
    expect(parseBrowser(S22_CHROME, true)).toEqual({
      family: 'chrome',
      major: 142,
      platform: 'android',
      displayMode: 'standalone',
    });
    expect(parseBrowser(S22_SAMSUNG, false)).toEqual({
      family: 'samsung',
      major: 29,
      platform: 'android',
      displayMode: 'browser',
    });
    expect(parseBrowser(`${S22_CHROME} EdgA/142.0.0.0`, false).family).toBe('other');
    expect(
      parseBrowser('Mozilla/5.0 (X11; Linux x86_64) Chrome/142.0.0.0 Safari/537.36', false),
    ).toMatchObject({ family: 'chrome', platform: 'other' });
    expect(parseBrowser('Mozilla/5.0 Firefox/140.0', false)).toMatchObject({
      family: 'other',
      major: null,
    });
  });
});

const chrome: BrowserInfo = parseBrowser(S22_CHROME, true);

const capabilities = (overrides: Partial<AlertCapabilities> = {}): AlertCapabilities => ({
  serviceWorker: true,
  notificationApi: true,
  showNotification: true,
  permission: 'granted',
  browser: chrome,
  ...overrides,
});

const entry = (overrides: Partial<MatrixEntry> = {}): MatrixEntry => ({
  family: 'chrome',
  minMajor: 142,
  maxMajor: 144,
  platform: 'android',
  displayMode: 'standalone',
  condition: 'locked',
  batterySaver: false,
  variant: 'D',
  device: 'Galaxy S22',
  runs: 9,
  onTime: 9,
  late: 0,
  missed: 0,
  status: 'supported',
  placeholder: false,
  ...overrides,
});

const matrix = (...entries: MatrixEntry[]): CapabilityMatrix => ({ matrixVersion: 1, entries });

describe('honest status (§8.8.5, TMR-06)', () => {
  it('ships an empty matrix until S-1 has run: "Limited (best effort)", never more', () => {
    expect((shipped as CapabilityMatrix).entries).toEqual([]);
    expect(alertStatus(capabilities(), shipped as CapabilityMatrix, 'D')).toMatchObject({
      level: 'limited',
      reason: 'untested',
      tested: null,
    });
  });

  it('says "Not supported" without a service worker or notifications, or when blocked', () => {
    const tested = matrix(entry());
    expect(alertStatus(capabilities({ serviceWorker: false }), tested, 'D')).toMatchObject({
      level: 'not-supported',
      reason: 'unsupported',
    });
    expect(alertStatus(capabilities({ permission: 'unsupported' }), tested, 'D').level).toBe(
      'not-supported',
    );
    expect(alertStatus(capabilities({ permission: 'denied' }), tested, 'D')).toMatchObject({
      level: 'not-supported',
      reason: 'permission-denied',
    });
  });

  it('caps at "Limited" until notifications are allowed', () => {
    expect(
      alertStatus(capabilities({ permission: 'default' }), matrix(entry()), 'D'),
    ).toMatchObject({ level: 'limited', reason: 'permission-needed' });
    expect(
      alertStatus(
        capabilities({ permission: 'default' }),
        matrix(entry({ status: 'not-supported' })),
        'D',
      ),
    ).toMatchObject({ level: 'not-supported', reason: 'tested' });
  });

  it('uses a matching device test: family, platform, mode, version range, screen locked', () => {
    expect(alertStatus(capabilities(), matrix(entry()), 'D')).toMatchObject({
      level: 'supported',
      reason: 'tested',
      tested: { device: 'Galaxy S22', runs: 9, onTime: 9 },
    });
    const miss = (overrides: Partial<MatrixEntry>) =>
      lookupMatrix(matrix(entry(overrides)), chrome, 'D');
    expect(miss({ family: 'samsung' })).toBeNull();
    expect(miss({ displayMode: 'browser' })).toBeNull();
    expect(miss({ minMajor: 143 })).toBeNull();
    expect(miss({ maxMajor: 141, minMajor: 139 })).toBeNull();
    expect(miss({ condition: 'switched' })).toBeNull();
    expect(miss({ placeholder: true })).toBeNull();
    expect(miss({ maxMajor: null, minMajor: 120 })).not.toBeNull();
  });

  it('takes the worse of battery saver on and off (it cannot be detected)', () => {
    const both = matrix(entry(), entry({ batterySaver: true, status: 'limited', onTime: 5 }));
    expect(lookupMatrix(both, chrome, 'D')).toMatchObject({ level: 'limited', onTime: 5 });
  });

  it('lets C and D stand for each other, but not for the Labs keep-alive (E)', () => {
    const onlyC = matrix(entry({ variant: 'C' }));
    expect(lookupMatrix(onlyC, chrome, 'D')?.level).toBe('supported');
    expect(lookupMatrix(onlyC, chrome, 'E')).toBeNull();
    expect(lookupMatrix(matrix(entry({ variant: 'E' })), chrome, 'C')).toBeNull();
  });
});
