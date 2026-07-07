// Minimal service worker. Its presence + a fetch handler is what makes the
// app installable (Add to Home screen → standalone WebAPK) on Android Chrome.
//
// Deliberately NO caching: this app redeploys frequently and its data
// (prices, positions, regime) is dynamic — serving a cached shell would show
// stale content and mask deploys. So every request passes through to network;
// we only claim clients so the SW controls the page immediately after install.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Pass-through: do not call event.respondWith — the browser handles the
  // request over the network as normal. (A registered fetch handler is the
  // installability signal Chrome looks for.)
});
