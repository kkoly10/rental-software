"use client";

import { useState } from "react";
import { CopilotPanel } from "./copilot-panel";
import { useI18n } from "@/lib/i18n/provider";

export function CopilotLauncher({ currentRoute }: { currentRoute?: string }) {
  const [open, setOpen] = useState(false);
  const { messages: m } = useI18n();

  return (
    <>
      <button
        className="copilot-fab"
        onClick={() => setOpen(!open)}
        aria-label={open ? m.copilot.closeLauncher : m.copilot.openLauncher}
        title={m.copilot.title}
      >
        {open ? "\u2715" : "\u2728"}
      </button>

      {open && (
        <CopilotPanel
          currentRoute={currentRoute ?? "/dashboard"}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
