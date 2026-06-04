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

test("malformed JSON in the action block is treated as plain text", () => {
  const raw = "Sure.\n[ACTION:{not valid json}]";
  const { text, action } = parseActionFromResponse(raw);
  assert.equal(action, null);
  assert.ok(text.includes("[ACTION:"));
});
