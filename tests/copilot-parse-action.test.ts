import test from "node:test";
import assert from "node:assert/strict";
import { parseActionFromResponse } from "../lib/copilot/parse-action.ts";

const ORDER_ID = "11111111-1111-1111-1111-111111111111";

test("returns text unchanged when there is no action block", () => {
  const { text, action } = parseActionFromResponse("Just a normal answer.");
  assert.equal(text, "Just a normal answer.");
  assert.equal(action, null);
});

test("parses a website content action and strips the block from the text", () => {
  const raw =
    'Here is your new hero message.\n[ACTION:{"type":"update_hero","field":"hero_message","value":"Bounce Into Fun!","preview":"Punchier hero"}]';
  const { text, action } = parseActionFromResponse(raw);
  assert.equal(text, "Here is your new hero message.");
  assert.ok(action && action.type === "update_hero");
  if (action.type === "update_hero") {
    assert.equal(action.value, "Bounce Into Fun!");
    assert.equal(action.field, "hero_message");
  }
});

test("parses a well-formed record_payment action", () => {
  const raw = `I'll record that.\n[ACTION:{"type":"record_payment","preview":"Record a $200 cash balance payment on #1042","params":{"orderId":"${ORDER_ID}","amount":200,"paymentType":"balance","paymentMethod":"cash","referenceNote":"front desk"}}]`;
  const { text, action } = parseActionFromResponse(raw);
  assert.equal(text, "I'll record that.");
  assert.ok(action && action.type === "record_payment");
  if (action.type === "record_payment") {
    assert.equal(action.params.orderId, ORDER_ID);
    assert.equal(action.params.amount, 200);
    assert.equal(action.params.paymentType, "balance");
    assert.equal(action.params.paymentMethod, "cash");
    assert.equal(action.params.referenceNote, "front desk");
  }
});

test("coerces a stringified amount and drops an empty reference note", () => {
  const raw = `[ACTION:{"type":"record_payment","params":{"orderId":"${ORDER_ID}","amount":"75.50","paymentType":"deposit","paymentMethod":"venmo","referenceNote":"  "}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.ok(action && action.type === "record_payment");
  if (action.type === "record_payment") {
    assert.equal(action.params.amount, 75.5);
    assert.equal(action.params.referenceNote, undefined);
  }
});

test("rejects a record_payment with an invalid payment method", () => {
  const raw = `[ACTION:{"type":"record_payment","params":{"orderId":"${ORDER_ID}","amount":50,"paymentType":"balance","paymentMethod":"bitcoin"}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.equal(action, null);
});

test("rejects a record_payment with a non-positive amount", () => {
  const raw = `[ACTION:{"type":"record_payment","params":{"orderId":"${ORDER_ID}","amount":0,"paymentType":"balance","paymentMethod":"cash"}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.equal(action, null);
});

test("rejects a record_payment refund — refunds are out of the Copilot's scope", () => {
  const raw = `[ACTION:{"type":"record_payment","params":{"orderId":"${ORDER_ID}","amount":50,"paymentType":"refund","paymentMethod":"cash"}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.equal(action, null);
});

test("rejects a record_payment with a missing orderId", () => {
  const raw = `[ACTION:{"type":"record_payment","params":{"amount":50,"paymentType":"balance","paymentMethod":"cash"}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.equal(action, null);
});

test("parses a valid update_order_status action", () => {
  const raw = `Marking it delivered.\n[ACTION:{"type":"update_order_status","preview":"Mark #1042 as delivered","params":{"orderId":"${ORDER_ID}","newStatus":"delivered"}}]`;
  const { text, action } = parseActionFromResponse(raw);
  assert.equal(text, "Marking it delivered.");
  assert.ok(action && action.type === "update_order_status");
  if (action.type === "update_order_status") {
    assert.equal(action.params.orderId, ORDER_ID);
    assert.equal(action.params.newStatus, "delivered");
  }
});

test("rejects update_order_status with a disallowed status (cancelled)", () => {
  const raw = `[ACTION:{"type":"update_order_status","params":{"orderId":"${ORDER_ID}","newStatus":"cancelled"}}]`;
  assert.equal(parseActionFromResponse(raw).action, null);
});

test("rejects update_order_status with an unknown status", () => {
  const raw = `[ACTION:{"type":"update_order_status","params":{"orderId":"${ORDER_ID}","newStatus":"shipped"}}]`;
  assert.equal(parseActionFromResponse(raw).action, null);
});

test("rejects update_order_status with a missing orderId", () => {
  const raw = `[ACTION:{"type":"update_order_status","params":{"newStatus":"confirmed"}}]`;
  assert.equal(parseActionFromResponse(raw).action, null);
});

test("parses a valid generate_documents action", () => {
  const raw = `Generating those now.\n[ACTION:{"type":"generate_documents","preview":"Generate docs for #1042","params":{"orderId":"${ORDER_ID}"}}]`;
  const { text, action } = parseActionFromResponse(raw);
  assert.equal(text, "Generating those now.");
  assert.ok(action && action.type === "generate_documents");
  if (action.type === "generate_documents") {
    assert.equal(action.params.orderId, ORDER_ID);
  }
});

test("rejects generate_documents with a missing orderId", () => {
  const raw = `[ACTION:{"type":"generate_documents","params":{}}]`;
  assert.equal(parseActionFromResponse(raw).action, null);
});

test("parses a valid send_reply action and normalizes optional ids", () => {
  const raw = `Here's a draft.\n[ACTION:{"type":"send_reply","preview":"Reply to Sarah","params":{"body":"Hi Sarah, your delivery is at 10am.","customerEmail":"sarah@example.com","orderNumber":"1042"}}]`;
  const { text, action } = parseActionFromResponse(raw);
  assert.equal(text, "Here's a draft.");
  assert.ok(action && action.type === "send_reply");
  if (action.type === "send_reply") {
    assert.equal(action.params.customerEmail, "sarah@example.com");
    assert.match(action.params.body, /Hi Sarah/);
    assert.equal(action.params.orderNumber, "1042");
    assert.equal(action.params.customerId, null);
    assert.equal(action.params.orderId, null);
  }
});

test("rejects send_reply with an empty body", () => {
  const raw = `[ACTION:{"type":"send_reply","params":{"body":"   ","customerEmail":"a@b.com"}}]`;
  assert.equal(parseActionFromResponse(raw).action, null);
});

test("rejects send_reply with an invalid email", () => {
  const raw = `[ACTION:{"type":"send_reply","params":{"body":"hello","customerEmail":"not-an-email"}}]`;
  assert.equal(parseActionFromResponse(raw).action, null);
});

test("malformed JSON in the action block is treated as plain text", () => {
  const raw = "Sure.\n[ACTION:{not valid json}]";
  const { text, action } = parseActionFromResponse(raw);
  assert.equal(action, null);
  assert.ok(text.includes("[ACTION:"));
});

test("payment action sanitizes referenceNote control chars and quotes", () => {
  const noisy = "check #" + String.fromCharCode(9) + "AB\n123\"|extra";
  const raw =
    `Logging it.\n[ACTION:{"type":"record_payment","preview":"x","params":{` +
    `"orderId":"${ORDER_ID}","amount":200,"paymentType":"balance",` +
    `"paymentMethod":"cash","referenceNote":${JSON.stringify(noisy)}}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.ok(action && action.type === "record_payment");
  if (action.type === "record_payment") {
    assert.equal(action.params.referenceNote, "check # AB 123extra");
  }
});

test("payment action preserves valid idempotencyKey", () => {
  const key = "11111111-2222-4333-8444-555555555555";
  const raw =
    `[ACTION:{"type":"record_payment","preview":"x","params":{` +
    `"orderId":"${ORDER_ID}","amount":50,"paymentType":"partial",` +
    `"paymentMethod":"venmo","idempotencyKey":"${key}"}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.ok(action && action.type === "record_payment");
  if (action.type === "record_payment") {
    assert.equal(action.params.idempotencyKey, key);
  }
});

test("payment action drops malformed idempotencyKey", () => {
  const raw =
    `[ACTION:{"type":"record_payment","preview":"x","params":{` +
    `"orderId":"${ORDER_ID}","amount":50,"paymentType":"partial",` +
    `"paymentMethod":"venmo","idempotencyKey":"not-a-uuid"}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.ok(action && action.type === "record_payment");
  if (action.type === "record_payment") {
    assert.equal(action.params.idempotencyKey, undefined);
  }
});

test("payment action preserves server-injected orderNumber/customerName", () => {
  const raw =
    `[ACTION:{"type":"record_payment","preview":"x","params":{` +
    `"orderId":"${ORDER_ID}","amount":100,"paymentType":"balance",` +
    `"paymentMethod":"cash","orderNumber":"1042","customerName":"Sarah Mitchell"}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.ok(action && action.type === "record_payment");
  if (action.type === "record_payment") {
    assert.equal(action.params.orderNumber, "1042");
    assert.equal(action.params.customerName, "Sarah Mitchell");
  }
});

test("update_order_status forwards server-injected label fields", () => {
  const raw =
    `[ACTION:{"type":"update_order_status","preview":"x","params":{` +
    `"orderId":"${ORDER_ID}","newStatus":"delivered",` +
    `"orderNumber":"1042","customerName":"Sarah Mitchell"}}]`;
  const { action } = parseActionFromResponse(raw);
  assert.ok(action && action.type === "update_order_status");
  if (action.type === "update_order_status") {
    assert.equal(action.params.orderNumber, "1042");
    assert.equal(action.params.customerName, "Sarah Mitchell");
  }
});
