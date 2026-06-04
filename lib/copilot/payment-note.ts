// Marker stamped onto every payment the Copilot records, so the payment row
// itself (visible in the Payments view and the accounting CSV export) shows it
// was added through the AI Operator Copilot. The operator's identity lives on
// the payment row (recording user) and in the audit log; the confirmation
// date/time is embedded inline below (and also on the row as paid_at/created_at
// and in the audit log) so the human-readable note is self-contained.
export const COPILOT_PAYMENT_MARKER = "Added via Operator Copilot";

// Must stay within recordPaymentSchema's reference-note limit.
const REFERENCE_NOTE_MAX = 120;

/**
 * Format an instant as an unambiguous UTC stamp: "2026-06-04 14:52 UTC".
 * UTC (not local time) is used deliberately so the recorded time is
 * timezone-unambiguous for audit / dispute purposes.
 */
function formatUtcStamp(at: Date): string {
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * Build the reference note stored for a Copilot-recorded payment: the
 * attribution marker plus the confirmation timestamp, optionally followed by
 * the operator's own note, capped to the column limit. The marker + timestamp
 * are preserved even when the combined note has to be truncated, so attribution
 * is never lost. `recordedAt` is injectable for deterministic testing.
 */
export function buildCopilotPaymentReferenceNote(
  operatorNote?: string,
  recordedAt: Date = new Date()
): string {
  const stamped = `${COPILOT_PAYMENT_MARKER} on ${formatUtcStamp(recordedAt)}`;
  const note = operatorNote?.trim();
  const combined = note ? `${stamped} — ${note}` : stamped;
  if (combined.length <= REFERENCE_NOTE_MAX) return combined;

  return combined.slice(0, REFERENCE_NOTE_MAX).trimEnd();
}
