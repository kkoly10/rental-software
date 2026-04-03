import { isDemoMode, getMissingEnvVars } from "@/lib/env/demo-mode";

/**
 * In production, if critical env vars are missing, show an error page
 * instead of silently serving demo data. This prevents a live operator
 * site from accidentally running in demo mode if env vars get deleted.
 */
export function ProductionEnvGuard({ children }: { children: React.ReactNode }) {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction || !isDemoMode()) {
    return <>{children}</>;
  }

  const missingVars = getMissingEnvVars();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 16px rgba(0,0,0,.06)",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#fef2f2",
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 28 }}>&#9888;</span>
        </div>
        <h1 style={{ margin: "0 0 12px", fontSize: 22, color: "#1e293b" }}>
          Application Not Configured
        </h1>
        <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
          This application is deployed to production but required environment
          variables are missing. It cannot serve live data in this state.
        </p>

        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: "16px 20px",
            textAlign: "left",
            marginBottom: 20,
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13, color: "#991b1b" }}>
            Missing environment variables:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#b91c1c" }}>
            {missingVars.map((v) => (
              <li key={v} style={{ marginBottom: 4, fontFamily: "monospace" }}>
                {v}
              </li>
            ))}
          </ul>
        </div>

        <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
          Add these variables to your hosting provider&rsquo;s environment settings and redeploy.
        </p>
      </div>
    </div>
  );
}
