"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { helpSections, helpArticles, searchArticles } from "@/lib/help/articles";

/**
 * Help-center index with a client-side filter on top. Operators
 * staring at 30+ articles in a flat list used to have to scroll to
 * find the one about deposits / route maps / whatever; now they can
 * type and the matching set narrows live. Falls back to the
 * grouped-by-section view as soon as the query is empty so the
 * default "browse" mode still works.
 */
export function HelpArticleList() {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return null; // null = render grouped sections
    return searchArticles(q);
  }, [query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search help articles…"
        aria-label="Search help articles"
        style={{
          width: "100%",
          padding: "10px 14px",
          marginBottom: 18,
          borderRadius: 12,
          border: "1px solid var(--border)",
          fontSize: 14,
        }}
      />

      {matches !== null ? (
        // Search mode — flat result list with count
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            {matches.length === 0
              ? "No matching articles. Try a different keyword."
              : `${matches.length} matching article${matches.length === 1 ? "" : "s"}`}
          </div>
          <div className="list">
            {matches.map((article) => (
              <Link
                key={article.slug}
                href={`/dashboard/help/${article.slug}`}
                className="order-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <strong style={{ fontSize: 14 }}>{article.title}</strong>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {article.summary}
                </div>
                <div
                  className="muted"
                  style={{ fontSize: 11, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4 }}
                >
                  {article.section}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        // Browse mode — grouped by section, original layout
        <div className="list" style={{ gap: 24 }}>
          {helpSections.map((section) => {
            const articles = helpArticles.filter((a) => a.section === section);
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
                      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                        {article.summary}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
