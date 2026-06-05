import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";

/**
 * End-to-end RBAC / RLS verification against the real Supabase REST + RPC API.
 *
 * Signs in as three real users (owner, viewer, brand-new invitee) and asserts
 * the security matrix the migrations encode:
 *   - members can read; a viewer cannot write orders / order_items / payments
 *   - a viewer cannot self-escalate their membership role (DB trigger)
 *   - an owner can write
 *   - a brand-new invitee can accept their invite (DEFINER RPC); a non-matching
 *     session cannot
 *
 * Env-gated — skips unless RBAC_SUPABASE_URL is set (see playwright.rbac.config.ts).
 */

const URL = process.env.RBAC_SUPABASE_URL ?? "";
const ANON = process.env.RBAC_ANON_KEY ?? "";
const PASSWORD = process.env.RBAC_TEST_PASSWORD ?? "Rbac-Passw0rd!";
const ORG_ID = process.env.RBAC_ORG_ID ?? "";
const ORDER_ID = process.env.RBAC_ORDER_ID ?? "";
const ORDER_ITEM_ID = process.env.RBAC_ORDER_ITEM_ID ?? "";
const VIEWER_ID = process.env.RBAC_VIEWER_ID ?? "";
const INVITE_TOKEN = process.env.RBAC_INVITE_TOKEN ?? "";

const OWNER_EMAIL = "owner@rbac-pwtest.invalid";
const VIEWER_EMAIL = "viewer@rbac-pwtest.invalid";
const NEW_EMAIL = "newinvitee@rbac-pwtest.invalid";

test.describe.configure({ mode: "serial" });
test.skip(!URL || !ANON, "RBAC fixture env not provided");

let ctx: APIRequestContext;
const token: Record<string, string> = {};

async function signIn(email: string): Promise<string> {
  const res = await ctx.post(`${URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email, password: PASSWORD },
  });
  expect(res.ok(), `sign-in ${email}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).access_token as string;
}

/** PostgREST call as a given role's JWT. */
function rest(
  jwt: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  opts: { body?: unknown; prefer?: string } = {}
) {
  return ctx.fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...(opts.prefer ? { Prefer: opts.prefer } : {}),
    },
    data: opts.body as object | undefined,
  });
}

test.beforeAll(async () => {
  ctx = await apiRequest.newContext();
  token.owner = await signIn(OWNER_EMAIL);
  token.viewer = await signIn(VIEWER_EMAIL);
  token.newinvitee = await signIn(NEW_EMAIL);
});

test.afterAll(async () => {
  await ctx.dispose();
});

test("members CAN read their org's orders", async () => {
  const res = await rest(token.viewer, "GET", `orders?id=eq.${ORDER_ID}&select=id,order_status`);
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows).toHaveLength(1);
  expect(rows[0].order_status).toBe("confirmed");
});

test("viewer CANNOT update an order (RLS hides the row)", async () => {
  const res = await rest(token.viewer, "PATCH", `orders?id=eq.${ORDER_ID}`, {
    body: { order_status: "cancelled" },
    prefer: "return=representation",
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toHaveLength(0); // 0 rows updated

  // Confirm nothing actually changed, read back as owner.
  const check = await rest(token.owner, "GET", `orders?id=eq.${ORDER_ID}&select=order_status`);
  expect((await check.json())[0].order_status).toBe("confirmed");
});

test("viewer CANNOT insert a payment (no write policy)", async () => {
  const res = await rest(token.viewer, "POST", "payments", {
    body: { order_id: ORDER_ID, amount: 1, payment_type: "deposit", payment_method: "cash" },
    prefer: "return=representation",
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(await res.text()).toMatch(/42501|row-level security/i);
});

test("viewer CANNOT change order-item pricing", async () => {
  const res = await rest(token.viewer, "PATCH", `order_items?id=eq.${ORDER_ITEM_ID}`, {
    body: { unit_price: 0 },
    prefer: "return=representation",
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toHaveLength(0);
});

test("viewer CANNOT self-escalate to owner (membership trigger blocks)", async () => {
  const res = await rest(token.viewer, "PATCH", `organization_memberships?profile_id=eq.${VIEWER_ID}`, {
    body: { role: "owner" },
    prefer: "return=representation",
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(await res.text()).toMatch(/owners\/admins can change/i);
});

test("owner CAN change a member's role (recursion fix — was 42P17)", async () => {
  const path = `organization_memberships?profile_id=eq.${VIEWER_ID}&organization_id=eq.${ORG_ID}`;
  const res = await rest(token.owner, "PATCH", path, {
    body: { role: "dispatcher" },
    prefer: "return=representation",
  });
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows).toHaveLength(1);
  expect(rows[0].role).toBe("dispatcher");
  // restore so later assertions still see a viewer
  await rest(token.owner, "PATCH", path, { body: { role: "viewer" } });
});

test("owner CAN update an order (legit write path works)", async () => {
  const res = await rest(token.owner, "PATCH", `orders?id=eq.${ORDER_ID}`, {
    body: { order_status: "scheduled" },
    prefer: "return=representation",
  });
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows).toHaveLength(1);
  expect(rows[0].order_status).toBe("scheduled");
});

test("invite: a NON-matching session is rejected (email_mismatch)", async () => {
  const res = await rest(token.viewer, "POST", "rpc/accept_team_invite", {
    body: { p_token: INVITE_TOKEN },
  });
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows[0].ok).toBe(false);
  expect(rows[0].reason).toBe("email_mismatch");
});

test("invite: the matching new user CAN accept and joins with the invited role", async () => {
  const res = await rest(token.newinvitee, "POST", "rpc/accept_team_invite", {
    body: { p_token: INVITE_TOKEN },
  });
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows[0].ok).toBe(true);
  expect(rows[0].role).toBe("dispatcher");
  expect(rows[0].organization_id).toBe(ORG_ID);
});
