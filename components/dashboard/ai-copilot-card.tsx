"use client";

import { useI18n } from "@/lib/i18n/provider";

/**
 * Carnival v2 home AI Copilot card (Patch 3). Gradient panel matching the
 * dashboard mockup — a friendly message plus suggested questions. Each button
 * opens the existing copilot panel via the shared `korent:open-copilot`
 * window event (the same hook the sidebar "Ask AI" entry uses).
 */
export function AiCopilotCard({ stepsLeft }: { stepsLeft: number }) {
  const { messages: m, t } = useI18n();
  const c = m.dashboard.overview.aiCopilot;

  const openCopilot = () => {
    window.dispatchEvent(new CustomEvent("korent:open-copilot"));
  };

  const message =
    stepsLeft > 0 ? t(c.greetingWithSteps, { count: stepsLeft }) : c.greetingDone;

  return (
    <div className="ai-copilot-card">
      <div className="ai-copilot-card__head">
        <span className="ai-copilot-card__badge" aria-hidden>
          {"✨"}
        </span>
        <span className="ai-copilot-card__title">{c.title}</span>
      </div>
      <p className="ai-copilot-card__bubble">{message}</p>
      <div className="ai-copilot-card__qs">
        {[c.q1, c.q2, c.q3].map((q) => (
          <button key={q} type="button" className="ai-copilot-card__q" onClick={openCopilot}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
