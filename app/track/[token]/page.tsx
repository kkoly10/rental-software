import { notFound } from "next/navigation";
import { TrackingMap } from "@/components/tracking/tracking-map";
import { getSiteUrl } from "@/lib/site-url";

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

async function resolveToken(token: string): Promise<TrackingData | null> {
  const baseUrl = await getSiteUrl();
  try {
    const res = await fetch(`${baseUrl}/api/tracking/${token}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function TrackingPage({ params }: PageProps) {
  const { token } = await params;
  const data = await resolveToken(token);

  if (!data) notFound();

  return (
    <main style={{ minHeight: "100svh", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Order #{data.orderNumber}</div>
        <h1 style={{ fontSize: "1.3rem", margin: "4px 0 0", fontWeight: 700 }}>
          {data.isLive
            ? `Your delivery is on the way, ${data.customerFirstName}!`
            : data.stopStatus === "completed"
            ? "Your delivery has arrived!"
            : "Tracking your delivery"}
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
