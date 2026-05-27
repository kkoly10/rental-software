import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.01,
    // Replay integration is registered after page load to defer starting
    // DOM observers and the compression WebWorker until the page is idle.
  });

  if (typeof window !== "undefined") {
    const addReplay = async () => {
      const { replayIntegration } = await import("@sentry/nextjs");
      // Mask text and block media so session replays don't capture customer
      // PII (names, emails, addresses) on dashboard/checkout error replays.
      Sentry.addIntegration(replayIntegration({ maskAllText: true, blockAllMedia: true }));
    };
    if (document.readyState === "complete") {
      addReplay();
    } else {
      window.addEventListener("load", addReplay, { once: true });
    }
  }
}
