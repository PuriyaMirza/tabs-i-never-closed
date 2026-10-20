"use client";

// Two small jobs that only make sense in the browser:
//   1. Register the service worker (public/sw.js) so the app works offline.
//   2. Show a slim banner while the phone has no connection.
import { useEffect, useSyncExternalStore } from "react";

// Lets React re-render whenever the phone goes online or offline.
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export default function PwaClient() {
  // The server can't know if the phone is online, so it always says "online".
  // That keeps the server HTML and the first browser render identical.
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    // Only in production: in `npm run dev` a service worker would serve stale
    // code and make changes seem to not work.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          // Always check the network for a new sw.js so updates roll out.
          updateViaCache: "none",
        });

        // The very first visit loads the page's scripts before the service
        // worker is in charge, so it never sees them. Tell it which ones
        // this page already used so they are cached for offline use too.
        const registration = await navigator.serviceWorker.ready;
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => new URL(name).pathname.startsWith("/_next/static/"));
        registration.active?.postMessage({ type: "cache-urls", urls });
      } catch {
        // Offline support is a bonus. If registering fails the app still works.
      }
    })();
  }, []);

  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      Offline: showing the last loaded list (read-only)
    </div>
  );
}
