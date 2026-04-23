const CACHE_NAME = 'mobilet-cache-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// Removed fetch listener to prevent "response served by service worker has redirections" error.
// The service worker still exists to satisfy PWA requirements.
