import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";

export default async function VerifiedPage() {
  const m = await getMessages();
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.auth.verified.kicker}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.auth.verified.title}</h1>
              <div className="muted">
                {m.auth.verified.description}
              </div>
            </div>
          </div>

          <div
            style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}
          >
            <Link href="/login" className="primary-btn">
              {m.common.signIn}
            </Link>
            <Link href="/" className="ghost-btn">
              {m.common.backToHome}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
