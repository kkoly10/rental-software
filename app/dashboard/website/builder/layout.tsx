import type { ReactNode } from "react";

/**
 * Full-screen builder layout (PR-1b, spec §10). The dashboard has no shared
 * layout that injects the sidebar — DashboardShell is applied per page — so the
 * builder simply DOESN'T wrap its children in DashboardShell. This layout makes
 * that explicit and gives the route its own full-height, edge-to-edge shell so
 * the builder escapes the dashboard chrome and runs full-screen.
 */
export default function BuilderLayout({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: "100vh" }}>{children}</div>;
}
