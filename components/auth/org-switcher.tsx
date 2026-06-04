"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchActiveOrg, type OrgChoice } from "@/lib/auth/switch-org";

/**
 * Sidebar header org switcher. Renders the active org name as a button;
 * clicking opens an inline list of every membership. Selecting one writes
 * the active-org cookie via `switchActiveOrg` and refreshes the dashboard.
 *
 * Decision 3.1 — matches the Notion / Linear / Slack pattern (header
 * dropdown). When the user has a single membership we render a static
 * label instead of a button so the affordance doesn't suggest there's
 * something to switch to.
 */
export function OrgSwitcher({
  active,
  options,
}: {
  active: { id: string | null; name: string | null };
  options: OrgChoice[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const activeName = active.name ?? "Organization";

  if (options.length <= 1) {
    return (
      <div
        className="dashboard-active-org"
        title={activeName}
        style={{
          fontSize: 12,
          color: "var(--text-soft)",
          marginBottom: 14,
          padding: "0 2px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {activeName}
      </div>
    );
  }

  function handlePick(orgId: string) {
    if (orgId === active.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await switchActiveOrg(orgId);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div style={{ marginBottom: 14, position: "relative" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        style={{
          width: "100%",
          textAlign: "left",
          fontSize: 12,
          color: "var(--text-soft)",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 10px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          font: "inherit",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {activeName}
        </span>
        <span aria-hidden="true" style={{ fontSize: 10 }}>
          ▾
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 10,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 4,
            margin: 0,
            listStyle: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {options.map((opt) => {
            const isActive = opt.organizationId === active.id;
            return (
              <li key={opt.organizationId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handlePick(opt.organizationId)}
                  disabled={pending}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: isActive
                      ? "var(--surface-muted)"
                      : "transparent",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 8px",
                    cursor: pending ? "wait" : "pointer",
                    font: "inherit",
                    fontSize: 13,
                    color: "var(--text)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: isActive ? 600 : 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt.name}
                  </div>
                  <div
                    className="muted"
                    style={{ fontSize: 11, textTransform: "capitalize" }}
                  >
                    {opt.role}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
