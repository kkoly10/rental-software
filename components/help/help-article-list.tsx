import Link from "next/link";
import { helpSections, getArticlesBySection } from "@/lib/help/articles";

export function HelpArticleList() {
  return (
    <div className="list" style={{ gap: 24 }}>
      {helpSections.map((section) => {
        const articles = getArticlesBySection(section);
        if (articles.length === 0) return null;

        return (
          <div key={section}>
            <h3 style={{ margin: "0 0 10px", fontSize: "1.05rem" }}>{section}</h3>
            <div className="list">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/dashboard/help/${article.slug}`}
                  className="order-card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <strong style={{ fontSize: 14 }}>{article.title}</strong>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{article.summary}</div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
