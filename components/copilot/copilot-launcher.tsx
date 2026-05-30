"use client";

import { useState, useEffect } from "react";
import { CopilotPanel } from "./copilot-panel";
import { useI18n } from "@/lib/i18n/provider";

export function CopilotLauncher({ currentRoute }: { currentRoute?: string }) {
  const [open, setOpen] = useState(false);
  const { messages: m } = useI18n();

  // Programmatic open via window event — lets the sidebar's "Ask AI"
  // entry trigger the same panel without lifting state up into the
  // dashboard shell. Pairs with CommandPalette's korent:open-command-palette.
  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener("korent:open-copilot", handleOpen);
    return () => window.removeEventListener("korent:open-copilot", handleOpen);
  }, []);

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
