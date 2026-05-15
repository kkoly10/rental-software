import { getMessages } from "@/lib/i18n/server";

export default async function AppLoading() {
  const m = await getMessages();
  return (
    <main className="page">
      <div className="container">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.common.loading}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.common.loading}</h1>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
