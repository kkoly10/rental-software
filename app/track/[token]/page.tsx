import { TrackingMap } from "@/components/tracking/tracking-map";
import { getSiteUrl } from "@/lib/site-url";
import { getMessages } from "@/lib/i18n/server";

interface PageProps {
  params: Promise<{ token: string }>;
}

interface TrackingData {
  routeId: string;
  stopStatus: string;
  orderNumber: string;
  customerFirstName: string;
  isLive: boolean;
}

type TokenResult =
  | { ok: true; data: TrackingData }
  | { ok: false; expired: boolean };

async function resolveToken(token: string): Promise<TokenResult> {
  const baseUrl = await getSiteUrl();
  try {
    const res = await fetch(`${baseUrl}/api/tracking/${token}`, { cache: "no-store" });
    if (res.ok) return { ok: true, data: await res.json() };
    return { ok: false, expired: res.status === 410 };
  } catch {
    return { ok: false, expired: false };
  }
}

export default async function TrackingPage({ params }: PageProps) {
  const { token } = await params;
  const [result, m] = await Promise.all([resolveToken(token), getMessages()]);

  if (!result.ok) {
    return (
      <main style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📦</div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>
            {result.expired ? m.tracking.expired : m.tracking.notFound}
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
            {result.expired
              ? m.tracking.expiredBody
              : m.tracking.notFoundBody}
          </p>
        </div>
      </main>
    );
  }

  const data = result.data;

  return (
    <main style={{ minHeight: "100svh", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 13, color: "#6b7280" }}>#{data.orderNumber}</div>
        <h1 style={{ fontSize: "1.3rem", margin: "4px 0 0", fontWeight: 700 }}>
          {data.isLive
            ? `${m.tracking.onTheWay} — ${data.customerFirstName}`
            : data.stopStatus === "completed"
            ? m.tracking.arrived
            : m.tracking.title}
        </h1>
        {data.isLive && (
          <div style={{ fontSize: 12, color: "#059669", marginTop: 4, fontWeight: 500 }}>
            Live · updating every 20 seconds
          </div>
        )}
        {data.stopStatus === "completed" && (
          <div style={{ fontSize: 12, color: "#059669", marginTop: 4, fontWeight: 500 }}>
            Setup complete — enjoy your event!
          </div>
        )}
      </div>

      <TrackingMap
        routeId={data.routeId}
        isLive={data.isLive}
        initialStatus={data.stopStatus}
      />
    </main>
  );
}
