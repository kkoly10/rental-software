import { isDemoMode } from "@/lib/env/demo-mode";

/**
 * Persistent banner shown at the top of every page when the app is running
 * in demo mode (missing critical env vars). Cannot be dismissed.
 */
export function DemoModeBanner() {
  if (!isDemoMode()) return null;

  return (
    <div
      style={{
        background: "linear-gradient(90deg, #f59e0b, #f97316)",
        color: "#1a1a1a",
        textAlign: "center",
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.01em",
        lineHeight: "1.4",
        position: "sticky",
        top: 0,
        zIndex: 9999,
      }}
    >
      DEMO MODE — Data is not being saved. Connect your accounts to go live.{" "}
      <a
        href="/dashboard/settings"
        style={{
          color: "#1a1a1a",
          textDecoration: "underline",
          fontWeight: 700,
          marginLeft: 6,
        }}
      >
        Set up now &rarr;
      </a>
    </div>
  );
}
