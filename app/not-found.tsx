import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { getMessages } from "@/lib/i18n/server";

export default async function NotFound() {
  const m = await getMessages();
  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 560, textAlign: "center" }}>
          <section className="panel" style={{ padding: 48 }}>
            <div className="kicker">404</div>
            <h1 style={{ margin: "8px 0 12px" }}>{m.errors.notFound.title}</h1>
            <div className="muted" style={{ marginBottom: 20 }}>
              {m.errors.notFound.description}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link href="/" className="primary-btn">
                {m.errors.notFound.goHome}
              </Link>
              <Link href="/inventory" className="secondary-btn">
                {m.inventory.title}
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
