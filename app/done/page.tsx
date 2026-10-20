// The Done view: links you've finished with, most recently done first.
// Like the inbox, the links are rendered into the HTML on the server.
import { requireLogin } from "@/lib/page-auth.ts";
import { getDoneLinks } from "@/lib/links.ts";
import Nav from "../_components/Nav.tsx";
import DoneClient from "../_components/DoneClient.tsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Done · Tabs I Never Closed" };

export default async function DonePage() {
  await requireLogin();
  const links = await getDoneLinks();

  return (
    <main>
      <Nav current="done" />
      <DoneClient initialLinks={links} serverNow={new Date().toISOString()} />
    </main>
  );
}
