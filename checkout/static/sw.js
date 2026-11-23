/* Minimal service worker enables installable PWA Share Target on supported browsers.
   Never intercept or cache API, shared evidence, or payment responses. */
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
