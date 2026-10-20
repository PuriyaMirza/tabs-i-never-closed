// Service worker: lets the installed app show the last-loaded list offline.
// Hand-written on purpose (no Workbox) so it is small enough to read.
//
// What it does:
//   * Page loads (navigations): try the network first. If that works, keep a
//     copy per page ("/" and "/done" each keep their own). If the network
//     fails, show the saved copy.
//   * Scripts, styles and icons: serve from the saved copy first, because
//     their file names change whenever their contents change.
//   * Everything else (especially /api/*, and any POST): not touched at all.
//
// When you change this file, bump VERSION so old caches are thrown away.
const VERSION = "v1";
const PAGES_CACHE = `pages-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;

// Small files saved right away so the install icon and manifest always work.
const PRECACHE = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

// Stop the static cache from growing forever: every deploy adds new file
// names, so once there are more than this many, the oldest are dropped.
const MAX_STATIC_ENTRIES = 150;

// Shown only if you are offline AND that page was never loaded before.
const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline</title>
<style>
  body { font: 16px/1.45 -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 32px 16px; text-align: center; }
  @media (prefers-color-scheme: dark) { body { background: #121212; color: #eee; } }
</style></head>
<body><p>You're offline and this page hasn't been loaded yet.</p></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // Precaching is a bonus: if one file fails, installing must still work.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete caches left behind by older versions of this file.
      const keep = [PAGES_CACHE, STATIC_CACHE];
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)));
      // Take over pages that are already open instead of waiting for a reload.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only plain page/file reads. Saving, marking done etc. are POSTs, and
  // must go straight to the server every time.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The API must always be live. (This also covers page-style GETs to /api.)
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
  } else if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
  // Anything else (for example Next.js's background page-data requests) is
  // left alone. If one fails offline, Next.js falls back to a normal page
  // load, which is handled by handleNavigation above.
});

// The page just loaded told us which script files it used (see PwaClient.tsx).
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "cache-urls" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      for (const raw of data.urls) {
        try {
          const url = new URL(raw);
          if (url.origin !== self.location.origin) continue;
          if (!url.pathname.startsWith("/_next/static/")) continue;
          if (await cache.match(url.href)) continue;
          const response = await fetch(url.href);
          if (response.ok) await cache.put(url.href, response);
        } catch {
          // Skip files that fail; this is only a head start.
        }
      }
      await trimCache(cache);
    })(),
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/manifest.webmanifest"
  );
}

async function handleNavigation(request, url) {
  // One saved copy per path, ignoring ?query and #hash.
  const cacheKey = url.origin + url.pathname;
  try {
    const response = await fetch(request);
    if (shouldSavePage(response, url)) {
      // Save a copy; the original goes to the page.
      const cache = await caches.open(PAGES_CACHE);
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch {
    // Network failed (offline, or a very bad connection).
    const cached = await caches.match(cacheKey, { cacheName: PAGES_CACHE, ignoreVary: true });
    if (cached) return cached;
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

// Only save a real, successful page. In particular never save the login
// redirect: when you're logged out, "/" redirects to "/login", and saving
// that under "/" would show the login form instead of your list offline.
function shouldSavePage(response, url) {
  if (response.status !== 200) return false; // also rejects redirects
  if (response.type !== "basic") return false; // "opaqueredirect" etc.
  if (response.redirected) return false;
  // The final address must still be the page we asked for.
  if (response.url && new URL(response.url).pathname !== url.pathname) return false;
  if (url.pathname === "/login") return false;
  const type = response.headers.get("Content-Type") || "";
  return type.includes("text/html");
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request); // throws offline; that's fine here
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    await trimCache(cache);
  }
  return response;
}

async function trimCache(cache) {
  // Oldest first. The small precached files are never dropped.
  const keys = (await cache.keys()).filter(
    (req) => !PRECACHE.includes(new URL(req.url).pathname),
  );
  const extra = keys.length - MAX_STATIC_ENTRIES;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}
