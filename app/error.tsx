"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
