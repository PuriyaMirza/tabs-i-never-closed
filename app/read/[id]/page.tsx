// The in-app reader for a link's saved text ("Save TXT"). Like the inbox it is
// rendered on the server, so the copy the service worker keeps for offline
// reading already contains the whole text.
import { notFound } from "next/navigation";
import { requireLogin } from "@/lib/page-auth.ts";
import { getSavedText } from "@/lib/links.ts";
import { parseId } from "@/lib/patch.ts";
import ReaderView from "../../_components/ReaderView.tsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reader · Tabs I Never Closed" };

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireLogin();
  const id = parseId((await params).id);
  const saved = id === null ? null : await getSavedText(id);
  if (!saved) notFound();
  return <ReaderView link={saved.link} text={saved.text} />;
}
