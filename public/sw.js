/*
 * The Studio's service worker (served at /studio/sw.js, scope /studio). It exists so the Studio can
 * be installed, and so a page opened with no connection shows a clear message instead of an error.
 *
 *   - Studio pages: network first; with no connection, the cached offline page.
 *   - Next's hashed static files (/studio/_next/static/): cache first (they never change).
 *   - Everything else passes straight to the network: API and sign-in responses (/api, /auth,
 *     /oauth, /sign-in) are never cached, and the JBD editor (/studio/editor-app) is left to the
 *     browser's own HTTP cache.
 * Bump VERSION to drop old caches.
 */
const VERSION = "studio-v1"
const OFFLINE = "/studio/offline.html"
const SHELL = [OFFLINE, "/studio/icons/icon-192.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  const p = url.pathname
  if (/^\/(api|auth|oauth|sign-in)(\/|$)/.test(p) || p.startsWith("/studio/editor-app/")) return

  if (req.mode === "navigate" && p.startsWith("/studio")) {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)))
    return
  }
  if (p.startsWith("/studio/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()))
            return res
          }),
      ),
    )
  }
})
