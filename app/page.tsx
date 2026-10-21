// The inbox. This is a server component: it reads the links from the database
// and puts them straight into the page's HTML. (They are NOT fetched by
// scripts afterwards.) That way the saved copy of the page that the phone
// keeps for offline reading already contains the links.
import { requireLogin } from "@/lib/page-auth.ts";
import { getActiveLinks, getAllTopicTags, getCounts } from "@/lib/links.ts";
import Nav from "./_components/Nav.tsx";
import InboxClient from "./_components/InboxClient.tsx";

// Always read fresh data; never build this page ahead of time.
export const dynamic = "force-dynamic";

export default async function Home() {
  await requireLogin();
  const [links, allTags, counts] = await Promise.all([getActiveLinks(), getAllTopicTags(), getCounts()]);

  return (
    <main>
      <Nav current="inbox" />
      <InboxClient
        initialLinks={links}
        initialDoneCount={counts.done}
        allTags={allTags}
        serverNow={new Date().toISOString()}
      />
    </main>
  );
}
