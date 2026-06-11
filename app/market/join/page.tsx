import Link from "next/link";
import type { Metadata } from "next";
import { RenterJoinForm } from "@/components/market/renter-join-form";

export const metadata: Metadata = { title: "Create a renter account" };

export default function MarketJoinPage() {
  return (
    <main className="mk-wrap" style={{ maxWidth: 460 }}>
      <h1>Create your renter account</h1>
      <p className="mk-sub">
        Free to join — request bookings, message sellers, and track every
        rental in one place. Already have an account (renter or seller)?{" "}
        <a href={`/market/login?redirect=${encodeURIComponent("/market/rentals")}`}>Sign in</a>.
      </p>
      <div className="mk-panel">
        <RenterJoinForm />
      </div>
      <p className="mk-note" style={{ marginTop: 14 }}>
        Renting out your own gear instead? <Link href="/signup">Create a seller account</Link>{" "}
        — it includes the full operator toolkit.
      </p>
    </main>
  );
}
