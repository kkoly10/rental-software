"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f8fafd",
          color: "#10233f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            textAlign: "center",
            background: "white",
            borderRadius: 18,
            border: "1px solid #dbe6f4",
            padding: 48,
            boxShadow: "0 8px 24px rgba(16, 35, 63, 0.08)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#1e5dcf",
              marginBottom: 8,
            }}
          >
            Error
          </div>
          <h1 style={{ margin: "0 0 12px", fontSize: "1.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#55708f", margin: "0 0 24px", lineHeight: 1.6 }}>
            An unexpected error occurred. This is likely a temporary issue —
            please try again.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "10px 20px",
                borderRadius: 12,
                border: "none",
                background: "#1e5dcf",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{
                padding: "10px 20px",
                borderRadius: 12,
                border: "1px solid #dbe6f4",
                background: "white",
                color: "#10233f",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Go Home
            </a>
          </div>
          {error.digest && (
            <p style={{ color: "#55708f", fontSize: 12, marginTop: 16 }}>
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
