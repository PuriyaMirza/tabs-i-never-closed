// The reader's page body for a link's saved text (see app/read/[id]/page.tsx).
// A server component: it only lays out text that was already saved.
import type { Link } from "@/lib/types.ts";
import { formatBytes, readingMinutes, type SavedArticle, type SavedText, type SavedThread } from "@/lib/savedtext.ts";
import DocIcon from "./DocIcon.tsx";
import ReaderBar from "./ReaderBar.tsx";
import ReaderEnd from "./ReaderEnd.tsx";

const points = (n: number | null) => (n === null ? null : `${n} point${n === 1 ? "" : "s"}`);

export default function ReaderView({ link, text }: { link: Link; text: SavedText }) {
  // Back to wherever the link lives now.
  const back = link.done_at ? { href: "/done", label: "Done" } : { href: "/", label: "Inbox" };

  return (
    <main className="reader">
      <ReaderBar title={link.title} url={link.url} back={back} />
      <header className="reader-head">
        <p className="reader-kicker">{text.kind === "reddit" ? `reddit · r/${text.subreddit}` : link.domain}</p>
        <h1 className="reader-title" id="reader-title">
          {link.title}
        </h1>
        {text.kind === "reddit" ? (
          <p className="reader-byline">{[`u/${text.author}`, points(text.score)].filter(Boolean).join(" · ")}</p>
        ) : (
          text.byline && <p className="reader-byline">{text.byline}</p>
        )}
        <p className="reader-meta">
          <DocIcon />
          {[
            "Saved for offline",
            formatBytes(text.bytes),
            text.kind === "reddit" ? `top ${text.comments.length} comments` : `about ${readingMinutes(text.words)} min`,
          ].join(" · ")}
        </p>
      </header>
      {text.kind === "article" ? <Article text={text} /> : <Thread text={text} />}
      <ReaderEnd id={link.id} title={link.title} done={link.done_at !== null} back={back} />
    </main>
  );
}

function Article({ text }: { text: SavedArticle }) {
  return (
    <article className="reader-body">
      {text.blocks.map((block, i) =>
        block.kind === "h" ? (
          <h2 key={i}>{block.text}</h2>
        ) : block.kind === "quote" ? (
          <blockquote key={i}>{block.text}</blockquote>
        ) : (
          <p key={i} className={block.kind === "li" ? "reader-li" : undefined}>
            {block.text}
          </p>
        ),
      )}
    </article>
  );
}

function Thread({ text }: { text: SavedThread }) {
  // Only web addresses become links (never "javascript:" and the like).
  const linkHref = text.link && /^https?:\/\//i.test(text.link) ? text.link : null;
  return (
    <>
      <article className="reader-body">
        {text.post.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {linkHref && (
          <p>
            <a href={linkHref} target="_blank" rel="noopener noreferrer">
              {linkHref}
            </a>
          </p>
        )}
      </article>
      {text.comments.length > 0 && (
        <section className="comments" aria-label="Top comments">
          <p className="comments-label">Top comments</p>
          {text.comments.map((c, i) => (
            <div
              key={i}
              className={`comment${c.depth === 0 ? " is-top" : ""}`}
              style={c.depth > 0 ? { marginLeft: `${(c.depth - 1) * 16 + 4}px` } : undefined}
            >
              <p className="comment-meta">{[`u/${c.author}`, points(c.score)].filter(Boolean).join(" · ")}</p>
              {c.paragraphs.map((p, j) => (
                <p key={j} className="comment-text">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
