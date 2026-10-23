// Asks the service worker (public/sw.js) to keep, or forget, a saved copy of
// a reader page, so "Read offline" works even if the page was never opened
// while online. Does nothing when no service worker is running (e.g. in
// `npm run dev`).
export function keepOffline(path: string) {
  navigator.serviceWorker?.controller?.postMessage({ type: "cache-page", path });
}

export function forgetOffline(path: string) {
  navigator.serviceWorker?.controller?.postMessage({ type: "drop-page", path });
}

/** Where a link's saved text is read. */
export const readerPath = (id: number) => `/read/${id}`;
