import test from "node:test";
import assert from "node:assert/strict";
import { createPortalAccessToken, hashPortalAccessToken } from "../lib/portal/access-token.ts";

test("portal token generator returns non-empty url-safe token", () => {
  const token = createPortalAccessToken();
  assert.ok(token.length >= 32);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test("portal token hash is deterministic and one-way formatted", () => {
  const token = "demo_token_123";
  const hash1 = hashPortalAccessToken(token);
  const hash2 = hashPortalAccessToken(token);
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.match(hash1, /^[a-f0-9]+$/);
});
