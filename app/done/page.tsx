// The Done view: links you've finished with, most recently done first.
// Like the inbox, the links are rendered into the HTML on the server.
import { requireLogin } from "@/lib/page-auth.ts";
import { getCounts, getDoneLinks } from "@/lib/links.ts";
import DoneClient from "../_components/DoneClient.tsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Done · Tabs I Never Closed" };

export default async function DonePage() {
  await requireLogin();
  const [links, counts] = await Promise.all([getDoneLinks(), getCounts()]);

  return (
    <main>
      {/* The header is drawn by DoneClient, so its open count stays current. */}
      <DoneClient initialLinks={links} initialOpenCount={counts.open} serverNow={new Date().toISOString()} />
    </main>
  );
}
