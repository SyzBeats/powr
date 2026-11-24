import type { NotificationPermissionState, NotificationPort } from '@powr/application';

/** On Android, notifications can only be shown through the service worker registration (§8.8.4). */
export const notifications: NotificationPort = {
  permission: () => ('Notification' in globalThis ? Notification.permission : 'unsupported'),
  async request(): Promise<NotificationPermissionState> {
    if (!('Notification' in globalThis)) return 'unsupported';
    return Notification.requestPermission();
  },
  async show({ title, body, tag, url, renotify = false, silent = false }) {
    if (!('Notification' in globalThis) || Notification.permission !== 'granted') return false;
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) return false;
    // A silent notification must not carry a vibration pattern, not even an empty one: Chromium
    // throws a TypeError ("Silent notifications must not specify vibration patterns").
    const options = {
      body,
      tag,
      renotify,
      silent,
      data: { url },
      ...(silent ? {} : { vibrate: [200, 100, 200] }),
    };
    try {
      await registration.showNotification(title, options);
      return true;
    } catch {
      return false;
    }
  },
  async closeByTag(tag) {
    const registration = await navigator.serviceWorker?.getRegistration();
    const open = (await registration?.getNotifications({ tag })) ?? [];
    for (const notification of open) notification.close();
  },
};
