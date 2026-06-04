/**
 * Tests for the WhatsApp → SMS dispatch decision tree (Sprint 4).
 *
 * The dispatcher's job: when an org is enabled for WhatsApp AND the
 * customer opted in AND a template ContentSid is configured, send
 * via WhatsApp; otherwise fall back to SMS. The tests stub
 * `globalThis.fetch` and verify which Twilio endpoint shape we hit
 * for each combination of preconditions.
 *
 * Why this matters: the wrong fall-through silently sends nothing,
 * which the operator won't notice until customers complain. These
 * tests pin the decision tree.
 */
import test from "node:test";
import assert from "node:assert/strict";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function withTwilioEnv<T>(fn: () => Promise<T> | T): Promise<T> | T {
  Object.assign(process.env, {
    TWILIO_ACCOUNT_SID: "AC_test",
    TWILIO_AUTH_TOKEN: "test_token",
    TWILIO_PHONE_NUMBER: "+15005550006",
    WHATSAPP_TEMPLATE_ORDER_CONFIRMATION: "HX_test_template_sid",
  });
  return fn();
}

function restore() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  globalThis.fetch = originalFetch;
}

type Row = Record<string, unknown>;

function fakeSupabase(orgRow: Row | null) {
  return {
    from(_table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        is() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: orgRow, error: null });
        },
      };
      return builder;
    },
  };
}

function recordFetch() {
  const calls: { url: string; body: string }[] = [];
  globalThis.fetch = (async (input: unknown, init?: { body?: BodyInit | null }) => {
    calls.push({
      url: String(input),
      body: typeof init?.body === "string" ? init.body : "",
    });
    return new Response(
      JSON.stringify({ sid: "SM_demo_sid" }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  return calls;
}

test("WhatsApp path: enabled + opted-in + template → POST with whatsapp: prefix + ContentSid", async () => {
  await withTwilioEnv(async () => {
    const calls = recordFetch();
    const { dispatchCustomerMessage } = await import("../lib/messaging/dispatch.ts");
    const result = await dispatchCustomerMessage(
      // @ts-expect-error narrowed-fake supabase
      fakeSupabase({ whatsapp_enabled: true, whatsapp_sender_id: "+14155238886" }),
      "org_1",
      {
        templateKey: "orderConfirmation",
        smsBody: "Hi from Acme! Your booking ORD-1 is confirmed.",
        phone: "+15551234567",
        customerWhatsappOptedIn: true,
        customerWhatsappNumber: null,
        params: { businessName: "Acme Rentals", orderNumber: "ORD-1" },
      },
    );
    assert.equal(result.channel, "whatsapp");
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].body, /To=whatsapp%3A%2B15551234567/);
    assert.match(calls[0].body, /From=whatsapp%3A%2B14155238886/);
    assert.match(calls[0].body, /ContentSid=HX_test_template_sid/);
    // 1-indexed positional template variables
    assert.match(calls[0].body, /ContentVariables=.*Acme.*Rentals.*ORD-1/);
  });
  restore();
});

test("Falls back to SMS when org has whatsapp_enabled=false", async () => {
  await withTwilioEnv(async () => {
    const calls = recordFetch();
    const { dispatchCustomerMessage } = await import("../lib/messaging/dispatch.ts");
    const result = await dispatchCustomerMessage(
      // @ts-expect-error fake supabase
      fakeSupabase({ whatsapp_enabled: false, whatsapp_sender_id: "+14155238886" }),
      "org_2",
      {
        templateKey: "orderConfirmation",
        smsBody: "SMS body here",
        phone: "+15551234567",
        customerWhatsappOptedIn: true,
        customerWhatsappNumber: null,
        params: { businessName: "Acme", orderNumber: "ORD-2" },
      },
    );
    assert.equal(result.channel, "sms");
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].body, /To=%2B15551234567/);
    assert.match(calls[0].body, /Body=SMS\+body\+here/);
    assert.ok(!calls[0].body.includes("whatsapp"));
  });
  restore();
});

test("Falls back to SMS when customer is not opted in", async () => {
  await withTwilioEnv(async () => {
    const calls = recordFetch();
    const { dispatchCustomerMessage } = await import("../lib/messaging/dispatch.ts");
    const result = await dispatchCustomerMessage(
      // @ts-expect-error fake supabase
      fakeSupabase({ whatsapp_enabled: true, whatsapp_sender_id: "+14155238886" }),
      "org_3",
      {
        templateKey: "orderConfirmation",
        smsBody: "SMS only please",
        phone: "+15551234567",
        customerWhatsappOptedIn: false,
        customerWhatsappNumber: null,
        params: { businessName: "Acme", orderNumber: "ORD-3" },
      },
    );
    assert.equal(result.channel, "sms");
    assert.equal(result.ok, true);
    assert.ok(!calls[0].body.includes("whatsapp"));
  });
  restore();
});

test("Falls back to SMS when template ContentSid env var is missing", async () => {
  await withTwilioEnv(async () => {
    delete process.env.WHATSAPP_TEMPLATE_ORDER_CONFIRMATION;
    const calls = recordFetch();
    const { dispatchCustomerMessage } = await import("../lib/messaging/dispatch.ts");
    const result = await dispatchCustomerMessage(
      // @ts-expect-error fake supabase
      fakeSupabase({ whatsapp_enabled: true, whatsapp_sender_id: "+14155238886" }),
      "org_4",
      {
        templateKey: "orderConfirmation",
        smsBody: "SMS fallback",
        phone: "+15551234567",
        customerWhatsappOptedIn: true,
        customerWhatsappNumber: null,
        params: { businessName: "Acme", orderNumber: "ORD-4" },
      },
    );
    assert.equal(result.channel, "sms");
    assert.equal(result.ok, true);
    assert.ok(!calls[0].body.includes("whatsapp"));
  });
  restore();
});

test("Uses customer.whatsapp_number when set, instead of phone", async () => {
  await withTwilioEnv(async () => {
    const calls = recordFetch();
    const { dispatchCustomerMessage } = await import("../lib/messaging/dispatch.ts");
    const result = await dispatchCustomerMessage(
      // @ts-expect-error fake supabase
      fakeSupabase({ whatsapp_enabled: true, whatsapp_sender_id: "+14155238886" }),
      "org_5",
      {
        templateKey: "orderConfirmation",
        smsBody: "irrelevant — WhatsApp wins",
        phone: "+15551234567",
        customerWhatsappOptedIn: true,
        customerWhatsappNumber: "+15559999999",
        params: { businessName: "Acme", orderNumber: "ORD-5" },
      },
    );
    assert.equal(result.channel, "whatsapp");
    assert.match(calls[0].body, /To=whatsapp%3A%2B15559999999/);
  });
  restore();
});

test("buildVariables shapes the positional map correctly per template", async () => {
  await withTwilioEnv(async () => {
    const { buildVariables } = await import(
      "../lib/messaging/whatsapp-templates.ts"
    );

    assert.deepEqual(
      buildVariables("orderConfirmation", {
        businessName: "Acme",
        orderNumber: "ORD-1",
      }),
      { "1": "Acme", "2": "ORD-1" },
    );

    assert.deepEqual(
      buildVariables("depositReminder", {
        businessName: "Acme",
        orderNumber: "ORD-2",
        amount: "$200",
      }),
      { "1": "Acme", "2": "ORD-2", "3": "$200" },
    );

    assert.deepEqual(
      buildVariables("deliveryEnRoute", {
        businessName: "Acme",
        orderNumber: "ORD-3",
        eta: "30 minutes",
        trackingUrl: "https://t.example/abc",
      }),
      {
        "1": "Acme",
        "2": "ORD-3",
        "3": "30 minutes",
        "4": "https://t.example/abc",
      },
    );

    // Missing param → empty string, not "undefined" in the final URL
    assert.deepEqual(
      buildVariables("orderConfirmation", { businessName: "Acme" }),
      { "1": "Acme", "2": "" },
    );
  });
  restore();
});
