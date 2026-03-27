import type { ClientErrorReportInput } from "@/lib/validation/observability";

export async function reportClientError(input: ClientErrorReportInput) {
  try {
    await fetch("/api/client-error", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {
    // Swallow client logging errors.
  }
}
