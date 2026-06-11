import type { Metadata } from "next";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVerificationStatus } from "@/lib/market/verification-actions";
import { IdentityUploadForm, PhoneVerifyForm } from "@/components/market/verify-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify your account" };

export default async function MarketVerifyPage() {
  let signedIn = false;
  let status = { phoneVerified: false, idOnFile: false };

  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
    if (user) status = await getVerificationStatus(user.id);
  }

  if (!signedIn) {
    return (
      <main className="mk-wrap" style={{ maxWidth: 520 }}>
        <h1>Verify your account</h1>
        <a className="mk-btn" href={`/market/login?redirect=${encodeURIComponent("/market/verify")}`}>
          Sign in first
        </a>
      </main>
    );
  }

  return (
    <main className="mk-wrap" style={{ maxWidth: 520 }}>
      <h1>Verify your account</h1>
      <p className="mk-sub">
        A verified phone AND your ID + live selfie are required to book — on
        every rental, the seller confirms it's you at pickup (Turo-style).
        Identity photos are stored privately; the seller sees them only at
        handoff, and support only if a dispute arises.
      </p>

      <div className="mk-panel" style={{ marginBottom: 16 }}>
        <b>1 · Phone number</b>
        <div style={{ marginTop: 10 }}>
          <PhoneVerifyForm verified={status.phoneVerified} />
        </div>
      </div>

      <div className="mk-panel">
        <b>2 · Identity (required to book — verified by the seller at pickup)</b>
        <div style={{ marginTop: 10 }}>
          <IdentityUploadForm onFile={status.idOnFile} />
        </div>
      </div>
    </main>
  );
}
