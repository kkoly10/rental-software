"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissHelpBanner } from "@/lib/guidance/actions";
import type { PageHelpConfig } from "@/lib/help/page-help";

export function ContextHelpBanner({
  config,
  dismissed: initialDismissed,
}: {
  config: PageHelpConfig;
  dismissed: boolean;
}) {
  const [hidden, setHidden] = useState(initialDismissed);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  function handleDismiss() {
    setHidden(true);
    startTransition(() => {
      dismissHelpBanner(config.key);
    });
  }

  return (
    <div className="help-banner">
      <div style={{ flex: 1 }}>
        <strong style={{ fontSize: 14 }}>{config.title}</strong>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {config.description}
        </div>
        {(config.primaryAction || config.secondaryAction) && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {config.primaryAction && (
              <Link href={config.primaryAction.href} className="primary-btn" style={{ padding: "6px 14px", fontSize: 12 }}>
                {config.primaryAction.label}
              </Link>
            )}
            {config.secondaryAction && (
              <Link href={config.secondaryAction.href} className="ghost-btn" style={{ padding: "6px 14px", fontSize: 12 }}>
                {config.secondaryAction.label}
              </Link>
            )}
          </div>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="ghost-btn"
        style={{ padding: "4px 10px", fontSize: 18, lineHeight: 1, alignSelf: "flex-start" }}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
