import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.01,
    // Replay integration is added lazily after page load to avoid
    // blocking the main thread and inflating the critical-path bundle.
  });

  if (typeof window !== "undefined") {
    const addReplay = async () => {
      const { replayIntegration } = await import("@sentry/nextjs");
      Sentry.addIntegration(replayIntegration());
    };
    if (document.readyState === "complete") {
      addReplay();
    } else {
      window.addEventListener("load", addReplay, { once: true });
    }
  }
}
