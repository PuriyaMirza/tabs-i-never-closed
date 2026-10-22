import type { Metadata, Viewport } from "next";
import { Cormorant, Jost } from "next/font/google";
import "./globals.css";
import PwaClient from "@/app/components/PwaClient.tsx";

// The two typefaces from the "Almanac" design: Cormorant for titles, Jost for
// everything else. next/font downloads them at build time and serves them from
// our own site, so they also work offline.
const serif = Cormorant({ subsets: ["latin"], weight: ["300", "500"], style: ["normal", "italic"], variable: "--font-serif" });
const sans = Jost({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-sans" });

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
  // Colours the browser/status bar to match --bg (cream) in globals.css.
  themeColor: "#f2f1ea",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <PwaClient />
        {children}
      </body>
    </html>
  );
}
