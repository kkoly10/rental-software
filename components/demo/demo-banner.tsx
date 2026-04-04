"use client";

/**
 * Sticky banner shown on demo storefront pages.
 * Drives visitors to sign up for their own storefront.
 */
export function DemoBanner() {
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
        gap: 12,
        padding: "12px 24px",
        background: "rgba(30, 41, 59, 0.92)",
        backdropFilter: "blur(8px)",
        color: "#fff",
        fontSize: "0.92rem",
        lineHeight: 1.4,
        textAlign: "center",
        flexWrap: "wrap",
      }}
    >
      <span>
        This is a sample storefront powered by <strong>Korent</strong>.
      </span>
      <a
        href="https://korent.app/signup"
        style={{
          display: "inline-block",
          padding: "6px 18px",
          background: "#2563eb",
          color: "#fff",
          borderRadius: 6,
          fontWeight: 600,
          fontSize: "0.88rem",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Create your own free storefront
      </a>
    </div>
  );
}
