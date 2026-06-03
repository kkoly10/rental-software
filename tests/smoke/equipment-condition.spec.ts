/**
 * Sprint 5.5 — Equipment Condition surface smoke.
 *
 * Sanity check that the surfaces hosting the before/after photos
 * don't crash. The actual photo upload + RPC roundtrip needs an
 * authed crew session + Supabase storage credentials, so that's
 * covered by the manual feature-validation checklist instead.
 *
 *   - /dashboard/orders/[id]: hosts the EquipmentConditionCard for
 *     the operator
 *   - /order-status: customer portal that hosts the same card when
 *     a valid portal token is supplied
 *   - /crew/today: hosts the PickupPhotoUpload when a pickup-type
 *     stop is on today's route
 */
import { test, expect } from "@playwright/test";

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

function ok(status: number) {
  return status < 500 || status === 503;
}

test.describe("Equipment Condition surfaces", () => {
  test("/dashboard/orders/[id] still renders with the new card mount", async ({
    request,
  }) => {
    const res = await request.get(`/dashboard/orders/${FAKE_UUID}`, {
      maxRedirects: 0,
    });
    expect(
      ok(res.status()),
      `/dashboard/orders/[id] returned ${res.status()}`,
    ).toBe(true);
  });

  test("/order-status (portal) renders without a token", async ({ request }) => {
    const res = await request.get("/order-status", { maxRedirects: 0 });
    // No token = show the lookup form. 200 expected; 503 acceptable
    // if Supabase isn't configured.
    expect(ok(res.status()), `/order-status returned ${res.status()}`).toBe(true);
  });

  test("/order-status with an invalid token renders the error view, not a crash", async ({
    request,
  }) => {
    const res = await request.get(
      "/order-status?token=invalid-token-for-smoke-test",
      { maxRedirects: 0 },
    );
    expect(
      ok(res.status()),
      `/order-status?token=… returned ${res.status()}`,
    ).toBe(true);
  });

  test("/crew/today renders with the new PickupPhotoUpload mount", async ({
    request,
  }) => {
    const res = await request.get("/crew/today", { maxRedirects: 0 });
    expect(ok(res.status()), `/crew/today returned ${res.status()}`).toBe(true);
  });
});
