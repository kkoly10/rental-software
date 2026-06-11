"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe, hasStripeEnv } from "@/lib/stripe/config";
import { canAcceptStripePayments } from "@/lib/stripe/connect";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { canTransition, type BookingState } from "@/lib/market/booking-state";

/**
 * Marketplace payment session (spec §15/§23 + the payments decision
 * record): a DESTINATION charge on the platform account —
 * `transfer_data.destination` = the seller's Connect Express account,
 * `application_fee_amount` = the platform fee already snapshotted on
 * the booking. The renter pays the subtotal only; the §9 deposit is
 * NOT collected here (it is authorized close to handoff — M4).
 *
 * Flow: seller approves → booking awaiting_payment with a 24h hold →
 * renter clicks Pay → this action creates the Checkout Session →
 * /api/market/stripe/webhooks flips the booking to confirmed.
 */
export async function payForBooking(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!z.string().uuid().safeParse(bookingId).success) return;
  if (!hasSupabaseEnv() || !hasStripeEnv()) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:booking-pay",
      actor: key,
      limit: 10,
      windowSeconds: 300,
      strict: true,
    });
    if (!limit.allowed) return;
  } catch {
    return;
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: booking } = await admin
    .from("market_bookings")
    .select(
      "id, state, renter_profile_id, organization_id, subtotal_cents, platform_fee_cents, rental_days, quantity, stripe_checkout_session_id, market_listings ( title )",
    )
    .eq("id", bookingId)
    .eq("renter_profile_id", user.id)
    .maybeSingle();
  if (!booking) return;
  if ((booking.state as BookingState) !== "awaiting_payment") return;

  const { data: org } = await admin
    .from("organizations")
    .select(
      "stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted",
    )
    .eq("id", booking.organization_id)
    .maybeSingle();

  const connectReady =
    org &&
    canAcceptStripePayments({
      accountId: org.stripe_connect_account_id,
      chargesEnabled: org.stripe_connect_charges_enabled,
      payoutsEnabled: org.stripe_connect_payouts_enabled,
      detailsSubmitted: org.stripe_connect_details_submitted,
    });
  if (!connectReady || !org?.stripe_connect_account_id) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const listingTitle =
    (booking.market_listings as unknown as { title: string } | null)?.title ??
    "Marketplace rental";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: booking.subtotal_cents,
          product_data: {
            name: listingTitle,
            description: `${booking.rental_days} day rental · qty ${booking.quantity}`,
          },
        },
      },
    ],
    payment_intent_data: {
      application_fee_amount: booking.platform_fee_cents,
      transfer_data: { destination: org.stripe_connect_account_id },
      // §9: save the card so the deposit can be AUTHORIZED off-session
      // at handoff−96h (never charged at booking time).
      setup_future_usage: "off_session",
    },
    customer_creation: "always",
    metadata: {
      surface: "marketplace",
      market_booking_id: booking.id,
    },
    success_url: `${siteUrl}/market/rentals?paid=1`,
    cancel_url: `${siteUrl}/market/rentals`,
  });

  await admin
    .from("market_bookings")
    .update({
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (session.url) redirect(session.url);
}

/** Used by the webhook: idempotent confirm of a paid booking. */
export async function confirmPaidBooking(input: {
  bookingId: string;
  paymentIntentId: string | null;
}): Promise<"confirmed" | "skipped"> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: booking } = await admin
    .from("market_bookings")
    .select("id, state, hold_id, deposit_cents")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking) return "skipped";

  const from = booking.state as BookingState;
  if (from === "confirmed") return "skipped"; // duplicate delivery
  if (!canTransition(from, "confirmed")) return "skipped";

  // Pull the saved card + customer off the payment intent so the §9
  // deposit hold can run off-session later.
  let customerId: string | null = null;
  let paymentMethodId: string | null = null;
  if (input.paymentIntentId && hasStripeEnv()) {
    try {
      const pi = await getStripe().paymentIntents.retrieve(input.paymentIntentId);
      customerId = typeof pi.customer === "string" ? pi.customer : (pi.customer?.id ?? null);
      paymentMethodId =
        typeof pi.payment_method === "string"
          ? pi.payment_method
          : (pi.payment_method?.id ?? null);
    } catch {
      // Deposit scheduling degrades to 'failed' later if these stay
      // null — payment confirmation itself must not fail on this.
    }
  }

  await admin
    .from("market_bookings")
    .update({
      state: "confirmed",
      stripe_payment_intent_id: input.paymentIntentId,
      stripe_customer_id: customerId,
      stripe_payment_method_id: paymentMethodId,
      deposit_status: booking.deposit_cents > 0 ? "scheduled" : "none",
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("state", from);

  if (booking.hold_id) {
    await admin
      .from("market_reservation_holds")
      .update({ state: "confirmed", expires_at: null, updated_at: new Date().toISOString() })
      .eq("id", booking.hold_id);
  }

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: "booking.paid",
    actor: "system",
    payload: { payment_intent_id: input.paymentIntentId },
  });

  return "confirmed";
}
