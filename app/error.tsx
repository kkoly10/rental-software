"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/client";
import { useI18n } from "@/lib/i18n/provider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { messages: m } = useI18n();

  useEffect(() => {
    reportClientError({
      source: "app/error",
      message: error.message || "Unknown client error",
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      stack: error.stack,
      digest: error.digest,
      userAgent:
        typeof window !== "undefined" ? window.navigator.userAgent : undefined,
    });
  }, [error]);

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560, textAlign: "center" }}>
        <section className="panel" style={{ padding: 48 }}>
          <div className="kicker">{m.common.error}</div>
          <h1 style={{ margin: "8px 0 12px" }}>{m.errors.generic.title}</h1>
          <div className="muted" style={{ marginBottom: 20 }}>
            {m.errors.generic.description}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={reset} className="primary-btn">
              {m.errors.generic.retry}
            </button>
            <Link href="/" className="secondary-btn">
              {m.errors.notFound.goHome}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
