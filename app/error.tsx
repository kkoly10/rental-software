"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          <div className="kicker">Error</div>
          <h1 style={{ margin: "8px 0 12px" }}>Something went wrong</h1>
          <div className="muted" style={{ marginBottom: 20 }}>
            An unexpected error occurred. This may be a temporary issue.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={reset} className="primary-btn">
              Try Again
            </button>
            <Link href="/" className="secondary-btn">
              Go Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}