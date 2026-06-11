import { startStripeConnectOnboarding } from "@/lib/stripe/connect-actions";

function Step({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 800,
          background: done ? "#1e7f4f" : "#f3e8dc",
          color: done ? "#fff" : "#b4a194",
        }}
      >
        {done ? "✓" : "○"}
      </span>
      <div>
        <strong style={{ fontSize: 13 }}>{label}</strong>
        {detail ? (
          <div className="muted" style={{ fontSize: 12 }}>
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Go-live checklist (roadmap item 1): the seller's 3 steps to a
 * bookable store. Payout verification is the §12 gate — listings stay
 * visible but unbookable until Stripe Connect reports
 * charges_enabled. Rendered only while incomplete.
 */
export function GoLiveChecklist({
  hasProfile,
  connectReady,
  hasPublishedListing,
}: {
  hasProfile: boolean;
  connectReady: boolean;
  hasPublishedListing: boolean;
}) {
  if (hasProfile && connectReady && hasPublishedListing) return null;
  const doneCount = [hasProfile, connectReady, hasPublishedListing].filter(Boolean).length;

  async function startOnboarding() {
    "use server";
    await startStripeConnectOnboarding();
  }

  return (
    <section
      className="panel"
      style={{ marginBottom: 18, borderLeft: "4px solid #e8590c" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <strong>🚀 {doneCount} of 3 steps to go live</strong>
        {!connectReady ? (
          <span className="muted" style={{ fontSize: 12 }}>
            Your listings stay visible, but booking opens only after payout
            verification — renters can never pay a seller we can&rsquo;t pay out.
          </span>
        ) : null}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <Step
          done={hasProfile}
          label="Create your store page"
          detail={hasProfile ? undefined : "Name, service area and bio — the form on this page."}
        />
        <Step
          done={connectReady}
          label="Verify payout details"
          detail={
            connectReady
              ? undefined
              : "A few minutes with Stripe — identity + bank account, so your earnings have somewhere to go."
          }
        />
        <Step
          done={hasPublishedListing}
          label="Publish your first listing"
          detail={hasPublishedListing ? undefined : "Create it below, then hit Publish."}
        />
      </div>
      {!connectReady ? (
        <form action={startOnboarding} style={{ marginTop: 12 }}>
          <button type="submit" className="primary-btn" style={{ fontSize: 13 }}>
            Set up payouts with Stripe →
          </button>
        </form>
      ) : null}
    </section>
  );
}
