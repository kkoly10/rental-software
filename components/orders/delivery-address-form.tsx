"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  updateOrderDeliveryAddress,
  type AddressActionState,
} from "@/lib/orders/address-actions";
import { useI18n } from "@/lib/i18n/provider";

const initial: AddressActionState = { ok: false, message: "" };

/**
 * Tier-1 launch fix — inline add/edit form for the order's delivery
 * address. Without it, delivery orders created from a phone call
 * (where the operator skips the optional address fields) were
 * permanently unroutable: the routing card blocked on the missing
 * address and no surface existed to add one after the fact.
 */
export function DeliveryAddressForm({
  orderId,
  address,
}: {
  orderId: string;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
  } | null;
}) {
  const { messages } = useI18n();
  const t = messages.dashboard.orders.detail.addressForm;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateOrderDeliveryAddress,
    initial,
  );
  const router = useRouter();

  // Refresh the server-rendered page after a successful save so the
  // address line + the routing card both pick up the new state.
  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state.ok, router]);

  if (!open) {
    return (
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className="secondary-btn"
          style={{ fontSize: 13 }}
          onClick={() => setOpen(true)}
        >
          {address ? t.editCta : t.addCta}
        </button>
        {state.ok && state.message && (
          <span className="badge success" style={{ marginLeft: 8, fontSize: 12 }}>
            {state.message}
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 12, gap: 8 }}>
      <input type="hidden" name="order_id" value={orderId} />

      <label>
        <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{t.line1}</div>
        <input
          name="line1"
          type="text"
          required
          defaultValue={address?.line1 ?? ""}
          style={{ width: "100%" }}
        />
      </label>
      <label>
        <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{t.line2}</div>
        <input
          name="line2"
          type="text"
          defaultValue={address?.line2 ?? ""}
          style={{ width: "100%" }}
        />
      </label>
      <div className="grid grid-3" style={{ gap: 8 }}>
        <label>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{t.city}</div>
          <input
            name="city"
            type="text"
            required
            defaultValue={address?.city ?? ""}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{t.state}</div>
          <input
            name="state"
            type="text"
            required
            maxLength={3}
            defaultValue={address?.state ?? ""}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{t.zip}</div>
          <input
            name="postal_code"
            type="text"
            required
            defaultValue={address?.postalCode ?? ""}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      {state.message && !state.ok && (
        <div role="alert" className="badge warning" style={{ padding: "8px 12px" }}>
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button className="primary-btn" type="submit" disabled={pending} style={{ fontSize: 13 }}>
          {pending ? t.saving : t.save}
        </button>
        <button
          type="button"
          className="ghost-btn"
          style={{ fontSize: 13 }}
          onClick={() => setOpen(false)}
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
