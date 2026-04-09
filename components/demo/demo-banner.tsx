"use client";

/**
 * Sticky banner shown on demo storefront pages.
 * Drives visitors to sign up for their own storefront.
 */
export function DemoBanner() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "korent.app";
  const signupUrl = appUrl
    ? `${appUrl}/signup`
    : `https://${appDomain}/signup`;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "10px 16px",
        background: "rgba(15, 23, 42, 0.82)",
        backdropFilter: "blur(8px)",
        color: "#fff",
        fontSize: "0.85rem",
        lineHeight: 1.4,
        textAlign: "center",
        flexWrap: "wrap",
      }}
    >
      <span>
        This is a sample storefront powered by <strong>Korent</strong>.
      </span>
      <a
        href={signupUrl}
        style={{
          display: "inline-block",
          padding: "5px 14px",
          background: "#2563eb",
          color: "#fff",
          borderRadius: 6,
          fontWeight: 600,
          fontSize: "0.82rem",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Create your own free storefront
      </a>
    </div>
  );
}
