import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";

export default function NotFound() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 560, textAlign: "center" }}>
          <section className="panel" style={{ padding: 48 }}>
            <div className="kicker">404</div>
            <h1 style={{ margin: "8px 0 12px" }}>Page not found</h1>
            <div className="muted" style={{ marginBottom: 20 }}>
              The page you are looking for does not exist or has been moved.
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link href="/" className="primary-btn">
                Go Home
              </Link>
              <Link href="/inventory" className="secondary-btn">
                Browse Inventory
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
