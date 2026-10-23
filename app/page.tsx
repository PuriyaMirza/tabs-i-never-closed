// The inbox. This is a server component: it reads the links from the database
// and puts them straight into the page's HTML. (They are NOT fetched by
// scripts afterwards.) That way the saved copy of the page that the phone
// keeps for offline reading already contains the links.
import { after } from "next/server";
import { requireLogin } from "@/lib/page-auth.ts";
import { describeMissing } from "@/lib/enrich.ts";
import { getActiveLinks, getAllTopicTags, getCounts } from "@/lib/links.ts";
import InboxClient from "./_components/InboxClient.tsx";

// Always read fresh data; never build this page ahead of time.
export const dynamic = "force-dynamic";
// Room for the background "write missing descriptions" job below.
export const maxDuration = 60;

export default async function Home() {
  await requireLogin();
  const [links, allTags, counts] = await Promise.all([getActiveLinks(), getAllTopicTags(), getCounts()]);

  // Links without a summary yet get one written in the background,
  // a few per visit; they show up the next time the inbox loads.
  if (links.some((l) => l.description === null)) {
    after(() => describeMissing(12));
  }

  return (
    <main>
      {/* The header is drawn by InboxClient, so its open count stays current. */}
      <InboxClient
        initialLinks={links}
        initialDoneCount={counts.done}
        allTags={allTags}
        serverNow={new Date().toISOString()}
      />
    </main>
  );
}
