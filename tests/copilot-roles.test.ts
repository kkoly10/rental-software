import test from "node:test";
import assert from "node:assert/strict";
import {
  COPILOT_CHAT_ROLES,
  COPILOT_ACTION_ROLES,
  copilotRoleAllowed,
  type CopilotRole,
} from "../lib/security/copilot-roles.ts";

test("chat awareness is owner/admin/dispatcher; crew and viewer are excluded", () => {
  for (const role of ["owner", "admin", "dispatcher"] as CopilotRole[]) {
    assert.equal(copilotRoleAllowed(role, COPILOT_CHAT_ROLES), true, `${role} should chat`);
  }
  for (const role of ["crew", "viewer"] as CopilotRole[]) {
    assert.equal(copilotRoleAllowed(role, COPILOT_CHAT_ROLES), false, `${role} must not chat`);
  }
});

test("actions are owner/admin only; dispatcher/crew/viewer are excluded", () => {
  for (const role of ["owner", "admin"] as CopilotRole[]) {
    assert.equal(copilotRoleAllowed(role, COPILOT_ACTION_ROLES), true, `${role} may act`);
  }
  for (const role of ["dispatcher", "crew", "viewer"] as CopilotRole[]) {
    assert.equal(copilotRoleAllowed(role, COPILOT_ACTION_ROLES), false, `${role} must not act`);
  }
});

test("action access is a strict subset of chat access", () => {
  for (const role of COPILOT_ACTION_ROLES) {
    assert.ok(
      COPILOT_CHAT_ROLES.includes(role),
      `${role} can act but not read — gate inconsistency`
    );
  }
});
