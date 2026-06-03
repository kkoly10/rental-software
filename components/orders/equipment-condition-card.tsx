import type { ConditionRow } from "@/lib/data/equipment-condition";

/**
 * Sprint 5.5 — operator-side Equipment Condition card on the order
 * detail page. Renders the before (delivery) and after (pickup)
 * photos side-by-side for each route stop associated with the order.
 *
 * State combinations rendered:
 *   - both photos present: side-by-side comparison
 *   - delivery only: pickup column shows a placeholder ("crew hasn't
 *     captured pickup yet")
 *   - pickup only: same shape, reversed
 *   - neither: card is hidden entirely (caller's responsibility — see
 *     the conditional mount on app/dashboard/orders/[id]/page.tsx)
 *
 * Click either photo → opens in a new tab at full resolution. The
 * Sprint 5.7 follow-up will add an inline lightbox / slider; for v1
 * the simple new-tab behavior keeps the surface small.
 */
export function EquipmentConditionCard({
  rows,
  /** When true, hide the "no pickup yet" placeholder so customers don't see operational state. */
  customerFacing = false,
}: {
  rows: ConditionRow[];
  customerFacing?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <article className="panel" style={{ marginTop: 16 }}>
      <div className="section-header">
        <div>
          <div className="kicker">Equipment condition</div>
          <h2 className="page-title-sm" style={{ margin: "6px 0 0" }}>
            {customerFacing
              ? "Photos from your delivery and pickup"
              : "Before & after photos"}
          </h2>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
        {customerFacing
          ? "We document equipment condition at delivery and pickup so there's a clear record for both of us."
          : "Captured by the crew at delivery and pickup. Click a photo to see it full size."}
      </p>

      <div className="list" style={{ marginTop: 12 }}>
        {rows.map((row) => (
          <div key={row.stopId} className="order-card">
            <strong style={{ fontSize: 13 }}>
              Stop #{row.sequence} — {row.stopType === "pickup" ? "Pickup" : "Delivery"}
            </strong>
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <PhotoSlot
                title="Delivery"
                url={row.deliveryPhotoUrl}
                signature={row.deliverySignature}
                customerFacing={customerFacing}
              />
              <PhotoSlot
                title="Pickup"
                url={row.pickupPhotoUrl}
                signature={row.pickupSignature}
                customerFacing={customerFacing}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function PhotoSlot({
  title,
  url,
  signature,
  customerFacing,
}: {
  title: string;
  url: string | null;
  signature: string | null;
  customerFacing: boolean;
}) {
  return (
    <div>
      <div
        className="muted"
        style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}
      >
        {title}
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={`${title} photo`}
            style={{
              width: "100%",
              borderRadius: 8,
              border: "1px solid var(--border-color, #dbe6f4)",
              display: "block",
            }}
          />
        </a>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 140,
            borderRadius: 8,
            border: "1px dashed var(--border-color, #dbe6f4)",
            color: "var(--muted-color, #6b7a90)",
            fontSize: 12,
            padding: 12,
            textAlign: "center",
          }}
        >
          {customerFacing
            ? `No ${title.toLowerCase()} photo on file yet`
            : `Crew hasn't captured ${title.toLowerCase()} yet`}
        </div>
      )}
      {signature && (
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
          Signed: {signature.split(" — ")[0]}
        </div>
      )}
    </div>
  );
}
