import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationMessages } from "../lib/copilot/conversation.ts";

test("appends the new user message to a well-formed history", () => {
  const result = buildConversationMessages(
    [
      { role: "user", content: "How much am I owed?" },
      { role: "assistant", content: "You're owed $500." },
    ],
    "Which orders?"
  );

  assert.deepEqual(result, [
    { role: "user", content: "How much am I owed?" },
    { role: "assistant", content: "You're owed $500." },
    { role: "user", content: "Which orders?" },
  ]);
});

test("with no history, returns just the new user message", () => {
  const result = buildConversationMessages([], "Hello");
  assert.deepEqual(result, [{ role: "user", content: "Hello" }]);
});

test("drops a leading assistant turn so the conversation opens on user", () => {
  const result = buildConversationMessages(
    [
      { role: "assistant", content: "stale leading reply" },
      { role: "user", content: "real first question" },
      { role: "assistant", content: "an answer" },
    ],
    "follow up"
  );

  assert.deepEqual(result, [
    { role: "user", content: "real first question" },
    { role: "assistant", content: "an answer" },
    { role: "user", content: "follow up" },
  ]);
});

test("collapses repeated roles to preserve strict alternation", () => {
  const result = buildConversationMessages(
    [
      { role: "user", content: "first" },
      { role: "user", content: "second (dup role)" },
      { role: "assistant", content: "reply" },
      { role: "assistant", content: "reply 2 (dup role)" },
    ],
    "next"
  );

  assert.deepEqual(result, [
    { role: "user", content: "first" },
    { role: "assistant", content: "reply" },
    { role: "user", content: "next" },
  ]);
});

test("drops a dangling trailing user turn before appending the new message", () => {
  const result = buildConversationMessages(
    [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2 never answered" },
    ],
    "q3"
  );

  // The unanswered q2 is dropped so we don't send two user turns in a row.
  assert.deepEqual(result, [
    { role: "user", content: "q1" },
    { role: "assistant", content: "a1" },
    { role: "user", content: "q3" },
  ]);
});

test("result always starts with user and strictly alternates", () => {
  const result = buildConversationMessages(
    [
      { role: "assistant", content: "x" },
      { role: "assistant", content: "y" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
    ],
    "m"
  );

  assert.equal(result[0].role, "user");
  for (let i = 1; i < result.length; i++) {
    assert.notEqual(result[i].role, result[i - 1].role);
  }
  assert.equal(result[result.length - 1].content, "m");
});
