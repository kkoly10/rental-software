import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getOptionalEnv } from "@/lib/env";
import { getStripe, getPlanByPriceId, hasStripeEnv } from "@/lib/stripe/config";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { fromStripeMinorUnits } from "@/lib/money/currency";
import { logAppError } from "@/lib/observability/server";
import {
  claimWebhookEvent,
  markWebhookEventFailed,
  markWebhookEventSucceeded,
} from "@/lib/stripe/webhook-ledger";
import type Stripe from "stripe";

// #360 After each material order/payment state change, invalidate the pages
// that render it so the operator dashboard, customer portal, and storefront
// catalog don't lag behind Stripe events until the next ISR cycle.
function revalidateOrderAndPayments(orderId: string): void {
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
  revalidatePath("/order-status");
}

function revalidateBilling(): void {
  revalidatePath("/dashboard/settings/billing");
  revalidatePath("/dashboard");
}

export async function POST(request: NextRequest) {
  if (!hasStripeEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = getOptionalEnv("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 503 }
    );
  }

  let event: Stripe.Event;
  const stripe = getStripe();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Idempotency: claim this Stripe event id before processing. The
  // claim is a state machine (claimed → succeeded | failed), not a
  // mere DELETE-on-failure as the pre-Tier-2 handler used — failure
  // could otherwise release the claim mid-flight and a concurrent
  // retry could re-run side-effects whose dedup the unique payment
  // index doesn't cover (confirmation email, operator notification).
  // See lib/stripe/webhook-ledger.ts for the full state machine.
  const claim = await claimWebhookEvent(admin, event.id, event.type);
  if (claim.kind === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claim.kind === "retry_exhausted") {
    // Poison-pill event — operator has to look. 200 stops the Stripe
    // retry loop; the row stays as `failed` for forensics.
    await logAppError({
      source: "stripe-webhook",
      message: `Event ${event.type} retry-exhausted; refusing to reprocess`,
      route: "/api/stripe/webhooks",
      context: { event_id: event.id, attempt: claim.attempt },
    });
    return NextResponse.json({ received: true, exhausted: true });
  }
  // claim.kind === 'claimed' OR 'ledger_unavailable' (fall-open) —
  // either way, we process. Track which path so the catch knows
  // whether there's a row to mark failed.
  const haveClaim = claim.kind === "claimed";

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription" && session.subscription) {
          // SaaS subscription checkout
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(admin, subscription);
        } else if (session.mode === "payment" && session.payment_status === "paid") {
          // Rental order deposit payment — record in the payments table
          const orderId = session.metadata?.order_id;
          const orgId = session.metadata?.organization_id;

          if (!orderId || !orgId) {
            console.error("Stripe webhook: checkout.session.completed missing required metadata", {
              sessionId: session.id,
              hasOrderId: !!orderId,
              hasOrgId: !!orgId,
            });
            break;
          }

          if (orderId && orgId) {
            // Verify the order actually belongs to the claimed org (don't trust client metadata)
            const { data: orderRecord } = await admin
              .from("orders")
              .select("id")
              .eq("id", orderId)
              .eq("organization_id", orgId)
              .maybeSingle();

            if (!orderRecord) {
              console.warn("Stripe webhook: order/org mismatch or order not found", { orderId, orgId });
              break;
            }

            // Resolve payment intent ID; fall back to session ID so dedup and
            // the unique index on (order_id, provider_payment_id) always work
            // even for Stripe sessions where payment_intent is null.
            const paymentIntentId =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id ?? null;
            const dedupId = paymentIntentId ?? session.id;

            const { count } = await admin
              .from("payments")
              .select("id", { count: "exact", head: true })
              .eq("order_id", orderId)
              .eq("provider_payment_id", dedupId);
            const alreadyRecorded = (count ?? 0) > 0;

            if (!alreadyRecorded) {
              // amount_total is in the currency's minor unit; the helper
              // applies zero-decimal handling for JPY/KRW/VND/etc.
              const amountPaid = fromStripeMinorUnits(session.amount_total ?? 0, session.currency);
              const paymentType = session.metadata?.payment_type === "balance" ? "balance" : "deposit";

              // Insert with conflict guard — the unique index on
              // (order_id, provider_payment_id) prevents double-crediting
              // even if the app-level dedup check above has a TOCTOU gap.
              const { error: insertErr } = await admin.from("payments").insert({
                order_id: orderId,
                provider: "stripe",
                provider_payment_id: dedupId,
                payment_type: paymentType,
                payment_status: "paid",
                amount: amountPaid,
                paid_at: new Date().toISOString(),
              });

              // If unique constraint violation, this is a duplicate — skip silently
              if (insertErr?.code === "23505") {
                break;
              }
              if (insertErr) {
                await logAppError({
                  organizationId: orgId,
                  source: "stripe-webhook",
                  message: "checkout.session.completed: payment row insert failed",
                  route: "/api/stripe/webhooks",
                  context: {
                    event_id: event.id,
                    order_id: orderId,
                    db_error_code: insertErr.code,
                    db_error_message: insertErr.message,
                  },
                });
                break;
              }

              // Recompute balance from all payments and sync the cached field
              const { getOrderFinancialsAdmin } = await import(
                "@/lib/payments/financials"
              );
              const financials = await getOrderFinancialsAdmin(admin, orderId);

              if (financials) {
                // Balance update is unconditional — it just mirrors recomputed payments.
                await admin
                  .from("orders")
                  .update({ balance_due_amount: financials.remainingBalance })
                  .eq("id", orderId)
                  .eq("organization_id", orgId)
                  .is("deleted_at", null);

                // #343 TOCTOU — perform the awaiting_deposit → confirmed flip
                // as an atomic conditional update so a concurrent operator
                // cancellation isn't silently overwritten by the webhook.
                if (financials.depositFulfilled) {
                  await admin
                    .from("orders")
                    .update({ order_status: "confirmed" })
                    .eq("id", orderId)
                    .eq("organization_id", orgId)
                    .eq("order_status", "awaiting_deposit")
                    .is("deleted_at", null);
                }
              }

              // Convert temporary checkout hold to permanent order hold
              await admin
                .from("availability_blocks")
                .update({ expires_at: null, block_type: "order_hold" })
                .eq("source_order_id", orderId)
                .eq("block_type", "checkout_hold");

              // Send confirmation emails — non-critical, never throws to outer handler
              try {
                const { data: orderData } = await admin
                  .from("orders")
                  .select("order_number, customer_id, balance_due_amount, event_date, subtotal_amount, delivery_fee_amount, total_amount, deposit_due_amount, order_items(item_name_snapshot)")
                  .eq("id", orderId)
                  .eq("organization_id", orgId)
                  .is("deleted_at", null)
                  .maybeSingle();

                if (orderData?.customer_id) {
                  const { data: customer } = await admin
                    .from("customers")
                    .select("first_name, last_name, email")
                    .eq("id", orderData.customer_id)
                    .eq("organization_id", orgId)
                    .is("deleted_at", null)
                    .maybeSingle();

                  if (customer?.email) {
                    const { triggerPaymentReceivedEmail, triggerOrderConfirmationEmail } = await import("@/lib/email/triggers");

                    // Order confirmation email (deferred from checkout since Stripe payment was required)
                    if (paymentType === "deposit") {
                      const items = (orderData.order_items as { item_name_snapshot: string }[] | null) ?? [];
                      const productName = items[0]?.item_name_snapshot ?? "Rental";
                      await triggerOrderConfirmationEmail({
                        organizationId: orgId,
                        customerFirstName: customer.first_name ?? "there",
                        customerEmail: customer.email,
                        orderNumber: orderData.order_number,
                        productName,
                        eventDate: orderData.event_date ?? "",
                        subtotal: Number(orderData.subtotal_amount ?? 0),
                        deliveryFee: Number(orderData.delivery_fee_amount ?? 0),
                        total: Number(orderData.total_amount ?? 0),
                        depositDue: Number(orderData.deposit_due_amount ?? 0),
                      }).catch((e: unknown) =>
                        logAppError({
                          organizationId: orgId,
                          source: "stripe-webhook",
                          message: "checkout.session.completed: order confirmation email failed",
                          route: "/api/stripe/webhooks",
                          context: { event_id: event.id, order_id: orderId, customer_email: customer.email },
                          error: e,
                        })
                      );
                    }

                    await triggerPaymentReceivedEmail({
                      organizationId: orgId,
                      customerFirstName: customer.first_name ?? "there",
                      customerEmail: customer.email,
                      orderNumber: orderData.order_number,
                      amount: amountPaid,
                      paymentType,
                      paymentMethod: "stripe",
                      newBalance: financials?.remainingBalance ?? Number(orderData.balance_due_amount ?? 0),
                    });

                    // Operator-facing alert: customer just paid via Stripe.
                    const { triggerOperatorActivityAlertEmail } = await import("@/lib/email/triggers");
                    await triggerOperatorActivityAlertEmail({
                      organizationId: orgId,
                      orderId,
                      orderNumber: orderData.order_number,
                      customerName:
                        `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
                        "Customer",
                      event: "payment_received",
                      detail: `$${amountPaid.toFixed(2)} via Stripe`,
                    });
                  }
                }
              } catch (emailErr) {
                await logAppError({
                  organizationId: orgId,
                  source: "stripe-webhook",
                  message: "checkout.session.completed: payment confirmation email failed",
                  route: "/api/stripe/webhooks",
                  context: { event_id: event.id, order_id: orderId },
                  error: emailErr,
                });
              }

              // In-app notification for operator
              try {
                const { createNotification } = await import("@/lib/data/notifications");
                const { data: notifOrder } = await admin
                  .from("orders")
                  .select("order_number")
                  .eq("id", orderId)
                  .eq("organization_id", orgId)
                  .is("deleted_at", null)
                  .maybeSingle();
                const orderNumber = notifOrder?.order_number ?? orderId;
                await createNotification(
                  orgId,
                  "payment_received",
                  "Payment received",
                  `$${amountPaid.toFixed(2)} ${paymentType} via Stripe — Order ${orderNumber}`,
                  `/dashboard/orders/${orderId}`
                );
              } catch (notifErr) {
                await logAppError({
                  organizationId: orgId,
                  source: "stripe-webhook",
                  message: "checkout.session.completed: operator notification creation failed",
                  route: "/api/stripe/webhooks",
                  context: { event_id: event.id, order_id: orderId },
                  error: notifErr,
                });
              }

              revalidateOrderAndPayments(orderId);
            }
          }
        }
        break;
      }

      case "charge.refunded": {
        // Operator issued a refund in the Stripe dashboard — mirror it in the payments table
        // so balance_due_amount stays correct and the dashboard shows the refund.
        const charge = event.data.object as Stripe.Charge;
        const piRef = charge.payment_intent;
        const paymentIntentId =
          typeof piRef === "string" ? piRef : (piRef as { id?: string })?.id ?? null;

        if (!paymentIntentId) break;

        const { data: originalPayment } = await admin
          .from("payments")
          .select("id, order_id, payment_type, orders!inner(organization_id)")
          .eq("provider_payment_id", paymentIntentId)
          .eq("provider", "stripe")
          .maybeSingle();

        if (!originalPayment) break;
        // `orders` arrives as either a single row or an array depending on the
        // PostgREST embed shape; narrow safely and bail out (logging) if the
        // joined org is missing rather than dereferencing undefined.
        const ordersJoin = originalPayment.orders as unknown;
        const ordersRow = Array.isArray(ordersJoin) ? ordersJoin[0] : ordersJoin;
        const refundOrgId =
          typeof ordersRow === "object" && ordersRow !== null && typeof (ordersRow as { organization_id?: unknown }).organization_id === "string"
            ? (ordersRow as { organization_id: string }).organization_id
            : null;
        if (!refundOrgId) {
          await logAppError({
            source: "stripe-webhook",
            message: "charge.refunded: missing organization_id on original payment",
            route: "/api/stripe/webhooks",
            context: { event_id: event.id, payment_id: originalPayment.id, order_id: originalPayment.order_id },
          });
          break;
        }

        // Process each individual refund object; each has a unique id for dedup.
        // Webhook Charge payloads don't reliably expand the `refunds` sub-list
        // (it's paginated and often empty/truncated), so fetch authoritatively
        // from the API to avoid silently dropping refunds.
        //
        // Connect: direct-charge refunds arrive as connected-account
        // events (event.account = acct_xxx) and the charge lives THERE —
        // a platform-key list call would 404 with resource_missing and
        // the refund row would silently never land. Scope the call to
        // the event's account when present.
        const refundCurrency = charge.currency; // ISO 4217, lowercase
        let refunds = (charge.refunds?.data ?? []) as Array<{ id: string; amount: number }>;
        if (refunds.length === 0 && charge.id) {
          try {
            const refundList = await stripe.refunds.list(
              { charge: charge.id, limit: 100 },
              event.account ? { stripeAccount: event.account } : undefined
            );
            refunds = refundList.data.map((r) => ({ id: r.id, amount: r.amount }));
          } catch (err) {
            console.error("[webhook] charge.refunded: failed to list refunds", err instanceof Error ? err.message : String(err));
          }
        }
        for (const refund of refunds) {
          const refundKey = `refund_${refund.id}`;
          // Atomic dedup: rely on the unique index (order_id, provider_payment_id)
          // to gate duplicates. Two concurrent webhooks for the same refund.id
          // both pass any SELECT-based check; only one INSERT wins. Catch
          // 23505 (unique violation) below: it means either a concurrent
          // webhook beat us OR the operator-initiated refund action
          // (lib/payments/refund-actions.ts) inserted a 'pending' row that
          // now needs to flip to 'paid'. Flip via UPDATE — idempotent
          // because we're keying on the same provider_payment_id.
          // PR-3e review fix — refunds of damage_charges land as
          // payment_type='damage_refund' so compute-financials can
          // exclude them symmetrically with the charge. Generic
          // refunds (of deposits) keep the 'refund' type so they
          // subtract from totalPaid as before.
          const refundType =
            (originalPayment as { payment_type?: string }).payment_type ===
            "damage_charge"
              ? "damage_refund"
              : "refund";
          const { error: refundErr } = await admin.from("payments").insert({
            order_id: originalPayment.order_id,
            payment_type: refundType,
            payment_status: "paid",
            // Apply zero-decimal handling based on the charge's currency.
            // Previously divided by 100 unconditionally — JPY/KRW refunds
            // were recorded at 1/100th of the correct amount.
            amount: fromStripeMinorUnits(refund.amount, refundCurrency),
            provider: "stripe",
            provider_payment_id: refundKey,
            stripe_refund_id: refund.id,
            paid_at: new Date().toISOString(),
          });

          if (refundErr?.code === "23505") {
            // Row already exists — operator-initiated refund inserted as
            // 'pending', or a concurrent webhook beat us. Either way, the
            // refund has now succeeded server-side, so flip status to
            // 'paid' and set paid_at. WHERE status='pending' makes this
            // a no-op for already-paid rows (idempotent re-runs).
            await admin
              .from("payments")
              .update({ payment_status: "paid", paid_at: new Date().toISOString() })
              .eq("order_id", originalPayment.order_id)
              .eq("provider_payment_id", refundKey)
              .eq("payment_status", "pending");
            continue;
          }
          if (refundErr) {
            console.error("[webhook] charge.refunded: insert failed", refundErr.message);
          }
        }

        // Recompute and sync cached balance
        const { getOrderFinancialsAdmin } = await import("@/lib/payments/financials");
        const refundFinancials = await getOrderFinancialsAdmin(admin, originalPayment.order_id);
        if (refundFinancials) {
          await admin
            .from("orders")
            .update({ balance_due_amount: refundFinancials.remainingBalance })
            .eq("id", originalPayment.order_id)
            .eq("organization_id", refundOrgId)
            .is("deleted_at", null);

          // When all payments have been refunded (net paid ≤ 0), mark the order refunded.
          // Only advance non-terminal statuses — don't overwrite "cancelled".
          if (refundFinancials.totalPaid <= 0) {
            await admin
              .from("orders")
              .update({ order_status: "refunded" })
              .eq("id", originalPayment.order_id)
              .eq("organization_id", refundOrgId)
              .is("deleted_at", null)
              .not("order_status", "in", '("cancelled","refunded")');
          }

          // Send refund notification email to customer
          try {
            const { data: refundOrder } = await admin
              .from("orders")
              .select("id, order_number, organization_id, customer_id")
              .eq("id", originalPayment.order_id)
              .is("deleted_at", null)
              .maybeSingle();
            if (refundOrder?.customer_id && refundOrder.organization_id) {
              const { data: refundCustomer } = await admin
                .from("customers")
                .select("first_name, last_name, email")
                .eq("id", refundOrder.customer_id)
                .eq("organization_id", refundOrgId)
                .is("deleted_at", null)
                .maybeSingle();
              const totalRefunded = fromStripeMinorUnits(
                refunds.reduce((sum, r) => sum + r.amount, 0),
                refundCurrency
              );
              if (refundCustomer?.email) {
                const { triggerPaymentReceivedEmail } = await import("@/lib/email/triggers");
                await triggerPaymentReceivedEmail({
                  organizationId: refundOrder.organization_id,
                  customerFirstName: refundCustomer.first_name ?? "there",
                  customerEmail: refundCustomer.email,
                  orderNumber: refundOrder.order_number,
                  amount: totalRefunded,
                  paymentType: "refund",
                  paymentMethod: "stripe",
                  newBalance: refundFinancials.remainingBalance,
                });
              }
              const { triggerRefundOperatorAlertEmail } = await import("@/lib/email/triggers");
              await triggerRefundOperatorAlertEmail({
                organizationId: refundOrder.organization_id,
                orderId: refundOrder.id,
                orderNumber: refundOrder.order_number,
                customerName:
                  `${refundCustomer?.first_name ?? ""} ${refundCustomer?.last_name ?? ""}`.trim() ||
                  "Customer",
                amount: totalRefunded,
                providerPaymentId: event.id,
              });
            }
          } catch (refundEmailErr) {
            await logAppError({
              organizationId: refundOrgId,
              source: "stripe-webhook",
              message: "charge.refunded: refund notification email failed",
              route: "/api/stripe/webhooks",
              context: { event_id: event.id, order_id: originalPayment.order_id },
              error: refundEmailErr,
            });
          }

          revalidateOrderAndPayments(originalPayment.order_id);
        }
        break;
      }

      case "payment_method.attached": {
        // PR-2c — saved card. setup_future_usage=on_session on the
        // deposit attaches a payment method to the connected-account
        // Customer. Mirror it onto payment_methods so the operator's
        // "Charge for damage" action can pick it without a live API
        // call. Customer is resolved via the acct-scoped stripe id
        // we stamped on customers.stripe_customer_id at checkout.
        const pm = event.data.object as Stripe.PaymentMethod;
        const pmCustomerId =
          typeof pm.customer === "string"
            ? pm.customer
            : pm.customer?.id ?? null;
        if (!pmCustomerId || !event.account) break;

        const { data: customerRow } = await admin
          .from("customers")
          .select("id, organization_id")
          .eq("stripe_customer_id", pmCustomerId)
          .is("deleted_at", null)
          .maybeSingle();
        if (!customerRow) {
          console.warn("[webhook] payment_method.attached: no customer for stripe id", pmCustomerId);
          break;
        }

        // Unique index on stripe_payment_method_id absorbs the dedup
        // race; ignore 23505 like the refund insert does.
        const { error: pmInsertError } = await admin.from("payment_methods").insert({
          organization_id: customerRow.organization_id,
          customer_id: customerRow.id,
          stripe_payment_method_id: pm.id,
          card_brand: pm.card?.brand ?? null,
          card_last4: pm.card?.last4 ?? null,
          card_exp_month: pm.card?.exp_month ?? null,
          card_exp_year: pm.card?.exp_year ?? null,
        });
        if (pmInsertError && pmInsertError.code !== "23505") {
          await logAppError({
            organizationId: customerRow.organization_id,
            source: "stripe-webhook.payment_method_attached",
            message: "Failed to mirror payment method",
            context: { stripePaymentMethodId: pm.id, reason: pmInsertError.message },
          });
        }
        break;
      }

      case "account.updated": {
        // Connect Express — mirror the connected account's verification
        // state onto the org so the dashboard + checkout gate read
        // fresh columns without a live Stripe call. Lookup order:
        // metadata.organization_id (we stamp it at account creation),
        // falling back to the acct id column for accounts created
        // before metadata stamping or re-linked manually.
        const account = event.data.object as Stripe.Account;
        const metaOrgId = account.metadata?.organization_id;

        let connectOrgId: string | null = null;
        if (metaOrgId) {
          const { data: byMeta } = await admin
            .from("organizations")
            .select("id, stripe_connect_account_id")
            .eq("id", metaOrgId)
            .is("deleted_at", null)
            .maybeSingle();
          // Guard against a spoofed/foreign metadata value: the org's
          // recorded acct id must match (or be unset mid-onboarding).
          if (
            byMeta &&
            (!byMeta.stripe_connect_account_id ||
              byMeta.stripe_connect_account_id === account.id)
          ) {
            connectOrgId = byMeta.id;
          }
        }
        if (!connectOrgId) {
          const { data: byAcct } = await admin
            .from("organizations")
            .select("id")
            .eq("stripe_connect_account_id", account.id)
            .is("deleted_at", null)
            .maybeSingle();
          connectOrgId = byAcct?.id ?? null;
        }

        if (!connectOrgId) {
          console.warn("[webhook] account.updated: no org for account", account.id);
          break;
        }

        const { syncConnectAccountToOrg } = await import("@/lib/stripe/connect");
        await syncConnectAccountToOrg(admin, connectOrgId, account);
        revalidateBilling();
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(admin, subscription);
        revalidateBilling();
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.organization_id;

        if (orgId) {
          const cancelCustomerId = typeof subscription.customer === "string"
            ? subscription.customer
            : (subscription.customer as { id?: string })?.id;
          const { data: cancelOrg } = await admin
            .from("organizations")
            .select("stripe_customer_id")
            .eq("id", orgId)
            .is("deleted_at", null)
            .maybeSingle();
          if (!cancelOrg || (cancelCustomerId && cancelOrg.stripe_customer_id !== cancelCustomerId)) {
            console.warn("[webhook] subscription.deleted: customer mismatch, skipping", { orgId });
            break;
          }
          await admin
            .from("organizations")
            .update({
              stripe_subscription_id: null,
              subscription_status: "canceled",
              subscription_plan: null,
              subscription_current_period_end: null,
              subscription_canceled_at: new Date().toISOString(),
            })
            .eq("id", orgId)
            .is("deleted_at", null);

          revalidateBilling();
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Subscription renewal succeeded — ensure status is synced to "active"
        const successInvoice = event.data.object as Stripe.Invoice;
        const successSubRef = successInvoice.parent?.subscription_details?.subscription;
        const successSubId = typeof successSubRef === "string" ? successSubRef : successSubRef?.id;
        if (successSubId) {
          const subscription = await stripe.subscriptions.retrieve(successSubId);
          await syncSubscription(admin, subscription);
          revalidateBilling();
        }
        break;
      }

      case "invoice.payment_failed": {
        // Sync the full subscription state (not just status) so plan tier,
        // period_end, and all cached fields stay consistent with Stripe.
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(admin, subscription);
          revalidateBilling();
        }
        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        // Disputes / chargebacks are a critical operator concern: a customer
        // has contested a payment with their card issuer. Surface as an
        // operator notification + structured log; we don't auto-refund or
        // change order state — that's an explicit operator decision.
        const dispute = event.data.object as Stripe.Dispute;
        const chargeRef = dispute.charge;
        const chargeId = typeof chargeRef === "string" ? chargeRef : chargeRef?.id ?? null;
        const piRef = dispute.payment_intent;
        const paymentIntentId = typeof piRef === "string" ? piRef : piRef?.id ?? null;

        // Find the original order via the original Stripe payment row.
        let orderId: string | null = null;
        let orgId: string | null = null;
        if (paymentIntentId) {
          const { data: orig } = await admin
            .from("payments")
            .select("order_id, orders!inner(organization_id)")
            .eq("provider_payment_id", paymentIntentId)
            .eq("provider", "stripe")
            .maybeSingle();
          if (orig) {
            orderId = orig.order_id;
            const orders = Array.isArray(orig.orders) ? orig.orders[0] : orig.orders;
            const orgRow = orders as { organization_id?: string } | null;
            orgId = orgRow?.organization_id ?? null;
          }
        }

        if (orgId) {
          try {
            const { createNotification } = await import("@/lib/data/notifications");
            const stage = event.type.split(".").at(-1) ?? event.type;
            const status = (dispute as { status?: string }).status ?? "unknown";
            await createNotification(
              orgId,
              "payment_dispute",
              `Card dispute ${stage}`,
              `Stripe dispute on charge ${chargeId ?? paymentIntentId ?? "?"}: status=${status}, reason=${dispute.reason ?? "unknown"}`,
              orderId ? `/dashboard/orders/${orderId}` : "/dashboard/payments"
            );
          } catch (notifErr) {
            console.error("[webhook] dispute notification failed:", notifErr);
          }
        }

        // Always log the dispute event so it's queryable even if we couldn't
        // map it to an org / order.
        await admin.from("app_event_logs").insert({
          organization_id: orgId,
          source: "stripe-webhook",
          action: event.type,
          status: "warning",
          route: "/api/stripe/webhooks",
          metadata: {
            event_id: event.id,
            dispute_id: dispute.id,
            charge_id: chargeId,
            payment_intent: paymentIntentId,
            reason: dispute.reason,
            status: (dispute as { status?: string }).status,
            amount: dispute.amount,
            currency: dispute.currency,
          },
        });
        break;
      }

      case "payment_intent.payment_failed": {
        // Card declined / authentication failed. Record so the operator can
        // see why a charge didn't go through (especially relevant for
        // on-file card retries against an existing order).
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderIdMeta = intent.metadata?.order_id ?? null;
        const orgIdMeta = intent.metadata?.organization_id ?? null;
        const lastError = intent.last_payment_error;

        await admin.from("app_event_logs").insert({
          organization_id: orgIdMeta,
          source: "stripe-webhook",
          action: "payment_intent.payment_failed",
          status: "warning",
          route: "/api/stripe/webhooks",
          metadata: {
            event_id: event.id,
            payment_intent: intent.id,
            order_id: orderIdMeta,
            amount: intent.amount,
            currency: intent.currency,
            error_code: lastError?.code,
            error_message: lastError?.message,
            decline_code: (lastError as { decline_code?: string } | null)?.decline_code,
          },
        });

        if (orgIdMeta) {
          try {
            const { createNotification } = await import("@/lib/data/notifications");
            await createNotification(
              orgIdMeta,
              "payment_failed",
              "Payment failed",
              `Stripe declined a payment: ${lastError?.message ?? "no error message"}`,
              orderIdMeta ? `/dashboard/orders/${orderIdMeta}` : "/dashboard/payments"
            );
          } catch (notifErr) {
            console.error("[webhook] payment_failed notification failed:", notifErr);
          }
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }
  } catch (error) {
    // Mark the claim failed (NOT delete it). Stripe's next retry will
    // re-enter through claimWebhookEvent and either re-claim (if
    // under the attempt cap) or get retry_exhausted (capped).
    if (haveClaim) {
      const reason =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      await markWebhookEventFailed(admin, event.id, reason);
    }
    await logAppError({
      source: "stripe-webhook",
      message: `Handler error for ${event.type}`,
      route: "/api/stripe/webhooks",
      context: { event_id: event.id, event_type: event.type },
      error,
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  if (haveClaim) {
    await markWebhookEventSucceeded(admin, event.id);
  }
  return NextResponse.json({ received: true });
}

async function syncSubscription(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  subscription: Stripe.Subscription
) {
  const orgId = subscription.metadata?.organization_id;
  if (!orgId) {
    console.warn("Subscription missing organization_id metadata:", subscription.id);
    return;
  }

  // Cross-reference: verify the org's stored Stripe customer matches this subscription's customer.
  // Guards against metadata inconsistencies — the webhook signature already ensures the event
  // came from our Stripe account, but this catches data drift or copy/paste errors.
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;
  if (customerId) {
    const { data: org } = await admin
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!org || org.stripe_customer_id !== customerId) {
      console.warn("[webhook] syncSubscription: customer mismatch, skipping", {
        orgId,
        expected: org?.stripe_customer_id,
        got: customerId,
      });
      return;
    }
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const planTier = priceId ? getPlanByPriceId(priceId) : null;

  const firstItem = subscription.items.data[0];
  const periodEnd = firstItem?.current_period_end ?? null;

  await admin
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_plan: planTier ?? subscription.metadata?.plan_tier ?? null,
      subscription_current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq("id", orgId)
    .is("deleted_at", null);
}
