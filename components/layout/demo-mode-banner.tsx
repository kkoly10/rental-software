import { isDemoMode } from "@/lib/env/demo-mode";

/**
 * Persistent banner shown at the top of every page when the app is running
 * in demo mode (missing critical env vars). Cannot be dismissed.
 */
export function DemoModeBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="demo-mode-banner" role="status" aria-live="polite">
      <span className="demo-mode-banner-full">
        DEMO MODE — Data is not being saved. Connect your accounts to go live.
      </span>
      <span className="demo-mode-banner-short" aria-hidden="true">DEMO MODE</span>
      <a href="/dashboard/settings" className="demo-mode-banner-cta">
        Set up now &rarr;
      </a>
    </div>
  );
}
