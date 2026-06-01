import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { getArticleBySlug } from "@/lib/help/articles";
import { getMessages } from "@/lib/i18n/server";

export async function HelpArticleView({ slug }: { slug: string }) {
  const m = await getMessages();
  const article = getArticleBySlug(slug);

  if (!article) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: 32 }}>
        <h2>{m.helpArticle.notFound}</h2>
        <div className="muted">{m.helpArticle.notFoundBody}</div>
        <Link href="/dashboard/help" className="primary-btn" style={{ marginTop: 16, display: "inline-flex" }}>
          {m.helpArticle.backToHelp}
        </Link>
      </div>
    );
  }

  // Markdown-like rendering: paragraphs, bold, lists. The previous
  // implementation built HTML strings and shoved them into
  // dangerouslySetInnerHTML — fine while help bodies stay in-source,
  // but the moment articles become DB-backed (operator CMS, partner
  // imports) every paragraph becomes an XSS sink. Rendered as React
  // elements there's nothing for an attacker to inject into.
  const paragraphs = article.body.split("\n\n").map((block, i) => {
    const lines = block.split("\n");
    const isOrderedList = lines.every((l) => /^\d+\./.test(l.trim()));
    const isUnorderedList = lines.every((l) => l.trim().startsWith("- "));

    if (isOrderedList) {
      return (
        <ol key={i} style={{ paddingLeft: 20, margin: "12px 0" }}>
          {lines.map((line, j) => (
            <li key={j} style={{ marginBottom: 4 }}>
              {renderInline(line.replace(/^\d+\.\s*/, ""))}
            </li>
          ))}
        </ol>
      );
    }

    if (isUnorderedList) {
      return (
        <ul key={i} style={{ paddingLeft: 20, margin: "12px 0" }}>
          {lines.map((line, j) => (
            <li key={j} style={{ marginBottom: 4 }}>
              {renderInline(line.replace(/^-\s*/, ""))}
            </li>
          ))}
        </ul>
      );
    }

    // Single paragraph: render each line with <br/> separators between.
    return (
      <p key={i} style={{ margin: "12px 0", lineHeight: 1.6 }}>
        {lines.map((line, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(line)}
          </Fragment>
        ))}
      </p>
    );
  });

  return (
    <div>
      <Link href="/dashboard/help" className="ghost-btn" style={{ marginBottom: 12, display: "inline-flex", fontSize: 13 }}>
        &larr; {m.helpArticle.backToHelp}
      </Link>

      <div className="panel">
        <span className="badge" style={{ marginBottom: 8 }}>{article.section}</span>
        <h2 style={{ margin: "8px 0 4px" }}>{article.title}</h2>
        <div className="muted" style={{ marginBottom: 16 }}>{article.summary}</div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          {paragraphs}
        </div>
      </div>

      {article.related.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "1rem" }}>{m.helpArticle.relatedArticles}</h3>
          <div className="list">
            {article.related.map((relSlug) => {
              const rel = getArticleBySlug(relSlug);
              if (!rel) return null;
              return (
                <Link key={relSlug} href={`/dashboard/help/${relSlug}`} className="order-card" style={{ textDecoration: "none", color: "inherit" }}>
                  <strong style={{ fontSize: 14 }}>{rel.title}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>{rel.summary}</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Parse `**bold**` segments into React elements without ever building
// an HTML string. Anything between the markers becomes a <strong>;
// anything else passes through as plain text (so `<script>` written by
// a future CMS author shows up as literal "<script>" not an executed
// tag).
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={`b${key++}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
