import Link from "next/link";
import { getArticleBySlug } from "@/lib/help/articles";

export function HelpArticleView({ slug }: { slug: string }) {
  const article = getArticleBySlug(slug);

  if (!article) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: 32 }}>
        <h2>Article not found</h2>
        <div className="muted">This help article doesn&rsquo;t exist.</div>
        <Link href="/dashboard/help" className="primary-btn" style={{ marginTop: 16, display: "inline-flex" }}>
          Back to Help Center
        </Link>
      </div>
    );
  }

  // Simple markdown-like rendering: paragraphs, bold, lists
  const paragraphs = article.body.split("\n\n").map((block, i) => {
    const lines = block.split("\n");
    const isOrderedList = lines.every((l) => /^\d+\./.test(l.trim()));
    const isUnorderedList = lines.every((l) => l.trim().startsWith("- "));

    if (isOrderedList) {
      return (
        <ol key={i} style={{ paddingLeft: 20, margin: "12px 0" }}>
          {lines.map((line, j) => (
            <li key={j} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: formatInline(line.replace(/^\d+\.\s*/, "")) }} />
          ))}
        </ol>
      );
    }

    if (isUnorderedList) {
      return (
        <ul key={i} style={{ paddingLeft: 20, margin: "12px 0" }}>
          {lines.map((line, j) => (
            <li key={j} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: formatInline(line.replace(/^-\s*/, "")) }} />
          ))}
        </ul>
      );
    }

    return (
      <p key={i} style={{ margin: "12px 0", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: formatInline(block.replace(/\n/g, "<br/>")) }} />
    );
  });

  return (
    <div>
      <Link href="/dashboard/help" className="ghost-btn" style={{ marginBottom: 12, display: "inline-flex", fontSize: 13 }}>
        &larr; Back to Help Center
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
          <h3 style={{ margin: "0 0 10px", fontSize: "1rem" }}>Related articles</h3>
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

function formatInline(text: string): string {
  // Bold: **text**
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
