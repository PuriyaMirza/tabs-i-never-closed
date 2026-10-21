import type { MetadataRoute } from "next";

// The web app manifest: tells iPhone Safari (Add to Home Screen) and other
// browsers how to install and open the app. Next.js serves this at
// /manifest.webmanifest and adds the <link rel="manifest"> tag by itself.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tabs I Never Closed",
    short_name: "Tabs",
    description: "A personal inbox for links",
    start_url: "/",
    scope: "/",
    // "standalone" = opens full-screen, without Safari's address bar.
    display: "standalone",
    // Match --bg (cream) in app/globals.css.
    background_color: "#f2f1ea",
    theme_color: "#f2f1ea",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Extra padding so Android can crop it into a circle without cutting the T.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
