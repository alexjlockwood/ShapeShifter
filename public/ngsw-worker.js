// The Angular version of the app registered a service worker with this name, which serves the
// old app from its cache. Browsers check for updates to it, so replace it with one that removes
// itself (and its caches) to make sure returning users get the new app.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('ngsw:')).map(key => caches.delete(key)));
      await self.registration.unregister();
    })(),
  );
});
