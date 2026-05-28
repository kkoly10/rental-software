"use client";

import { useState } from "react";
import { searchArticles, type HelpArticle } from "@/lib/help/articles";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

export function HelpSearch() {
  const { messages: m, t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HelpArticle[]>([]);
  const [searched, setSearched] = useState(false);

  function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length > 1) {
      setResults(searchArticles(value));
      setSearched(true);
    } else {
      setResults([]);
      setSearched(false);
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder={m.dashboard.help.searchPlaceholder}
        aria-label={m.dashboard.help.searchPlaceholder}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ width: "100%", marginBottom: 16 }}
      />
      {searched && (
        <div className="list" style={{ marginBottom: 18 }}>
          {results.length === 0 ? (
            <div className="muted" style={{ padding: 12 }}>{t(m.helpSearch.noResults, { query })}</div>
          ) : (
            results.map((article) => (
              <Link
                key={article.slug}
                href={`/dashboard/help/${article.slug}`}
                className="order-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 14 }}>{article.title}</strong>
                  <span className="badge" style={{ fontSize: 11 }}>{article.section}</span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{article.summary}</div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
