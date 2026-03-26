"use client";

import { useState } from "react";
import { CopilotPanel } from "./copilot-panel";

export function CopilotLauncher({ currentRoute }: { currentRoute?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="copilot-fab"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close Copilot" : "Open Copilot"}
        title="Operator Copilot"
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
