import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getPullSheetData } from "@/lib/logistics/pull-sheet";
import { getMessages } from "@/lib/i18n/server";

export default async function PullSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, m] = await Promise.all([getPullSheetData(id), getMessages()]);

  if (!data) {
    notFound();
  }

  return (
    <DashboardShell
      title={m.dashboard.pullSheet.title}
      description={m.dashboard.pullSheet.description}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Link
          href={`/dashboard/deliveries/${id}`}
          className="ghost-btn"
        >
          {m.dashboard.pullSheet.backToRoute}
        </Link>
        <a
          href={`/api/deliveries/${id}/pull-sheet`}
          target="_blank"
          rel="noopener noreferrer"
          className="primary-btn"
        >
          {m.dashboard.pullSheet.downloadPdf}
        </a>
      </div>

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">{m.dashboard.pullSheet.kicker}</div>
            <h2 style={{ margin: "6px 0 0" }}>{data.routeName}</h2>
          </div>
          <div className="muted" style={{ fontSize: 13, textAlign: "right" }}>
            <div>{data.routeDate}</div>
            <div>{data.driverName} · {data.vehicleName}</div>
          </div>
        </div>

        {data.stops.length === 0 ? (
          <div className="muted" style={{ marginTop: 16, fontSize: 14 }}>
            {m.dashboard.pullSheet.emptyState}
          </div>
        ) : (
          <>
            {/* Load totals — what to load before leaving the warehouse */}
            <div style={{ marginTop: 20 }}>
              <h3 style={{ margin: "0 0 12px" }}>{m.dashboard.pullSheet.loadTotals}</h3>
              <div
                className="panel"
                style={{
                  background: "var(--primary-bg)",
                  padding: "12px 16px",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 0",
                          fontSize: 12,
                          color: "var(--muted-color)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {m.dashboard.pullSheet.colItem}
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 0",
                          fontSize: 12,
                          color: "var(--muted-color)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {m.dashboard.pullSheet.colQty}
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 0",
                          fontSize: 12,
                          color: "var(--muted-color)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {m.dashboard.pullSheet.colStops}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.aggregated.map((item) => (
                      <tr key={item.name} style={{ borderTop: "1px solid var(--border-color)" }}>
                        <td style={{ padding: "10px 0" }}>{item.name}</td>
                        <td style={{ textAlign: "right", padding: "10px 0", fontWeight: 600 }}>
                          {item.totalQuantity}
                        </td>
                        <td style={{ textAlign: "right", padding: "10px 0", color: "var(--muted-color)" }}>
                          {item.stopCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-stop breakdown */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ margin: "0 0 12px" }}>{m.dashboard.pullSheet.stopByStop}</h3>
              <div className="list">
                {data.stops.map((stop) => (
                  <div key={stop.sequence} className="order-card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div>
                        <strong>
                          #{stop.sequence}{" "}
                          {stop.customerName || stop.orderNumber}
                        </strong>
                        {stop.address && (
                          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                            {stop.address}
                          </div>
                        )}
                        {stop.customerPhone && (
                          <div className="muted" style={{ fontSize: 13 }}>
                            {stop.customerPhone}
                          </div>
                        )}
                      </div>
                      <div className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                        {stop.scheduledTime}
                      </div>
                    </div>
                    <ul
                      style={{
                        marginTop: 10,
                        marginBottom: 0,
                        paddingLeft: 18,
                        fontSize: 14,
                      }}
                    >
                      {stop.items.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          {item.name} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </DashboardShell>
  );
}
