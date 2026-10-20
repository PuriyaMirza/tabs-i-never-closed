import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaClient from "@/app/components/PwaClient.tsx";

export const metadata: Metadata = {
  title: "Tabs I Never Closed",
  description: "A personal inbox for links",
  // iPhone "Add to Home Screen": open full-screen and name the icon "Tabs".
  // (Next.js adds the manifest link and the mobile-web-app-capable tag.)
  appleWebApp: { capable: true, title: "Tabs", statusBarStyle: "default" },
  // iOS looks for this file on its own, but saying so explicitly is safer.
  icons: { apple: "/apple-touch-icon.png" },
};

// Makes the page fit phone screens instead of rendering zoomed out.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Colours the browser/status bar to match --bg in globals.css.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaClient />
        {children}
      </body>
    </html>
  );
}
