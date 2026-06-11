"use client";

import { useActionState } from "react";
import {
  renterCancelBooking,
  sellerCancelBooking,
  reportRenterNoShow,
  reportSellerNoShow,
  type CancelActionState,
} from "@/lib/market/cancel-actions";

const initial: CancelActionState = { ok: false, message: "" };

function ActionButton({
  action,
  bookingId,
  label,
  pendingLabel,
  danger = false,
  note,
}: {
  action: (prev: CancelActionState, formData: FormData) => Promise<CancelActionState>;
  bookingId: string;
  label: string;
  pendingLabel: string;
  danger?: boolean;
  note?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.ok) {
    return <p style={{ fontSize: 12, color: "#1e7f4f", margin: "6px 0 0" }}>✓ {state.message}</p>;
  }

  return (
    <form action={formAction} style={{ display: "inline-block" }}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <button
        type="submit"
        disabled={pending}
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "7px 14px",
          borderRadius: 999,
          border: `1px solid ${danger ? "#b91c1c" : "currentColor"}`,
          color: danger ? "#b91c1c" : "inherit",
          background: "transparent",
          cursor: "pointer",
        }}
        title={note}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.message ? (
        <span style={{ display: "block", fontSize: 12, color: "#b91c1c", marginTop: 4 }}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function RenterCancelButton({ bookingId }: { bookingId: string }) {
  return (
    <ActionButton
      action={renterCancelBooking}
      bookingId={bookingId}
      label="Cancel"
      pendingLabel="Cancelling…"
      note="Refund follows this category's cancellation policy; the deposit hold is always released."
    />
  );
}

export function SellerNoShowButton({ bookingId }: { bookingId: string }) {
  return (
    <ActionButton
      action={reportSellerNoShow}
      bookingId={bookingId}
      label="Seller didn't show"
      pendingLabel="Reporting…"
      danger
      note="Available 30 minutes after the start time — you get a full refund."
    />
  );
}

export function SellerCancelButton({ bookingId }: { bookingId: string }) {
  return (
    <ActionButton
      action={sellerCancelBooking}
      bookingId={bookingId}
      label="Cancel booking"
      pendingLabel="Cancelling…"
      danger
      note="The renter is fully refunded; repeated cancellations lower your ranking."
    />
  );
}

export function RenterNoShowButton({ bookingId }: { bookingId: string }) {
  return (
    <ActionButton
      action={reportRenterNoShow}
      bookingId={bookingId}
      label="Renter didn't show"
      pendingLabel="Recording…"
      danger
      note="Available 30 minutes after the start time — you keep one day's price."
    />
  );
}
