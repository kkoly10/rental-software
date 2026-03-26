"use client";

import type { SuggestedPrompt } from "@/lib/copilot/suggested-prompts";

export function CopilotSuggestedPrompts({
  prompts,
  onSelect,
}: {
  prompts: SuggestedPrompt[];
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="copilot-prompts">
      {prompts.map((p) => (
        <button
          key={p.label}
          className="copilot-prompt-chip"
          onClick={() => onSelect(p.prompt)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
